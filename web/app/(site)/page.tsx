import Link from 'next/link';

import { SummaryCard } from '@/components/SummaryCard';
import { Empty, LabelBadge, VerdictBadge } from '@/components/ui';
import { gen, short } from '@/lib/format';
import { featuredSummary, getTotals, readError, recentChallenges } from '@/lib/read';
import type { Challenge, Summary, Totals } from '@/lib/types';

export const revalidate = 20;

const FAQ: { q: string; a: string }[] = [
  {
    q: 'Is this legal advice?',
    a: 'No. Fineprint checks that one sentence says what one clause says. It never says a clause is fair, enforceable or complete, and it does not replace reading the terms.',
  },
  {
    q: 'What if the text was pasted wrong?',
    a: 'A document is only as accurate as the person who pasted it, which is why its text is public and fixed by its hash: anyone can compare it with the original. A corrected paste is a new document with a new id, and old summaries keep pointing at the text they were written against.',
  },
  {
    q: 'Who gets the bond?',
    a: 'It stays in the contract. An upheld challenge pays the challenger their stake back plus 20% of the original bond. A retracted claim pays 10%. A rejected challenge pays its stake to the author. If the window ends clean, the rest of the bond returns to the author. Money leaves the contract only when someone calls withdraw.',
  },
  {
    q: 'Which network is it on?',
    a: 'GenLayer Studio Next, chain 61997. The contract address is in the footer, and every figure on this site is read from it.',
  },
];

function Hero({ featured, error }: { featured: Summary | null; error: string }) {
  return (
    <section className="c-wrap grid items-center gap-10 py-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)] lg:py-20">
      <div>
        <p className="c-eyebrow">Summary bonds, judged on GenLayer</p>
        <h1 className="c-h1 mt-4">
          Terms, summarised by someone who <em>paid to be right.</em>
        </h1>
        <p className="c-lead mt-5">
          Every claim points at its clause and has a bond behind it. Challenge one for a small stake and GenLayer validators read it against the text.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link href="/new" className="c-btn solid">
            Post a summary
          </Link>
          <Link href="/summaries" className="c-btn">
            Challenge a claim
          </Link>
        </div>
        <p className="c-faint mt-6 text-[13.5px]">A summary nobody can fault gets its bond back.</p>
      </div>
      <div>
        {featured ? (
          <SummaryCard s={featured} compact />
        ) : (
          <Empty>{error || 'No summary has been posted yet. Post the first one.'}</Empty>
        )}
      </div>
    </section>
  );
}

function Recent({ list }: { list: Challenge[] }) {
  return (
    <section className="c-wrap pb-14">
      <p className="c-eyebrow mb-3">Recent challenges</p>
      {list.length === 0 ? (
        <Empty>No challenge has been made yet.</Empty>
      ) : (
        <div className="grid gap-px overflow-hidden rounded-[4px] border border-[var(--line)] bg-[var(--line)] sm:grid-cols-2 lg:grid-cols-4">
          {list.map((c) => (
            <Link key={c.id} href={`/c/${c.id}`} className="c-row-link bg-[var(--surface)] p-4">
              <div className="flex items-center gap-2">
                <VerdictBadge verdict={c.verdict} />
              </div>
              <p className="mt-3 text-[14.5px] font-medium">
                {c.doc_title}, claim {c.claim_no}
              </p>
              <p className="c-faint mt-1 line-clamp-2 text-[13px]">“{c.claim}”</p>
              <p className="c-faint mono mt-2 text-[11.5px]">
                challenge #{c.id} · {short(c.challenger)}
              </p>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

function How() {
  const steps = [
    ['01', 'Register', 'Paste the terms as numbered clauses. The id is their hash, so the text can never change under a summary.'],
    ['02', 'Summarise', 'Write 3 to 8 claims, each citing one clause, and post a bond of at least 10 GEN with a 24 to 168 hour window.'],
    ['03', 'Challenge', 'Anyone stakes a tenth of the bond against one claim, and may name a second clause it contradicts.'],
    ['04', 'Settle', 'Validators read the claim against the clause and agree on one label. The contract turns the label into a verdict and moves the money by rule.'],
  ];
  return (
    <section id="how" className="c-section">
      <div className="c-wrap">
        <p className="c-eyebrow">How it works</p>
        <h2 className="c-h2 mt-2 max-w-[18em]">Register, summarise, challenge, settle</h2>
        <div className="c-steps mt-8">
          {steps.map(([n, t, d]) => (
            <div key={n}>
              <p className="mono c-faint text-[12px]">{n}</p>
              <p className="c-h3 mt-3">{t}</p>
              <p className="c-muted mt-2 text-[14.5px]">{d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function WhatAClaimLooksLike() {
  return (
    <section className="c-section">
      <div className="c-wrap c-grid-2">
        <div>
          <p className="c-eyebrow">What a claim looks like</p>
          <h2 className="c-h2 mt-2">One sentence, one clause, one label</h2>
          <p className="c-muted mt-4 max-w-[34em] text-[15.5px]">
            The judge is asked a single question: does this sentence say what this clause says? It answers FAITHFUL, MISSTATES or UNSUPPORTED, and the verdict follows from that label in code. Nobody argues the case: the challenger&apos;s reason is stored for readers and is never shown to the judge.
          </p>
          <div className="mt-6">
            <Link href="/docs/more/judge-prompt" className="c-link">
              Read the judge prompt, word for word →
            </Link>
          </div>
        </div>
        <div className="c-card pad flex flex-col gap-4">
          <div className="c-clause">
            <span className="no">Clause 4, as registered</span>
            <p>Claimed tokens vest linearly over 12 months, with 25% available at the time of claim. Unvested tokens cannot be transferred.</p>
          </div>
          <table className="c-table">
            <thead>
              <tr>
                <th>Claim against clause 4</th>
                <th>Label</th>
                <th>Why</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="serif text-[17px]">“Tokens are fully unlocked at claim.”</td>
                <td><LabelBadge label="MISSTATES" /></td>
                <td className="c-muted text-[13.5px]">Overstates a 25% unlock.</td>
              </tr>
              <tr>
                <td className="serif text-[17px]">“Claims are free of fees.”</td>
                <td><LabelBadge label="UNSUPPORTED" /></td>
                <td className="c-muted text-[13.5px]">The clause is silent on fees.</td>
              </tr>
            </tbody>
          </table>
          <p className="c-faint text-[12.5px]">
            Two of the ten golden cases, from the evaluation in the docs. Every result there was read back from the contract, including the misses.
          </p>
        </div>
      </div>
    </section>
  );
}

function ForAuthors({ totals }: { totals: Totals | null }) {
  return (
    <section id="authors" className="c-section">
      <div className="c-wrap c-grid-2">
        <div>
          <p className="c-eyebrow">For authors and projects</p>
          <h2 className="c-h2 mt-2">What a bond shows, and what it costs</h2>
          <p className="c-muted mt-4 max-w-[34em] text-[15.5px]">
            A bond tells readers the author is willing to be wrong in public at a known price. A project can publish a checked reading of its own terms, and learn which sentence people misread.
          </p>
        </div>
        <div className="c-card pad">
          <p className="c-eyebrow mb-1">The rules, for a 20 GEN bond</p>
          <div className="c-field-row"><span className="c-muted">Bond</span><b className="mono">20 GEN</b></div>
          <div className="c-field-row"><span className="c-muted">A challenge stakes</span><b className="mono">2 GEN, a tenth</b></div>
          <div className="c-field-row"><span className="c-muted">An upheld claim costs the author</span><b className="mono">4 GEN, 20%</b></div>
          <div className="c-field-row"><span className="c-muted">A retracted claim costs</span><b className="mono">2 GEN, 10%</b></div>
          <div className="c-field-row"><span className="c-muted">A rejected challenge pays the author</span><b className="mono">2 GEN</b></div>
          <div className="c-field-row"><span className="c-muted">A clean window returns</span><b className="mono">the rest of the bond</b></div>
          {totals && (
            <p className="c-faint mt-3 text-[12.5px]">
              On the chain now: {totals.summaries} summaries, {totals.challenges} challenges, {gen(totals.bonds_left)} held in bonds.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function Faq() {
  return (
    <section id="faq" className="c-section">
      <div className="c-wrap c-grid-2">
        <div>
          <p className="c-eyebrow">FAQ</p>
          <h2 className="c-h2 mt-2">Questions people ask first</h2>
          <p className="c-muted mt-4 text-[15px]">
            More in the <Link href="/docs/more/faq" className="c-link">docs</Link>.
          </p>
        </div>
        <div className="c-faq">
          {FAQ.map((item) => (
            <details key={item.q}>
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

export default async function Home() {
  let featured: Summary | null = null;
  let recent: Challenge[] = [];
  let totals: Totals | null = null;
  let error = '';
  try {
    totals = await getTotals();
    featured = await featuredSummary();
    recent = await recentChallenges(4, true);
  } catch (e) {
    error = readError(e);
  }
  return (
    <>
      <Hero featured={featured} error={error} />
      <Recent list={recent} />
      <How />
      <WhatAClaimLooksLike />
      <ForAuthors totals={totals} />
      <Faq />
    </>
  );
}
