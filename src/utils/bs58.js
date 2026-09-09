/**
 * Base58 secret keys, decoded.
 *
 * A wallet exported from Phantom or solana-keygen is base58; the web3.js
 * Keypair wants bytes. The only reason this is its own file is so that the
 * one place a private key is handled is small enough to read in full.
 */
const bs58Pkg = require('bs58');

const bs58 = bs58Pkg && bs58Pkg.default ? bs58Pkg.default : bs58Pkg;

/**
 * @param {string} str base58-encoded secret key
 * @returns {Uint8Array} 64 bytes
 */
function decodeBase58(str) {
    const bytes = bs58.decode(String(str || '').trim());
    if (bytes.length !== 64) {
        // Not `${str}` in the message. The point of this check is a bad key,
        // and a bad key is still a key.
        throw new Error(`Expected a 64-byte secret key, decoded ${bytes.length} bytes`);
    }
    return bytes;
}

module.exports = { decodeBase58 };
