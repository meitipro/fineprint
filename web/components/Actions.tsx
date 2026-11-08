'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { CONTRACT, readClient, retried } from '@/lib/genlayer-core.mjs';
import { refreshReads, send, type TxState } from '@/lib/write';

import { Tx } from './ui';
import { useWallet } from './Wallet';

/** A fresh read from the browser, skipping the site's cache. */
export async function readFresh<T>(method: string, args: (number | string)[]): Promise<T> {
  const raw = await retried(() => readClient().readContract({ address: CONTRACT, functionName: method, args }), 4);
  return JSON.parse(String(raw)) as T;
}

/** While a transaction is in flight: what is happening, with its link. */
export function TxProgress({ state, waiting }: { state: TxState; waiting: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (state.phase !== 'deciding' && state.phase !== 'signing') return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [state.phase]);
  if (state.phase === 'idle') return null;
  if (state.phase === 'signing') {
    return (
      <div className="c-note flex items-center gap-2">
        <span className="c-spin" /> Confirm the transaction in your wallet.
      </div>
    );
  }
  if (state.phase === 'deciding') {
    const s = Math.max(0, Math.round((now - (state.startedAt ?? now)) / 1000));
    return (
      <div className="c-note accent flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="c-spin" />
        <span>{waiting}</span>
        <span className="mono text-[12px]">{s} s</span>
        {state.hash && <Tx hash={state.hash} label="tx" />}
      </div>
    );
  }
  if (state.phase === 'refused' || state.phase === 'error') {
    return (
      <div className="c-note" style={{ color: 'var(--danger)' }}>
        <p>
          {state.phase === 'refused' && !state.message?.startsWith('The validators could not agree') ? 'The contract refused: ' : ''}
          {state.message}
        </p>
        {state.hash && (
          <p className="mt-1">
            <Tx hash={state.hash} label="tx" />
          </p>
        )}
        <p className="c-faint mt-1 text-[12.5px]">Nothing changed. You can try again.</p>
      </div>
    );
  }
  if (state.phase === 'done' && state.hash) {
    return (
      <div className="c-note accent flex flex-wrap items-center gap-x-3">
        <span>Done{state.seconds !== undefined ? ` in ${state.seconds} s` : ''}.</span>
        <Tx hash={state.hash} label="tx" />
      </div>
    );
  }
  return null;
}

/** Send one write, then drop the cached reads it touched and re-render. */
export function useWrite(tags: string[]) {
  const w = useWallet();
  const router = useRouter();
  const [state, setState] = useState<TxState>({ phase: 'idle' });
  const busy = state.phase === 'signing' || state.phase === 'deciding';
  async function run(method: string, args: unknown[], value = 0n): Promise<TxState> {
    const done = await send(w.account, method, args, value, setState);
    if (done.phase === 'done') {
      await refreshReads(['chain', ...tags]);
      w.refreshBalance();
      router.refresh();
    }
    return done;
  }
  return { w, state, setState, busy, run };
}
