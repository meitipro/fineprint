import type { Metadata } from 'next';

import { PostForm, type KnownDoc } from '@/components/PostForm';
import { allDocs } from '@/lib/read';

export const metadata: Metadata = { title: 'Post a summary' };
export const revalidate = 20;

export default async function NewPage(props: PageProps<'/new'>) {
  const search = await props.searchParams;
  const initialDoc = typeof search.doc === 'string' ? search.doc.toLowerCase() : '';
  let docs: KnownDoc[] = [];
  try {
    docs = (await allDocs(30)).map((d) => ({ id: d.id, title: d.title, clauses: d.clauses.map((c) => c.text) }));
  } catch {
    docs = [];
  }
  return (
    <div className="c-wrap py-12">
      <p className="c-eyebrow">Post a summary</p>
      <h1 className="c-h2 mt-2">Claims against clauses, with a bond behind them</h1>
      <p className="c-muted mt-2 max-w-[42em] text-[15px]">
        Register the terms once (or pick a document already on chain), write 3 to 8 claims in your own words, each citing one clause, and post a bond of at least 10 GEN with a 24 to 168 hour window. Anyone can then stake a tenth of the bond against one claim.
      </p>
      <div className="mt-8">
        <PostForm docs={docs} initialDoc={initialDoc} />
      </div>
    </div>
  );
}
