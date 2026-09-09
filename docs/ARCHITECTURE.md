# Architecture

## The one-sentence version

A Meteora DBC config is bound to one quote mint, so a pad that can quote in 102
stocks needs up to 102 configs, and each one has to clear a badge check before
it can exist.

## The path a stock launch takes

```
symbol ──► registry ──► badge ──► price ──► config ──► pool ──► holders/trades
           is it a      will      what is   which      DBC      RPC reads
           real mint?   DBC       it worth  config     creates  after the
                        take it?  today?    do we      the      fact
                                            use?       pool
```

Each arrow is a place to refuse rather than guess.

**registry** (`src/config/xstockRegistry.js`). 102 mints, verified by issuer.
Every entry's freeze authority is Backed's
`JDq14BWvqCRFNu1krb12bcRpbGtJZ1FLEakMw6FdxJNs`. Decimals are 8 across the
board, read from the mint account rather than assumed, because they drive every
amount computed downstream. Lookup is case-insensitive and returns the
canonical symbol, so what a user typed and what you send stay the same string.

**badge** (`src/services/tokenBadgeService.js`). See
[TOKEN-BADGE.md](TOKEN-BADGE.md). A sweep derives all 102 PDAs and fetches them
in two `getMultipleAccounts` calls, then repeats every 60 seconds. A poller
rather than a boot-time read, because Meteora badges mints whenever they like
and you want a ticker to open without a restart. A failed sweep keeps the
previous cache: a 429 is not evidence that a badge disappeared.

**price** (`src/services/stockPriceService.js`). Jupiter price v3, in batches of
50, cached for five minutes. 55 of the 102 had a price the day this was
written. A stock with no price throws `PRICE_UNAVAILABLE` and gets no config.
The service also checks the mint's decimals against the registry and throws
`DECIMALS_MISMATCH` rather than pricing a curve against the wrong scale.

**config** (`src/services/stockConfigService.js`). The interesting file. An
operator-prepared config in `CONFIG_<SYMBOL>` always wins, so you can build a
curve by hand and drop it in. Otherwise the first person to launch against a
stock triggers creation, and the result lands in `data/stockConfigs.json` for
everyone after them. Two things it does in a deliberate order:

1. The badge check runs before any billable step. An unbadged stock costs you
   nothing to refuse, and refusing after paying rent is the expensive version
   of the same answer.
2. An in-flight lock per symbol. Two people launching against NVDAx in the same
   second share one creation, instead of both paying rent for a config only one
   of them can use.

**pool.** Not in this repo. Whatever creates your pool needs three things from
here: the config address, the quote mint, and the badge as remaining account
index 0. Base decimals must equal quote decimals, so a token launched against a
stock is an 8-decimal token.

**holders and trades** (`src/services/tokenPageService.js`). RPC only. Holders
come from `getTokenLargestAccounts` plus a parsed-accounts read, because
`getProgramAccounts` against a mint with ten million accounts returns a 502 and
no public endpoint will serve it. When even the largest-accounts call fails, the
response carries `rankable: false` and a 200, which a UI can render as "not
ranked" instead of as an error. The holder count reads the eight amount bytes at
offset 64 so that closed, zero-balance accounts do not inflate it.

For a payout you want the exact set instead of a ranking, and
`src/services/holderService.js` does that scan with raw BigInt amounts and the
mint's real decimals.

## Two failure modes worth designing for

**Everything is quote-denominated.** Reserves, thresholds, fees and payouts are
all in the quote token. The trade reader branches on `pool.quoteIsSol` for that
reason, and the payout takes `quoteDecimals` from its caller rather than
inferring it. An earlier version inferred `isWsol ? 9 : 6`, which is a 100x
error on an 8-decimal stock.

**Token-2022 is a different program.** `getAssociatedTokenAddress(mint, owner)`
derives a classic SPL address by default, and for a Token-2022 mint that
address is a real, empty account. Everything here reads the mint's owner
program first and passes it into the derivation. The symptom, if you forget, is
a funded wallet that reads as empty.

## Adding a quote that is not an xStock

Nothing in the engine cares that a quote mint is a stock, past the registry. To
quote against something else you need the mint, its real decimals, a token
badge for it, and a price source if you want the curve derived rather than
hand-built. Add it to the registry with honest decimals and the rest follows.
