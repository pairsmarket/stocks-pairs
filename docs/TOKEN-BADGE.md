# The token badge

## What it is

DBC 0.2.1 replaced a hardcoded quote-mint allowlist with a per-mint account.
Before you can create a config against a quote mint, a Meteora operator has to
call `create_token_badge` for it. That writes a PDA:

```
seeds  = ["token_badge", mint]
program = dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN
```

Config creation then runs `validate_quote_mint_with_token_badge`, which passes
if that account exists. The older path returned `InvalidQuoteMint` for anything
outside the allowlist, and no amount of correct instruction data got you past
it. The badge is what makes an xStock quote possible at all.

Pass the badge as **remaining account index 0** on the create call. The SDK
does this for you from 1.5.12 onward via `getTokenBadgeRemainingAccounts`, and
`deriveTokenBadgeAddress` gives you the PDA if you want to check first.

## Why this repo polls it

You cannot create a badge. Only an operator can, and they do it in batches on
their own schedule. On 2026-09-08 zero of the 102 xStocks were badged. On
2026-09-09, 46. Later the same day, all 102.

So the badge state is external, it changes without notice, and it is the
difference between a working launch and a failed transaction the user has
already signed. `tokenBadgeService` sweeps every 60 seconds:

- All 102 PDAs derived locally, then fetched in two `getMultipleAccounts`
  calls. Two RPC calls per minute, not 102.
- A failed sweep leaves the previous cache alone. Treating a 429 as "the badge
  is gone" would close a ticker that is fine.
- Nothing is unlocked until a sweep has actually run. The default is locked,
  which fails closed.

`snapshot()` gives you the tally, `isUnlocked(symbol)` the single answer,
`getStatus(symbol)` the detail including the derived PDA.

## Check it from the shell

```bash
node scripts/badge-check.js              # all 102
node scripts/badge-check.js AAPLx NVDAx  # just these
```

## If a launch fails anyway

A badge is necessary and not sufficient. In rough order of likelihood:

1. The badge is there but you did not pass it as remaining account 0.
2. Base decimals do not equal quote decimals. Against a stock, both are 8.
3. `migrationQuoteThreshold` is in the wrong unit. See [CURVE-MATH.md](CURVE-MATH.md).
4. The SDK is older than 1.5.12 and has no idea badges exist.
