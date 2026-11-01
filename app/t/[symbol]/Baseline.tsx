import type { BaselineResult, TickerSummary } from '@/lib/ticker.ts';
import { baselineLines } from '@/lib/ticker.ts';
import type { Confidence } from '@/lib/trades.ts';
import { FIXES_LABELS as FL } from '@/lib/copy.ts';
import { Badge } from '../../ui.tsx';

const wr = (x: number | null) => (x === null ? 'n/a' : `${Math.round(x * 100)}%`);

// FIXES-LABELS (D-07): facts only. This stock and the other stocks recorded here, as counts with the same 95% per-trade
// range on both sides (or counts only on both), then one context line. No verdict, no difference, no rating of a stock.
// `result.kind` (baselineVerdict) stays as the section's data-kind for the existing e2e; it no longer prints a line.
export default function Baseline({ result, summary, symbol, others }: { result: BaselineResult; summary: TickerSummary; symbol: string; others: { n: number; winRate: number | null; conf: Confidence | null } }) {
  const { kind } = result;
  const demo = kind === 'demo_only';
  const l = baselineLines(symbol, summary, others);
  return (
    <section aria-label={FL.baselineHeading} data-testid="baseline" data-symbol={symbol} data-kind={kind}>
      <h2>{FL.baselineHeading} {demo && <Badge verified={false} />}</h2>
      {kind === 'empty' ? <p className="muted">No other stocks to compare with yet.</p> : (
        <>
          {demo && <p role="note" className="muted small">{FL.demoNote}</p>}
          {summary.mixed && <p role="note" className="muted small">{FL.mixedNote}</p>}
          <div className="baseline-grid">
            <div className="stat">
              <small>{FL.baselineThisTile}</small>
              <small>{wr(summary.winRate)} win rate</small>
              <small>{summary.n} trades</small>
            </div>
            <div className="stat">
              <small>{FL.baselineOthersTile}</small>
              <small>{wr(others.winRate)} win rate</small>
              <small>{others.n} trades</small>
            </div>
          </div>
          <p data-testid="baseline-this">{l.this}</p>
          <p data-testid="baseline-others">{l.others}</p>
          <p className="muted small">{l.note}</p>
        </>
      )}
    </section>
  );
}
