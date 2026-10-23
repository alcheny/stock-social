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
  await expect(page.locator('ul.notice li').nth(1)).toHaveText('Every account under this login');
  await expect(page.locator('ul.notice li').nth(2)).toHaveText('2 accounts found (1 simulated, not imported)');
  const sql = await db();
  const [u] = await sql`select id from users where handle = ${handle}`;
  const provisional = async () => {
    expect((await sql`select 1 from activities where user_id = ${u.id}`).length).toBe(0);
    expect((await sql`select confirmed_at from broker_accounts where user_id = ${u.id}`).every((r) => r.confirmed_at === null)).toBe(true);
  };
  await provisional();
  // D1: the hourly tick while the consent is open imports nothing and confirms nothing.
  if (cronSecret) { await tick(page.request); await provisional(); expect((await sql`select state from connections where user_id = ${u.id}`)[0].state).toBe('pending'); }
  await page.setViewportSize({ width: 375, height: 740 });
  await page.screenshot({ path: test.info().outputPath('s4-consent.png'), fullPage: true });
  await page.getByRole('button', { name: 'Import my record' }).click();
  await expect(page).toHaveURL(new RegExp(`/u/${handle}$`));
  await expect(page.getByRole('status')).toHaveText('Importing your record · 0 trades so far');
  await expect(page.locator('.record-body')).toHaveText('Your trades appear here as they import.');
  await expect(page.locator('main')).not.toContainText('No closed trades yet');
  const [c] = await sql`select id, state, consent_at from connections where user_id = ${u.id}`;
  expect(c.state).toBe('importing');
  expect(c.consent_at).toBeTruthy();
  // D7: revisiting the consent or result page after consent shows the import, never an error.
  for (const path of [`/connect/consent?c=${c.id}`, `/connect/result?c=${c.id}`]) {
    await page.goto(path);
    await expect(page).toHaveURL(new RegExp(`/u/${handle}$`));
    await expect(page.getByRole('status')).toHaveText('Importing your record · 0 trades so far');
    await expect(page.locator('main')).not.toContainText('Connection not completed');
  }
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
  expect((await page.locator('.positions li a').first().boundingBox())!.height).toBeGreaterThanOrEqual(44); // D9: the symbol link is a tap target
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

test('connect pages without a valid connection (D3, D9): ?k=abandoned is S7a with focus on the alert; a missing or malformed c is a plain not-found page, never a 500; a signed-in portal return with no link is S7a; a profile being deleted is hidden from the feed, the profile and the ticker page', async ({ page }) => {
  await page.goto('/connect/result?k=abandoned');
  const h1 = page.locator('h1'); // role="alert" replaces the heading role in the accessibility tree
  await expect(h1).toHaveText('Connection not completed. Nothing was saved.');
  await expect(h1).toHaveAttribute('role', 'alert');
  await expect(page.getByRole('link', { name: 'Try again' })).toHaveAttribute('href', '/connect');
  await expect(page.getByRole('link', { name: 'Not now' })).toHaveAttribute('href', '/');
  await expect.poll(() => page.evaluate(() => document.activeElement?.id)).toBe('result-heading');
  for (const path of ['/connect/result', '/connect/result?c=abc', '/connect/result?c=99999999999999999999', '/connect/result?c=1.5', '/connect/consent', '/connect/consent?c=0', '/connect/consent?c=NaN']) {
    const r = await page.request.get(path);
    expect([200, 404], path).toContain(r.status());
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 }), path).toHaveText('Connection not found.');
    await expect(page.getByRole('link', { name: 'Connect a brokerage' })).toHaveAttribute('href', '/connect');
  }
  // Signed in, a portal return that produced no link lands on S7a, not silently on the profile.
  const handle = `abn${uniq()}`;
  await devSignIn(page, handle);
  await page.goto('/connect/done');
  await expect(page).toHaveURL(/\/connect\/result\?k=abandoned$/);
  await expect(page.locator('h1')).toHaveText('Connection not completed. Nothing was saved.');
  // A user marked deleted_at (vendor deletion pending) is public nowhere, even with a feed-worthy record.
  const sql = await db();
  const [u] = await sql`select id from users where handle = ${handle}`;
  const sym = `ZDL${uniq().slice(0, 3).toUpperCase()}`;
  for (let i = 0; i < 5; i++) await sql`insert into closed_trades (user_id, sell_id, account_id, symbol, opened_at, closed_at, return_pct, holding_days, verified)
    values (${u.id}, ${`${handle}-s${i}`}, 'demo', ${sym}, now() - interval '2 days', now() - interval '1 hour', 0.9, 1, true)`;
  await page.context().clearCookies();
  await page.goto('/');
  await expect(page.locator('main')).toContainText(`@${handle}`);
  await sql`update users set deleted_at = now() where id = ${u.id}`;
  await page.goto('/');
  await expect(page.locator('main')).not.toContainText(handle);
  expect((await page.request.get(`/u/${handle}`)).status()).toBe(404);
  expect((await page.request.get(`/u/${handle}/opengraph-image`)).status()).toBe(404);
  await page.goto(`/t/${sym}`);
  await expect(page.locator('main')).not.toContainText(handle);
  await sql`delete from users where id = ${u.id}`;
});

test('a vendor refusal fails the import and the hourly sync never publishes the partial record (D4, D5): a 5xx defers with backoff and keeps the cursor; a 403 fails; the profile shows the failed state with a retry, signed in and out', async ({ page }) => {
  const handle = `fai${uniq()}`;
  await devSignIn(page, handle);
  test.skip(!(await vendorConfigured(page)), 'the server has no vendor fake configured (see the header of this spec)');
  test.skip(!cronSecret, 'CRON_SECRET is not known to the spec');
  const a1 = `e2e-${handle}-1`, a2 = `e2e-${handle}-2`;
  await scenario([{ id: a1, activities: 4 }, { id: a2, activities: 4 }]);
  await connectThrough(page);
  await page.getByRole('button', { name: 'Import my record' }).click();
  await expect(page).toHaveURL(new RegExp(`/u/${handle}$`));
  const sql = await db();
  const [u] = await sql`select id from users where handle = ${handle}`;
  const conn = async () => (await sql`select id, state, failure_reason, import_cursor from connections where user_id = ${u.id} order by id desc limit 1`)[0];
  expect((await step(page.request)).imported).toBe(4); // the first account's page
  // 503 (the SDK retries a 429 in-process first; a 5xx reaches the app directly): deferred, still importing, cursor kept, no page consumed.
  await fetch(`${vendor.base}/_fail`, { method: 'POST', body: JSON.stringify({ status: 503, times: 1 }) });
  let r = await step(page.request);
  expect(r).toMatchObject({ state: 'importing', imported: 4 });
  let c = await conn();
  expect(c.state).toBe('importing');
  expect(c.import_cursor.retries).toBe(1);
  expect(c.import_cursor.retryAt).toBeGreaterThan(Date.now());
  expect(c.import_cursor.i).toBe(1);
  r = await step(page.request); // before retryAt: no vendor call, nothing changes
  expect(r).toMatchObject({ state: 'importing', imported: 4 });
  // 403 once the backoff has passed: failed, reason vendor.
  await sql`update connections set import_cursor = import_cursor || '{"retryAt": 0}' where id = ${c.id}`;
  await fetch(`${vendor.base}/_fail`, { method: 'POST', body: JSON.stringify({ status: 403, times: 1 }) });
  r = await step(page.request);
  expect(r.state).toBe('failed');
  c = await conn();
  expect(c.failure_reason).toBe('vendor');
  // The tick: no sync for a trader without a connected connection; nothing published.
  const t = await tick(page.request);
  expect(t.failed).not.toContain(u.id);
  expect((await sql`select count(*)::int as n from activities where user_id = ${u.id}`)[0].n).toBe(4); // the second account was never read
  expect((await sql`select count(*)::int as n from closed_trades where user_id = ${u.id}`)[0].n).toBe(0);
  // The profile says so and offers the retry; the S8 empty-record line never shows.
  await page.goto(`/u/${handle}`);
  await expect(page.locator('p[role="alert"]')).toContainText('The import did not finish, so this record may be incomplete.');
  await expect(page.getByRole('link', { name: 'Try again' })).toHaveAttribute('href', '/connect');
  await expect(page.locator('main')).not.toContainText('No closed trades yet');
  await expect(page.locator('.rows:not(.positions) li')).toHaveCount(0);
  await page.context().clearCookies();
  await page.goto(`/u/${handle}`);
  await expect(page.locator('.record-failed')).toContainText('may be incomplete');
  await expect(page.getByRole('link', { name: 'Try again' })).toHaveCount(0);
  await sql`delete from users where id = ${u.id}`;
  await sql`delete from broker_accounts where account_id in (${a1}, ${a2})`;
});

test('fix round 2: a link waiting on consent shows nothing public (signed out: no simulated-account line, "No trades yet."); a brokerage-first attempt refused on a claimed account gets a short S6b heading with the explanation as body text; after consent the confirmed count and the S8 line show', async ({ page, browser }) => {
  const handle = `pnd${uniq()}`;
  await devSignIn(page, handle);
  test.skip(!(await vendorConfigured(page)), 'the server has no vendor fake configured (see the header of this spec)');
  const acc = `e2e-${handle}`, pap = `${acc}-paper`;
  await scenario([{ id: acc, activities: 0 }, { id: pap, paper: true, activities: 2 }]);
  await connectThrough(page);
  await expect(page).toHaveURL(/\/connect\/consent\?c=\d+$/);
  const consentUrl = page.url();
  const sql = await db();
  expect((await sql`select count(*)::int as n from broker_accounts where account_id = ${pap} and confirmed_at is null`)[0].n).toBe(1);
  // Signed out, the pending link contributes nothing to the public profile.
  const anon = await browser.newContext();
  const p2 = await anon.newPage();
  await p2.goto(`/u/${handle}`);
  await expect(p2.locator('main')).not.toContainText('simulated');
  await expect(p2.locator('main')).not.toContainText('No closed trades yet');
  await expect(p2.locator('.record-body')).toHaveText('No trades yet.');
  await expect(p2.locator('.positions')).toHaveCount(0);
  // S6b: a brokerage-first attempt linking the same real account is refused; short heading, explanation as body.
  const attempt = await brokerageAttempt(p2);
  await scenario([{ id: acc, activities: 0 }]);
  await p2.goto(`/connect/start?attempt=${attempt}`);
  await p2.getByRole('button', { name: 'Connect' }).click();
  await expect(p2).toHaveURL(/\/connect\/result\?c=\d+&k=refused$/);
  const h1 = p2.locator('h1');
  await expect(h1).toHaveText("We couldn't link that broker account.");
  await expect(h1).toHaveAttribute('aria-describedby', 'result-body');
  await expect(p2.locator('#result-body')).toContainText('already connected to another Stock Social profile');
  await expect.poll(() => p2.evaluate(() => document.activeElement?.id)).toBe('result-heading');
  await p2.setViewportSize({ width: 375, height: 740 });
  expect((await h1.boundingBox())!.height).toBeLessThan(120); // a heading, not a paragraph (re-run 1: ~12 lines)
  // The owner consents: the confirmed simulated account and the S8 line now show, signed out too.
  await page.goto(consentUrl);
  await page.getByRole('button', { name: 'Import my record' }).click();
  await expect(page).toHaveURL(new RegExp(`/u/${handle}$`));
  let r = await step(page.request);
  for (let i = 0; i < 6 && r.state === 'importing'; i++) r = await step(page.request);
  expect(r.state).toBe('connected');
  await p2.goto(`/u/${handle}`);
  await expect(p2.locator('main')).toContainText('1 simulated account excluded');
  await expect(p2.locator('.record-body')).toHaveText('No closed trades yet. Your record starts with your first close.');
  await anon.close();
  await sql`delete from users where handle = ${handle}`;
  await sql`delete from broker_accounts where account_id in (${acc}, ${pap})`;
});

test('fix round 3: a second link consented while a 3-account import runs keeps the record importing (banner, no Verified badge or stats, signed out too) until both finish; the poll drives both and ends connected with 7 closes', async ({ page, browser }) => {
  const handle = `two${uniq()}`;
  await devSignIn(page, handle);
  test.skip(!(await vendorConfigured(page)), 'the server has no vendor fake configured (see the header of this spec)');
  const a = [1, 2, 3].map((n) => `e2e-${handle}-${n}`), b = `e2e-${handle}-b`;
  await scenario(a.map((id) => ({ id, activities: 4 })));
  await connectThrough(page);
  await page.getByRole('button', { name: 'Import my record' }).click();
  await expect(page).toHaveURL(new RegExp(`/u/${handle}$`));
  expect(await step(page.request)).toMatchObject({ state: 'importing', imported: 4 }); // account 1 of 3
  // A second link (1 account, 2 activities) while the first import runs; consented.
  await scenario([{ id: b, activities: 2 }]);
  await connectThrough(page);
  await expect(page).toHaveURL(/\/connect\/consent\?c=\d+$/);
  await page.getByRole('button', { name: 'Import my record' }).click();
  await expect(page).toHaveURL(new RegExp(`/u/${handle}$`));
  const sql = await db();
  const [u] = await sql`select id from users where handle = ${handle}`;
  // Finish only the second link out of band (what the old newest-row poll did), leaving the first importing.
  const [second] = await sql`select id from connections where user_id = ${u.id} order by id desc limit 1`;
  const [firstRow] = await sql`select id from connections where user_id = ${u.id} and id <> ${second.id} and state = 'importing'`;
  await sql`update connections set import_cursor = import_cursor || '{"retryAt": 9999999999999}' where id = ${firstRow.id}`;
  let r = await step(page.request);
  for (let i = 0; i < 6 && (await sql`select state from connections where id = ${second.id}`)[0].state === 'importing'; i++) r = await step(page.request);
  expect((await sql`select state from connections where id = ${second.id}`)[0].state).toBe('connected');
  expect(r.state).toBe('importing'); // the aggregate: the first import is still running
  expect((await sql`select count(*)::int as n from closed_trades where user_id = ${u.id}`)[0].n).toBeGreaterThan(0);
  // Signed out: the banner shows and nothing is presented as complete.
  const anon = await browser.newContext();
  const p2 = await anon.newPage();
  await p2.setViewportSize({ width: 375, height: 740 });
  await p2.goto(`/u/${handle}`);
  await expect(p2.locator('.importing')).toContainText('Importing your record');
  await expect(p2.locator('.badge.verified')).toHaveCount(0);
  await expect(p2.locator('section.stats')).toHaveCount(0);
  await expect(p2.locator('main')).not.toContainText('win rate');
  await expect(p2.locator('main')).not.toContainText('Connected:');
  await expect(p2.locator('.record-body')).toHaveText('Your trades appear here as they import.');
  await p2.screenshot({ path: test.info().outputPath('profile-two-imports-importing.png'), fullPage: true });
  // The poll resumes the first import and the record ends whole.
  await sql`update connections set import_cursor = import_cursor - 'retryAt' where id = ${firstRow.id}`;
  for (let i = 0; i < 8 && r.state === 'importing'; i++) r = await step(page.request);
  expect(r).toMatchObject({ state: 'connected', closes: 7 });
  await p2.goto(`/u/${handle}`);
  await expect(p2.locator('.importing')).toHaveCount(0);
  await expect(p2.locator('.badge.verified')).toHaveCount(1);
  await expect(p2.locator('section.stats').first()).toContainText('win rate');
  await expect(p2.locator('.rows:not(.positions) li')).toHaveCount(7);
  await anon.close();
  await sql`delete from users where id = ${u.id}`;
  await sql`delete from broker_accounts where account_id = any(${[...a, b]})`;
});
