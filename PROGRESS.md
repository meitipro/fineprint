# Progress

- Read the spec and the rulebook; the Faithful and Clearance projects were the template for scripts, doubles and the site shell.
- `contracts/fineprint.py`: the ten methods, judge prompt word for word, verdict in code, money only in `withdraw`.
- Tests: 147 passing, including the money invariant under 40 random plays and the browser hash held to the contract's.
- `scripts/mutate.py`: first run let 3 mutants escape (length prefixes in the hash, a redundant state check, a view returning the wrong id). Two tests added, one redundant check removed; then 113 of 113 killed.
- Studio Next rejected the spec's runtime header (`runner malformed`, also for the older Faithful contract). Pinned the runner the network resolves `latest` to, checked with `gen_getContractSchemaForCode`.
- Deployed to Studio Next at `0xe6Aa698d3b3c5F6ED7722f15649B0ca85EA7d092`; `scripts/verify.py` finds the deployed bytes identical.
- Golden set locked before the first run; 8 of 10 through real consensus (cases 1 and 4 missed), held-out H1 UNSUPPORTED, H2 FAITHFUL, H3 MISSTATES, as they came out.
- Site: landing, documents, summaries, challenge, post a summary, my bonds, wallet gate, faucet and refresh routes; `/docs` with a generated reference and `/llms.txt`.
- Seed: Kiln claim 3 UPHELD, claim 2 REJECTED, Pellmark claim 5 CORRECTED, a 9 GEN withdrawal.
- Pushed to https://github.com/meitipro/fineprint (public). The GitHub step first needed the user's approval: the permission guard refused it twice.
- Deployed to Vercel: https://fineprint-genlayer.vercel.app (project `fineprint-genlayer`, Git auto-builds disconnected, Skew Protection off).
- Reviewer path on the live site from fresh accounts: all steps and 14 pages OK.
