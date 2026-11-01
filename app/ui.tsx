import Link from 'next/link';
import type { PublicState } from '@/lib/connections.ts';
import { asOfDay, isPublicRecord, OPEN, PUBLIC, RECORD_BODY } from '@/lib/copy.ts';
import { cardTrust, type TrustBadge } from '@/lib/pane.ts';
import { pct } from '@/lib/trades.ts';
import { openSummary } from '@/lib/open-split.ts';
import { toneClass } from './open-rows.tsx';

// F-7: `kind` 'public' / 'public_demo' is the "Public filing" badge (Demo beside it on a fictional fixture), never Verified.
export function Badge({ verified, kind = verified ? 'verified' : 'demo' }: { verified?: boolean; kind?: TrustBadge }) {
  if (kind === 'public' || kind === 'public_demo') return <>{kind === 'public_demo' && <Badge kind="demo" />}<span className="badge public" title={PUBLIC.badgeTitle}>{PUBLIC.badge}</span></>;
  return kind === 'verified'
    ? <span className="badge verified" title="Pulled read-only from the trader's broker. Cannot be edited.">✓ Verified</span>
    : <span className="badge demo" title="Sample data, not from a real broker.">Demo</span>;
}

// A badge chosen by a trust rule (paneTrust / cardTrust / rowBadge): null shows none.
export function RowBadge({ kind }: { kind: TrustBadge | null }) {
  return kind ? <Badge kind={kind} /> : null;
}

// F-7 (legal C15, plan Round 5 item 4): the not-joined line and the correction link, from one copy constant, on the
// profile, pane, trade and month pages of a public record.
export function PublicNotice({ link = true }: { link?: boolean }) {
  return <p className="public-line" data-public-line>{PUBLIC.notJoined}{link && <> <Link className="tap44" href="/public-records">{PUBLIC.correction}</Link></>}</p>;
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

// F-2 PR-1 fix round 2 (render cost): one formatter, not one per card (toLocaleDateString with options builds a new one
// each call, ~0.1 ms). Same locale, options and time zone, so the same text.
const CLOSED_DAY = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });

// F-2 PR-4: `menu`, the feed card's "…" menu for a signed-in viewer (app/card-menu.tsx).
export function TradeCard({ t, state = 'connected', menu, open: unrealized, openAsOf }: { t: TradeRow; state?: PublicState; menu?: React.ReactNode; open?: number[]; openAsOf?: Date }) {
  // F-6: one line about the trader's open positions (no symbols, no combined figure); nothing without them.
  const open = unrealized && openAsOf ? openSummary(unrealized) : null;
  const up = t.return_pct > 0;
  const trust = cardTrust(t, state);
  const pub = isPublicRecord(state); // F-7: the card line in place of the thesis (filers post none)
  return (
    <article className="card">
      <header>
        <Link href={`/u/${t.handle}`} className="who">
          <WhoName name={t.display_name} handle={t.handle} />
        </Link>
        <RowBadge kind={trust.badge} />
        {menu}
      </header>
      {trust.incomplete && <p role="status" className="down record-failed">{RECORD_BODY.failed}</p>}
      <div className="hero">
        <div className="symbol"><Link href={`/t/${encodeURIComponent(t.symbol)}`}>{t.symbol}</Link></div>
        <div className={`ret ${up ? 'up' : 'down'}`}>{pct(t.return_pct)}</div>
        <div className="muted">held {days(t.holding_days)} · closed {CLOSED_DAY.format(t.closed_at)}</div>
      </div>
      {pub ? <p className="thesis muted" data-public-card>{PUBLIC.cardLine}</p> : <p className="thesis">{t.thesis_status === 'published' ? `“${t.thesis}”` : <span className="muted">No thesis posted.</span>}</p>}
      {open && <p className="open-also" data-open><span className="muted">{OPEN.feedLabel}</span>{OPEN.feedCounts(open)}<b className={toneClass(open.avg)}>{pct(open.avg)}</b>{OPEN.feedTail(open.n, asOfDay(openAsOf!))}</p>}
      <footer className="muted">
        <Link href={`/u/${t.handle}`}>See their record, wins and losses →</Link>
      </footer>
    </article>
  );
}
