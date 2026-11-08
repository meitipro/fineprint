import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ChallengeBox, CloseBox, RetractBox } from '@/components/Boxes';
import { SummaryState } from '@/components/SummaryCard';
import { Addr, BondBar, ClaimLine, Money, NotFoundCard, ReadError, Tx, VerdictBadge } from '@/components/ui';
import { txIndex } from '@/lib/explorer';
import { dayTime, gen, plural } from '@/lib/format';
import { getChallenge, getDoc, getSummary, readError } from '@/lib/read';
import type { Challenge, Doc, Summary } from '@/lib/types';

export const revalidate = 20;

export async function generateMetadata(props: PageProps<'/s/[id]'>): Promise<Metadata> {
  const { id } = await props.params;
  try {
    const s = await getSummary(Number(id));
    return { title: s.found ? `Summary ${s.id}: ${s.doc_title}` : `Summary ${id}` };
  } catch {
    return { title: `Summary ${id}` };
  }
}

export default async function SummaryPage(props: PageProps<'/s/[id]'>) {
  const { id: raw } = await props.params;
  const id = Number(raw);
  if (!Number.isInteger(id) || id < 1) notFound();
  let s: Summary | null = null;
  let doc: Doc | null = null;
  let challenges: Challenge[] = [];
  let error = '';
  try {
    const found = await getSummary(id);
    if (!found.found) return <NotFoundCard what="summary with this number" back="/summaries" backLabel="All summaries" />;
    s = found;
    const d = await getDoc(s.doc_id);
    if (d.found) doc = d;
    for (const cid of s.challenge_ids.slice(0, 12)) {
      const c = await getChallenge(cid);
      if (c.found) challenges.push(c);
    }
  } catch (e) {
    error = readError(e);
  }
  if (!s) {
    return (
      <div className="c-wrap py-12">
        <ReadError message={error} />
      </div>
    );
  }
  const txs = await txIndex();
  const posted = txs.summary[String(id)];
  const clauseOf = (n: number) => doc?.clauses.find((c) => c.no === n)?.text ?? '';

  return (
    <div className="c-wrap py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="c-eyebrow">Summary #{s.id}</p>
          <h1 className="c-h2 mt-2">
            <Link href={`/d/${s.doc_id}`} className="hover:underline">{s.doc_title}</Link>
          </h1>
          <p className="c-muted mt-2 text-[14px]">
            by <Addr address={s.author} /> · {plural(s.claims, 'claim')} · posted {dayTime(s.posted_at)}
            {posted && (
              <>
                {' '}
                · <Tx hash={posted.hash} />
              </>
            )}
          </p>
        </div>
        <SummaryState s={s} />
      </div>

      <dl className="c-kv mt-6">
        <div><dd className="mono">{<Money wei={s.bond_left} strong />}</dd><dt>Bond left of {gen(s.bond)}</dt></div>
        <div><dd><Money wei={s.stake} /></dd><dt>Stake per challenge</dt></div>
        <div><dd>{s.state === 'OPEN' ? <WindowLeft end={s.window_end} /> : `Closed ${dayTime(s.closed_at)}`}</dd><dt>{s.state === 'OPEN' ? 'Window' : 'STANDS'}</dt></div>
        <div><dd>{s.upheld} upheld · {s.rejected} tested · {s.corrected} struck</dd><dt>Record</dt></div>
      </dl>
      <div className="mt-3"><BondBar left={s.bond_left} bond={s.bond} /></div>

      <section className="mt-10" aria-labelledby="claims-h">
        <h2 id="claims-h" className="c-eyebrow mb-3">Claims, each with the clause it cites</h2>
        <div className="c-card overflow-hidden">
          {s.claim_rows.map((row) => (
            <div key={row.no} id={`claim-${row.no}`}>
              <ClaimLine no={row.no} clause={row.clause} text={row.text} mark={row.mark} href={row.open_challenge ? `/c/${row.open_challenge}` : undefined} />
              <details className="border-b border-[var(--line)] px-4 last:border-b-0">
                <summary className="c-faint cursor-pointer py-2 text-[13px]">
                  Clause {row.clause}, as registered{row.challenges ? ` · ${plural(row.challenges, 'challenge')}` : ''}
                </summary>
                <div className="c-clause mb-3">
                  <span className="no">Clause {row.clause}</span>
                  <p>{clauseOf(row.clause)}</p>
                </div>
                {doc && s.state === 'OPEN' && (
                  <div className="mb-4">
                    <ChallengeBox
                      summaryId={s.id}
                      claim={row}
                      clauseCount={doc.clauses.length}
                      stake={s.stake}
                      bond={s.bond}
                      bondLeft={s.bond_left}
                      windowEnd={s.window_end}
                      author={s.author}
                    />
                  </div>
                )}
              </details>
            </div>
          ))}
        </div>
      </section>

      <div className="c-grid-2 mt-10">
        <section aria-labelledby="ch-h">
          <h2 id="ch-h" className="c-eyebrow mb-3">Challenges on this summary</h2>
          {challenges.length === 0 ? (
            <div className="c-note">Nobody has challenged a claim yet.</div>
          ) : (
            <div className="flex flex-col gap-3">
              {challenges.map((c) => (
                <Link key={c.id} href={`/c/${c.id}`} className="c-card c-row-link pad flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[14.5px] font-medium">Claim {c.claim_no}, challenge #{c.id}</p>
                    <p className="c-faint line-clamp-1 text-[13px]">“{c.claim}”</p>
                  </div>
                  <VerdictBadge verdict={c.verdict} />
                </Link>
              ))}
            </div>
          )}
        </section>
        <div className="flex flex-col gap-4">
          <RetractBox summaryId={s.id} author={s.author} rows={s.claim_rows} bond={s.bond} bondLeft={s.bond_left} />
          {s.state === 'OPEN' && <CloseBox summaryId={s.id} author={s.author} windowEnd={s.window_end} openChallenges={s.open_challenges} bondLeft={s.bond_left} />}
          {s.state === 'STANDS' && (
            <div className="c-note accent">
              <p>This summary survived its window. The rest of the bond went back to its author, and the record above is final.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function WindowLeft({ end }: { end: number }) {
  const left = end - Math.floor(Date.now() / 1000);
  if (left <= 0) return <>over</>;
  const h = Math.floor(left / 3600);
  return <>{h >= 48 ? `${Math.floor(h / 24)} days left` : h >= 1 ? `${h} h left` : `${Math.max(1, Math.floor(left / 60))} min left`}</>;
}
