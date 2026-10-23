import { stats } from './trades.ts';
import type { PublicState } from './connections.ts';

type PaneTrade = { returnPct: number; holdingDays: number; closedAt: Date; symbol: string };

// Everything the feed's profile pane shows, from all-time trades. Win rate and avg return come from
// stats(), the same function the profile page uses, so the two can never disagree.
export function paneSummary<T extends PaneTrade>(trades: T[]) {
  const s = stats(trades);
  const byDate = [...trades].sort((a, b) => b.closedAt.getTime() - a.closedAt.getTime());
  return {
    count: trades.length,
    winRate: s.winRate,
    avgReturn: s.avgReturn,
    since: byDate.length ? byDate[byDate.length - 1].closedAt : null, // first closed trade, not account age
    worst: trades.reduce<T | null>((w, x) => (!w || x.returnPct < w.returnPct ? x : w), null),
    recent: byDate.slice(0, 5),
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
