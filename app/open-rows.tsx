// F-6 · Open positions in every number (docs/features/logs/F-6/plan.md §4): the pieces the profile and the feed pane
// share. Every node carries data-open and is rendered only when the trader has open positions, so a record without
// them renders exactly today's HTML. Percent and counts only (POLICY P3); tone by the printed sign, words beside it.
import { asOfDay, OPEN, OPEN_LINE, type OpenLinePart } from '@/lib/copy.ts';
import { count, tone } from '@/lib/format.ts';
import { type OpenSummary } from '@/lib/open-split.ts';
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
// F-34: `line` (lib/copy.ts#openLine's text) is the grid's last row, full width at body size; the count tile's caption
// names the count only (Q3: the line carries the split). `paneLine` marks the pane's slot (lib/pane-model.ts#PANE_LINES).
export function OpenGrid({ o, asOf, long, line, paneLine }: { o: OpenSummary; asOf?: Date; long?: true; line?: { parts: OpenLinePart[] } | null; paneLine?: boolean }) {
  const label = OPEN.unrealizedLabel + (asOf ? OPEN.asOfLabel(asOfDay(asOf)) : '');
  return (
    <section className="stats open-stats" data-open data-long={long} aria-label={label} {...(paneLine ? { 'data-pane-line': 'open' } : {})}>
      <p className="row-label" aria-hidden="true">{label}</p>
      <div className="stat big"><b>{count(o.n)}</b><small>{line ? (o.n === 1 ? OPEN_LINE.countOne : OPEN_LINE.countMany) : OPEN.positions(o)}</small></div>
      <div className="stat big"><b className={toneClass(o.avg)}>{pct(o.avg)}</b><small>{OPEN.avgUnrealized}</small></div>
      {line && <p className="open-line" data-open-line><OpenLineText parts={line.parts} /></p>}
    </section>
  );
}

// F-34: the open line's parts as printed (textContent is the line's `text`, then `, ${asOf}` when dated): each value and
// its word in one no-wrap span, toned by the printed sign, never muted; only the as-of words are muted.
export function OpenLineText({ parts, asOf }: { parts: OpenLinePart[]; asOf?: string }) {
  return (
    <>
      {parts.map((p, k) => (
        <span key={k}>
          {p.sep}{p.label}{p.value !== null && <>{' '}<b className={p.tone === 'flat' ? undefined : p.tone ?? undefined}><span className="nw">{`${p.value}\u00a0${p.word}`}</span></b></>}
        </span>
      ))}
      {asOf && <>{', '}<span className="muted">{asOf}</span></>}
    </>
  );
}

// One average that counts every closed trade and every open position as one result, labelled as including them (AC2).
export function CombinedLine({ c }: { c: { n: number; avg: number } }) {
  return <p className="open-combined" data-open>{OPEN.combinedLabel} <b className={toneClass(c.avg)}>{pct(c.avg)}</b>{OPEN.combinedTail(c.n)}</p>;
}

// Under the chart (CH-1 plots closed trades only): what is not plotted, in words. F-34 (BL6): the open figures are in
// the open line beside the headline, so the note no longer repeats them.
export function ChartNote(_: { o: OpenSummary }) {
  return <p className="small muted chart-note" data-open>{OPEN.chartNote}{OPEN_LINE.chartNoteTail}</p>;
}
