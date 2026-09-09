/**
 * Reference server.
 *
 * Not a launchpad — a launchpad has a wallet, a UI, an admin surface and an
 * opinion about fees. This is the smallest thing that proves the engine works:
 * it starts the two pollers, serves the read-only API, and exits loudly if the
 * environment is wrong.
 *
 *   node server.js          then      curl localhost:8080/api/pairs
 */
require('dotenv').config();

const express = require('express');

const { apiRouter } = require('./src/api');
const { loadSettings, rpcInfo } = require('./src/config/env');
const { validateLaunchpadConfig } = require('./src/config/pairs');
const { createRpcConnection } = require('./src/utils/rpc');
const tokenBadgeService = require('./src/services/tokenBadgeService');
const stockPriceService = require('./src/services/stockPriceService');
const logger = require('./src/utils/logger');

const settings = loadSettings();

if (!settings.RPC_URLS.length) {
    // A default public endpoint would appear to work and then rate-limit the
    // badge sweep into a permanent "0 badged", which reads like a product
    // problem rather than a configuration one.
    console.error('RPC_URL is not set. Copy .env.example to .env and fill it in.');
    process.exit(1);
}

const app = express();

app.disable('x-powered-by');
app.use(express.json({ limit: '64kb' }));

/**
 * Liveness. Deliberately says whether things are configured and not what they
 * are: this route is usually the one left open to the world, and an RPC URL in
 * a health body is a free RPC endpoint for whoever reads it.
 */
app.get('/health', (req, res) => {
    const badges = tokenBadgeService.snapshot();
    res.json({
        status: 'ok',
        rpc: rpcInfo(),
        config: validateLaunchpadConfig(),
        badges: {
            total: badges.total,
            unlockedCount: badges.unlockedCount,
            checkedAt: badges.checkedAt,
        },
    });
});

app.use('/api', apiRouter());

app.use((req, res) => res.status(404).json({ ok: false, error: 'NOT_FOUND' }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
    logger.error('HTTP', err.message);
    res.status(500).json({ ok: false, error: 'INTERNAL' });
});

const server = app.listen(settings.PORT, () => {
    const { valid, missing } = validateLaunchpadConfig();

    logger.success('BOOT', `listening on http://localhost:${settings.PORT}`);
    logger.info('BOOT', `rpc: ${rpcInfo().hosts.join(', ')}`);
    if (!valid) logger.warn('BOOT', `not configured for launches: missing ${missing.join(', ')}`);

    tokenBadgeService.start(createRpcConnection());
    stockPriceService.start();
});

for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => {
        tokenBadgeService.stop();
        stockPriceService.stop();
        server.close(() => process.exit(0));
    });
}
