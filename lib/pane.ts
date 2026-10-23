import { headline } from './trades.ts';
import type { PublicState } from './connections.ts';

type PaneTrade = { returnPct: number; holdingDays: number; closedAt: Date; symbol: string };

// Everything the feed's profile pane shows, from all-time trades. Win rate and avg return come from
// headline(), which stats() (the profile page's) uses too, so the two can never disagree.
// F-2 PR-1 fix round 2 (render cost, 4,700-close records): one pass, no sort of the whole record. `recent` is the 5 latest
// closes, newest first, ties in input order (as the stable sort gave).
export function paneSummary<T extends PaneTrade>(trades: T[]) {
  const { winRate, avgReturn } = headline(trades);
  let since: Date | null = null;
  const recent: T[] = [];
  for (const t of trades) {
    const at = t.closedAt.getTime();
    if (!since || at < since.getTime()) since = t.closedAt;
    if (recent.length === 5 && at <= recent[4].closedAt.getTime()) continue;
    let i = recent.length;
    while (i > 0 && recent[i - 1].closedAt.getTime() < at) i--;
    recent.splice(i, 0, t);
    if (recent.length > 5) recent.pop();
  }
  return {
    count: trades.length,
    winRate,
    avgReturn,
    since, // first closed trade, not account age
    worst: trades.reduce<T | null>((w, x) => (!w || x.returnPct < w.returnPct ? x : w), null),
    recent,
  };
}

// One batched query for every visible trader, split here instead of one query per feed item.
export function groupByUser<T extends { userId: number }>(rows: T[]): Map<number, T[]> {
  const m = new Map<number, T[]>();
  // F-2 PR-1 load check: push, not copy (copying the array per row was quadratic: ~0.3 s for a few 4,700-close records).
  for (const r of rows) { const a = m.get(r.userId); if (a) a.push(r); else m.set(r.userId, [r]); }
  return m;
}

// Fix round 4 (TR-3): what the feed pane says about the record's trust, from the aggregate record state (an importing
// record never reaches the pane: the feed leaves it out until it is whole). A failed
// import stays in the feed (incompleteness is never hidden) but is never presented as whole: no Verified badge, and
// the profile's incomplete line beside the stats. Demo data keeps its Demo badge.
export function paneTrust(trades: { verified: boolean }[], state: PublicState): { badge: 'verified' | 'demo' | null; incomplete: boolean } {
  const verified = trades.length > 0 && trades.every((t) => t.verified);
  if (state === 'failed') return { badge: verified ? null : 'demo', incomplete: true };
  return { badge: verified ? 'verified' : 'demo', incomplete: false };
}

// Fix round 5 (TR-3): the feed's trade card applies the same rule to the trade it shows, with the trader's aggregate
// record state, so the card never shows Verified beside a record the pane and profile present as incomplete.
export function cardTrust(t: { verified: boolean }, state: PublicState = 'connected') {
  return paneTrust([t], state);
}

// Fix round 5 (TR-3): a per-trade row elsewhere (stock page trade and thesis rows) gets its badge by the same rule: no
// Verified badge beside a trader whose record state is failed; Demo kept for demo data.
export function rowBadge(verified: boolean, state?: PublicState): 'verified' | 'demo' | null {
  return cardTrust({ verified }, state).badge;
}
