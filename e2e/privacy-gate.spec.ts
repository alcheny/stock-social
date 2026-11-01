// Privacy work (2026-11-01): what the e2e server (a sandbox build: ALLOW_DEV_AUTH=1, the loopback vendor fake, no real
// mail or provider; lib/launch-gate.ts) shows with the launch switch closed. The closed states themselves are covered
// by lib/launch-gate*.test.ts and by the committee's user test on a closed server (docs/features/logs/privacy/).
import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL!, { max: 2, onnotice: () => {} });
const cronSecret = process.env.CRON_SECRET ?? readFileSync(new URL('../.env', import.meta.url), 'utf8').match(/^CRON_SECRET=(.*)$/m)?.[1];
const handle = `pv_${Math.random().toString(36).slice(2, 10)}`;
test.afterAll(async () => { await sql`delete from users where handle = ${handle}`; await sql.end({ timeout: 1 }); });

// Every cookie name in lib/privacy-cookies.ts#COOKIE_TABLE (the unit test holds the table to the code).
const COOKIES = ['sid', 'auth_last_method', 'login_email', 'login_attempt', 'connect_attempt', 'auth_tx'];

test('sandbox, 360px: /login keeps every method with no closed notice; the dev path signs in; /me/likes shows the owner\'s likes line; every cookie set is in the cookie table', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto('/login');
  await expect(page.getByRole('button', { name: 'Connect a brokerage instead' })).toBeVisible();
  await expect(page.getByText("Sign-up isn't open yet")).toHaveCount(0);
  await page.goto('/login/dev');
  await page.getByLabel('Handle').fill(handle);
  await page.getByLabel('I am 18 or older').check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(new RegExp(`/u/${handle}$`));
  await page.goto('/me/likes');
  const line = page.getByText('Only you can see your likes. Traders are never told and no one sees a count. Likes help order your own feed.');
  await expect(line).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  await page.goto('/connect');
  await expect(page.getByRole('link', { name: 'Connect brokerage (read-only)' })).toBeVisible();
  await expect(page.getByText("Connecting a brokerage isn't open yet.")).toHaveCount(0);
  const names = (await page.context().cookies()).map((c) => c.name);
  expect(names.length).toBeGreaterThan(0);
  for (const n of names) expect(COOKIES, n).toContain(n);
});

test('the tick reports the gate state and the privacy purge with counts only', async ({ request }) => {
  const r = await request.post('/api/sync', { headers: { authorization: `Bearer ${cronSecret}` } });
  expect(r.status()).toBe(200);
  const body = await r.json();
  expect(body.launch).toEqual({ gate: 'sandbox', allowHandles: 0, allowEmails: 0 });
  expect(body.privacy === null || typeof body.privacy.sessions === 'number').toBe(true);
  expect(body.displayLog === null || typeof body.displayLog.written === 'number').toBe(true);
  expect(JSON.stringify(body)).not.toMatch(/@|"handle"/);
});
