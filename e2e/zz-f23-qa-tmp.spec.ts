import { expect, test } from '@playwright/test';
import postgres from 'postgres';
import { feedLock } from './feed-lock.ts';
import { insertFiler, deleteFilers } from './f7-fixture.ts';
const sql = postgres(process.env.DATABASE_URL!, { max: 2, onnotice: () => {} });
const tag = Math.random().toString(36).slice(2, 6);
const DAY = 86_400_000;
const NOW = Date.now();
const odd = [0.0123456789, -0.0567891234, 0.234567891, -0.9998765432, 0.0004321987, -0.0004321987];
const PLANT = ['0.01234', '1.2345', '0.05678', '5.6789', '0.23456', '23.4567', '0.99987', '99.9876', '0.00043', '0.04321', ':31:07'];
const at = (dAgo: number) => new Date(Math.floor(NOW / DAY) * DAY - dAgo * DAY + (14 * 3600 + 31 * 60 + 7) * 1000);
async function mkUser(h: string, closes: { r: number; at: Date }[], conn: null | { state: string; disc?: boolean }, verified = true) {
  const [u] = await sql`with a as (insert into signup_attempts (method, adult_attested_at) values ('dev', now()) returning id)
    insert into users (handle, display_name, adult_attested_at, signup_attempt_id, last_synced_at) select ${h}, ${h}, now(), a.id, now() from a returning id, signup_attempt_id`;
  if (closes.length) await sql`insert into closed_trades ${sql(closes.map((c, i) => ({ user_id: u.id, sell_id: `${h}-${i}`, account_id: 'a', symbol: 'QZ' + 'ABCDEFGHIJ'[i % 10],
    opened_at: new Date(c.at.getTime() - 2.345 * DAY), closed_at: c.at, return_pct: c.r, holding_days: 2.3456, verified })))}`;
  if (conn) await sql`insert into connections (attempt_id, user_id, state, consent_at, importing_at, last_progress_at, connected_at, failed_at, disconnected_at)
    values (${u.signup_attempt_id}, ${u.id}, ${conn.state}, ${at(20)}, ${at(20)}, ${at(20)}, ${conn.state === 'connected' ? at(19) : null}, ${conn.state === 'failed' ? at(3) : null}, ${conn.disc ? at(2) : null})`;
  await sql`insert into open_positions (user_id, account_id, symbol, unrealized_pct, fetched_at) values (${u.id}, 'a', 'QZO', ${0.0876543219}, ${at(0)})`;
  return u.id;
}
const H = (k: string) => `qa${tag}${k}`;
const fixtures: [string, { r: number; at: Date }[], null | { state: string; disc?: boolean }, boolean][] = [
  ['con', odd.map((r, i) => ({ r, at: at(i) })), { state: 'connected' }, true],
  ['fail', odd.map((r, i) => ({ r, at: at(i) })), { state: 'failed' }, true],
  ['frz', odd.map((r, i) => ({ r, at: at(i + 3) })), { state: 'connected', disc: true }, true],
  ['demo', odd.map((r, i) => ({ r, at: at(i) })), null, false],
  ['one', [{ r: 0.0123456789, at: at(500) }], { state: 'connected' }, true],
  ['flat', [1, 2, 3, 4, 5, 6].map((i) => ({ r: (i % 2 ? 1 : -1) * 0.0004321987, at: at(i) })), { state: 'connected' }, true],
  ['loss', [1, 2, 3, 4, 5, 6].map((i) => ({ r: -0.0567891234 * i, at: at(i) })), { state: 'connected' }, true],
  ['open', [], { state: 'connected' }, true],
  ['imp', odd.map((r, i) => ({ r, at: at(i) })), { state: 'importing' }, true],
];
let release: any;
test.describe.configure({ mode: 'serial' });
test.beforeAll(async () => {
  release = await feedLock('shared');
  for (const [k, c, conn, v] of fixtures) await mkUser(H(k), c, conn, v);
  await insertFiler(sql, { handle: H('pub'), name: 'QA Pub', closes: odd.map((r, i) => ({ symbol: 'QZP', r, daysAgo: i + 1.3897 })) }, NOW);
});
test.afterAll(async () => {
  await sql`delete from users where handle like ${'qa' + tag + '%'}`;
  try { await deleteFilers(sql, [H('pub')]); } catch {}
  await sql`delete from users where handle like ${'qa' + tag + '%'}`;
  await release?.(); await sql.end({ timeout: 1 });
});
function find(body: string): string[] {
  const t = body.replace(/\\"/g, '"');
  const out: string[] = [];
  for (const p of PLANT) if (t.includes(p)) out.push(`plant ${p} …${t.slice(Math.max(0, t.indexOf(p) - 80), t.indexOf(p) + 20)}`);
  for (const m of t.matchAll(/(?<![\d.\w])1\d{12}(?![\d])/g)) out.push(`epoch ${m[0]} …${t.slice(Math.max(0, m.index! - 80), m.index! + 15)}`);
  for (const m of t.matchAll(/\d{4}-\d\d-\d\dT\d\d:\d\d(:\d\d(\.\d+)?)?Z?/g)) if (!/T00:00(:00(\.000)?)?Z?$/.test(m[0]) && !/T\d\d:00Z$/.test(m[0])) out.push(`iso ${m[0]} …${t.slice(Math.max(0, m.index! - 100), m.index! + 30)}`);
  return out;
}

test('QA control + heavy + 360', async ({ playwright, baseURL, browser }) => {
  test.setTimeout(400_000);
  const api = await playwright.request.newContext({ baseURL });
  const rsc = await (await api.get(`/u/${H('con')}?_rsc=x`, { headers: { RSC: '1' } })).text();
  console.log('control: v2 charts in profile flight', (rsc.match(/"v":2/g) ?? []).length, 'has 0.012', rsc.includes('0.012'));
  // heavy, dense within 1Y: 2828 closes 3h apart; and 4700 closes 2h apart
  for (const [k, n, gap] of [['hvy', 2828, 3], ['hv47', 4700, 2]] as const) {
    const h = H(k);
    const t0 = NOW - 3_600_000;
    const closes = Array.from({ length: n }, (_, i) => ({ r: ((((i * 37) % 200) - 100) / 1000) + 0.000123456789, at: new Date(t0 - i * gap * 3_600_000 - 7_123) }));
    const [u] = await sql`with a as (insert into signup_attempts (method, adult_attested_at) values ('dev', now()) returning id)
      insert into users (handle, display_name, adult_attested_at, signup_attempt_id) select ${h}, ${h}, now(), a.id from a returning id`;
    const rows = closes.map((c, i) => ({ user_id: u.id, sell_id: `${h}-${i}`, account_id: 'a', symbol: 'QZA', opened_at: new Date(c.at.getTime() - DAY), closed_at: c.at, return_pct: c.r, holding_days: 1, verified: true }));
    for (let i = 0; i < rows.length; i += 1000) await sql`insert into closed_trades ${sql(rows.slice(i, i + 1000))}`;
    const html = await (await api.get(`/u/${h}`)).text();
    const pane = await (await api.get(`/u/${h}/pane?v=2`)).text();
    const pc = await (await api.get(`/u/${h}/pane-chart?v=2`)).text();
    console.log(k, 'profile HTML KB', Math.round(Buffer.byteLength(html) / 1024), 'pane KB', Math.round(pane.length / 1024), 'pane-chart KB', Math.round(pc.length / 1024), 'finds', find(html).length + find(pane).length + find(pc).length);
    const page = await (await browser.newContext({ viewport: { width: 360, height: 800 } })).newPage();
    const t = Date.now();
    await page.goto(`/u/${h}`);
    await expect(page.locator('.chart-hit a').first()).toBeAttached({ timeout: 30_000 });
    console.log(k, 'hit links', await page.locator('.chart-hit a').count(), 'ms to hydrate', Date.now() - t, 'overflow', await page.evaluate(() => document.documentElement.scrollWidth));
    const tabs = page.getByRole('group', { name: 'Range' }).first().getByRole('button');
    for (let i = 0; i < await tabs.count(); i++) { const s = Date.now(); await tabs.nth(i).click(); console.log(k, 'tab', await tabs.nth(i).innerText(), 'ms', Date.now() - s, 'hits', await page.locator('.chart-hit a').count()); }
    await page.context().close();
  }
  // 360 px: one close a year+ ago (ALL has one close), all-flat, near -100, open-only
  for (const k of ['one', 'flat', 'loss', 'open', 'frz', 'demo', 'pub']) {
    const ctx = await browser.newContext({ viewport: { width: 360, height: 800 } });
    const page = await ctx.newPage();
    const errs: string[] = [];
    page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
    page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
    await page.goto(`/u/${H(k)}`);
    await page.waitForTimeout(800);
    const fig = page.locator('figure.chart').first();
    const info: Record<string, unknown> = { overflow: await page.evaluate(() => document.documentElement.scrollWidth) };
    if (await fig.count()) {
      info.aria = await page.getByRole('img').first().getAttribute('aria-label').catch(() => null);
      info.ends = await page.locator('.chart-ends time').allInnerTexts();
      info.endsDT = await page.locator('.chart-ends time').evaluateAll((ts) => ts.map((t) => t.getAttribute('datetime')));
      const tabs = page.getByRole('group', { name: 'Range' }).first().getByRole('button');
      const tl: string[] = [];
      for (let i = 0; i < await tabs.count(); i++) { await tabs.nth(i).click(); tl.push(`${await tabs.nth(i).innerText()}:${await fig.locator('.chart-hit a').count()}:${(await page.locator('.chart-ends').innerText().catch(() => '-')).replace(/\s+/g, ' ')}`); }
      info.tabs = tl;
      const all = page.getByRole('group', { name: 'Range' }).first().getByRole('button', { name: /ALL/ });
      if (await all.count()) await all.click();
      const scrub = page.getByRole('group', { name: /Scrub the chart/ }).first();
      if (await scrub.count()) { await scrub.focus(); const seen: string[] = []; for (let i = 0; i < 8; i++) { await page.keyboard.press('ArrowRight'); seen.push((await page.locator('figure.chart .chart-sub, figure.chart figcaption').first().innerText().catch(() => '?')).replace(/\s+/g, ' ').slice(0, 60)); } info.scrub = seen; }
    }
    info.errs = errs;
    await page.screenshot({ path: `/tmp/claude-0/-home-user-stock-social/5e4bf070-25a6-5da0-ab73-661b6d477b02/scratchpad/qa/${k}-360.png`, fullPage: false });
    console.log(k, JSON.stringify(info));
    await ctx.close();
  }
});
