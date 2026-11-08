import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { SummaryState } from '@/components/SummaryCard';
import { Addr, Empty, NotFoundCard, ReadError, Tx } from '@/components/ui';
import { txIndex } from '@/lib/explorer';
import { dayTime, gen, plural } from '@/lib/format';
import { getDoc, readError } from '@/lib/read';
import type { Doc } from '@/lib/types';

export const revalidate = 20;

export async function generateMetadata(props: PageProps<'/d/[id]'>): Promise<Metadata> {
  const { id } = await props.params;
  try {
    const d = await getDoc(id);
    return { title: d.found ? d.title : 'Document' };
  } catch {
    return { title: 'Document' };
  }
}

export default async function DocumentPage(props: PageProps<'/d/[id]'>) {
  const { id: raw } = await props.params;
  const id = raw.toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(id)) notFound();
  let doc: Doc | null = null;
  let error = '';
  try {
    const found = await getDoc(id);
    if (found.found) doc = found;
    else return <NotFoundCard what="document with this id" back="/documents" backLabel="All documents" />;
  } catch (e) {
    error = readError(e);
  }
  if (!doc) {
    return (
      <div className="c-wrap py-12">
        <ReadError message={error} />
      </div>
    );
  }
  const txs = await txIndex();
  const created = txs.doc[doc.id];
  return (
    <div className="c-wrap py-10">
      <p className="c-eyebrow">Document</p>
      <h1 className="c-h2 mt-2">{doc.title}</h1>
      <p className="c-muted mt-2 text-[14px]">
        {plural(doc.clauses.length, 'clause')} · registered {dayTime(doc.registered_at)} by <Addr address={doc.registrar} />
        {created && (
          <>
            {' '}
            · <Tx hash={created.hash} />
          </>
        )}
      </p>
      <p className="c-faint mono mt-1 break-all text-[12px]">id {doc.id}</p>
      <div className="mt-4 c-note">
        This text is fixed by its hash. Anyone can compare it with the original; if it was pasted wrong, a corrected paste is a new document, and summaries of this one keep pointing at this text.
      </div>

      <div className="c-grid-2 mt-8">
        <section aria-labelledby="clauses-h">
          <h2 id="clauses-h" className="c-eyebrow mb-3">The numbered clauses</h2>
          <div className="flex flex-col gap-3">
            {doc.clauses.map((c) => (
              <div key={c.no} id={`clause-${c.no}`} className="c-clause">
                <span className="no">Clause {c.no}</span>
                <p>{c.text}</p>
              </div>
            ))}
          </div>
        </section>
        <section aria-labelledby="summaries-h">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 id="summaries-h" className="c-eyebrow">Summaries written about it</h2>
            <Link href={`/new?doc=${doc.id}`} className="c-btn small solid">
              Post a summary
            </Link>
          </div>
          {doc.summaries.length === 0 ? (
            <Empty>Nobody has summarised this document yet.</Empty>
          ) : (
            <div className="flex flex-col gap-3">
              {doc.summaries.map((s) => (
                <Link key={s.id} href={`/s/${s.id}`} className="c-card c-row-link pad flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="c-h3">Summary #{s.id}</p>
                    <p className="c-faint mt-1 text-[12.5px]">
                      {plural(s.claims, 'claim')} · {s.upheld} upheld · bond left <span className="mono">{gen(s.bond_left)}</span> of <span className="mono">{gen(s.bond)}</span>
                    </p>
                  </div>
                  <SummaryState s={s} />
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
