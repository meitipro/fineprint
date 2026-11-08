#!/usr/bin/env python3
"""
Seed the deployed contract with real documents, summaries, challenges and payouts.

    python scripts/seed.py            # run what is left, saving every step
    python scripts/seed.py --report   # rewrite docs/seed.studio-next.md from the record

Every step is a real transaction from a local test account, saved to
docs/seed.studio-next.json before anything is printed, so a run can stop at any
point and resume without sending anything twice. The labels and verdicts are
whatever the validators answered: this script never chooses them, and it
records a result that surprised its author exactly as it came out.

What it builds, from the spec's own examples:
  - "Kiln airdrop terms" (registered by the golden run): a summary of six claims with a
    20 GEN bond; claim 3 ("Tokens are fully unlocked at claim.") is challenged and read,
    claim 2 is challenged and read by a second challenger, and the first challenger withdraws.
  - "Quill grants terms": a clean summary nobody challenges, so it will STAND when its window ends.
  - "Pellmark token sale terms": a summary where claim 5 is challenged and the author retracts it.
"""

from __future__ import annotations

import datetime
import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))

import chain as C  # noqa: E402

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ROOT = C.ROOT
RECORD = ROOT / "docs" / "seed.studio-next.json"
REPORT = ROOT / "docs" / "seed.studio-next.md"
AUTHOR = "seed_author"
CHALLENGERS = ["seed_challenger_1", "seed_challenger_2"]
JUDGE = "seed_judge"

QUILL = {
    "title": "Quill grants terms",
    "clauses": [
        "Applications are open to teams of up to five people from September 1 to September 30.",
        "Each approved team receives a grant of 20,000 USDC, paid in two equal installments.",
        "The second installment is paid after the team publishes a working prototype.",
        "Grant funds may only be spent on development costs and not on token purchases or marketing.",
        "Quill may withdraw a grant if the team misses two consecutive monthly check-ins.",
        "All code produced with grant funds must be published under an open source license.",
    ],
    "claims": [
        {"clause": 1, "text": "Teams of up to five can apply between September 1 and September 30"},
        {"clause": 2, "text": "A grant is 20,000 USDC in two equal installments"},
        {"clause": 3, "text": "The second installment comes after a working prototype is published"},
        {"clause": 4, "text": "Grant money can only go to development costs, not to tokens or marketing"},
        {"clause": 6, "text": "Code built with the grant must be open source"},
    ],
    "bond_gen": 10,
    "hours": 24,
}
PELLMARK = {
    "title": "Pellmark token sale terms",
    "clauses": [
        "The sale runs for 48 hours from the moment the sale contract is opened.",
        "Each wallet may buy up to 5,000 USD worth of tokens during the sale.",
        "Purchases are refundable within 14 days of the end of the sale, minus network fees.",
        "Tokens bought in the sale are locked for 6 months after the end of the sale.",
        "Pellmark may extend or shorten the sale period at its sole discretion.",
    ],
    "claims": [
        {"clause": 1, "text": "The sale lasts 48 hours"},
        {"clause": 2, "text": "Each wallet can buy up to 5,000 USD of tokens"},
        {"clause": 3, "text": "Purchases are fully refundable for 14 days"},
        {"clause": 4, "text": "Tokens are locked for 6 months after the sale ends"},
        {"clause": 5, "text": "Pellmark cannot change the length of the sale"},
    ],
    "bond_gen": 15,
    "hours": 48,
}
KILN_CLAIMS = [
    {"clause": 1, "text": "Hold 100 KILN at the Oct 1 snapshot"},
    {"clause": 1, "text": "Wallets made after Oct 1 do not count"},
    {"clause": 4, "text": "Tokens are fully unlocked at claim."},
    {"clause": 6, "text": "Kiln may end the program at any time"},
    {"clause": 3, "text": "The claim runs from Oct 15 to Dec 15"},
    {"clause": 3, "text": "Tokens nobody claims go back to the treasury"},
]


def now_iso() -> str:
    return datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def load() -> dict:
    if RECORD.exists():
        return json.loads(RECORD.read_text(encoding="utf-8"))
    return {"steps": {}}


def save(record: dict) -> None:
    RECORD.write_text(json.dumps(record, indent=2, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")


def step(record: dict, key: str, chain: C.Chain, address: str, method: str, args: list, value: int = 0) -> dict:
    """One real transaction, once. A step already recorded is never sent again."""
    if key in record["steps"]:
        return record["steps"][key]
    outcome = chain.send(address, method, args, value=value)
    row = {"method": method, "tx": outcome["hash"], "ok": outcome["ok"], "returned": outcome["result"], "refusal": outcome["refusal"], "at": now_iso()}
    record["steps"][key] = row
    save(record)
    print(f"  {key}: {'ok' if outcome['ok'] else 'FAILED ' + (outcome['refusal'] or outcome['detail'])}  {C.EXPLORER}/tx/{outcome['hash']}")
    if not outcome["ok"]:
        raise SystemExit(f"{key} did not succeed; fix the cause and run again. Nothing already recorded is sent twice.")
    return row


def read_challenge(reader: C.Chain, address: str, cid: int) -> dict:
    return reader.read_json(address, "get_challenge", [cid])


def main() -> int:
    if "--report" in sys.argv:
        report()
        return 0
    address = C.address()
    people = C.accounts(AUTHOR, JUDGE, *CHALLENGERS)
    author = C.Chain(people[AUTHOR])
    judge = C.Chain(people[JUDGE])
    challengers = [C.Chain(people[n]) for n in CHALLENGERS]
    reader = C.Chain()
    record = load()
    record.update({"contract": address, "author": people[AUTHOR].address, "challengers": [people[n].address for n in CHALLENGERS], "judge": people[JUDGE].address})
    save(record)

    author.ensure(people[AUTHOR].address, minimum_gen=80, top_up_gen=1000)
    judge.ensure(people[JUDGE].address, minimum_gen=20)
    for n, c in zip(CHALLENGERS, challengers):
        c.ensure(people[n].address, minimum_gen=20)

    golden = json.loads((ROOT / "eval" / "results.json").read_text(encoding="utf-8"))
    kiln_id = golden["document"]["id"]

    print("\nDocuments")
    quill = step(record, "register_quill", author, address, "register_doc", [QUILL["title"], QUILL["clauses"]])
    pellmark = step(record, "register_pellmark", author, address, "register_doc", [PELLMARK["title"], PELLMARK["clauses"]])

    print("\nSummaries")
    kiln_s = step(record, "post_kiln", author, address, "post_summary", [kiln_id, json.dumps(KILN_CLAIMS), 72], 20 * C.GEN)
    quill_s = step(record, "post_quill", author, address, "post_summary", [quill["returned"], json.dumps(QUILL["claims"]), QUILL["hours"]], QUILL["bond_gen"] * C.GEN)
    pell_s = step(record, "post_pellmark", author, address, "post_summary", [pellmark["returned"], json.dumps(PELLMARK["claims"]), PELLMARK["hours"]], PELLMARK["bond_gen"] * C.GEN)

    print("\nChallenges")
    kiln_stake = int(reader.read_json(address, "get_summary", [kiln_s["returned"]])["stake"])
    c3 = step(record, "challenge_kiln_3", challengers[0], address, "challenge", [kiln_s["returned"], 3, 0, "Only a quarter is available at claim, the rest vests over twelve months."], kiln_stake)
    step(record, "judge_kiln_3", judge, address, "judge", [c3["returned"]])
    c2 = step(record, "challenge_kiln_2", challengers[1], address, "challenge", [kiln_s["returned"], 2, 0, "Checking that the snapshot rule is stated as the clause states it."], kiln_stake)
    step(record, "judge_kiln_2", judge, address, "judge", [c2["returned"]])
    pell_stake = int(reader.read_json(address, "get_summary", [pell_s["returned"]])["stake"])
    p5 = step(record, "challenge_pellmark_5", challengers[0], address, "challenge", [pell_s["returned"], 5, 0, "Clause 5 says Pellmark may extend or shorten the sale at its sole discretion."], pell_stake)
    step(record, "retract_pellmark_5", author, address, "retract", [pell_s["returned"], 5])

    print("\nWithdrawals")
    for n, c in zip(CHALLENGERS, challengers):
        owed = int(reader.read_json(address, "get_doc", [people[n].address.lower()])["balance"])
        if owed > 0:
            before = c.balance(people[n].address)
            row = step(record, f"withdraw_{n}", c, address, "withdraw", [])
            fin = c.wait(row["tx"], "finalized")
            after = C.retry("balance", c.balance, people[n].address)
            row["owed_before"] = str(owed)
            row["balance_before"] = str(before)
            row["balance_after_finality"] = str(after)
            save(record)
            print(f"  {n}: owed {owed / C.GEN} GEN, wallet {before / C.GEN:.4f} -> {after / C.GEN:.4f} GEN after finality")
    record["finished_at"] = now_iso()
    save(record)
    report()
    return 0


def report() -> None:
    record = load()
    address = record.get("contract", "")
    reader = C.Chain()
    lines = ["# Seed", "", f"Contract `{address}` on Studio Next. Every row is a real transaction; the labels and verdicts are read back from the contract.", ""]
    lines += ["| Step | Method | Result | Transaction |", "|---|---|---|---|"]
    for key, row in record.get("steps", {}).items():
        result = ""
        if row["method"] == "judge":
            cid = next((r["returned"] for k, r in record["steps"].items() if k == key.replace("judge_", "challenge_") and r["method"] == "challenge"), None)
            if cid:
                c = reader.read_json(address, "get_challenge", [cid])
                result = f"{c['label']} → {c['verdict']}"
        elif row["method"] == "retract":
            result = "claim struck"
        elif row["method"] in ("register_doc", "post_summary", "challenge"):
            result = f"id {str(row['returned'])[:12]}"
        lines.append(f"| {key} | `{row['method']}` | {result} | [{row['tx'][:10]}…]({C.EXPLORER}/tx/{row['tx']}) |")
    REPORT.write_text("\n".join(lines) + "\n", encoding="utf-8", newline="\n")
    print(f"wrote {REPORT.relative_to(ROOT).as_posix()}")


if __name__ == "__main__":
    raise SystemExit(main())
