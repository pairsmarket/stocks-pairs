/**
 * Can a wallet actually get hold of this stock?
 *
 * A launcher who picks AAPLx needs AAPLx to make the first buy, and most people
 * hold SOL. So before the picker offers a stock, ask Jupiter whether SOL routes
 * to it and at what rate. A thin ETF with no route is worse than a locked
 * ticker: the launch would build, then fail on a balance the user cannot get.
 *
 * The quote doubles as a price: one SOL in, N base units out.
 */
const axios = require('axios');
const { getStock } = require('../config/xstockRegistry');
const { loadSettings } = require('../config/env');
const logger = require('../utils/logger');

const WSOL = 'So11111111111111111111111111111111111111112';
const QUOTE_URL = 'https://api.jup.ag/swap/v1/quote';
const TTL_MS = 5 * 60 * 1000;

const cache = new Map(); // symbol -> { routable, perSol, ts }

function headers() {
    const settings = loadSettings();
    const h = { Accept: 'application/json' };
    if (settings.JUPITER_API_KEY) h['x-api-key'] = settings.JUPITER_API_KEY;
    return h;
}

/** Cached answer only, no network. Returns null when cold. */
function peek(symbol) {
    const stock = getStock(symbol);
    if (!stock) return null;
    const hit = cache.get(stock.symbol);
    if (!hit || Date.now() - hit.ts > TTL_MS) return null;
    return { routable: hit.routable, perSol: hit.perSol };
}

/**
 * Ask Jupiter for a 1 SOL -> stock quote.
 * @returns {{routable: boolean, perSol: number|null}} perSol is in whole stock units
 */
async function checkRoute(symbol) {
    const stock = getStock(symbol);
    if (!stock) throw new Error(`Unknown pair: ${symbol}`);

    const cached = peek(stock.symbol);
    if (cached) return cached;

    try {
        const res = await axios.get(QUOTE_URL, {
            params: {
                inputMint: WSOL,
                outputMint: stock.mint,
                amount: 1_000_000_000, // 1 SOL
                slippageBps: 100,
            },
            timeout: 12000,
            headers: headers(),
        });
        const out = Number(res && res.data && res.data.outAmount);
        if (Number.isFinite(out) && out > 0) {
            const result = { routable: true, perSol: out / 10 ** stock.decimals };
            cache.set(stock.symbol, { ...result, ts: Date.now() });
            return result;
        }
        // A 200 with no outAmount is Jupiter saying it found nothing.
        const empty = { routable: false, perSol: null };
        cache.set(stock.symbol, { ...empty, ts: Date.now() });
        return empty;
    } catch (err) {
        const status = err.response ? err.response.status : 0;

        // 429 means Jupiter throttled us and 5xx means it is having a bad
        // minute. Neither says anything about whether a route exists, so
        // caching them as "no route" would put a false warning in front of a
        // launcher for the next five minutes. Leave it unknown and retry.
        if (status === 429 || status >= 500 || status === 0) {
            logger.warn('ROUTE', `${stock.symbol}: unknown, Jupiter returned ${status || err.message}`);
            throw new Error(`ROUTE_UNKNOWN:${stock.symbol}:${status || 'network'}`);
        }

        // A 400 is Jupiter answering: no route for this pair. That is real.
        logger.info('ROUTE', `${stock.symbol}: no route`);
        const none = { routable: false, perSol: null };
        cache.set(stock.symbol, { ...none, ts: Date.now() });
        return none;
    }
}

/**
 * Warm the routes most people will pick: the deepest stocks by pool liquidity.
 * Checking all 102 every cycle would be 102 Jupiter calls for tickers nobody
 * selects, so this stays deliberately small and the picker asks for the rest.
 */
async function warmTop(limit = 20) {
    const { listStocks } = require('../config/xstockRegistry');
    const prices = require('./stockPriceService');
    const ranked = listStocks()
        .map((s) => ({ symbol: s.symbol, liq: (prices.peek(s.symbol) || {}).liquidity || 0 }))
        .filter((s) => s.liq > 0)
        .sort((a, b) => b.liq - a.liq)
        .slice(0, limit);

    let routable = 0;
    let throttled = 0;
    for (const s of ranked) {
        try {
            const r = await checkRoute(s.symbol);
            if (r.routable) routable += 1;
        } catch (err) {
            // Back off hard on the first throttle rather than walking the whole
            // list collecting 429s.
            if (String(err.message).startsWith('ROUTE_UNKNOWN')) {
                throttled += 1;
                if (throttled >= 3) {
                    logger.warn('ROUTE', 'Jupiter is throttling, stopping this sweep');
                    break;
                }
                await new Promise((r2) => setTimeout(r2, 3000));
            }
        }
        await new Promise((r2) => setTimeout(r2, 900));
    }
    logger.info('ROUTE', `${routable} of the deepest stocks route from SOL${throttled ? `, ${throttled} unknown` : ''}`);
    return routable;
}

let timer = null;
function start(intervalMs = 10 * 60 * 1000) {
    if (timer) return;
    const tick = () => warmTop().catch(() => {});
    setTimeout(tick, 20000); // let prices land first
    timer = setInterval(tick, intervalMs);
    if (timer.unref) timer.unref();
}
function stop() {
    if (timer) clearInterval(timer);
    timer = null;
}

function _seedForTest(symbol, row) {
    cache.set(symbol, { ts: Date.now(), ...row });
}
function _clearForTest() {
    cache.clear();
}

module.exports = { checkRoute, peek, warmTop, start, stop, _seedForTest, _clearForTest };
