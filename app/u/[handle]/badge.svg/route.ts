import { sql } from '@/lib/db.ts';
import { isDemoUser } from '@/lib/demo.ts';
import { VALID_HANDLE, badgeModel, renderBadgeSvg } from '@/lib/badge.ts';

const CACHE = 'public, s-maxage=3600, stale-while-revalidate=86400';
const text = (body: string, status: number, cache = 'no-store') =>
  new Response(body, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': cache } });

// Thin loader: the model and the SVG come from lib/badge.ts. Public, no cookies or auth.
export async function GET(_req: Request, { params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  if (!VALID_HANDLE.test(handle)) return text('Not found', 404);
  try {
    const [user] = await sql`select id from users where handle = ${handle}`;
    if (!user) return text('Not found', 404, 'public, s-maxage=60');
    const rows = await sql`select symbol, opened_at, closed_at, return_pct, holding_days from closed_trades where user_id = ${user.id}`;
    const svg = renderBadgeSvg(badgeModel(
      { handle, demo: await isDemoUser(user.id) },
      rows.map((t) => ({ symbol: t.symbol, openedAt: t.opened_at, closedAt: t.closed_at, returnPct: t.return_pct, holdingDays: t.holding_days })),
      new Date(),
    ));
    return new Response(svg, { headers: { 'Content-Type': 'image/svg+xml; charset=utf-8', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': CACHE } });
  } catch (e) {
    console.error('badge failed', e);
    return text('Badge unavailable', 500);
  }
}
