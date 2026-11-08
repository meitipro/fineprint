import type { Metadata } from 'next';
import Link from 'next/link';

import { Empty, ReadError } from '@/components/ui';
import { day, plural, short } from '@/lib/format';
import { allDocs, readError } from '@/lib/read';
import type { Doc } from '@/lib/types';

export const metadata: Metadata = { title: 'Documents' };
export const revalidate = 20;

export default async function DocumentsPage() {
  let docs: Doc[] = [];
  let error = '';
  try {
    docs = await allDocs(40);
  } catch (e) {
    error = readError(e);
  }
  return (
    <div className="c-wrap py-12">
      <p className="c-eyebrow">Documents</p>
      <h1 className="c-h2 mt-2">Terms, fixed by their hash</h1>
      <p className="c-muted mt-2 max-w-[40em] text-[15px]">
        A document is a title and 3 to 12 numbered clauses. Its id is the sha256 of that text, so a summary always points at text that cannot change under it. A new version is a new document.
      </p>
      <div className="mt-8 flex flex-col gap-3">
        {error ? (
          <ReadError message={error} />
        ) : docs.length === 0 ? (
          <Empty>No document has been registered yet. <Link href="/new" className="c-link">Post the first summary.</Link></Empty>
        ) : (
          docs.map((d) => (
            <Link key={d.id} href={`/d/${d.id}`} className="c-card c-row-link pad flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="c-h3">{d.title}</p>
                <p className="c-faint mono mt-1 text-[12px]">{d.id.slice(0, 16)}… · registered {day(d.registered_at)} by {short(d.registrar)}</p>
              </div>
              <p className="c-muted text-[14px]">
                {plural(d.clauses.length, 'clause')} · {plural(d.summary_count, 'summary', 'summaries')}
              </p>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
