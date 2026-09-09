const test = require('node:test');
const assert = require('node:assert');
const { splitProportional } = require('../src/services/quoteDistributionService');

test('a split pays out exactly the total, with no dust left behind', () => {
    const holders = [
        { address: 'A', balance: 1 },
        { address: 'B', balance: 1 },
        { address: 'C', balance: 1 },
    ];
    const total = 10_000_000_001n; // deliberately not divisible by 3
    const rows = splitProportional(holders, total);
    const paid = rows.reduce((acc, r) => acc + r.raw, 0n);
    assert.strictEqual(paid, total);
});

test('shares are proportional to holder balance', () => {
    const rows = splitProportional(
        [{ address: 'big', balance: 750 }, { address: 'small', balance: 250 }],
        1000n
    );
    const byAddr = Object.fromEntries(rows.map((r) => [r.address, r.raw]));
    assert.strictEqual(byAddr.big, 750n);
    assert.strictEqual(byAddr.small, 250n);
});

test('the rounding remainder goes to the largest holder, never nowhere', () => {
    const rows = splitProportional(
        [{ address: 'big', balance: 2 }, { address: 'a', balance: 1 }, { address: 'b', balance: 1 }],
        100n
    );
    const byAddr = Object.fromEntries(rows.map((r) => [r.address, r.raw]));
    assert.strictEqual(byAddr.big + byAddr.a + byAddr.b, 100n);
    assert.ok(byAddr.big >= byAddr.a);
});

test('holders below the dust floor are dropped, not paid rent for', () => {
    const rows = splitProportional(
        [{ address: 'whale', balance: 1_000_000 }, { address: 'dust', balance: 0.000001 }],
        1000n,
        10n
    );
    assert.strictEqual(rows.length, 1);
    assert.strictEqual(rows[0].address, 'whale');
});

test('an empty holder set produces no payouts rather than dividing by zero', () => {
    assert.deepStrictEqual(splitProportional([], 100n), []);
    assert.deepStrictEqual(splitProportional([{ address: 'z', balance: 0 }], 100n), []);
});

test('fractional holder balances still split proportionally', () => {
    const rows = splitProportional(
        [{ address: 'a', balance: 1.5 }, { address: 'b', balance: 0.5 }],
        400n
    );
    const byAddr = Object.fromEntries(rows.map((r) => [r.address, r.raw]));
    assert.strictEqual(byAddr.a, 300n);
    assert.strictEqual(byAddr.b, 100n);
});

test('raw base units win over the float, and survive a balance Number cannot hold', () => {
    // 2^53 apart in raw units. Through `balance` these two would compare equal,
    // because Number stops counting there; through `raw` they do not.
    const rows = splitProportional(
        [
            { address: 'a', raw: 9_007_199_254_740_993n, balance: 90071992.54740992 },
            { address: 'b', raw: 9_007_199_254_740_991n, balance: 90071992.54740992 },
        ],
        4n
    );
    const byAddr = Object.fromEntries(rows.map((r) => [r.address, r.raw]));
    assert.strictEqual(byAddr.a + byAddr.b, 4n);
    assert.ok(byAddr.a > byAddr.b, 'the larger raw balance is paid more');
});

test('a holder with raw:0 is not paid, even with a stale balance alongside it', () => {
    const rows = splitProportional(
        [{ address: 'gone', raw: 0n, balance: 500 }, { address: 'here', raw: 100n }],
        100n
    );
    assert.deepStrictEqual(rows, [{ address: 'here', raw: 100n }]);
});
