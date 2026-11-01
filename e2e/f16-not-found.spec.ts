// F-16 / F-17 Step 0 spike (plan docs/features/logs/F-16-F-17/plan.md §11, §13, §R3; engineer E1, business lead B4):
// on the production build, every notFound() under /u/<handle>/** takes its head from app/u/[handle]/not-found.tsx.
// A hidden profile and a retired handle each answer 404 with exactly one <title> (their own), exactly one h1, noindex
// and `private, no-store`; an unknown handle keeps the generic "Page not found · Stock Social". Fixture rows are this
// file's own (unique handles), removed by id/handle at the end.
import { expect, test, type Page } from '@playwright/test';

const GENERIC = 'Page not found · Stock Social';
const HIDDEN = 'Profile not available · Stock Social';
const RETIRED = 'Handle no longer in use · Stock Social';

async function expectNotFound(page: Page, url: string, title: string, h1: string) {
  const res = await page.goto(url);
  expect(res?.status(), url).toBe(404);
  const cc = (res?.headers()['cache-control'] ?? '').toLowerCase();
  expect(cc, `${url} cache-control`).toContain('no-store');
  expect(cc, `${url} cache-control`).toContain('private');
  // Next 16 may stream the metadata after the first bytes, so the head is read once it has settled (polled), and it
  // must then hold exactly this one title.
  await expect.poll(() => page.locator('title').allTextContents(), { message: url }).toEqual([title]);
  expect(await page.locator('head title').allTextContents(), url).toEqual([title]);
  await expect(page.locator('h1'), url).toHaveCount(1);
  await expect(page.locator('h1'), url).toHaveText(h1);
  await expect(page.locator('meta[name="robots"][content*="noindex"]').first(), url).toBeAttached();
  for (const t of await page.locator('meta[property="og:title"]').evaluateAll((ms) => ms.map((m) => m.getAttribute('content')))) expect(t, url).toBe(title);
  // A 404's link preview never points at a record card (plan §2.1: no og:image).
  await expect(page.locator('meta[property="og:image"], meta[name="twitter:image"]'), url).toHaveCount(0);
}

test('a hidden profile and a retired handle answer their own neutral 404 on the profile, trade, month and report paths', async ({ page }) => {
  const { default: postgres } = await import('postgres');
  const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
  const tag = `nf16${Math.random().toString(36).slice(2, 8)}`;
  const hidden = `${tag}h`;
  const retired = `${tag}r`;
  let attempt: number | null = null;
  try {
    const [u] = await sql`
      with a as (insert into signup_attempts (method, adult_attested_at) values ('dev', now()) returning id)
      insert into users (handle, display_name, adult_attested_at, signup_attempt_id, hidden_at)
      select ${hidden}, 'Quiet Fixture Trader', now(), a.id, now() from a returning signup_attempt_id`;
    attempt = u.signup_attempt_id as number;
    await sql`insert into handle_reservations (handle, until) values (${retired}, now() + interval '1 day')`;
    for (const path of ['', '/trade/x', '/month/2026-01', '/report']) {
      await expectNotFound(page, `/u/${hidden}${path}`, HIDDEN, 'Profile not available');
      await expect(page.locator('body')).not.toContainText('Quiet Fixture Trader');
      await expectNotFound(page, `/u/${retired}${path}`, RETIRED, 'This handle is no longer in use');
    }
    // Never used: the generic page and title, as before.
    await expectNotFound(page, `/u/${tag}n`, GENERIC, 'Page not found');
    await expectNotFound(page, `/u/${tag}n/trade/x`, GENERIC, 'Page not found');
  } finally {
    await sql`delete from handle_reservations where handle = ${retired}`;
    await sql`delete from users where handle = ${hidden}`;
    if (attempt !== null) await sql`delete from signup_attempts where id = ${attempt}`;
    await sql.end({ timeout: 1 });
  }
});
