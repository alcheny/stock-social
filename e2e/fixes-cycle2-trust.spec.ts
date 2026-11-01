// Approval council cycle 2, trust rows: fix #20 (a real 404 page) and fix #21 (distinct page titles), signed out.
import { expect, test } from '@playwright/test';

test('fix #20: an unknown address is a real 404 with its own title and a way back', async ({ page }) => {
  const res = await page.goto('/no-such-page-here');
  expect(res?.status()).toBe(404);
  await expect(page.locator('h1')).toHaveText('Page not found');
  await expect(page).toHaveTitle('Page not found · Stock Social');
  await expect(page.locator('meta[name="robots"][content*="noindex"]').first()).toBeAttached();
  await page.setViewportSize({ width: 360, height: 740 });
  for (const name of ['Back to the feed', 'All stocks']) {
    const box = await page.locator('main').getByRole('link', { name }).boundingBox();
    expect(box!.height, name).toBeGreaterThanOrEqual(44); // user test: a 44 px target
  }
  await page.getByRole('link', { name: 'Back to the feed' }).click();
  await expect(page).toHaveURL(/\/$/);
});

test('fix #21: sign-in and legal pages each have their own title', async ({ page }) => {
  const seen = new Map<string, string>();
  for (const [url, title] of [
    ['/login', 'Sign in · Stock Social'],
    ['/login/dev', 'Dev sign-in · Stock Social'],
    ['/terms', 'Terms of Service · Stock Social'],
    ['/privacy', 'Privacy Policy · Stock Social'],
  ] as const) {
    await page.goto(url);
    await expect(page).toHaveTitle(title);
    const t = await page.title();
    expect(seen.has(t), `${url} repeats ${seen.get(t)}`).toBe(false);
    seen.set(t, url);
  }
});
