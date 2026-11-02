import Link from 'next/link';
import type { FeedPage } from '@/lib/feed.ts';
import { feedPaneChart } from '@/lib/chart-series.ts';
import { FEED, isPublicRecord } from '@/lib/copy.ts';
import { ProfilePane } from './pane.tsx';
import { TradeCard, type TradeRow } from './ui.tsx';
import { FirstVisit } from './first-visit.tsx';
import { SuggestSection } from './suggest-section.tsx';
import { CardMenu } from './card-menu.tsx';
import { SECTION_AT } from '@/lib/discovery/section.ts';
import { cardSegments, paneSegments } from '@/lib/record-status.ts'; // FIXES-LABELS: status
import { recordStrip, type Strip } from '@/lib/record-strip.ts';
import { paneTrust, type TrustBadge } from '@/lib/pane.ts';
import { ReportNote } from './report-note.tsx';
import { TrustFoot } from './trust-foot.tsx'; // F-16 (plan v2 B1): the line and its disclaimer beside the pane
import { impersonationLineShown } from '@/lib/takedown.ts';
import { cardOptionsLine } from '@/lib/options-view.ts'; // F-29

// F-2 PR-1: one page of feed rows, rendered the same way by the page (page 1 or `?after=`) and by the paging action
// (appended pages), so an appended card is the same element as a server-rendered one (SW-1 identical).
// No query here: every read is lib/feed.ts#loadFeedPage (lib/feed.signed-out.test.ts).
export function FeedRows({ page }: { page: FeedPage }) {
  return <>{feedRowNodes(page).map((r) => r.node)}</>;
}

// The page's rows, each with its card's id (fix round 1: the paging action sends them one by one, so the client can
// leave out a card it already shows).
export function feedRowNodes(page: FeedPage): { id: string; node: React.ReactNode }[] {
  const now = new Date();
  // One chart per trader, drawn at screen resolution (F-1 fix round 7) and shared by all of that trader's cards on the
  // page; for a long record a stand-in line, the full chart loading on the pane's first swipe-open (fix round 8). The
  // pane is built once per trader and the same element placed in each of that trader's rows.
  // FIXES-LABELS (D-09): keyed `${user_id}:${flag}`: a card's pane carries the F3 line, a sheet's pane does not (the
  // sheet has its own .sheet-note, so each sheet shows one).
  const trustShown = impersonationLineShown(); // F-16: approved (OD 2.18), so shown on every deploy
  const panes = new Map<string, ReturnType<typeof ProfilePane>>();
  const paneOf = (t: { user_id: number; handle: string; display_name: string }, disclaimer = true) => {
    const key = `${t.user_id}:${disclaimer}`;
    let p = panes.get(key);
    const trades = page.byUser.get(t.user_id) ?? [];
    // F-2 PR-2: no Follow or "…" on the viewer's own record.
    const viewer = page.viewer?.id === t.user_id ? undefined : { signedIn: !!page.viewer, following: !!page.viewer?.following.has(t.user_id) };
    if (!p) panes.set(key, (p = ProfilePane({ handle: t.handle, name: t.display_name, trades, chart: feedPaneChart(trades, now), now, state: page.records.get(t.user_id)?.state, viewer, open: page.open?.get(t.user_id), openAsOf: page.openAsOf?.get(t.user_id), options: page.options?.get(t.user_id) /* OPTIONS */, excluded: page.exclusions?.get(t.user_id) /* F-21: the pane only, never the card */, disclaimer,
      status: paneSegments(page.status?.get(t.user_id), now) /* FIXES-LABELS: status */ })));
    return p;
  };
  // F-10: one record strip per card trader, from the figures loadFeedPage computed (page.strips): formatting only here.
  // Demo = not every row verified (the pane's trust rule, paneTrust).
  const strips = new Map<number, Strip | undefined>();
  const badges = new Map<number, TrustBadge | null>();
  const stripOf = (t: { user_id: number; handle: string }) => {
    if (strips.has(t.user_id)) return strips.get(t.user_id);
    const f = page.strips?.get(t.user_id);
    const state = page.records.get(t.user_id)?.state ?? 'connected';
    const badge = paneTrust(page.byUser.get(t.user_id) ?? [], state).badge;
    badges.set(t.user_id, badge);
    const demo = badge === 'demo';
    const s = f && recordStrip({ ...f, state, demo, verified: !demo, handle: t.handle, excludingOptions: page.options?.get(t.user_id)?.label /* OPTIONS */ }, 'feed');
    strips.set(t.user_id, s);
    return s;
  };
  const out = page.cards.map((t, i) => {
    // The card's own fields only. F-25: no `data-*` attribute, client prop or payload carries the close's vendor id; trade
    // hrefs carry the `trade_key`.
    const row: TradeRow = { id: String(t.id), symbol: t.symbol, return_pct: t.return_pct, holding_days: t.holding_days, closed_at: t.closed_at, verified: t.verified,
      thesis: t.thesis, thesis_status: t.thesis_status, handle: t.handle, display_name: t.display_name, user_id: t.user_id,
      thesis_written_at: t.thesis_written_at ?? null, thesis_edited_at: t.thesis_edited_at ?? null, trade_key: t.trade_key! };
    return {
      id: String(t.id),
      node: (
        <div className="row" key={t.id} data-trade={t.id} data-key={t.trade_key} data-handle={t.handle}>
          <TradeCard t={row} state={page.records.get(t.user_id)?.state} open={page.open?.get(t.user_id)} openAsOf={page.openAsOf?.get(t.user_id)} now={now} strip={stripOf(t)} stripBadge={strips.get(t.user_id) ? badges.get(t.user_id) : undefined}
            status={cardSegments(page.status?.get(t.user_id), now)} /* FIXES-LABELS: status */
            optionsLine={cardOptionsLine(page.options?.get(t.user_id))} /* F-29 (D6): the count line under the strip, gated text only */
            // F-9: Report only for a signed-in reader who is not the trader, and never on a public filer's card (F-7: no notes there).
            // Report names the close by its trade_key, which survives rebuildTrades (lib/reports.ts accepts it and a row id).
            report={page.viewer && page.viewer.id !== t.user_id && !isPublicRecord(page.records.get(t.user_id)?.state ?? 'none') ? <ReportNote tradeId={t.trade_key!} symbol={t.symbol} /> : undefined}
            menu={page.viewer && page.viewer.id !== t.user_id ? <CardMenu id={row.id} tradeKey={t.trade_key!} symbol={t.symbol} handle={t.handle} liked={!!page.liked?.has(row.id)} likeable={!isPublicRecord(page.records.get(t.user_id)?.state ?? 'none')} /> : undefined}
            // F-26: the author's own held line, from the existing viewer check (no session read here).
            ownHeld={page.viewer && page.viewer.id === t.user_id && t.own_held ? { rule: t.own_hold_rule ?? null } : undefined}
            hint={page.offset === 0 && i === 0} /* F-13 (SW-1): the swipe hint on page 1's first card only; appended pages never */
            notice={page.offset === 0 && i === 0 ? <FirstVisit page={page} /> : undefined} /* F-13 (D27): in card 1's thesis slot, so F-10's first screen holds */ />
          {paneOf(t)}<TrustFoot inPane shown={trustShown} />{/* F-16 (B1): under the pane, its own grid cell */}
        </div>
      ),
    };
  });
  // F-2 PR-3: the suggestions section after the 5th card (position 6), on every page that has one.
  if (page.section && out.length >= SECTION_AT) {
    const rows = new Map(page.section.map((r) => [r.userId, r]));
    // F-16: the trust line under a sheet's pane, without its own copy of the F3 line (the sheet's note follows).
    const pane = (id: number, disclaimer = true) => { const r = rows.get(id)!; return <>{paneOf({ user_id: id, handle: r.handle, display_name: r.name }, disclaimer)}<TrustFoot inPane shown={trustShown} disclaimer={false} /></>; };
    out.splice(SECTION_AT, 0, { id: `section-${page.offset}`, node: <SuggestSection key={`section-${page.offset}`} page={page} pane={pane} /> });
  }
  return out;
}

// The end of the list: true because the order is seeded per UTC day; the list is capped, so no completeness claim.
// Fix round 1 (UX follow-up 8): "Publish your trades" for a signed-out viewer or one with no record; "See your record"
// for a viewer who already publishes. The page reads no session (lib/feed.signed-out.test.ts): the root layout marks
// the viewer on <body data-viewer>, and the stylesheet shows the one that applies. /login takes a signed-in viewer to
// their own profile.
export function FeedEnd() {
  return (
    <section className="feed-end" aria-label={FEED.endLabel}>
      <h2>{FEED.end}</h2>
      <p className="for-guest"><Link href="/login" className="button">{FEED.publish}</Link></p>
      <p className="for-publisher"><Link href="/login" className="button">{FEED.seeRecord}</Link></p>
    </section>
  );
}
