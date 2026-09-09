/**
 * Configuration, from the environment and nowhere else.
 *
 * There is no config file in this repo on purpose. A JSON file that holds an
 * RPC URL is a file that gets committed by accident; an env var is not. Every
 * value here is read fresh on each call so an operator can change one and see
 * the effect without a restart.
 *
 * Nothing in this module ever returns a secret to a caller that did not ask
 * for it by name. In particular `rpcInfo()` reports hosts, never full URLs:
 * a provider URL usually carries the API key in its query string, and a
 * health endpoint that echoes it back is a free RPC endpoint for the world.
 */

/** Comma- or whitespace-separated list, e.g. RPC_URLS="https://a,https://b". */
function list(name) {
    return String(process.env[name] || '')
        .split(/[\s,]+/)
        .map((s) => s.trim())
        .filter(Boolean);
}

function loadSettings() {
    const urls = [...list('RPC_URL'), ...list('RPC_URLS'), ...list('RPC_POOL')];
    const unique = [...new Set(urls)];

    return {
        RPC_URL: unique[0] || '',
        RPC_URLS: unique,
        // Some RPC providers key access on the Origin header rather than a
        // token in the URL, so it has to be sent and has to be settable.
        RPC_ORIGIN: (process.env.RPC_ORIGIN || '').trim(),
        JUPITER_API_KEY: (process.env.JUPITER_API_KEY || '').trim(),
        PLATFORM_PUBKEY: (process.env.PLATFORM_PUBKEY || '').trim(),
        PLATFORM_PRIVKEY: (process.env.PLATFORM_PRIVKEY || '').trim(),
        PORT: Number.parseInt(process.env.PORT || '', 10) || 8080,
    };
}

/** Host names only. Safe to return over HTTP; the full URLs are not. */
function rpcInfo() {
    const { RPC_URLS } = loadSettings();
    return {
        count: RPC_URLS.length,
        hosts: RPC_URLS.map((u) => {
            try {
                return new URL(u).host;
            } catch (_) {
                return 'malformed';
            }
        }),
    };
}

module.exports = { loadSettings, rpcInfo };
