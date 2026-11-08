/** What the contract's views answer. Money is a decimal string of wei; times are chain seconds. */

export type Label = 'FAITHFUL' | 'MISSTATES' | 'UNSUPPORTED';
export type Verdict = 'UPHELD' | 'REJECTED' | 'CORRECTED' | 'VOID';
export type Mark = 'UNTESTED' | 'TESTED' | 'UPHELD' | 'STRUCK';

export type Totals = {
  docs: number;
  summaries: number;
  challenges: number;
  received: string;
  bonds_left: string;
  stakes_held: string;
  owed: string;
  paid: string;
};

export type NotFound = { found: false; totals: Totals };

export type SummaryRow = {
  id: number;
  doc_id: string;
  doc_title: string;
  author: string;
  claims: number;
  bond: string;
  stake: string;
  bond_left: string;
  paid_out: string;
  window_hours: number;
  posted_at: number;
  window_end: number;
  state: 'OPEN' | 'STANDS';
  closed_at: number;
  closed_by: string;
  open_challenges: number;
  challenges: number;
  upheld: number;
  rejected: number;
  corrected: number;
};

export type ClaimRow = {
  no: number;
  clause: number;
  text: string;
  mark: Mark;
  challenges: number;
  open_challenge: number;
};

export type Summary = SummaryRow & {
  found: true;
  claim_rows: ClaimRow[];
  challenge_ids: number[];
  totals: Totals;
};

export type Doc = {
  found: true;
  id: string;
  title: string;
  registrar: string;
  registered_at: number;
  clauses: { no: number; text: string }[];
  summary_count: number;
  summaries: SummaryRow[];
  totals: Totals;
};

export type Challenge = {
  found: true;
  id: number;
  summary_id: number;
  doc_id: string;
  doc_title: string;
  author: string;
  claim_no: number;
  claim: string;
  claim_mark: Mark;
  clause_no: number;
  clause: string;
  against: number;
  against_clause: string;
  challenger: string;
  stake: string;
  reason: string;
  label: Label | '';
  verdict: Verdict | '';
  to_challenger: string;
  bonus: string;
  to_author: string;
  created_at: number;
  judge_deadline: number;
  resolved_at: number;
  resolved_by: string;
  summary_state: 'OPEN' | 'STANDS';
  bond: string;
  bond_left: string;
  window_end: number;
  totals: Totals;
};

export type Account = {
  found: true;
  account: string;
  balance: string;
  earned: string;
  withdrawn: string;
  summary_count: number;
  summaries: number[];
  challenge_count: number;
  challenges: number[];
  totals: Totals;
};
