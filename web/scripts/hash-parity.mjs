// Holds web/lib/hash.mjs to tests/vectors.json, which scripts/gen_vectors.py
// writes from the contract's own doc_hash. Run: node web/scripts/hash-parity.mjs
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { docIdOf, docHash, normaliseBlock, normaliseLine, sha256Hex } from "../lib/hash.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const { vectors } = JSON.parse(readFileSync(join(root, "tests", "vectors.json"), "utf8"));

let failed = 0;
for (const v of vectors) {
  const title = normaliseLine(v.title);
  const clauses = v.clauses.map(normaliseBlock);
  const same =
    title === v.normalised_title &&
    JSON.stringify(clauses) === JSON.stringify(v.normalised_clauses) &&
    docHash(title, clauses) === v.id &&
    docIdOf(v.title, v.clauses) === v.id;
  if (!same) {
    failed++;
    console.log("MISMATCH", v.name, docIdOf(v.title, v.clauses), v.id);
  }
}

// The pure SHA-256 against Node's, on lengths around the block boundaries.
for (const n of [0, 1, 55, 56, 57, 63, 64, 65, 119, 120, 1000]) {
  const bytes = new Uint8Array(n).map((_, i) => (i * 31 + 7) & 255);
  if (sha256Hex(bytes) !== createHash("sha256").update(bytes).digest("hex")) {
    failed++;
    console.log("SHA-256 differs from node:crypto at length", n);
  }
}

console.log(failed === 0 ? `hash parity ok: ${vectors.length} vectors` : `hash parity FAILED: ${failed}`);
process.exit(failed === 0 ? 0 : 1);
