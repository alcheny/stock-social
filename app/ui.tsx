import Link from 'next/link';
import type { PublicState } from '@/lib/connections.ts';
import { asOfDay, isPublicRecord, OPEN, PUBLIC, RECORD_BODY } from '@/lib/copy.ts';
import { cardTrust, type TrustBadge } from '@/lib/pane.ts';
import { pct } from '@/lib/trades.ts';
import { openSummary } from '@/lib/open-split.ts';
import { toneClass } from './open-rows.tsx';
// FIXES-LABELS (D-05, D-09): the year rule for the close date; the F3 line on every card.
import { dateText } from '@/lib/date-text.ts';
import { Disclaimer } from './disclaimer.tsx';
import { FIXES_LABELS } from '@/lib/copy.ts';
import type { Segment } from '@/lib/record-status.ts'; // FIXES-LABELS: status
import { StatusText } from './status-line.tsx'; // FIXES-LABELS: status
import { HeldNote, UserNote } from '@/lib/user-note.ts';
// F-13: the SW-1 hint and the Verified definition (fix #9).
import { FIRST_VISIT, VERIFIED_MEANING } from '@/lib/copy.ts';
import { SwipeHint } from './first-visit-client.tsx';
import { RecordStrip } from './record-strip.tsx';
import { WarnNotice } from './warn-notice.tsx'; // F-27
import { DISCLAIMER } from '@/lib/share.ts';
import type { Strip } from '@/lib/record-strip.ts';
import { retEms } from '@/lib/feed-focus.ts';

// F-7: `kind` 'public' / 'public_demo' is the "Public filing" badge (Demo beside it on a fictional fixture), never Verified.
export function Badge({ verified, kind = verified ? 'verified' : 'demo' }: { verified?: boolean; kind?: TrustBadge }) {
  // FIXES-CYCLE4-PART2 (F4-14, C4-15): a space between the two badges, so they read "Demo Public filing", never one word.
  if (kind === 'public' || kind === 'public_demo') return <>{kind === 'public_demo' && <><Badge kind="demo" />{' '}</>}<span className="badge public" title={PUBLIC.badgeTitle}>{PUBLIC.badge}</span></>;
  return kind === 'verified'
    ? <span className="badge verified" title={VERIFIED_MEANING} /* fix #9 (F-13 group): one constant with the footer */>✓ Verified</span>
    : <span className="badge demo" title={FIXES_LABELS.demoNote /* FIXES-LABELS (DS-20) */}>Demo</span>;
}

// A badge chosen by a trust rule (paneTrust / cardTrust / rowBadge): null shows none.
export function RowBadge({ kind }: { kind: TrustBadge | null }) {
  return kind ? <Badge kind={kind} /> : null;
}

// F-7 (legal C15, plan Round 5 item 4): the not-joined line and correction link on a public record's pages and pane.
export function PublicNotice({ link = true }: { link?: boolean }) {
  return <p className="public-line" data-public-line>{PUBLIC.notJoined}{link && <> <Link className="tap44" href="/public-records">{PUBLIC.correction}</Link></>}</p>;
}

export type TradeRow = {
  id: string; symbol: string; return_pct: number; holding_days: number; closed_at: Date; verified: boolean;
  thesis: string | null; thesis_status: string | null; handle: string; display_name: string; user_id: number;
  thesis_written_at?: Date | null; thesis_edited_at?: Date | null;
};

const days = (d: number) => (d < 1 ? `${Math.max(1, Math.round(d * 24))}h` : `${d.toFixed(d < 10 ? 1 : 0)}d`);

// state: the trader's aggregate record state (recordStates); a failed import shows no Verified badge and the short line.
// Fix round 8 (tester re-run 4): a display name equal to the handle is shown once ("@name", not "name@name").
// fix-user-text fix round 5 (item 5): the name is isolated (<bdi>), so a right-to-left name never pulls the handle after
// it into its direction (the handle stays whole and in order).
export function WhoName({ name, handle }: { name: string; handle: string }) {
  return <>{name !== handle && <><strong><bdi>{name}</bdi></strong>{' '}</>}<span className="muted">@{handle}</span></>;
}

// FIXES-LABELS (D-05): the close date is lib/date-text.ts#dateText (one cached formatter per variant, UTC).
// F-10 follow-up (approval cycle 2, fix #23): a date outside the current UTC year carries its year ("May 30, 2020"), so an
// old close never reads as recent (design system rule: dates in UTC, the year only when it is not this year).
export const closedDay = (d: Date, now: Date) => dateText(d, now);

// F-7: a public filer's card carries its own line, never a note. F-9: UserNote renders a published thesis (no byline:
// the card's header already names the trader; `report` is the Report control the feed passes for a signed-in reader).
// F-26: no published note, no line (no element): the same for no note and a held one. `ownHeld`, the author's own held
// line (lib/user-note.ts#HeldNote, the same markup as the trade page's), set by the feed only for the signed-in trader's own card.
export type OwnHeld = { rule: string | null };
const thesisLine = (t: TradeRow, pub: boolean, report?: React.ReactNode, ownHeld?: OwnHeld | null) => pub ? <p className="thesis muted" data-public-card>{PUBLIC.cardLine}</p>
  : t.thesis_status === 'published' && t.thesis
    ? <UserNote text={t.thesis} handle={t.handle} writtenAt={t.thesis_written_at} editedAt={t.thesis_edited_at} report={report} byline={false} textClass="thesis" />
    : ownHeld ? <HeldNote rule={ownHeld.rule} /> : null;

// F-2 PR-4: `menu`, the feed card's "…" menu for a signed-in viewer (app/card-menu.tsx).
// F-10: `strip`, the trader's record strip (lib/record-strip.ts#recordStrip, 'feed'): it takes the place of the
// "held · closed" line, so the hero reads symbol, return, record. DS-22 (design system council, PR #48): the trust badge
// then leads the record line in .hero, not the header. `stripBadge`: the record-level badge (paneTrust, code review
// 2026-11-01), since it labels the record's figures; without it, the card's own. Without a strip (other callers) the card is unchanged.
// F-9: `report`, the note's Report control (app/report-note.tsx), passed by the feed only for a signed-in reader who is not
// the trader. Passed in, not imported here, so this card stays free of the server-action module (lib/f10-feed-card.test.ts
// renders it outside Next).
// F-10 follow-up #23: `now` dates the card (today by default), so a close in another UTC year shows its year.
// F-13: `hint`, page 1's first card: the SW-1 line and the dismiss focus target; `notice`, the first-visit line.
// F-29: `optionsLine`, the gated options count line (lib/options-view.ts#cardOptionsLine), set by the feed only.
// F-26: `ownHeld`, set only on the author's own held card (its rule; HeldNote words it), never a status.
// FIXES-LABELS: status: `status`, the card's status segments (lib/record-status.ts `card`, static mode: only a frozen or
// idle record has any), between the hero and the thesis.
export function TradeCard({ t, state = 'connected', menu, open: unrealized, openAsOf, strip, stripBadge, report, now = new Date(), hint, notice, status, ownHeld, optionsLine }: { t: TradeRow; state?: PublicState; menu?: React.ReactNode; open?: number[]; openAsOf?: Date; strip?: Strip; stripBadge?: TrustBadge | null; report?: React.ReactNode; now?: Date; hint?: boolean; notice?: React.ReactNode; ownHeld?: OwnHeld | null; status?: Segment[]; /* F-29 */ optionsLine?: string }) {
  // F-6: one line about the trader's open positions (no symbols, no combined figure); nothing without them.
  const open = unrealized && openAsOf ? openSummary(unrealized) : null;
  const tc = toneClass(t.return_pct); // A11Y-FIXES #23: flat (0.0%) is neither colour
  const trust = cardTrust(t, state);
  const pub = isPublicRecord(state); // F-7: the card line in place of the thesis (filers post none)
  // F-10 follow-up #18: the figure's length caps its size (app/globals.css "F-10 follow-ups"), so "+12345.6%" fits the card.
  const ret = pct(t.return_pct);
  return (
    <article className="card">
      <header>
        <Link href={`/u/${t.handle}`} className="who" data-first-card-link={hint || undefined}>
          <WhoName name={t.display_name} handle={t.handle} />
        </Link>
        {!strip && <RowBadge kind={trust.badge} />}
        {menu}
      </header>
      {trust.incomplete && <WarnNotice role="status">{RECORD_BODY.failed}</WarnNotice>}
      <div className="hero">
        <div className="symbol"><Link href={`/t/${encodeURIComponent(t.symbol)}`}>{t.symbol}</Link></div>
        <div className={tc ? `ret ${tc}` : 'ret'} style={{ '--ret-em': retEms(ret) } as React.CSSProperties}>{ret}</div>
        {strip ? <RecordStrip strip={strip} lead={(stripBadge === undefined ? trust.badge : stripBadge) ? <RowBadge kind={stripBadge === undefined ? trust.badge : stripBadge} /> : undefined} /> : <div className="muted">held {days(t.holding_days)} · closed {closedDay(t.closed_at, now) /* FIXES-LABELS (D-05): the year when it is not this year */}</div>}
        {/* F-29 (plan D6): the record's one count line, under the strip that carries its qualifier (feed only). */}
        {strip && optionsLine && <p className="muted small card-options-count" data-options="card-count">{optionsLine}</p>}
      </div>
      {status && <StatusText segments={status} kind="card" />}{/* FIXES-LABELS: status */}
      {/* F-13: on page 1's first card the first-visit line takes the thesis slot until it is dismissed (F-10's one-screen budget). */}
      {notice ? <div className="fv-slot">{notice}{thesisLine(t, pub, report, ownHeld)}</div> : thesisLine(t, pub, report, ownHeld)}
      {open && <p className="open-also" data-open><span className="muted">{OPEN.feedLabel}</span>{OPEN.feedCounts(open)}<b className={toneClass(open.avg)}>{pct(open.avg)}</b>{OPEN.feedTail(open.n, asOfDay(openAsOf!))}</p>}
      <footer className="muted">
        {hint && <SwipeHint text={FIRST_VISIT.hint} />}
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
