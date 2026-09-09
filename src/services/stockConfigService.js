/**
 * One DBC config per stock, created the first time that stock is actually used.
 *
 * A DBC config is bound to a single quote mint, so a launchpad with 102 possible
 * quotes needs up to 102 configs. Creating them all up front would spend rent on
 * tickers nobody launches against, so this creates one on demand and records it.
 *
 * Two things here are money-critical:
 *
 * 1. `migrationQuoteThreshold` is denominated in the QUOTE token. The SOL config
 *    ships 85, meaning 85 SOL. Carry that number into an AAPLx config and it means
 *    85 AAPLx — roughly $27,000 instead of the ~$21,000 the SOL curve raises. So the
 *    threshold is always computed from a live USD target divided by the stock's
 *    price, and a stock with no price gets no config at all.
 *
 * 2. Base decimals must equal quote decimals. xStocks are 8, so tokens launched
 *    against a stock are 8-decimal tokens, not the usual 9. A mismatch makes every
 *    market-cap readout wrong by 10^(2*(base-quote)).
 */
const { Keypair, PublicKey } = require('@solana/web3.js');
const {
    DynamicBondingCurveClient,
    buildCurve,
} = require('@meteora-ag/dynamic-bonding-curve-sdk');
const bs58 = require('bs58');

const { normalizePair, getPlatformWallet, resolveConfigAddress } = require('../config/pairs');
const { getStock } = require('../config/xstockRegistry');
const tokenBadgeService = require('./tokenBadgeService');
const stockPriceService = require('./stockPriceService');
const store = require('./stockConfigStore');
const logger = require('../utils/logger');

// Curve economics, expressed in dollars so every stock lands in the same place.
// The SOL config raises 85 SOL before migrating; these are the dollar equivalents.
const DEFAULTS = {
    migrationQuoteUsd: Number(process.env.STOCK_MIGRATION_QUOTE_USD || 21000),
    totalTokenSupply: Number(process.env.STOCK_TOTAL_SUPPLY || 1_000_000_000),
    percentageSupplyOnMigration: Number(process.env.STOCK_SUPPLY_ON_MIGRATION || 20),
    feeBps: Number(process.env.STOCK_FEE_BPS || 300),
    creatorTradingFeePercentage: Number(process.env.STOCK_CREATOR_FEE_PCT || 0),
};

/**
 * Quote-denominated curve numbers for a stock trading at `priceUsd`.
 * Pure function, no I/O — the piece worth testing on its own.
 */
function curveParamsForPrice(priceUsd, opts = {}) {
    const price = Number(priceUsd);
    if (!Number.isFinite(price) || price <= 0) {
        throw new Error(`Invalid stock price: ${priceUsd}`);
    }
    const migrationQuoteUsd = Number(
        opts.migrationQuoteUsd !== undefined ? opts.migrationQuoteUsd : DEFAULTS.migrationQuoteUsd
    );
    return {
        priceUsd: price,
        migrationQuoteUsd,
        // Quote tokens that must be raised before the pool migrates.
        migrationQuoteThreshold: migrationQuoteUsd / price,
        percentageSupplyOnMigration:
            opts.percentageSupplyOnMigration !== undefined
                ? opts.percentageSupplyOnMigration
                : DEFAULTS.percentageSupplyOnMigration,
    };
}

/** Full SDK curve config for a stock at a given price. */
function buildStockCurve(symbol, priceUsd, opts = {}) {
    const stock = getStock(symbol);
    if (!stock) throw new Error(`Unknown pair: ${symbol}`);

    const params = curveParamsForPrice(priceUsd, opts);
    const decimals = stock.decimals; // 8 — base must match quote
    const feeBps = opts.feeBps !== undefined ? opts.feeBps : DEFAULTS.feeBps;

    const curve = buildCurve({
        totalTokenSupply: opts.totalTokenSupply || DEFAULTS.totalTokenSupply,
        percentageSupplyOnMigration: params.percentageSupplyOnMigration,
        migrationQuoteThreshold: params.migrationQuoteThreshold,
        token: {
            totalTokenSupply: opts.totalTokenSupply || DEFAULTS.totalTokenSupply,
            tokenType: 0,
            tokenBaseDecimal: decimals,
            tokenQuoteDecimal: decimals,
            tokenAuthorityOption: 1,
            leftover: 1000,
        },
        fee: {
            baseFeeParams: {
                baseFeeMode: 0, // FeeSchedulerLinear with equal start/end = flat fee
                feeSchedulerParam: {
                    startingFeeBps: feeBps,
                    endingFeeBps: feeBps,
                    numberOfPeriod: 0,
                    totalDuration: 0,
                },
            },
            dynamicFeeEnabled: false,
            collectFeeMode: 0, // quote only
            creatorTradingFeePercentage:
                opts.creatorTradingFeePercentage !== undefined
                    ? opts.creatorTradingFeePercentage
                    : DEFAULTS.creatorTradingFeePercentage,
            poolCreationFee: 0,
            enableFirstSwapWithMinFee: false,
        },
        migration: {
            migrationOption: 1, // DAMM v2 — v1 was removed in DBC 0.2.1
            migrationFeeOption: 5,
            migrationFee: { feePercentage: 0, creatorFeePercentage: 0 },
            migratedPoolFee: { collectFeeMode: 0, dynamicFee: 0, poolFeeBps: 0 },
        },
        liquidityDistribution: {
            partnerPermanentLockedLiquidityPercentage: 100,
            partnerLiquidityPercentage: 0,
            partnerLiquidityVestingInfoParams: null,
            creatorPermanentLockedLiquidityPercentage: 0,
            creatorLiquidityPercentage: 0,
            creatorLiquidityVestingInfoParams: null,
        },
        lockedVesting: {
            totalLockedVestingAmount: 0,
            numberOfVestingPeriod: 0,
            cliffUnlockAmount: 0,
            totalVestingDuration: 0,
            cliffDurationFromMigrationTime: 0,
        },
        activationType: 1, // timestamp
    });

    return { curve, params, decimals };
}

function platformKeypair() {
    const { privkey } = getPlatformWallet();
    if (!privkey || privkey.length < 20) throw new Error('PLATFORM_PRIVKEY not configured');
    const decode = bs58.decode || (bs58.default && bs58.default.decode);
    return Keypair.fromSecretKey(decode(privkey));
}

/**
 * Return the config address for a pair, creating one for a stock if needed.
 *
 * Order matters. The badge check runs before any network call and before anything
 * that costs money, because a stock without a badge cannot have a config at all and
 * everything after this point is billable.
 *
 * @returns {{config: string|null, created: boolean, wouldCreate?: boolean, params?: object}}
 */
// One creation per symbol at a time. Without this, two people launching against
// the same fresh stock in the same second would each pay rent for a config and
// one of the two would be orphaned on-chain.
const inFlight = new Map();

async function ensureConfig(symbol, opts = {}) {
    const key = require('../config/pairs').normalizePair(symbol);
    if (!key || key === 'SOL' || opts.dryRun) return _ensureConfig(symbol, opts);
    if (inFlight.has(key)) return inFlight.get(key);
    const promise = _ensureConfig(symbol, opts).finally(() => inFlight.delete(key));
    inFlight.set(key, promise);
    return promise;
}

async function _ensureConfig(symbol, { connection, dryRun = false, ...opts } = {}) {
    const pair = normalizePair(symbol);
    if (!pair) throw new Error(`Unknown pair: ${symbol}`);
    if (pair === 'SOL') return { config: resolveConfigAddress('SOL'), created: false };

    const badge = tokenBadgeService.getStatus(pair);
    if (!badge.unlocked) throw new Error(`BADGE_MISSING:${pair}`);

    const existing = store.get(pair);
    if (existing && existing.config) return { config: existing.config, created: false };

    // Seam: tests inject a price provider so a cold cache cannot reach the network.
    const priceProvider = opts.priceProvider || stockPriceService.getStockUsdPrice;
    const price = await priceProvider(pair);
    const { curve, params, decimals } = buildStockCurve(pair, price.usdPrice, opts);

    if (dryRun) {
        return { config: null, created: false, wouldCreate: true, params, curve };
    }

    if (!connection) throw new Error('connection is required to create a config');

    // The registry says 8, but the chain is the authority for a number that drives
    // every amount we compute. Verify before spending.
    const stock = getStock(pair);
    const mintInfo = await connection.getParsedAccountInfo(new PublicKey(stock.mint));
    const onChainDecimals = mintInfo &&
        mintInfo.value &&
        mintInfo.value.data &&
        mintInfo.value.data.parsed &&
        mintInfo.value.data.parsed.info
        ? Number(mintInfo.value.data.parsed.info.decimals)
        : NaN;
    if (Number.isFinite(onChainDecimals) && onChainDecimals !== decimals) {
        throw new Error(`DECIMALS_MISMATCH:${pair}:${onChainDecimals}:${decimals}`);
    }

    const payer = platformKeypair();
    const configKeypair = Keypair.generate();
    const client = new DynamicBondingCurveClient(connection, 'confirmed');

    const tx = await client.partner.createConfig({
        config: configKeypair.publicKey,
        feeClaimer: payer.publicKey,
        leftoverReceiver: payer.publicKey,
        quoteMint: new PublicKey(stock.mint),
        payer: payer.publicKey,
        tokenBadge: new PublicKey(badge.badge),
        ...curve,
    });

    const { sendAndConfirmTransaction } = require('@solana/web3.js');
    const signature = await sendAndConfirmTransaction(connection, tx, [payer, configKeypair], {
        commitment: 'confirmed',
        maxRetries: 5,
    });

    const record = {
        config: configKeypair.publicKey.toBase58(),
        quoteMint: stock.mint,
        quoteDecimals: decimals,
        migrationQuoteThreshold: params.migrationQuoteThreshold,
        migrationQuoteUsd: params.migrationQuoteUsd,
        priceUsdAtCreation: params.priceUsd,
        createdAt: new Date().toISOString(),
        txSignature: signature,
    };
    store.set(pair, record);
    logger.success('CONFIG', `${pair} config ${record.config} (${signature.slice(0, 16)}...)`);

    return { config: record.config, created: true, record };
}

module.exports = { curveParamsForPrice, buildStockCurve, ensureConfig, DEFAULTS };
