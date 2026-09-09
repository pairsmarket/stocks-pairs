const test = require('node:test');
const assert = require('node:assert');
const { isStock, getStock, listStocks } = require('../src/config/xstockRegistry');
const cfg = require('../src/config/pairs');

test('registry holds 102 issuer-verified stocks, every one decimals 8', () => {
    const all = listStocks();
    assert.strictEqual(all.length, 102);
    for (const s of all) {
        assert.strictEqual(s.decimals, 8, `${s.symbol} decimals`);
        assert.match(s.mint, /^[1-9A-HJ-NP-Za-km-z]{32,44}$/, `${s.symbol} mint`);
        assert.ok(s.name && s.name.length > 0, `${s.symbol} name`);
    }
});

test('symbols are unique by mint — no two tickers share an address', () => {
    const mints = listStocks().map((s) => s.mint);
    assert.strictEqual(new Set(mints).size, mints.length);
});

test('AAPLx resolves to the Backed mint', () => {
    assert.ok(isStock('AAPLx'));
    assert.strictEqual(getStock('AAPLx').mint, 'XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp');
});

test('lookup is case-insensitive but reports the canonical symbol', () => {
    assert.ok(isStock('aaplx'));
    assert.strictEqual(getStock('aaplx').symbol, 'AAPLx');
    assert.strictEqual(cfg.normalizePair('AAPLX'), 'AAPLx');
});

test('quote decimals never fall back to 9 for a stock', () => {
    assert.strictEqual(cfg.getQuoteDecimals('AAPLx'), 8);
    assert.strictEqual(cfg.getQuoteDecimals('SOL'), 9);
    assert.throws(() => cfg.getQuoteDecimals('NOPEx'), /Unknown pair/);
});

test('quote mint for a stock is the registry mint', () => {
    assert.strictEqual(cfg.getQuoteMint('TSLAx'), getStock('TSLAx').mint);
    assert.strictEqual(cfg.getQuoteMint('sol'), cfg.SOL_MINT);
});

test('listPairs puts SOL first and then all 102 stocks', () => {
    const pairs = cfg.listPairs();
    assert.strictEqual(pairs.length, 103);
    assert.strictEqual(pairs[0].symbol, 'SOL');
});

test('a stock with no stored config reports STOCK_CONFIG_MISSING, not a crash', () => {
    assert.throws(() => cfg.resolveConfigAddress('AAPLx'), /STOCK_CONFIG_MISSING:AAPLx/);
});

test('validateLaunchpadConfig only demands CONFIG_SOL', () => {
    const before = process.env.CONFIG_SOL;
    process.env.CONFIG_SOL = 'G9XyabcdefghijklmnopqrstuvwxyzABCDEFgXDo';
    assert.deepStrictEqual(cfg.validateLaunchpadConfig(), { valid: true, missing: [] });
    delete process.env.CONFIG_SOL;
    assert.deepStrictEqual(cfg.validateLaunchpadConfig().missing, ['CONFIG_SOL']);
    if (before !== undefined) process.env.CONFIG_SOL = before;
});

test('an operator-prepared config in env wins over the lazy store', () => {
    const key = `CONFIG_${cfg.envKeyFor('AAPLx')}`;
    assert.strictEqual(key, 'CONFIG_AAPLX');
    process.env[key] = 'CfgFromEnv1111111111111111111111111111';
    assert.strictEqual(cfg.resolveConfigAddress('AAPLx'), 'CfgFromEnv1111111111111111111111111111');
    delete process.env[key];
    assert.throws(() => cfg.resolveConfigAddress('AAPLx'), /STOCK_CONFIG_MISSING/);
});

test('a symbol with a dot maps to a legal env key', () => {
    assert.strictEqual(cfg.envKeyFor('BRK.Bx'), 'BRK_BX');
});

test('the trade reader is quote-agnostic by construction', () => {
    // A stock-quoted pool moves an SPL balance, a SOL pool moves lamports.
    // getTrades picks its branch from the pool's own quote mint rather than
    // assuming SOL, which is what the shipped Helius parser did.
    const src = require('fs').readFileSync(
        require('path').join(__dirname, '..', 'src', 'services', 'tokenPageService.js'), 'utf8');
    assert.match(src, /pool\.quoteIsSol/);
    assert.match(src, /tokenDelta\(tx\.meta, keys, trader, pool\.quoteMint\)/);
});
