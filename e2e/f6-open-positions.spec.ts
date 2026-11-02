// F-6 · Open positions in every number (docs/features/F-6-open-positions.md, plan docs/features/logs/F-6/plan.md §7)
// against the running app at 360 px: the profile's realized and unrealized grids at the same size with the combined
// average (AC1, AC2, AC4), a record with no open positions unchanged (AC3), percent only (AC5), the feed card and pane,
// the stock pages (aggregate only), and the disclaimer on every page visited (AC7). The fixture traders are its own
// (`f6_*`), deleted before and after; only f6_mixed is feed-eligible (5 closes in the last day), the others close 40+
// days ago or have fewer than 5 closes. f6_mixed can take feed cards, so the shared feed lock is held while it exists
// (as similar.spec.ts): the specs that need the feed to themselves wait (review B1).
import { test, expect, type Page } from '@playwright/test';
import postgres from 'postgres';
import { feedLock } from './feed-lock.ts';
import { asOfDay } from '../lib/copy.ts';

const DAY = 86_400_000;
// Every fixture position was read on Oct 30, 2026; the app prints that date one way everywhere (lib/copy.ts#asOfDay).
const READ = new Date('2026-10-30T12:00:00Z');
const ON = asOfDay(READ);
const DISCLAIMER = 'Not investment advice. Past performance does not guarantee future results.';
// Own pool (as app.spec.ts and connect.spec.ts).
const sql = postgres(process.env.DATABASE_URL!, { max: 2, onnotice: () => {} });

type Close = { symbol: string; r: number; daysAgo: number };
type Pos = { account: string; symbol: string; pct: number };
type Fixture = { connection?: 'connected' | 'importing' | 'failed'; closes: Close[]; open: Pos[] };
const old = (symbol: string, rs: number[]): Close[] => rs.map((r, i) => ({ symbol, r, daysAgo: 40 + i }));
const FIXTURES: Record<string, Fixture> = {
  // 5 closes within the day (feed-eligible), realized avg +7.4%; open: one symbol in two accounts, and one at 0.0%.
  f6_mixed: {
    connection: 'connected',
    closes: [0.25, -0.22, 0.3, -0.2, 0.24].map((r, i) => ({ symbol: `F6M${i}`, r, daysAgo: 0.05 + i * 0.01 })),
    open: [{ account: 'a', symbol: 'F6A', pct: -0.3 }, { account: 'b', symbol: 'F6A', pct: 0.1 }, { account: 'a', symbol: 'F6Z', pct: 0 }],
  },
  // Every open position losing; closed trades all won.
  f6_losing: { connection: 'connected', closes: old('F6A', [0.1, 0.05, 0.12]), open: [{ account: 'a', symbol: 'F6A', pct: -0.1 }, { account: 'a', symbol: 'F6B', pct: -0.25 }, { account: 'a', symbol: 'F6C', pct: -0.4 }] },
  f6_openonly: { connection: 'connected', closes: [], open: [{ account: 'a', symbol: 'F6D', pct: -0.05 }] },
  // Extreme values (business lead D5): realized -40.0% and an unrealized average of thousands of percent, one line each.
  f6_wide: { connection: 'connected', closes: old('F6W', [-0.4]), open: [{ account: 'a', symbol: 'F6W', pct: -0.999 }, { account: 'a', symbol: 'F6X', pct: 123.45 }] },
  f6_none: { connection: 'connected', closes: old('F6N', [0.1, -0.05, 0.08]), open: [] },
  // Not presented: no consented connection, or an import running (TR-3).
  f6_stray: { closes: old('F6S', [0.1, -0.05, 0.08]), open: [{ account: 'a', symbol: 'F6A', pct: 0.9 }] },
  f6_importing: { connection: 'importing', closes: old('F6I', [0.1, -0.05, 0.08]), open: [{ account: 'a', symbol: 'F6A', pct: 0.9 }] },
};
const HANDLES = Object.keys(FIXTURES);

test.describe.configure({ mode: 'serial' });

let releaseFeed: (() => Promise<void>) | null = null;
test.beforeAll(async () => {
  releaseFeed = await feedLock('shared');
  await sql`delete from users where handle in ${sql(HANDLES)}`;
  for (const [handle, f] of Object.entries(FIXTURES)) {
    const [u] = await sql`
      with a as (insert into signup_attempts (method, adult_attested_at) values ('dev', now()) returning id)
      insert into users (handle, display_name, adult_attested_at, signup_attempt_id) select ${handle}, ${handle.replace('f6_', 'F6 ')}, now(), a.id from a returning id, signup_attempt_id`;
    if (f.closes.length) await sql`insert into closed_trades ${sql(f.closes.map((c, i) => ({
      user_id: u.id, sell_id: `${handle}-${i}`, account_id: 'a', symbol: c.symbol, opened_at: new Date(Date.now() - (c.daysAgo + 2) * DAY),
      closed_at: new Date(Date.now() - c.daysAgo * DAY), return_pct: c.r, holding_days: 2, verified: true,
    })))}`;
    if (f.connection) await sql`insert into connections (attempt_id, user_id, state, consent_at, importing_at, last_progress_at)
      values (${u.signup_attempt_id}, ${u.id}, ${f.connection}, now(), now(), now())`;
    if (f.open.length) await sql`insert into open_positions ${sql(f.open.map((p) => ({ user_id: u.id, account_id: p.account, symbol: p.symbol, unrealized_pct: p.pct, fetched_at: READ })))}`;
  }
});

test.afterAll(async () => {
  await sql`delete from users where handle in ${sql(HANDLES)}`;
  await sql.end({ timeout: 1 });
  await releaseFeed?.();
});

test.use({ viewport: { width: 360, height: 800 } });

async function common(page: Page) {
  await expect(page.locator('footer#site-footer')).toContainText(DISCLAIMER);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  // AC5: no amounts anywhere in the new nodes.
  for (const t of await page.locator('[data-open]').allInnerTexts()) expect(t).not.toMatch(/\$|units|price/i);
}

test('F-6 profile: realized leads, unrealized directly beneath at the same size, then the combined average (AC1, AC2)', async ({ page }) => {
  await page.goto('/u/f6_mixed');
  const grids = page.locator('main > section.stats');
  const realized = grids.nth(0), unrealized = grids.nth(1);
  await expect(realized.locator('.row-label')).toHaveText('Realized · closed trades');
  // Dated by the oldest read (business lead D3); the year only when it is not the current one.
  await expect(unrealized.locator('.row-label')).toHaveText(`Unrealized · open positions at current value · as of ${ON}`);
  // Each grid is one named region; its visible label is not read twice (UX lead D3).
  await expect(page.getByRole('region', { name: 'Realized · closed trades' })).toHaveCount(1);
  await expect(page.getByRole('region', { name: /^Unrealized · open positions at current value/ })).toHaveCount(1);
  // Directly beneath: the unrealized grid is the realized grid's next sibling.
  expect(await realized.evaluate((el) => el.nextElementSibling?.classList.contains('open-stats'))).toBe(true);
  // The count once, big; the caption names it (UX lead D2) and keeps each count with its word (D4).
  await expect(unrealized.locator('.stat b').nth(0)).toHaveText('3');
  await expect(unrealized.locator('.stat small').nth(0)).toHaveText('open positions · 1 up, 1 down, 1 flat');
  expect(await unrealized.evaluate((el) => el.textContent)).toContain('1\u00a0up');
  const avg = unrealized.locator('.stat b').nth(1);
  await expect(avg).toHaveText('-6.7%');
  await expect(avg).toHaveClass('down');
  // TR-4: as prominent as the headline.
  const size = (i: number, g = realized) => g.locator('.stat b').nth(i).evaluate((el) => getComputedStyle(el).fontSize);
  expect(await size(1, unrealized)).toBe(await size(1));
  expect(await size(0, unrealized)).toBe(await size(0));
  // Order: realized grid, unrealized grid, combined line (all results: 5 closes and 3 open positions).
  const combined = page.locator('p.open-combined');
  await expect(combined).toHaveText('Including open positions at current value: +2.1% avg / result (8 results)');
  await expect(combined.locator('b')).toHaveClass('up');
  expect(await unrealized.evaluate((el) => el.nextElementSibling?.classList.contains('open-combined'))).toBe(true);
  // The evidence verdict is scoped first (business lead D2).
  await expect(page.locator('.evidence p')).toHaveText(/^Closed trades: /);
  await expect(page.locator('.evidence p')).not.toContainText('Past results');
  // The chart plots closed trades only (CH-1) and says what is not plotted.
  await expect(page.locator('figure.chart figcaption')).toHaveText('Return if every trade were the same size');
  expect(await page.locator('figure.chart').evaluate((el) => el.nextElementSibling?.classList.contains('chart-note'))).toBe(true);
  await expect(page.locator('.chart-note')).toHaveText('Chart: closed trades only. Not plotted: 3 open positions · 1 up, 1 down, 1 flat · -6.7% avg unrealized');
  // The open list: as of the oldest read, each account's holding separately, 0.0% uncolored.
  await expect(page.getByText(`Unrealized, at current value, as of ${ON}. Not in the closed-trade figures or the chart.`)).toBeVisible();
  const rows = page.locator('ul.positions li');
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0)).toContainText('F6A account 1-30.0%');
  await expect(rows.nth(2).locator('b').last()).toHaveText('0.0%');
  expect(await rows.nth(2).locator('b').last().getAttribute('class')).toBeNull();
  // The unfurl text says so too.
  expect((await page.locator('meta[property="og:description"]').getAttribute('content'))?.replace(/\u00a0/g, ' ')).toContain('3 open positions · 1 up, 1 down, 1 flat · -6.7% avg unrealized');
  await common(page);
});

test('F-6 profile: every open position losing reads down with "0 up" printed (AC4)', async ({ page }) => {
  await page.goto('/u/f6_losing');
  const unrealized = page.locator('section.open-stats');
  await expect(unrealized).toContainText('open positions · 0 up, 3 down');
  await expect(unrealized.locator('.stat b').nth(1)).toHaveText('-25.0%');
  await expect(unrealized.locator('.stat b').nth(1)).toHaveClass('down');
  // Realized +9.0% over 3 wins, combined (0.27 - 0.75) / 6 = -8.0%.
  await expect(page.locator('p.open-combined')).toHaveText('Including open positions at current value: -8.0% avg / result (6 results)');
  await expect(page.locator('p.open-combined b')).toHaveClass('down');
  for (const b of await page.locator('ul.positions li b.down').all()) await expect(b).toHaveText(/^-/);
  await expect(page.locator('ul.positions li b.down')).toHaveCount(3);
  await common(page);
});

test('F-6 profile: open positions and no closes show the unrealized grid alone, with no combined figure', async ({ page }) => {
  await page.goto('/u/f6_openonly');
  await expect(page.locator('section.open-stats')).toContainText('open position · 0 up, 1 down');
  await expect(page.locator('section.open-stats .stat b').nth(1)).toHaveText('-5.0%');
  await expect(page.locator('p.open-combined')).toHaveCount(0);
  await expect(page.locator('section.stats')).toHaveCount(1);
  await expect(page.locator('figure.chart')).toHaveCount(0);
  await common(page);
});

test('F-6: no open positions, or positions not presented (no connection, importing), render as before (AC3)', async ({ page }) => {
  for (const h of ['f6_none', 'f6_stray', 'momentum_maya']) {
    await page.goto(`/u/${h}`);
    await expect(page.locator('main [data-open]'), h).toHaveCount(0);
    await expect(page.locator('main section.stats').first()).toContainText('win rate');
    await expect(page.locator('main section.stats').first().locator('.row-label')).toHaveCount(0);
    expect(await page.locator('main section.stats').first().getAttribute('aria-label')).toBeNull();
    if (h !== 'f6_stray') await expect(page.locator('.evidence p')).not.toContainText('Closed trades:');
    await expect(page.locator('figure.chart figcaption')).toHaveText('Return if every trade were the same size');
    await common(page);
  }
  // Importing: no figures and no open-position aggregate (TR-3); the list keeps its old coloring.
  await page.goto('/u/f6_importing');
  await expect(page.locator('main [data-open]')).toHaveCount(0);
  await expect(page.locator('ul.positions li b.up')).toHaveCount(1);
  expect(await page.locator('meta[property="og:description"]').getAttribute('content')).not.toContain('open position');
});

test('F-6 feed: the card says what else is open and the pane shows both grids and the combined average', async ({ browser }) => {
  test.setTimeout(test.info().timeout + 60_000);
  const release = await feedLock('shared');
  // Without JavaScript the cards and panes are server-rendered and the next page is a plain link (walked, at most 12).
  const ctx = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 360, height: 800 } });
  const page = await ctx.newPage();
  try {
    let url: string | null = '/';
    let found = false;
    for (let i = 0; i < 12 && url && !found; i++) {
      await page.goto(url);
      found = (await page.locator('.row[data-handle="f6_mixed"]').count()) > 0;
      if (!found) url = await page.locator('.feed-more a.button[href*="after="]').getAttribute('href').catch(() => null);
    }
    expect(found, 'f6_mixed not in feed list').toBe(true);
    const row = page.locator('.row[data-handle="f6_mixed"]').first();
    const also = row.locator('article.card p.open-also');
    await expect(also).toHaveText(`Also open: 3 positions · 1 up, 1 down, 1 flat · -6.7% avg unrealized, as of ${ON}`);
    await expect(also.locator('b')).toHaveClass('down');
    // Body size, not small print.
    expect(await also.locator('b').evaluate((el) => getComputedStyle(el).fontSize)).toBe(await page.evaluate(() => getComputedStyle(document.body).fontSize));
    const pane = row.locator('section.pane');
    await expect(pane.locator('section.open-stats')).toContainText('open positions · 1 up, 1 down, 1 flat');
    // With open positions the figures lead the pane, as on the profile (business lead D1): realized, unrealized and the
    // combined line come before the chart.
    const order = await pane.evaluate((el) => [...el.querySelectorAll('section.stats, p.open-combined, figure.chart')].map((n) => n.className.split(' ')[0] + (n.classList.contains('open-stats') ? '.open' : '')));
    expect(order).toEqual(['stats', 'stats.open', 'open-combined', 'chart']);
    await expect(pane.locator('p.open-combined')).toHaveText('Including open positions at current value: +2.1% avg / result (8 results)');
    await expect(pane.locator('.chart-note')).toHaveText('Chart: closed trades only. Not plotted: 3 open positions · 1 up, 1 down, 1 flat · -6.7% avg unrealized');
    // A record with no open positions (the demo traders) gets no new line, and its pane keeps today's order.
    const demo = page.locator('.row[data-handle="momentum_maya"], .row[data-handle="dividend_dan"], .row[data-handle="yolo_yuki"]');
    await expect(demo.locator('[data-open]')).toHaveCount(0);
    if (await demo.count()) expect(await demo.first().locator('section.pane').evaluate((el) => [...el.querySelectorAll('section.stats, figure.chart')].map((n) => n.tagName))).toEqual(['FIGURE', 'SECTION']);
    await common(page);
  } finally {
    await ctx.close();
    await release();
  }
});

test('F-6 stock pages: the aggregate only, never who holds it; not counted for records not presented', async ({ page }) => {
  await page.goto('/t/F6A');
  const sec = page.locator('section.open-ticker');
  await expect(sec.getByRole('heading', { level: 2 })).toHaveText('Open positions in F6A');
  // f6_mixed (2 positions) and f6_losing (1); f6_stray and f6_importing are not counted.
  await expect(sec).toContainText(`3 open positions · 1 up, 2 down · -10.0% avg unrealized, held by 2 traders, as of ${ON}. Not included in the figures above, which cover closed trades. These are open positions, not a prediction or a rating of the stock.`);
  await expect(sec).not.toContainText(' now');
  await expect(sec.locator('a')).toHaveCount(0);
  await expect(sec).not.toContainText('f6_');
  await common(page);
  // No closes in the stock: the aggregate still shows.
  await page.goto('/t/F6D');
  await expect(page.locator('section.open-ticker')).toContainText(`1 open position · 0 up, 1 down · -5.0% unrealized, held by 1 trader, as of ${ON}. These are open positions, not a prediction or a rating of the stock.`);
  await common(page);
  await page.goto('/t/compare?a=F6A&b=F6B');
  await expect(page.locator('#cmp-a-h').locator('xpath=..')).toContainText(`Open positions as of ${ON}: 3 open positions · 1 up, 2 down · -10.0% avg unrealized (not in the figures above).`);
  await expect(page.locator('#cmp-b-h').locator('xpath=..')).toContainText(`Open positions as of ${ON}: 1 open position · 0 up, 1 down · -25.0% unrealized.`);
  await common(page);
  // A stock nobody holds: nothing new.
  await page.goto('/t/F6N');
  await expect(page.locator('main [data-open]')).toHaveCount(0);
  // /how explains the figures.
  await page.goto('/how');
  await expect(page.getByText('Stock pages show only a total of open positions in that stock, never who holds them; each trader’s open positions are on their profile.')).toBeVisible();
  await expect(page.locator('main')).not.toContainText('not on stock pages');
  await common(page);
});

test('F-6: the Similar trades pane (/u/<h>/pane) carries open positions for a connected record only (review B2)', async ({ request }) => {
  // F-23: the pane JSON carries the pane's model: the open block (counts by printed tone, the average at the printed
  // precision) and the as-of UTC day, never the raw unrealized_pct values or a ms time.
  const mixed = await (await request.get('/u/f6_mixed/pane?v=2')).json();
  expect(mixed.model.open).toEqual({ n: 3, up: 1, down: 1, flat: 1, avg: -0.067 });
  expect(mixed.model.openAsOf).toBe('2026-10-30');
  expect(JSON.stringify(mixed)).not.toMatch(/unrealized|"open":\[/);
  const stray = await (await request.get('/u/f6_stray/pane?v=2')).json();
  expect(stray.model.open).toBeNull();
  expect(stray.model.openAsOf).toBeNull();
  expect((await request.get('/u/f6_importing/pane?v=2')).status()).toBe(404);
});

test('F-6 (business lead D5): at 360 px every big value sits on one line at one size in both grids, nothing widens the page', async ({ page }) => {
  const used: number[] = [];
  for (const h of ['f6_wide', 'f6_losing', 'f6_mixed']) {
    await page.goto(`/u/${h}`);
    const values = page.locator('main > section.stats .stat.big b');
    await expect(values).toHaveCount(4);
    // Headroom, not a bare fit: each value's text uses at most 80% of its box here, since other machines' fonts render
    // wider (CI's did, by more than this container's 3% margin before long values took the smaller size).
    const m = await values.evaluateAll((bs) => bs.map((b) => { const r = document.createRange(); r.selectNodeContents(b);
      return { size: getComputedStyle(b).fontSize, rects: b.getClientRects().length, over: b.scrollWidth > b.clientWidth + 1, used: r.getBoundingClientRect().width / b.clientWidth }; }));
    expect(new Set(m.map((x) => x.size)).size, h).toBe(1);
    for (const x of m) { expect(x.rects, h).toBe(1); expect(x.over, h).toBe(false); expect(x.used, h).toBeLessThanOrEqual(0.8); used.push(x.used); }
    expect(await page.evaluate(() => document.documentElement.scrollWidth), h).toBeLessThanOrEqual(360);
  }
  console.log(`F-6 D5 widest value uses ${Math.max(...used).toFixed(3)} of its box`);
});
