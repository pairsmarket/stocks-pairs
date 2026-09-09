/**
 * Per-stock DBC config store.
 *
 * A DBC config is bound to one quote mint, so a launchpad with 102 possible quotes
 * needs up to 102 configs. Creating them all up front would burn rent on stocks
 * nobody launches against, so a config is minted the first time a stock is really
 * used and remembered here.
 *
 * The file is read fresh on every call, the same habit as setting.json: an operator
 * can drop a config in by hand and it takes effect without a restart. Writes go
 * through a temp file and a rename so a crash mid-write cannot truncate the map.
 */
const fs = require('fs');
const path = require('path');

// Somewhere writable, outside the tree by default when embedded. The file
// holds config addresses, which are public; it holds no key material.
const DATA_DIR = process.env.PAIRS_DATA_DIR
    || path.join(__dirname, '..', '..', 'data');
const FILE = path.join(DATA_DIR, 'stockConfigs.json');

function readAll() {
    try {
        const parsed = JSON.parse(fs.readFileSync(FILE, 'utf8'));
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (_) {
        return {};
    }
}

/** @returns {{config:string,quoteMint:string,createdAt:string,txSignature:string}|null} */
function get(symbol) {
    if (!symbol) return null;
    return readAll()[symbol] || null;
}

function set(symbol, record) {
    const all = readAll();
    all[symbol] = record;
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    const tmp = `${FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(all, null, 2));
    fs.renameSync(tmp, FILE);
    return record;
}

function remove(symbol) {
    const all = readAll();
    if (!(symbol in all)) return false;
    delete all[symbol];
    const tmp = `${FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(all, null, 2));
    fs.renameSync(tmp, FILE);
    return true;
}

module.exports = { get, set, remove, all: readAll, FILE };
