/**
 * GET /api/pairs        — every pair the launchpad knows, and whether it is open
 * GET /api/pairs/:symbol — one pair, with its badge PDA and stored config
 *
 * Reads caches only. The badge sweep and the price sweep run on their own timers,
 * so a request never waits on an RPC round trip and a burst of traffic cannot turn
 * into a burst of chain reads.
 */
const express = require('express');
const { listPairs, normalizePair, resolveConfigAddress, SOL_MINT, SOL_DECIMALS } = require('../config/pairs');
const tokenBadgeService = require('../services/tokenBadgeService');
const stockPriceService = require('../services/stockPriceService');
const stockConfigStore = require('../services/stockConfigStore');
const stockRouteService = require('../services/stockRouteService');

const router = express.Router();

// SOL needs no badge, so for SOL "unlocked" means a config exists. Asking
// resolveConfigAddress rather than reading the env var here keeps one answer
// to "is SOL launchable" instead of two that can disagree.
function solRow() {
    let hasConfig = true;
    try {
        resolveConfigAddress('SOL');
    } catch (_) {
        hasConfig = false;
    }
    return {
        id: 'SOL',
        name: 'Solana',
        mint: SOL_MINT,
        decimals: SOL_DECIMALS,
        unlocked: hasConfig,
        hasConfig,
        priceUsd: null,
        liquidityUsd: null,
    };
}

function stockRow(pair) {
    const status = tokenBadgeService.getStatus(pair.symbol);
    const price = stockPriceService.peek(pair.symbol);
    const stored = stockConfigStore.get(pair.symbol);
    const route = stockRouteService.peek(pair.symbol);
    return {
        id: pair.symbol,
        name: pair.name,
        mint: pair.mint,
        decimals: pair.decimals,
        unlocked: status ? status.unlocked : false,
        hasConfig: !!(stored && stored.config),
        priceUsd: price ? price.usdPrice : null,
        liquidityUsd: price ? price.liquidity : null,
        perSol: route ? route.perSol : null,
        routable: route ? route.routable : null,
    };
}

router.get('/', (req, res) => {
    const snap = tokenBadgeService.snapshot();
    const rows = [solRow(), ...listPairs().filter((p) => p.symbol !== 'SOL').map(stockRow)];
    return res.json({
        ok: true,
        checkedAt: snap.checkedAt,
        total: rows.length,
        stockTotal: snap.total,
        unlockedCount: snap.unlockedCount,
        pairs: rows,
    });
});

/**
 * Whether SOL routes to this stock, asked live. Separate from the list endpoint
 * so one slow Jupiter call cannot hold up the board.
 */
router.get('/:symbol/route', async (req, res) => {
    const pair = normalizePair(req.params.symbol);
    if (!pair || pair === 'SOL') {
        return res.status(404).json({ ok: false, error: 'UNKNOWN_PAIR', pair: req.params.symbol });
    }
    try {
        const route = await stockRouteService.checkRoute(pair);
        return res.json({ ok: true, symbol: pair, ...route });
    } catch (err) {
        // A throttled or failed check is not an answer. Report it as one and the
        // picker would tell a launcher there is no route when there may well be.
        if (String(err.message).startsWith('ROUTE_UNKNOWN')) {
            return res.status(503).json({ ok: false, error: 'ROUTE_UNKNOWN', symbol: pair });
        }
        return res.status(502).json({ ok: false, error: 'ROUTE_CHECK_FAILED', message: err.message });
    }
});

router.get('/:symbol', (req, res) => {
    const pair = normalizePair(req.params.symbol);
    if (!pair) {
        return res.status(404).json({ ok: false, error: 'UNKNOWN_PAIR', pair: req.params.symbol });
    }
    if (pair === 'SOL') {
        return res.json({ ok: true, pair: { ...solRow(), badge: null, config: null } });
    }
    const status = tokenBadgeService.getStatus(pair);
    const stored = stockConfigStore.get(pair);
    const entry = listPairs().find((p) => p.symbol === pair);
    return res.json({
        ok: true,
        pair: {
            ...stockRow(entry),
            badge: status.badge,
            config: stored ? stored.config : null,
            configCreatedAt: stored ? stored.createdAt : null,
            migrationQuoteThreshold: stored ? stored.migrationQuoteThreshold : null,
        },
    });
});

module.exports = router;
