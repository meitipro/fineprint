import Link from 'next/link';

import { gen, short, shortHash } from '@/lib/format';
import { DEPLOYMENT } from '@/lib/genlayer-core.mjs';
import { MARK_HELP, MARK_LABEL } from '@/lib/claims';
import type { Label, Mark, Verdict } from '@/lib/types';

export const EXPLORER = DEPLOYMENT.explorer as string;
export const CONTRACT = DEPLOYMENT.fineprint as string;

export function txUrl(hash: string): string {
  return `${EXPLORER}/tx/${hash}`;
}

export function addressUrl(address: string): string {
  return `${EXPLORER}/address/${address}`;
}

export function Tx({ hash, label }: { hash?: string; label?: string }) {
  if (!hash) return null;
  return (
    <a className="c-link mono text-[12.5px]" href={txUrl(hash)} target="_blank" rel="noreferrer">
      {label ? `${label} ` : ''}
      {shortHash(hash)} ↗
    </a>
  );
}

export function Addr({ address }: { address: string }) {
  if (!address) return null;
  return (
    <a className="c-link mono text-[12.5px]" href={addressUrl(address)} target="_blank" rel="noreferrer" title={address}>
      {short(address)}
    </a>
  );
}

/** The model's label for a claim. Pink only for the labels that land a challenge. */
export function LabelBadge({ label }: { label: Label | '' }) {
  if (!label) return null;
  return <span className={`c-label-pill ${label === 'FAITHFUL' ? 'ok' : 'hit'}`}>{label}</span>;
}

/** What the contract made of the label. */
export function VerdictBadge({ verdict }: { verdict: Verdict | '' }) {
  if (!verdict) return <span className="c-verdict">Waiting to be read</span>;
  return <span className={`c-verdict ${verdict === 'UPHELD' || verdict === 'CORRECTED' ? 'yes' : ''}`}>{verdict}</span>;
}

/** The mark on a claim: pink upheld, struck-through tested, hatched struck, dotted untested. */
export function MarkBadge({ mark }: { mark: Mark }) {
  return (
    <span className={`c-mark-pill ${mark.toLowerCase()}`} title={MARK_HELP[mark]}>
      {MARK_LABEL[mark]}
    </span>
  );
}

export function Money({ wei, strong }: { wei: string | bigint; strong?: boolean }) {
  return <span className={`mono ${strong ? 'font-semibold' : ''}`}>{gen(wei)}</span>;
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="c-note">{children}</div>;
}

export function ReadError({ message }: { message: string }) {
  return (
    <div className="c-card pad">
      <p className="font-medium">The chain did not answer.</p>
      <p className="c-muted mt-1 text-[14px]">{message}</p>
    </div>
  );
}

export function NotFoundCard({ what, back, backLabel }: { what: string; back: string; backLabel: string }) {
  return (
    <div className="c-wrap py-20">
      <div className="c-card pad max-w-xl">
        <p className="c-eyebrow">Not found</p>
        <h1 className="c-h2 mt-2">There is no {what}.</h1>
        <p className="c-muted mt-2">It may not exist yet on Studio Next, or the number is wrong.</p>
        <Link href={back} className="c-btn mt-4">
          {backLabel}
        </Link>
      </div>
    </div>
  );
}

/** A thin bar showing how much of the bond is left. */
export function BondBar({ left, bond }: { left: string; bond: string }) {
  const total = BigInt(bond);
  const pct = total > 0n ? Number((BigInt(left) * 100n) / total) : 0;
  return (
    <div className="c-bar" role="img" aria-label={`${gen(left)} of ${gen(bond)} left`}>
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}

/** A claim as one line: its number, its text, the clause it cites and its mark. */
export function ClaimLine({ no, clause, text, mark, href }: { no: number; clause: number; text: string; mark: Mark; href?: string }) {
  const body = (
    <>
      <span className="c-claim-no mono">#{no}</span>
      <span className="c-claim-text">{text}</span>
      <span className="c-claim-clause mono">clause {clause}</span>
      <MarkBadge mark={mark} />
    </>
  );
  return href ? (
    <Link href={href} className={`c-claim ${mark.toLowerCase()} c-row-link`}>
      {body}
    </Link>
  ) : (
    <div className={`c-claim ${mark.toLowerCase()}`}>{body}</div>
  );
}
