/**
 * pairsmarket — quote a Meteora dynamic bonding curve in a tokenized stock.
 *
 * The short version of what this package is for: a DBC pool has a base side
 * and a quote side, the quote side is normally SOL, and every xStock is a
 * Token-2022 mint that could sit there instead. Four things stand between
 * "could" and "does", and each has a module here:
 *
 *   1. Which mints are real stocks           config/xstockRegistry
 *   2. Which of them DBC will accept         services/tokenBadgeService
 *   3. What curve to price against            services/stockConfigService
 *   4. What the pool did afterwards           services/tokenPageService
 *
 * Read docs/ARCHITECTURE.md before wiring any of it to money.
 */
module.exports = {
    // What can be a quote
    registry: require('./config/xstockRegistry'),
    pairs: require('./config/pairs'),

    // Whether the program will accept it
    tokenBadgeService: require('./services/tokenBadgeService'),

    // What it is worth, and whether anyone can get some
    stockPriceService: require('./services/stockPriceService'),
    stockRouteService: require('./services/stockRouteService'),

    // The config a pool is created against
    stockConfigService: require('./services/stockConfigService'),
    stockConfigStore: require('./services/stockConfigStore'),

    // What happened after launch
    tokenPageService: require('./services/tokenPageService'),
    holderService: require('./services/holderService'),

    // Paying holders in the quote token
    quoteDistributionService: require('./services/quoteDistributionService'),

    // Plumbing
    api: require('./api'),
    env: require('./config/env'),
    rpc: require('./utils/rpc'),
    logger: require('./utils/logger'),
};
