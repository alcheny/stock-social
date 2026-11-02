// F-23 · chart precision (owner decision 2026-11-02, amends CH-1): a record whose curve is above +100% prints its total,
// scrub readout and accessible name at 3 significant figures, and its public chart payload carries no more. Own fixture
// (random tag), removed after; feed-eligible, so the shared feed lock is held.
import { expect, test } from '@playwright/test';
import postgres from 'postgres';
import { feedLock } from './feed-lock.ts';
import { curvePct } from '../lib/format.ts';
import { wireCurve } from '../lib/public-wire.ts';

const DAY = 86_400_000;
const tag = Math.random().toString(36).slice(2, 7);
const H = `f23g${tag}`;
const R = [0.31234, 0.27891, 0.33333, 0.29876, 0.3011, 0.28765]; // compounds to about +381%
const sql = postgres(process.env.DATABASE_URL!, { max: 2, onnotice: () => {} });
let release: (() => Promise<void>) | null = null;

test.beforeAll(async () => {
  release = await feedLock('shared');
  const [u] = await sql`with a as (insert into signup_attempts (method, adult_attested_at) values ('dev', now()) returning id)
    insert into users (handle, display_name, adult_attested_at, signup_attempt_id) select ${H}, ${H}, now(), a.id from a returning id, signup_attempt_id`;
  await sql`insert into closed_trades ${sql(R.map((r, i) => ({
    user_id: u.id, sell_id: `${H}-${i}`, account_id: 'a', symbol: `FG${i}`, opened_at: new Date(Date.now() - (20 - i) * DAY - DAY),
    closed_at: new Date(Date.now() - (20 - i) * DAY), return_pct: r, holding_days: 1, verified: true, thesis: null, thesis_status: null,
  })))}`;
  await sql`insert into connections (attempt_id, user_id, state, consent_at, importing_at, last_progress_at, connected_at)
    values (${u.signup_attempt_id}, ${u.id}, 'connected', now(), now(), now(), now() - interval '30 days')`;
});
test.afterAll(async () => {
  await sql`delete from users where handle = ${H}`;
  await release?.();
  await sql.end({ timeout: 1 });
});

test('F-23 owner decision 2026-11-02: a curve above +100% prints 3 significant figures in the header, the scrub and the name; the payload carries no more', async ({ page, request }) => {
  const total = R.reduce((e, r) => e * (1 + r), 1) - 1;
  expect(total).toBeGreaterThan(1);
  const shown = curvePct(total);
  expect(shown).toMatch(/^\+\d{3}%$/);
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto(`/u/${H}`);
  const fig = page.locator('figure.chart');
  await expect(fig.locator('.chart-value')).toHaveText(shown);
  await expect(fig.locator('svg[role="img"]').first()).toHaveAttribute('aria-label', new RegExp(`, \\${curvePct(total, 0)} total,`));
  // The scrub: every point at or above +100% prints the 3-figure form; below it, one decimal as before.
  await fig.locator('.chart-stack').focus();
  let e = 1;
  for (const r of R) {
    await page.keyboard.press('ArrowRight');
    if (r === R[0]) await page.keyboard.press('ArrowRight'); // past the range start (0%)
    e *= 1 + r;
    await expect(fig.locator('.chart-value')).toHaveText(curvePct(e - 1));
  }
  // The public chart payload: every curve value is what the chart prints.
  const chart = await (await request.get(`/u/${H}/pane-chart?v=2`)).json();
  for (const r of Object.values(chart.ranges) as { last: number; max: number; p: number[] }[]) {
    for (const v of [r.last, r.max]) expect(wireCurve(v), String(v)).toBe(v);
  }
  expect(chart.ranges.ALL.last).toBe(wireCurve(total));
});
