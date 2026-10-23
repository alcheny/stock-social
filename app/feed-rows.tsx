import Link from 'next/link';
import type { FeedPage } from '@/lib/feed.ts';
import { feedPaneChart } from '@/lib/chart-series.ts';
import { FEED } from '@/lib/copy.ts';
import { ProfilePane } from './pane.tsx';
import { TradeCard, type TradeRow } from './ui.tsx';

// F-2 PR-1: one page of feed rows, rendered the same way by the page (page 1 or `?after=`) and by the paging action
// (appended pages), so an appended card is the same element as a server-rendered one (SW-1 identical).
// No query here: every read is lib/feed.ts#loadFeedPage (lib/feed.signed-out.test.ts).
export function FeedRows({ page }: { page: FeedPage }) {
  const now = new Date();
  // One chart per trader, drawn at screen resolution (F-1 fix round 7) and shared by all of that trader's cards on the
  // page; for a long record a stand-in line, the full chart loading on the pane's first swipe-open (fix round 8). The
  // pane is built once per trader and the same element placed in each of that trader's rows.
  const panes = new Map<number, ReturnType<typeof ProfilePane>>();
  const paneOf = (t: FeedPage['cards'][number]) => {
    let p = panes.get(t.user_id);
    const trades = page.byUser.get(t.user_id) ?? [];
    if (!p) panes.set(t.user_id, (p = ProfilePane({ handle: t.handle, name: t.display_name, trades, chart: feedPaneChart(trades, now), now, state: page.records.get(t.user_id)?.state })));
    return p;
  };
  return (
    <>
      {page.cards.map((t) => {
        // The card's own fields only (the close's vendor id stays on the server).
        const row: TradeRow = { id: String(t.id), symbol: t.symbol, return_pct: t.return_pct, holding_days: t.holding_days, closed_at: t.closed_at, verified: t.verified,
          thesis: t.thesis, thesis_status: t.thesis_status, handle: t.handle, display_name: t.display_name, user_id: t.user_id };
        return (
          <div className="row" key={t.id} data-trade={t.id}>
            <TradeCard t={row} state={page.records.get(t.user_id)?.state} />
            {paneOf(t)}
          </div>
        );
      })}
    </>
  );
}

// The end of the list: true because the order is seeded per UTC day; the list is capped, so no completeness claim.
export function FeedEnd() {
  return (
    <section className="feed-end" aria-label={FEED.endLabel}>
      <h2>{FEED.end}</h2>
      <p><Link href="/login" className="button">{FEED.publish}</Link></p>
    </section>
  );
}
