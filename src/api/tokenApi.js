/**
 * GET /api/token/:mint/holders   who holds it, largest first
 * GET /api/token/:mint/trades    recent trades against its pool
 *
 * Both read the chain rather than a third-party index, so they work for a
 * stock-quoted pool and do not depend on an API key this deployment does not
 * have. Both are cached, so a page that polls cannot turn into RPC load.
 */
const express = require('express');
const tokenPage = require('../services/tokenPageService');

const router = express.Router();

const MINT = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

function badMint(res, mint) {
    return res.status(400).json({ ok: false, error: 'INVALID_MINT', mint: mint || null });
}

router.get('/:mint/holders', async (req, res) => {
    const { mint } = req.params;
    if (!MINT.test(mint || '')) return badMint(res, mint);
    try {
        const data = await tokenPage.getHolders(mint, {
            limit: req.query.limit,
            creator: MINT.test(req.query.creator || '') ? req.query.creator : null,
        });
        return res.json({ ok: true, ...data });
    } catch (err) {
        const code = String(err.message).startsWith('MINT_NOT_FOUND') ? 404 : 502;
        return res.status(code).json({ ok: false, error: err.message });
    }
});

router.get('/:mint/trades', async (req, res) => {
    const { mint } = req.params;
    if (!MINT.test(mint || '')) return badMint(res, mint);
    try {
        const data = await tokenPage.getTrades(mint, { limit: req.query.limit });
        return res.json({ ok: true, ...data });
    } catch (err) {
        const code = String(err.message).startsWith('MINT_NOT_FOUND') ? 404 : 502;
        return res.status(code).json({ ok: false, error: err.message });
    }
});

module.exports = router;
