'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { correctedBonus, upheldBonus } from '@/lib/claims';
import { gen, toWei } from '@/lib/format';
import { docIdOf, length, normaliseBlock, normaliseLine } from '@/lib/hash.mjs';

import { TxProgress, useWrite } from './Actions';
import { WalletGate } from './Wallet';

export type KnownDoc = { id: string; title: string; clauses: string[] };

const MIN_BOND = 10n * 10n ** 18n;

type Claim = { clause: number; text: string };
type Preview = { label?: string; message?: string };

/** Register a document if it is new, write 3 to 8 claims against its clauses, set a bond and a window, post. */
export function PostForm({ docs, initialDoc }: { docs: KnownDoc[]; initialDoc?: string }) {
  const router = useRouter();
  const first = docs.find((d) => d.id === initialDoc);
  const [mode, setMode] = useState<'pick' | 'paste'>(first || docs.length > 0 ? 'pick' : 'paste');
  const [picked, setPicked] = useState(first?.id ?? docs[0]?.id ?? '');
  const [title, setTitle] = useState('');
  const [clauses, setClauses] = useState<string[]>(['', '', '']);
  const [registered, setRegistered] = useState<KnownDoc | null>(null);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [draft, setDraft] = useState('');
  const [cites, setCites] = useState(1);
  const [bondText, setBondText] = useState('20');
  const [hours, setHours] = useState(72);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const reg = useWrite([]);
  const post = useWrite(['chain']);

  const normTitle = normaliseLine(title);
  const normClauses = clauses.map(normaliseBlock);
  const filled = normClauses.filter((c) => c !== '');
  const pastedId = useMemo(() => (filled.length >= 3 && normTitle ? docIdOf(title, filled) : ''), [title, filled.join('\u0000'), normTitle]); // eslint-disable-line react-hooks/exhaustive-deps
  const problems: string[] = [];
  if (mode === 'paste') {
    if (!normTitle) problems.push('A title.');
    else if (length(normTitle) > 80) problems.push('The title is longer than 80 characters.');
    if (filled.length < 3) problems.push('At least 3 clauses.');
    if (filled.length > 12) problems.push('At most 12 clauses.');
    filled.forEach((c, i) => length(c) > 500 && problems.push(`Clause ${i + 1} is longer than 500 characters.`));
  }

  const known = docs.find((d) => d.id === picked);
  const active: KnownDoc | null = registered ?? (mode === 'pick' ? known ?? null : null);
  const bond = toWei(bondText);
  const stake = bond ? bond / 10n : 0n;
  const claimProblems: string[] = [];
  if (claims.length < 3) claimProblems.push(`${3 - claims.length} more claim${3 - claims.length === 1 ? '' : 's'} (3 to 8).`);
  if (!bond || bond < MIN_BOND) claimProblems.push('A bond of at least 10 GEN.');

  async function register() {
    const done = await reg.run('register_doc', [normTitle, filled]);
    if (done.phase === 'done' && typeof done.returned === 'string') {
      setRegistered({ id: done.returned, title: normTitle, clauses: filled });
      setCites(1);
    } else if (done.phase === 'refused' && done.message) {
      const m = /already registered as ([0-9a-f]{64})/.exec(done.message);
      if (m) setRegistered({ id: m[1], title: normTitle, clauses: filled });
    }
  }

  function addClaim() {
    const text = draft.replace(/\s+/g, ' ').trim();
    if (!text || length(text) > 200 || claims.length >= 8) return;
    setClaims([...claims, { clause: cites, text }]);
    setDraft('');
    setPreview(null);
  }

  async function check() {
    if (!active) return;
    const text = draft.replace(/\s+/g, ' ').trim();
    if (!text) return;
    setPreviewing(true);
    setPreview(null);
    try {
      const response = await fetch('/api/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clause: active.clauses[cites - 1], claim: text, clause_no: cites }),
      });
      setPreview(await response.json());
    } catch {
      setPreview({ message: 'The preview did not answer.' });
    } finally {
      setPreviewing(false);
    }
  }

  async function postIt() {
    if (!active || !bond) return;
    const done = await post.run('post_summary', [active.id, JSON.stringify(claims), hours], bond);
    if (done.phase === 'done' && done.returned !== undefined) router.push(`/s/${String(done.returned)}`);
  }

  const upheld = bond ? upheldBonus(bond, bond) : 0n;
  const corrected = bond ? correctedBonus(bond, bond) : 0n;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
      <div className="flex flex-col gap-6">
        {/* -- the document ---------------------------------------------------- */}
        <section className="c-card pad flex flex-col gap-4" aria-labelledby="doc-h">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="doc-h" className="c-h3">1. The document</h2>
            {!registered && (
              <div className="flex gap-2" role="tablist" aria-label="Document source">
                {docs.length > 0 && (
                  <button role="tab" aria-selected={mode === 'pick'} className="c-tab" onClick={() => setMode('pick')}>
                    A registered document
                  </button>
                )}
                <button role="tab" aria-selected={mode === 'paste'} className="c-tab" onClick={() => setMode('paste')}>
                  Paste new terms
                </button>
              </div>
            )}
          </div>

          {registered ? (
            <div className="c-note accent">
              <p>
                <b>{registered.title}</b> · {registered.clauses.length} clauses · document <span className="mono">{registered.id.slice(0, 8)}…{registered.id.slice(-4)}</span>
              </p>
              <p className="mt-1">Registered. The text is fixed by its hash and can never be edited; a new version is a new document.</p>
            </div>
          ) : mode === 'pick' ? (
            <div className="flex flex-col gap-2">
              <label className="c-label" htmlFor="pick">Pick a document</label>
              <select id="pick" className="c-select" value={picked} onChange={(e) => { setPicked(e.target.value); setCites(1); }}>
                {docs.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.title} · {d.clauses.length} clauses · {d.id.slice(0, 8)}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="c-note">Documents are public and cannot be edited. Check the pasted text against the original before you register it.</div>
              <div>
                <label className="c-label" htmlFor="title">Title ({length(normTitle)}/80)</label>
                <input id="title" className="c-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Kiln airdrop terms" />
              </div>
              {clauses.map((text, i) => (
                <div key={i}>
                  <label className="c-label" htmlFor={`clause-${i}`}>Clause {i + 1} ({length(normaliseBlock(text))}/500)</label>
                  <div className="flex gap-2">
                    <textarea id={`clause-${i}`} className="c-textarea" style={{ minHeight: 78 }} value={text} onChange={(e) => setClauses(clauses.map((c, j) => (j === i ? e.target.value : c)))} />
                    {clauses.length > 3 && (
                      <button className="c-btn small ghost" onClick={() => setClauses(clauses.filter((_, j) => j !== i))} aria-label={`Remove clause ${i + 1}`}>
                        ×
                      </button>
                    )}
                  </div>
                </div>
              ))}
              <div className="flex flex-wrap items-center gap-3">
                <button className="c-btn small" disabled={clauses.length >= 12} onClick={() => setClauses([...clauses, ''])}>
                  Add a clause
                </button>
                {pastedId && <span className="c-faint mono text-[12px]">id {pastedId.slice(0, 12)}…</span>}
              </div>
              {problems.length > 0 && <p className="c-faint text-[13px]">Still needed: {problems.join(' ')}</p>}
              <WalletGate action="register this document">
                <button className="c-btn solid" disabled={reg.busy || problems.length > 0} onClick={register}>
                  Register the document
                </button>
              </WalletGate>
              <TxProgress state={reg.state} waiting="Recording the document" />
            </div>
          )}
        </section>

        {/* -- the claims ---------------------------------------------------------- */}
        <section className="c-card pad flex flex-col gap-4" aria-labelledby="claims-h" style={{ opacity: active ? 1 : 0.5 }}>
          <h2 id="claims-h" className="c-h3">2. Your claims, each against a clause</h2>
          {!active ? (
            <p className="c-muted text-[14px]">Pick or register a document first.</p>
          ) : (
            <>
              <div>
                <label className="c-label" htmlFor="draft">Claim in plain words ({length(draft.trim())}/200)</label>
                <textarea id="draft" className="c-textarea" style={{ minHeight: 70 }} maxLength={400} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="A quarter of the tokens are available at claim, the rest vests over twelve months." />
                <p className="c-faint mt-1 text-[12.5px]">In your own words, in any language, not a copy of the clause.</p>
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="c-label" htmlFor="cites">Cites clause</label>
                  <select id="cites" className="c-select mono" value={cites} onChange={(e) => { setCites(Number(e.target.value)); setPreview(null); }}>
                    {active.clauses.map((_, i) => (
                      <option key={i} value={i + 1}>{i + 1}</option>
                    ))}
                  </select>
                </div>
                <button className="c-btn" onClick={check} disabled={previewing || !draft.trim()}>
                  {previewing ? 'Checking…' : 'Check before posting'}
                </button>
                <button className="c-btn solid" onClick={addClaim} disabled={!draft.trim() || length(draft.trim()) > 200 || claims.length >= 8}>
                  Add claim {claims.length + 1}
                </button>
              </div>
              {preview && (
                <div className={`c-note ${preview.label === 'FAITHFUL' ? 'accent' : ''}`}>
                  {preview.label ? (
                    <p>One model reads this claim as <b className="mono">{preview.label}</b>. A preview is never binding: the validators decide only if someone challenges the claim.</p>
                  ) : (
                    <p>{preview.message}</p>
                  )}
                </div>
              )}
              <div>
                <p className="c-eyebrow mb-1">Your claims so far</p>
                {claims.length === 0 ? (
                  <p className="c-faint text-[13.5px]">None yet. A summary has 3 to 8 claims.</p>
                ) : (
                  claims.map((c, i) => (
                    <div key={i} className="c-field-row">
                      <span className="text-[14.5px]">
                        <span className="mono c-faint">#{i + 1} clause {c.clause}</span> {c.text}
                      </span>
                      <button className="c-btn small ghost" onClick={() => setClaims(claims.filter((_, j) => j !== i))} aria-label={`Remove claim ${i + 1}`}>
                        ×
                      </button>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </section>

        {/* -- bond and window -------------------------------------------------------- */}
        <section className="c-card pad flex flex-col gap-4" aria-labelledby="bond-h" style={{ opacity: active ? 1 : 0.5 }}>
          <h2 id="bond-h" className="c-h3">3. Bond and window</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="c-label" htmlFor="bond">Bond, GEN (at least 10)</label>
              <input id="bond" className="c-input mono" inputMode="decimal" value={bondText} onChange={(e) => setBondText(e.target.value)} />
            </div>
            <div>
              <label className="c-label" htmlFor="hours">Challenge window, hours (24 to 168)</label>
              <input id="hours" type="number" min={24} max={168} className="c-input mono" value={hours} onChange={(e) => setHours(Math.max(24, Math.min(168, Number(e.target.value) || 24)))} />
            </div>
          </div>
          {claimProblems.length > 0 && <p className="c-faint text-[13px]">Still needed: {claimProblems.join(' ')}</p>}
          <WalletGate action="post this summary">
            <button className="c-btn solid wide" disabled={!active || post.busy || claimProblems.length > 0} onClick={postIt}>
              Post with {bond ? gen(bond) : '…'} bond
            </button>
          </WalletGate>
          <p className="c-faint text-[12.5px]">Network fee estimated by your wallet.</p>
          <TxProgress state={post.state} waiting="Recording your summary" />
        </section>
      </div>

      {/* -- the side: price and the clause beside you --------------------------------- */}
      <aside className="flex flex-col gap-6 lg:sticky lg:top-24 lg:self-start">
        <div className="c-card pad">
          <p className="c-eyebrow">Bond and window</p>
          <div className="mt-2">
            <div className="c-field-row"><span className="c-muted">Bond</span><b className="mono">{bond ? gen(bond) : '—'}</b></div>
            <div className="c-field-row"><span className="c-muted">Challenge stake</span><b className="mono">{bond ? gen(stake) : '—'}</b></div>
            <div className="c-field-row"><span className="c-muted">Window</span><b className="mono">{hours} hours</b></div>
            <div className="c-field-row"><span className="c-muted">An upheld claim costs</span><b className="mono">{bond ? gen(upheld) : '—'}</b></div>
            <div className="c-field-row"><span className="c-muted">A claim you retract costs</span><b className="mono">{bond ? gen(corrected) : '—'}</b></div>
            <div className="c-field-row"><span className="c-muted">Bond back if the window ends clean</span><b className="mono">{bond ? gen(bond) : '—'}</b></div>
          </div>
          <p className="c-faint mt-3 text-[12.5px]">The price of being wrong, shown before you sign. A rejected challenge pays its stake to you.</p>
        </div>
        <div className="c-card pad">
          <p className="c-eyebrow">Clause {active ? cites : '—'}, for reference</p>
          {active ? (
            <div className="c-clause mt-2">
              <span className="no">Clause {cites}</span>
              <p>{active.clauses[cites - 1]}</p>
            </div>
          ) : (
            <p className="c-faint mt-2 text-[13.5px]">Pick a clause to see it here, so the claim and the clause are read together.</p>
          )}
        </div>
      </aside>
    </div>
  );
}
