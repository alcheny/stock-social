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

// Cycle 2 review of fix #20: a profile that 404s (no such handle, or a deletion in progress) shows the 404 page's own
// title, never a profile's name in the tab or in a shared link's preview.
test('fix #20: a profile 404 carries the 404 title, not a profile title', async ({ page }) => {
  const { default: postgres } = await import('postgres');
  const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
  const handle = `nf${Math.random().toString(36).slice(2, 9)}`;
  let attempt: number | null = null;
  try {
    const [u] = await sql`
      with a as (insert into signup_attempts (method, adult_attested_at) values ('dev', now()) returning id)
      insert into users (handle, display_name, adult_attested_at, signup_attempt_id, deleted_at)
      select ${handle}, 'Leaving Trader', now(), a.id, now() from a returning signup_attempt_id`;
    attempt = u.signup_attempt_id as number;
    // F-16/F-17 (plan §2.1): a handle whose deletion is in progress is a retired handle, with its own neutral 404 title.
    for (const [h, title] of [[`${handle}x`, 'Page not found · Stock Social'], [handle, 'Handle no longer in use · Stock Social']]) { // never existed; marked for deletion
      const res = await page.goto(`/u/${h}`);
      expect(res?.status(), h).toBe(404);
      await expect(page).toHaveTitle(title);
      // A shared link's preview says "not found" too (Next adds og:title from the 404 page's own title).
      for (const t of await page.locator('meta[property="og:title"]').evaluateAll((ms) => ms.map((m) => m.getAttribute('content')))) expect(t, h).toBe(title);
      // The segment's card image link resolves to a 404, never a profile card.
      // F-16/F-17: app/u/[handle]/not-found.tsx sets no og:image at all (e2e/f16-not-found.spec.ts); if one appears, it 404s.
      const [img] = await page.locator('meta[property="og:image"]').evaluateAll((ms) => ms.map((m) => m.getAttribute('content')));
      if (img) expect((await page.request.get(img)).status(), img).toBe(404);
      await expect(page.locator('body')).not.toContainText('Leaving Trader');
    }
  } finally {
    await sql`delete from users where handle = ${handle}`;
    if (attempt !== null) await sql`delete from signup_attempts where id = ${attempt}`;
    await sql.end({ timeout: 1 });
  }
});
