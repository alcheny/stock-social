import type { BaselineResult, TickerSummary } from '@/lib/ticker.ts';
import { pct, rangeText } from '@/lib/trades.ts';
import { Badge } from '../../ui.tsx';

const wr = (x: number | null) => (x === null ? 'n/a' : `${Math.round(x * 100)}%`);

// One pooled aggregate, no lists, no ranking. Verdict wording is symmetric and uses the neutral text colour.
export default function Baseline({ result, summary, symbol }: { result: BaselineResult; summary: TickerSummary; symbol: string }) {
  const { kind, baseline: b } = result;
  const demo = kind === 'demo_only';
  const c = summary.conf;
  const range = c ? rangeText(c) : null;
  const base = pct(b.perTrade ?? 0);
  return (
    <section aria-label="Compared with all other stocks here" data-testid="baseline" data-symbol={symbol} data-kind={kind}>
      <h2>Compared with all other stocks here {demo && <Badge verified={false} />}</h2>
      {kind === 'empty' ? <p className="muted">No other stocks to compare with yet.</p> : (
        <>
          {summary.mixed && <p role="note" className="muted small">Includes sample data marked Demo.</p>}
          <div className="baseline-grid">
            <div className="stat">
              <small>This stock</small>
              {c?.perTrade && !demo && <b>{pct(c.perTrade.mid)}</b>}
              {c?.perTrade && !demo && <small>per-trade return (geometric mean)</small>}
              <small>{wr(summary.winRate)} win rate</small>
              <small>{summary.n} trades</small>
            </div>
            <div className="stat">
              <small>All other stocks</small>
              <b>{base}</b>
              <small>per-trade return (geometric mean)</small>
              <small>{wr(b.winRate)} win rate</small>
              <small>{b.n} trades</small>
            </div>
          </div>
          {kind === 'clearly_lower' && <p data-testid="baseline-verdict">This stock&apos;s per-trade return range {range} sits below the average for all other stocks ({base}).</p>}
          {kind === 'clearly_higher' && <p data-testid="baseline-verdict">This stock&apos;s per-trade return range {range} sits above the average for all other stocks ({base}).</p>}
          {kind === 'no_clear_difference' && <p data-testid="baseline-verdict">No clear difference: the average for all other stocks ({base}) falls inside this stock&apos;s range {range}.</p>}
          {kind === 'too_few_trades' && <p>Not enough evidence for a comparison yet.</p>}
          {demo && <p>Sample data. No comparison verdict is drawn from sample data.</p>}
          <p className="muted small">Win rate is shown for context. No range exists for it, so no verdict is drawn from it.</p>
          <p className="muted small">Baseline = {demo ? 'sample' : 'verified'} closed trades in all other stocks, pooled, as the geometric per-trade mean. {symbol} is excluded. Different traders, sizes and timing. This is context, not a prediction.</p>
        </>
      )}
    </section>
  );
}
