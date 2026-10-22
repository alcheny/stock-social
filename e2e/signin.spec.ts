// F-1 PR-1: sign-in, attestation, sessions (docs/features/logs/F-1/plan.md §2 S1/S2, §4). Runs against `npm run start`
// with ALLOW_DEV_AUTH=1 (playwright.config.ts). The fakes below start here on fixed ports; the provider and the
// email-sink paths need the server started with these variables (otherwise those tests skip and say so):
//   AUTH_EMAIL_PROVIDER_ISSUER=http://127.0.0.1:4100/a AUTH_EMAIL_PROVIDER_CLIENT_ID=e2e-a AUTH_EMAIL_PROVIDER_CLIENT_SECRET=e2e-secret-a AUTH_EMAIL_PROVIDER_LABEL="Mail Co"
//   AUTH_DEVICE_PROVIDER_ISSUER=http://127.0.0.1:4100/b AUTH_DEVICE_PROVIDER_CLIENT_ID=e2e-b AUTH_DEVICE_PROVIDER_CLIENT_SECRET=e2e-secret-b AUTH_DEVICE_PROVIDER_LABEL="Phone Co"
//   AUTH_EMAIL_SEND_URL=http://127.0.0.1:4101/send
// Without AUTH_EMAIL_SEND_URL the app keeps the link in memory and /login/dev shows it, so the email path always runs.
import { expect, test, type Page } from '@playwright/test';
import { createHash } from 'node:crypto';
import type { Server } from 'node:http';
import { startOidcFake } from './fakes/oidc.ts';
import { startEmailFake } from './fakes/email.ts';

const OIDC_PORT = Number(process.env.AUTH_FAKE_OIDC_PORT ?? 4100);
const MAIL_PORT = Number(process.env.AUTH_FAKE_EMAIL_PORT ?? 4101);
let oidc: Awaited<ReturnType<typeof startOidcFake>>;
let mail: { server: Server; base: string };

test.beforeAll(async () => {
  oidc = await startOidcFake(OIDC_PORT);
  mail = await startEmailFake(MAIL_PORT);
});
test.afterAll(async () => {
  oidc?.server.close();
  mail?.server.close();
  const { sql } = await import('../lib/db.ts');
  await sql.end({ timeout: 1 });
});

const db = async () => (await import('../lib/db.ts')).sql;
const attempts = async () => Number((await (await db())`select count(*)::int as n from signup_attempts`)[0].n);
const attest = (page: Page) => page.getByLabel('I am 18 or older and accept the Terms and Privacy Policy');
const uniq = () => Math.random().toString(36).slice(2, 10);

// The emailed link: from the sink when the server sends there, else from the dev page's in-memory outbox.
async function lastLink(page: Page): Promise<string> {
  const r = await fetch(`${mail.base}/last`);
  const m = (await r.json()) as { text?: string } | null;
  if (m?.text) return m.text.match(/https?:\/\/\S+/)![0];
  await page.goto('/login/dev');
  return (await page.getByTestId('last-link').getAttribute('href'))!;
}

test('S1 at 375px, signed out: copy, one attestation, legal links, both buttons, no horizontal scroll, light and dark', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 740 });
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Publish your trades', level: 1 })).toBeVisible();
  await expect(page.getByText('Read-only. We can never place trades or move money.')).toBeVisible();
  await expect(attest(page)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Terms' })).toHaveAttribute('href', '/terms');
  await expect(page.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', '/privacy');
  await expect(page.getByLabel('Email')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send me a link' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Connect a brokerage instead' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  for (const b of await page.locator('button:not([hidden]), .button').all()) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  // Every visible button has a name; the hidden default submit (Enter in the email field) paints nothing.
  for (const b of await page.locator('button').all()) if (await b.isVisible()) expect((await b.innerText()).trim() || (await b.getAttribute('aria-label'))).toBeTruthy();
  await expect(page.locator('button[hidden]')).toHaveCount(1);
  await expect(page.locator('button[hidden]')).toBeHidden();
  expect(await page.locator('button[hidden]').evaluate((el) => getComputedStyle(el).display)).toBe('none');
  await expect(page.locator('footer.site')).toContainText('Not investment advice. Past performance does not guarantee future results.');
  await page.screenshot({ path: test.info().outputPath('s1-light.png'), fullPage: true });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.screenshot({ path: test.info().outputPath('s1-dark.png'), fullPage: true });
  await page.goto('/terms');
  await expect(page.getByText('Placeholder: the owner supplies the final text before launch.')).toBeVisible();
  await page.goto('/privacy');
  await expect(page.getByText('Placeholder: the owner supplies the final text before launch.')).toBeVisible();
});

test('unchecked attestation blocks every path: the box gets focus with the message, and no attempt row is written', async ({ page }) => {
  await page.goto('/login');
  const before = await attempts();
  const buttons = await page.locator('button[name="method"]:not([hidden])').all();
  expect(buttons.length).toBeGreaterThanOrEqual(2);
  for (let i = 0; i < buttons.length; i++) {
    await page.goto('/login');
    await page.getByLabel('Email').fill('blocked@example.com');
    await page.locator('button[name="method"]:not([hidden])').nth(i).click();
    await expect(page.locator('p[role="alert"]')).toHaveText('Confirm you are 18 or older to continue.');
    await expect(attest(page)).toBeFocused();
    await expect(attest(page)).toHaveAttribute('aria-describedby', 'adult-err');
    await expect(page.getByLabel('Email')).toHaveValue('blocked@example.com'); // the typed address survives the redirect
    expect(page.url()).not.toContain('blocked'); // and never travels in the URL
  }
  expect(await attempts()).toBe(before);
});

test('email link: attestation stored before any redirect, link signs in once with a provisional handle, second use expired', async ({ page }) => {
  const email = `e2e-${uniq()}@example.com`;
  await page.goto('/login?ref=momentum_maya');
  await attest(page).check();
  await page.getByLabel('Email').fill(email);
  const before = await attempts();
  await page.getByRole('button', { name: 'Send me a link' }).click();
  await expect(page).toHaveURL(/\/login\/sent\?a=\d+$/);
  await expect(page.getByText('Check your email. The link works for 15 minutes.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send again' })).toBeVisible();
  expect((await page.getByRole('link', { name: '← Back' }).boundingBox())!.height).toBeGreaterThanOrEqual(44);
  // "Send again" belongs to this browser: another browser with the (sequential) id gets no resend control.
  const stranger = await page.context().browser()!.newContext();
  const other = await stranger.newPage();
  await other.goto(page.url());
  await expect(other.getByText('Check your email. The link works for 15 minutes.')).toBeVisible();
  await expect(other.getByRole('button', { name: 'Send again' })).toHaveCount(0);
  await stranger.close();
  const sql = await db();
  expect(await attempts()).toBe(before + 1);
  const [a] = await sql`select id, method, adult_attested_at, user_id from signup_attempts order by id desc limit 1`;
  expect(a.method).toBe('email');
  expect(a.adult_attested_at).toBeTruthy();
  expect(a.user_id).toBeNull(); // no users row yet
  const link = await lastLink(page);
  expect(link).toMatch(/\/auth\/email\?t=[A-Za-z0-9_-]+$/);
  await page.goto(link);
  await expect(page).toHaveURL(/\/u\/trader_[a-z0-9]{8}$/);
  const handle = page.url().match(/\/u\/(trader_[a-z0-9]{8})/)![1];
  expect(handle).not.toContain(email.split('@')[0]);
  await expect(page.locator('nav.top .me')).toHaveText(`@${handle}`);
  const [u] = await sql`select signup_attempt_id, adult_attested_at from users where handle = ${handle}`;
  expect(Number(u.signup_attempt_id)).toBe(Number(a.id));
  const [done] = await sql`select completed_at from signup_attempts where id = ${a.id}`;
  expect(done.completed_at).toBeTruthy();
  const events = await sql`select name, meta::text as meta from funnel_events where attempt_id = ${a.id} order by id`;
  expect(events.map((e) => e.name)).toEqual(['landed', 'method_chosen', 'attested', 'own_profile_viewed']);
  expect(JSON.stringify(events)).not.toMatch(/@|\d{7,}/);
  expect(JSON.stringify(events)).not.toContain(handle);
  // The session is a signed cookie, not a plain id.
  const sid = (await page.context().cookies()).find((c) => c.name === 'sid')!;
  expect(sid.httpOnly).toBe(true);
  expect(sid.sameSite).toBe('Lax');
  expect(sid.value).toMatch(/^[A-Za-z0-9_-]{40,}\.[A-Za-z0-9_-]{40,}$/);
  expect((await page.context().cookies()).find((c) => c.name === 'uid')).toBeUndefined();
  // Single use.
  await page.context().clearCookies();
  await page.goto(link);
  await expect(page).toHaveURL(/\/login\?error=expired$/);
  await expect(page.locator('p[role="alert"]')).toHaveText('That link has expired. Send a new one?');
  await sql`delete from users where handle = ${handle}`;
});

test('S2 trust notice: four fixed lines, vendor and how links, before any portal; brokerage-first attests first', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 740 });
  await page.goto('/connect');
  await expect(page.getByRole('heading', { name: 'Before you connect', level: 1 })).toBeVisible();
  const lines = page.locator('ul.notice li');
  await expect(lines).toHaveCount(4);
  await expect(lines.nth(0)).toHaveText('Read-only. Stock Social can never place trades or move money.');
  await expect(lines.nth(3)).toContainText('Nothing is imported until you confirm on the next screen.');
  await expect(page.getByRole('link', { name: "SnapTrade's security page" })).toHaveAttribute('href', /^https:\/\//);
  await expect(page.getByRole('link', { name: 'How records are calculated' })).toHaveAttribute('href', '/how');
  await expect(page.getByRole('link', { name: 'Connect brokerage (read-only)' })).toBeVisible();
  for (const name of ["SnapTrade's security page", 'How records are calculated', 'Connect brokerage (read-only)']) expect((await page.getByRole('link', { name }).boundingBox())!.height).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath('s2-light.png'), fullPage: true });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.screenshot({ path: test.info().outputPath('s2-dark.png'), fullPage: true });
  await page.emulateMedia({ colorScheme: 'light' });
  expect(await page.locator('script[src]').evaluateAll((s) => s.some((x) => !(x as HTMLScriptElement).src.startsWith(location.origin)))).toBe(false);

  await page.goto('/login');
  await attest(page).check();
  await page.getByRole('button', { name: 'Connect a brokerage instead' }).click();
  await expect(page).toHaveURL(/\/connect\?attempt=\d+$/);
  const id = Number(page.url().match(/attempt=(\d+)/)![1]);
  const sql = await db();
  const [a] = await sql`select method, user_id from signup_attempts where id = ${id}`;
  expect(a).toEqual({ method: 'brokerage', user_id: null });
  const names = (await sql`select name from funnel_events where attempt_id = ${id} order by id`).map((e) => e.name);
  expect(names).toEqual(['landed', 'method_chosen', 'attested', 'notice_seen']);
});

for (const key of ['provider_a', 'provider_b'] as const) {
  test(`${key}: OIDC code flow with PKCE signs in, returns the same user, and refuses a bad state`, async ({ page }) => {
    await page.goto('/login');
    const button = page.locator(`button[name="method"][value="${key}"]`);
    test.skip((await button.count()) === 0, `${key} is not configured on the server (see the header of this spec)`);
    const sub = `sub-${uniq()}`;
    await fetch(`${oidc.base}/_set`, { method: 'POST', body: JSON.stringify({ sub, email: `${sub}@example.com` }) });
    await attest(page).check();
    const before = await attempts();
    await button.click();
    await expect(page).toHaveURL(/\/u\/trader_[a-z0-9]{8}$/);
    const handle = page.url().match(/\/u\/(trader_[a-z0-9]{8})/)![1];
    expect(await attempts()).toBe(before + 1);
    const sql = await db();
    const [i] = await sql`select provider, subject, email from identities i join users u on u.id = i.user_id where u.handle = ${handle}`;
    expect(i).toEqual({ provider: key, subject: sub, email: `${sub}@example.com` });
    await page.context().clearCookies();
    await page.goto('/login');
    await attest(page).check();
    await button.click();
    await expect(page).toHaveURL(new RegExp(`/u/${handle}$`)); // same subject, same user
    await page.context().clearCookies();
    await page.goto(`/auth/callback/${key}?code=x&state=bad`);
    await expect(page).toHaveURL(/\/login\?error=provider/);
    await expect(page.locator('p[role="alert"]')).toContainText('did not complete');
    await sql`delete from users where handle = ${handle}`;
  });
}

test('keyboard only: the whole email path without a pointer', async ({ page }) => {
  await page.goto('/login');
  await page.keyboard.press('Tab');
  while (!(await attest(page).evaluate((el) => el === document.activeElement))) await page.keyboard.press('Tab');
  await page.keyboard.press('Space');
  await expect(attest(page)).toBeChecked();
  while (!(await page.getByLabel('Email').evaluate((el) => el === document.activeElement))) await page.keyboard.press('Tab');
  await page.keyboard.type(`kb-${uniq()}@example.com`);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/login\/sent/);
});

test('email send failure: the error state with a message and "Send again", no claimable link left; the retry signs in', async ({ page }) => {
  // Needs the server sending to the sink (AUTH_EMAIL_SEND_URL, header of this spec); the in-memory outbox cannot fail.
  const email = `fail-${uniq()}@example.com`;
  await page.goto('/login');
  await attest(page).check();
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: 'Send me a link' }).click();
  await expect(page).toHaveURL(/\/login\/sent\?a=\d+$/);
  const probe = (await (await fetch(`${mail.base}/last`)).json()) as { to?: string } | null;
  test.skip(probe?.to !== email, 'the server is not sending to the e2e sink (see the header of this spec)');
  await fetch(`${mail.base}/_fail`, { method: 'POST', body: JSON.stringify({ fail: true }) });
  try {
    await page.goto('/login');
    await attest(page).check();
    await page.getByLabel('Email').fill(email);
    await page.getByRole('button', { name: 'Send me a link' }).click();
    await expect(page).toHaveURL(/\/login\/sent\?a=\d+&error=send$/);
    const id = Number(page.url().match(/a=(\d+)/)![1]);
    await expect(page.locator('p[role="alert"]')).toHaveText('We could not send your link. Try again.');
    await expect(page.getByText('Check your email. The link works for 15 minutes.')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Send again' })).toBeVisible();
    const sql = await db();
    const links = await sql`select used_at from login_links where attempt_id = ${id}`;
    expect(links.length).toBe(1);
    expect(links[0].used_at).toBeTruthy(); // the undelivered link can never sign anyone in
    expect(await page.locator('body').innerText()).not.toMatch(/couldn't load|Internal Server Error|Application error/i);
    // Retry: "Send again" with the sender back, same attempt, and the new link signs in.
    await fetch(`${mail.base}/_fail`, { method: 'POST', body: JSON.stringify({ fail: false }) });
    await page.getByRole('button', { name: 'Send again' }).click();
    await expect(page).toHaveURL(new RegExp(`/login/sent\\?a=${id}&again=1$`));
    await expect(page.getByText('Check your email. The link works for 15 minutes.')).toBeVisible();
    const link = await lastLink(page);
    await page.goto(link);
    await expect(page).toHaveURL(/\/u\/trader_[a-z0-9]{8}$/);
    const [done] = await sql`select user_id, completed_at from signup_attempts where id = ${id}`;
    expect(done.completed_at).toBeTruthy();
    await sql`delete from users where id = ${done.user_id}`;
  } finally {
    await fetch(`${mail.base}/_fail`, { method: 'POST', body: JSON.stringify({ fail: false }) });
  }
});

const sessionHash = async (page: Page) => {
  const sid = (await page.context().cookies()).find((c) => c.name === 'sid')!.value;
  return createHash('sha256').update(sid.slice(0, sid.lastIndexOf('.'))).digest('hex');
};

test('the dev form lives at /login/dev and still signs an existing handle in through an attempt; signing in again replaces the session row', async ({ page }) => {
  const sql = await db();
  // Other specs sign in through this form in parallel workers, so look for this test's attempt, not a global count.
  const [{ max: before }] = await sql`select coalesce(max(id), 0)::int as max from signup_attempts`;
  await page.goto('/login/dev');
  await page.getByLabel('Handle').fill('dividend_dan');
  await page.getByLabel('I am 18 or older').check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(/\/u\/dividend_dan$/);
  const mine = await sql`select method, completed_at from signup_attempts a join users u on u.id = a.user_id where a.id > ${before} and u.handle = 'dividend_dan'`;
  expect(mine.length).toBeGreaterThanOrEqual(1); // app.spec.ts may sign the same demo handle in at the same time
  for (const a of mine) { expect(a.method).toBe('dev'); expect(a.completed_at).toBeTruthy(); }
  await expect(page.getByText('Change handle')).toBeVisible();
  const first = await sessionHash(page);
  expect((await sql`select 1 from sessions where token_hash = ${first}`).length).toBe(1);
  await page.goto('/login/dev');
  await page.getByLabel('Handle').fill('momentum_maya');
  await page.getByLabel('I am 18 or older').check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(/\/u\/momentum_maya$/);
  const second = await sessionHash(page);
  expect(second).not.toBe(first);
  expect((await sql`select 1 from sessions where token_hash = ${first}`).length).toBe(0); // the old row is gone
  expect((await sql`select 1 from sessions where token_hash = ${second}`).length).toBe(1);
});
