import { unstable_cache } from 'next/cache';

import { CONTRACT, readClient, retried } from './genlayer-core.mjs';
import type { Account, Challenge, Doc, NotFound, Summary, SummaryRow, Totals } from './types';

/**
 * Reads happen on the server, cached for a short while under tags.
 *
 * Studio Next rate-limits each IP at about thirty requests a minute, and every
 * visitor's page view would otherwise spend the server's budget. Shared reads
 * are cached for 20 seconds; after a decided write the page POSTs
 * /api/refresh, which expires the tags it touched, so the person who wrote
 * sees their own result at once.
 */

const client = readClient();
const REVALIDATE = 20;

async function view<T>(method: string, args: (number | string)[]): Promise<T> {
  const raw = await retried(() => client.readContract({ address: CONTRACT, functionName: method, args }), 3);
  return JSON.parse(String(raw)) as T;
}

export const tags = {
  all: 'chain',
  totals: 'totals',
  doc: (id: string) => `doc:${id}`,
  summary: (id: number) => `summary:${id}`,
  challenge: (id: number) => `challenge:${id}`,
  account: (address: string) => `account:${address.toLowerCase()}`,
};

export function getTotals(): Promise<Totals> {
  return unstable_cache(async () => (await view<NotFound>('get_doc', [''])).totals, ['totals'], {
    revalidate: REVALIDATE,
    tags: [tags.all, tags.totals],
  })();
}

/** A document by its id (64 hex characters) or by its number in the order registered. */
export function getDoc(key: string): Promise<Doc | NotFound> {
  return unstable_cache(() => view<Doc | NotFound>('get_doc', [key]), ['get_doc', key.toLowerCase()], {
    revalidate: REVALIDATE,
    tags: [tags.all, tags.totals, tags.doc(key.toLowerCase())],
  })();
}

export function getSummary(id: number): Promise<Summary | NotFound> {
  return unstable_cache(() => view<Summary | NotFound>('get_summary', [id]), ['get_summary', String(id)], {
    revalidate: REVALIDATE,
    tags: [tags.all, tags.summary(id)],
  })();
}

export function getChallenge(id: number): Promise<Challenge | NotFound> {
  return unstable_cache(() => view<Challenge | NotFound>('get_challenge', [id]), ['get_challenge', String(id)], {
    revalidate: REVALIDATE,
    tags: [tags.all, tags.challenge(id)],
  })();
}

export function getAccount(address: string): Promise<Account | NotFound> {
  return unstable_cache(() => view<Account | NotFound>('get_doc', [address.toLowerCase()]), ['get_account', address.toLowerCase()], {
    revalidate: REVALIDATE,
    tags: [tags.all, tags.account(address)],
  })();
}

/** The newest summaries first, each as the full summary view. */
export async function recentSummaries(limit = 12): Promise<Summary[]> {
  const totals = await getTotals();
  const out: Summary[] = [];
  for (let id = totals.summaries; id >= 1 && out.length < limit; id--) {
    const s = await getSummary(id);
    if (s.found) out.push(s);
  }
  return out;
}

/** The newest challenges first. */
export async function recentChallenges(limit = 4, decidedOnly = false): Promise<Challenge[]> {
  const totals = await getTotals();
  const out: Challenge[] = [];
  for (let id = totals.challenges; id >= 1 && out.length < limit; id--) {
    const c = await getChallenge(id);
    if (c.found && (!decidedOnly || c.verdict !== '')) out.push(c);
  }
  return out;
}

/** Every document, newest first. */
export async function allDocs(limit = 24): Promise<Doc[]> {
  const totals = await getTotals();
  const out: Doc[] = [];
  for (let n = totals.docs; n >= 1 && out.length < limit; n--) {
    const d = await getDoc(String(n));
    if (d.found) out.push(d);
  }
  return out;
}

/** The summary shown on the front page: the newest one with an upheld claim, else the newest. */
export async function featuredSummary(): Promise<Summary | null> {
  const list = await recentSummaries(6);
  return list.find((s) => s.upheld > 0) ?? list[0] ?? null;
}

export function rowOf(s: Summary): SummaryRow {
  return s;
}

/** A read failed: say so in one sentence rather than failing the page. */
export function readError(error: unknown): string {
  const text = String((error as Error)?.message ?? error);
  if (/-32029|rate limit/i.test(text)) return 'Studio Next is rate limiting reads right now. Wait a minute and reload.';
  return 'Studio Next did not answer this read. Reload in a moment.';
}
