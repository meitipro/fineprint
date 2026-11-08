# Tasks

The build brief of the spec, ticked from the repository's own state, so a fresh session can resume from here.

- [x] Contract and `tests/test_direct.py` covering every method and every rule of section 2, nondet mocked; lint and validate against the live runtime
- [x] Document hash byte for byte the same in the contract and the browser, with shared vectors in `tests/vectors.json`
- [x] A test asserts that bond left + paid out + stakes held always equals what came in
- [x] `scripts/mutate.py`: 113 of 113 defences caught
- [x] Deploy to Studio Next; frozen in `contracts/FROZEN.json`; `scripts/verify.py` finds the deployed bytes identical
- [x] `eval/`: golden cases through real consensus (8 of 10, misses published), held-out cases once, verdicts and transaction hashes in `eval/results.md`, never tuned
- [x] `web/`: every page of section 6 with genlayer-js 2.0.0-rc.1
- [x] `/docs`: every page of section 7, generated reference, plus `/llms.txt`
- [x] `scripts/seed.py`, README, `submission/`
- [ ] Repository on GitHub: blocked by the permission guard, see `HANDOFF.md`
- [ ] Site on Vercel
- [ ] Reviewer path on the live site from fresh accounts (`web/scripts/reviewer-path.mjs`)
- [ ] Portal entry sent, X post, demo recorded: only the user can do these (`HANDOFF.md`)
