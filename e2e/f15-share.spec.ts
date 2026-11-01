// F-15 · Share and copy-link append the right `?via=` class and stay one tap; "Link copied" is announced in a polite live
// region (360 px, signed out, from a shared link). The profile owner's Share is covered in e2e/app.spec.ts (via=card).
import { expect, test } from '@playwright/test';
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL!, { max: 2, onnotice: () => {} });
test.afterAll(async () => { await sql.end({ timeout: 1 }); });
const HANDLE = 'momentum_maya';

test.beforeEach(async ({ page, context }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.addInitScript(() => { delete (Navigator.prototype as { share?: unknown }).share; }); // the copy path
});

for (const kind of ['trade', 'month'] as const) {
  test(`${kind} page: one tap copies the link tagged via=${kind}; the polite live region says Link copied`, async ({ page, baseURL }) => {
    const [r] = kind === 'trade'
      ? await sql`select c.sell_id k from closed_trades c join users u on u.id = c.user_id where u.handle = ${HANDLE} order by c.closed_at desc limit 1`
      : await sql`select to_char(max(c.closed_at), 'YYYY-MM') k from closed_trades c join users u on u.id = c.user_id where u.handle = ${HANDLE}`;
    const path = `/u/${HANDLE}/${kind}/${encodeURIComponent(r.k)}`;
    await page.goto(`${path}?via=card`); // arrived from a shared link
    const live = page.locator('[aria-live="polite"]').filter({ hasText: /^$|Link copied/ }).first();
    await expect(live).toHaveText('');
    await page.getByRole('button', { name: 'Share' }).click();
    await expect(page.getByRole('button', { name: 'Link copied' })).toBeVisible();
    await expect(page.locator('[aria-live="polite"]', { hasText: 'Link copied' })).toHaveCount(1);
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(`${baseURL}${path}?via=${kind}`);
    await expect(page).toHaveURL(new RegExp(`${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\?via=card$`)); // the page itself is unchanged
  });
}

test('the page canonical link stays untagged', async ({ page }) => {
  await page.goto(`/u/${HANDLE}?via=card`);
  for (const sel of ['link[rel="canonical"]', 'meta[property="og:url"]']) {
    const el = page.locator(sel);
    if (await el.count()) expect((await el.first().getAttribute(sel.startsWith('link') ? 'href' : 'content')) ?? '').not.toContain('via=');
  }
});
