import Link from 'next/link';
import type { PublicState } from '@/lib/connections.ts';
import { LIKES, RECORD_BODY } from '@/lib/copy.ts';
import { cardTrust } from '@/lib/pane.ts';
import { pct } from '@/lib/trades.ts';
import { HideTrade } from './not-interested.tsx';

export function Badge({ verified }: { verified: boolean }) {
  return verified
    ? <span className="badge verified" title="Pulled read-only from the trader's broker. Cannot be edited.">✓ Verified</span>
    : <span className="badge demo" title="Sample data, not from a real broker.">Demo</span>;
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

// F-2 PR-1 fix round 2 (render cost): one formatter, not one per card (toLocaleDateString with options builds a new one
// each call, ~0.1 ms). Same locale, options and time zone, so the same text.
const CLOSED_DAY = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });

// F-2 PR-4: `act` (signed in, cards that are not the viewer's own): the like button (the keyboard and screen-reader
// route of the double tap) and the card's "…" with "Hide this trade" (the route of the reject swipe). The heart stays
// invisible until its pressed state is known (app/card-gestures.tsx; without JavaScript it never shows). No count.
export function CardActions({ t, tradeKey }: { t: TradeRow; tradeKey: string }) {
  return (
    <span className="card-acts">
      <button type="button" className="like" aria-pressed={false} aria-label={LIKES.like(t.symbol, t.handle)} data-like={tradeKey}><span aria-hidden="true" /></button>
      <HideTrade tradeKey={tradeKey} handle={t.handle} label={LIKES.more(t.symbol, t.handle)} />
    </span>
  );
}

export function TradeCard({ t, state = 'connected', act }: { t: TradeRow; state?: PublicState; act?: string }) {
  const up = t.return_pct > 0;
  const trust = cardTrust(t, state);
  return (
    <article className="card">
      <header>
        <Link href={`/u/${t.handle}`} className="who">
          <WhoName name={t.display_name} handle={t.handle} />
        </Link>
        <RowBadge kind={trust.badge} />
      </header>
      {trust.incomplete && <p role="status" className="down record-failed">{RECORD_BODY.failed}</p>}
      <div className="hero">
        <div className="symbol"><Link href={`/t/${encodeURIComponent(t.symbol)}`}>{t.symbol}</Link></div>
        <div className={`ret ${up ? 'up' : 'down'}`}>{pct(t.return_pct)}</div>
        <div className="muted">held {days(t.holding_days)} · closed {CLOSED_DAY.format(t.closed_at)}</div>
      </div>
      <p className="thesis">{t.thesis_status === 'published' ? `“${t.thesis}”` : <span className="muted">No thesis posted.</span>}</p>
      <footer className="muted">
        <Link href={`/u/${t.handle}`}>See their record, wins and losses →</Link>
        {act && <CardActions t={t} tradeKey={act} />}
      </footer>
    </article>
  );
}
