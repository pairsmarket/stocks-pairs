const test = require('node:test');
const assert = require('node:assert');
const express = require('express');
const tokenApi = require('../src/api/tokenApi');

function serve() {
    const app = express();
    app.use('/api/token', tokenApi);
    return new Promise((r) => { const s = app.listen(0, () => r(s)); });
}
async function get(server, path) {
    const res = await fetch(`http://127.0.0.1:${server.address().port}${path}`);
    return { status: res.status, body: await res.json() };
}

test('a malformed mint is a 400, not an RPC round trip', async () => {
    const server = await serve();
    const a = await get(server, '/api/token/nope/holders');
    const b = await get(server, '/api/token/nope/trades');
    server.close();
    assert.strictEqual(a.status, 400);
    assert.strictEqual(a.body.error, 'INVALID_MINT');
    assert.strictEqual(b.status, 400);
});

test('base58 with excluded characters is refused', async () => {
    const server = await serve();
    // 0, O, I and l are not in the base58 alphabet
    const { status } = await get(server, '/api/token/0OIl0OIl0OIl0OIl0OIl0OIl0OIl0OIl/holders');
    server.close();
    assert.strictEqual(status, 400);
});
