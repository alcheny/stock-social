import Link from 'next/link';
import { FIXES_LABELS as FL } from '@/lib/copy.ts'; // FIXES-LABELS (D-03): Demo notes
import { THESIS_CAP, type ThesisList } from '@/lib/ticker.ts';
import { pct } from '@/lib/trades.ts';
import { toneClass } from '@/lib/open-split.ts'; // A11Y-FIXES #23
import type { rowBadge } from '@/lib/pane.ts';
import { Badge, RowBadge } from '../../ui.tsx';
import { UserNote } from '@/lib/user-note.ts';
import { tradePageHref } from '@/lib/trade-href.ts'; // F-25
import { signWord, TRADE_LINK } from '@/lib/copy.ts'; // F-25

const date = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const held = (d: number) => (d < 1 ? '<1d' : `${Math.round(d)}d`);

// Newest first, no ranking. Gains and losses share one style. Text is the trader's, shown as moderated at publish time.
// badgeFor (fix round 5, TR-3): the row badge by the trader's record state; without it, the trade's own flag as before.
export default function Theses({ list, symbol, badgeFor = (v) => (v ? 'verified' : 'demo') }: { list: ThesisList; symbol: string; badgeFor?: (verified: boolean, handle: string) => ReturnType<typeof rowBadge> }) {
  return (
    <section aria-label="Why traders took these trades" data-testid="theses" data-symbol={symbol}>
      <h2>Why they traded it {list.demoOnly && <Badge verified={false} />}</h2>
      <p className="muted small" style={{ marginTop: 0 }}>Reasons traders published for closed trades in {symbol}, newest first. Showing up to {THESIS_CAP}. Text is written by the trader and is not checked for accuracy.</p>
      {/* QA round 2 (N9): the Demo sentence is said once, in the page note; the heading badge marks the section */}
      {list.mixed && <p role="note" className="muted small">{FL.mixedNote}</p>}
      {list.n === 0 ? (
        <p className="muted" data-testid="theses-empty">No published theses for this stock yet.</p>
      ) : (
        <ul className="rows thesis-rows">
          {list.items.map((r) => (
            <li key={r.id}>
              <Link href={tradePageHref({ handle: r.handle, tradeKey: r.tradeKey! })} className="trow f25-row">{/* A11Y-FIXES #22; F-25 Shape R */}
                <span className="who">@{r.handle} <RowBadge kind={badgeFor(r.verified, r.handle)} /></span>
                <b className={toneClass(r.returnPct)}><span className="sr-only">{`${signWord(r.returnPct)} `}</span>{pct(r.returnPct)}</b>{/* A11Y-FIXES #23 */}
                <span className="muted">held {held(r.holdingDays)} · {date(r.closedAt)}</span>
                <span className="sr-only">{TRADE_LINK.suffix(symbol)}</span>{/* F-25 */}
              </Link>
              {/* F-9: UserNote (no Report here yet). Fix round 2 (E): a sibling under the row link, not inside it, so the
                  link's name stays short (handle, badge, figure, held time, date). */}
              <UserNote text={r.thesis} handle={r.handle} writtenAt={r.writtenAt} editedAt={r.editedAt} />
            </li>
          ))}
        </ul>
      )}
      {list.n === THESIS_CAP && <p className="muted small">Showing the {THESIS_CAP} most recent published theses.</p>}
    </section>
  );
}
