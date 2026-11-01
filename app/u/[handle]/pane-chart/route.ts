import { NextResponse } from 'next/server';
import { sql } from '@/lib/db.ts';
import { paneChart, PAYLOAD_V } from '@/lib/chart-series.ts';
import { filerVisibleSql, isFilerHandle } from '@/lib/public-gate.ts';

// F-1 PR-3 fix round 8 (tester re-run 4, Medium): the feed pane's full chart, fetched on the pane's first swipe-open
// (app/u/[handle]/chart.tsx), so the feed page carries only a stand-in line per trader. Public like the profile it
// mirrors (signed out works): the same closed trades the profile and the feed read, theses only when published,
// percentages only (closed_trades stores no quantities or prices). The trust rule (Verified, Demo, incomplete) is not
// in this data: the pane renders it on the server with the page.
// F-23: the chart at the printed precision with UTC days (lib/chart-series.ts#packChart). Only `?v=<PAYLOAD_V>` (the
// URL paneChartSrc builds) is served: the bare URL a pre-F-23 client asks for is a 404, so no cache key holds both.
export async function GET(req: Request, { params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  // Reviewer (tester Low): a handle outside the signup pattern (a NUL byte made Postgres throw, a 500) is a 404 before any query.
  if (!/^[a-z0-9_]{3,20}$/.test(handle)) return NextResponse.json({ error: 'not found' }, { status: 404, headers: { 'cache-control': 'no-store' } });
  if (new URL(req.url).searchParams.get('v') !== String(PAYLOAD_V)) return NextResponse.json({ error: 'not found' }, { status: 404, headers: { 'cache-control': 'no-store' } });
  const [user] = await sql`select id from users u where handle = ${handle} and deleted_at is null and ${filerVisibleSql('u')}`;
  if (!user) return NextResponse.json({ error: 'not found' }, { status: 404, headers: { 'cache-control': 'no-store' } });
  const rows = await sql`
    select id, symbol, return_pct, holding_days, closed_at, case when thesis_status = 'published' then thesis end as thesis -- F-26: published only, in SQL
    from closed_trades where user_id = ${user.id}`;
  const chart = paneChart(rows.map((r) => ({
    id: String(r.id), symbol: r.symbol as string, returnPct: r.return_pct as number, holdingDays: r.holding_days as number,
    closedAt: r.closed_at as Date, thesis: (r.thesis ?? null) as string | null,
  })), new Date());
  // Short and shared: every visitor of the same record gets the same chart; a new close shows within a minute.
  return NextResponse.json(chart, { headers: { 'cache-control': isFilerHandle(handle) ? 'no-store' : 'public, max-age=60' } }); // F-7: never cached
}
