// F-23 · Public payloads carry no more precision than the screens show (docs/features/F-23-public-payload-precision.md).
// Everything the feed's profile pane prints, computed once on the server from stored values, then rounded to what it
// prints (lib/public-wire.ts). The feed renders the pane from it on the server; the /u/<h>/pane route sends it as JSON
// and app/lazy-pane.tsx renders the same pane from it, so the browser never recomputes a figure from rounded closes
// (a stored average of 0.024499999 prints "+2.4%"; its closes rounded to 1 decimal could average to "+2.5%").
import { paneSummary, paneTrust, type TrustBadge } from './pane.ts';
import { paneEvidence } from './pane-evidence.ts';
import { combined, openFacts, openSummary, type OpenSummary } from './open-split.ts';
import { openLine, type OpenLine } from './copy.ts'; // F-34: the one producer
import type { PublicState } from './connections.ts';
import { isoDay, wireDay, wirePct, wireRate } from './public-wire.ts';

export type PaneModelTrade = { id: string; symbol: string; returnPct: number; holdingDays: number; closedAt: Date; thesis: string | null; verified: boolean; openedAt?: Date };
export type PaneModel = {
  count: number;
  winRate: number; // the printed whole percent, as a fraction
  avgReturn: number;
  since: string | null; // 'YYYY-MM-DD' of the first close
  worst: { symbol: string; returnPct: number } | null;
  recent: { id: string; symbol: string; day: number; returnPct: number }[]; // the last 5, newest first; `day`: UTC day
  badge: TrustBadge | null;
  incomplete: boolean;
  rangeLine: string | null; // "‹range› · 95% range", as printed
  newRecord: boolean;
  open: OpenSummary | null; // n, up, down, flat (counts, by printed tone) and avg
  openAsOf: string | null; // 'YYYY-MM-DD' of the oldest position read
  both: { n: number; avg: number } | null;
  // F-34: the open line, built here so the pane prints it as received (printed strings and tones only; no extra number).
  openLine: Pick<OpenLine, 'text' | 'parts' | 'withAsOf'> | null;
};
// F-34 (plan §7): the pane's lines after the realized stats, in this order, one line each. `exclusions` is F-21's slot and
// `options` F-29's (nothing renders until they are built); `open` is the open grid with its line.
export const PANE_LINES = ['exclusions', 'open', 'options'] as const;

export function paneModel(trades: PaneModelTrade[], state: PublicState, now: Date, unrealized: number[] = [], openAsOf?: Date | null): PaneModel {
  const p = paneSummary(trades);
  const o = openSummary(unrealized);
  const both = o && combined(trades.map((t) => t.returnPct), unrealized);
  const trust = paneTrust(trades, state);
  const ev = paneEvidence(trades, now);
  return {
    count: p.count,
    winRate: wireRate(p.winRate),
    avgReturn: wirePct(p.avgReturn),
    since: p.since && isoDay(p.since),
    worst: p.worst && { symbol: p.worst.symbol, returnPct: wirePct(p.worst.returnPct) },
    recent: p.recent.map((t) => ({ id: t.id, symbol: t.symbol, day: wireDay(t.closedAt), returnPct: wirePct(t.returnPct) })),
    badge: trust.badge,
    incomplete: trust.incomplete,
    rangeLine: ev.rangeLine,
    newRecord: ev.newRecord,
    open: o && { ...o, avg: wirePct(o.avg) },
    openAsOf: o && openAsOf ? isoDay(openAsOf) : null,
    both: both && { n: both.n, avg: wirePct(both.avg) },
    openLine: ((l) => l && { text: l.text, parts: l.parts, withAsOf: l.withAsOf })(openLine(openFacts(unrealized), o && openAsOf ? openAsOf : null)),
  };
}
