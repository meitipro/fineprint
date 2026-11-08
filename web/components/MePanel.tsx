'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { timeLeft } from '@/lib/claims';
import { gen, plural, short } from '@/lib/format';
import type { Challenge, Summary } from '@/lib/types';

import { WithdrawBox } from './Boxes';
import { Empty, VerdictBadge } from './ui';
import { WalletGate, useWallet } from './Wallet';

type Data = { account: { balance: string; earned: string; withdrawn: string; summary_count: number; challenge_count: number }; summaries: Summary[]; challenges: Challenge[] };

/** Summaries and challenges by state, windows closing, and the balance, for the connected wallet or for ?address=0x… */
export function MePanel({ address }: { address: string }) {
  const w = useWallet();
  const who = address || w.account;
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!who) {
      setData(null);
      return;
    }
    let live = true;
    setError('');
    fetch(`/api/account?address=${who}`, { cache: 'no-store' })
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body?.error ?? 'The chain did not answer.');
        if (live) setData(body);
      })
      .catch((e) => live && setError(String(e?.message ?? e)));
    return () => {
      live = false;
    };
  }, [who, w.balance]);

  if (!who) {
    return (
      <WalletGate action="see your bonds">
        <Empty>Connect a wallet to see your summaries, challenges and balance, or open this page with ?address=0x…</Empty>
      </WalletGate>
    );
  }
  if (error) return <div className="c-note" style={{ color: 'var(--danger)' }}>{error}</div>;
  if (!data) return <div className="c-note flex items-center gap-2"><span className="c-spin" /> Reading the chain…</div>;

  const open = data.summaries.filter((s) => s.state === 'OPEN');
  const closing = [...open].sort((a, b) => a.window_end - b.window_end);
  const standing = data.summaries.filter((s) => s.state === 'STANDS');
  const waiting = data.challenges.filter((c) => c.verdict === '');
  const decided = data.challenges.filter((c) => c.verdict !== '');

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)]">
      <div className="flex flex-col gap-8">
        <section>
          <h2 className="c-eyebrow mb-3">My summaries · {data.account.summary_count}</h2>
          {data.summaries.length === 0 ? (
            <Empty>No summary from {short(who)} yet. <Link href="/new" className="c-link">Post one.</Link></Empty>
          ) : (
            <div className="flex flex-col gap-3">
              {closing.map((s) => (
                <Link key={s.id} href={`/s/${s.id}`} className="c-card c-row-link pad flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="c-h3">#{s.id} · {s.doc_title}</p>
                    <p className="c-faint mt-1 text-[12.5px]">
                      window {timeLeft(s.window_end)} · {s.open_challenges ? `${s.open_challenges} challenge(s) waiting` : 'no challenge waiting'} · bond left <span className="mono">{gen(s.bond_left)}</span>
                    </p>
                  </div>
                  <span className="c-verdict">Open</span>
                </Link>
              ))}
              {standing.map((s) => (
                <Link key={s.id} href={`/s/${s.id}`} className="c-card c-row-link pad flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="c-h3">#{s.id} · {s.doc_title}</p>
                    <p className="c-faint mt-1 text-[12.5px]">{s.upheld} upheld · {s.rejected} tested · {s.corrected} struck · bond paid out <span className="mono">{gen(s.paid_out)}</span></p>
                  </div>
                  <span className="c-verdict yes">STANDS</span>
                </Link>
              ))}
            </div>
          )}
        </section>
        <section>
          <h2 className="c-eyebrow mb-3">My challenges · {data.account.challenge_count}</h2>
          {data.challenges.length === 0 ? (
            <Empty>No challenge from {short(who)} yet.</Empty>
          ) : (
            <div className="flex flex-col gap-3">
              {[...waiting, ...decided].map((c) => (
                <Link key={c.id} href={`/c/${c.id}`} className="c-card c-row-link pad flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[14.5px] font-medium">#{c.id} · {c.doc_title}, claim {c.claim_no}</p>
                    <p className="c-faint line-clamp-1 text-[13px]">“{c.claim}”</p>
                  </div>
                  <VerdictBadge verdict={c.verdict} />
                </Link>
              ))}
            </div>
          )}
        </section>
        <p className="c-faint text-[12.5px]">{plural(data.summaries.length, 'summary', 'summaries')} and {plural(data.challenges.length, 'challenge')} shown, the newest twelve of each.</p>
      </div>
      <div className="flex flex-col gap-4">
        {!address || address.toLowerCase() === w.account.toLowerCase() ? (
          <WithdrawBox />
        ) : (
          <div className="c-card pad">
            <p className="c-eyebrow">Owed to {short(who)}</p>
            <p className="c-stat mono mt-2">{gen(data.account.balance)}</p>
            <p className="c-faint mt-2 text-[12.5px]">Connect that wallet to withdraw it.</p>
          </div>
        )}
        <div className="c-card pad">
          <p className="c-eyebrow">Earned and withdrawn</p>
          <div className="c-field-row"><span className="c-muted">Credited so far</span><span className="mono">{gen(data.account.earned)}</span></div>
          <div className="c-field-row"><span className="c-muted">Withdrawn</span><span className="mono">{gen(data.account.withdrawn)}</span></div>
        </div>
      </div>
    </div>
  );
}
