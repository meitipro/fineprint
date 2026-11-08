import { NextResponse } from 'next/server';
import { isAddress } from 'viem';

import { getAccount, getChallenge, getSummary, readError } from '@/lib/read';
import type { Challenge, Summary } from '@/lib/types';

/**
 * One account's balance, summaries and challenges, read through the site so
 * the browser never spends the RPC budget of its own and the answer is cached
 * with the rest. `brief=1` is the balance alone.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const address = String(url.searchParams.get('address') ?? '');
  if (!isAddress(address, { strict: false })) return NextResponse.json({ error: 'Send a wallet address.' }, { status: 400 });
  try {
    const account = await getAccount(address);
    if (!account.found) return NextResponse.json({ account: { balance: '0', earned: '0', withdrawn: '0', summaries: [], challenges: [] }, summaries: [], challenges: [], totals: account.totals });
    if (url.searchParams.get('brief')) return NextResponse.json({ account });
    const summaries: Summary[] = [];
    for (const id of account.summaries.slice(0, 12)) {
      const s = await getSummary(id);
      if (s.found) summaries.push(s);
    }
    const challenges: Challenge[] = [];
    for (const id of account.challenges.slice(0, 12)) {
      const c = await getChallenge(id);
      if (c.found) challenges.push(c);
    }
    return NextResponse.json({ account, summaries, challenges });
  } catch (error) {
    return NextResponse.json({ error: readError(error) }, { status: 502 });
  }
}
