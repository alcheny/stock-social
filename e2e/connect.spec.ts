// F-1 PR-2a: the connection flow end to end against `npm run start` (ALLOW_DEV_AUTH=1) and the in-repo vendor fake
// (e2e/fakes/vendor.ts, started here on a fixed port). The vendor-backed tests need the server started with
//   SNAPTRADE_BASE_URL=http://127.0.0.1:4102 SNAPTRADE_CLIENT_ID=e2e SNAPTRADE_CONSUMER_KEY=e2e
// (otherwise they skip and say so, as the provider tests in signin.spec.ts do). The tick tests call POST /api/sync with
// CRON_SECRET read from .env (the value `next start` loads). /how, the footer links and /settings need no vendor.
import { expect, test, type Page, type APIRequestContext } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { Server } from 'node:http';
import postgres from 'postgres';
import { startVendorFake, type FakeAccount } from './fakes/vendor.ts';

const VENDOR_PORT = Number(process.env.VENDOR_FAKE_PORT ?? 4102);
let vendor: { server: Server; base: string };
const cronSecret = process.env.CRON_SECRET ?? readFileSync(new URL('../.env', import.meta.url), 'utf8').match(/^CRON_SECRET=(.*)$/m)?.[1];

// Own pool (as app.spec.ts): the shared lib/db.ts pool is ended by signin.spec.ts's afterAll in the same worker.
const sql = postgres(process.env.DATABASE_URL!, { max: 2, onnotice: () => {} });
test.beforeAll(async () => { vendor = await startVendorFake(VENDOR_PORT); });
test.afterAll(async () => {
  vendor?.server.close();
  await sql.end({ timeout: 1 });
});

const db = async () => sql;
const uniq = () => Math.random().toString(36).slice(2, 10);
const scenario = (accounts: FakeAccount[], delayMs = 0) => fetch(`${vendor.base}/_scenario`, { method: 'POST', body: JSON.stringify({ accounts, delayMs }) });
// A brokerage-first attempt as S1 writes it (S1 → S2 itself is covered by signin.spec.ts, whose attempt count is global).
const brokerageAttempt = async (page: Page) => {
  const [a] = await sql`insert into signup_attempts (method, adult_attested_at) values ('brokerage', now()) returning id`;
  const id = Number(a.id);
  for (const [name, meta] of [['landed', { source: 'direct' }], ['method_chosen', { method: 'brokerage' }], ['attested', {}]] as const) await sql`insert into funnel_events (attempt_id, name, meta) values (${id}, ${name}, ${sql.json(meta)})`;
  await page.goto(`/connect?attempt=${id}`);
  await expect(page.getByRole('status')).toHaveText('Sign in first, then connect.');
  return id;
};
const devSignIn = async (page: Page, handle: string) => {
  await page.goto('/login/dev');
  await page.getByLabel('Handle').fill(handle);
  await page.getByLabel('I am 18 or older').check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(new RegExp(`/u/${handle}$`));
};
// The server has the fake configured when /connect/start sends a signed-in trader to it.
async function vendorConfigured(page: Page): Promise<boolean> {
  const r = await page.request.get('/connect/start', { maxRedirects: 0 });
  return r.status() === 307 && (r.headers()['location'] ?? '').startsWith(vendor.base);
}
// S2 → portal → Connect → back; returns the page where the app landed.
async function connectThrough(page: Page) {
  await page.goto('/connect');
  await page.getByRole('link', { name: 'Connect brokerage (read-only)' }).click();
  await expect(page).toHaveURL(new RegExp(`^${vendor.base}/portal`));
  await page.getByRole('button', { name: 'Connect' }).click();
}
const step = (req: APIRequestContext) => req.post('/api/import/step').then((r) => r.json() as Promise<{ state: string; imported: number; closes: number }>);
const tick = async (req: APIRequestContext) => {
  const r = await req.post('/api/sync', { headers: { authorization: `Bearer ${cronSecret}` } });
  expect(r.status()).toBe(200);
  return r.json();
};

test('/how explains what Verified means and what is excluded, percent only, with the disclaimer; Terms, Privacy and How links are in the footer of every page', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 740 });
  await page.goto('/how');
  await expect(page.getByRole('heading', { name: 'How records are calculated', level: 1 })).toBeVisible();
  const text = await page.locator('main').innerText();
  expect(text).toMatch(/imported read-only from the trader.s broker/);
  for (const word of ['Options', 'short sales', 'Transfers in', 'no recorded entry', 'Simulated', 'not connected', 'first in, first out', 'Only percentages']) expect(text).toContain(word);
  expect(text).not.toMatch(/every trade|any broker/i);
  await expect(page.locator('footer.site')).toContainText('Not investment advice. Past performance does not guarantee future results.');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath('how-light.png'), fullPage: true });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.screenshot({ path: test.info().outputPath('how-dark.png'), fullPage: true });
  await page.emulateMedia({ colorScheme: 'light' });
  for (const path of ['/', '/u/momentum_maya', '/login', '/connect', '/terms', '/privacy', '/how', '/t']) {
    await page.goto(path);
    const legal = page.locator('footer.site nav.legal');
    await expect(legal.getByRole('link', { name: 'Terms' })).toHaveAttribute('href', '/terms');
    await expect(legal.getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', '/privacy');
    await expect(legal.getByRole('link', { name: 'How records are calculated' })).toHaveAttribute('href', '/how');
    for (const a of await legal.locator('a').all()) expect((await a.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
});

test('/settings: deleting takes two taps; the first deletes nothing; the second deletes the profile and reserves the handle', async ({ page }) => {
  const handle = `del${uniq()}`;
  await devSignIn(page, handle);
  await page.goto('/settings');
  await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible();
  const first = page.getByTestId('delete-first');
  await expect(first).toHaveText('Delete my profile');
  expect((await first.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await first.click();
  await expect(page).toHaveURL(/\/settings\?confirm=1$/);
  await expect(page.locator('p[role="alert"]')).toHaveText('This cannot be undone.');
  const sql = await db();
  expect((await sql`select 1 from users where handle = ${handle}`).length).toBe(1); // view 2 opened, nothing deleted
  await page.getByRole('link', { name: 'Keep it' }).click();
  await expect(page).toHaveURL(new RegExp(`/u/${handle}$`));
  expect((await sql`select 1 from users where handle = ${handle}`).length).toBe(1);
  await page.goto('/settings?confirm=1');
  await page.getByTestId('delete-final').click();
  await expect(page).toHaveURL(/\/$/);
  expect((await sql`select 1 from users where handle = ${handle}`).length).toBe(0);
  expect((await sql`select 1 from handle_reservations where handle = ${handle} and until > now()`).length).toBe(1);
  const r = await page.request.get(`/u/${handle}`);
  expect(r.status()).toBe(404);
  await sql`delete from handle_reservations where handle = ${handle}`;
});

test('signed in: S2 → portal → consent (zero depth: no activities) → importing profile copy → steps → connected with positions; the S8 line never shows while importing', async ({ page }) => {
  const handle = `con${uniq()}`;
  await devSignIn(page, handle);
  test.skip(!(await vendorConfigured(page)), 'the server has no vendor fake configured (see the header of this spec)');
  const acc = `e2e-${handle}`;
  await scenario([{ id: acc, activities: 6, positions: [{ symbol: 'QQQ', units: 1, price: 110, cost_basis: 100 }] }, { id: `${acc}-paper`, paper: true, activities: 4 }]);
  await connectThrough(page);
  await expect(page).toHaveURL(/\/connect\/consent\?c=\d+$/);
  await expect(page.getByRole('heading', { name: 'Confirm what gets imported', level: 1 })).toBeVisible();
  await expect(page.locator('ul.notice li').nth(1)).toHaveText('Every account under this login (2 accounts found, 1 simulated, not imported)');
  const sql = await db();
  const [u] = await sql`select id from users where handle = ${handle}`;
  expect((await sql`select 1 from activities where user_id = ${u.id}`).length).toBe(0);
  expect((await sql`select confirmed_at from broker_accounts where user_id = ${u.id}`).every((r) => r.confirmed_at === null)).toBe(true);
  await page.setViewportSize({ width: 375, height: 740 });
  await page.screenshot({ path: test.info().outputPath('s4-consent.png'), fullPage: true });
  await page.getByRole('button', { name: 'Import my record' }).click();
  await expect(page).toHaveURL(new RegExp(`/u/${handle}$`));
  await expect(page.getByRole('status')).toHaveText('Importing your record · 0 trades so far');
  await expect(page.locator('.record-body')).toHaveText('Your trades appear here as they import.');
  await expect(page.locator('main')).not.toContainText('No closed trades yet');
  const [c] = await sql`select state, consent_at from connections where user_id = ${u.id}`;
  expect(c.state).toBe('importing');
  expect(c.consent_at).toBeTruthy();
  // The client poll: one page per call until connected.
  let r = await step(page.request);
  expect(r.imported).toBe(6);
  for (let i = 0; i < 6 && r.state === 'importing'; i++) r = await step(page.request);
  expect(r.state).toBe('connected');
  expect(r.closes).toBe(3);
  await page.reload();
  await expect(page.getByRole('status')).toHaveCount(0);
  await expect(page.locator('main')).toContainText('Open positions');
  await expect(page.locator('.positions li')).toHaveText(['QQQ+10.0%']);
  await expect(page.locator('.rows:not(.positions) li')).toHaveCount(3);
  await expect(page.locator('main')).toContainText('1 simulated account excluded');
  expect((await sql`select distinct account_id from activities where user_id = ${u.id}`).map((x) => x.account_id)).toEqual([acc]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath('profile-connected.png'), fullPage: true });
  // Signed out, the same profile reads the same.
  await page.context().clearCookies();
  await page.goto(`/u/${handle}`);
  await expect(page.locator('.positions li')).toHaveText(['QQQ+10.0%']);
  await sql`delete from users where id = ${u.id}`;
  await sql`delete from broker_accounts where account_id in (${acc}, ${`${acc}-paper`})`;
});

test('decline: S6 copy, the link is gone at the vendor, the provisional claim is released and the same account connects again', async ({ page }) => {
  const handle = `dec${uniq()}`;
  await devSignIn(page, handle);
  test.skip(!(await vendorConfigured(page)), 'the server has no vendor fake configured (see the header of this spec)');
  const acc = `e2e-${handle}`;
  await scenario([{ id: acc, activities: 2 }]);
  await connectThrough(page);
  await expect(page).toHaveURL(/\/connect\/consent\?c=\d+$/);
  await page.getByRole('button', { name: "Don't import" }).click();
  await expect(page).toHaveURL(/\/connect\/result\?c=\d+$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Import not started. Nothing is connected.');
  await expect(page.getByRole('link', { name: 'Connect again' })).toHaveAttribute('href', '/connect');
  const sql = await db();
  const [u] = await sql`select id, snaptrade_user_id from users where handle = ${handle}`;
  expect((await sql`select 1 from broker_accounts where account_id = ${acc}`).length).toBe(0);
  const state = await (await fetch(`${vendor.base}/_state`)).json();
  expect(Object.keys(state[u.snaptrade_user_id].connections)).toEqual([]);
  const [c] = await sql`select state, declined_at, cleanup_done_at from connections where user_id = ${u.id}`;
  expect(c.state).toBe('declined');
  expect(c.declined_at && c.cleanup_done_at).toBeTruthy();
  // Again, with consent this time.
  await scenario([{ id: acc, activities: 2 }]);
  await connectThrough(page);
  await expect(page).toHaveURL(/\/connect\/consent\?c=\d+$/);
  await page.getByRole('button', { name: 'Import my record' }).click();
  await expect(page).toHaveURL(new RegExp(`/u/${handle}$`));
  expect((await sql`select user_id from broker_accounts where account_id = ${acc}`)[0].user_id).toBe(u.id);
  await sql`delete from users where id = ${u.id}`;
  await sql`delete from broker_accounts where account_id = ${acc}`;
});

test('brokerage-first: attested attempt → S2 → portal → consent creates the user, signs in by connection; no real account → S6c and no user row', async ({ page }) => {
  const attempt = await brokerageAttempt(page);
  const r = await page.request.get(`/connect/start?attempt=${attempt}`, { maxRedirects: 0 });
  test.skip(!(r.headers()['location'] ?? '').startsWith(vendor.base), 'the server has no vendor fake configured (see the header of this spec)');
  const acc = `e2e-bf-${uniq()}`;
  await scenario([{ id: acc, activities: 2 }]);
  await page.goto(`/connect/start?attempt=${attempt}`);
  await expect(page).toHaveURL(new RegExp(`^${vendor.base}/portal`));
  await page.getByRole('button', { name: 'Connect' }).click();
  await expect(page).toHaveURL(/\/connect\/consent\?c=\d+$/);
  const sql = await db();
  expect((await sql`select 1 from users where signup_attempt_id = ${attempt}`).length).toBe(0); // no user before consent
  await page.getByRole('button', { name: 'Import my record' }).click();
  await expect(page).toHaveURL(/\/u\/trader_[a-z0-9]{8}$/);
  const [u] = await sql`select id, handle, snaptrade_user_id from users where signup_attempt_id = ${attempt}`;
  expect(u.snaptrade_user_id).toMatch(/^stock-social-attempt-/);
  await expect(page.locator('nav.top .me')).toHaveText(`@${u.handle}`); // signed in by completing the connection
  const names = (await sql`select name from funnel_events where attempt_id = ${attempt} order by id`).map((e) => e.name);
  // The probe above opened the portal once too; the landing records own_profile_viewed.
  expect(names.filter((n) => n !== 'portal_opened')).toEqual(['landed', 'method_chosen', 'attested', 'notice_seen', 'link_succeeded', 'consented', 'own_profile_viewed']);
  expect(names.filter((n) => n === 'portal_opened').length).toBeGreaterThanOrEqual(1);
  await sql`delete from users where id = ${u.id}`;
  await sql`delete from broker_accounts where account_id = ${acc}`;

  // S6c: a login with only a simulated account.
  await page.context().clearCookies();
  const attempt2 = await brokerageAttempt(page);
  await scenario([{ id: `e2e-paper-${uniq()}`, paper: true, activities: 2 }]);
  await page.goto(`/connect/start?attempt=${attempt2}`);
  await page.getByRole('button', { name: 'Connect' }).click();
  await expect(page).toHaveURL(/\/connect\/result\?c=\d+&k=none$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('No real brokerage account found.');
  await expect(page.getByRole('link', { name: 'Connect a different brokerage' })).toHaveAttribute('href', '/connect');
  expect((await sql`select 1 from users where signup_attempt_id = ${attempt2}`).length).toBe(0);
  const [a] = await sql`select snaptrade_user_id from signup_attempts where id = ${attempt2}`;
  expect(a.snaptrade_user_id).toBeNull(); // the vendor user went with the attempt
});

test('sign-in by connection: a returning trader whose accounts are all claimed is signed in; a different signed-in trader is refused with the existing message', async ({ page, browser }) => {
  const handle = `own${uniq()}`;
  await devSignIn(page, handle);
  test.skip(!(await vendorConfigured(page)), 'the server has no vendor fake configured (see the header of this spec)');
  const acc = `e2e-${handle}`;
  await scenario([{ id: acc, activities: 2 }]);
  await connectThrough(page);
  await page.getByRole('button', { name: 'Import my record' }).click();
  await expect(page).toHaveURL(new RegExp(`/u/${handle}$`));
  // Signed out, brokerage-first, same account → the owner's profile, signed in, no second user.
  await page.context().clearCookies();
  const attempt = await brokerageAttempt(page);
  await scenario([{ id: acc, activities: 2 }]);
  await page.goto(`/connect/start?attempt=${attempt}`);
  await page.getByRole('button', { name: 'Connect' }).click();
  await expect(page).toHaveURL(new RegExp(`/u/${handle}$`));
  await expect(page.locator('nav.top .me')).toHaveText(`@${handle}`);
  const sql = await db();
  expect((await sql`select 1 from users where signup_attempt_id = ${attempt}`).length).toBe(0);
  // A different signed-in trader is refused.
  const other = await browser.newContext();
  const p2 = await other.newPage();
  const h2 = `oth${uniq()}`;
  await devSignIn(p2, h2);
  await scenario([{ id: acc, activities: 2 }]);
  await connectThrough(p2);
  await expect(p2).toHaveURL(new RegExp(`/u/${h2}\\?connect=account-claimed$`));
  await expect(p2.locator('p[role="alert"]')).toContainText("We couldn't link that broker account.");
  expect((await sql`select user_id from broker_accounts where account_id = ${acc}`).map((r) => r.user_id)).toHaveLength(1);
  await other.close();
  await sql`delete from users where handle in (${handle}, ${h2})`;
  await sql`delete from broker_accounts where account_id = ${acc}`;
});

test('expiry with a clock: a pending consent older than 24 h reads expired and the tick removes the link; a tab closed mid-import is finished by the tick', async ({ page }) => {
  const handle = `exp${uniq()}`;
  await devSignIn(page, handle);
  test.skip(!(await vendorConfigured(page)), 'the server has no vendor fake configured (see the header of this spec)');
  test.skip(!cronSecret, 'CRON_SECRET is not known to the spec');
  const acc = `e2e-${handle}`;
  await scenario([{ id: acc, activities: 2 }]);
  await connectThrough(page);
  await expect(page).toHaveURL(/\/connect\/consent\?c=\d+$/);
  const id = Number(page.url().match(/c=(\d+)/)![1]);
  const sql = await db();
  await sql`update connections set pending_at = now() - interval '25 hours' where id = ${id}`;
  await page.reload(); // the lazy clock on the consent read: no consent form for an expired link
  await expect(page).toHaveURL(new RegExp(`/connect/result\\?c=${id}$`));
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('The time to decide ran out. Import not started. Nothing is connected.');
  expect((await sql`select state from connections where id = ${id}`)[0].state).toBe('expired');
  const [u] = await sql`select id, snaptrade_user_id from users where handle = ${handle}`;
  expect((await sql`select 1 from broker_accounts where account_id = ${acc}`).length).toBe(1); // marked only: cleanup is the tick's
  await tick(page.request);
  expect((await sql`select 1 from broker_accounts where account_id = ${acc}`).length).toBe(0);
  expect(Object.keys((await (await fetch(`${vendor.base}/_state`)).json())[u.snaptrade_user_id].connections)).toEqual([]);
  expect((await sql`select cleanup_done_at from connections where id = ${id}`)[0].cleanup_done_at).toBeTruthy();

  // Tab closed mid-import: consent, no client poll, the tick advances the row to connected.
  await scenario([{ id: acc, activities: 10 }]);
  await connectThrough(page);
  await page.getByRole('button', { name: 'Import my record' }).click();
  await expect(page.getByRole('status')).toHaveText('Importing your record · 0 trades so far');
  await page.goto('/'); // the tab leaves
  const t = await tick(page.request);
  expect(t.connections.advanced).toBe(1);
  await page.goto(`/u/${handle}`);
  await expect(page.getByRole('status')).toHaveCount(0);
  await expect(page.locator('.rows:not(.positions) li')).toHaveCount(5);
  expect((await sql`select state from connections where user_id = ${u.id} order by id desc limit 1`)[0].state).toBe('connected');
  await sql`delete from users where id = ${u.id}`;
  await sql`delete from broker_accounts where account_id = ${acc}`;
});
