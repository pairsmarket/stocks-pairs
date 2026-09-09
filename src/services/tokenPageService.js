/**
 * Holders and trades for one token, read straight off the chain.
 *
 * The shipped token page asked Helius for trades with an API key that is empty
 * in this deployment, falling back to one hardcoded in the source, and parsed
 * the result assuming the quote side was native SOL. On this pad the quote side
 * is usually an SPL or Token-2022 stock, so even with a working key the amounts
 * would have been wrong. Holders were never wired at all.
 *
 * Both answers come from the RPC we already pay for:
 *
 *   holders  getProgramAccounts on the mint, decoding balances from the raw
 *            token-account layout.
 *   trades   the pool's own signatures, with each trade read as the fee payer's
 *            balance delta in the base and quote mints. Quote-agnostic by
 *            construction: whatever the pool is quoted in is what gets read.
 */
const { PublicKey } = require('@solana/web3.js');
const { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } = require('@solana/spl-token');

const { createRpcConnection } = require('../utils/rpc');
const logger = require('../utils/logger');

const HOLDERS_TTL_MS = 30_000;
const TRADES_TTL_MS = 20_000;
const holdersCache = new Map();
const tradesCache = new Map();

const WSOL = 'So11111111111111111111111111111111111111112';
const DBC_PROGRAM = 'dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN';

// Addresses that hold a balance without being a holder in the sense anyone
// means. The pool's own vault is the big one: left in, it always ranks first
// and makes every real holder's share look tiny.
const SYSTEM_ADDRESSES = new Map([
    ['11111111111111111111111111111111', 'system'],
    ['1nc1nerator11111111111111111111111111111111', 'burned'],
    [DBC_PROGRAM, 'bonding curve'],
    // Every DBC vault is owned by this authority, so the label holds even when
    // the pool lookup fails. Without it the vault ranks first as an anonymous
    // whale holding most of the supply.
    ['FhVo3mqL8PW5pH5U2CN4XE33DokiyZnUwuGpH2hmHLuM', 'bonding curve'],
    ['5unTfT2kssBuNvHPY6LbJfJpLqEcdMxGYLWHwShaeTLi', 'bonding curve'],
]);

function conn() {
    return createRpcConnection(undefined, 'confirmed');
}

/** Decimals and supply straight from the mint account. */
async function mintInfo(connection, mint) {
    const parsed = await connection.getParsedAccountInfo(new PublicKey(mint));
    const info = parsed && parsed.value && parsed.value.data && parsed.value.data.parsed
        ? parsed.value.data.parsed.info
        : null;
    if (!info) throw new Error(`MINT_NOT_FOUND:${mint}`);
    return {
        decimals: Number(info.decimals),
        supplyRaw: BigInt(info.supply),
        owner: parsed.value.owner.toBase58(),
    };
}

/**
 * Resolve the pool for a base mint, plus what it is quoted in.
 * Returns null when the mint has no DBC pool, which is not an error: the page
 * still has a token to show.
 */
async function resolvePool(connection, mint) {
    try {
        const { DynamicBondingCurveClient } = require('@meteora-ag/dynamic-bonding-curve-sdk');
        const client = new DynamicBondingCurveClient(connection, 'confirmed');
        const found = await client.state.getPoolByBaseMint(new PublicKey(mint));
        if (!found || !found.publicKey) return null;

        // The shape is { publicKey, account: { poolState } }. Reading
        // account.config gave undefined and every lookup silently returned
        // null, which is why the page reported NO_POOL for a pool that exists.
        const state = found.account && found.account.poolState;
        if (!state || !state.config) return null;

        const config = await client.state.getPoolConfig(state.config);
        const quoteMint = config.quoteMint.toBase58();
        const quote = await mintInfo(connection, quoteMint).catch(() => ({ decimals: 9 }));
        const base = await mintInfo(connection, mint).catch(() => ({ decimals: 9 }));

        const num = (v) => (v && v.toString ? Number(v.toString()) : 0);

        return {
            pool: found.publicKey.toBase58(),
            config: state.config.toBase58(),
            creator: state.creator ? state.creator.toBase58() : null,
            baseVault: state.baseVault ? state.baseVault.toBase58() : null,
            quoteVault: state.quoteVault ? state.quoteVault.toBase58() : null,
            quoteMint,
            quoteDecimals: quote.decimals,
            quoteIsSol: quoteMint === WSOL,
            // Reserves are what the curve is actually holding right now, so the
            // page can show progress without guessing from trade history.
            baseReserve: num(state.baseReserve) / 10 ** base.decimals,
            quoteReserve: num(state.quoteReserve) / 10 ** quote.decimals,
            migrationThreshold: num(config.migrationQuoteThreshold) / 10 ** quote.decimals,
            isMigrated: !!state.isMigrated,
        };
    } catch (err) {
        logger.warn('TOKENPAGE', `pool lookup failed for ${mint}: ${err.message}`);
        return null;
    }
}

/** Label a holder when we know what it is, so the list can be read honestly. */
function labelFor(owner, ctx) {
    if (SYSTEM_ADDRESSES.has(owner)) return SYSTEM_ADDRESSES.get(owner);
    if (ctx.pool && owner === ctx.pool) return 'bonding curve';
    if (ctx.baseVault && owner === ctx.baseVault) return 'bonding curve';
    if (ctx.platform && owner === ctx.platform) return 'platform';
    if (ctx.creator && owner === ctx.creator) return 'creator';
    return null;
}

/**
 * Every account holding this mint, largest first.
 *
 * @param {string} mint
 * @param {object} [opts]
 * @param {number} [opts.limit=50]  how many rows to return
 * @param {string} [opts.creator]   deployer wallet, for the label
 */
async function getHolders(mint, opts = {}) {
    const limit = Math.min(Math.max(Number(opts.limit) || 50, 1), 200);
    const key = `${mint}:${limit}:${opts.creator || ''}`;
    const hit = holdersCache.get(key);
    if (hit && Date.now() - hit.ts < HOLDERS_TTL_MS) return hit.value;

    const connection = conn();
    const mintPk = new PublicKey(mint);
    const info = await mintInfo(connection, mint);

    // getProgramAccounts on a popular mint returns every token account there
    // is. On wrapped SOL that is millions of rows and the RPC rejects the call
    // outright, which surfaced as a 502 at the edge in under half a second.
    // getTokenLargestAccounts answers the same question in one bounded call,
    // and a second call turns those accounts into their owners.
    // Even this has a ceiling: wrapped SOL has ten million token accounts and
    // the RPC refuses to rank them. No launched token will, but a mint that
    // cannot be ranked is a fact to report, not a 502.
    let top = [];
    let rankable = true;
    try {
        const largest = await connection.getTokenLargestAccounts(mintPk);
        top = ((largest && largest.value) || []).slice(0, Math.min(limit, 20));
    } catch (err) {
        rankable = false;
        logger.info('TOKENPAGE', `${mint} cannot be ranked: ${err.message.slice(0, 70)}`);
    }

    let owners = [];
    if (top.length) {
        const parsed = await connection.getMultipleParsedAccounts(
            top.map((t) => t.address)
        );
        owners = ((parsed && parsed.value) || []).map((acc) => {
            const i = acc && acc.data && acc.data.parsed && acc.data.parsed.info;
            return i ? i.owner : null;
        });
    }

    const pool = await resolvePool(connection, mint);
    const ctx = {
        pool: pool ? pool.pool : null,
        baseVault: pool ? pool.baseVault : null,
        platform: (process.env.PLATFORM_PUBKEY || '').trim() || null,
        // The pool records its own creator, so the label does not depend on the
        // caller passing one in.
        creator: opts.creator || (pool ? pool.creator : null),
    };

    const rows = top.map((t, i) => ({
        owner: owners[i] || t.address.toBase58(),
        account: t.address.toBase58(),
        amountRaw: BigInt(t.amount),
    })).filter((r) => r.amountRaw > 0n);

    rows.sort((a, b) => (a.amountRaw < b.amountRaw ? 1 : a.amountRaw > b.amountRaw ? -1 : 0));

    const supply = info.supplyRaw;
    const toUi = (raw) => Number(raw) / 10 ** info.decimals;
    // ppm then down to a percentage. Scaling by 10^6 and dividing by 10^2 gave
    // 9663.89% for a wallet holding 96.6% of supply.
    const sharePct = (raw) => (supply > 0n ? Number((raw * 1000000n) / supply) / 10000 : 0);

    const labelled = rows.map((r) => ({ ...r, label: labelFor(r.owner, ctx) }));

    const holders = labelled.map((r, i) => ({
        rank: i + 1,
        owner: r.owner,
        account: r.account,
        amount: toUi(r.amountRaw),
        amountRaw: r.amountRaw.toString(),
        share: sharePct(r.amountRaw),
        label: r.label,
    }));

    const curveRaw = labelled
        .filter((r) => r.label === 'bonding curve')
        .reduce((acc, r) => acc + r.amountRaw, 0n);

    // A total needs every account, which is the call that fails on a big mint.
    // Attempt it, and report honestly when it cannot be had rather than
    // printing the top-20 count as if it were the whole book.
    let holderCount = null;
    let countExact = false;
    try {
        const all = await connection.getProgramAccounts(
            info.owner === TOKEN_2022_PROGRAM_ID.toBase58() ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID,
            {
                filters: [{ dataSize: 165 }, { memcmp: { offset: 0, bytes: mintPk.toBase58() } }],
                // Just the 8 amount bytes. An empty token account is not a
                // holder, and counting every account made a token with three
                // real holders report seven.
                dataSlice: { offset: 64, length: 8 },
            }
        );
        holderCount = all.filter(
            (a) => a.account.data && a.account.data.readBigUInt64LE(0) > 0n
        ).length;
        countExact = true;
    } catch (err) {
        logger.info('TOKENPAGE', `holder count unavailable for ${mint}: ${err.message.slice(0, 60)}`);
    }

    const value = {
        mint,
        decimals: info.decimals,
        supply: toUi(supply),
        // Supply minus what is still sitting on the curve. A wallet's share of
        // the float is the number a trader actually cares about.
        circulating: toUi(supply - curveRaw),
        holderCount,
        countExact,
        walletCount: countExact
            ? Math.max(holderCount - labelled.filter((r) => r.label).length, 0)
            : null,
        // Only the top slice is returned, so say so rather than implying the
        // list is complete.
        truncated: holders.length >= 20,
        rankable,
        curveHeld: toUi(curveRaw),
        pool: pool ? pool.pool : null,
        curve: pool ? {
            quoteMint: pool.quoteMint,
            quoteIsSol: pool.quoteIsSol,
            baseReserve: pool.baseReserve,
            quoteReserve: pool.quoteReserve,
            migrationThreshold: pool.migrationThreshold,
            progress: pool.migrationThreshold > 0
                ? Math.min(pool.quoteReserve / pool.migrationThreshold, 1)
                : null,
            isMigrated: pool.isMigrated,
            creator: pool.creator,
        } : null,
        holders,
    };

    holdersCache.set(key, { ts: Date.now(), value });
    return value;
}

/** Signed delta for one owner and mint across a parsed transaction. */
function tokenDelta(meta, ownerIndexKeys, owner, mint) {
    const pick = (list) => (list || []).filter(
        (b) => b.mint === mint && b.owner === owner
    );
    const sum = (list) => pick(list).reduce(
        (acc, b) => acc + BigInt(b.uiTokenAmount.amount), 0n
    );
    return sum(meta.postTokenBalances) - sum(meta.preTokenBalances);
}

/**
 * Recent trades against this token's pool.
 *
 * Each row is read as the fee payer's balance change, which is what a trader
 * actually experienced, and works the same whether the pool is quoted in SOL or
 * in a Token-2022 stock.
 */
async function getTrades(mint, opts = {}) {
    const limit = Math.min(Math.max(Number(opts.limit) || 30, 1), 100);
    const key = `${mint}:${limit}`;
    const hit = tradesCache.get(key);
    if (hit && Date.now() - hit.ts < TRADES_TTL_MS) return hit.value;

    const connection = conn();
    const pool = await resolvePool(connection, mint);
    if (!pool) {
        const empty = { mint, pool: null, quoteMint: null, trades: [], reason: 'NO_POOL' };
        tradesCache.set(key, { ts: Date.now(), value: empty });
        return empty;
    }

    const base = await mintInfo(connection, mint);
    const sigs = await connection.getSignaturesForAddress(new PublicKey(pool.pool), {
        limit: Math.min(limit * 3, 200),
    });

    const wanted = sigs.filter((s) => !s.err).map((s) => s.signature);
    const trades = [];

    // Batches of 25: getParsedTransactions is happy with more, but a smaller
    // batch keeps one slow RPC call from stalling the whole page.
    for (let i = 0; i < wanted.length && trades.length < limit; i += 25) {
        const batch = wanted.slice(i, i + 25);
        let txs = [];
        try {
            txs = await connection.getParsedTransactions(batch, {
                maxSupportedTransactionVersion: 0,
            });
        } catch (err) {
            logger.warn('TOKENPAGE', `tx batch failed for ${mint}: ${err.message}`);
            break;
        }

        for (let j = 0; j < txs.length; j++) {
            const tx = txs[j];
            if (!tx || !tx.meta || tx.meta.err) continue;

            const keys = tx.transaction.message.accountKeys;
            const trader = keys[0] && (keys[0].pubkey ? keys[0].pubkey.toString() : String(keys[0]));
            if (!trader) continue;

            const baseDelta = tokenDelta(tx.meta, keys, trader, mint);
            if (baseDelta === 0n) continue;   // not a trade for this trader

            let quoteDelta;
            if (pool.quoteIsSol) {
                // A SOL-quoted pool moves lamports, not token balances. The fee
                // is subtracted so the number reads as what the trade cost.
                const lamports = BigInt(tx.meta.postBalances[0] - tx.meta.preBalances[0]);
                quoteDelta = lamports + BigInt(tx.meta.fee);
            } else {
                quoteDelta = tokenDelta(tx.meta, keys, trader, pool.quoteMint);
            }

            const baseAmount = Number(baseDelta) / 10 ** base.decimals;
            const quoteAmount = Number(quoteDelta) / 10 ** pool.quoteDecimals;
            const side = baseDelta > 0n ? 'buy' : 'sell';

            trades.push({
                signature: batch[j],
                blockTime: tx.blockTime || null,
                side,
                trader,
                baseAmount: Math.abs(baseAmount),
                quoteAmount: Math.abs(quoteAmount),
                // Price in quote per base. Zero base would be a divide by zero,
                // and is already filtered above.
                price: Math.abs(baseAmount) > 0
                    ? Math.abs(quoteAmount) / Math.abs(baseAmount)
                    : null,
            });
            if (trades.length >= limit) break;
        }
    }

    trades.sort((a, b) => (b.blockTime || 0) - (a.blockTime || 0));

    const value = {
        mint,
        pool: pool.pool,
        quoteMint: pool.quoteMint,
        quoteDecimals: pool.quoteDecimals,
        quoteIsSol: pool.quoteIsSol,
        trades,
    };
    tradesCache.set(key, { ts: Date.now(), value });
    return value;
}

function _clearForTest() {
    holdersCache.clear();
    tradesCache.clear();
}

module.exports = { getHolders, getTrades, resolvePool, _clearForTest };
