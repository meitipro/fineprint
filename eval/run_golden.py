#!/usr/bin/env python3
"""
Run the golden cases through the deployed Fineprint contract on Studio Next,
through real consensus, and publish what came out.

    python eval/run_golden.py --lock       # hash and timestamp eval/golden.json, once, before the first run
    python eval/run_golden.py              # the ten golden cases
    python eval/run_golden.py H1 H2 H3     # the held-out cases, once
    python eval/run_golden.py --report     # rewrite results.md from results.json

eval/golden.json was written, hashed and timestamped (eval/golden.lock.json)
before the first run, and this script refuses to run if it has changed since.
The document is registered by the "golden_author" account, and two summaries
carry the cases as claims (the contract allows eight claims to a summary).
Each case is one challenge, staked from one of the local accounts
golden_challenger_1 to _3, and then read by the real judge: a `judge`
transaction sent by a fourth account. Every verdict below is read back from the
contract with get_challenge, not taken from this script's memory.

Every step is saved before anything is printed, so a run can stop at any point
and resume without sending anything twice. H1 to H3 are held out: run once,
reported as they came out, never used to tune the prompt. A judge whose round
produced no verdict (the committee timed out or could not agree) may be sent
again, and every attempt stays in the record. A case that produced a label is
never sent again, whatever the label was.
"""

from __future__ import annotations

import ast
import datetime
import hashlib
import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent / "scripts"))

import chain as C  # noqa: E402

# A model's answer can carry any character; the Windows console codepage cannot.
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

HERE = pathlib.Path(__file__).resolve().parent
GOLDEN = HERE / "golden.json"
LOCK = HERE / "golden.lock.json"
RESULTS = HERE / "results.json"
REPORT = HERE / "results.md"
AUTHOR = "golden_author"
CHALLENGERS = ["golden_challenger_1", "golden_challenger_2", "golden_challenger_3"]
JUDGE = "golden_judge"
FINAL = ("FAITHFUL", "MISSTATES", "UNSUPPORTED")


def judge_sha() -> str:
    tree = ast.parse(C.CONTRACT_FILE.read_text(encoding="utf-8"))
    for node in tree.body:
        if isinstance(node, ast.Assign) and ast.unparse(node.targets[0]) == "JUDGE":
            return hashlib.sha256(ast.literal_eval(node.value).encode("utf-8")).hexdigest()
    raise SystemExit("no JUDGE constant")


def now_iso() -> str:
    return datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def load_results() -> dict:
    if RESULTS.exists():
        return json.loads(RESULTS.read_text(encoding="utf-8"))
    return {"document": {}, "summaries": {}, "cases": {}, "attempts": []}


def save(results: dict) -> None:
    RESULTS.write_text(json.dumps(results, indent=2, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")


def finished(results: dict, case_id: str) -> bool:
    return any(a["case"] == case_id and a.get("label") in FINAL for a in results["attempts"])


def must(outcome: dict, what: str) -> dict:
    if not outcome["ok"]:
        raise SystemExit(f"{what} failed: {outcome['detail']}  {C.EXPLORER}/tx/{outcome['hash']}")
    return outcome


def matches(attempt: dict) -> bool:
    want = attempt["expected"]
    if want == "EITHER":
        return attempt.get("label") in FINAL
    return attempt.get("label") == want


def lock() -> None:
    if LOCK.exists():
        raise SystemExit("eval/golden.lock.json already exists; the golden set is locked once")
    LOCK.write_text(
        json.dumps({"file": "eval/golden.json", "sha256": C.sha256_file(GOLDEN), "locked_at": now_iso()}, indent=2) + "\n",
        encoding="utf-8",
        newline="\n",
    )
    print(f"locked eval/golden.json  sha256 {C.sha256_file(GOLDEN)}")


def prepare(golden: dict, results: dict, address: str, author: C.Chain) -> None:
    """Register the document and post the two summaries, once each."""
    row = results["document"]
    if "id" not in row:
        outcome = must(author.send(address, "register_doc", [golden["document"]["title"], golden["document"]["clauses"]]), "register_doc")
        doc_id = outcome["result"] if isinstance(outcome["result"], str) else None
        if not doc_id:
            raise SystemExit("register_doc returned no document id")
        row.update({"id": doc_id, "tx": outcome["hash"]})
        save(results)
        print(f"registered document {doc_id[:16]}...  {C.EXPLORER}/tx/{outcome['hash']}")
    for spec in golden["summaries"]:
        key = spec["key"]
        if key in results["summaries"]:
            continue
        claims = []
        for cid in spec["cases"]:
            case = next(c for c in golden["cases"] if c["id"] == cid)
            claims.append({"clause": case["clause"], "text": case["claim"]})
        before = author.read_json(address, "get_summary", [0])["totals"]["summaries"]
        outcome = must(
            author.send(address, "post_summary", [row["id"], json.dumps(claims, ensure_ascii=False), golden["window_hours"]], value=golden["bond_gen"] * C.GEN),
            "post_summary " + key,
        )
        sid = outcome["result"] if isinstance(outcome["result"], int) else None
        if not sid:
            after = author.read_json(address, "get_summary", [0])["totals"]["summaries"]
            sid = after if after > before else None
        if not sid:
            raise SystemExit("post_summary returned no summary id")
        results["summaries"][key] = {"id": int(sid), "tx": outcome["hash"], "cases": spec["cases"]}
        save(results)
        print(f"posted summary {sid} ({key}: cases {', '.join(spec['cases'])})  {C.EXPLORER}/tx/{outcome['hash']}")


def run_case(case: dict, index: int, results: dict, address: str, challengers: dict, judge: C.Chain, reader: C.Chain) -> None:
    cid = case["id"]
    spec = next(s for s in results["summaries"].values() if cid in s["cases"])
    summary_id = spec["id"]
    claim_no = spec["cases"].index(cid) + 1
    who_name = CHALLENGERS[index % len(CHALLENGERS)]
    who = challengers[who_name]
    row = results["cases"].setdefault(cid, {"summary_id": summary_id, "claim_no": claim_no, "challenger": who.account.address})
    if "challenge_tx" not in row:
        summary = reader.read_json(address, "get_summary", [summary_id])
        outcome = must(
            who.send(
                address,
                "challenge",
                [summary_id, claim_no, int(case.get("against", 0)), f"Golden case {cid}: does this claim say what clause {case['clause']} says?"],
                value=int(summary["stake"]),
            ),
            f"challenge for case {cid}",
        )
        challenge_id = outcome["result"] if isinstance(outcome["result"], int) else None
        if not challenge_id:
            rows = reader.read_json(address, "get_summary", [summary_id])
            challenge_id = rows["claim_rows"][claim_no - 1]["open_challenge"] or None
        if not challenge_id:
            raise SystemExit(f"challenge for case {cid} returned no challenge id")
        row.update({"challenge_tx": outcome["hash"], "challenge_id": int(challenge_id)})
        save(results)
        print(f"  challenged claim {claim_no} of summary {summary_id} as challenge {challenge_id}  {C.EXPLORER}/tx/{outcome['hash']}")
    tries = sum(1 for a in results["attempts"] if a["case"] == cid)
    attempt = {
        "case": cid,
        "attempt": tries + 1,
        "held_out": bool(case.get("held_out")),
        "expected": case["expected"],
        "challenge_id": row["challenge_id"],
    }
    outcome = judge.send(address, "judge", [row["challenge_id"]])
    attempt.update({"tx": outcome["hash"], "sent_at": now_iso(), "consensus": "decided" if outcome["ok"] else outcome["detail"]})
    read = reader.read_json(address, "get_challenge", [row["challenge_id"]])
    if read["label"] in FINAL:
        attempt.update(
            {
                "label": read["label"],
                "verdict": read["verdict"],
                "to_challenger": read["to_challenger"],
                "to_author": read["to_author"],
                "resolved_at": read["resolved_at"],
                "validators": validators_in(outcome),
            }
        )
    # Saved before anything is printed: a result that exists on chain must
    # never be lost to a failure on this side of the wire.
    results["attempts"].append(attempt)
    save(results)
    if attempt.get("label"):
        print(f"  {'MATCH' if matches(attempt) else 'MISS '} {attempt['label']} -> {attempt['verdict']}")
    else:
        print(f"  no label: {attempt['consensus']}")
    print(f"  {C.EXPLORER}/tx/{attempt['tx']}")


def validators_in(outcome: dict) -> dict:
    """How many validators voted and how many agreed, as the receipt lists them. A vote of "idle" was not in that committee."""
    receipt = outcome.get("receipt") or {}
    votes = (receipt.get("consensus_data") or {}).get("votes") or {}
    if not isinstance(votes, dict) or not votes:
        return {}
    cast = [str(v).lower() for v in votes.values() if str(v).lower() not in ("idle", "")]
    if not cast:
        return {}
    return {"voted": len(cast), "agreed": sum(1 for v in cast if v == "agree")}


def run(ids: list[str]) -> None:
    lock_data = json.loads(LOCK.read_text(encoding="utf-8"))
    if C.sha256_file(GOLDEN) != lock_data["sha256"]:
        raise SystemExit("eval/golden.json changed after it was locked; the golden set is not edited after the first run")
    golden = json.loads(GOLDEN.read_text(encoding="utf-8"))
    address = C.address()
    people = C.accounts(AUTHOR, JUDGE, *CHALLENGERS)
    author = C.Chain(people[AUTHOR])
    judge = C.Chain(people[JUDGE])
    reader = C.Chain()
    challengers = {name: C.Chain(people[name]) for name in CHALLENGERS}
    results = load_results()
    results.update(
        {
            "contract": address,
            "contract_sha256": C.deployment().get("fineprint_sha256"),
            "golden_sha256": lock_data["sha256"],
            "golden_locked_at": lock_data["locked_at"],
            "judge_sha256": judge_sha(),
            "network": C.NETWORK,
            "explorer": C.EXPLORER,
            "author": people[AUTHOR].address,
            "judge_account": people[JUDGE].address,
            "challengers": [people[name].address for name in CHALLENGERS],
        }
    )
    save(results)
    wanted = ids or [c["id"] for c in golden["cases"] if not c.get("held_out")]
    todo = [(i, c) for i, c in enumerate(golden["cases"]) if c["id"] in wanted and not finished(results, c["id"])]
    if todo:
        author.ensure(people[AUTHOR].address, minimum_gen=len(golden["summaries"]) * golden["bond_gen"] + 50, top_up_gen=1000)
        judge.ensure(people[JUDGE].address, minimum_gen=20)
        for name in CHALLENGERS:
            challengers[name].ensure(people[name].address, minimum_gen=20)
        prepare(golden, results, address, author)
    for index, case in todo:
        print(f"\n{case['id']} {case['title']} (expected {case['expected']})")
        run_case(case, index, results, address, challengers, judge, reader)
    report()


def report() -> None:
    results = load_results()
    golden = json.loads(GOLDEN.read_text(encoding="utf-8"))
    final: dict[str, dict] = {}
    for attempt in results["attempts"]:
        if attempt.get("label") in FINAL:
            final[attempt["case"]] = attempt

    def score(held: bool) -> tuple[int, int]:
        rows = [a for a in final.values() if a["held_out"] == held]
        return sum(1 for a in rows if matches(a)), len(rows)

    g_hit, g_n = score(False)
    h_hit, h_n = score(True)
    explorer = results.get("explorer", C.EXPLORER)
    contract = results.get("contract", "")
    lines = [
        "# Golden cases, through real consensus",
        "",
        f"Contract [`{contract}`]({explorer}/address/{contract}) on Studio Next (chain 61997). The document is registered once "
        "and two summaries carry the cases as claims, because a summary holds at most eight. Each row is one challenge: "
        "a challenger staked a tenth of the bond against that claim from their own account, and one `judge` transaction "
        "asked the validators. The label is read back from the contract with `get_challenge`, not from the script's memory. "
        "Cases are scored on the one label, the only thing validators compare.",
        "",
        f"- Golden set: **{g_hit} of {g_n}** matched.",
        f"- Held-out cases: **{h_n} run**, labels exactly as they came out (H1 to H3 have no expected answer, so any label counts as a run, and none is scored).",
        f"- `eval/golden.json` sha256 `{results.get('golden_sha256', '')}`, locked at {results.get('golden_locked_at', '')}, before the first run.",
        f"- Judge prompt sha256 `{results.get('judge_sha256', '')}`.",
        "",
        "Nothing here was tuned. The prompt is the spec's, word for word, and no case was edited after the lock.",
        "",
        "| Case | What it tests | Clause | Expected | Got | Verdict | Transaction |",
        "|---|---|---|---|---|---|---|",
    ]
    for case in golden["cases"]:
        cid = case["id"]
        a = final.get(cid)
        tag = f"{cid}{' (held out)' if case.get('held_out') else ''}"
        title = case["title"].replace("|", "/")
        clause = f"C{case['clause']}" + (f" against C{case['against']}" if case.get("against") else "")
        if not a:
            lines.append(f"| {tag} | {title} | {clause} | {case['expected']} | not run yet | | |")
            continue
        mark = "✓" if matches(a) and case["expected"] != "EITHER" else ("" if case["expected"] == "EITHER" else "✗ miss")
        tx = a["tx"]
        lines.append(f"| {tag} | {title} | {clause} | {case['expected']} | {a['label']} {mark} | {a['verdict']} | [{tx[:10]}…]({explorer}/tx/{tx}) |")
    lines += ["", "## The claims, word for word", ""]
    for case in golden["cases"]:
        lines.append(f"- {case['id']}: *\"{case['claim']}\"* against clause {case['clause']}")
    others = [a for a in results["attempts"] if a.get("label") not in FINAL]
    lines += ["", "## Every attempt", ""]
    if others:
        lines.append("Judge transactions whose round produced no label, each sent again as the next attempt:")
        lines.append("")
        for a in others:
            lines.append(f"- case {a['case']} attempt {a['attempt']}: {a['consensus'][:200]} ([tx]({explorer}/tx/{a['tx']}))")
    else:
        lines.append("Every judge produced a label on its first attempt; nothing was sent twice.")
    lines += ["", "## The document and the summaries", ""]
    doc = results.get("document", {})
    if doc.get("tx"):
        lines.append(f"- document `{doc['id']}` registered in [{doc['tx'][:10]}…]({explorer}/tx/{doc['tx']})")
    for key, s in sorted(results.get("summaries", {}).items()):
        lines.append(f"- summary {s['id']} ({key}: cases {', '.join(s['cases'])}) posted in [{s['tx'][:10]}…]({explorer}/tx/{s['tx']})")
    for case in golden["cases"]:
        row = results.get("cases", {}).get(case["id"])
        if not row or "challenge_tx" not in row:
            continue
        lines.append(f"- case {case['id']}: claim {row['claim_no']} of summary {row['summary_id']}, challenge {row['challenge_id']} staked in [{row['challenge_tx'][:10]}…]({explorer}/tx/{row['challenge_tx']})")
    lines.append("")
    REPORT.write_text("\n".join(lines), encoding="utf-8", newline="\n")
    print(f"\nwrote {REPORT.relative_to(C.ROOT).as_posix()}: golden {g_hit}/{g_n}, held out run {h_n}")


if __name__ == "__main__":
    if "--lock" in sys.argv:
        lock()
    elif "--report" in sys.argv:
        report()
    else:
        run([a for a in sys.argv[1:] if not a.startswith("--")])
