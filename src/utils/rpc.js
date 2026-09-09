/**
 * RPC connections, round-robin across every endpoint in the environment.
 *
 * The engine's read paths are chatty — a badge sweep touches 102 PDAs, a
 * holder ranking touches every large account — so a single endpoint gets rate
 * limited long before the work is heavy. Endpoints that start failing are
 * benched for 30 seconds rather than removed, because a 429 is temporary and
 * a shrinking pool makes the next minute worse.
 */
const { Connection } = require('@solana/web3.js');
const { loadSettings } = require('../config/env');

const BENCH_MS = 30_000;

const settings = loadSettings();
const RPC_URLS = settings.RPC_URLS.length ? settings.RPC_URLS : ['https://api.mainnet-beta.solana.com'];
const benchedUntil = new Array(RPC_URLS.length).fill(0);

let cursor = 0;

function resolveRpcOrigin(origin) {
    return String(origin || settings.RPC_ORIGIN || '').trim();
}

/** Next endpoint that is not benched; if all are, the next one anyway. */
function getNextRpcUrl() {
    const now = Date.now();
    for (let i = 0; i < RPC_URLS.length; i++) {
        const idx = (cursor + i) % RPC_URLS.length;
        if (now >= benchedUntil[idx]) {
            cursor = (idx + 1) % RPC_URLS.length;
            return { url: RPC_URLS[idx], index: idx };
        }
    }
    const idx = cursor;
    cursor = (idx + 1) % RPC_URLS.length;
    return { url: RPC_URLS[idx], index: idx };
}

function markRpcUnhealthy(index) {
    if (index >= 0 && index < benchedUntil.length) {
        benchedUntil[index] = Date.now() + BENCH_MS;
    }
}

function connectionFor(url, origin, commitment) {
    const httpHeaders = {};
    const o = resolveRpcOrigin(origin);
    if (o) httpHeaders.Origin = o;

    return new Connection(url, {
        commitment,
        confirmTransactionInitialTimeout: 30_000,
        httpHeaders,
    });
}

function createRpcConnection(origin, commitment = 'confirmed') {
    return connectionFor(getNextRpcUrl().url, origin, commitment);
}

function createRpcConnectionWithUrl(rpcUrl, origin, commitment = 'confirmed') {
    return connectionFor(rpcUrl, origin, commitment);
}

function getAllRpcUrls() {
    return [...RPC_URLS];
}

module.exports = {
    resolveRpcOrigin,
    createRpcConnection,
    createRpcConnectionWithUrl,
    getNextRpcUrl,
    markRpcUnhealthy,
    getAllRpcUrls,
    RPC_URLS,
};
