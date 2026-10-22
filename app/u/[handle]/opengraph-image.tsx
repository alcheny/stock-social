// The share card: the Phase 1 growth loop (DESIGN Stage 1, BL resolution).
// Rendered by Next's built-in next/og whenever the profile link is posted on a social network or in a messaging app.
import { ImageResponse } from 'next/og';
import { notFound } from 'next/navigation';
import { DISCLAIMER } from '@/lib/share.ts';
import { sql } from '@/lib/db.ts';
import { confidence, evidenceLine, isNewRecord, pct, stats } from '@/lib/trades.ts';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'Verified trading record on Stock Social';

export default async function Card({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const [user] = await sql`select id, display_name, snaptrade_user_id from users where handle = ${handle} and deleted_at is null`;
  if (!user) notFound(); // no card for an unknown handle or a profile being deleted (the profile itself is 404 too)
  const rows = user ? await sql`select symbol, return_pct, holding_days, opened_at, closed_at, verified from closed_trades where user_id = ${user.id}` : [];
  const s = stats(rows.map((t) => ({ returnPct: t.return_pct, holdingDays: t.holding_days, closedAt: t.closed_at })));
  const verified = rows.length > 0 && rows.every((t) => t.verified);
  const empty = rows.length === 0;
  const connectedEmpty = empty && !!user?.snaptrade_user_id;
  const up =s.avgReturn > 0;
  const c = confidence(rows.map((t) => ({ symbol: t.symbol, openedAt: t.opened_at, closedAt: t.closed_at, returnPct: t.return_pct, holdingDays: t.holding_days })), new Date());
  const isNew = rows.length > 0 && isNewRecord(rows.map((t) => ({ openedAt: t.opened_at })), rows.length, new Date());

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 64, background: '#0b0b0f', color: '#f4f4f6', fontFamily: 'sans-serif' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 36 }}>
          <span style={{ fontWeight: 800 }}>Stock Social</span>
          <span style={{ color: verified || connectedEmpty ? '#22c55e' : '#8b8b98', fontWeight: 700 }}>{verified ? '✓ Verified from broker' : connectedEmpty ? '✓ Broker connected' : 'Demo data'}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 56, fontWeight: 700 }}>{user?.display_name ?? handle}</span>
          <span style={{ fontSize: 32, color: '#8b8b98' }}>@{handle}</span>
        </div>
        {empty ? (
          <span style={{ fontSize: 72, fontWeight: 800 }}>No closed trades yet</span>
        ) : (
        <div style={{ display: 'flex', gap: 72 }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 120, fontWeight: 800, lineHeight: 1 }}>{(s.winRate * 100).toFixed(0)}%</span>
            <span style={{ fontSize: 28, color: '#8b8b98' }}>win rate</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 120, fontWeight: 800, lineHeight: 1, color: up ? '#22c55e' : '#f43f5e' }}>{pct(s.avgReturn)}</span>
            <span style={{ fontSize: 28, color: '#8b8b98' }}>avg return / trade</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 120, fontWeight: 800, lineHeight: 1 }}>{s.trades}</span>
            <span style={{ fontSize: 28, color: '#8b8b98' }}>trades · losses included</span>
          </div>
        </div>
        )}
        <span style={{ fontSize: 30, color: '#8b8b98' }}>{evidenceLine(c)}{isNew ? ' · New record' : ''}</span>
        <span style={{ fontSize: 22, color: '#8b8b98' }}>{DISCLAIMER}</span>
      </div>
    ),
    size,
  );
}
