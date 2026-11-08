import Link from 'next/link';

import { timeLeft } from '@/lib/claims';
import { gen, plural, short } from '@/lib/format';
import type { Summary, SummaryRow } from '@/lib/types';

import { ClaimLine } from './ui';

/** The state of a summary in one word, and whether it is the live kind. */
export function SummaryState({ s }: { s: SummaryRow }) {
  if (s.state === 'STANDS') return <span className="c-verdict yes">STANDS</span>;
  const left = timeLeft(s.window_end);
  return <span className="c-verdict">{left === 'ended' ? 'Window over' : `Open · ${left}`}</span>;
}

/** A summary as the front page shows it: who wrote it, the bond, every claim with its mark, and what is left. */
export function SummaryCard({ s, compact = false }: { s: Summary; compact?: boolean }) {
  return (
    <div className="c-card">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--line)] p-4">
        <div className="min-w-0">
          <p className="c-eyebrow">Summary #{s.id}</p>
          <Link href={`/s/${s.id}`} className="c-h3 mt-1 block hover:underline">
            {s.doc_title}
          </Link>
          <p className="c-faint mt-1 text-[12.5px]">
            by <span className="mono">{short(s.author)}</span> · bond <span className="mono">{gen(s.bond)}</span> · {plural(s.claims, 'claim')}
          </p>
        </div>
        <SummaryState s={s} />
      </div>
      <div>
        {s.claim_rows.slice(0, compact ? 4 : 8).map((row) => (
          <ClaimLine key={row.no} no={row.no} clause={row.clause} text={row.text} mark={row.mark} href={row.open_challenge ? `/c/${row.open_challenge}` : undefined} />
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--line)] p-4 text-[13px]">
        <span className="c-muted">
          {s.upheld > 0 ? `${s.upheld} upheld` : 'none upheld'} · {s.claim_rows.filter((r) => r.mark === 'UNTESTED').length} untested · bond left <span className="mono">{gen(s.bond_left)}</span>
        </span>
        <Link href={`/s/${s.id}`} className="c-link">
          Open the summary →
        </Link>
      </div>
    </div>
  );
}
