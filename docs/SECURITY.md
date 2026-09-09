# Security

## What is secret here

Two things, and only two:

- `PLATFORM_PRIVKEY`. It owns every config on the pad, claims the fees, and
  pays rent. Whoever has it can drain the fee stream.
- Your RPC URLs. A provider puts the API key in the query string, so the whole
  URL is the credential.

Everything else in this repo is public on-chain data. Mints, config addresses,
pool addresses, holder lists and badge PDAs are all readable by anyone with an
RPC endpoint, and treating them as secret buys you nothing.

## Rules the code follows

**The private key is read in one place.** `getPlatformWallet()` in
`src/config/pairs.js`, from the environment. It is never logged, never written
to disk, never returned by a route, and never included in an error message. If
you add a debug line that prints a config object, check what is in it first.

**No route signs anything.** The HTTP surface is read-only by construction.
Creating a config spends rent and paying holders spends tokens, so both are
function calls from your own code, behind whatever authentication you run.
Exposing either as an endpoint gives a stranger a way to spend your money.

**Health endpoints report state, not values.** `env.rpcInfo()` returns hosts.
The pad this was extracted from had a `/api/health` that returned the full RPC
URL and an absolute server path, on an endpoint left open so uptime checks
would work. Anyone who curled it got a working RPC endpoint on someone else's
quota.

**`dryRun` needs no connection.** The payout path computes the whole split and
returns it without a network object in scope, so a dry run cannot send by
accident. There is a test asserting exactly that.

**Errors name the failure, not the input.** `decodeBase58` reports how many
bytes it decoded and does not echo the string, because a malformed key is still
a key.

## Rules for you

**Keep `.env` out of git.** It is ignored, along with `*.pem`, `*.key`, every
spelling of a keypair file, and the suffixed backup forms. That last one is not
paranoia: `*.bak` does not match `settings.js.bak-legacy`, and two backup files
rode into the source repo on that gap.

**Copy secrets machine-to-machine.** Never through a chat window, a screenshot,
a ticket or a commit. If one lands somewhere it should not, rotate it rather
than deleting the message.

**Fund the platform wallet before launch day.** An empty wallet fails at the
config-creation step, which happens after the user has signed. They pay the
signature, you pay the support conversation.

**Run `git log -p` on a fork before you publish it.** A secret removed in the
working tree is still in the history. This repo starts from a fresh
`git init` for that reason.

## Reporting

Open an issue for anything that is not itself a live secret. For a live secret,
mail the address on the repo rather than filing it in public.
