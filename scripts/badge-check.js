#!/usr/bin/env node
/**
 * Which xStocks can actually be a DBC quote right now.
 *
 * A badge is issued by a Meteora operator, one per mint, and without one the
 * pool-creation instruction fails at validate_quote_mint_with_token_badge no
 * matter how correct the rest of the call is. So this is the first question to
 * ask about any stock, and the answer changes without warning.
 *
 *   node scripts/badge-check.js              every stock
 *   node scripts/badge-check.js AAPLx NVDAx  just these
 */
require('dotenv').config();

const { createRpcConnection } = require('../src/utils/rpc');
const { loadSettings } = require('../src/config/env');
const badges = require('../src/services/tokenBadgeService');
const { listStocks, canonical } = require('../src/config/xstockRegistry');

async function main() {
    if (!loadSettings().RPC_URLS.length) {
        console.error('RPC_URL is not set.');
        process.exit(1);
    }

    const asked = process.argv.slice(2).map(canonical).filter(Boolean);

    await badges.refresh(createRpcConnection());
    const snap = badges.snapshot();

    if (snap.lastError) {
        console.error(`sweep failed: ${snap.lastError}`);
        process.exit(1);
    }

    const rows = (asked.length ? asked : listStocks().map((s) => s.symbol))
        .map((symbol) => ({ symbol, badged: badges.isUnlocked(symbol) }));

    for (const r of rows) {
        console.log(`${r.badged ? 'badged  ' : 'no badge'}  ${r.symbol}`);
    }
    console.log(`\n${rows.filter((r) => r.badged).length} of ${rows.length} badged`);
}

main().catch((err) => {
    console.error(err.message);
    process.exit(1);
});
