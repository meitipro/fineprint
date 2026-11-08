import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { JudgeBox, WithdrawBox } from '@/components/Boxes';
import { Addr, LabelBadge, Money, NotFoundCard, ReadError, Tx, VerdictBadge } from '@/components/ui';
import { LABEL_HELP, VERDICT_HELP, timeLeft } from '@/lib/claims';
import { txIndex } from '@/lib/explorer';
import { dayTime, gen } from '@/lib/format';
import { getChallenge, readError } from '@/lib/read';
import type { Challenge } from '@/lib/types';

export const revalidate = 20;

export async function generateMetadata(props: PageProps<'/c/[id]'>): Promise<Metadata> {
  const { id } = await props.params;
  try {
    const c = await getChallenge(Number(id));
    return { title: c.found ? `Challenge ${c.id}: claim ${c.claim_no} of ${c.doc_title}` : `Challenge ${id}` };
  } catch {
    return { title: `Challenge ${id}` };
  }
}

export default async function ChallengePage(props: PageProps<'/c/[id]'>) {
  const { id: raw } = await props.params;
  const id = Number(raw);
  if (!Number.isInteger(id) || id < 1) notFound();
  let c: Challenge | null = null;
  let error = '';
  try {
    const found = await getChallenge(id);
    if (!found.found) return <NotFoundCard what="challenge with this number" back="/summaries" backLabel="All summaries" />;
    c = found;
  } catch (e) {
    error = readError(e);
  }
  if (!c) {
    return (
      <div className="c-wrap py-12">
        <ReadError message={error} />
      </div>
    );
  }
  const txs = await txIndex();
  const made = txs.challenge[String(id)];
  const read = txs.judge[String(id)];
  const open = c.verdict === '';

  return (
    <div className="c-wrap py-10">
      <p className="c-eyebrow">
        <Link href={`/s/${c.summary_id}`} className="hover:underline">Summary #{c.summary_id}</Link> · {c.doc_title} · claim {c.claim_no} {open ? 'waiting to be read' : 'read'}
      </p>
      <h1 className="c-big-claim mt-4">“{c.claim}”</h1>
      <p className="c-muted mt-4 text-[14px]">
        written by <Addr address={c.author} /> · cites clause {c.clause_no} · challenged by <Addr address={c.challenger} /> with <Money wei={c.stake} />
        {made && (
          <>
            {' '}
            · <Tx hash={made.hash} />
          </>
        )}
      </p>

      <div className="c-grid-2 mt-8">
        <div className="flex flex-col gap-6">
          <section aria-labelledby="clause-h">
            <h2 id="clause-h" className="c-eyebrow mb-2">Clause {c.clause_no}, as registered</h2>
            <div className="c-clause hit">
              <span className="no">The text the judge read, fixed by the document hash</span>
              <p>{c.clause}</p>
            </div>
            {c.against > 0 && (
              <div className="c-clause mt-3">
                <span className="no">Clause {c.against}, named by the challenger as contradicting the claim</span>
                <p>{c.against_clause}</p>
              </div>
            )}
            <p className="c-faint mt-2 text-[12.5px]">
              <Link href={`/d/${c.doc_id}#clause-${c.clause_no}`} className="c-link">Open the document</Link>
            </p>
          </section>
          <section aria-labelledby="reason-h">
            <h2 id="reason-h" className="c-eyebrow mb-2">The challenger&apos;s reason, not given to the judge</h2>
            <div className="c-card pad">
              <p className="text-[15.5px] leading-relaxed">{c.reason}</p>
            </div>
            <p className="c-faint mt-2 text-[12.5px]">Stored for readers. The judge sees only the claim and the clause, so eloquence cannot move a label.</p>
          </section>
        </div>

        <div className="flex flex-col gap-6">
          <section className="c-card pad flex flex-col gap-3" aria-labelledby="verdict-h">
            <h2 id="verdict-h" className="c-eyebrow">Verdict</h2>
            <div className="flex flex-wrap items-center gap-3">
              <span className="c-stat">{c.verdict || 'Not read yet'}</span>
              {c.label && <LabelBadge label={c.label} />}
            </div>
            {c.verdict ? (
              <>
                <p className="c-muted text-[14.5px]">{VERDICT_HELP[c.verdict]}</p>
                {c.label && <p className="c-faint text-[13px]">{LABEL_HELP[c.label]}</p>}
                {read?.votes ? (
                  <p className="c-faint text-[13px]">
                    The label was agreed by {read.votes.agreed} of {read.votes.voted} validators who voted{read.votes.seconds ? `, in ${read.votes.seconds} seconds` : ''}. <Tx hash={read.hash} label="read in" />
                  </p>
                ) : read ? (
                  <p className="c-faint text-[13px]">
                    <Tx hash={read.hash} label="read in" />
                  </p>
                ) : null}
                <p className="c-faint text-[12.5px]">{c.resolved_at ? `Decided ${dayTime(c.resolved_at)} by ${c.resolved_by.slice(0, 8)}…` : ''}</p>
              </>
            ) : (
              <p className="c-muted text-[14.5px]">The validators have not read this claim yet.</p>
            )}
          </section>

          {open ? (
            <JudgeBox challengeId={c.id} summaryId={c.summary_id} deadline={c.judge_deadline} challenger={c.challenger} />
          ) : (
            <WithdrawBox title="Withdraw what you are owed" />
          )}

          <section className="c-card pad" aria-labelledby="money-h">
            <h2 id="money-h" className="c-eyebrow">Where the money went</h2>
            <div className="mt-2">
              {c.verdict === 'UPHELD' || c.verdict === 'CORRECTED' || c.verdict === 'VOID' ? (
                <>
                  <div className="c-field-row"><span className="c-muted">Stake back to the challenger</span><Money wei={c.stake} /></div>
                  <div className="c-field-row"><span className="c-muted">From the bond ({c.verdict === 'CORRECTED' ? '10%' : '20%'})</span><Money wei={c.bonus} /></div>
                </>
              ) : c.verdict === 'REJECTED' ? (
                <div className="c-field-row"><span className="c-muted">Stake to the author</span><Money wei={c.to_author} /></div>
              ) : (
                <div className="c-field-row"><span className="c-muted">Stake held by the contract</span><Money wei={c.stake} /></div>
              )}
              <div className="c-field-row"><span className="c-muted">Bond left</span><Money wei={c.bond_left} /></div>
              <div className="c-field-row"><span className="c-muted">Window left</span><span className="mono">{c.summary_state === 'STANDS' ? 'closed' : timeLeft(c.window_end)}</span></div>
            </div>
            <p className="c-faint mt-3 text-[12.5px]">
              All of this is by rule: {gen(c.bond)} bond, stake a tenth, bonus a share of the original bond capped at what remains. Money leaves the contract only when someone withdraws.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
