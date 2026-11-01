// FIXES-CYCLE4-PART2 (docs/features/logs/fixes-cycle4/committee-part2-2026-11-01.md) against the running app:
// - F4-4: the demo options trader's month with option closes says "Excluding options" by its figures, counts the month's
//   option closes in the legal words, heads its list "Closed trades this month" and names closed share trades in the foot;
//   a trader without options keeps the old foot. Every month heading is "Closed trades this month".
// - F4-14: a fictional demo filer's badges read "Demo Public filing".
// - F4-15: the demo options trader's unfurl image still renders (1200×630 PNG).
// - F4-16: the chart sheet shows a dated note's "Written ‹date›, after the trade closed · edited ‹date›".
// Own fixtures only (random tag), removed at the end; feed-eligible fixtures hold the feed lock shared.
import { expect, test } from '@playwright/test';
import postgres from 'postgres';
import { feedLock } from './feed-lock.ts';
import { deleteFilers, insertFiler } from './f7-fixture.ts';

const tag = Math.random().toString(36).slice(2, 7);
const NOTE_USER = `fc4n${tag}`, FILER = `pf_fc4${tag}`;
const DAY = 86_400_000;
const sql = postgres(process.env.DATABASE_URL!, { max: 2, onnotice: () => {} });
let release: (() => Promise<void>) | null = null;
// User test: the note is written and edited after its trade closed (10 days ago), as the caption says.
const WRITTEN = new Date(Date.now() - 9 * DAY), EDITED = new Date(Date.now() - 7 * DAY);
const noteDay = (d: Date) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(d);

test.beforeAll(async () => {
  release = await feedLock('shared');
  const [u] = await sql`with a as (insert into signup_attempts (method, adult_attested_at) values ('dev', now()) returning id)
    insert into users (handle, display_name, adult_attested_at, signup_attempt_id) select ${NOTE_USER}, ${NOTE_USER}, now(), a.id from a returning id, signup_attempt_id`;
  await sql`insert into closed_trades (user_id, sell_id, account_id, symbol, opened_at, closed_at, return_pct, holding_days, verified, thesis, thesis_status, thesis_written_at, thesis_edited_at)
    values (${u.id}, ${`${NOTE_USER}-0`}, 'a', 'FCQ', ${new Date(Date.now() - 12 * DAY)}, ${new Date(Date.now() - 10 * DAY)}, 0.04, 2, true,
      'Bought the base retest, sold at the old high.', 'published', ${WRITTEN}, ${EDITED})`;
  // The chart draws from two closes; this older one has no note.
  await sql`insert into closed_trades (user_id, sell_id, account_id, symbol, opened_at, closed_at, return_pct, holding_days, verified)
    values (${u.id}, ${`${NOTE_USER}-1`}, 'a', 'FCR', ${new Date(Date.now() - 22 * DAY)}, ${new Date(Date.now() - 20 * DAY)}, -0.02, 2, true)`;
  // A connected record (as e2e/f26-held-like-none.spec.ts makes one), so the profile draws its chart.
  await sql`insert into connections (attempt_id, user_id, state, consent_at, importing_at, last_progress_at, connected_at)
    values (${u.signup_attempt_id}, ${u.id}, 'connected', now(), now(), now(), now() - interval '3 days')`;
  await insertFiler(sql, { handle: FILER, name: 'Fictional Filer', demo: true, closes: [{ symbol: 'ZZQ', r: 0.05, daysAgo: 40 }] });
});
test.afterAll(async () => {
  await sql`delete from users where handle = ${NOTE_USER}`;
  await deleteFilers(sql, [FILER]);
  await release?.();
  await sql.end({ timeout: 1 });
});

test('F4-4: a month with option closes is qualified, counted, headed "Closed trades this month" and footed with share trades', async ({ page }) => {
  const [m] = await sql`select to_char(max(t.closed_at), 'YYYY-MM') as ym from option_trades t join users u on u.id = t.user_id where u.handle = 'yolo_yuki'`;
  const [s] = await sql`select count(*)::int as n from closed_trades t join users u on u.id = t.user_id where u.handle = 'yolo_yuki' and to_char(t.closed_at, 'YYYY-MM') = ${m.ym}`;
  test.skip(!m.ym || s.n === 0, 'the seed has no share close in the option month');
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto(`/u/yolo_yuki/month/${m.ym}`);
  await expect(page.locator('section[aria-labelledby="this-month"]')).toContainText('Excluding options');
  await expect(page.locator('[data-month-options]')).toContainText(/\d+ option trades? imported\. Option results aren't shown on this record\./);
  await expect(page.locator('[data-month-options] a[href="/how#options"]')).toHaveText('How options are counted');
  await expect(page.getByRole('heading', { name: 'Closed trades this month' })).toBeVisible();
  await expect(page.getByText('All trades this month')).toHaveCount(0);
  await expect(page.getByText("Recaps list the month's Demo share trades, not from a real broker, and none can be hidden.")).toBeVisible();
  expect(await page.locator('meta[name="description"]').getAttribute('content')).toMatch(/this month, excluding options · /);
  expect(await page.locator('meta[property="og:image:alt"]').getAttribute('content')).toContain('excluding options');
  const img = await page.request.get(`/u/yolo_yuki/month/${m.ym}/opengraph-image`);
  expect(img.status()).toBe(200);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('F4-4: a trader without options keeps the old foot and no qualifier; the heading is the same', async ({ page }) => {
  const [m] = await sql`select to_char(max(t.closed_at), 'YYYY-MM') as ym from closed_trades t join users u on u.id = t.user_id where u.handle = 'momentum_maya'`;
  await page.goto(`/u/momentum_maya/month/${m.ym}`);
  await expect(page.getByRole('heading', { name: 'Closed trades this month' })).toBeVisible();
  await expect(page.locator('[data-month-options]')).toHaveCount(0);
  await expect(page.locator('section[aria-labelledby="this-month"]')).not.toContainText('Excluding options');
  await expect(page.getByText("Recaps list the month's Demo trades, not from a real broker, and none can be hidden.")).toBeVisible();
});

test('F4-14: a demo filer\'s badges read as two words', async ({ page }) => {
  await page.goto(`/u/${FILER}`);
  const pair = page.locator('.badge.public').first().locator('xpath=..');
  await expect(pair).toContainText('Demo Public filing');
  await expect(pair).not.toContainText('DemoPublic');
});

test('F4-15: the demo options trader\'s unfurl renders', async ({ request }) => {
  const r = await request.get('/u/yolo_yuki/opengraph-image');
  expect(r.status()).toBe(200);
  const png = await r.body();
  expect(png.readUInt32BE(16)).toBe(1200);
  expect(png.readUInt32BE(20)).toBe(630);
});

test('F4-16: the chart sheet shows the note\'s written and edited dates', async ({ page }) => {
  await page.goto(`/u/${NOTE_USER}`);
  const sheet = page.locator('.chart .sheet');
  await page.locator('.chart-stack').focus();
  // The newest close (the noted one) is the last point: the first ArrowLeft lands on it.
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Enter');
  await expect(sheet.locator('figcaption')).toHaveText(`Note by @${NOTE_USER} · Written ${noteDay(WRITTEN)}, after the trade closed · edited ${noteDay(EDITED)}`);
});
