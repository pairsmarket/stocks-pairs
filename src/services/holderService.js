/**
 * Who holds a launched token, and how much.
 *
 * This is the input to a payout, so it is raw-first. The version this was
 * lifted from returned `balance` as `rawAmount / 1e6`, which is right for a
 * 6-decimal token and wrong by 100x for a token launched against a stock —
 * base decimals have to equal quote decimals, and every xStock is 8. A payout
 * that weights on a rescaled float still splits correctly, because a uniform
 * scale cancels, but the eligibility floor moves by two orders of magnitude
 * and large balances lose precision on the way through Number.
 *
 * So: `raw` is a BigInt straight off the account, `decimals` comes from the
 * mint, and `balance` is derived for display only.
 *
 * One caveat worth knowing before you point this at a popular mint. It scans
 * every token account for the mint via getProgramAccounts, which is the only
 * way to get an exact list, and which no public RPC will serve for a mint with
 * a million accounts. It is sized for a launchpad token, not for WSOL. For a
 * ranking rather than a payout, use tokenPageService, which asks for the
 * largest accounts instead.
 */
const { PublicKey } = require('@solana/web3.js');
const { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } = require('@solana/spl-token');

/** Addresses that hold a balance but are not a holder. */
const NOT_A_HOLDER = new Set([
    '11111111111111111111111111111111',              // System program
    'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',   // SPL Token
    'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb',   // Token-2022
    'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL',  // Associated Token
    'FhVo3mqL8PW5pH5U2CN4XE33DokiyZnUwuGpH2hmHLuM',  // Meteora pool authority
    'dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN',   // Meteora DBC program
    '1nc1nerator11111111111111111111111111111111',   // burn
]);

/** The token program that owns a mint, and the mint's decimals. */
async function mintFacts(connection, tokenMint) {
    const mint = new PublicKey(tokenMint);
    const info = await connection.getParsedAccountInfo(mint);
    if (!info || !info.value) throw new Error(`MINT_NOT_FOUND:${tokenMint}`);

    const decimals = info.value.data &&
        info.value.data.parsed &&
        info.value.data.parsed.info &&
        Number(info.value.data.parsed.info.decimals);

    if (!Number.isInteger(decimals)) {
        // Guessing here is how a payout ends up 100x out.
        throw new Error(`MINT_DECIMALS_UNREADABLE:${tokenMint}`);
    }

    return { mint, programId: info.value.owner, decimals };
}

/**
 * @param {import('@solana/web3.js').Connection} connection
 * @param {string} tokenMint
 * @param {object} [opts]
 * @param {string[]} [opts.exclude] extra addresses to leave out — the platform's
 *   own wallets, so a payout does not pay itself
 * @returns {Promise<{holders: Array<{address:string, raw:bigint, balance:number, percentage:number}>,
 *                    decimals:number, totalRaw:bigint, programId:string}>}
 */
async function getTokenHolders(connection, tokenMint, opts = {}) {
    const { mint, programId, decimals } = await mintFacts(connection, tokenMint);

    const excluded = new Set(NOT_A_HOLDER);
    for (const addr of opts.exclude || []) {
        const a = String(addr || '').trim();
        if (a.length >= 32) excluded.add(a);
    }

    // A Token-2022 account is at least 165 bytes and often longer, because
    // extensions are appended. Filtering on dataSize:165 — which the SPL-only
    // version did — silently returns nothing for a Token-2022 mint.
    const isToken2022 = programId.equals(TOKEN_2022_PROGRAM_ID);
    const filters = [{ memcmp: { offset: 0, bytes: mint.toBase58() } }];
    if (!isToken2022) filters.unshift({ dataSize: 165 });

    const accounts = await connection.getProgramAccounts(programId, { filters });

    const holders = [];
    let totalRaw = 0n;

    for (const account of accounts) {
        try {
            // Account layout, both programs: 0-32 mint, 32-64 owner, 64-72 amount.
            const data = account.account.data;
            const owner = new PublicKey(data.slice(32, 64)).toBase58();
            const raw = data.readBigUInt64LE(64);

            if (raw === 0n) continue;
            if (excluded.has(owner)) continue;

            totalRaw += raw;
            holders.push({ address: owner, raw });
        } catch (_) {
            // A malformed account is not worth failing the whole read over.
        }
    }

    const scale = 10 ** decimals;
    for (const h of holders) {
        h.balance = Number(h.raw) / scale;
        h.percentage = totalRaw > 0n ? Number((h.raw * 1000000n) / totalRaw) / 10000 : 0;
    }

    holders.sort((a, b) => (b.raw > a.raw ? 1 : b.raw < a.raw ? -1 : 0));

    return {
        holders,
        decimals,
        totalRaw,
        programId: programId.toBase58(),
        isToken2022,
        // Kept because the old shape had it and a caller may still read it.
        totalSupplyHeld: Number(totalRaw) / scale,
    };
}

module.exports = { getTokenHolders, NOT_A_HOLDER, TOKEN_PROGRAM_ID };
