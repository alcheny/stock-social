import Link from 'next/link';
import type { PublicState } from '@/lib/connections.ts';
import { asOfDay, OPEN, RECORD_BODY } from '@/lib/copy.ts';
import { cardTrust } from '@/lib/pane.ts';
import { pct } from '@/lib/trades.ts';
import { openSummary } from '@/lib/open-split.ts';
import { toneClass } from './open-rows.tsx';
// FIXES-LABELS (D-05, D-09): the year rule for the close date; the F3 line on every card.
import { dateText } from '@/lib/date-text.ts';
import { Disclaimer } from './disclaimer.tsx';
import { FIXES_LABELS } from '@/lib/copy.ts';
import type { Segment } from '@/lib/record-status.ts'; // FIXES-LABELS: status
import { StatusText } from './status-line.tsx'; // FIXES-LABELS: status
import { RecordStrip } from './record-strip.tsx';
import { DISCLAIMER } from '@/lib/share.ts';
import type { Strip } from '@/lib/record-strip.ts';

export function Badge({ verified }: { verified: boolean }) {
  return verified
    ? <span className="badge verified" title="Pulled read-only from the trader's broker. Cannot be edited.">✓ Verified</span>
    : <span className="badge demo" title={FIXES_LABELS.demoNote /* FIXES-LABELS (DS-20) */}>Demo</span>;
}

// A badge chosen by a trust rule (paneTrust / cardTrust / rowBadge): null shows none.
export function RowBadge({ kind }: { kind: 'verified' | 'demo' | null }) {
  return kind ? <Badge verified={kind === 'verified'} /> : null;
}

export type TradeRow = {
  id: string; symbol: string; return_pct: number; holding_days: number; closed_at: Date; verified: boolean;
  thesis: string | null; thesis_status: string | null; handle: string; display_name: string; user_id: number;
};

const days = (d: number) => (d < 1 ? `${Math.max(1, Math.round(d * 24))}h` : `${d.toFixed(d < 10 ? 1 : 0)}d`);

// state: the trader's aggregate record state (recordStates); a failed import shows no Verified badge and the short line.
// Fix round 8 (tester re-run 4): a display name equal to the handle is shown once ("@name", not "name@name").
export function WhoName({ name, handle }: { name: string; handle: string }) {
  return <>{name !== handle && <><strong>{name}</strong>{' '}</>}<span className="muted">@{handle}</span></>;
}

// FIXES-LABELS (D-05): the close date is lib/date-text.ts#dateText (one cached formatter per variant, UTC).

// F-2 PR-4: `menu`, the feed card's "…" menu for a signed-in viewer (app/card-menu.tsx).
// F-10: `strip`, the trader's record strip (lib/record-strip.ts#recordStrip, 'feed'): it takes the place of the
// "held · closed" line, so the hero reads symbol, return, record. DS-22 (design system council, PR #48): the trust badge
// then leads the record line in .hero, not the header. `stripBadge`: the record-level badge (paneTrust, code review
// 2026-11-01), since it labels the record's figures; without it, the card's own. Without a strip (other callers) the card is unchanged.
// FIXES-LABELS: status: `status`, the card's status segments (lib/record-status.ts `card`, static mode: only a frozen or
// idle record has any), between the hero and the thesis.
export function TradeCard({ t, state = 'connected', menu, open: unrealized, openAsOf, now = new Date(), strip, stripBadge, status }: { t: TradeRow; state?: PublicState; menu?: React.ReactNode; open?: number[]; openAsOf?: Date; now?: Date; strip?: Strip; stripBadge?: 'verified' | 'demo' | null; status?: Segment[] }) {
  // F-6: one line about the trader's open positions (no symbols, no combined figure); nothing without them.
  const open = unrealized && openAsOf ? openSummary(unrealized) : null;
  const up = t.return_pct > 0;
  const trust = cardTrust(t, state);
  return (
    <article className="card">
      <header>
        <Link href={`/u/${t.handle}`} className="who">
          <WhoName name={t.display_name} handle={t.handle} />
        </Link>
        {!strip && <RowBadge kind={trust.badge} />}
        {menu}
      </header>
      {trust.incomplete && <p role="status" className="down record-failed">{RECORD_BODY.failed}</p>}
      <div className="hero">
        <div className="symbol"><Link href={`/t/${encodeURIComponent(t.symbol)}`}>{t.symbol}</Link></div>
        <div className={`ret ${up ? 'up' : 'down'}`}>{pct(t.return_pct)}</div>
        {strip ? <RecordStrip strip={strip} lead={(stripBadge === undefined ? trust.badge : stripBadge) ? <RowBadge kind={stripBadge === undefined ? trust.badge : stripBadge} /> : undefined} /> : <div className="muted">held {days(t.holding_days)} · closed {dateText(t.closed_at, now) /* FIXES-LABELS (D-05): the year when it is not this year */}</div>}
      </div>
      {status && <StatusText segments={status} kind="card" />}{/* FIXES-LABELS: status */}
      <p className="thesis">{t.thesis_status === 'published' ? `“${t.thesis}”` : <span className="muted">No thesis posted.</span>}</p>
      {open && <p className="open-also" data-open><span className="muted">{OPEN.feedLabel}</span>{OPEN.feedCounts(open)}<b className={toneClass(open.avg)}>{pct(open.avg)}</b>{OPEN.feedTail(open.n, asOfDay(openAsOf!))}</p>}
      <footer className="muted">
        <Link href={`/u/${t.handle}`}>See their record, wins and losses →</Link>
        {/* F-10 (user test 2026-11-01, F-10 AC10): with the record line, the disclaimer is in view on every card, so the
            first screen at 360 px carries it (the site footer sits below the fold). */}
        {strip && <p className="card-disclaimer" data-disclaimer>{DISCLAIMER}</p>}
      </footer>
      {/* FIXES-LABELS (D-09): the card's last child; with a strip the footer's F-10 line is the card's one F3 line. */}
      {!strip && <Disclaimer />}
    </article>
  );
}
