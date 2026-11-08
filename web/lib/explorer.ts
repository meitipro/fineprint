import { abi } from 'genlayer-js';
import { unstable_cache } from 'next/cache';

import { CONTRACT, EXPLORER } from './genlayer-core.mjs';

/**
 * The transactions behind documents, summaries and challenges, read from the
 * Studio Next explorer's API. The contract cannot know its own transaction
 * hashes, so the site finds them here: the register_doc whose returned id is
 * the document, the post_summary whose returned id is the summary, the
 * challenge whose returned id is the challenge, and the judge whose argument is
 * the challenge.
 *
 * Only decided, successful transactions count. A refused write is on the
 * explorer too, and it changed nothing.
 */

export type Votes = { agreed: number; voted: number; seconds: number };

export type ContractTx = { method: string; hash: string; from: string; created: string; args: string[]; returned?: string; votes?: Votes };

export type TxIndex = {
  /** document id -> its register_doc transaction */
  doc: Record<string, ContractTx>;
  /** summary id -> its post_summary transaction */
  summary: Record<string, ContractTx>;
  /** challenge id -> the challenge transaction */
  challenge: Record<string, ContractTx>;
  /** challenge id -> the judge transaction that read it */
  judge: Record<string, ContractTx>;
  /** summary id -> retract and close_summary transactions on it */
  summaryWrites: Record<string, ContractTx[]>;
  /** lower-case address -> withdraw transactions */
  withdraw: Record<string, ContractTx[]>;
};

/* eslint-disable @typescript-eslint/no-explicit-any */

function decode(b64: string): { method: string; args: unknown[] } | null {
  try {
    const bytes = Uint8Array.from(Buffer.from(b64, 'base64'));
    const out = abi.calldata.decode(bytes) as any;
    if (!(out instanceof Map)) return null;
    return { method: String(out.get('') ?? ''), args: (out.get('args') as unknown[]) ?? [] };
  } catch {
    return null;
  }
}

function leaderOf(tx: any): any {
  const rounds = tx?.consensus_data?.leader_receipt;
  if (Array.isArray(rounds)) return rounds.find((r: any) => String(r?.mode ?? '').toLowerCase() === 'leader') ?? rounds[0];
  return rounds;
}

/**
 * The explorer stores the leader's result as base64: one status byte (0 means
 * the method returned) and then the returned value, calldata-encoded.
 */
function succeeded(tx: any): { ok: boolean; returned?: string } {
  const status = String(tx?.status ?? '').toUpperCase();
  if (status !== 'ACCEPTED' && status !== 'FINALIZED') return { ok: false };
  const leader = leaderOf(tx);
  if (String(leader?.execution_result ?? '').toUpperCase() !== 'SUCCESS') return { ok: false };
  const result = leader?.result;
  if (typeof result === 'string') {
    try {
      const bytes = Uint8Array.from(Buffer.from(result, 'base64'));
      if (bytes[0] !== 0) return { ok: false };
      const value = abi.calldata.decode(bytes.subarray(1)) as unknown;
      return { ok: true, returned: typeof value === 'bigint' || typeof value === 'number' || typeof value === 'string' ? String(value) : undefined };
    } catch {
      return { ok: false };
    }
  }
  const ok = String(result?.status ?? '').toLowerCase() === 'return';
  const readable = result?.payload?.readable ?? result?.payload;
  return { ok, returned: typeof readable === 'string' ? readable.replace(/^"|"$/g, '') : undefined };
}

/**
 * How many validators voted and how many agreed, and how long the round took,
 * from the explorer's own record of the transaction. A validator whose vote is
 * "idle" was not part of that committee. Nothing here is estimated: a
 * transaction that lists no votes has no figure.
 */
function votesOf(tx: any): Votes | undefined {
  const votes = tx?.consensus_data?.votes;
  if (!votes || typeof votes !== 'object') return undefined;
  const cast = Object.values(votes).map((v) => String(v).toLowerCase()).filter((v) => v !== 'idle' && v !== '');
  if (cast.length === 0) return undefined;
  const started = Date.parse(String(tx?.created_at ?? '')) / 1000;
  const ended = Number(tx?.last_vote_timestamp ?? 0);
  const seconds = Number.isFinite(started) && ended > started ? Math.round(ended - started) : 0;
  return { agreed: cast.filter((v) => v === 'agree').length, voted: cast.length, seconds };
}

const EMPTY: TxIndex = { doc: {}, summary: {}, challenge: {}, judge: {}, summaryWrites: {}, withdraw: {} };

async function scan(): Promise<TxIndex> {
  const index: TxIndex = { doc: {}, summary: {}, challenge: {}, judge: {}, summaryWrites: {}, withdraw: {} };
  for (let page = 1; page <= 40; page++) {
    const url = `${EXPLORER}/api/transactions?address=${CONTRACT}&limit=100&page=${page}`;
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`explorer answered ${response.status}`);
    const body = await response.json();
    for (const tx of body.transactions ?? []) {
      const call = tx?.data?.calldata ? decode(tx.data.calldata) : null;
      if (!call) continue;
      const done = succeeded(tx);
      if (!done.ok) continue;
      const row: ContractTx = {
        method: call.method,
        hash: tx.hash,
        from: String(tx.from_address ?? ''),
        created: String(tx.created_at ?? ''),
        args: call.args.map((a) => (typeof a === 'bigint' || typeof a === 'number' || typeof a === 'string' ? String(a) : '')),
        returned: done.returned,
        votes: call.method === 'judge' ? votesOf(tx) : undefined,
      };
      const ret = done.returned ?? '';
      const num = /^\d+$/.test(ret) ? ret : '';
      if (call.method === 'register_doc' && /^[0-9a-f]{64}$/.test(ret)) index.doc[ret] ??= row;
      else if (call.method === 'post_summary' && num) index.summary[num] ??= row;
      else if (call.method === 'challenge' && num) index.challenge[num] ??= row;
      else if (call.method === 'judge' && row.args[0]) index.judge[row.args[0]] ??= row;
      else if ((call.method === 'retract' || call.method === 'close_summary') && row.args[0]) (index.summaryWrites[row.args[0]] ??= []).push(row);
      else if (call.method === 'withdraw') (index.withdraw[row.from.toLowerCase()] ??= []).push(row);
    }
    const pages = Number(body?.pagination?.totalPages ?? 1);
    if (page >= pages) break;
  }
  return index;
}

const cachedScan = unstable_cache(scan, ['explorer-scan', CONTRACT], { revalidate: 60, tags: ['txs'] });

/** The transaction index, or an empty one when the explorer does not answer: links are a convenience, never a dependency. */
export async function txIndex(): Promise<TxIndex> {
  try {
    return await cachedScan();
  } catch {
    return EMPTY;
  }
}
