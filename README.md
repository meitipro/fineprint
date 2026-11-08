# Fineprint

**A summary of the terms, with money on it.**

Fineprint is a summary bond for terms and rules on [GenLayer](https://www.genlayer.com). Anyone can publish a plain-language summary of a terms document whose clauses are fixed on chain. Each claim cites the clause it comes from and is backed by a bond. Anyone can stake a tenth of the bond to challenge one claim, GenLayer validators read the claim against the clause and say whether it is faithful, misstates it, or is not supported, and the bond moves by rule to whoever was right.

One contract (`contracts/fineprint.py`, ten methods), a Next.js site with a `/docs` section, deployed on **GenLayer Studio Next** (chain 61997). The build spec is the source of truth; where this build departs from it, [Honest departures](#honest-departures) says so.

| | |
|---|---|
| Network | GenLayer Studio Next, chain 61997 |
| Contract | [`0xe6Aa698d3b3c5F6ED7722f15649B0ca85EA7d092`](https://explorer-studio-dev.genlayer.com/address/0xe6Aa698d3b3c5F6ED7722f15649B0ca85EA7d092) |
| Deploy transaction | [`0x8b3f662a…`](https://explorer-studio-dev.genlayer.com/tx/0x8b3f662aff9982077b6795e1ea3c440244a16cbbd811f0c0659d6d00bd5350e5) |
| Source sha256 | `3e8786ac1adcfd27153712f179c2463dc30dbad102c35c58435b0edc176f64ef` (held to the deployed bytes by `scripts/verify.py`) |
| Golden cases through real consensus | **8 of 10**, misses published, nothing tuned ([`eval/results.md`](eval/results.md)) |
| Held-out cases | H1 `UNSUPPORTED`, H2 `FAITHFUL`, H3 `MISSTATES`, as they came out |
| Tests | 147 passing, offline |
| Mutations | 113 defences broken one at a time, 113 caught ([`docs/MUTATIONS.md`](docs/MUTATIONS.md)) |

## How it works

1. **Register.** A document is 3 to 12 numbered clauses. Its id is the sha256 of its text, so it can never be edited: a new version is a new document.
2. **Summarise.** An author posts 3 to 8 claims, each citing one clause, with a bond of at least 10 GEN and a challenge window of 24 to 168 hours.
3. **Challenge.** Anyone stakes a tenth of the bond against one claim, and may name a second clause it contradicts. The reason is stored for readers and is never given to the judge.
4. **Read.** Validators read the claim against the clause and agree on one label: `FAITHFUL`, `MISSTATES` or `UNSUPPORTED`. They compare that label and nothing else.
5. **Settle.** The contract computes the verdict from the label, in code:

| Verdict | When | Money |
|---|---|---|
| UPHELD | label is MISSTATES or UNSUPPORTED | stake back, plus 20% of the original bond (capped at what remains) |
| REJECTED | label is FAITHFUL | the stake goes to the author |
| CORRECTED | the author retracts before it is read | stake back, plus 10% of the bond |
| STANDS | the window ends with no open challenge | the rest of the bond returns to the author |

Money moves only in `withdraw()`, a top-level transfer to the caller. `judge`, `retract` and `close_summary` only move balances. A test asserts after nearly every step that `received == bonds_left + stakes_held + owed + paid`.

## The ten methods

`register_doc`, `post_summary` (payable), `challenge` (payable), `judge`, `retract`, `close_summary`, `withdraw`, `get_doc`, `get_summary`, `get_challenge`. The reference in the docs is generated from the source, so a method cannot exist in code and be missing there.

## Results, as they came out

The ten golden cases of the spec went through the deployed contract, one challenge each, read by the real judge. The judge prompt is the spec's, word for word, and the set was hashed and timestamped before the first run.

- **8 of 10 matched.** The two misses are published, not tuned away: cases 1 ("You need 100 KILN at the Oct 1 snapshot" against "Hold at least 100 KILN…") and 4 ("A quarter at claim, the rest over a year") were expected FAITHFUL, and the validators agreed on MISSTATES both times. The model is stricter about a dropped "at least" and a dropped "cannot be transferred" than the spec expected.
- **Held out, run once, never used to tune:** H1 "Most users can claim" → UNSUPPORTED; H2 "Tokens vest over about a year" → FAITHFUL; H3 "You will keep your tokens for good" (clause 4, against clause 6) → MISSTATES.
- **Seed on chain:** claim 3 of the Kiln terms ("Tokens are fully unlocked at claim.") was challenged and came back MISSTATES → UPHELD; claim 2 came back FAITHFUL → REJECTED; Pellmark's claim 5 was challenged and retracted → CORRECTED; a challenger withdrew 9 GEN and the wallet gained it at finality ([`docs/seed.studio-next.md`](docs/seed.studio-next.md)).

## Honest departures

- **The runtime header.** The spec names `py-genlayer:5jycge4q…`. On the day of this build Studio Next answered `invalid_contract runner malformed` for that hash, even for the Faithful contract that was deployed with it a month earlier. The contract is pinned to `py-genlayer:babwp9t3…`, the runner the network itself resolves `py-genlayer:latest` to, checked with the network's own `gen_getContractSchemaForCode`. The installed `genvm-lint` does not know that runner, so `scripts/deploy.py` and `scripts/verify.py` lint the same bytes with the one header line swapped, and the live runtime's verdict is the authority.
- **A 48 hour bound on reading.** A challenge nobody could read is voided by the next `judge` call: no model runs, the stake goes back, the claim stays open to a new challenge. It adds a fifth outcome, VOID, so that no money waits forever.
- **One view carries more than one key.** The spec fixes exactly ten methods, so `get_doc` also answers the totals, a document by number, and an account's balance and lists.
- **A retracted claim is struck, not replaced.** `retract(summary_id, claim_no)` carries no replacement text; a replacement is a new summary.
- Claims are sent as a JSON string. The optional "Check before posting" preview is off unless the deployment has a model key, and never reaches the chain.

## Layout

```
contracts/fineprint.py        one contract, the judge prompt pinned inside
contracts/FROZEN.json         address, deploy tx and sha256 of the exact bytes deployed
tests/test_direct.py          every method and every rule, nondet mocked; money invariant under random play
tests/test_static.py          the source, parsed: every write classified, every prompt value fenced, money leaves only in withdraw
tests/vectors.json            document hash vectors shared with the site
eval/                         golden cases, held-out cases, results with transaction hashes
scripts/                      chain, deploy, verify, mutate, seed, gen_docs, gen_vectors
web/                          Next.js site and /docs (Fumadocs), genlayer-js 2.0.0-rc.1
submission/                   portal text, X post, silent demo script, 512 px logo
```

## Run it

```bash
python -m venv .venv && .venv/Scripts/python -m pip install -r requirements.txt   # Linux and macOS: .venv/bin/python
.venv/Scripts/python -m pytest tests -q          # offline, no network
.venv/Scripts/python scripts/verify.py           # deployed bytes against this repository
.venv/Scripts/python scripts/mutate.py           # break every defence once; refuses to pass if anything escapes
cd web && npm ci && npm run build && npm start   # the site, reading the live contract
node web/scripts/hash-parity.mjs                 # the browser hash against the contract's, byte for byte
```

Keys never live in this repository. Test accounts are kept in `~/.fineprint/accounts.json`, and the scripts print only addresses. The site holds no key; writes are signed in the visitor's wallet.

## Honest limits

Fineprint checks that a claim matches the clause it cites. It is not legal advice, it never says a clause is fair, legal or complete, and it judges claims that are made, so it cannot say what a summary left out. A document is only as accurate as the person who pasted it, which is why its text is public and fixed by its hash. A model can be wrong, and the misses above are the evidence.
