"""
Read a summary's claims, marks and bond from Python, with genlayer-py 0.19.0rc2.

    python web/examples/read_summary.py <summary id>

genlayer-py reads through an account even for views, so a throwaway one is
made here; it is never funded and never signs. This file is the Python sample
on the docs page "Challenge a claim", copied in by scripts/gen_docs.py.
"""

import json
import sys

from genlayer_py import create_account, create_client
from genlayer_py.chains import studio_devnet

FINEPRINT = "0xe6Aa698d3b3c5F6ED7722f15649B0ca85EA7d092"
studio_devnet.rpc_urls = {"default": {"http": ["https://studio-next.genlayer.com/api"]}}

reader = create_account()
client = create_client(chain=studio_devnet, account=reader)
summary_id = int(sys.argv[1] if len(sys.argv) > 1 else 1)
s = json.loads(client.read_contract(address=FINEPRINT, function_name="get_summary", args=[summary_id], account=reader))

if not s["found"]:
    raise SystemExit("no such summary")
print(json.dumps({
    "document": s["doc_title"],
    "state": s["state"],
    "bond_gen": int(s["bond"]) / 10**18,
    "bond_left_gen": int(s["bond_left"]) / 10**18,
    "claims": [f'{row["no"]} (clause {row["clause"]}): {row["mark"]}' for row in s["claim_rows"]],
}, ensure_ascii=False))
