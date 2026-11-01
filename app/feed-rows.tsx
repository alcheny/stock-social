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
import { recordStrip, type Strip } from '@/lib/record-strip.ts';
import { paneTrust, type TrustBadge } from '@/lib/pane.ts';

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
  const panes = new Map<number, ReturnType<typeof ProfilePane>>();
  const paneOf = (t: { user_id: number; handle: string; display_name: string }) => {
    let p = panes.get(t.user_id);
    const trades = page.byUser.get(t.user_id) ?? [];
    // F-2 PR-2: no Follow or "…" on the viewer's own record.
    const viewer = page.viewer?.id === t.user_id ? undefined : { signedIn: !!page.viewer, following: !!page.viewer?.following.has(t.user_id) };
    if (!p) panes.set(t.user_id, (p = ProfilePane({ handle: t.handle, name: t.display_name, trades, chart: feedPaneChart(trades, now), now, state: page.records.get(t.user_id)?.state, viewer, open: page.open?.get(t.user_id), openAsOf: page.openAsOf?.get(t.user_id) })));
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
    const s = f && recordStrip({ ...f, state, demo, verified: !demo, handle: t.handle }, 'feed');
    strips.set(t.user_id, s);
    return s;
  };
  const out = page.cards.map((t, i) => {
    // The card's own fields only (the close's vendor id stays on the server).
    const row: TradeRow = { id: String(t.id), symbol: t.symbol, return_pct: t.return_pct, holding_days: t.holding_days, closed_at: t.closed_at, verified: t.verified,
      thesis: t.thesis, thesis_status: t.thesis_status, handle: t.handle, display_name: t.display_name, user_id: t.user_id };
    return {
      id: String(t.id),
      node: (
        <div className="row" key={t.id} data-trade={t.id} data-handle={t.handle}>
          <TradeCard t={row} state={page.records.get(t.user_id)?.state} open={page.open?.get(t.user_id)} openAsOf={page.openAsOf?.get(t.user_id)} strip={stripOf(t)} stripBadge={strips.get(t.user_id) ? badges.get(t.user_id) : undefined}
            menu={page.viewer && page.viewer.id !== t.user_id ? <CardMenu id={row.id} symbol={t.symbol} handle={t.handle} liked={!!page.liked?.has(row.id)} likeable={!isPublicRecord(page.records.get(t.user_id)?.state ?? 'none')} /> : undefined}
            hint={page.offset === 0 && i === 0} /* F-13 (SW-1): the swipe hint on page 1's first card only; appended pages never */
            notice={page.offset === 0 && i === 0 ? <FirstVisit page={page} /> : undefined} /* F-13 (D27): in card 1's thesis slot, so F-10's first screen holds */ />
          {paneOf(t)}
        </div>
      ),
    };
  });
  // F-2 PR-3: the suggestions section after the 5th card (position 6), on every page that has one.
  if (page.section && out.length >= SECTION_AT) {
    const rows = new Map(page.section.map((r) => [r.userId, r]));
    const pane = (id: number) => { const r = rows.get(id)!; return paneOf({ user_id: id, handle: r.handle, display_name: r.name }); };
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
