# Handoff

Only the user can do these:

- Send the portal entry (`submission/portal.md`, counted with `python submission/count.py`) and the X post (`submission/x-post.md`).
- Record the silent demo from `submission/demo-script.md`.
- Optional: set `OPENROUTER_API_KEY` on the Vercel project to switch on the "Check before posting" preview. It is untested here because no key was available, and it never reaches the chain.

Worth knowing:

- The runtime header differs from the spec's, because Studio Next rejects the spec's hash today. See the README, "Honest departures".
- The golden misses (cases 1 and 4) are published as they came out and were not tuned.
- The seeded Kiln, Quill and Pellmark summaries have 24 to 72 hour windows. The Quill summary has no challenge, so it can be closed with `close_summary` once its window ends, and will then show STANDS. Reviewers should open a fresh summary rather than the seeded ones.
- Test keys live in `~/.fineprint/accounts.json`, outside the repository. Nothing prints a key.
