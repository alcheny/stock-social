// FIXES-CYCLE5 (F5-14, C5-12): a heavy profile sends a bounded chart series. An 80,000-close fictional record (seeded
// by SQL with its own random handle, deleted after) renders its signed-out profile under 300 KB gzipped (before F5-14:
// 4.3 MB of HTML, 458 KB gzipped), and its chart's accessible summary still describes the whole record. Bytes only,
// never wall-clock; the figures' equality with full resolution is pinned in lib/fixes-cycle5-chart.test.ts. The record is
// feed-eligible, so it holds the feed lock shared (e2e/feed-lock.ts).
import { test, expect } from '@playwright/test';
import postgres from 'postgres';
import { gzipSync } from 'node:zlib';
import { feedLock } from './feed-lock.ts';

const N = 80_000;
const HANDLE = `fc5wp5_${Math.random().toString(36).slice(2, 8)}`;
const sql = postgres(process.env.DATABASE_URL!, { max: 2, onnotice: () => {} });
let release: () => Promise<void> = async () => {};

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  release = await feedLock('shared');
  const [u] = await sql`
    with a as (insert into signup_attempts (method, adult_attested_at) values ('dev', now()) returning id)
    insert into users (handle, display_name, adult_attested_at, signup_attempt_id) select ${HANDLE}, 'FC5 Heavy Chart', now(), a.id from a returning id`;
  // Closes every 30 minutes back from two days ago; returns from -2% to +2% in a fixed scramble.
  await sql`insert into activities (user_id, source, external_id, account_id, symbol, side, units, price, executed_at, raw)
    select ${u.id}, 'snaptrade', ${HANDLE} || '-' || i, 'a', 'L' || (i % 300), 'SELL', 1, 10,
           now() - interval '2 days' - (i * 30 || ' minutes')::interval, '{}'::jsonb from generate_series(1, ${N}) i`;
  await sql`insert into closed_trades (user_id, sell_id, account_id, symbol, opened_at, closed_at, return_pct, holding_days, verified)
    select ${u.id}, ${HANDLE} || '-' || i, 'a', 'L' || (i % 300), now() - interval '5 days' - (i * 30 || ' minutes')::interval,
           now() - interval '2 days' - (i * 30 || ' minutes')::interval, ((i * 7919 % 401) - 200) / 10000.0, 3, true
    from generate_series(1, ${N}) i`;
});

test.afterAll(async () => {
  await sql`delete from users where handle = ${HANDLE}`;
  await sql.end({ timeout: 1 });
  await release();
});

test('F5-14: an 80,000-close profile renders under 300 KB gzipped, and its chart summary is the whole record', async ({ request }) => {
  const res = await request.get(`/u/${HANDLE}`);
  expect(res.status()).toBe(200);
  const html = await res.body();
  const gz = gzipSync(html).length;
  test.info().annotations.push({ type: 'bytes', description: `raw ${html.length}, gzipped ${gz}` });
  expect(gz).toBeLessThan(300_000);
  // The server-rendered chart's role="img" summary counts every close (request only: no browser needed).
  expect(html.toString('utf8')).toMatch(/<svg[^>]*role="img"[^>]*aria-label="80,000 trades, [+\-−]?\d[\d,.]*% total, max drawdown [+\-−]?\d[\d,.]*%"/);
});
