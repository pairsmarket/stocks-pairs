/**
 * Pay trading fees out to token holders in the QUOTE token.
 *
 * The existing holderDistributionService sends SOL, which is right for a SOL
 * pair. A stock pair collects its fees in the stock, so a holder of a token
 * quoted in AAPLx earns AAPLx. That is the point of the pad: hold the token,
 * get paid in Apple.
 *
 * Two things this file does differently from the SOL path:
 *
 * 1. Token program. xStocks are Token-2022, and the classic SPL program derives
 *    a different associated account for the same owner and mint. Every address
 *    here comes from the mint's real owner program.
 *
 * 2. Integer math. Shares are computed in raw base units with BigInt, and the
 *    remainder from integer division goes to the largest holder rather than
 *    being dropped. Floating point on token amounts loses dust on every payout.
 */
const {
    PublicKey,
    Keypair,
    Transaction,
    sendAndConfirmTransaction,
} = require('@solana/web3.js');
const {
    TOKEN_PROGRAM_ID,
    getAssociatedTokenAddress,
    getAccount,
    createAssociatedTokenAccountIdempotentInstruction,
    createTransferCheckedInstruction,
} = require('@solana/spl-token');

const { createRpcConnection } = require('../utils/rpc');
const { decodeBase58 } = require('../utils/bs58');
const { getTokenHolders } = require('./holderService');
const logger = require('../utils/logger');

// An ATA creation and a checked transfer per holder. Eight keeps the packet
// well inside the 1232-byte limit even when every holder needs a new account.
const BATCH_SIZE = 8;

/**
 * Split `totalRaw` across holders in proportion to their balances.
 *
 * Pure, integer-only, and the piece worth testing on its own. Returns entries in
 * the same order as `holders`, with any division remainder added to the largest
 * holder so the payout sums exactly to `totalRaw`.
 *
 * @param {Array<{address: string, raw?: bigint, balance?: number}>} holders
 * @param {bigint} totalRaw amount to distribute, in the quote token's base units
 * @param {bigint} minRaw   skip a holder whose share falls below this
 * @returns {Array<{address: string, raw: bigint}>}
 */
function splitProportional(holders, totalRaw, minRaw = 0n) {
    const weights = holders.map((h) => ({
        address: h.address,
        // `raw` is what the holder actually holds, in the token's own base
        // units, and is what getTokenHolders returns. `balance` is a float
        // and only a fallback for a caller that has nothing else; six decimal
        // places of it is as much as can be trusted.
        weight: h.raw !== undefined && h.raw !== null
            ? BigInt(h.raw)
            : BigInt(Math.floor(Number(h.balance) * 1e6)),
    }));
    const totalWeight = weights.reduce((acc, w) => acc + w.weight, 0n);
    if (totalWeight === 0n) return [];

    const rows = weights.map((w) => ({
        address: w.address,
        weight: w.weight,
        raw: (totalRaw * w.weight) / totalWeight,
    }));

    // Integer division always rounds down, so a remainder is left over. Give it
    // to the largest holder instead of leaving it stranded in the distributor.
    const paid = rows.reduce((acc, r) => acc + r.raw, 0n);
    const remainder = totalRaw - paid;
    if (remainder > 0n && rows.length) {
        let biggest = rows[0];
        for (const r of rows) if (r.weight > biggest.weight) biggest = r;
        biggest.raw += remainder;
    }

    return rows
        .filter((r) => r.raw >= minRaw && r.raw > 0n)
        .map((r) => ({ address: r.address, raw: r.raw }));
}

/** The token program that actually owns a mint. */
async function tokenProgramFor(connection, mint) {
    const info = await connection.getAccountInfo(new PublicKey(mint));
    if (!info) throw new Error(`QUOTE_MINT_NOT_FOUND:${mint}`);
    return info.owner;
}

/**
 * Distribute `amount` of the quote token to holders of `tokenMint`.
 *
 * @param {object}  p
 * @param {string}  p.tokenMint      the launched token whose holders get paid
 * @param {string}  p.quoteMint      the token being paid out (a stock, or WSOL)
 * @param {number}  p.quoteDecimals  quote decimals, 8 for every xStock
 * @param {number}  p.amount         human amount of quote token to pay out
 * @param {string}  p.distributorPrivkey  base58 secret key of the paying wallet
 * @param {number} [p.minHolderBalance] ignore holders below this many whole
 *   tokens. Meaningful only because getTokenHolders reads decimals off the
 *   mint; against a hardcoded 6 this floor was 100x out for a stock pair.
 * @param {boolean}[p.dryRun]        compute the split and return without sending
 */
async function distributeQuoteToHolders({
    tokenMint,
    quoteMint,
    quoteDecimals,
    amount,
    distributorPrivkey,
    minHolderBalance = 1,
    dryRun = false,
}) {
    if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) {
        throw new Error('No amount to distribute');
    }
    if (!Number.isInteger(quoteDecimals)) {
        throw new Error(`quoteDecimals must be an integer, got ${quoteDecimals}`);
    }
    if (!distributorPrivkey && !dryRun) {
        throw new Error('Distributor private key required');
    }

    const connection = createRpcConnection();
    const mint = new PublicKey(quoteMint);
    const programId = await tokenProgramFor(connection, quoteMint);
    const isToken2022 = !programId.equals(TOKEN_PROGRAM_ID);

    const totalRaw = BigInt(Math.round(Number(amount) * 10 ** quoteDecimals));

    const { holders } = await getTokenHolders(connection, tokenMint);
    const eligible = holders.filter((h) => Number(h.balance) >= minHolderBalance);
    if (!eligible.length) throw new Error('No eligible holders found');

    // Dust floor: one whole base unit is meaningless, so require at least a
    // hundredth of a cent's worth of the quote token before paying rent for an
    // account. At 8 decimals that is 1e4 base units.
    const minRaw = BigInt(10 ** Math.max(0, quoteDecimals - 4));
    const split = splitProportional(eligible, totalRaw, minRaw);
    if (!split.length) throw new Error('All distributions below minimum threshold');

    logger.info(
        'QUOTEDIST',
        `${split.length}/${eligible.length} holders, ${amount} ${isToken2022 ? 'Token-2022' : 'SPL'} quote`
    );

    if (dryRun) {
        return {
            dryRun: true,
            programId: programId.toBase58(),
            isToken2022,
            totalRaw: totalRaw.toString(),
            holderCount: eligible.length,
            payouts: split.map((s) => ({ address: s.address, raw: s.raw.toString() })),
        };
    }

    const distributor = Keypair.fromSecretKey(decodeBase58(distributorPrivkey));
    const sourceAta = await getAssociatedTokenAddress(mint, distributor.publicKey, false, programId);

    const sourceAccount = await getAccount(connection, sourceAta, 'confirmed', programId).catch(() => null);
    if (!sourceAccount) {
        throw new Error(`DISTRIBUTOR_HAS_NO_QUOTE_ACCOUNT:${quoteMint}`);
    }
    if (sourceAccount.amount < totalRaw) {
        throw new Error(
            `INSUFFICIENT_QUOTE_BALANCE: have ${sourceAccount.amount}, need ${totalRaw} base units`
        );
    }

    const signatures = [];
    const errors = [];

    for (let i = 0; i < split.length; i += BATCH_SIZE) {
        const batch = split.slice(i, i + BATCH_SIZE);
        const tx = new Transaction();

        for (const row of batch) {
            const owner = new PublicKey(row.address);
            const destAta = await getAssociatedTokenAddress(mint, owner, true, programId);
            tx.add(
                createAssociatedTokenAccountIdempotentInstruction(
                    distributor.publicKey,
                    destAta,
                    owner,
                    mint,
                    programId
                )
            );
            tx.add(
                createTransferCheckedInstruction(
                    sourceAta,
                    mint,
                    destAta,
                    distributor.publicKey,
                    row.raw,
                    quoteDecimals,
                    [],
                    programId
                )
            );
        }

        try {
            const sig = await sendAndConfirmTransaction(connection, tx, [distributor], {
                commitment: 'confirmed',
                maxRetries: 5,
            });
            signatures.push(sig);
            logger.success('QUOTEDIST', `batch ${i / BATCH_SIZE + 1}: ${sig.slice(0, 16)}...`);
        } catch (err) {
            errors.push({ batch: i / BATCH_SIZE + 1, error: err.message });
            logger.error('QUOTEDIST', `batch ${i / BATCH_SIZE + 1} failed: ${err.message}`);
        }

        if (i + BATCH_SIZE < split.length) {
            await new Promise((r) => setTimeout(r, 400));
        }
    }

    return {
        ok: errors.length === 0,
        programId: programId.toBase58(),
        isToken2022,
        totalRaw: totalRaw.toString(),
        holderCount: split.length,
        signatures,
        errors,
    };
}

module.exports = { splitProportional, distributeQuoteToHolders };
