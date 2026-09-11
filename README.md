PapYiBtm5KDNUymPrAyunFCbXGipJKUQAc5n17rpair

# pairsmarket

Quote a Meteora dynamic bonding curve in a tokenized stock instead of SOL.

A DBC pool has two sides. The base side is the token someone launches. The
quote side is what buyers pay with, and it is almost always SOL. Every Backed
Finance xStock is a Token-2022 mint that could sit on that quote side instead,
which gives you a bonding curve priced in Apple: buyers pay AAPLx, and the
trading fees the pool collects arrive as AAPLx. Pay those out to holders and
holding the token earns you Apple.

This is the engine for that, lifted out of the pad running at
[pairs.market](https://pairs.market). Node, CommonJS, no build step. No
frontend, no admin surface, no database.

## Four questions between "could" and "does"

Each one has a module, and each one bit us in a way you can see in the code.

| Question | Module |
|---|---|
| Which mints are really stocks? | `src/config/xstockRegistry.js` |
| Which of them will DBC accept? | `src/services/tokenBadgeService.js` |
| What curve do you price against? | `src/services/stockConfigService.js` |
| What did the pool do afterwards? | `src/services/tokenPageService.js` |

**Which mints are real.** A Jupiter sweep for "xStock" returns pump.fun mints
calling themselves Tesla xStock. The registry verifies by issuer: all 102
entries have Backed's freeze authority, and decimals come off the mint account
rather than a default.

**Which DBC accepts.** Program 0.2.1 gates the quote mint on a token badge, a
PDA at `["token_badge", mint]` that only a Meteora operator can create. Without
one, pool creation fails no matter how correct your call is. Read
[docs/TOKEN-BADGE.md](docs/TOKEN-BADGE.md).

**What curve.** `migrationQuoteThreshold` is denominated in the quote token, so
"$21k to migrate" is a different number for a $318 stock than for a $2 one. The
service divides a dollar target by the live price and refuses to build a curve
for a stock it cannot price. Read [docs/CURVE-MATH.md](docs/CURVE-MATH.md).

**What happened.** Holders and trades come from RPC alone, no indexer. The
holder reader asks for the largest accounts, because `getProgramAccounts` on a
popular mint is a 502 waiting to happen, and it reports `rankable: false`
instead of guessing when even that fails.

## Run it

```bash
cp .env.example .env     # fill in RPC_URL, at minimum
npm install
npm test                 # 50 tests, no network, no keys
npm start                # reference server on :8080
```

```bash
curl localhost:8080/api/pairs | jq '.unlockedCount, .stockTotal'
curl localhost:8080/api/token/<mint>/holders
node scripts/badge-check.js AAPLx NVDAx
```

Reading needs no wallet. `PLATFORM_PRIVKEY` only comes into it when you create
a config or pay holders out.

## HTTP

| Route | Returns |
|---|---|
| `GET /api/pairs` | every pair, with price, badge state and stored config |
| `GET /api/pairs/:symbol` | one pair in detail |
| `GET /api/pairs/:symbol/route` | whether Jupiter can route SOL into that stock |
| `GET /api/token/:mint/holders` | ranked holders, share, count |
| `GET /api/token/:mint/trades` | recent buys and sells, quote-agnostic |
| `GET /health` | liveness, RPC hosts, badge tally |

Mount the router into your own app with `require('pairsmarket').api.apiRouter()`.

## Layout

```
src/config/xstockRegistry.js       102 issuer-verified mints, decimals 8
src/config/pairs.js                SOL or any stock; resolves configs
src/config/env.js                  the only reader of process.env
src/services/tokenBadgeService.js  sweeps 102 badge PDAs in 2 RPC calls
src/services/stockPriceService.js  Jupiter price v3, batched, 5-minute TTL
src/services/stockRouteService.js  route check that never caches a 429
src/services/stockConfigService.js one config per stock, created on first use
src/services/tokenPageService.js   holders and trades from RPC
src/services/holderService.js      exact holder set, raw BigInt amounts
src/services/quoteDistributionService.js  pays holders in the quote token
```

## Not in here

The pad's frontend, its Supabase wiring, its admin routes, its deploy scripts
and its brand. Also no route that signs anything: creating a config spends
rent, so it stays a deliberate call from your own code rather than something a
stranger can trigger over HTTP.

## Handling keys

`.env` is gitignored, and so is every spelling of a keypair file. Two habits
worth keeping, both learned the hard way:

- A provider RPC URL carries its API key in the query string, so the whole URL
  is a secret. `env.rpcInfo()` returns hosts for exactly this reason. The pad
  this came from shipped a `/api/health` that echoed the full URL to anyone who
  asked.
- `*.bak` does not match `settings.js.bak-legacy`. Two backup files rode into
  the source repo that way. The ignore file here covers the suffixed forms.

More in [docs/SECURITY.md](docs/SECURITY.md).

MIT.
