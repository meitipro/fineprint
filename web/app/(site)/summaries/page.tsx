import type { Metadata } from 'next';
import Link from 'next/link';

import { SummaryState } from '@/components/SummaryCard';
import { Empty, ReadError } from '@/components/ui';
import { gen, plural, short } from '@/lib/format';
import { readError, recentSummaries } from '@/lib/read';
import type { Summary } from '@/lib/types';

export const metadata: Metadata = { title: 'Summaries' };
export const revalidate = 20;

export default async function SummariesPage() {
  let list: Summary[] = [];
  let error = '';
  try {
    list = await recentSummaries(30);
  } catch (e) {
    error = readError(e);
  }
  return (
    <div className="c-wrap py-12">
      <p className="c-eyebrow">Summaries</p>
      <h1 className="c-h2 mt-2">Every summary has a bond behind it</h1>
      <p className="c-muted mt-2 max-w-[40em] text-[15px]">
        Open one to read its claims next to the clauses they cite, and challenge any claim that is not faithful.
      </p>
      <div className="mt-8 flex flex-col gap-3">
        {error ? (
          <ReadError message={error} />
        ) : list.length === 0 ? (
          <Empty>No summary has been posted yet.</Empty>
        ) : (
          list.map((s) => (
            <Link key={s.id} href={`/s/${s.id}`} className="c-card c-row-link pad grid items-center gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
              <div className="min-w-0">
                <p className="c-h3">
                  #{s.id} · {s.doc_title}
                </p>
                <p className="c-faint mt-1 text-[12.5px]">
                  by <span className="mono">{short(s.author)}</span> · {plural(s.claims, 'claim')} · {s.upheld} upheld · {s.rejected} tested · {s.corrected} struck
                </p>
              </div>
              <p className="mono text-[13.5px]">
                {gen(s.bond_left)} <span className="c-faint">of {gen(s.bond)}</span>
              </p>
              <SummaryState s={s} />
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
