// F-7 public-record traders in the feed (plan-round2-engineer.md §4.3 AC 14, 20-22, 25, 28; docs/features/logs/F-7/plan.md
// Round 4 item 3, Round 5 items 3-5 and 7): a fictional filer's closes rank like anyone's, under the Public filing and
// Demo badges and the card line, with no Like or Follow; a close inside the 30-day floor never reaches the feed; stock
// pages leave public closes out. The fixture filer is this spec's own and feed-eligible, so the shared feed lock is held.
import { test, expect, type Page } from '@playwright/test';
import postgres from 'postgres';
import { feedLock } from './feed-lock.ts';
import { deleteFilers, insertFiler, RAW_AMOUNTS, withoutKeys } from './f7-fixture.ts';

const DISCLAIMER = 'Not investment advice. Past performance does not guarantee future results.';
const sql = postgres(process.env.DATABASE_URL!, { max: 2, onnotice: () => {} });
const F = 'pf_e7f';
// Six closes within the hour, large moves (they score near the top), every one past its floor; one more inside it.
const CLOSES = [0.45, -0.5, 0.4, -0.42, 0.38, -0.36].map((r, i) => ({ symbol: `ZQF${i}`, r, daysAgo: 0.01 + i * 0.002, hold: 2, feedAfterDaysAgo: 0.005 }));
const LATE = { symbol: 'ZQFL', r: 0.9, daysAgo: 0.005, hold: 1, feedAfterDaysAgo: -29 };

test.describe.configure({ mode: 'serial' });
let release: (() => Promise<void>) | null = null;
test.beforeAll(async () => {
  release = await feedLock('shared');
  await deleteFilers(sql, [F]);
  await insertFiler(sql, { handle: F, name: 'Fictional Filer Feed', closes: [...CLOSES, LATE] });
});
test.afterAll(async () => {
  await deleteFilers(sql, [F]);
  await sql.end({ timeout: 1 });
  await release?.();
});

// Walks the feed's server-rendered pages (the plain "more" link) until the filer's row shows; at most 12 pages.
async function findRow(page: Page) {
  let url: string | null = '/';
  for (let i = 0; i < 12 && url; i++) {
    await page.goto(url);
    if (await page.locator(`.row[data-handle="${F}"]`).count()) return page.locator(`.row[data-handle="${F}"]`);
    url = await page.locator('.feed-more a.button[href*="after="]').getAttribute('href').catch(() => null);
  }
  throw new Error(`${F} not in the feed list`);
}

test('AC 14, 20, Round 5 items 3, 5: the card carries both badges, the card line and the footer; never Verified or Like', async ({ browser }) => {
  test.setTimeout(test.info().timeout + 60_000);
  const ctx = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 360, height: 640 } });
  const page = await ctx.newPage();
  try {
    const rows = await findRow(page);
    const card = rows.first().locator('article.card');
    await expect(card.locator('.badge.public')).toHaveText('Public filing');
    await expect(card.locator('.badge.demo')).toHaveText('Demo');
    await expect(card.locator('.badge.verified')).toHaveCount(0);
    await expect(card.locator('[data-public-card]')).toHaveText('Company insider · from a public filing');
    await expect(card.locator(`footer a[href="/u/${F}"]`)).toHaveText(`Record, wins and losses: @${F} →`); // F-25: the visually hidden handle sits between the words and the arrow
    await expect(card.locator(`footer a[href="/u/${F}"]`)).toHaveAttribute('href', `/u/${F}`);
    await expect(card.locator('[data-like], .like-mark')).toHaveCount(0);
    // AC 21: the close inside the floor is on no card.
    await expect(page.locator(`.row[data-handle="${F}"] .symbol`, { hasText: 'ZQFL' })).toHaveCount(0);
    // Round 5 item 4: the pane leads with the chart, above the fold at 360 x 640 (15% headroom), then the line and its link.
    const pane = rows.first().locator('section.pane');
    await expect(pane.locator('[data-public-line]')).toContainText('has not joined Stock Social');
    await expect(pane.locator('[data-public-line] a')).toHaveAttribute('href', '/public-records');
    await expect(pane.getByRole('button', { name: /follow/i })).toHaveCount(0);
    const fold = await pane.evaluate((el) => { const top = el.getBoundingClientRect().top; return el.querySelector('figure.chart')!.getBoundingClientRect().bottom - top; });
    expect(fold).toBeLessThanOrEqual(640 * 0.85);
    const order = await pane.evaluate((el) => [...el.querySelectorAll('figure.chart, [data-public-line]')].map((n) => n.tagName));
    expect(order).toEqual(['FIGURE', 'P']);
    const html = await page.content();
    for (const a of RAW_AMOUNTS) expect(withoutKeys(html)).not.toContain(a);
    await expect(page.locator('footer#site-footer')).toContainText(DISCLAIMER);
  } finally {
    await ctx.close();
  }
});

test('UX (committee): at 360 px the pane header shows a 40-character name whole, with no horizontal scroll', async ({ browser }) => {
  test.setTimeout(test.info().timeout + 60_000);
  const LONG = 'Fictional Filer With A Long Display Name';
  expect(LONG).toHaveLength(40);
  await sql`update users set display_name = ${LONG} where handle = ${F}`;
  const ctx = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 360, height: 640 } });
  try {
    const page = await ctx.newPage();
    const who = (await findRow(page)).first().locator('section.pane header .who');
    await expect(who.locator('strong')).toHaveText(LONG);
    const fit = await who.evaluate((el) => [...el.querySelectorAll('strong, .muted')].map((n) => n.scrollWidth <= n.clientWidth + 1 && n.getBoundingClientRect().right <= el.closest('section.pane')!.getBoundingClientRect().right + 1));
    expect(fit).toEqual([true, true]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  } finally {
    await ctx.close();
    await sql`update users set display_name = 'Fictional Filer Feed' where handle = ${F}`;
  }
});

test('AC 25, 28: signed in, the same card with no Like and no Follow; the feed reads the same for both', async ({ browser }) => {
  test.setTimeout(test.info().timeout + 60_000);
  const out = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 360, height: 800 } });
  const ctx = await browser.newContext({ viewport: { width: 360, height: 800 } });
  const h = `e7f${Math.random().toString(36).slice(2, 8)}`;
  try {
    const anon = (await findRow(await out.newPage())).first().locator('article.card');
    const text = (await anon.locator('.hero').innerText()) + (await anon.locator('[data-public-card]').innerText());
    const me = await ctx.newPage();
    await me.goto('/login/dev');
    await me.getByLabel('Handle').fill(h);
    await me.getByLabel('I am 18 or older').check();
    await me.getByRole('button', { name: 'Continue' }).click();
    await expect(me).toHaveURL(new RegExp(`/u/${h}$`));
    const row = (await findRow(me)).first();
    const card = row.locator('article.card');
    expect((await card.locator('.hero').innerText()) + (await card.locator('[data-public-card]').innerText())).toBe(text);
    await expect(row.locator('[data-like]')).toHaveCount(0);
    await expect(row.getByRole('button', { name: /follow/i })).toHaveCount(0);
    // A connected or demo card on the same page keeps its Like.
    expect(await me.locator(`.row:not([data-handle="${F}"]) [data-like]`).count()).toBeGreaterThan(0);
  } finally {
    await out.close();
    await ctx.close();
    await sql`delete from users where handle = ${h}`;
  }
});

test('AC 22: stock pages and the stock index leave public closes out', async ({ page, request }) => {
  await page.goto('/t/ZQF0');
  expect(await page.locator('main').innerText()).not.toContain(F);
  await page.goto('/t');
  expect(await page.locator('main').innerText()).not.toContain('ZQF0');
  expect((await request.get('/t/ZQF0/opengraph-image')).status()).toBe(200); // the neutral "no trades" card
  await page.goto('/t/compare?a=ZQF0&b=ZQF1');
  expect(await page.locator('main').innerText()).not.toContain(F);
});
