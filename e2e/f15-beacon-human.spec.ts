// F-15 · the view beacon in a browser that does not report automation (as a person's would): sent once, after 2 s
// visible, to the app's own origin, with the referrer as a class and the landing via; counted in the rollup; never while
// hidden; soft navigations count once each. Shared database: counts are read as deltas on the demo trader's own rows.
import { expect, test } from '@playwright/test';
import postgres from 'postgres';
import { watch } from './f15-watch.ts';

// The browser's automation flag is hidden and its agent is a desktop browser's, as in a person's browser (the headless
// agent declares itself and is dropped, as it should be).
test.use({ userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36' });
test.beforeEach(async ({ page }) => { await page.addInitScript(() => Object.defineProperty(Navigator.prototype, 'webdriver', { configurable: true, get: () => false })); });
const sql = postgres(process.env.DATABASE_URL!, { max: 2, onnotice: () => {} });
test.afterAll(async () => { await sql.end({ timeout: 1 }); });
const HANDLE = 'momentum_maya';
const counted = async () => Number((await sql`select coalesce(sum(r.n), 0)::int n from view_rollup r join users u on u.id = r.user_id
  where u.handle = ${HANDLE} and r.day = current_date and r.surface = 'profile' and r.ref_class = 'external' and r.via = 'card' and not r.signed_in`)[0].n);
// The browser's automation flag is hidden and its agent is a desktop browser's, as in a person's browser (the headless
// agent declares itself and is dropped, as it should be).
test.use({ userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36' });
test.beforeEach(async ({ page }) => { await page.addInitScript(() => Object.defineProperty(Navigator.prototype, 'webdriver', { configurable: true, get: () => false })); });

test('one beacon after 2 s visible: same origin, path, referrer class, landing via; one row counted', async ({ page, baseURL }) => {
  const before = await counted();
  const seen = watch(page);
  const t0 = Date.now();
  const res = await page.goto(`/u/${HANDLE}?via=card`, { referer: 'https://elsewhere.example/some/thread?id=123' });
  expect(res?.status()).toBe(200);
  await expect.poll(() => seen.length, { timeout: 8_000 }).toBe(1);
  expect(seen[0].at - t0).toBeGreaterThanOrEqual(2_000);
  expect(new URL(seen[0].req.url()).origin).toBe(new URL(baseURL!).origin);
  expect(seen[0].body).toEqual({ path: `/u/${HANDLE}`, ref: 'external', via: 'card', auto: false });
  expect(JSON.stringify(seen[0].body)).not.toContain('elsewhere');
  expect((await seen[0].req.response())?.status()).toBe(204);
  await expect.poll(counted).toBeGreaterThan(before);
  await page.waitForTimeout(2_500);
  expect(seen.length).toBe(1); // once per page
  expect((await page.context().cookies()).map((c) => c.name)).toEqual([]); // no cookie for a signed-out reader
  expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0]);
});

test('a page kept hidden sends nothing; once visible it waits its 2 s, then sends', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __vis: DocumentVisibilityState };
    w.__vis = 'hidden';
    Object.defineProperty(Document.prototype, 'visibilityState', { configurable: true, get: () => w.__vis });
    Object.defineProperty(Document.prototype, 'hidden', { configurable: true, get: () => w.__vis === 'hidden' });
  });
  const seen = watch(page);
  await page.goto('/how');
  await page.waitForTimeout(3_000);
  expect(seen.length).toBe(0);
  const shown = Date.now();
  await page.evaluate(() => { (window as unknown as { __vis: string }).__vis = 'visible'; document.dispatchEvent(new Event('visibilitychange')); });
  await expect.poll(() => seen.length, { timeout: 8_000 }).toBe(1);
  expect(seen[0].at - shown).toBeGreaterThanOrEqual(1_900);
  expect(seen[0].body).toMatchObject({ path: '/how', ref: 'none' });
});

test('soft navigations count once each, as internal, with no via carried forward', async ({ page }) => {
  const seen = watch(page);
  await page.goto('/?via=inv_t');
  await expect.poll(() => seen.length, { timeout: 8_000 }).toBe(1);
  expect(seen[0].body).toMatchObject({ path: '/', ref: 'none', via: 'inv_t' });
  const href = await page.locator('.row .card .who').first().getAttribute('href');
  await page.locator('.row .card .who').first().click();
  await expect(page).toHaveURL(new RegExp(`${href}$`));
  await expect.poll(() => seen.length, { timeout: 8_000 }).toBe(2);
  expect(seen[1].body).toEqual({ path: href, ref: 'internal', auto: false });
  // Same first segment (/u/a → /u/b): the root template does not remount; the pathname still re-arms the beacon.
  const other = href === `/u/${HANDLE}` ? '/u/dividend_dan' : `/u/${HANDLE}`;
  await page.evaluate((to) => (window as unknown as { next: { router: { push(u: string): void } } }).next.router.push(to), other);
  await expect(page).toHaveURL(new RegExp(`${other}$`));
  await expect.poll(() => seen.length, { timeout: 8_000 }).toBe(3);
  expect(seen[2].body).toEqual({ path: other, ref: 'internal', auto: false });
  await page.waitForTimeout(2_500);
  expect(seen.length).toBe(3);
});

test('leaving before 2 s sends nothing for the page left', async ({ page }) => {
  const seen = watch(page);
  await page.goto('/how');
  await page.waitForTimeout(800);
  await page.goto('/login');
  await expect.poll(() => seen.length, { timeout: 8_000 }).toBe(1);
  expect(seen[0].body.path).toBe('/login');
});
