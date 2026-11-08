import type { Metadata } from 'next';

import { MePanel } from '@/components/MePanel';

export const metadata: Metadata = { title: 'My bonds' };

export default async function MePage(props: PageProps<'/me'>) {
  const search = await props.searchParams;
  const address = typeof search.address === 'string' && /^0x[0-9a-fA-F]{40}$/.test(search.address) ? search.address : '';
  return (
    <div className="c-wrap py-12">
      <p className="c-eyebrow">My bonds</p>
      <h1 className="c-h2 mt-2">Summaries, challenges, windows closing and balance</h1>
      <p className="c-muted mt-2 max-w-[42em] text-[15px]">
        Everything an account has on the contract, read from the chain for the connected wallet, or for any address with <span className="mono text-[13.5px]">?address=0x…</span>.
      </p>
      <div className="mt-8">
        <MePanel address={address} />
      </div>
    </div>
  );
}
