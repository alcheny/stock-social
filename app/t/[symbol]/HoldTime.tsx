import { holdCaption, MIN_HOLD_BUCKET, type HoldBuckets } from '@/lib/ticker.ts';
import { FIXES_LABELS as FL } from '@/lib/copy.ts'; // FIXES-LABELS (D-03): Demo notes
import { pct, rangeText } from '@/lib/trades.ts';
import { MIN_BETS } from '@/lib/confidence.ts';
import { Badge } from '../../ui.tsx';

// Fixed time order, no bars, no highlight, no ranking. A rate appears only for a group with enough trades.
export default function HoldTime({ holds, symbol, demoOnly, mixed }: { holds: HoldBuckets; symbol: string; demoOnly: boolean; mixed: boolean }) {
  const caption = holdCaption(holds);
  return (
    <section aria-label="Trades by hold time" data-testid="hold-time" data-symbol={symbol}>
      <h2>By hold time {demoOnly && <Badge verified={false} />}</h2>
      <p className="muted small" style={{ marginTop: 0 }}>Trades grouped by how long they were held. A group needs at least {MIN_HOLD_BUCKET} trades before a rate is shown.</p>
      {/* QA round 2 (N9): the Demo sentence is said once, in the page note; the heading badge marks the section */}
      {mixed && <p role="note" className="muted small">{FL.mixedNote}</p>}
      <p className="muted small" data-testid="hold-caption">{caption}</p>
      <table className="hold-table">
        <caption className="sr-only">{caption}</caption>
        <thead><tr><th scope="col">Hold time</th><th scope="col">Trades</th><th scope="col">Win rate</th><th scope="col">Avg return</th></tr></thead>
        <tbody>
        {holds.buckets.map((b) => (
            <tr key={b.key}>
              <th scope="row">{b.label}</th>
              <td>{b.n}</td>
              {b.shown ? (
                <>
                  <td>{Math.round(b.winRate! * 100)}%</td>
                  <td>
                    <span className={b.avgReturn! > 0 ? 'up' : b.avgReturn! < 0 ? 'down' : undefined}>{pct(b.avgReturn!)}</span>
                    <small className="muted range">{rangeText(b.conf!) ? `${rangeText(b.conf!)} · 95% range` : `Too early to tell (${b.conf!.k} of ${MIN_BETS} bets)`}</small>
                  </td>
                </>
              ) : (
                <td colSpan={2} className="muted">Too few trades to show a rate</td>
              )}
            </tr>
        ))}
        </tbody>
      </table>
      <p className="muted small">Different traders, different sizes and timing. Hold time is not a signal on its own.</p>
    </section>
  );
}
