#!/usr/bin/env python3
"""
Break every defence in the contract, one at a time, and name the test that notices.

    python scripts/mutate.py                          # run, print the table
    python scripts/mutate.py --table docs/MUTATIONS.md

A passing count is a claim; a table of mutations, each named with the test that
killed it, is evidence. Each mutant is a copy of contracts/fineprint.py with one
defence removed or weakened. The direct and static tests run against it through
FINEPRINT_CONTRACT, and the first failing test is recorded as the kill.

A kill is read from pytest's own report of which test failed, never from an
exit code alone: a runner that scores exit codes reports a perfect run while
testing nothing. The tests that compare the file with a generated copy or with
the deployed record are left out, because they fail for ANY edit and would kill
every mutant without testing its defence.

If anything escapes, the table is not written and the escapes are printed. An
escape means a missing test, or a defence strict enough elsewhere that this one
can no longer fail, and either is a finding.
"""

from __future__ import annotations

import os
import pathlib
import re
import subprocess
import sys
import tempfile

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ROOT = pathlib.Path(__file__).resolve().parent.parent
CONTRACT = ROOT / "contracts" / "fineprint.py"

#: (what the mutant does, text in the contract, what replaces it). Each text
#: must occur exactly once, so a mutant always changes exactly one place.
MUTANTS = [
    # who may write
    ("retract: anyone may retract", "        if s.author != gl.message.sender_address:\n            raise gl.vm.UserError(E + \"only the author of the summary may retract a claim\")", "        if False:\n            raise gl.vm.UserError(E + \"only the author of the summary may retract a claim\")"),
    ("retract: the author compared as case-sensitive text", "        if s.author != gl.message.sender_address:", "        if s.author.as_hex != gl.message.sender_address.as_hex.upper():"),
    ("register: the registrar is recorded as nobody", "            registrar=gl.message.sender_address,", "            registrar=Address('0x' + '0' * 40),"),
    ("post: the author is recorded as nobody", "            author=me,\n            claims=u32(len(parsed)),", "            author=Address('0x' + '0' * 40),\n            claims=u32(len(parsed)),"),
    ("challenge: the challenger is recorded as nobody", "            challenger=me,\n            stake=u256(stake),", "            challenger=Address('0x' + '0' * 40),\n            stake=u256(stake),"),
    ("decide: the caller of judge is not recorded", "        c.resolved_by = gl.message.sender_address\n", ""),
    ("close: the caller is not recorded", "        s.closed_by = gl.message.sender_address\n", ""),
    ("close: the bond goes to the caller, not the author", "        self._credit(s.author, amount)\n        return amount", "        self._credit(gl.message.sender_address, amount)\n        return amount"),
    ("withdraw: pays a fixed address", "        _Payee(me).emit_transfer(value=u256(amount))", "        _Payee(Address('0x' + '0' * 40)).emit_transfer(value=u256(amount))"),
    # registering
    ("register: a document can be registered twice", "        if doc_id in self.docs:\n            raise", "        if False:\n            raise"),
    ("register: the id ignores the title", "    for text in [title] + list(clauses):", "    for text in list(clauses):"),
    ("register: the id has no length prefixes", "        digest.update((str(len(raw)) + \":\").encode(\"utf-8\") + raw + b\"\\n\")", "        digest.update(raw + b\"\\n\")"),
    ("register: the text is not normalised before hashing", "        doc_id = doc_hash(clean_title, texts)", "        doc_id = doc_hash(str(title), [str(c) for c in clauses])"),
    ("register: two clauses are enough", "MIN_CLAUSES = 3", "MIN_CLAUSES = 2"),
    ("register: thirteen clauses are allowed", "MAX_CLAUSES = 12", "MAX_CLAUSES = 13"),
    ("register: a 501 character clause is allowed", "MAX_CLAUSE = 500", "MAX_CLAUSE = 501"),
    ("register: an 81 character title is allowed", "MAX_TITLE = 80", "MAX_TITLE = 81"),
    ("register: an empty clause is allowed", "    if text == \"\":\n        raise gl.vm.UserError(E + what + \" is empty\")\n    if len(text) > limit:\n        raise gl.vm.UserError(E + what + \" is longer than \" + str(limit) + \" characters\")\n    return text\n\n\ndef fence", "    if len(text) > limit:\n        raise gl.vm.UserError(E + what + \" is longer than \" + str(limit) + \" characters\")\n    return text\n\n\ndef fence"),
    # posting
    ("post: a bond under 10 GEN", "MIN_BOND = 10 * GEN", "MIN_BOND = 9 * GEN"),
    ("post: no bond check", "        if bond < MIN_BOND:", "        if False:"),
    ("post: a 23 hour window", "MIN_WINDOW = 24", "MIN_WINDOW = 23"),
    ("post: a 169 hour window", "MAX_WINDOW = 168", "MAX_WINDOW = 169"),
    ("post: two claims are enough", "MIN_CLAIMS = 3", "MIN_CLAIMS = 2"),
    ("post: nine claims are allowed", "MAX_CLAIMS = 8", "MAX_CLAIMS = 9"),
    ("post: a 201 character claim", "MAX_CLAIM = 200", "MAX_CLAIM = 201"),
    ("post: a claim may cite a clause the document does not have", "        if clause < 1 or clause > clause_count:", "        if clause < 1:"),
    ("post: a claim may cite clause zero", "        if clause < 1 or clause > clause_count:", "        if clause > clause_count:"),
    ("post: a boolean is a clause number", "    if isinstance(raw, bool) or not isinstance(raw, int):", "    if not isinstance(raw, int):"),
    ("post: an unknown document", "        if key not in self.docs:\n            raise gl.vm.UserError(E + \"unknown document\")", "        if False:\n            raise gl.vm.UserError(E + \"unknown document\")"),
    ("post: the window starts at zero", "            window_end=u64(now + hours * HOUR),", "            window_end=u64(hours * HOUR),"),
    ("post: the stake is a fifth of the bond", "STAKE_DIVISOR = 10", "STAKE_DIVISOR = 5"),
    ("post: the bond is not counted as received", "        self.received = u256(int(self.received) + bond)\n", ""),
    ("post: the bond is not counted as held", "        self.bonds_left = u256(int(self.bonds_left) + bond)\n        return sid", "        return sid"),
    ("post: the summary is not listed on its document", "        self.doc_summaries[key + \"#\" + str(n)] = u64(sid)\n", ""),
    # challenging
    ("challenge: any stake is accepted", "        if int(gl.message.value) != stake:", "        if False:"),
    ("challenge: a stake that is too small is accepted", "        if int(gl.message.value) != stake:", "        if int(gl.message.value) > stake:"),
    ("challenge: a stake that is too large is accepted", "        if int(gl.message.value) != stake:", "        if int(gl.message.value) < stake:"),
    ("challenge: open after the window", "        if now >= int(s.window_end):", "        if False:"),
    ("challenge: open on the last second after the window", "        if now >= int(s.window_end):", "        if now > int(s.window_end):"),
    ("challenge: a claim that does not exist", "        if number < 1 or number > int(s.claims):\n            raise gl.vm.UserError(E + \"this summary has no claim \" + str(number))\n        claim = self.claims[ckey]", "        if False:\n            raise gl.vm.UserError(E + \"this summary has no claim \" + str(number))\n        claim = self.claims[ckey]"),
    ("challenge: an upheld claim can be upheld again", "        if claim.mark == UPHELD or claim.mark == STRUCK:", "        if claim.mark == STRUCK:"),
    ("challenge: a struck claim can be challenged", "        if claim.mark == UPHELD or claim.mark == STRUCK:", "        if claim.mark == UPHELD:"),
    ("challenge: two open challenges on one claim", "        if int(claim.open_challenge) > 0:\n            raise gl.vm.UserError(E + \"this claim already has", "        if False:\n            raise gl.vm.UserError(E + \"this claim already has"),
    ("challenge: a clause the document does not have", "        if other < 0 or other > int(doc.clauses):", "        if other < 0:"),
    ("challenge: the cited clause named again is a second clause", "        if other == int(claim.clause):\n            other = 0\n", ""),
    ("challenge: no reason needed", '        text = _block(reason, "the reason", MAX_REASON)', "        text = str(reason)"),
    ("challenge: a 301 character reason", "MAX_REASON = 300", "MAX_REASON = 301"),
    ("challenge: the stake is not held", "        self.stakes_held = u256(int(self.stakes_held) + stake)\n        return cid", "        return cid"),
    ("challenge: the stake is not counted as received", "        self.received = u256(int(self.received) + stake)\n", ""),
    ("challenge: the claim is not marked as waiting", "        claim.open_challenge = u64(cid)\n", ""),
    ("challenge: the open count is not raised", "        s.open_challenges = u32(int(s.open_challenges) + 1)\n", ""),
    # judge
    ("judge: a challenge is read twice", "        if c.verdict != \"\":\n            raise gl.vm.UserError(E + \"this challenge was already read\")", "        if False:\n            raise gl.vm.UserError(E + \"this challenge was already read\")"),
    ("judge: validators agree with any answer", "        return mine[\"label\"] == theirs.get(\"label\")", "        return True"),
    ("judge: validators compare the whole answer", "        return mine[\"label\"] == theirs.get(\"label\")", "        return mine == theirs"),
    ("judge: an unreadable label defaults to FAITHFUL", "    if text not in LABELS:\n        raise gl.vm.UserError(L + \"bad label\")", "    if text not in LABELS:\n        return FAITHFUL"),
    ("judge: no retry on a formatting slip", "        if not error_text(first).startswith(L):\n            raise", "        raise"),
    ("judge: FAITHFUL is upheld", "    return REJECTED if label == FAITHFUL else UPHELD", "    return UPHELD"),
    ("judge: UNSUPPORTED is rejected", "    return REJECTED if label == FAITHFUL else UPHELD", "    return UPHELD if label == MISSTATES else REJECTED"),
    ("judge: past the deadline the model still runs", "        if now >= int(c.created_at) + JUDGE_HOURS * HOUR:", "        if False:"),
    ("judge: the deadline is 72 hours", "JUDGE_HOURS = 48", "JUDGE_HOURS = 72"),
    ("judge: a voided stake is not returned", "            # VOID: nothing was decided, so the stake simply returns.\n            c.to_challenger = u256(stake)\n            self._credit(c.challenger, stake)", "            c.to_challenger = u256(stake)"),
    ("judge: a voided stake goes to the author", "            self._credit(c.challenger, stake)\n\n    # -- registering", "            self._credit(s.author, stake)\n\n    # -- registering"),
    ("judge: a voided claim stays marked as waiting", "        claim.open_challenge = u64(0)\n        c.label = label", "        c.label = label"),
    # settling
    ("decide: UPHELD pays no bonus", "            bonus = self._pay_from_bond(s, UPHELD_PCT)", "            bonus = 0"),
    ("decide: UPHELD pays 30 percent", "UPHELD_PCT = 20", "UPHELD_PCT = 30"),
    ("decide: CORRECTED pays 20 percent", "CORRECTED_PCT = 10", "CORRECTED_PCT = 20"),
    ("decide: the bonus is not capped at what remains", "    bonus = min(int(s.bond) * pct // 100, int(s.bond_left))", "    bonus = int(s.bond) * pct // 100"),
    ("decide: the bonus is a share of what remains, not of the original bond", "    bonus = min(int(s.bond) * pct // 100, int(s.bond_left))", "    bonus = min(int(s.bond_left) * pct // 100, int(s.bond_left))"),
    ("decide: the bonus is not taken out of the bond", "        s.bond_left = u256(int(s.bond_left) - bonus)\n", ""),
    ("decide: the bonus is not taken out of the bonds held", "        self.bonds_left = u256(int(self.bonds_left) - bonus)\n", ""),
    ("decide: UPHELD does not return the stake", "            self._credit(c.challenger, stake + bonus)\n            claim.mark = UPHELD", "            self._credit(c.challenger, bonus)\n            claim.mark = UPHELD"),
    ("decide: UPHELD pays the author", "            self._credit(c.challenger, stake + bonus)\n            claim.mark = UPHELD", "            self._credit(s.author, stake + bonus)\n            claim.mark = UPHELD"),
    ("decide: UPHELD does not mark the claim", "            claim.mark = UPHELD\n", ""),
    ("decide: UPHELD is not counted", "            s.upheld = u32(int(s.upheld) + 1)\n", ""),
    ("decide: REJECTED pays the challenger", "            c.to_author = u256(stake)\n            self._credit(s.author, stake)", "            c.to_author = u256(stake)\n            self._credit(c.challenger, stake)"),
    ("decide: REJECTED pays nobody", "            self._credit(s.author, stake)\n            claim.mark = TESTED", "            claim.mark = TESTED"),
    ("decide: REJECTED does not mark the claim as tested", "            claim.mark = TESTED\n", ""),
    ("decide: the stake is still held after the verdict", "    self.stakes_held = u256(int(self.stakes_held) - int(c.stake))\n", "    pass\n"),
    ("decide: the open count is not lowered", "    s.open_challenges = u32(int(s.open_challenges) - 1)\n", ""),
    ("decide: the verdict is not recorded", "        c.verdict = verdict\n", ""),
    ("decide: the label is not recorded", "        c.label = label\n", ""),
    ("credit: the owed total is not raised", "        self.owed = u256(int(self.owed) + amount)\n", ""),
    ("credit: the earned total is not raised", "        self.earned[who] = u256(int(self.earned.get(who, u256(0))) + amount)\n", ""),
    # retract
    ("retract: a claim with no challenge", "        if cid <= 0:\n            raise gl.vm.UserError(E + \"this claim has no challenge waiting to be read\")", "        if False:\n            raise gl.vm.UserError(E + \"this claim has no challenge waiting to be read\")"),
    ("retract: a claim that does not exist", "        if number < 1 or number > int(s.claims):\n            raise gl.vm.UserError(E + \"this summary has no claim \" + str(number))\n        claim = self.claims[str(int(summary_id)) + \"#\" + str(number)]\n        cid", "        if False:\n            raise gl.vm.UserError(E + \"this summary has no claim \" + str(number))\n        claim = self.claims[str(int(summary_id)) + \"#\" + str(number)]\n        cid"),
    ("retract: the challenge is settled as UPHELD", "        self._decide(cid, s, c, claim, \"\", CORRECTED)", "        self._decide(cid, s, c, claim, \"\", UPHELD)"),
    ("retract: the challenge is settled as REJECTED", "        self._decide(cid, s, c, claim, \"\", CORRECTED)", "        self._decide(cid, s, c, claim, \"\", REJECTED)"),
    ("retract: the claim is not struck", "            claim.mark = STRUCK\n", ""),
    ("retract: the correction is not counted", "            s.corrected = u32(int(s.corrected) + 1)\n", ""),
    # closing
    ("close: before the window ends", "        if now < int(s.window_end):\n            raise gl.vm.UserError(E + \"the challenge window of this summary is still open\")", "        if False:\n            raise gl.vm.UserError(E + \"the challenge window of this summary is still open\")"),
    ("close: on the last second of the window", "        if now < int(s.window_end):\n            raise", "        if now <= int(s.window_end):\n            raise"),
    ("close: with a challenge still open", "        if int(s.open_challenges) > 0:\n            raise gl.vm.UserError(E + str(int(s.open_challenges)) + \" challenge(s)", "        if False:\n            raise gl.vm.UserError(E + str(int(s.open_challenges)) + \" challenge(s)"),
    ("close: twice", "        if s.state != OPEN:\n            raise gl.vm.UserError(E + \"this summary is already closed\")", "        if False:\n            raise gl.vm.UserError(E + \"this summary is already closed\")"),
    ("close: the summary does not stand", "        s.state = STANDS\n", ""),
    ("close: the bond is not emptied", "        s.bond_left = u256(0)\n        self.bonds_left", "        self.bonds_left"),
    ("close: the bonds held are not lowered", "        self.bonds_left = u256(int(self.bonds_left) - amount)\n        s.state", "        s.state"),
    ("close: the bond is not credited", "        self._credit(s.author, amount)\n        return amount", "        return amount"),
    # withdraw
    ("withdraw: the balance is not cleared", "        self.balances[me] = u256(0)\n", ""),
    ("withdraw: a zero balance still sends", "        if amount <= 0:\n            raise gl.vm.UserError(E + \"nothing to withdraw\")", "        if amount < 0:\n            raise gl.vm.UserError(E + \"nothing to withdraw\")"),
    ("withdraw: the owed total is not lowered", "        self.owed = u256(int(self.owed) - amount)\n", ""),
    ("withdraw: the paid total is not raised", "        self.paid = u256(int(self.paid) + amount)\n", ""),
    ("withdraw: the withdrawn total is not raised", "        self.withdrawn[me] = u256(int(self.withdrawn.get(me, u256(0))) + amount)\n", ""),
    # the prompt
    ("prompt: the fence lets delimiters through", 'return str(raw).replace("<", "(").replace(">", ")")', "return str(raw)"),
    ("prompt: the claim reaches the prompt unfenced", "        claim=fence(claim),", "        claim=claim,"),
    ("prompt: the clause reaches the prompt unfenced", "        cited=fence(cited),", "        cited=cited,"),
    ("prompt: the second clause reaches the prompt unfenced", "    return OTHER.format(other_no=int(other_no), other=fence(other_text))", "    return OTHER.format(other_no=int(other_no), other=other_text)"),
    ("prompt: a second clause that was not named is shown", "    if other_text == \"\":\n        return \"\"", "    if False:\n        return \"\""),
    ("prompt: the second clause is never shown", "        other=fence_other(other_no, other),\n        claim=fence(claim),", "        other=\"\",\n        claim=fence(claim),"),
    ("prompt: the reason is given to the judge", "        claim=fence(claim),\n    )", "        claim=fence(claim) + reason_for_the_judge,\n    )"),
    ("prompt: the wrong clause is cited", "        prompt = build_prompt(cited, self._clause_text(s.doc_id, cited), other_no, other, claim.text)", "        prompt = build_prompt(cited, self._clause_text(s.doc_id, 1), other_no, other, claim.text)"),
    # views
    ("view: a summary is found by its position, not its id", "        out = self._summary_json(int(summary_id), s)", "        out = self._summary_json(1, s)"),
    ("view: an unknown summary raises", "        if key not in self.summaries:\n            return json.dumps({\"found\": False, \"totals\": totals})\n        s = self.summaries[key]", "        s = self.summaries[key]"),
    ("view: the totals are missing", "            \"owed\": str(int(self.owed)),\n            \"paid\": str(int(self.paid)),\n        }\n\n    def _summary_json", "            \"paid\": str(int(self.paid)),\n        }\n\n    def _summary_json"),
]

EXCLUDED = [
    "tests/test_static.py::test_the_hash_vectors_are_what_the_contract_produces",
    "tests/test_static.py::test_the_browser_hash_matches_the_contracts_byte_for_byte",
    "tests/test_static.py::test_generated_files_are_what_the_generator_writes",
    "tests/test_static.py::test_the_site_reads_the_frozen_deployment",
    "tests/test_static.py::test_no_private_key_in_the_repository",
]


def first_failure(output: str) -> str | None:
    for line in output.splitlines():
        match = re.match(r"FAILED (\S+)", line.strip())
        if match:
            return match.group(1).split(" - ")[0]
    return None


def main() -> int:
    source = CONTRACT.read_text(encoding="utf-8")
    rows: list[tuple[int, str, str]] = []
    escapes: list[str] = []
    with tempfile.TemporaryDirectory() as folder:
        mutant = pathlib.Path(folder) / "fineprint.py"
        for index, (what, old, new) in enumerate(MUTANTS, 1):
            count = source.count(old)
            if count != 1:
                raise SystemExit(f"mutant {index} ({what}) matches {count} places; it must match exactly one")
            mutant.write_text(source.replace(old, new), encoding="utf-8", newline="\n")
            env = dict(os.environ, FINEPRINT_CONTRACT=str(mutant))
            command = [
                sys.executable, "-m", "pytest", "tests/test_direct.py", "tests/test_static.py",
                "-x", "-q", "--tb=no", "-rf", "-p", "no:cacheprovider",
            ] + [arg for test in EXCLUDED for arg in ("--deselect", test)]
            result = subprocess.run(command, cwd=ROOT, env=env, capture_output=True, text=True, encoding="utf-8")
            killer = first_failure(result.stdout)
            if result.returncode == 0 or killer is None:
                escapes.append(what)
                print(f"  {index:3} ESCAPED  {what}")
            else:
                rows.append((index, what, killer))
                print(f"  {index:3} killed   {what}  <- {killer}")
    if escapes:
        print(f"\n{len(escapes)} mutant(s) escaped; no table written:")
        for what in escapes:
            print(f"  - {what}")
        return 1
    if "--table" in sys.argv:
        target = ROOT / sys.argv[sys.argv.index("--table") + 1]
        lines = [
            "# Mutations",
            "",
            f"Written by `python scripts/mutate.py --table docs/MUTATIONS.md`. {len(rows)} defences in",
            "`contracts/fineprint.py` were each broken on their own, and every mutant was caught. Each row",
            "names the first test that failed against it, read from pytest's report rather than an exit code.",
            "The generated-copy and deployed-record tests are excluded, because they fail for any edit at all.",
            "",
            "| # | defence broken | caught by |",
            "|---|---|---|",
        ] + [f"| {i} | {what} | `{killer}` |" for i, what, killer in rows]
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text("\n".join(lines) + "\n", encoding="utf-8", newline="\n")
        print(f"\nwrote {target.relative_to(ROOT).as_posix()}")
    print(f"\n{len(rows)} of {len(MUTANTS)} killed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
