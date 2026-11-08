'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { correctedBonus, upheldBonus } from '@/lib/claims';
import { gen } from '@/lib/format';
import type { ClaimRow } from '@/lib/types';

import { TxProgress, useWrite } from './Actions';
import { WalletGate, useWallet } from './Wallet';

/** The chain time as the browser sees it, ticking once a second. */
export function useNow(): number {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

/** Stake a tenth of the bond against one claim, optionally pointing at a second clause. */
export function ChallengeBox({
  summaryId,
  claim,
  clauseCount,
  stake,
  bond,
  bondLeft,
  windowEnd,
  author,
}: {
  summaryId: number;
  claim: ClaimRow;
  clauseCount: number;
  stake: string;
  bond: string;
  bondLeft: string;
  windowEnd: number;
  author: string;
}) {
  const router = useRouter();
  const now = useNow();
  const { state, busy, run } = useWrite([`summary:${summaryId}`]);
  const [against, setAgainst] = useState(0);
  const [reason, setReason] = useState('');
  const bonus = upheldBonus(BigInt(bond), BigInt(bondLeft));
  const over = now >= windowEnd;
  const blocked = claim.mark === 'UPHELD' || claim.mark === 'STRUCK' ? 'This claim was already upheld or struck.' : claim.open_challenge > 0 ? 'This claim already has a challenge waiting to be read.' : over ? 'The challenge window of this summary is over.' : '';
  const w = useWallet();

  if (blocked) return <div className="c-note">{blocked}</div>;

  async function go() {
    const done = await run('challenge', [summaryId, claim.no, against, reason.trim()], BigInt(stake));
    if (done.phase === 'done' && done.returned !== undefined) router.push(`/c/${String(done.returned)}`);
  }

  return (
    <div className="c-card pad flex flex-col gap-3" id={`challenge-${claim.no}`}>
      <p className="c-eyebrow">Challenge claim {claim.no}</p>
      <p className="c-text serif text-[19px]">“{claim.text}”</p>
      <p className="c-faint text-[13px]">Cites clause {claim.clause}. The validators read the claim against that clause only.</p>
      <div>
        <label className="c-label" htmlFor={`against-${claim.no}`}>
          A second clause this claim contradicts (optional)
        </label>
        <select id={`against-${claim.no}`} className="c-select mono" value={against} onChange={(e) => setAgainst(Number(e.target.value))}>
          <option value={0}>None</option>
          {Array.from({ length: clauseCount }, (_, i) => i + 1)
            .filter((n) => n !== claim.clause)
            .map((n) => (
              <option key={n} value={n}>
                Clause {n}
              </option>
            ))}
        </select>
      </div>
      <div>
        <label className="c-label" htmlFor={`reason-${claim.no}`}>
          Your reason, for readers ({reason.trim().length}/300)
        </label>
        <textarea id={`reason-${claim.no}`} className="c-textarea" maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Only a quarter is available at claim, the rest vests over a year." />
        <p className="c-faint mt-1 text-[12.5px]">The reason is stored on the page. It is never given to the judge, so it cannot move the label.</p>
      </div>
      <div className="c-note">
        <p>
          You stake <b className="mono">{gen(stake)}</b>, a tenth of the bond. If the claim is upheld you get it back plus{' '}
          <b className="mono">{gen(bonus)}</b> from the bond (20%, capped at what is left). If it is faithful, the stake goes to the author{author ? ' ' : ''}
          {w.account && w.account.toLowerCase() === author.toLowerCase() ? '(that is you: it moves from your bond to your balance)' : ''}.
        </p>
      </div>
      <WalletGate action="stake on this claim">
        <button className="c-btn solid wide" disabled={busy || reason.trim().length === 0} onClick={go}>
          Stake {gen(stake)} and challenge
        </button>
      </WalletGate>
      <TxProgress state={state} waiting="Recording your challenge" />
    </div>
  );
}

/** Anyone asks the validators to read an open challenge. */
export function JudgeBox({ challengeId, summaryId, deadline, challenger }: { challengeId: number; summaryId: number; deadline: number; challenger: string }) {
  const now = useNow();
  const { w, state, busy, run } = useWrite([`challenge:${challengeId}`, `summary:${summaryId}`, `account:${challenger.toLowerCase()}`]);
  const late = now >= deadline;
  return (
    <div className="c-card pad flex flex-col gap-3">
      <p className="c-eyebrow">{late ? 'Nobody read this in time' : 'Waiting to be read'}</p>
      {late ? (
        <p className="c-muted text-[14px]">
          This challenge waited more than 48 hours. The next call voids it: no model runs, the stake goes back to the challenger and the claim stays open to a new challenge.
        </p>
      ) : (
        <p className="c-muted text-[14px]">
          Anyone can ask the validators to read this claim against its clause. Several validators answer one label each, and the label stands only when they agree. It takes about a minute.
        </p>
      )}
      <WalletGate action="ask the validators">
        <button className="c-btn solid wide" disabled={busy} onClick={() => run('judge', [challengeId])}>
          {late ? 'Void this challenge' : 'Ask the validators to read it'}
        </button>
      </WalletGate>
      <TxProgress state={state} waiting="Validators are reading" />
      {w.error && <p className="text-[13px]" style={{ color: 'var(--danger)' }}>{w.error}</p>}
    </div>
  );
}

/** The author strikes a challenged claim before it is read. */
export function RetractBox({ summaryId, author, rows, bond, bondLeft }: { summaryId: number; author: string; rows: ClaimRow[]; bond: string; bondLeft: string }) {
  const w = useWallet();
  const { state, busy, run } = useWrite([`summary:${summaryId}`]);
  const open = rows.filter((r) => r.open_challenge > 0);
  if (!w.account || w.account.toLowerCase() !== author.toLowerCase() || open.length === 0) return null;
  const bonus = correctedBonus(BigInt(bond), BigInt(bondLeft));
  return (
    <div className="c-card pad flex flex-col gap-3">
      <p className="c-eyebrow">You wrote this summary</p>
      <p className="c-muted text-[14px]">
        A claim with a challenge waiting can be struck before it is read. The challenger gets the stake back plus {gen(bonus)} (10% of the bond), and the claim is marked struck.
      </p>
      {open.map((row) => (
        <div key={row.no} className="c-field-row">
          <span className="text-[14px]">
            <span className="mono c-faint">#{row.no}</span> {row.text}
          </span>
          <button className="c-btn small" disabled={busy} onClick={() => run('retract', [summaryId, row.no])}>
            Retract
          </button>
        </div>
      ))}
      <TxProgress state={state} waiting="Recording the correction" />
    </div>
  );
}

/** Anyone closes a finished window with no open challenge: the rest of the bond goes to the author. */
export function CloseBox({ summaryId, author, windowEnd, openChallenges, bondLeft }: { summaryId: number; author: string; windowEnd: number; openChallenges: number; bondLeft: string }) {
  const now = useNow();
  const { state, busy, run } = useWrite([`summary:${summaryId}`, `account:${author.toLowerCase()}`]);
  if (now < windowEnd) return null;
  return (
    <div className="c-card pad flex flex-col gap-3">
      <p className="c-eyebrow">The window is over</p>
      {openChallenges > 0 ? (
        <p className="c-muted text-[14px]">{openChallenges} challenge(s) still waiting to be read. Read them first, then the summary can close.</p>
      ) : (
        <>
          <p className="c-muted text-[14px]">
            Nobody can fault this summary any more. Closing marks it STANDS and credits the rest of the bond, {gen(bondLeft)}, to its author. Anyone can close it.
          </p>
          <WalletGate action="close this summary">
            <button className="c-btn solid wide" disabled={busy} onClick={() => run('close_summary', [summaryId])}>
              Close and return the bond
            </button>
          </WalletGate>
          <TxProgress state={state} waiting="Recording the close" />
        </>
      )}
    </div>
  );
}

/** Reads the connected account's balance through the site, so the browser spends no RPC budget of its own. */
export function useBalance(address: string): { owed: bigint | null; reload: () => void } {
  const [owed, setOwed] = useState<bigint | null>(null);
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!address) {
      setOwed(null);
      return;
    }
    let live = true;
    fetch(`/api/account?address=${address}&brief=1`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((b) => live && setOwed(BigInt(b?.account?.balance ?? '0')))
      .catch(() => live && setOwed(null));
    return () => {
      live = false;
    };
  }, [address, n]);
  return { owed, reload: () => setN((v) => v + 1) };
}

/** Withdraw whatever the contract owes the connected account: the only call that pays. */
export function WithdrawBox({ title = 'Your balance' }: { title?: string }) {
  const w = useWallet();
  const { owed, reload } = useBalance(w.account);
  const { state, busy, run } = useWrite(w.account ? [`account:${w.account.toLowerCase()}`] : []);
  if (!w.account || !w.chainOk) return null;
  return (
    <div className="c-card pad flex flex-col gap-3">
      <p className="c-eyebrow">{title}</p>
      <p className="c-stat mono">{owed === null ? '…' : gen(owed)}</p>
      <p className="c-faint text-[13px]">Verdicts only move balances inside the contract. Withdraw is the one call that pays, to you, in its own transaction.</p>
      <button
        className="c-btn solid wide"
        disabled={busy || !owed || owed <= 0n}
        onClick={async () => {
          const done = await run('withdraw', []);
          if (done.phase === 'done') reload();
        }}
      >
        {owed && owed > 0n ? `Withdraw ${gen(owed)}` : 'Nothing to withdraw'}
      </button>
      <TxProgress state={state} waiting="Recording the withdrawal" />
    </div>
  );
}
