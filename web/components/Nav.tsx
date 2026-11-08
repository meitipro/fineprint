import Link from 'next/link';

import { WalletButton } from './Wallet';

/** The site's mark, the same drawing as app/icon.svg: a claim, struck against its clause. */
export function Mark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" aria-hidden style={{ flexShrink: 0 }}>
      <rect width="512" height="512" rx="72" fill="#f472b6" />
      <rect x="112" y="140" width="288" height="36" rx="8" fill="#2a0618" />
      <rect x="112" y="214" width="216" height="36" rx="8" fill="#2a0618" />
      <rect x="112" y="288" width="252" height="36" rx="8" fill="#2a0618" />
      <rect x="112" y="362" width="150" height="36" rx="8" fill="#2a0618" />
      <rect x="92" y="198" width="328" height="12" rx="6" fill="#fdf2f8" transform="rotate(-8 256 204)" />
    </svg>
  );
}

export function Nav() {
  return (
    <header className="c-nav">
      <div className="c-wrap c-nav-row">
        <Link href="/" className="c-brand" aria-label="Fineprint home">
          <Mark />
          fineprint
        </Link>
        <nav className="c-links" aria-label="Main">
          <Link href="/documents">Documents</Link>
          <Link href="/summaries">Summaries</Link>
          <Link href="/#how">How it works</Link>
          <Link href="/docs">Docs</Link>
        </nav>
        <div className="c-nav-right">
          <span className="c-pill hidden sm:inline-flex" title="GenLayer Studio Next, chain 61997">
            <span className="dot" />
            Studio Next
          </span>
          <WalletButton />
          <Link href="/new" className="c-btn small solid hidden sm:inline-flex">
            Post a summary
          </Link>
        </div>
      </div>
      <nav className="c-links-mobile c-wrap" aria-label="Main, small screens">
        <Link href="/documents">Documents</Link>
        <Link href="/summaries">Summaries</Link>
        <Link href="/me">My bonds</Link>
        <Link href="/new">Post a summary</Link>
        <Link href="/docs">Docs</Link>
      </nav>
    </header>
  );
}
