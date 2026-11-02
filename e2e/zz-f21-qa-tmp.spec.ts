import { test, expect } from '@playwright/test';
import postgres from 'postgres';
import { EXCLUSIONS } from '../lib/copy.ts';
import { PAYLOAD_V } from '../lib/chart-series.ts';

const DAY = 86_400_000;
const R = Math.random().toString(36).slice(2, 7);
const H = `qh_${R}`, S = `qs_${R}`, S1 = `qt_${R}`, I = `qi_${R}`, F = `qf_${R}`, N = `qn_${R}`, D = `qd_${R}`, L = `ql_${R}`, P = `qp_${R}`;
const ALL = [H, S, S1, I, F, N, D, L, P];
const sql = postgres(process.env.DATABASE_URL!, { max: 2, onnotice: () => {} });
test.describe.configure({ mode: 'serial' });
test.use({ viewport: { width: 360, height: 740 } });

test.beforeAll(async () => {
  for (const handle of ALL) {
    const name = handle === L ? 'W'.repeat(40) : `QA ${handle}`;
    const [u] = await sql`with a as (insert into signup_attempts (method, adult_attested_at) values ('dev', now()) returning id)
      insert into users (handle, display_name, adult_attested_at, signup_attempt_id) select ${handle}, ${name}, now(), a.id from a returning id, signup_attempt_id`;
    const state = handle === I ? 'importing' : handle === F ? 'failed' : 'connected';
    if (handle !== N) await sql`insert into connections (attempt_id, user_id, state, consent_at, importing_at, connected_at, failed_at, last_progress_at)
      values (${u.signup_attempt_id}, ${u.id}, ${state}, now() - interval '60 days', now() - interval '60 days', ${state === 'connected' ? sql`now() - interval '60 days'` : null}, ${state === 'failed' ? sql`now()` : null}, now())`;
    await sql`insert into closed_trades ${sql([0, 1].map((i) => ({ user_id: u.id, sell_id: `${handle}-s${i}`, account_id: `${handle}-a`, symbol: `QQ${i}`,
      opened_at: new Date(Date.now() - 10 * DAY), closed_at: new Date(Date.now() - (i + 1) * 3600_000), return_pct: [0.1, -0.05][i], holding_days: 3, verified: handle !== D })))}`;
    if (handle === D) await sql`insert into activities (user_id, source, external_id, account_id, symbol, side, units, price, executed_at, raw) values (${u.id}, 'demo', ${`${handle}-x`}, ${`${handle}-a`}, 'QQ0', 'BUY', 1, 1, now() - interval '10 days', '{}')`;
  }
  await sql`update users set excluded_held = 1 where handle = ${H}`;
  await sql`update users set excluded_shared = 3 where handle = ${S}`;
  await sql`update users set excluded_shared = 1 where handle = ${S1}`;
  await sql`update users set excluded_corporate = 2 where handle in ${sql([I, F, N, D, L])}`;
  // future: 2 total (1 buy + 1 sell) — sells only
  await sql`update users set excluded_future = 2, excluded_future_sells = 1 where handle = ${P}`;
});
test.afterAll(async () => { await sql`delete from users where handle in ${sql(ALL)}`; await sql.end({ timeout: 1 }); });

const ym = new Date(Date.now() - 3600_000).toISOString().slice(0, 7);
async function surfaces(page: any, request: any, hd: string) {
  const pane = await request.get(`/u/${hd}/pane?v=${PAYLOAD_V}`);
  const pj = pane.ok() ? (await pane.json()).model?.excluded : `status ${pane.status()}`;
  await page.goto(`/u/${hd}`);
  const heading = await page.locator('#excluded-h').textContent().catch(() => null);
  const reasons = await page.locator('#excluded [data-reason]').allTextContents();
  const out: Record<string, unknown> = { pj, heading, reasons };
  for (const [k, path] of [['trade', `/u/${hd}/trade/${hd}-s0`], ['month', `/u/${hd}/month/${ym}`]]) {
    const r = await page.goto(path);
    out[k] = r?.status() === 200 ? await page.locator('[data-exclusions]').allTextContents() : `status ${r?.status()}`;
    out[k + 'Scroll'] = await page.evaluate(() => document.documentElement.scrollWidth);
  }
  return out;
}

for (const hd of [H]) {
  test(`QA ${hd.slice(0, 2)}`, async ({ page, request }) => {
    console.log(hd.slice(0, 2), JSON.stringify(await surfaces(page, request, hd)));
  });
}

test('QA 40-char name at 320 light/dark', async ({ browser }) => { test.setTimeout(120000);
  for (const scheme of ['light', 'dark'] as const) {
    const ctx = await browser.newContext({ viewport: { width: 320, height: 640 }, colorScheme: scheme });
    const page = await ctx.newPage();
    for (const path of [`/u/${L}`, `/u/${L}/trade/${L}-s0`, `/u/${L}/month/${ym}`, `/u/${L}#excluded`]) {
      await page.goto(path);
      const sw = await page.evaluate(() => document.documentElement.scrollWidth);
      const box = await page.locator('[data-exclusions] a').first().boundingBox().catch(() => null);
      const c = await page.locator('[data-exclusions] a').first().evaluate((el) => getComputedStyle(el).color).catch(() => null);
      const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
      console.log(scheme, path, sw, JSON.stringify(box), c, bg);
      await page.screenshot({ path: `/tmp/claude-0/-home-user-stock-social/5e4bf070-25a6-5da0-ab73-661b6d477b02/scratchpad/ql-${scheme}-${path.split('/')[3] ?? 'p'}.png`, fullPage: false });
    }
    await ctx.close();
  }
  expect(EXCLUSIONS.line(1)).toContain('1 trade excluded');
});
