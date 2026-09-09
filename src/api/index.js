/**
 * Read-only HTTP surface.
 *
 * Everything here answers questions about public on-chain state: which stocks
 * can be quoted against, what a stock costs, who holds a token, what traded.
 * Nothing here signs anything, and nothing here reads a private key — creating
 * a config is a deliberate, wallet-holding call into stockConfigService and is
 * not exposed as a route by this repo.
 */
const { Router } = require('express');

const pairsApi = require('./pairsApi');
const tokenApi = require('./tokenApi');

/** @returns {import('express').Router} mount it wherever you like */
function apiRouter() {
    const router = Router();
    router.use('/pairs', pairsApi);
    router.use('/token', tokenApi);
    return router;
}

module.exports = { apiRouter, pairsApi, tokenApi };
