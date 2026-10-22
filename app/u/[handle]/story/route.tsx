// Evergreen whole-record image for stories and chats. Public, percent-only, like the OG card.
import { ImageResponse } from 'next/og';
import { DISCLAIMER } from '@/lib/share.ts';
import { sql } from '@/lib/db.ts';
import { confidence, stats } from '@/lib/trades.ts';
import { FORMATS, parseFormat, storyModel } from '@/lib/story-image.ts';

export async function GET(req: Request, { params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const url = new URL(req.url);
  const format = parseFormat(url.searchParams.get('format'));
  const size = FORMATS[format];
  if (typeof handle !== 'string' || !handle) return new Response('Not found', { status: 404 });
  const [user] = await sql`select id, display_name from users where handle = ${handle} and deleted_at is null`;
  if (!user) return new Response('Not found', { status: 404 });
  const rows = await sql`select symbol, return_pct, holding_days, opened_at, closed_at, verified from closed_trades where user_id = ${user.id}`;
  const [d] = await sql`select exists(select 1 from activities where user_id = ${user.id} and source = 'demo') as d`;
  const demo = (d.d as boolean) || (rows.length > 0 && !rows.every((t) => t.verified));
  const s = stats(rows.map((t) => ({ returnPct: t.return_pct, holdingDays: t.holding_days, closedAt: t.closed_at })));
  const c = confidence(rows.map((t) => ({ symbol: t.symbol, openedAt: t.opened_at, closedAt: t.closed_at, returnPct: t.return_pct, holdingDays: t.holding_days })), new Date());
  const m = storyModel(s, rows.length, c, { worst: rows.length ? Math.min(...rows.map((t) => Number(t.return_pct))) : null, demo });
  const tall = format === 'story';
  const link = `${url.host}/u/${handle}`;
  const muted = '#a1a1ad';
  const big = tall ? 200 : 140;
  const stat = (value: string, label: string, color = '#f4f4f6') => (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <span style={{ fontSize: big, fontWeight: 800, lineHeight: 1, color }}>{value}</span>
      <span style={{ fontSize: 32, color: muted }}>{label}</span>
    </div>
  );

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: tall ? '250px 72px 340px' : 64, background: '#0b0b0f', color: '#f4f4f6', fontFamily: 'sans-serif' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 34 }}>
          <span style={{ fontWeight: 800 }}>Stock Social</span>
          <span style={{ color: m.demo ? muted : '#22c55e', fontWeight: 700 }}>{m.demo ? 'Demo' : m.badge}</span>
        </div>
        {m.demo && <span style={{ fontSize: 30, color: muted }}>{m.badge}</span>}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 64, fontWeight: 700 }}>{user.display_name ?? handle}</span>
          <span style={{ fontSize: 36, color: muted }}>@{handle}</span>
        </div>
        {m.empty ? (
          <span style={{ fontSize: 80, fontWeight: 800 }}>{m.headline}</span>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div style={{ display: 'flex', flexDirection: tall ? 'column' : 'row', gap: tall ? 40 : 72 }}>
              {stat(m.winRatePct!, 'win rate')}
              {stat(m.avgReturn!, 'avg return / trade', m.avgPositive ? '#22c55e' : '#f43f5e')}
            </div>
            {m.rangeLine && <span style={{ fontSize: 30, color: muted }}>{m.rangeLine}</span>}
            <span style={{ fontSize: 32, color: muted }}>{m.closedCount} closed trade{m.closedCount === 1 ? '' : 's'} · losses included</span>
            {m.worstReturn && <span style={{ fontSize: 34, fontWeight: 700, color: '#f43f5e' }}>Worst closed trade: {m.worstReturn}</span>}
            {m.uncertaintyLine && (
              <div style={{ display: 'flex', alignSelf: 'flex-start', border: `2px solid ${muted}`, borderRadius: 999, padding: '8px 24px', fontSize: 30, color: '#f4f4f6' }}>{m.uncertaintyLine}</div>
            )}
          </div>
        )}
        <span style={{ fontSize: 32, color: muted }}>{link}</span>
        <span style={{ fontSize: 28, color: '#8b8b98' }}>{DISCLAIMER}</span>
      </div>
    ),
    { ...size, headers: { 'Cache-Control': 'public, max-age=300' } },
  );
}
