import type { TickerSummary } from '@/lib/ticker.ts';
import { baselineKind, baselineLines } from '@/lib/ticker.ts';
import type { Confidence } from '@/lib/trades.ts';
import { FIXES_LABELS as FL } from '@/lib/copy.ts';
import { Badge } from '../../ui.tsx';

const wr = (x: number | null) => (x === null ? 'n/a' : `${Math.round(x * 100)}%`);

// FIXES-LABELS (D-07): facts only. This stock and the other stocks recorded here, as counts with the same 95% per-trade
// range on both sides (or counts only on both), then one context line. No verdict, no difference, no rating of a stock.
// Code review (POLICY F3b): data-kind is baselineKind() — empty, demo_only, too_few_trades or the neutral 'shown', never
// a verdict. On a mixed stock `self` is this stock's verified trades only, the same population as the other side.
type Side = { n: number; traders: number; winRate: number | null; conf: Confidence | null };
export default function Baseline({ summary, symbol, others, self }: { summary: TickerSummary; symbol: string; others: { n: number; winRate: number | null; conf: Confidence | null }; self: Side | null }) {
  const kind = baselineKind(summary, others, self); // QA round 2 (N6): the side the lines print
  const demo = kind === 'demo_only';
  const mine: Side & { verifiedOnly: boolean } = self ? { ...self, verifiedOnly: true } : { n: summary.n, traders: summary.traders, winRate: summary.winRate, conf: summary.conf, verifiedOnly: false };
  const l = baselineLines(symbol, mine, others);
  return (
    <section aria-label={FL.baselineHeading} data-testid="baseline" data-symbol={symbol} data-kind={kind}>
      <h2>{FL.baselineHeading} {demo && <Badge verified={false} />}</h2>
      {kind === 'empty' ? <p className="muted">No other stocks to compare with yet.</p> : (
        <>
          {/* QA round 2 (N9): the Demo sentence is said once, in the page note; the heading badge marks the section */}
          {summary.mixed && <p role="note" className="muted small" data-testid="baseline-mixed">{self ? FL.baselineMixedNote : FL.mixedNote}</p>}
          <div className="baseline-grid">
            <div className="stat">
              <small>{FL.baselineThisTile}</small>
              <small>{wr(mine.winRate)} win rate</small>
              <small>{mine.n} trades</small>
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
