/**
 * Read a summary and its claims. Reads need no wallet and no fee.
 *
 *   node examples/read-summary.mjs <summary id>
 *
 * This file is the sample on the docs pages "Challenge a claim" and "Summary
 * badges", copied in by scripts/gen_docs.py.
 */
import { createClient } from 'genlayer-js';
import { studioDevnet } from 'genlayer-js/chains';

const FINEPRINT = '0xe6Aa698d3b3c5F6ED7722f15649B0ca85EA7d092';
const chain = { ...studioDevnet, id: 61997, rpcUrls: { default: { http: ['https://studio-next.genlayer.com/api'] } } };

const client = createClient({ chain });
const [id = '1'] = process.argv.slice(2);
const s = JSON.parse(await client.readContract({ address: FINEPRINT, functionName: 'get_summary', args: [Number(id)] }));

if (!s.found) throw new Error('no such summary');
console.log(`#${s.id} ${s.doc_title}: ${s.state}, bond left ${Number(BigInt(s.bond_left) / 10n ** 15n) / 1000} of ${Number(BigInt(s.bond) / 10n ** 15n) / 1000} GEN`);
for (const claim of s.claim_rows) console.log(`  claim ${claim.no} (clause ${claim.clause}) ${claim.mark}: ${claim.text}`);
