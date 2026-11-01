// F-6 · Open positions in every number (docs/features/logs/F-6/plan.md §4): the pieces the profile and the feed pane
// share. Every node carries data-open and is rendered only when the trader has open positions, so a record without
// them renders exactly today's HTML. Percent and counts only (POLICY P3); tone by the printed sign, words beside it.
import { asOfDay, OPEN } from '@/lib/copy.ts';
import { count } from '@/lib/format.ts';
import { tone, type OpenSummary } from '@/lib/open-split.ts';
import { pct } from '@/lib/trades.ts';

export const toneClass = (x: number) => { const t = tone(x); return t === 'flat' ? undefined : t; };

// Long values (8+ characters, e.g. "+6122.6%") take a smaller shared size in both grids (data-long), so every big value
// keeps a fifth of its tile spare at 360 px whatever the font (CI's renders wider) and the two rows stay equal (TR-4).
export const longValues = (...shown: string[]) => (shown.some((t) => t.length >= 8) ? true : undefined);

// The realized grid's row label (first child of the existing grid, spanning it). The grid itself carries the same
// words as its region name (UX lead D3), so the visible label is not read twice.
export function RealizedLabel() {
  return <p className="row-label" data-open aria-hidden="true">{OPEN.realizedLabel}</p>;
}

// The unrealized grid: same size as the realized headline directly above it (TR-4: "as prominent as the headline").
// `asOf`: the oldest read of the positions, so a record that stopped refreshing never reads as current (D3).
export function OpenGrid({ o, asOf, long }: { o: OpenSummary; asOf?: Date; long?: true }) {
  const label = OPEN.unrealizedLabel + (asOf ? OPEN.asOfLabel(asOfDay(asOf)) : '');
  return (
    <section className="stats open-stats" data-open data-long={long} aria-label={label}>
      <p className="row-label" aria-hidden="true">{label}</p>
      <div className="stat big"><b>{count(o.n)}</b><small>{OPEN.positions(o)}</small></div>
      <div className="stat big"><b className={toneClass(o.avg)}>{pct(o.avg)}</b><small>{OPEN.avgUnrealized}</small></div>
    </section>
  );
}

// One average that counts every closed trade and every open position as one result, labelled as including them (AC2).
export function CombinedLine({ c }: { c: { n: number; avg: number } }) {
  return <p className="open-combined" data-open>{OPEN.combinedLabel} <b className={toneClass(c.avg)}>{pct(c.avg)}</b>{OPEN.combinedTail(c.n)}</p>;
}

// Under the chart (CH-1 plots closed trades only): what is not plotted, in words.
export function ChartNote({ o }: { o: OpenSummary }) {
  return <p className="small muted chart-note" data-open>{OPEN.chartNote}{OPEN.line(o, pct)}</p>;
}
