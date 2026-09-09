/**
 * What a pool can be quoted in.
 *
 * A Meteora DBC config is bound to exactly one quote mint, so "which pair" is
 * really "which config". A pair here is SOL, or any symbol in the xStock
 * registry, and the registry is the only source of truth for a stock's mint
 * and decimals. Falling back to SOL's 9 decimals for a stock would be a 10x
 * error on every amount downstream, so there is no fallback.
 *
 * Nothing in this file holds a value. Config addresses and the platform
 * keypair come from the environment; see .env.example.
 */
const { canonical, getStock, listStocks } = require('./xstockRegistry');

const SOL_MINT = 'So11111111111111111111111111111111111111112';
const SOL_DECIMALS = 9;

/** @returns {string|null} the canonical symbol, or null if it is not a pair */
function normalizePair(pair) {
    const raw = String(pair || '').trim();
    if (!raw) return null;
    if (raw.toUpperCase() === 'SOL') return 'SOL';
    return canonical(raw);
}

function listPairs() {
    return [
        { symbol: 'SOL', mint: SOL_MINT, decimals: SOL_DECIMALS, name: 'Solana' },
        ...listStocks(),
    ];
}

/**
 * Env-var-safe form of a symbol. "BRK.Bx" cannot appear in an env key, so
 * every character outside A-Z0-9 becomes an underscore:
 *   AAPLx  -> CONFIG_AAPLX
 *   BRK.Bx -> CONFIG_BRK_BX
 */
function envKeyFor(symbol) {
    return String(symbol).toUpperCase().replace(/[^A-Z0-9]/g, '_');
}

function getQuoteMint(pair) {
    const normalized = normalizePair(pair);
    if (!normalized) throw new Error(`Unknown pair: ${pair}`);
    return normalized === 'SOL' ? SOL_MINT : getStock(normalized).mint;
}

function getQuoteDecimals(pair) {
    const normalized = normalizePair(pair);
    if (!normalized) throw new Error(`Unknown pair: ${pair}`);
    return normalized === 'SOL' ? SOL_DECIMALS : getStock(normalized).decimals;
}

/**
 * The config address for a pair.
 *
 * A stock config can come from either of two places, and an operator-prepared
 * one always wins: a config built by hand — with a curve you chose rather than
 * one derived from a price — can be dropped into the environment without a
 * code change. Otherwise the store holds whatever was created lazily on first
 * use. A stock with neither throws, rather than silently borrowing SOL's
 * config and pricing a curve in the wrong token.
 *
 * @throws {Error} `STOCK_CONFIG_MISSING:<symbol>` when there is no config yet
 */
function resolveConfigAddress(pair) {
    const normalized = normalizePair(pair);
    if (!normalized) throw new Error(`Unknown pair: ${pair}`);

    if (normalized !== 'SOL') {
        const fromEnv = (process.env[`CONFIG_${envKeyFor(normalized)}`] || '').trim();
        if (fromEnv.length >= 32) return fromEnv;

        const record = require('../services/stockConfigStore').get(normalized);
        if (record && record.config) return record.config;

        throw new Error(`STOCK_CONFIG_MISSING:${normalized}`);
    }

    const addr = (process.env.CONFIG_SOL || '').trim();
    if (addr.length >= 32) return addr;

    throw new Error('No config address for SOL. Set CONFIG_SOL.');
}

/**
 * The wallet that owns every config on this pad.
 *
 * It is the fee claimer, the leftover receiver, and it pays the rent when a
 * new stock config is created. The private key is read here and nowhere else
 * in this module; it is never logged, never returned by an API, and never
 * written to disk.
 *
 * @returns {{pubkey: string, privkey: string}}
 */
function getPlatformWallet() {
    return {
        pubkey: (process.env.PLATFORM_PUBKEY || '').trim(),
        privkey: (process.env.PLATFORM_PRIVKEY || '').trim(),
    };
}

/**
 * Boot check.
 *
 * Only SOL needs a config in the environment. Stock configs are created on
 * first use, so reporting 102 missing configs at boot would be noise, and the
 * platform wallet is not required either: reading pairs, holders and trades
 * needs no key, and a pad that can only be read is a valid pad.
 */
function validateLaunchpadConfig() {
    const missing = [];
    try {
        resolveConfigAddress('SOL');
    } catch (_) {
        missing.push('CONFIG_SOL');
    }
    return { valid: missing.length === 0, missing };
}

module.exports = {
    SOL_MINT,
    SOL_DECIMALS,
    normalizePair,
    listPairs,
    envKeyFor,
    getQuoteMint,
    getQuoteDecimals,
    resolveConfigAddress,
    getPlatformWallet,
    validateLaunchpadConfig,
};
