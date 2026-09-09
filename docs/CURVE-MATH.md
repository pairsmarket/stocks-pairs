# Curve math, and the unit trap

## The trap

`migrationQuoteThreshold` is denominated in the **quote token**. Not in dollars,
not in SOL, not in a normalised unit. If your quote is AAPLx at $318, then
$21,000 to migrate means 66 AAPLx. If your quote is a $2 stock, the same dollar
target is 10,500 of them.

Copy a threshold from a SOL config into a stock config and you get a curve that
migrates at either 200x or 1/200th of what you intended, with no error to tell
you which.

## What the service does

```js
migrationQuoteThreshold = migrationQuoteUsd / priceUsd
```

`curveParamsForPrice(priceUsd, { migrationQuoteUsd })` is a pure function, and
the tests pin its behaviour:

- A cheap stock needs more quote tokens than an expensive one for the same
  dollar target.
- A zero or negative price throws. There is no default, because a defaulted
  price produces a curve that looks fine and prices wrong.

Defaults live in the environment: `STOCK_MIGRATION_QUOTE_USD=21000`,
`STOCK_FEE_BPS=300`, `STOCK_CREATOR_FEE_PCT=0`.

## Decimals

DBC requires base decimals to equal quote decimals. Every xStock is 8, so every
token launched against a stock is an 8-decimal token, and every raw amount is
`human * 10^8`.

Three places this matters:

- **First buy.** Amounts are computed in the quote token's base units. Passing
  6 for an 8-decimal quote makes the buy 100x too small; passing 9 makes it 10x
  too large.
- **Payouts.** `distributeQuoteToHolders` takes `quoteDecimals` from its caller
  and uses `createTransferCheckedInstruction`, so a wrong value fails the
  transfer instead of sending the wrong amount. Fail loudly, not quietly.
- **Holder shares.** Share is computed in BigInt against raw amounts. An
  earlier float version divided by `10^2` where it needed `10^4` and reported
  a holder at 9663.89%.

## Why creator fee is 0 by default

Paying holders in the quote token means the platform wallet has to hold the
quote token. With `STOCK_CREATOR_FEE_PCT=0` the platform claims every trading
fee, keeps its share, and pays the rest out. Split the fee with the creator and
the platform cannot pay out what never arrived.

## Money math

Every amount is BigInt from the account bytes to the transfer instruction.
`splitProportional` weights on raw base units, divides in integers, and adds the
division remainder to the largest holder so a payout sums to exactly the total.
Floats lose dust on every payout, and dust compounds.
