// F-25 e2e fixtures (docs/features/F-25-one-link-rule-for-trade-rows.md; not a test file itself). Each spec makes its
// own traders with random generic handles and random fictional symbols, reads their trade_keys back, and removes them
// (and their signup attempts) after; seeded traders are never changed, counted or deleted. Every sell id carries the
// caller's marker string, so a scan for the marker finds any leak of a vendor activity id.
import type postgres from 'postgres';

const ALNUM = 'abcdefghijklmnopqrstuvwxyz0123456789';
const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const pick = (set: string, n: number) => Array.from({ length: n }, () => set[Math.floor(Math.random() * set.length)]).join('');
export const handleOf = (prefix: string) => (prefix + pick(ALNUM, 20)).slice(0, 20);
// A fictional symbol no seeded trader holds: a Q-led five-letter code.
export const symbolOf = () => `Q${pick(UPPER, 4)}`;
export const marker = () => `mk${pick(ALNUM, 12)}`;

export type Close = { symbol: string; r: number; hoursAgo: number; hold?: number; thesis?: string };
export type Made = { id: number; handle: string; trades: { id: number; sell: string; key: string; symbol: string; r: number }[] };

// A trader with closes. `verified` adds a connected connection, so the record reads Verified; otherwise the closes are
// unverified and the record reads Demo.
export async function makeTrader(sql: postgres.Sql, o: { handle: string; name?: string; verified: boolean; closes: Close[]; mark: string }): Promise<Made> {
  const [u] = await sql`with a as (insert into signup_attempts (method, adult_attested_at) values ('dev', now()) returning id)
    insert into users (handle, display_name, adult_attested_at, signup_attempt_id) select ${o.handle}, ${o.name ?? o.handle}, now(), a.id from a returning id, signup_attempt_id`;
  const rows = o.closes.map((c, i) => ({
    user_id: u.id, sell_id: `${o.mark}-${o.handle}-${i}-s`, account_id: `${o.mark}-acct`, symbol: c.symbol,
    opened_at: new Date(Date.now() - (c.hoursAgo + (c.hold ?? 2) * 24) * 3_600_000), closed_at: new Date(Date.now() - c.hoursAgo * 3_600_000),
    return_pct: c.r, holding_days: c.hold ?? 2, verified: o.verified,
    thesis: c.thesis ?? null, thesis_status: c.thesis ? 'published' : null, thesis_written_at: c.thesis ? new Date() : null,
  }));
  const out = await sql`insert into closed_trades ${sql(rows)} returning id, sell_id, trade_key, symbol, return_pct`;
  if (o.verified) await sql`insert into connections (attempt_id, user_id, state, consent_at, importing_at, last_progress_at, connected_at)
    values (${u.signup_attempt_id}, ${u.id}, 'connected', now(), now(), now(), now() - interval '3 days')`;
  return { id: u.id as number, handle: o.handle, trades: out.map((t) => ({ id: Number(t.id), sell: t.sell_id as string, key: t.trade_key as string, symbol: t.symbol as string, r: Number(t.return_pct) })) };
}

// A plain signed-in viewer row is made by /login/dev; this removes users by handle with their signup attempts.
export async function removeHandles(sql: postgres.Sql, handles: string[]) {
  if (!handles.length) return;
  const users = await sql`select id, signup_attempt_id as a from users where handle = any(${handles})`;
  const ids = users.map((r) => r.id as number);
  // The user's own attempt, and the attempts a dev sign-in into the existing handle completed (signup_attempts.user_id).
  const later = ids.length ? (await sql`select id from signup_attempts where user_id = any(${ids})`).map((r) => r.id as number) : [];
  const attempts = [...new Set([...users.map((r) => r.a as number | null).filter((x): x is number => x !== null), ...later])];
  await sql.begin(async (tx) => {
    if (ids.length) await tx`delete from users where id = any(${ids})`;
    if (!attempts.length) return;
    for (const t of ['login_links', 'funnel_events', 'connections']) await tx`delete from ${tx(t)} where attempt_id = any(${attempts})`;
    await tx`delete from signup_attempts where id = any(${attempts})`;
  });
}

// The printed percent (lib/format.ts#pct, one decimal, "+" on gains, "0.0%" for a figure that prints as zero).
export function printed(x: number): string {
  const s = (x * 100).toFixed(1);
  if (Number(s) === 0) return `${s.replace('-', '')}%`;
  return x > 0 ? `+${s}%` : `${s}%`;
}
export const signWordOf = (x: number) => (Number((x * 100).toFixed(1)) === 0 ? 'Flat' : x > 0 ? 'Gain' : 'Loss');
export const KEY_RE = /^[0-9a-f]{64}$/;
