"""
Count the characters of the portal fields and the X post, exactly as they will be pasted.

    python submission/count.py
"""

import pathlib
import sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
HERE = pathlib.Path(__file__).resolve().parent
LIMITS = {"Project name": None, "One-liner": 100, "Description": 1000, "Steward note": 500}


def sections(text: str, level: str) -> dict:
    out = {}
    name = None
    for line in text.split("\n"):
        if line.startswith(level + " "):
            name = line[len(level) + 1 :].strip()
            out[name] = []
        elif line.startswith("#"):
            if len(line) - len(line.lstrip("#")) <= len(level):
                name = None
            elif name:
                out[name].append(line)
        elif name:
            out[name].append(line)
    return {k: "\n".join(v).strip() for k, v in out.items()}


text = (HERE / "portal.md").read_text(encoding="utf-8")
portal = sections(text, "##")
failed = False
for name, limit in LIMITS.items():
    n = len(portal[name])
    ok = limit is None or n <= limit
    failed |= not ok
    print(f"{name}: {n} characters" + (f" (limit {limit})" if limit else "") + ("" if ok else "  OVER"))
steps = sections(portal["Write the exact path"], "###")
for title, body in steps.items():
    print(f"step {title}: instruction {len(body)} characters")
proof = sections(portal["Prove the path works"], "###")
print(f"expected verification outcome: {len(proof['Expected verification outcome'])} characters")
post = (HERE / "x-post.md").read_text(encoding="utf-8").split("\n", 2)[2].strip()
print(f"X post: {len(post)} characters (limit 280)")
failed |= len(post) > 280
raise SystemExit(1 if failed else 0)
