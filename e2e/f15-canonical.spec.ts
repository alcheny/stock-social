// F-15 second half · canonical links: the profile, trade and month pages declare their untagged address (the trade
// page with the same spelling its Share link uses), so a shared ?via= copy is never indexed as its own page; no og:url
// (it would strip the source class from previews); a missing page declares none.
import { expect, test } from '@playwright/test';
import postgres from 'postgres';
import { siteOrigin } from '../lib/site-origin.ts';

const sql = postgres(process.env.DATABASE_URL!, { max: 2, onnotice: () => {} });
test.afterAll(async () => { await sql.end({ timeout: 1 }); });
const HANDLE = 'momentum_maya';
// The origin the app resolves canonical links against: the same rule and environment the server reads (lib/site-origin.ts).
const ORIGIN = siteOrigin(process.env);
const canonical = (page: import('@playwright/test').Page) => page.locator('link[rel="canonical"]').getAttribute('href');

test('profile, trade and month pages: an absolute untagged canonical; the trade one equals its Share link minus via', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.addInitScript(() => { delete (Navigator.prototype as { share?: unknown }).share; });
  await page.goto(`/u/${HANDLE}?via=card`);
  expect(await canonical(page)).toBe(`${ORIGIN}/u/${HANDLE}`);
  await expect(page.locator('meta[property="og:url"]')).toHaveCount(0);
  const [t] = await sql`select c.sell_id s, to_char(c.closed_at at time zone 'UTC', 'YYYY-MM') ym from closed_trades c join users u on u.id = c.user_id
    where u.handle = ${HANDLE} order by c.closed_at desc limit 1`;
  const trade = `/u/${HANDLE}/trade/${encodeURIComponent(t.s)}`;
  await page.goto(`${trade}?via=trade&x=1`);
  const c = await canonical(page);
  expect(c).toBe(`${ORIGIN}${trade}`);
  await page.getByRole('button', { name: 'Share' }).click();
  await expect(page.getByRole('button', { name: 'Link copied' })).toBeVisible();
  const shared = await page.evaluate(() => navigator.clipboard.readText());
  expect(new URL(shared.replace(/\?via=trade$/, '')).pathname).toBe(new URL(c!).pathname); // the same spelling
  await page.goto(`/u/${HANDLE}/month/${t.ym}?via=month`);
  expect(await canonical(page)).toBe(`${ORIGIN}/u/${HANDLE}/month/${t.ym}`);
});

test('an over-encoded trade address gives the same canonical; a missing page declares none', async ({ page }) => {
  const [t] = await sql`select c.sell_id s from closed_trades c join users u on u.id = c.user_id where u.handle = ${HANDLE} order by c.closed_at desc limit 1`;
  const plain = `/u/${HANDLE}/trade/${encodeURIComponent(t.s)}`;
  const over = `/u/${HANDLE}/trade/${[...String(t.s)].map((ch) => /[A-Za-z]/.test(ch) ? `%${ch.charCodeAt(0).toString(16).toUpperCase()}` : encodeURIComponent(ch)).join('')}`;
  await page.goto(plain);
  const a = await canonical(page);
  const res = await page.goto(over);
  if (res?.status() === 200) expect(await canonical(page)).toBe(a);
  expect(a).toBe(`${ORIGIN}${plain}`);
  const missing = await page.goto(`/u/${HANDLE}/trade/no-such-trade-f15`);
  expect(missing?.status()).toBe(404);
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
});
