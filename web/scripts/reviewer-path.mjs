/**
 * The reviewer's path, run from FRESH accounts through the site's own code.
 *
 *   node scripts/reviewer-path.mjs [site url]
 *
 * Two accounts are made for this run only. Each is funded by the site's own
 * faucet route (POST /api/faucet), then every write goes through
 * lib/genlayer-core.mjs with a stand-in EIP-1193 wallet, the same code the
 * browser runs:
 *
 *   author:      faucet, register a document, post a summary with a bond
 *   challenger:  faucet, stake on claim 3, ask the validators, read the result
 *   author:      retract is exercised on a second challenge
 *   challenger:  withdraw, then compare the wallet with what the contract owed, to the wei, after finality
 *
 * It also fetches every page of the site at that URL and checks it answers 200
 * and shows what the chain says. Prints one JSON record to stdout and writes
 * docs/reviewer-path.studio-next.json. Exits 1 on the first step that does not succeed.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseEther } from 'viem';

import { CONTRACT, outcomeOf, readClient, retried, submit, waitDecided, waitFinal, walletClient } from '../lib/genlayer-core.mjs';
import { docIdOf } from '../lib/hash.mjs';
import { balanceOf, ensureAccount, standinWallet } from './standin-wallet.mjs';

const SITE = (process.argv[2] ?? 'http://localhost:3211').replace(/\/$/, '');
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, '..', '..', 'docs', 'reviewer-path.studio-next.json');
const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12);
const AUTHOR = `reviewer_author_${stamp}`;
const CHALLENGER = `reviewer_challenger_${stamp}`;

const record = { site: SITE, contract: CONTRACT, started: new Date().toISOString(), steps: [] };
const reader = readClient();

function say(step, detail = {}) {
  record.steps.push({ step, ...detail });
  console.error(`  ${step}`, JSON.stringify(detail, (k, v) => (typeof v === 'bigint' ? v.toString() : v)).slice(0, 220));
}

async function fail(step, why) {
  record.failed = { step, why };
  fs.writeFileSync(OUT, JSON.stringify(record, null, 2));
  console.error(`FAILED at ${step}: ${why}`);
  process.exit(1);
}

const sent = {};

async function write(name, method, args, value = 0n) {
  const { address, provider } = standinWallet(name);
  const client = walletClient(address, provider);
  const hash = await submit(client, { method, args, value, sender: address });
  (sent[name] ??= []).push({ hash, client });
  const receipt = await waitDecided(client, hash, method);
  const outcome = outcomeOf(receipt);
  if (!outcome.ok) await fail(method, outcome.refusal || `${outcome.status} ${outcome.execution}`);
  return { hash, outcome, client };
}

const view = async (method, args) => JSON.parse(await retried(() => reader.readContract({ address: CONTRACT, functionName: method, args }), 4));

// -- accounts and the site's faucet ----------------------------------------------------
const authorAddr = ensureAccount(AUTHOR);
const challengerAddr = ensureAccount(CHALLENGER);
for (const [name, address] of [[AUTHOR, authorAddr], [CHALLENGER, challengerAddr]]) {
  const before = await balanceOf(address);
  const response = await fetch(`${SITE}/api/faucet`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ address: address.toLowerCase() }) });
  const body = await response.json();
  if (!response.ok) await fail('faucet', `${name}: ${body.error}`);
  const after = await balanceOf(address);
  if (after <= before) await fail('faucet', `${name}: the balance did not move`);
  say('faucet', { account: name, address, from: before.toString(), to: after.toString(), note: 'a lowercase address, checksummed by the route' });
}

// -- the author: a document and a summary ----------------------------------------------
const title = `Reviewer path terms ${stamp}`;
const clauses = [
  'Hold at least 100 KILN at the Oct 1 snapshot. Wallets created after the snapshot are not eligible.',
  'The claim opens on Oct 15 and closes on Dec 15. Unclaimed tokens return to the treasury.',
  'Claimed tokens vest linearly over 12 months, with 25% available at the time of claim. Unvested tokens cannot be transferred.',
  'Kiln may change or end the program at any time without notice.',
];
const expectedId = docIdOf(title, clauses);
const registered = await write(AUTHOR, 'register_doc', [title, clauses]);
if (registered.outcome.returned !== expectedId) await fail('register_doc', `the contract returned ${registered.outcome.returned}, the browser code computed ${expectedId}`);
say('register_doc', { id: expectedId, hash: registered.hash, note: 'the id computed by the site code is the id the contract returned' });

const claims = [
  { clause: 1, text: 'You need 100 KILN at the Oct 1 snapshot' },
  { clause: 2, text: 'The claim runs from Oct 15 to Dec 15' },
  { clause: 3, text: 'Tokens are fully unlocked at claim.' },
  { clause: 4, text: 'Kiln may change or end the program at any time' },
];
const posted = await write(AUTHOR, 'post_summary', [expectedId, JSON.stringify(claims), 24], parseEther('10'));
const summaryId = Number(posted.outcome.returned);
const s0 = await view('get_summary', [summaryId]);
if (s0.bond !== parseEther('10').toString() || s0.stake !== parseEther('1').toString()) await fail('post_summary', 'the bond or the stake is not what was sent');
say('post_summary', { summaryId, hash: posted.hash, bond: s0.bond, stake: s0.stake });

// -- the challenger: stake, read, check the books ----------------------------------------------
const bondsBefore = BigInt((await view('get_doc', [''])).totals.received);
const challenged = await write(CHALLENGER, 'challenge', [summaryId, 3, 0, 'Only a quarter is available at claim.'], parseEther('1'));
const challengeId = Number(challenged.outcome.returned);
say('challenge', { challengeId, hash: challenged.hash });

const judged = await write(CHALLENGER, 'judge', [challengeId]);
const c1 = await view('get_challenge', [challengeId]);
if (!c1.label || !c1.verdict) await fail('judge', 'no label was stored');
say('judge', { challengeId, hash: judged.hash, label: c1.label, verdict: c1.verdict, to_challenger: c1.to_challenger });

// -- a second challenge, retracted by the author -------------------------------------------------
const second = await write(CHALLENGER, 'challenge', [summaryId, 4, 0, 'Checking the notice rule.'], parseEther('1'));
const secondId = Number(second.outcome.returned);
const retracted = await write(AUTHOR, 'retract', [summaryId, 4]);
const c2 = await view('get_challenge', [secondId]);
if (c2.verdict !== 'CORRECTED') await fail('retract', `expected CORRECTED, got ${c2.verdict}`);
say('retract', { challengeId: secondId, hash: retracted.hash, verdict: c2.verdict, to_challenger: c2.to_challenger });

// -- the books, then the payout to the wei ---------------------------------------------------------
const totals = (await view('get_doc', [''])).totals;
const sum = BigInt(totals.bonds_left) + BigInt(totals.stakes_held) + BigInt(totals.owed) + BigInt(totals.paid);
if (BigInt(totals.received) !== sum) await fail('books', `received ${totals.received} is not ${sum}`);
say('books', { received: totals.received, bonds_left: totals.bonds_left, stakes_held: totals.stakes_held, owed: totals.owed, paid: totals.paid, note: 'received = bonds_left + stakes_held + owed + paid' });

const account = await view('get_doc', [challengerAddr.toLowerCase()]);
const owed = BigInt(account.balance);
const expectedOwed = BigInt(c1.to_challenger) + BigInt(c2.to_challenger);
if (owed !== expectedOwed) await fail('balance', `the contract owes ${owed}, the two verdicts credit ${expectedOwed}`);
// Fee deposits are refunded at finality, so every earlier transaction of this account is final before the baseline is taken.
for (const { hash, client } of sent[CHALLENGER]) await waitFinal(client, hash);
const walletBefore = await balanceOf(challengerAddr);
const withdrawn = await write(CHALLENGER, 'withdraw', [], 0n);
const final = await waitFinal(withdrawn.client, withdrawn.hash);
const walletAfter = await balanceOf(challengerAddr);
const gained = walletAfter - walletBefore;
say('withdraw', {
  hash: withdrawn.hash,
  owed: owed.toString(),
  wallet_before: walletBefore.toString(),
  wallet_after_finality: walletAfter.toString(),
  gained: gained.toString(),
  fee_and_gas_difference: (owed - gained).toString(),
  final_status: outcomeOf(final).status,
  note: 'the wallet gains what was owed, less the fee of the withdraw transaction',
});
// The wallet gains what was owed less what the withdraw transaction itself consumed. It can never gain more.
if (gained <= 0n || gained > owed) await fail('withdraw', `the wallet moved by ${gained}, which is not within what was owed (${owed})`);
const after = await view('get_doc', [challengerAddr.toLowerCase()]);
if (after.balance !== '0') await fail('withdraw', 'the balance was not cleared');

// -- the pages -----------------------------------------------------------------------------------------
const pages = ['/', '/documents', '/summaries', '/new', '/me', `/d/${expectedId}`, `/s/${summaryId}`, `/c/${challengeId}`, `/c/${secondId}`, '/docs', '/docs/quickstart', '/docs/reference/contract', '/docs/more/evaluation', '/llms.txt'];
const seen = {};
for (const page of pages) {
  const response = await fetch(SITE + page, { redirect: 'follow' });
  seen[page] = response.status;
  if (response.status !== 200) await fail('pages', `${page} answered ${response.status}`);
}
const text = await (await fetch(`${SITE}/c/${challengeId}`)).text();
if (!text.includes(c1.label) || !text.includes(c1.verdict)) await fail('pages', `/c/${challengeId} does not show ${c1.label} and ${c1.verdict}`);
say('pages', { checked: Object.keys(seen).length, all: 200, challenge_page_shows: `${c1.label} → ${c1.verdict}` });

record.finished = new Date().toISOString();
fs.writeFileSync(OUT, JSON.stringify(record, null, 2));
console.log(JSON.stringify({ ok: true, summaryId, challengeId, label: c1.label, verdict: c1.verdict, steps: record.steps.length }));
