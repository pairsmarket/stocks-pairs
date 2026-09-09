const test = require('node:test');
const assert = require('node:assert');
const express = require('express');
const pairsApi = require('../src/api/pairsApi');
const badge = require('../src/services/tokenBadgeService');

function serve() {
    const app = express();
    app.use('/api/pairs', pairsApi);
    return new Promise((resolve) => {
        const server = app.listen(0, () => resolve(server));
    });
}
async function get(server, path) {
    const res = await fetch(`http://127.0.0.1:${server.address().port}${path}`);
    return { status: res.status, body: await res.json() };
}

test('lists SOL first, then all 102 stocks', async () => {
    const server = await serve();
    const { status, body } = await get(server, '/api/pairs');
    server.close();
    assert.strictEqual(status, 200);
    assert.strictEqual(body.total, 103);
    assert.strictEqual(body.stockTotal, 102);
    assert.strictEqual(body.pairs[0].id, 'SOL');
    assert.strictEqual(body.pairs.find((p) => p.id === 'AAPLx').decimals, 8);
});

test('every stock reads locked while no badge exists', async () => {
    badge._setUnlockedForTest([]);
    const server = await serve();
    const { body } = await get(server, '/api/pairs');
    server.close();
    assert.strictEqual(body.unlockedCount, 0);
    assert.ok(body.pairs.slice(1).every((p) => p.unlocked === false));
});

test('a badged stock flips to unlocked with no restart', async () => {
    badge._setUnlockedForTest(['TSLAx']);
    const server = await serve();
    const { body } = await get(server, '/api/pairs');
    server.close();
    assert.strictEqual(body.unlockedCount, 1);
    assert.strictEqual(body.pairs.find((p) => p.id === 'TSLAx').unlocked, true);
    assert.strictEqual(body.pairs.find((p) => p.id === 'AAPLx').unlocked, false);
    badge._setUnlockedForTest([]);
});

test('single pair returns its badge PDA', async () => {
    const server = await serve();
    const { body } = await get(server, '/api/pairs/AAPLx');
    server.close();
    assert.match(body.pair.badge, /^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
    assert.strictEqual(body.pair.unlocked, false);
    assert.strictEqual(body.pair.config, null);
});

test('symbol lookup is case-insensitive', async () => {
    const server = await serve();
    const { body } = await get(server, '/api/pairs/aaplx');
    server.close();
    assert.strictEqual(body.pair.id, 'AAPLx');
});

test('an unknown symbol is a 404, not a 500', async () => {
    const server = await serve();
    const { status, body } = await get(server, '/api/pairs/NOPEx');
    server.close();
    assert.strictEqual(status, 404);
    assert.strictEqual(body.error, 'UNKNOWN_PAIR');
});

test('route check refuses SOL and unknown symbols with 404', async () => {
    const server = await serve();
    const a = await get(server, '/api/pairs/SOL/route');
    const b = await get(server, '/api/pairs/NOPEx/route');
    server.close();
    assert.strictEqual(a.status, 404);
    assert.strictEqual(b.status, 404);
});

test('route check serves the cache without calling Jupiter', async () => {
    const route = require('../src/services/stockRouteService');
    route._seedForTest('AAPLx', { routable: true, perSol: 0.3214 });
    const server = await serve();
    const { status, body } = await get(server, '/api/pairs/AAPLx/route');
    server.close();
    assert.strictEqual(status, 200);
    assert.strictEqual(body.routable, true);
    assert.strictEqual(body.perSol, 0.3214);
});

test('a seeded route surfaces on the board rows too', async () => {
    const route = require('../src/services/stockRouteService');
    route._seedForTest('TSLAx', { routable: false, perSol: null });
    const server = await serve();
    const { body } = await get(server, '/api/pairs');
    server.close();
    assert.strictEqual(body.pairs.find((p) => p.id === 'TSLAx').routable, false);
    route._clearForTest();
});

test('a Jupiter throttle is reported as unknown, not as no route', async () => {
    const route = require('../src/services/stockRouteService');
    route._clearForTest();
    const axios = require('axios');
    const realGet = axios.get;
    axios.get = async () => {
        const err = new Error('Request failed with status code 429');
        err.response = { status: 429 };
        throw err;
    };
    try {
        const server = await serve();
        const { status, body } = await get(server, '/api/pairs/MSFTx/route');
        server.close();
        assert.strictEqual(status, 503);
        assert.strictEqual(body.error, 'ROUTE_UNKNOWN');
        // and nothing false was written to the cache
        assert.strictEqual(route.peek('MSFTx'), null);
    } finally {
        axios.get = realGet;
        route._clearForTest();
    }
});

test('a genuine 400 from Jupiter is cached as no route', async () => {
    const route = require('../src/services/stockRouteService');
    route._clearForTest();
    const axios = require('axios');
    const realGet = axios.get;
    axios.get = async () => {
        const err = new Error('Request failed with status code 400');
        err.response = { status: 400 };
        throw err;
    };
    try {
        const server = await serve();
        const { status, body } = await get(server, '/api/pairs/SOXXx/route');
        server.close();
        assert.strictEqual(status, 200);
        assert.strictEqual(body.routable, false);
        assert.deepStrictEqual(route.peek('SOXXx'), { routable: false, perSol: null });
    } finally {
        axios.get = realGet;
        route._clearForTest();
    }
});
