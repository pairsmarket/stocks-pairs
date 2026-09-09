/**
 * DBC token badges — the gate that decides whether a stock can be a quote mint.
 *
 * Meteora's DBC program used to reject any Token-2022 quote carrying extensions
 * beyond metadata, which is every xStock. Program 0.2.1 replaced that check with
 * `validate_quote_mint_with_token_badge`: a badge account, passed as remaining
 * account index 0 on config and pool creation, makes such a quote legal.
 *
 * A badge is created by `create_token_badge`, which requires a Meteora Operator
 * signer. We cannot mint one. All this service does is watch for badges appearing
 * and report which stocks are open, so the site can flip a ticker from locked to
 * tradable within a minute of Meteora issuing it — no restart, no deploy.
 *
 * The whole registry costs two RPC calls to sweep (102 PDAs, 100 per batch), so a
 * 60s poll is cheap. Request handlers read the cache and never touch the chain.
 */
const { PublicKey } = require('@solana/web3.js');
const { deriveTokenBadgeAddress } = require('@meteora-ag/dynamic-bonding-curve-sdk');
const { listStocks, getStock } = require('../config/xstockRegistry');
const logger = require('../utils/logger');

const state = {
    unlocked: new Set(),
    checkedAt: null,
    lastError: null,
    timer: null,
    inFlight: null,
};

/** Badge PDA for a mint: seeds ["token_badge", mint] under the DBC program. */
function deriveBadge(mint) {
    return deriveTokenBadgeAddress(mint instanceof PublicKey ? mint : new PublicKey(mint));
}

/**
 * Sweep every registered stock's badge PDA and replace the cache.
 * Concurrent callers share one sweep rather than stacking RPC load.
 */
async function refresh(connection) {
    if (state.inFlight) return state.inFlight;

    state.inFlight = (async () => {
        const stocks = listStocks();
        const found = new Set();

        for (let i = 0; i < stocks.length; i += 100) {
            const chunk = stocks.slice(i, i + 100);
            const infos = await connection.getMultipleAccountsInfo(
                chunk.map((s) => deriveBadge(s.mint))
            );
            infos.forEach((info, j) => {
                if (info) found.add(chunk[j].symbol);
            });
        }

        const gained = [...found].filter((s) => !state.unlocked.has(s));
        state.unlocked = found;
        state.checkedAt = new Date().toISOString();
        state.lastError = null;

        if (gained.length) {
            logger.success('BADGE', `unlocked: ${gained.join(', ')}`);
        }
        return { checkedAt: state.checkedAt, unlocked: found, gained };
    })()
        .catch((err) => {
            // A failed sweep must not empty the cache — a stock that was open stays
            // open until a successful sweep says otherwise.
            state.lastError = err.message;
            logger.warn('BADGE', `sweep failed: ${err.message}`);
            throw err;
        })
        .finally(() => {
            state.inFlight = null;
        });

    return state.inFlight;
}

/** @returns {null} for an unknown symbol, never throws. */
function getStatus(symbol) {
    const s = getStock(symbol);
    if (!s) return null;
    return {
        symbol: s.symbol,
        mint: s.mint,
        decimals: s.decimals,
        name: s.name,
        badge: deriveBadge(s.mint).toBase58(),
        unlocked: state.unlocked.has(s.symbol),
        checkedAt: state.checkedAt,
    };
}

function isUnlocked(symbol) {
    const s = getStock(symbol);
    return !!s && state.unlocked.has(s.symbol);
}

function snapshot() {
    return {
        checkedAt: state.checkedAt,
        lastError: state.lastError,
        total: listStocks().length,
        unlockedCount: state.unlocked.size,
        unlocked: [...state.unlocked].sort(),
    };
}

function start(connection, intervalMs = 60000) {
    if (state.timer) return;
    const tick = () => refresh(connection).catch(() => {});
    tick();
    state.timer = setInterval(tick, intervalMs);
    if (state.timer.unref) state.timer.unref();
    logger.info('BADGE', `watching ${listStocks().length} xStock badges every ${intervalMs / 1000}s`);
}

function stop() {
    if (state.timer) clearInterval(state.timer);
    state.timer = null;
}

/** Test seam — lets a test set cache state without touching the network. */
function _setUnlockedForTest(symbols) {
    state.unlocked = new Set(symbols);
    state.checkedAt = new Date().toISOString();
}

module.exports = {
    deriveBadge,
    refresh,
    getStatus,
    isUnlocked,
    snapshot,
    start,
    stop,
    _setUnlockedForTest,
};
