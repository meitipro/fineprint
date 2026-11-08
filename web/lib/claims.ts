import type { Label, Mark, Verdict } from './types';

export const MARK_LABEL: Record<Mark, string> = {
  UNTESTED: 'Untested',
  TESTED: 'Tested, held',
  UPHELD: 'Upheld',
  STRUCK: 'Struck',
};

export const MARK_HELP: Record<Mark, string> = {
  UNTESTED: 'Nobody has challenged this claim yet.',
  TESTED: 'A challenge was read and the claim was faithful. The stake went to the author.',
  UPHELD: 'A challenge landed: the validators read the claim as misstating or unsupported by its clause.',
  STRUCK: 'The author retracted the claim before it was read.',
};

export const LABEL_HELP: Record<Label, string> = {
  FAITHFUL: 'The claim says what the clause says.',
  MISSTATES: 'The claim conflicts with the clause, overstates it, or drops a condition.',
  UNSUPPORTED: 'The clause does not say what the claim says, and does not contradict it.',
};

export const VERDICT_HELP: Record<Verdict, string> = {
  UPHELD: 'The challenger gets the stake back plus 20% of the bond.',
  REJECTED: 'The stake goes to the author.',
  CORRECTED: 'The author retracted first: the challenger gets the stake back plus 10% of the bond.',
  VOID: 'Nobody could read it in time, so the stake went back and nothing was decided.',
};

/** Hours and minutes left until a chain time, from the browser's clock. */
export function timeLeft(endSeconds: number, nowMs = Date.now()): string {
  const left = endSeconds - Math.floor(nowMs / 1000);
  if (left <= 0) return 'ended';
  const hours = Math.floor(left / 3600);
  if (hours >= 48) return `${Math.floor(hours / 24)} days`;
  if (hours >= 1) return `${hours} h`;
  return `${Math.max(1, Math.floor(left / 60))} min`;
}

/** The contract's own arithmetic, in wei, for what a challenge earns. */
export function upheldBonus(bond: bigint, left: bigint): bigint {
  const share = (bond * 20n) / 100n;
  return share < left ? share : left;
}

export function correctedBonus(bond: bigint, left: bigint): bigint {
  const share = (bond * 10n) / 100n;
  return share < left ? share : left;
}
