"""
Loads the REAL contract file against the doubles in genvm_double.py.

Nothing is copied or re-implemented here, so a change to contracts/fineprint.py
is a change to what these tests exercise. The runner comment on the first lines
of the contract is ignored by CPython, so the file imports as ordinary Python.
"""

from __future__ import annotations

import datetime
import importlib.util
import json
import os
import pathlib
import sys
import types

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent
#: FINEPRINT_CONTRACT points the suite at a mutant; scripts/mutate.py sets it.
CONTRACT = pathlib.Path(os.environ.get("FINEPRINT_CONTRACT") or ROOT / "contracts" / "fineprint.py")

sys.path.insert(0, str(HERE))

import genvm_double as D  # noqa: E402

GEN = 10**18
HOUR = 3600
BOND = 20 * GEN
STAKE = 2 * GEN

#: 2026-11-01T00:00:00Z. Every world starts here.
T0 = 1793491200


def _install(gl: D.GL) -> None:
    """
    Publish a `genlayer` package shaped like the Studio Next runner pinned in contracts/fineprint.py:
    the star import brings Address and the integer types, `import genlayer as gl`
    is the package itself, and the storage names live in genlayer.storage. An
    import the contract left out fails here rather than on chain.
    """
    storage = types.ModuleType("genlayer.storage")
    storage.TreeMap = D.TreeMap
    storage.DynArray = D.DynArray
    storage.allow = D.allow_storage
    module = types.ModuleType("genlayer")
    module.Address = D.Address
    for name in ("u8", "u16", "u32", "u64", "u256"):
        setattr(module, name, getattr(D, name))
    for name in ("contract", "vm", "message", "public", "nondet", "evm"):
        setattr(module, name, getattr(gl, name))
    module.storage = storage
    module.__all__ = ["Address", "u8", "u16", "u32", "u64", "u256"]
    sys.modules["genlayer"] = module
    sys.modules["genlayer.storage"] = storage


def load(gl: D.GL, path: pathlib.Path | None = None, name: str = "fineprint_contract") -> types.ModuleType:
    """Import the contract fresh against this gl."""
    _install(gl)
    spec = importlib.util.spec_from_file_location(name, path or CONTRACT)
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def answer(label: str) -> str:
    """A model answer, as the model would type it."""
    return json.dumps({"label": label})


TITLE = "Kiln airdrop terms"
CLAUSES = [
    "Hold at least 100 KILN at the Oct 1 snapshot. Wallets created after the snapshot are not eligible.",
    "Each eligible wallet receives a share of the pool in proportion to its balance at the snapshot.",
    "The claim opens on Oct 15 and closes on Dec 15. Unclaimed tokens return to the treasury.",
    "Claimed tokens vest linearly over 12 months, with 25% available at the time of claim. Unvested tokens cannot be transferred.",
    "Claiming requires a wallet that has passed the verification step described in the claim portal.",
    "Kiln may change or end the program at any time without notice.",
]
CLAIMS = [
    {"clause": 1, "text": "Hold 100 KILN at the Oct 1 snapshot"},
    {"clause": 1, "text": "Wallets made after Oct 1 do not count"},
    {"clause": 4, "text": "Tokens are fully unlocked at claim."},
    {"clause": 6, "text": "Kiln may end the program at any time"},
]


class World:
    """
    One Fineprint contract and the accounts around it.

    Time is explicit: `at(seconds)` sets the transaction datetime the contract
    reads, because nothing on chain moves the clock on its own and the window
    is one of the things these tests most need to control.
    """

    AUTHOR = "0x" + "3e" * 20
    CHALLENGER = "0x" + "41" * 20
    OTHER = "0x" + "a2" * 20
    THIRD = "0x" + "a3" * 20
    STRANGER = "0x" + "d4" * 20

    def __init__(self) -> None:
        self.gl = D.GL()
        self.mod = load(self.gl)
        self.at(T0)
        self.sender(self.AUTHOR)
        self.c = self.mod.Fineprint()
        self.doc_id = ""

    # -- controls ----------------------------------------------------------

    def at(self, seconds: int) -> "World":
        self.t = int(seconds)
        stamp = datetime.datetime.fromtimestamp(self.t, datetime.timezone.utc)
        self.gl.message.raw["datetime"] = stamp.strftime("%Y-%m-%dT%H:%M:%SZ")
        return self

    def advance(self, seconds: int) -> "World":
        return self.at(self.t + seconds)

    def sender(self, address: str, value: int = 0) -> "World":
        self.gl.message.sender_address = D.Address(address)
        self.gl.message.origin_address = D.Address(address)
        self.gl.message.value = int(value)
        return self

    @property
    def leader(self) -> D.NodeWorld:
        return self.gl.nondet.leader

    @property
    def validators(self) -> list[D.NodeWorld]:
        return self.gl.nondet.validators

    # -- shorthands --------------------------------------------------------

    def register(self, title=TITLE, clauses=None, who=None) -> str:
        self.sender(who or self.AUTHOR)
        self.doc_id = str(self.c.register_doc(title, list(clauses if clauses is not None else CLAUSES)))
        return self.doc_id

    def post(self, claims=None, hours: int = 72, bond: int = BOND, who=None, doc_id=None) -> int:
        self.sender(who or self.AUTHOR, bond)
        try:
            payload = claims if isinstance(claims, str) else json.dumps(claims if claims is not None else CLAIMS)
            return int(self.c.post_summary(doc_id or self.doc_id, payload, hours))
        finally:
            self.sender(who or self.AUTHOR)

    def setup(self, claims=None, hours: int = 72, bond: int = BOND) -> int:
        """A registered document and one summary on it. Returns the summary id."""
        self.register()
        return self.post(claims, hours, bond)

    def challenge(self, sid: int = 1, claim_no: int = 3, against: int = 0, reason="Only a quarter is available at claim.",
                  who=None, value=None) -> int:
        stake = int(json.loads(self.c.get_summary(sid)).get("stake", 0)) if value is None else int(value)
        self.sender(who or self.CHALLENGER, stake)
        try:
            return int(self.c.challenge(sid, claim_no, against, reason))
        finally:
            self.sender(who or self.CHALLENGER)

    def queue(self, label: str, validator_label=None) -> None:
        """One model answer for the leader and one for each validator."""
        self.leader.answers.append(answer(label))
        for world in self.validators:
            world.answers.append(answer(validator_label or label))

    def judge(self, cid: int, label: str | None = "MISSTATES", who=None, validator_label=None) -> str:
        if label is not None:
            self.queue(label, validator_label)
        self.sender(who or self.STRANGER)
        return str(self.c.judge(cid))

    def retract(self, sid: int, claim_no: int, who=None) -> int:
        self.sender(who or self.AUTHOR)
        return int(self.c.retract(sid, claim_no))

    def close(self, sid: int = 1, who=None) -> int:
        self.sender(who or self.STRANGER)
        return int(self.c.close_summary(sid))

    def withdraw(self, who: str) -> int:
        self.sender(who)
        return int(self.c.withdraw())

    # -- reads -------------------------------------------------------------

    def doc(self, key=None) -> dict:
        return json.loads(self.c.get_doc(self.doc_id if key is None else key))

    def summary(self, sid: int = 1) -> dict:
        return json.loads(self.c.get_summary(sid))

    def chal(self, cid: int = 1) -> dict:
        return json.loads(self.c.get_challenge(cid))

    def account(self, address: str) -> dict:
        return json.loads(self.c.get_doc(address))

    def totals(self) -> dict:
        return json.loads(self.c.get_doc(""))["totals"]

    def paid_to(self, address: str) -> int:
        return sum(t.value for t in self.gl.bus.transfers if t.to.lower() == address.lower())

    def paid_out(self) -> int:
        return sum(t.value for t in self.gl.bus.transfers)

    def balance_of(self, address: str) -> int:
        return int(self.account(address)["balance"])


def refused(prefix: str, fn, *args, **kwargs) -> str:
    """Assert the call is refused, and that the refusal is the sentence it should be."""
    try:
        fn(*args, **kwargs)
    except D.UserError as error:
        message = str(error)
        assert message.startswith("[EXPECTED] "), f"unprefixed refusal: {message}"
        assert prefix in message, f"expected {prefix!r}, got {message!r}"
        return message
    raise AssertionError(f"expected a refusal containing {prefix!r}, nothing was raised")
