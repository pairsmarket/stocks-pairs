/**
 * USD prices for the xStock registry.
 *
 * Two things depend on this, and both are money-sensitive:
 *
 * 1. Curve parameters. DBC denominates initial and migration market cap in the
 *    QUOTE token, so "$4,000" against a $320 stock is 12.5 AAPLx, not 4000. Ship a
 *    SOL-shaped number into a stock config and the curve is wrong by two orders of
 *    magnitude. Nothing may fall back to a default here: no price, no config.
 *
 * 2. The board. A ticker shows its last price and pool liquidity so a launcher can
 *    see what they are pairing against.
 *
 * Jupiter's price v3 endpoint answers in batches and reports decimals, which we
 * cross-check against the registry. A mismatch means the registry is stale and the
 * stock is treated as unpriced rather than launched on a guessed curve.
 */
const axios = require('axios');
const { listStocks, getStock } = require('../config/xstockRegistry');
const { loadSettings } = require('../config/env');
const logger = require('../utils/logger');

const PRICE_URL = 'https://lite-api.jup.ag/price/v3';
const BATCH = 50;
const TTL_MS = 5 * 60 * 1000;

const cache = new Map(); // mint -> { usdPrice, liquidity, decimals, ts }

function headers() {
    const settings = loadSettings();
    const h = { Accept: 'application/json' };
    if (settings.JUPITER_API_KEY) h['x-api-key'] = settings.JUPITER_API_KEY;
    return h;
}

function readCache(mint) {
    const hit = cache.get(mint);
    if (!hit) return null;
    if (Date.now() - hit.ts > TTL_MS) return null;
    return hit;
}

/** Fetch a batch of mints; returns the number of entries stored. */
async function fetchBatch(mints) {
    if (!mints.length) return 0;
    const res = await axios.get(`${PRICE_URL}?ids=${mints.join(',')}`, {
        timeout: 15000,
        headers: headers(),
    });
    const body = res && res.data ? res.data : {};
    let stored = 0;
    for (const mint of mints) {
        const row = body[mint];
        const price = Number(row && row.usdPrice);
        if (!Number.isFinite(price) || price <= 0) continue;
        cache.set(mint, {
            usdPrice: price,
            liquidity: Number(row.liquidity) || 0,
            decimals: Number(row.decimals),
            ts: Date.now(),
        });
        stored += 1;
    }
    return stored;
}

/**
 * Price for one stock. Throws PRICE_UNAVAILABLE rather than returning a guess —
 * a wrong price here becomes a wrong bonding curve.
 */
async function getStockUsdPrice(symbol) {
    const stock = getStock(symbol);
    if (!stock) throw new Error(`Unknown pair: ${symbol}`);

    const cached = readCache(stock.mint);
    if (cached) return cached;

    await fetchBatch([stock.mint]).catch((err) => {
        logger.warn('PRICE', `${stock.symbol}: ${err.message}`);
    });

    const fresh = readCache(stock.mint);
    if (!fresh) throw new Error(`PRICE_UNAVAILABLE:${stock.symbol}`);

    if (Number.isFinite(fresh.decimals) && fresh.decimals !== stock.decimals) {
        throw new Error(
            `DECIMALS_MISMATCH:${stock.symbol}:${fresh.decimals}:${stock.decimals}`
        );
    }
    return fresh;
}

/** Warm the whole registry. Two or three HTTP calls for 102 mints. */
async function refreshAll() {
    const mints = listStocks().map((s) => s.mint);
    let stored = 0;
    for (let i = 0; i < mints.length; i += BATCH) {
        try {
            stored += await fetchBatch(mints.slice(i, i + BATCH));
        } catch (err) {
            logger.warn('PRICE', `batch ${i / BATCH}: ${err.message}`);
        }
    }
    logger.info('PRICE', `${stored}/${mints.length} xStock prices cached`);
    return stored;
}

/** Cached price only, no network. Returns null when cold or stale. */
function peek(symbol) {
    const stock = getStock(symbol);
    if (!stock) return null;
    const hit = readCache(stock.mint);
    return hit ? { usdPrice: hit.usdPrice, liquidity: hit.liquidity } : null;
}

let timer = null;
function start(intervalMs = TTL_MS) {
    if (timer) return;
    const tick = () => refreshAll().catch(() => {});
    tick();
    timer = setInterval(tick, intervalMs);
    if (timer.unref) timer.unref();
}
function stop() {
    if (timer) clearInterval(timer);
    timer = null;
}

function _seedForTest(mint, row) {
    cache.set(mint, { ts: Date.now(), ...row });
}
function _clearForTest() {
    cache.clear();
}

module.exports = {
    getStockUsdPrice,
    refreshAll,
    peek,
    start,
    stop,
    _seedForTest,
    _clearForTest,
};
