// F-15 · the view beacon against the running app (docs/features/F-15-measurement-foundation.md): sent once, after 2 s
// visible, to the app's own origin, with the referrer as a class and the landing via; never while hidden; no visible
// UI, focusable element or layout shift; the page stays fine when the route fails; soft navigations count once each.
// Shared database: counts are read as deltas on the demo trader's own rows for today.
import { expect, test } from '@playwright/test';
import { watch } from './f15-watch.ts';
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL!, { max: 2, onnotice: () => {} });
test.afterAll(async () => { await sql.end({ timeout: 1 }); });
const HANDLE = 'momentum_maya';
// The automation flag is hidden, as in a person's browser (a browser that reports it sends no beacon: tested last).
test.beforeEach(async ({ page }, info) => {
  if (!info.title.startsWith('automation')) await page.addInitScript(() => Object.defineProperty(Navigator.prototype, 'webdriver', { configurable: true, get: () => false }));
});

test('no visible UI, no focusable element, no layout shift, the DOM unchanged by the beacon (360 px)', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.addInitScript(() => {
    const w = window as unknown as { __shifts: number[] };
    w.__shifts = [];
    new PerformanceObserver((l) => { for (const e of l.getEntries()) w.__shifts.push(e.startTime); }).observe({ type: 'layout-shift', buffered: true });
  });
  const seen = watch(page);
  await page.goto(`/u/${HANDLE}`);
  await page.waitForLoadState('networkidle');
  const focusable = () => page.evaluate(() => document.querySelectorAll('a[href], button, input, select, textarea, [tabindex]').length);
  const snap = async () => [await page.locator('body').ariaSnapshot(), await focusable(), await page.evaluate(() => document.body.querySelectorAll('*').length)];
  const before = await snap();
  await expect.poll(() => seen.length, { timeout: 8_000 }).toBe(1);
  const firedAt = await page.evaluate(() => performance.now());
  await page.waitForTimeout(500);
  expect(await snap()).toEqual(before);
  const late = await page.evaluate((t) => (window as unknown as { __shifts: number[] }).__shifts.filter((s) => s > t - 600), firedAt);
  expect(late).toEqual([]);
});

test('the beacon route failing (500, or the network refusing it) leaves the page usable with no error shown', async ({ page, context }) => {
  for (const mode of ['500', 'abort'] as const) {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    let hits = 0;
    await page.route('**/api/views', (r) => { hits++; return mode === '500' ? r.fulfill({ status: 500, body: 'boom' }) : r.abort(); });
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.addInitScript(() => { delete (Navigator.prototype as { share?: unknown }).share; });
    const res = await page.goto('/u/momentum_maya/month/' + (await latestMonth()));
    expect(res?.status()).toBe(200);
    await expect.poll(() => hits, { timeout: 8_000 }).toBe(1);
    await expect(page.getByText(/boom|error|went wrong/i)).toHaveCount(0);
    await page.getByRole('button', { name: 'Share' }).click();
    await expect(page.getByRole('button', { name: 'Link copied' })).toBeVisible();
    expect(errors).toEqual([]);
    await page.unroute('**/api/views');
  }
});

test('the feed: scroll position and the open pane survive the beacon', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  const seen = watch(page);
  await page.goto('/');
  const row = page.locator('.row').first();
  await expect.poll(async () => { await page.keyboard.press('ArrowRight'); return row.evaluate((el) => el.scrollLeft); }).toBeGreaterThan(300);
  await page.locator('.feed').evaluate((f) => f.scrollTo(0, 40));
  const pos = () => Promise.all([row.evaluate((el) => el.scrollLeft), page.locator('.feed').evaluate((f) => f.scrollTop)]);
  // Let the snap scroll settle before the beacon fires (it waits 2 s).
  let at = await pos();
  await expect.poll(async () => { const prev = at; await page.waitForTimeout(150); at = await pos(); return JSON.stringify(at) === JSON.stringify(prev); }).toBe(true);
  expect(seen.length).toBe(0);
  await expect.poll(() => seen.length, { timeout: 8_000 }).toBe(1);
  await page.waitForTimeout(300);
  expect(await pos()).toEqual(at);
  await page.keyboard.press('ArrowLeft');
  await expect.poll(() => row.evaluate((el) => el.scrollLeft)).toBe(0);
});

async function latestMonth(): Promise<string> {
  const [r] = await sql`select to_char(max(c.closed_at), 'YYYY-MM') ym from closed_trades c join users u on u.id = c.user_id where u.handle = ${HANDLE}`;
  return r.ym as string;
}

test('automation: a browser that reports automation sends no beacon at all', async ({ page }) => {
  const seen = watch(page);
  await page.goto(`/u/${HANDLE}`);
  await page.waitForTimeout(3_000);
  expect(seen.length).toBe(0);
});
