/**
 * Register a document, post a summary with a bond, challenge a claim and ask
 * the validators, with genlayer-js and a wallet.
 *
 *   node examples/quickstart.mjs <account name for the author> <account name for the challenger>
 *
 * In a browser the provider is window.ethereum and the account is the one the
 * wallet connected. Here a stand-in wallet signs for a local test account, so
 * the same code runs from a terminal. This file is the sample on the docs page
 * "Quickstart", copied in by scripts/gen_docs.py.
 */
import { createClient } from 'genlayer-js';
import { studioDevnet } from 'genlayer-js/chains';
import { parseEther } from 'viem';

import { standinWallet } from '../scripts/standin-wallet.mjs';

const FINEPRINT = '0xe6Aa698d3b3c5F6ED7722f15649B0ca85EA7d092';
const chain = { ...studioDevnet, id: 61997, rpcUrls: { default: { http: ['https://studio-next.genlayer.com/api'] } } };

const [authorName = 'docs_author', challengerName = 'docs_challenger'] = process.argv.slice(2);

function clientFor(name) {
  const { address, provider } = standinWallet(name); // browser: window.ethereum
  return createClient({ chain, account: address, provider });
}

/** One write: a fee deposit from the SDK's estimate, then the success test. */
async function write(client, functionName, args, { value = 0n, rotations = 1 } = {}) {
  const estimate = await client.estimateTransactionFees({
    leaderTimeunitsAllocation: 600,
    validatorTimeunitsAllocation: 600,
    totalMessageFees: 0,
    rotations: [rotations],
  });
  const hash = await client.writeContract({
    address: FINEPRINT,
    functionName,
    args,
    value,
    fees: { distribution: estimate.distribution, feeValue: estimate.feeValue },
  });
  const receipt = await client.waitForTransactionReceipt({ hash, waitUntil: 'decided', interval: 4000, retries: 120 });
  const leader = receipt.consensus_data.leader_receipt[0];
  // ACCEPTED is not success on its own: a refusal is accepted too. Check the result.
  if (leader.execution_result !== 'SUCCESS' || leader.result.status !== 'return') {
    throw new Error(`${functionName} refused: ${JSON.stringify(leader.result.payload)}`);
  }
  return { hash, returned: JSON.parse(leader.result.payload.readable) };
}

const author = clientFor(authorName);
const challenger = clientFor(challengerName);

// --- step: register
// 1. Register the terms as numbered clauses. The id is the sha256 of their text.
const stamp = new Date().toISOString().slice(0, 16);
const registered = await write(author, 'register_doc', [
  `Quickstart terms ${stamp}`,
  [
    'Hold at least 100 KILN at the Oct 1 snapshot. Wallets created after the snapshot are not eligible.',
    'The claim opens on Oct 15 and closes on Dec 15. Unclaimed tokens return to the treasury.',
    'Claimed tokens vest linearly over 12 months, with 25% available at the time of claim. Unvested tokens cannot be transferred.',
  ],
]);
const docId = registered.returned;

// --- step: post
// 2. Post three claims, each citing a clause, with a 10 GEN bond and a 24 hour window.
const claims = [
  { clause: 1, text: 'You need 100 KILN at the Oct 1 snapshot or later' },
  { clause: 2, text: 'The claim runs from Oct 15 to Dec 15' },
  { clause: 3, text: 'Tokens are fully unlocked at claim' },
];
const posted = await write(author, 'post_summary', [docId, JSON.stringify(claims), 24], { value: parseEther('10') });
const summaryId = Number(posted.returned);

// --- step: challenge
// 3. Stake a tenth of the bond (1 GEN) against claim 3, with a reason for readers.
const challenged = await write(challenger, 'challenge', [summaryId, 3, 0, 'Only a quarter is available at claim.'], { value: parseEther('1') });
const challengeId = Number(challenged.returned);

// --- step: judge
// 4. Anyone asks the validators. judge may rotate to a second committee, so it allows more rotations.
const judged = await write(challenger, 'judge', [challengeId], { rotations: 3 });

// --- step: read
// 5. Read the result back from the contract.
const view = JSON.parse(await challenger.readContract({ address: FINEPRINT, functionName: 'get_challenge', args: [challengeId] }));
console.log(JSON.stringify({ docId, summaryId, challengeId, label: view.label, verdict: view.verdict, toChallenger: view.to_challenger, judge: judged.hash }));
