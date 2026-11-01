// F-6 · Open positions in every number (docs/features/logs/F-6/plan.md §4): the pieces the profile and the feed pane
// share. Every node carries data-open and is rendered only when the trader has open positions, so a record without
// them renders exactly today's HTML. Percent and counts only (POLICY P3); tone by the printed sign, words beside it.
import { OPEN } from '@/lib/copy.ts';
import { count } from '@/lib/format.ts';
import { tone, type OpenSummary } from '@/lib/open-split.ts';
import { pct } from '@/lib/trades.ts';

export const toneClass = (x: number) => { const t = tone(x); return t === 'flat' ? undefined : t; };

// The realized grid's row label (first child of the existing grid, spanning it).
export function RealizedLabel() {
  return <p className="row-label" data-open>{OPEN.realizedLabel}</p>;
}

// The unrealized grid: same size as the realized headline directly above it (TR-4: "as prominent as the headline").
export function OpenGrid({ o }: { o: OpenSummary }) {
  return (
    <section className="stats open-stats" data-open aria-label={OPEN.unrealizedLabel}>
      <p className="row-label">{OPEN.unrealizedLabel}</p>
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
