// F-1 PR-2a: the connection flow end to end against `npm run start` (ALLOW_DEV_AUTH=1) and the in-repo vendor fake
// (e2e/fakes/vendor.ts, started here on a fixed port). The vendor-backed tests need the server started with
//   SNAPTRADE_BASE_URL=http://127.0.0.1:4102 SNAPTRADE_CLIENT_ID=e2e SNAPTRADE_CONSUMER_KEY=e2e
// (otherwise they skip and say so, as the provider tests in signin.spec.ts do). The tick tests call POST /api/sync with
// CRON_SECRET read from .env (the value `next start` loads). /how, the footer links and /settings need no vendor.
import { expect, test, type Page, type APIRequestContext } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { Server } from 'node:http';
import postgres from 'postgres';
import { startVendorFake, type FakeAccount, type FakeActivity } from './fakes/vendor.ts';

const VENDOR_PORT = Number(process.env.VENDOR_FAKE_PORT ?? 4102);
let vendor: { server: Server; base: string };
const cronSecret = process.env.CRON_SECRET ?? readFileSync(new URL('../.env', import.meta.url), 'utf8').match(/^CRON_SECRET=(.*)$/m)?.[1];

// Own pool (as app.spec.ts): the shared lib/db.ts pool is ended by signin.spec.ts's afterAll in the same worker.
const sql = postgres(process.env.DATABASE_URL!, { max: 2, onnotice: () => {} });
test.beforeAll(async () => { vendor = await startVendorFake(VENDOR_PORT); });
// PR-2b: an owner's open profile now polls POST /api/import/step every 2 s (S5). The tests written before it drive the
// steps themselves through page.request and assert each step's exact effect (forced vendor failures, backoff windows),
// so the page's own background poll is held off for them: only requests from the page are blocked, never the test's.
// Every PR-2b test runs with the live poll.
test.beforeEach(async ({ page }) => {
  if (!test.info().title.startsWith('PR-2b')) await page.context().route('**/api/import/step', (r) => r.abort());
});
test.afterAll(async () => {
  vendor?.server.close();
  await sql.end({ timeout: 1 });
});

const db = async () => sql;
const uniq = () => Math.random().toString(36).slice(2, 10);
const scenario = (accounts: FakeAccount[], delayMs = 0) => fetch(`${vendor.base}/_scenario`, { method: 'POST', body: JSON.stringify({ accounts, delayMs }) });
// A brokerage-first attempt through S1 itself (committee fix): attest, "Connect a brokerage instead", and the attempt is
// bound to this browser by the signed connect_attempt cookie; S2 shows the primary. Returns the attempt id (from the
// cookie: the URL carries none).
const brokerageAttempt = async (page: Page) => {
  await page.goto('/login');
  await page.getByLabel('I am 18 or older and accept the Terms and Privacy Policy').check();
  await page.getByRole('button', { name: 'Connect a brokerage instead' }).click();
  await expect(page).toHaveURL(/\/connect$/);
  await expect(page.getByRole('link', { name: 'Connect brokerage (read-only)' })).toBeVisible();
  const cookie = (await page.context().cookies()).find((c) => c.name === 'connect_attempt');
  expect(cookie?.httpOnly).toBe(true);
  expect(cookie?.path).toBe('/connect');
  return Number(cookie!.value.split('.')[0]);
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
// S2 → portal → Connect → back. PR-2b: the primary opens the vendor's portal embedded in the S3 dialog (the vendor's
// URL, framed), and its own "Connect" posts SUCCESS, which takes the app to /connect/done like the redirect did.
const portalFrame = (page: Page) => page.locator('dialog.portal iframe');
async function connectThrough(page: Page) {
  await page.goto('/connect');
  await page.getByRole('link', { name: 'Connect brokerage (read-only)' }).click();
  await expect(portalFrame(page)).toHaveAttribute('src', new RegExp(`^${vendor.base}/portal`));
  await page.frameLocator('dialog.portal iframe').getByRole('button', { name: 'Connect' }).click();
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
  await scenario([{ id: acc, activities: 6, positions: [{ symbol: 'QQQ', units: 10, price: 110, cost_basis: 100 }] }, { id: `${acc}-paper`, paper: true, activities: 4 }]);
  await connectThrough(page);
  await expect(page).toHaveURL(/\/connect\/consent\?c=\d+$/);
  await expect(page.getByRole('heading', { name: 'Confirm what gets imported', level: 1 })).toBeVisible();
  // Committee fix (item 7): the history and accounts scope is one line, the count follows it.
  await expect(page.locator('ul.notice li').nth(0)).toHaveText('Full trade history your broker provides, from every account under this login');
  await expect(page.locator('ul.notice li').nth(1)).toHaveText('2 accounts found (1 simulated, not imported)');
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
  await expect(page.getByRole('status')).toHaveText('Importing your record · 0 closed trades so far');
  await expect(page.locator('.record-body')).toHaveText('Your trades appear here as they import.');
  await expect(page.locator('main')).not.toContainText('No closed trades yet');
  const [c] = await sql`select id, state, consent_at from connections where user_id = ${u.id}`;
  expect(c.state).toBe('importing');
  expect(c.consent_at).toBeTruthy();
  // D7: revisiting the consent or result page after consent shows the import, never an error.
  for (const path of [`/connect/consent?c=${c.id}`, `/connect/result?c=${c.id}`]) {
    await page.goto(path);
    await expect(page).toHaveURL(new RegExp(`/u/${handle}$`));
    await expect(page.getByRole('status')).toHaveText('Importing your record · 0 closed trades so far');
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
  const r = await page.request.get('/connect/start', { maxRedirects: 0 });
  test.skip(!(r.headers()['location'] ?? '').startsWith(vendor.base), 'the server has no vendor fake configured (see the header of this spec)');
  const acc = `e2e-bf-${uniq()}`;
  await scenario([{ id: acc, activities: 2 }]);
  await page.goto('/connect/start');
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
  await page.goto('/connect/start');
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
  await page.goto('/connect/start');
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
  // PR-2b (UX carried item d): a short heading, the rest as body text.
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('The time to decide ran out.');
  await expect(page.locator('#result-body')).toHaveText('Import not started. Nothing is connected.');
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
  await expect(page.getByRole('status')).toHaveText('Importing your record · 0 closed trades so far');
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
  await expect(page.locator('.badge.verified')).toHaveCount(0); // fix round 4: a failed record is never badged Verified
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
  await p2.goto('/connect/start');
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
  expect(await p2.locator('meta[property="og:image:alt"]').getAttribute('content')).toBe(`Trading record card for @${handle} on Stock Social: Importing record`);
  await expect(p2.locator('.badge.verified')).toHaveCount(0);
  await expect(p2.locator('section.stats')).toHaveCount(0);
  await expect(p2.locator('main')).not.toContainText('win rate');
  await expect(p2.locator('main')).not.toContainText('Connected:');
  // Committee fix (item 8): trades are listed, so the importing line is not repeated above them; the banner says it.
  await expect(p2.locator('.rows:not(.positions) li').first()).toBeVisible();
  await expect(p2.locator('.record-body')).toHaveCount(0);
  await p2.screenshot({ path: test.info().outputPath('profile-two-imports-importing.png'), fullPage: true });
  // Reviewer fix (TR-3): the trade and month pages and their link previews show no whole-record stats while importing.
  const [lastClose] = await sql`select sell_id, closed_at from closed_trades where user_id = ${u.id} order by closed_at desc limit 1`;
  const lc = new Date(lastClose.closed_at as Date);
  const lym = `${lc.getUTCFullYear()}-${String(lc.getUTCMonth() + 1).padStart(2, '0')}`;
  for (const path of [`/u/${handle}/trade/${encodeURIComponent(lastClose.sell_id as string)}`, `/u/${handle}/month/${lym}`]) {
    await p2.goto(path);
    const whole = p2.locator('section[aria-labelledby="whole-record"]');
    await expect(whole.locator('.importing'), path).toHaveText('Import in progress. Stats appear when the import finishes.');
    await expect(whole, path).not.toContainText('win rate');
    await expect(whole, path).not.toContainText('avg return');
    await expect(whole.locator('.badge.new'), path).toHaveCount(0);
    const description = await p2.locator('meta[name="description"]').getAttribute('content');
    expect(description!, path).toContain('so far · Import in progress');
    expect(description!, path).not.toMatch(/whole record: .*win rate|avg return|verified/i);
  }
  // The poll resumes the first import and the record ends whole.
  await sql`update connections set import_cursor = import_cursor - 'retryAt' where id = ${firstRow.id}`;
  for (let i = 0; i < 8 && r.state === 'importing'; i++) r = await step(page.request);
  expect(r).toMatchObject({ state: 'connected', closes: 7 });
  await p2.goto(`/u/${handle}`);
  await expect(p2.locator('.importing')).toHaveCount(0);
  await expect(p2.locator('.badge.verified')).toHaveCount(1);
  await expect(p2.locator('section.stats').first()).toContainText('win rate');
  await expect(p2.locator('.rows:not(.positions) li')).toHaveCount(7);
  await p2.goto(`/u/${handle}/trade/${encodeURIComponent(lastClose.sell_id as string)}`);
  await expect(p2.locator('section[aria-labelledby="whole-record"]')).toContainText('win rate');
  await expect(p2.locator('section[aria-labelledby="whole-record"] .importing')).toHaveCount(0);
  await anon.close();
  await sql`delete from users where id = ${u.id}`;
  await sql`delete from broker_accounts where account_id = any(${[...a, b]})`;
});

// Fix round 3 (TR-3): the feed leaves out a trader while any consented import is still running, and shows them again
// once every import has finished. Recent trades with large moves so the trader ranks in the feed when eligible.
test('fix round 3: the feed omits a trader whose second import is still running and shows them once it finishes', async ({ page, browser }) => {
  const handle = `fd${uniq()}`;
  await devSignIn(page, handle);
  test.skip(!(await vendorConfigured(page)), 'the server has no vendor fake configured (see the header of this spec)');
  const recent = (acc: string, pairs: number): FakeActivity[] => Array.from({ length: pairs }, (_, i) => {
    const t = Date.now() - (pairs - i + 1) * 3 * 3_600_000, sym = ['AAA', 'BBB', 'CCC'][i % 3];
    return [
      { id: `${acc}-b${i}`, symbol: sym, type: 'BUY' as const, units: 10, price: 100, fee: 0, trade_date: new Date(t).toISOString() },
      { id: `${acc}-s${i}`, symbol: sym, type: 'SELL' as const, units: 10, price: i % 2 ? 80 : 125, fee: 0, trade_date: new Date(t + 3_600_000).toISOString() },
    ];
  }).flat();
  const [a1, a2, a3] = [1, 2, 3].map((n) => `e2e-${handle}-${n}`);
  const anon = await browser.newContext();
  const feed = await anon.newPage();
  const inFeed = async () => { await feed.goto('/'); return feed.locator(`a[href="/u/${handle}"]`).count(); };
  // First link: 5 closes, finished → eligible for the feed.
  await scenario([{ id: a1, activities: recent(a1, 5) }]);
  await connectThrough(page);
  await page.getByRole('button', { name: 'Import my record' }).click();
  await expect(page).toHaveURL(new RegExp(`/u/${handle}$`));
  let r = await step(page.request);
  for (let i = 0; i < 6 && r.state === 'importing'; i++) r = await step(page.request);
  expect(r).toMatchObject({ state: 'connected', closes: 5 });
  expect(await inFeed()).toBeGreaterThan(0);
  // Second link (2 accounts) consented; one step reads account 1 of 2, so the import is still running.
  await scenario([{ id: a2, activities: recent(a2, 2) }, { id: a3, activities: recent(a3, 2) }]);
  await connectThrough(page);
  await expect(page).toHaveURL(/\/connect\/consent\?c=\d+$/);
  await page.getByRole('button', { name: 'Import my record' }).click();
  await expect(page).toHaveURL(new RegExp(`/u/${handle}$`));
  r = await step(page.request);
  expect(r).toMatchObject({ state: 'importing', closes: 5 });
  expect(await inFeed()).toBe(0);
  for (let i = 0; i < 8 && r.state === 'importing'; i++) r = await step(page.request);
  expect(r).toMatchObject({ state: 'connected', closes: 9 });
  expect(await inFeed()).toBeGreaterThan(0);
  await anon.close();
  await sql`delete from users where handle = ${handle}`;
  await sql`delete from broker_accounts where account_id = any(${[a1, a2, a3]})`;
});

test('fix round 4 (TR-3): a trader whose second import failed stays in the feed, and the pane says the record may be incomplete with no Verified badge, stats beside the line', async ({ page, browser }) => {
  const handle = `ff${uniq()}`;
  await devSignIn(page, handle);
  test.skip(!(await vendorConfigured(page)), 'the server has no vendor fake configured (see the header of this spec)');
  const recent = (acc: string, pairs: number): FakeActivity[] => Array.from({ length: pairs }, (_, i) => {
    const t = Date.now() - (pairs - i + 1) * 3 * 3_600_000, sym = ['AAA', 'BBB', 'CCC'][i % 3];
    return [
      { id: `${acc}-b${i}`, symbol: sym, type: 'BUY' as const, units: 10, price: 100, fee: 0, trade_date: new Date(t).toISOString() },
      { id: `${acc}-s${i}`, symbol: sym, type: 'SELL' as const, units: 10, price: i % 2 ? 80 : 125, fee: 0, trade_date: new Date(t + 3_600_000).toISOString() },
    ];
  }).flat();
  const [a1, a2, a3] = [1, 2, 3].map((n) => `e2e-${handle}-${n}`);
  const anon = await browser.newContext();
  const feed = await anon.newPage();
  await feed.setViewportSize({ width: 375, height: 800 });
  const pane = () => feed.locator('.row', { has: feed.locator(`a[href="/u/${handle}"]`) }).first().locator('section.pane');
  const card = () => feed.locator('.row', { has: feed.locator(`a[href="/u/${handle}"]`) }).first().locator('article.card');
  // First link: 5 closes, finished → in the feed, Verified, no incomplete line.
  await scenario([{ id: a1, activities: recent(a1, 5) }]);
  await connectThrough(page);
  await page.getByRole('button', { name: 'Import my record' }).click();
  await expect(page).toHaveURL(new RegExp(`/u/${handle}$`));
  let r = await step(page.request);
  for (let i = 0; i < 6 && r.state === 'importing'; i++) r = await step(page.request);
  expect(r).toMatchObject({ state: 'connected', closes: 5 });
  await feed.goto('/');
  await expect(pane().locator('.badge.verified')).toHaveCount(1);
  await expect(pane().locator('.record-failed')).toHaveCount(0);
  await expect(card().locator('.badge.verified')).toHaveCount(1);
  await expect(card().locator('.record-failed')).toHaveCount(0);
  await feed.goto(`/u/${handle}`);
  await expect(feed.locator('.badge.verified')).toHaveCount(1);
  // Fix round 5: the stock page's trade rows for this trader are Verified while the record is whole.
  const stockRows = () => feed.locator(`a.trow[href="/u/${handle}"]`);
  await feed.goto('/t/AAA');
  await expect(stockRows().first()).toBeAttached();
  await expect(stockRows().first().locator('.badge.verified')).toHaveCount(1);
  // Second link (2 accounts) consented; one step reads account 1 of 2, then the vendor refuses (403) → failed.
  await scenario([{ id: a2, activities: recent(a2, 2) }, { id: a3, activities: recent(a3, 2) }]);
  await connectThrough(page);
  await expect(page).toHaveURL(/\/connect\/consent\?c=\d+$/);
  await page.getByRole('button', { name: 'Import my record' }).click();
  await expect(page).toHaveURL(new RegExp(`/u/${handle}$`));
  expect((await step(page.request)).state).toBe('importing');
  await fetch(`${vendor.base}/_fail`, { method: 'POST', body: JSON.stringify({ status: 403, times: 1 }) });
  expect((await step(page.request)).state).toBe('failed');
  // Signed out: still in the feed (incompleteness is never hidden), but never presented as whole.
  await feed.goto('/');
  await expect(feed.locator(`a[href="/u/${handle}"]`).first()).toBeAttached();
  await expect(pane().locator('.record-failed')).toHaveText('The import did not finish, so this record may be incomplete.');
  await expect(pane().locator('.badge.verified')).toHaveCount(0);
  await expect(pane().locator('section.stats')).toHaveCount(1);
  // Fix round 5: the trade card (the first screen on a phone) matches the pane: no Verified badge, the same line.
  await expect(card().locator('.badge.verified')).toHaveCount(0);
  await expect(card().locator('.record-failed')).toHaveText('The import did not finish, so this record may be incomplete.');
  await expect(feed.locator('article.card', { has: feed.locator(`a[href="/u/${handle}"]`) }).locator('.badge.verified')).toHaveCount(0);
  // The profile matches the pane (fix round 4): no Verified badge, the incomplete line, the stats.
  await feed.goto(`/u/${handle}`);
  await expect(feed.locator('.record-failed')).toHaveText('The import did not finish, so this record may be incomplete.');
  await expect(feed.locator('.badge.verified')).toHaveCount(0);
  await expect(feed.locator('section.stats').first()).toContainText('win rate');
  // Fix round 5: the stock page lists the trades (never hidden) with no Verified badge beside a failed record.
  await feed.goto('/t/AAA');
  await expect(stockRows().first()).toBeAttached();
  await expect(feed.locator(`a.trow[href^="/u/${handle}"] .badge.verified`)).toHaveCount(0);
  // Fix round 6 (TR-3, POLICY F3): the trade and month pages say the record may be incomplete, their link previews carry
  // no "verified" wording, and their preview images (and the story image) render for the failed record.
  const [last] = await sql`select ct.sell_id, ct.closed_at from closed_trades ct join users u on u.id = ct.user_id where u.handle = ${handle} order by ct.closed_at desc limit 1`;
  const d = new Date(last.closed_at as Date);
  const ym = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  // Fix round 5 (TR-3): the profile's own link preview says "closed", never "verified", for the failed record.
  await feed.goto(`/u/${handle}`);
  const profileDescription = await feed.locator('meta[name="description"]').getAttribute('content');
  expect(profileDescription).toMatch(/\d+ closed trades? · /);
  expect(profileDescription!).not.toMatch(/verified/i);
  expect(await feed.locator('meta[property="og:image:alt"]').getAttribute('content')).toBe(`Trading record card for @${handle} on Stock Social: Import did not finish`);
  for (const path of [`/u/${handle}/trade/${encodeURIComponent(last.sell_id as string)}`, `/u/${handle}/month/${ym}`]) {
    await feed.goto(path);
    await expect(feed.locator('.record-failed')).toHaveText('The import did not finish, so this record may be incomplete.');
    await expect(feed.locator('.badge.verified')).toHaveCount(0);
    const description = await feed.locator('meta[name="description"]').getAttribute('content');
    expect(description, path).toBeTruthy();
    expect(description!, path).not.toMatch(/verified/i);
    const image = await feed.locator('meta[property="og:image"]').first().getAttribute('content');
    expect(image, path).toBeTruthy();
    const res = await feed.request.get(new URL(image!).pathname + new URL(image!).search);
    expect(res.status(), path).toBe(200);
    expect(res.headers()['content-type']).toContain('image/png');
  }
  const story = await feed.request.get(`/u/${handle}/story?format=square`);
  expect(story.status()).toBe(200);
  expect(story.headers()['content-type']).toContain('image/png');
  await anon.close();
  await sql`delete from users where handle = ${handle}`;
  await sql`delete from broker_accounts where account_id = any(${[a1, a2, a3]})`;
});

// Committee fixes (docs/features/logs/F-1/build-pr2a-fix4.md).
test('committee fix (items 1, 4, 7): brokerage-first from /login reaches the importing profile in four app taps at 375×667, consent primary above the fold; a second browser holding only the attempt id is refused at S2, start and done, and each refusal is counted with no personal data', async ({ page, browser }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  let taps = 0;
  await page.goto('/login');
  await page.getByLabel('I am 18 or older and accept the Terms and Privacy Policy').check(); taps++;
  await page.getByRole('button', { name: 'Connect a brokerage instead' }).click(); taps++;
  await expect(page).toHaveURL(/\/connect$/);
  await expect(page.getByRole('heading', { name: 'Before you connect', level: 1 })).toBeVisible();
  const primary = page.getByRole('link', { name: 'Connect brokerage (read-only)' });
  await expect(primary).toBeVisible();
  const attempt = Number((await page.context().cookies()).find((c) => c.name === 'connect_attempt')!.value.split('.')[0]);
  expect(attempt).toBeGreaterThan(0);
  const sql = await db();
  // A second browser that knows (or guesses) the sequential id gets nothing: no primary on S2, no portal, no link.
  const stranger = await browser.newContext();
  const p2 = await stranger.newPage();
  await p2.goto(`/connect?attempt=${attempt}`);
  await expect(p2.getByRole('status')).toHaveText('Sign in first, then connect.');
  await expect(p2.getByRole('link', { name: 'Connect brokerage (read-only)' })).toHaveCount(0);
  for (const path of [`/connect/start?attempt=${attempt}`, `/connect/done?attempt=${attempt}`]) {
    const r = await p2.request.get(path, { maxRedirects: 0 });
    expect(r.status(), path).toBe(307);
    expect(new URL(r.headers()['location']).pathname, path).toBe('/login');
  }
  // A forged cookie (the id with a made-up signature) is no better.
  await stranger.addCookies([{ name: 'connect_attempt', value: `${attempt}.forged`, url: new URL('/connect', page.url()).toString() }]);
  const forged = await p2.request.get('/connect/start', { maxRedirects: 0 });
  expect(new URL(forged.headers()['location']).pathname).toBe('/login');
  await stranger.close();
  const refusals = await sql`select meta::text as meta from funnel_events where attempt_id = ${attempt} and name = 'failed' order by id`;
  expect(refusals.map((r) => JSON.parse(r.meta))).toEqual([{ reason: 'unbound' }, { reason: 'unbound' }, { reason: 'unbound' }]);
  expect(JSON.stringify(refusals)).not.toMatch(/@|\d{7,}/);
  expect((await sql`select 1 from connections where attempt_id = ${attempt}`).length).toBe(0);
  expect((await sql`select snaptrade_user_id from signup_attempts where id = ${attempt}`)[0].snaptrade_user_id).toBeNull(); // no portal was opened
  // The owning browser completes. The vendor portal's own "Connect" is not an app tap.
  const acc = `e2e-bf4-${uniq()}`;
  await scenario([{ id: acc, activities: 2 }]);
  await primary.click(); taps++;
  const framed = await portalFrame(page).waitFor({ timeout: 5_000 }).then(() => true, () => false);
  test.skip(!framed || !(await portalFrame(page).getAttribute('src'))!.startsWith(vendor.base), 'the server has no vendor fake configured (see the header of this spec)');
  await expect(portalFrame(page)).toHaveAttribute('src', new RegExp(`^${vendor.base}/portal`));
  await page.frameLocator('dialog.portal iframe').getByRole('button', { name: 'Connect' }).click();
  await expect(page).toHaveURL(/\/connect\/consent\?c=\d+$/);
  expect(taps).toBeLessThanOrEqual(4); // sign-in → consent
  // Consent fits 375×667: the whole primary is in the viewport without scrolling, and the deadline has no clock time.
  await expect(page.locator('main')).not.toContainText('Your brokerage is linked');
  await expect(page.locator('main')).toContainText('Decide within 24 hours, or this link is removed automatically.');
  await expect(page.locator('main')).not.toContainText('UTC');
  const importBtn = page.getByRole('button', { name: 'Import my record' });
  const box = (await importBtn.boundingBox())!;
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(667);
  await page.screenshot({ path: test.info().outputPath('consent-375x667.png') });
  await importBtn.click(); taps++;
  await expect(page).toHaveURL(/\/u\/trader_[a-z0-9]{8}$/);
  expect(taps).toBe(4); // /login → importing profile
  await expect(page.getByRole('status')).toContainText('Importing your record');
  const users = await sql`select id, handle from users where signup_attempt_id = ${attempt}`;
  expect(users).toHaveLength(1);
  await expect(page.locator('nav.top .me')).toHaveText(`@${users[0].handle}`);
  expect((await page.context().cookies()).find((c) => c.name === 'connect_attempt')).toBeUndefined(); // consumed
  await sql`delete from users where id = ${users[0].id}`;
  await sql`delete from broker_accounts where account_id = ${acc}`;
});

test('committee fix round 6: a bound attempt older than 24 h is refused like an unbound one (no primary on S2; start and done go to /login), counted once as expired with no personal data', async ({ page }) => {
  const attempt = await brokerageAttempt(page);
  const sql = await db();
  await sql`update signup_attempts set created_at = now() - interval '25 hours' where id = ${attempt}`;
  await page.goto('/connect');
  await expect(page.getByRole('status')).toHaveText('Sign in first, then connect.');
  await expect(page.getByRole('link', { name: 'Connect brokerage (read-only)' })).toHaveCount(0);
  for (const path of ['/connect/start', '/connect/done']) {
    const r = await page.request.get(path, { maxRedirects: 0 });
    expect(r.status(), path).toBe(307);
    expect(new URL(r.headers()['location']).pathname, path).toBe('/login');
  }
  const refusals = await sql`select meta::text as meta from funnel_events where attempt_id = ${attempt} and name = 'failed' order by id`;
  expect(refusals.map((r) => JSON.parse(r.meta))).toEqual([{ reason: 'expired' }]);
  expect(JSON.stringify(refusals)).not.toMatch(/@|\d{7,}/);
  expect((await sql`select snaptrade_user_id from signup_attempts where id = ${attempt}`)[0].snaptrade_user_id).toBeNull(); // no portal was opened
});

test('committee fix (items 5, 6): no share invitation while importing or failed; "Try again" is the only primary and at least 44 px; a retry that reaches connected brings the share prompt back', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 740 });
  const handle = `shr${uniq()}`;
  await devSignIn(page, handle);
  test.skip(!(await vendorConfigured(page)), 'the server has no vendor fake configured (see the header of this spec)');
  const a1 = `e2e-${handle}-1`, a2 = `e2e-${handle}-2`;
  await scenario([{ id: a1, activities: 4 }, { id: a2, activities: 4 }]);
  await connectThrough(page);
  await page.getByRole('button', { name: 'Import my record' }).click();
  await expect(page).toHaveURL(new RegExp(`/u/${handle}$`));
  const sql = await db();
  const [u] = await sql`select id from users where handle = ${handle}`;
  // As if an hourly sync had run: the share prompt's own rule would show it now; the record state must hold it back.
  await sql`update users set last_synced_at = now() where id = ${u.id}`;
  await page.reload();
  await expect(page.getByRole('status')).toContainText('Importing your record');
  await expect(page.locator('main')).not.toContainText('Your record is live.');
  await expect(page.getByRole('button', { name: 'Share my record' })).toHaveCount(0);
  expect((await step(page.request)).imported).toBe(4);
  await fetch(`${vendor.base}/_fail`, { method: 'POST', body: JSON.stringify({ status: 403, times: 1 }) });
  expect((await step(page.request)).state).toBe('failed');
  await page.goto(`/u/${handle}`);
  await expect(page.locator('.record-failed')).toContainText('may be incomplete');
  await expect(page.locator('main')).not.toContainText('Your record is live.');
  await expect(page.locator('main')).not.toContainText('Share my record');
  await expect(page.locator('main')).not.toContainText('Share your record');
  const retry = page.locator('.record-failed a');
  await expect(retry).toHaveText('Try again');
  expect((await retry.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await page.screenshot({ path: test.info().outputPath('failed-owner-375.png'), fullPage: true });
  // Retry: the same accounts connect again and the import finishes; the record is whole and the prompt is back.
  await scenario([{ id: a1, activities: 4 }, { id: a2, activities: 4 }]);
  await retry.click();
  await expect(page).toHaveURL(/\/connect$/);
  await page.getByRole('link', { name: 'Connect brokerage (read-only)' }).click();
  await page.frameLocator('dialog.portal iframe').getByRole('button', { name: 'Connect' }).click();
  await expect(page).toHaveURL(/\/connect\/consent\?c=\d+$/);
  await page.getByRole('button', { name: 'Import my record' }).click();
  await expect(page).toHaveURL(new RegExp(`/u/${handle}$`));
  let r = await step(page.request);
  for (let i = 0; i < 8 && r.state === 'importing'; i++) r = await step(page.request);
  expect(r.state).toBe('connected');
  await page.goto(`/u/${handle}`);
  await expect(page.locator('.record-failed')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Your record is live.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Share my record' })).toBeVisible();
  await sql`delete from users where id = ${u.id}`;
  await sql`delete from broker_accounts where account_id in (${a1}, ${a2})`;
});

// ---------- PR-2b: the client (S2 primary, S3 embedded portal, S5 live banner, S7a, carried items) ----------
// Every test below starts with "PR-2b", so the page's live poll runs (see beforeEach). Screenshots at 375 px, light
// and dark, go to the test's output folder.
const portalScenario = (accounts: FakeAccount[], portalDelayMs = 0) => fetch(`${vendor.base}/_scenario`, { method: 'POST', body: JSON.stringify({ accounts, portalDelayMs }) });
const dialogOf = (page: Page) => page.getByRole('dialog', { name: 'Connect your brokerage' });
const frameOf = (page: Page) => page.frameLocator('dialog.portal iframe');
const focusedId = (page: Page) => page.evaluate(() => (document.activeElement as HTMLElement | null)?.dataset?.testid ?? document.activeElement?.id ?? document.activeElement?.tagName);
async function shots(page: Page, name: string) {
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme });
    await page.screenshot({ path: test.info().outputPath(`${name}-375-${colorScheme}.png`), fullPage: true });
  }
  await page.emulateMedia({ colorScheme: 'light' });
}
const portalModes = async (attempt: number) => (await sql`select meta->>'mode' as m from funnel_events where attempt_id = ${attempt} and name = 'portal_opened' order by id`).map((r) => r.m);
// The portal opens after vendorConfigured's own probe (which opens one by redirect): the modes recorded since then.
const modesFrom = async (handle: string) => {
  const [u] = await sql`select id, signup_attempt_id as a from users where handle = ${handle}`;
  const skip = (await portalModes(Number(u.a))).length;
  return async () => (await portalModes(Number(u.a))).slice(skip);
};

test('PR-2b S2 → S3 → S4: the primary opens the vendor portal in a labelled modal dialog ("Opening…", aria-busy); the frame is only ever the URL minted for this trader (a lure in the query string or referrer is ignored, messages from another origin are ignored); the portal\'s SUCCESS lands on consent, recorded as embedded', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 740 });
  const handle = `emb${uniq()}`;
  await devSignIn(page, handle);
  test.skip(!(await vendorConfigured(page)), 'the server has no vendor fake configured (see the header of this spec)');
  const acc = `e2e-${handle}`;
  await portalScenario([{ id: acc, activities: 2 }]);
  const [u] = await sql`select id, signup_attempt_id as a from users where handle = ${handle}`;
  const modes = await modesFrom(handle);
  // The lure: an attacker's link carrying a portal URL of their own, and an attacker referrer.
  const lure = 'http://evil.example/portal?u=attacker';
  await page.goto(`/connect?portal=${encodeURIComponent(lure)}&url=${encodeURIComponent(lure)}&redirectURI=${encodeURIComponent(lure)}`, { referer: lure });
  await expect(page.getByRole('heading', { name: 'Before you connect', level: 1 })).toBeVisible();
  await shots(page, 's2-notice');
  const primary = page.getByTestId('connect-primary');
  await expect(primary).toHaveAttribute('href', '/connect/start'); // without script or in an in-app browser: the redirect
  await primary.click();
  await expect(dialogOf(page)).toBeVisible();
  await expect(primary).toHaveText('Opening…');
  await expect(primary).toHaveAttribute('aria-busy', 'true');
  await expect(page.getByRole('button', { name: 'Close' })).toBeFocused();
  await expect(dialogOf(page).getByRole('link', { name: 'Open in a new page instead' })).toHaveAttribute('href', '/connect/start');
  const [vu] = await sql`select snaptrade_user_id from users where id = ${u.id}`;
  await expect(portalFrame(page)).toHaveAttribute('src', `${vendor.base}/portal?u=${encodeURIComponent(vu.snaptrade_user_id as string)}&r=${encodeURIComponent(new URL('/connect/done', page.url()).toString())}`);
  await expect(frameOf(page).getByRole('heading', { name: 'Fake brokerage portal' })).toBeVisible();
  await expect(dialogOf(page)).not.toHaveAttribute('aria-busy', 'true');
  await expect(dialogOf(page).locator('.portal-body')).toHaveAttribute('aria-busy', 'false');
  // The endpoint reads nothing from the request either.
  const minted = await (await page.request.post(`/connect/portal?url=${encodeURIComponent(lure)}`, { headers: { referer: lure } })).json();
  expect(minted.url.startsWith(`${vendor.base}/portal?u=${encodeURIComponent(vu.snaptrade_user_id as string)}`)).toBe(true);
  expect(minted.origin).toBe(vendor.base);
  expect(JSON.stringify(minted)).not.toContain('evil');
  // A SUCCESS posted from any other origin (here the app's own window) is ignored.
  await page.evaluate(() => { window.postMessage({ status: 'SUCCESS', authorizationId: 'forged' }, '*'); window.postMessage('SUCCESS', '*'); });
  await page.waitForTimeout(500);
  await expect(page).toHaveURL(/\/connect\?/);
  await expect(dialogOf(page)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await shots(page, 's3-portal');
  await frameOf(page).getByRole('button', { name: 'Connect' }).click();
  await expect(page).toHaveURL(/\/connect\/consent\?c=\d+$/);
  const [c] = await sql`select portal_mode from connections where user_id = ${u.id}`;
  expect(c.portal_mode).toBe('embedded');
  expect(await modes()).toEqual(['embedded', 'embedded']); // the dialog's, and the direct POST above
  await shots(page, 's4-consent');
  await sql`delete from users where id = ${u.id}`;
  await sql`delete from broker_accounts where account_id = ${acc}`;
});

test('PR-2b S3 keyboard only: Tab reaches the primary, Enter opens the dialog with focus on Close, Tab and Shift+Tab stay inside it, Escape before the portal loads closes it and returns focus; after it loads Escape is "closed without a link" (S7a, focus on its heading), whose "Continue in a new page" completes by redirect', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 740 });
  const handle = `kbd${uniq()}`;
  await devSignIn(page, handle);
  test.skip(!(await vendorConfigured(page)), 'the server has no vendor fake configured (see the header of this spec)');
  const acc = `e2e-${handle}`;
  const modes = await modesFrom(handle);
  await page.goto('/connect');
  const toPrimary = async () => {
    for (let i = 0; i < 30 && (await focusedId(page)) !== 'connect-primary'; i++) await page.keyboard.press('Tab');
    expect(await focusedId(page)).toBe('connect-primary');
  };
  // Escape while loading (the portal page is held): the dialog closes, focus is back on the primary, its label restored.
  await portalScenario([{ id: acc, activities: 2 }], 15_000);
  await toPrimary();
  await page.keyboard.press('Enter');
  await expect(dialogOf(page)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Close' })).toBeFocused();
  await expect(dialogOf(page).getByRole('status')).toHaveText('Opening…');
  await page.keyboard.press('Escape');
  await expect(dialogOf(page)).toBeHidden();
  expect(await focusedId(page)).toBe('connect-primary');
  await expect(page.getByTestId('connect-primary')).toHaveText('Connect brokerage (read-only)');
  await expect(page).toHaveURL(/\/connect$/);
  // Loaded: focus never leaves the dialog, and wraps both ways.
  await portalScenario([{ id: acc, activities: 2 }]);
  await page.keyboard.press('Enter');
  await expect(frameOf(page).getByRole('button', { name: 'Connect' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Close' })).toBeFocused();
  const inside = () => page.evaluate(() => document.querySelector('dialog.portal')!.contains(document.activeElement));
  const seen = new Set<string>();
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Tab');
    expect(await inside()).toBe(true);
    seen.add(await page.evaluate(() => document.activeElement?.tagName === 'A' ? 'link' : document.activeElement?.tagName === 'IFRAME' ? 'frame' : document.activeElement?.textContent ?? ''));
  }
  expect([...seen].sort()).toEqual(['Close', 'frame', 'link']);
  await page.getByRole('button', { name: 'Close' }).focus();
  await page.keyboard.press('Shift+Tab');
  await expect(dialogOf(page).getByRole('link', { name: 'Open in a new page instead' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Close' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/\/connect\/result\?k=abandoned$/);
  await expect(page.locator('h1')).toHaveText('Connection not completed. Nothing was saved.');
  await expect.poll(() => page.evaluate(() => document.activeElement?.id)).toBe('result-heading');
  await shots(page, 's7a-abandoned');
  // S7a: Try again · Continue in a new page · Not now.
  await expect(page.getByRole('link', { name: 'Try again' })).toHaveAttribute('href', '/connect');
  await expect(page.getByRole('link', { name: 'Continue in a new page' })).toHaveAttribute('href', '/connect/start');
  await expect(page.getByRole('link', { name: 'Not now' })).toHaveAttribute('href', '/');
  for (const name of ['Try again', 'Continue in a new page', 'Not now']) expect((await page.getByRole('link', { name }).boundingBox())!.height).toBeGreaterThanOrEqual(44);
  for (let i = 0; i < 10 && (await page.evaluate(() => document.activeElement?.textContent)) !== 'Continue in a new page'; i++) await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(new RegExp(`^${vendor.base}/portal`));
  await page.getByRole('button', { name: 'Connect' }).focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/connect\/consent\?c=\d+$/);
  const [u] = await sql`select id, signup_attempt_id as a from users where handle = ${handle}`;
  expect((await sql`select portal_mode from connections where user_id = ${u.id}`)[0].portal_mode).toBe('redirect');
  expect(await modes()).toEqual(['embedded', 'embedded', 'redirect']);
  await sql`delete from users where id = ${u.id}`;
  await sql`delete from broker_accounts where account_id = ${acc}`;
});

test('PR-2b S3 loading: "Opening…", at 3 s "Taking longer than usual.", at 8 s the persistent "Open in a new page instead" link becomes a button; it starts the redirect flow on the same attempt', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 740 });
  await page.clock.install();
  const handle = `slw${uniq()}`;
  await devSignIn(page, handle);
  test.skip(!(await vendorConfigured(page)), 'the server has no vendor fake configured (see the header of this spec)');
  const acc = `e2e-${handle}`;
  const modes = await modesFrom(handle);
  await portalScenario([{ id: acc, activities: 2 }], 30_000);
  await page.goto('/connect');
  await page.getByTestId('connect-primary').click();
  const status = dialogOf(page).getByRole('status');
  const alt = dialogOf(page).getByRole('link', { name: 'Open in a new page instead' });
  await expect(status).toHaveText('Opening…');
  await expect(alt).toBeVisible(); // from the first moment, not only after 8 s
  await expect(portalFrame(page)).toHaveAttribute('src', new RegExp(`^${vendor.base}/portal`));
  await page.clock.fastForward(3_000);
  await expect(status).toHaveText('Opening… Taking longer than usual.');
  await expect(alt).not.toHaveClass(/button/);
  await page.clock.fastForward(5_000);
  await expect(alt).toHaveClass(/button/);
  expect((await alt.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await shots(page, 's3-loading-slow');
  await portalScenario([{ id: acc, activities: 2 }]);
  await alt.click();
  await expect(page).toHaveURL(new RegExp(`^${vendor.base}/portal`));
  await page.getByRole('button', { name: 'Connect' }).click();
  await expect(page).toHaveURL(/\/connect\/consent\?c=\d+$/);
  const [u] = await sql`select id from users where handle = ${handle}`;
  expect(await modes()).toEqual(['embedded', 'redirect']);
  await sql`delete from users where id = ${u.id}`;
  await sql`delete from broker_accounts where account_id = ${acc}`;
});

test('PR-2b popup blocked: with window.open returning null in every frame the portal reports an error and the app falls back to the redirect flow on the same attempt, and the trader still completes the connection', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 740 } });
  await ctx.addInitScript(() => { window.open = () => null; });
  const page = await ctx.newPage();
  const handle = `pop${uniq()}`;
  await devSignIn(page, handle);
  if (!(await vendorConfigured(page))) { await ctx.close(); test.skip(true, 'the server has no vendor fake configured (see the header of this spec)'); }
  const acc = `e2e-${handle}`;
  const modes = await modesFrom(handle);
  await portalScenario([{ id: acc, activities: 2 }]);
  await page.goto('/connect');
  await page.getByTestId('connect-primary').click();
  await frameOf(page).getByRole('button', { name: 'Connect' }).click(); // the portal's login popup is blocked
  await expect(page).toHaveURL(new RegExp(`^${vendor.base}/portal`)); // the redirect flow, no blank modal
  await page.getByRole('button', { name: 'Connect' }).click();
  await expect(page).toHaveURL(/\/connect\/consent\?c=\d+$/);
  await page.getByRole('button', { name: 'Import my record' }).click();
  await expect(page).toHaveURL(new RegExp(`/u/${handle}$`));
  const [u] = await sql`select id from users where handle = ${handle}`;
  const rows = await sql`select portal_mode, state from connections where user_id = ${u.id}`;
  expect(rows.map((r) => r.portal_mode)).toEqual(['redirect']);
  expect(['importing', 'connected']).toContain(rows[0].state); // the open tab's poll may already have finished it
  expect(await modes()).toEqual(['embedded', 'redirect']);
  await ctx.close();
  await sql`delete from users where id = ${u.id}`;
  await sql`delete from broker_accounts where account_id = ${acc}`;
});

test('PR-2b in-app browser: a WebView user agent goes straight to the redirect flow (no dialog) and completes', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 740 }, userAgent: 'Mozilla/5.0 (Linux; Android 14; K; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.0.0 Mobile Safari/537.36' });
  const page = await ctx.newPage();
  const handle = `iab${uniq()}`;
  await devSignIn(page, handle);
  if (!(await vendorConfigured(page))) { await ctx.close(); test.skip(true, 'the server has no vendor fake configured (see the header of this spec)'); }
  const acc = `e2e-${handle}`;
  await portalScenario([{ id: acc, activities: 2 }]);
  await page.goto('/connect');
  await page.getByTestId('connect-primary').click();
  await expect(page).toHaveURL(new RegExp(`^${vendor.base}/portal`));
  await page.getByRole('button', { name: 'Connect' }).click();
  await expect(page).toHaveURL(/\/connect\/consent\?c=\d+$/);
  const [u] = await sql`select id, signup_attempt_id as a from users where handle = ${handle}`;
  // The probe in vendorConfigured opened one redirect too; no embedded open at all.
  expect((await portalModes(Number(u.a))).every((m) => m === 'redirect')).toBe(true);
  await ctx.close();
  await sql`delete from users where id = ${u.id}`;
  await sql`delete from broker_accounts where account_id = ${acc}`;
});

test('PR-2b S5 live banner: the owner\'s open tab drives the import; the imported count updates after each step, the status line is announced at most once per 5 s with no layout shift, then "Import finished." as one distinct line and the record appears ("Too early to tell" once, "Connected:" with the institution)', async ({ page, browser }) => {
  await page.setViewportSize({ width: 375, height: 740 });
  const handle = `liv${uniq()}`;
  await devSignIn(page, handle);
  test.skip(!(await vendorConfigured(page)), 'the server has no vendor fake configured (see the header of this spec)');
  const a = [1, 2, 3].map((n) => `e2e-${handle}-${n}`);
  await portalScenario(a.map((id) => ({ id, activities: 4, institution: 'Fake Brokerage' })));
  await connectThrough(page);
  await expect(page).toHaveURL(/\/connect\/consent\?c=\d+$/);
  await page.getByRole('button', { name: 'Import my record' }).click();
  await expect(page).toHaveURL(new RegExp(`/u/${handle}$`));
  const status = page.getByRole('status');
  await expect(status).toHaveCount(1);
  await expect(status).toHaveAttribute('aria-live', 'polite');
  await expect(status).toHaveText('Importing your record · 0 closed trades so far');
  // Every change of the status line, timed in the page.
  await page.evaluate(() => {
    const el = document.querySelector('.import-banner [role="status"]')!;
    const w = window as unknown as { changes: { t: number; text: string }[] };
    w.changes = [];
    new MutationObserver(() => w.changes.push({ t: performance.now(), text: el.textContent ?? '' })).observe(el, { childList: true, characterData: true, subtree: true });
  });
  const box = async () => (await page.locator('.import-banner').boundingBox())!;
  const before = await box();
  await shots(page, 's5-importing');
  // No test-driven steps: only the page's own 2 s poll. Counts follow each account.
  const read = page.locator('.import-read');
  const counts: string[] = [];
  await expect.poll(async () => { const t = await read.textContent(); if (t && counts.at(-1) !== t) counts.push(t); return t; }, { timeout: 30_000, intervals: [250] }).toBe('12 trades imported from your broker');
  expect(counts.length).toBeGreaterThanOrEqual(3); // 0 → 4 → 8 → 12, at least the intermediate ones seen
  await expect(status).toHaveText('Import finished.', { timeout: 30_000 });
  await expect(status).toHaveClass(/import-finished/);
  expect(Math.abs((await box()).height - before.height)).toBeLessThanOrEqual(1);
  expect((await box()).y).toBeCloseTo(before.y, 0);
  await expect(page.locator('section.stats').first()).toContainText('win rate', { timeout: 10_000 }); // refreshed in place
  await expect(page.locator('.record-body')).toHaveCount(0);
  const changes = await page.evaluate(() => (window as unknown as { changes: { t: number; text: string }[] }).changes);
  const distinct = changes.filter((c, i) => i === 0 || c.text !== changes[i - 1].text);
  for (let i = 1; i < distinct.length; i++) expect(distinct[i].t - distinct[i - 1].t).toBeGreaterThanOrEqual(4_900);
  expect(distinct.at(-1)!.text).toBe('Import finished.');
  await shots(page, 's5-finished');
  // Carried items: "Too early to tell" once; "Connected:" names the institution, never "broker".
  const main = (await page.locator('main').innerText());
  expect(main.match(/Too early to tell/g)?.length).toBe(1);
  expect(main).toContain('Connected: Fake Brokerage (3 accounts)');
  // A reload shows no banner; signed out the same record, no banner, no leave-line.
  await page.reload();
  await expect(page.getByRole('status')).toHaveCount(0);
  const anon = await browser.newContext({ viewport: { width: 375, height: 740 } });
  const p2 = await anon.newPage();
  await p2.goto(`/u/${handle}`);
  await expect(p2.locator('.import-banner')).toHaveCount(0);
  expect((await p2.locator('main').innerText())).toContain('Connected: Fake Brokerage (3 accounts)');
  await anon.close();
  const [u] = await sql`select id from users where handle = ${handle}`;
  expect((await sql`select state from connections where user_id = ${u.id}`)[0].state).toBe('connected');
  await sql`delete from users where id = ${u.id}`;
  await sql`delete from broker_accounts where account_id in ${sql(a)}`;
});

test('PR-2b S5: after 60 s with no new rows the owner reads "You can leave; the import continues."; visitors never see it; the line keeps its box', async ({ page, browser }) => {
  await page.setViewportSize({ width: 375, height: 740 });
  await page.clock.install();
  const handle = `sty${uniq()}`;
  await devSignIn(page, handle);
  test.skip(!(await vendorConfigured(page)), 'the server has no vendor fake configured (see the header of this spec)');
  const acc = `e2e-${handle}`;
  await portalScenario([{ id: acc, activities: 2, syncDone: false }]); // the vendor is still filling: the import waits
  await connectThrough(page);
  await page.getByRole('button', { name: 'Import my record' }).click();
  await expect(page).toHaveURL(new RegExp(`/u/${handle}$`));
  const slow = page.locator('.import-slow');
  await expect(slow).toHaveText('');
  const empty = (await slow.boundingBox())!;
  // Two polls: the page, then the rebuild; after that the vendor's flag keeps the import waiting, no new rows.
  await page.clock.fastForward(2_000);
  await expect(page.locator('.import-read')).toHaveText('2 trades imported from your broker');
  await page.clock.fastForward(2_000);
  await expect(page.getByRole('status')).toHaveText('Importing your record · 1 closed trade so far');
  await page.clock.fastForward(61_000);
  await expect(slow).toHaveText('Your broker is still sending history. You can leave; the import continues.');
  expect(Math.abs((await slow.boundingBox())!.height - empty.height)).toBeLessThanOrEqual(1);
  await shots(page, 's5-still-sending');
  const anon = await browser.newContext({ viewport: { width: 375, height: 740 } });
  const p2 = await anon.newPage();
  await p2.goto(`/u/${handle}`);
  await expect(p2.getByRole('status')).toHaveText('Importing your record · 1 closed trade so far');
  await expect(p2.locator('.import-slow')).toHaveCount(0);
  await anon.close();
  const [u] = await sql`select id from users where handle = ${handle}`;
  await sql`delete from users where id = ${u.id}`;
  await sql`delete from broker_accounts where account_id = ${acc}`;
});

test('PR-2b carried: a connected record with no closes unfurls with the empty-record line and no stats line; the Demo badge is at least 4.5:1 in both schemes', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 740 });
  // The Demo badge, measured as rendered.
  await page.goto('/u/momentum_maya');
  const lum = (rgb: string) => {
    const [r, g, b] = rgb.match(/\d+(\.\d+)?/g)!.slice(0, 3).map(Number).map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme });
    const badge = page.locator('.badge.demo').first();
    await expect(badge).toBeVisible();
    const { fg, bg } = await badge.evaluate((el) => ({ fg: getComputedStyle(el).color, bg: getComputedStyle(el).backgroundColor }));
    const [x, y] = [lum(fg), lum(bg)];
    expect((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05), `${colorScheme} ${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
  }
  await page.emulateMedia({ colorScheme: 'light' });
  const handle = `nil${uniq()}`;
  await devSignIn(page, handle);
  test.skip(!(await vendorConfigured(page)), 'the server has no vendor fake configured (see the header of this spec)');
  const acc = `e2e-${handle}`;
  const buy: FakeActivity = { id: `${acc}-b1`, symbol: 'AAA', type: 'BUY', units: 10, price: 100, fee: 0, trade_date: '2024-02-01T15:00:00Z' };
  await portalScenario([{ id: acc, activities: [buy], positions: [{ symbol: 'AAA', units: 10, price: 105, cost_basis: 100 }] }]);
  await connectThrough(page);
  await page.getByRole('button', { name: 'Import my record' }).click();
  await expect(page).toHaveURL(new RegExp(`/u/${handle}$`));
  await expect(page.getByRole('status')).toHaveText('Import finished.', { timeout: 30_000 });
  await expect(page.locator('.record-body')).toHaveText('No closed trades yet. Your record starts with your first close.');
  await expect(page.locator('.positions li')).toHaveText(['AAA+5.0%']);
  await shots(page, 's8-empty-record');
  await page.context().clearCookies();
  await page.goto(`/u/${handle}`);
  const description = await page.locator('meta[name="description"]').getAttribute('content');
  expect(description).toBe('No closed trades yet. Your record starts with your first close.');
  expect(description).not.toMatch(/win rate|avg return|\b0 (closed|verified) trades/);
  const [u] = await sql`select id from users where handle = ${handle}`;
  await sql`delete from users where id = ${u.id}`;
  await sql`delete from broker_accounts where account_id = ${acc}`;
});
