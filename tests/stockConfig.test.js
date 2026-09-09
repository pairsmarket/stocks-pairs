const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const store = require('../src/services/stockConfigStore');
const svc = require('../src/services/stockConfigService');
const badge = require('../src/services/tokenBadgeService');
const price = require('../src/services/stockPriceService');
const { getStock } = require('../src/config/xstockRegistry');

test('store round-trips a record and reads fresh from disk', () => {
    store.set('TESTx', { config: 'Cfg111', quoteMint: 'Mint111', createdAt: 'now', txSignature: 'sig' });
    const raw = JSON.parse(fs.readFileSync(store.FILE, 'utf8'));
    assert.strictEqual(raw.TESTx.config, 'Cfg111');
    assert.strictEqual(store.get('TESTx').config, 'Cfg111');
    assert.strictEqual(store.remove('TESTx'), true);
    assert.strictEqual(store.get('TESTx'), null);
});

test('migration threshold is a dollar target divided by the stock price', () => {
    const p = svc.curveParamsForPrice(320, { migrationQuoteUsd: 21000 });
    assert.ok(Math.abs(p.migrationQuoteThreshold - 65.625) < 1e-9);
    assert.strictEqual(p.migrationQuoteUsd, 21000);
});

test('a cheap stock needs more quote tokens than an expensive one for the same dollars', () => {
    const cheap = svc.curveParamsForPrice(10, { migrationQuoteUsd: 21000 });
    const rich = svc.curveParamsForPrice(1000, { migrationQuoteUsd: 21000 });
    assert.ok(cheap.migrationQuoteThreshold > rich.migrationQuoteThreshold);
    assert.ok(Math.abs(cheap.migrationQuoteThreshold * 10 - rich.migrationQuoteThreshold * 1000) < 1e-6);
});

test('a zero or negative price is refused, never silently defaulted', () => {
    assert.throws(() => svc.curveParamsForPrice(0), /Invalid stock price/);
    assert.throws(() => svc.curveParamsForPrice(-5), /Invalid stock price/);
    assert.throws(() => svc.curveParamsForPrice(undefined), /Invalid stock price/);
});

test('the built curve uses 8 decimals on BOTH sides and the computed threshold', () => {
    const { curve, decimals } = svc.buildStockCurve('AAPLx', 320, { migrationQuoteUsd: 21000 });
    assert.strictEqual(decimals, 8);
    assert.strictEqual(curve.tokenDecimal, 8);
    // 65.625 AAPLx at 8 decimals
    assert.strictEqual(curve.migrationQuoteThreshold.toString(), '6562500000');
});

test('ensureConfig refuses an unbadged stock before touching price or chain', async () => {
    badge._setUnlockedForTest([]);
    await assert.rejects(
        () => svc.ensureConfig('AAPLx', { connection: null, dryRun: true }),
        /BADGE_MISSING:AAPLx/
    );
});

test('ensureConfig rejects an unknown symbol', async () => {
    await assert.rejects(() => svc.ensureConfig('NOPEx', { dryRun: true }), /Unknown pair/);
});

test('a badged stock with a price produces a dry-run plan and spends nothing', async () => {
    badge._setUnlockedForTest(['AAPLx']);
    price._seedForTest(getStock('AAPLx').mint, { usdPrice: 320, liquidity: 1000, decimals: 8 });
    const res = await svc.ensureConfig('AAPLx', { connection: null, dryRun: true });
    assert.strictEqual(res.wouldCreate, true);
    assert.strictEqual(res.config, null);
    assert.ok(Math.abs(res.params.migrationQuoteThreshold - 65.625) < 1e-9);
    badge._setUnlockedForTest([]);
    price._clearForTest();
});

test('a badged stock with no price is refused rather than launched on a guess', async () => {
    badge._setUnlockedForTest(['SOXXx']);
    const failing = async (sym) => { throw new Error(`PRICE_UNAVAILABLE:${sym}`); };
    await assert.rejects(
        () => svc.ensureConfig('SOXXx', { dryRun: true, priceProvider: failing }),
        /PRICE_UNAVAILABLE:SOXXx/
    );
    badge._setUnlockedForTest([]);
});

test('dryRun never needs a connection, so nothing can be sent by accident', async () => {
    badge._setUnlockedForTest(['NVDAx']);
    const res = await svc.ensureConfig('NVDAx', {
        dryRun: true,
        priceProvider: async () => ({ usdPrice: 180, liquidity: 0, decimals: 8 }),
    });
    assert.strictEqual(res.created, false);
    assert.strictEqual(res.config, null);
    assert.ok(res.curve.migrationQuoteThreshold);
    badge._setUnlockedForTest([]);
});

test('two callers racing for the same fresh stock share one creation', async () => {
    const badgeSvc = require('../src/services/tokenBadgeService');
    badgeSvc._setUnlockedForTest(['GLDx']);

    let creations = 0;
    const slowPrice = async () => {
        creations += 1;
        await new Promise((r) => setTimeout(r, 30));
        return { usdPrice: 400, liquidity: 1, decimals: 8 };
    };
    // dryRun short-circuits the lock on purpose, so exercise the locked path by
    // asking twice for a real create against a connection that refuses to work.
    const bad = { getParsedAccountInfo: async () => { throw new Error('rpc refused'); } };
    const a = svc.ensureConfig('GLDx', { connection: bad, priceProvider: slowPrice });
    const b = svc.ensureConfig('GLDx', { connection: bad, priceProvider: slowPrice });
    await Promise.allSettled([a, b]);
    assert.strictEqual(creations, 1, 'the second caller must join the first, not start its own');
    badgeSvc._setUnlockedForTest([]);
});
