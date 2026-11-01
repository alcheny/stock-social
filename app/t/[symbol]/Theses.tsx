import Link from 'next/link';
import { THESIS_CAP, type ThesisList } from '@/lib/ticker.ts';
import { pct } from '@/lib/trades.ts';
import { Badge, RowBadge } from '../../ui.tsx';
import { toneClass } from '../../open-rows.tsx';
import { STOCK_LABELS } from '@/lib/stock-labels.ts';

const date = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const held = (d: number) => (d < 1 ? '<1d' : `${Math.round(d)}d`);

// Newest first, no ranking. Gains and losses share one style. Text is the trader's, shown as moderated at publish time.
// badgeFor (fix round 5, TR-3): the row badge by the trader's record state; without it, the trade's own flag as before.
export default function Theses({ list, symbol, badgeFor = (v) => (v ? 'verified' : 'demo') }: { list: ThesisList; symbol: string; badgeFor?: (verified: boolean, handle: string) => 'verified' | 'demo' | null }) {
  return (
    <section aria-label="Why traders took these trades" data-testid="theses" data-symbol={symbol}>
      <h2>Why they traded it {list.demoOnly && <Badge verified={false} />}</h2>
      <p className="muted small" style={{ marginTop: 0 }}>Reasons traders published for closed trades in {symbol}, newest first. Showing up to {THESIS_CAP}. Text is written by the trader and is not checked for accuracy.</p>
      {list.demoOnly && <p role="note" className="muted small">{STOCK_LABELS.demoNote}</p>}
      {list.mixed && <p role="note" className="muted small">{STOCK_LABELS.mixedNote}</p>}
      {list.n === 0 ? (
        <p className="muted" data-testid="theses-empty">No published theses for this stock yet.</p>
      ) : (
        <ul className="rows thesis-rows">
          {list.items.map((r) => (
            <li key={r.id}>
              {/* Fix #22: the trade page by sell_id, stable across rebuilds and outside the profile's first window. */}
              <Link href={`/u/${r.handle}/trade/${encodeURIComponent(r.sellId)}`} className="trow">
                <span className="who">@{r.handle} <RowBadge kind={badgeFor(r.verified, r.handle)} /></span>
                <b className={toneClass(r.returnPct)}>{pct(r.returnPct)}</b>
                <span style={{ flexBasis: '100%', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{r.thesis}</span>
                <span className="muted">held {held(r.holdingDays)} · {date(r.closedAt)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {list.n === THESIS_CAP && <p className="muted small">Showing the {THESIS_CAP} most recent published theses.</p>}
    </section>
  );
}
