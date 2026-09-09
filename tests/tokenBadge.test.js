const test = require('node:test');
const assert = require('node:assert');
const { PublicKey } = require('@solana/web3.js');
const svc = require('../src/services/tokenBadgeService');

const DBC_PROGRAM = new PublicKey('dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN');
const AAPLX = 'XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp';

test('badge PDA matches the documented seeds', () => {
    const [expected] = PublicKey.findProgramAddressSync(
        [Buffer.from('token_badge'), new PublicKey(AAPLX).toBuffer()],
        DBC_PROGRAM
    );
    assert.strictEqual(svc.deriveBadge(AAPLX).toBase58(), expected.toBase58());
});

test('every stock is locked before a sweep has run', () => {
    const s = svc.getStatus('AAPLx');
    assert.strictEqual(s.unlocked, false);
    assert.strictEqual(s.mint, AAPLX);
    assert.strictEqual(s.decimals, 8);
});

test('unknown symbol returns null rather than throwing', () => {
    assert.strictEqual(svc.getStatus('NOPEx'), null);
    assert.strictEqual(svc.isUnlocked('NOPEx'), false);
});

test('snapshot reports the full registry size', () => {
    const s = svc.snapshot();
    assert.strictEqual(s.total, 102);
    assert.ok(s.unlockedCount <= s.total);
});

test('a sweep failure leaves the previous cache intact', async () => {
    svc._setUnlockedForTest(['AAPLx']);
    const broken = { getMultipleAccountsInfo: async () => { throw new Error('rpc down'); } };
    await assert.rejects(() => svc.refresh(broken), /rpc down/);
    assert.strictEqual(svc.isUnlocked('AAPLx'), true, 'cache must survive a failed sweep');
    assert.strictEqual(svc.snapshot().lastError, 'rpc down');
    svc._setUnlockedForTest([]);
});

test('a sweep marks exactly the mints whose badge account exists', async () => {
    const { listStocks } = require('../src/config/xstockRegistry');
    const stocks = listStocks();
    const target = stocks.findIndex((s) => s.symbol === 'TSLAx');
    const fake = {
        getMultipleAccountsInfo: async (keys) => keys.map((_, i) => {
            const globalIndex = stocks.findIndex(
                (s) => svc.deriveBadge(s.mint).toBase58() === keys[i].toBase58()
            );
            return globalIndex === target ? { data: Buffer.alloc(8) } : null;
        }),
    };
    const res = await svc.refresh(fake);
    assert.deepStrictEqual([...res.unlocked], ['TSLAx']);
    assert.strictEqual(svc.isUnlocked('TSLAx'), true);
    assert.strictEqual(svc.isUnlocked('AAPLx'), false);
    svc._setUnlockedForTest([]);
});
