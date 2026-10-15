import Link from 'next/link';
import { sql } from '@/lib/db.ts';
import { groupByUser } from '@/lib/pane.ts';
import { confidence, evidenceWeight, rankTraders } from '@/lib/trades.ts';
import { FeedKeys } from './feed-keys.tsx';
import { ProfilePane, type PaneTrade } from './pane.tsx';
import { TradeCard, type TradeRow } from './ui.tsx';

// Public, no signup: every shared link lands here (DESIGN §2 BL feedback).
// Ranking (DESIGN §2.6): size of move × recency. |return| means losses rank as high as equal gains.
export default async function Feed() {
  const trades = (await sql`
    select t.id, t.symbol, t.return_pct, t.holding_days, t.closed_at, t.verified, t.thesis, t.thesis_status,
           u.handle, u.display_name, u.id as user_id,
           ln(1 + abs(t.return_pct) * 100) * exp(-extract(epoch from now() - t.closed_at) / 3600 / 48) as score
    from closed_trades t join users u on u.id = t.user_id
    where t.user_id in (select user_id from closed_trades group by user_id having count(*) >= 5)
    order by ln(1 + abs(t.return_pct) * 100) * exp(-extract(epoch from now() - t.closed_at) / 3600 / 48) desc
    limit 200`) as unknown as (TradeRow & { score: number })[];

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
  const now = new Date();
  // Rank by the pace-interval lower bound (TR-9): small lucky samples can't top the feed. Losses weigh like gains.
  const weight = new Map<number, number>();
  for (const [id, ts] of byUser) {
    const inputs = rows.filter((r) => r.user_id === id).map((r) => ({ symbol: r.symbol as string, openedAt: r.opened_at as Date, closedAt: r.closed_at as Date, returnPct: r.return_pct as number, holdingDays: r.holding_days as number }));
    weight.set(id, evidenceWeight(confidence(inputs, now)));
  }
  const ranked = rankTraders(trades.map((t) => ({ t, score: Number(t.score), weight: weight.get(t.user_id) ?? 0 }))).slice(0, 50).map((x) => x.t);
  return (
    <main className="feed">
      <FeedKeys />
      {ranked.map((t) => (
        <div className="row" key={t.id}>
          <TradeCard t={t} />
          <ProfilePane handle={t.handle} name={t.display_name} trades={byUser.get(t.user_id) ?? []} now={now} />
        </div>
      ))}
    </main>
  );
}
