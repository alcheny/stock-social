import Link from 'next/link';
import { sql } from '@/lib/db.ts';
import { recordStates } from '@/lib/connections.ts';
import { groupByUser } from '@/lib/pane.ts';
import { confidence, evidenceWeight, rankTraders } from '@/lib/trades.ts';
import { feedCandidates } from '@/lib/feed.ts';
import { FeedKeys } from './feed-keys.tsx';
import { ProfilePane, paneChart, type PaneTrade } from './pane.tsx';
import { TradeCard, type TradeRow } from './ui.tsx';

// Public, no signup: every shared link lands here (DESIGN §2 BL feedback).
// Ranking (DESIGN §2.6): size of move × recency. |return| means losses rank as high as equal gains.
export default async function Feed() {
  // Ranking SQL: lib/feed.ts (size of move × recency, clamped so a close of any age is defined).
  const trades = (await feedCandidates()) as unknown as (TradeRow & { score: number; user_id: number })[];

  if (!trades.length) {
    return (
      <main className="page">
        <h1>No trades yet</h1>
        <p className="muted">Run <code>npm run db:seed</code> for demo data, or <Link href="/login">publish your own</Link>.</p>
      </main>
    );
  }

  // One batched query for every visible trader's full record (pane chart + stats); never one per card.
  const rows = await sql`
    select user_id, id, symbol, return_pct, holding_days, opened_at, closed_at, verified, thesis, thesis_status
    from closed_trades where user_id = any(${[...new Set(trades.map((t) => t.user_id))]})`;
  const byUser = groupByUser(rows.map((r) => ({
    userId: r.user_id as number, id: String(r.id), symbol: r.symbol as string, returnPct: r.return_pct as number,
    holdingDays: r.holding_days as number, closedAt: r.closed_at as Date, verified: r.verified as boolean,
    thesis: r.thesis_status === 'published' ? (r.thesis as string) : null,
  }) satisfies PaneTrade & { userId: number }));
  // Fix round 4 (TR-3): a failed import stays in the feed (never hidden) but its pane says the record may be incomplete.
  const records = await recordStates([...byUser.keys()]);
  const now = new Date();
  // Rank by the pace-interval lower bound (TR-9): small lucky samples can't top the feed. Losses weigh like gains.
  const weight = new Map<number, number>();
  for (const [id, ts] of byUser) {
    const inputs = rows.filter((r) => r.user_id === id).map((r) => ({ symbol: r.symbol as string, openedAt: r.opened_at as Date, closedAt: r.closed_at as Date, returnPct: r.return_pct as number, holdingDays: r.holding_days as number }));
    weight.set(id, evidenceWeight(confidence(inputs, now)));
  }
  // One chart per trader, drawn at screen resolution (fix round 7: at most FEED_CHART_POINTS points per range, never one
  // per close) and shared by all of that trader's cards.
  // The pane itself is the same for every card of a trader: built once per trader and the same element placed in each
  // of that trader's rows, so the page's data payload carries it once (each row still renders it).
  const panes = new Map<number, ReturnType<typeof ProfilePane>>();
  const paneOf = (t: (typeof trades)[number]) => {
    let p = panes.get(t.user_id);
    if (!p) panes.set(t.user_id, (p = ProfilePane({ handle: t.handle, name: t.display_name, trades: byUser.get(t.user_id) ?? [], chart: paneChart(byUser.get(t.user_id) ?? [], now), now, state: records.get(t.user_id)?.state })));
    return p;
  };
  const ranked = rankTraders(trades.map((t) => ({ t, score: Number(t.score), weight: weight.get(t.user_id) ?? 0 }))).slice(0, 50).map((x) => x.t);
  return (
    <main className="feed">
      <FeedKeys />
      {ranked.map((t) => (
        <div className="row" key={t.id}>
          <TradeCard t={t} state={records.get(t.user_id)?.state} />
          {paneOf(t)}
        </div>
      ))}
    </main>
  );
}
