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
const maxAttempt = async () => Number((await (await db())`select coalesce(max(id), 0)::int as m from signup_attempts`)[0].m);
const attest = (page: Page) => page.getByLabel('I am 18 or older and accept the Terms and Privacy Policy');
const uniq = () => Math.random().toString(36).slice(2, 10);
const methodOrder = (page: Page) => page.locator('.auth .stack [data-method]').evaluateAll((els) => els.map((e) => e.getAttribute('data-method')));
const devSignIn = async (page: Page, handle: string) => {
  await page.goto('/login/dev');
  await page.getByLabel('Handle').fill(handle);
  await page.getByLabel('I am 18 or older').check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(new RegExp(`/u/${handle}$`));
};
// WCAG 2.x contrast of every visible button and .button: the text color over the backgrounds behind it, translucent
// layers composited bottom-up (a canvas normalizes any CSS color, including color-mix results, to rgb + alpha).
const buttonContrast = (page: Page) => page.evaluate(() => {
  const ctx = document.createElement('canvas').getContext('2d')!;
  const rgba = (c: string): [number, number, number, number] => {
    ctx.fillStyle = '#000'; ctx.fillStyle = c; const v = String(ctx.fillStyle);
    if (v.startsWith('#')) return [parseInt(v.slice(1, 3), 16), parseInt(v.slice(3, 5), 16), parseInt(v.slice(5, 7), 16), 1];
    const m = v.match(/[\d.]+/g)!.map(Number); return [m[0], m[1], m[2], m[3] ?? 1];
  };
  const lum = ([r, g, b]: number[]) => { const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const bgOf = (el: Element) => {
    const layers: [number, number, number, number][] = [];
    for (let e: Element | null = el; e; e = e.parentElement) { const l = rgba(getComputedStyle(e).backgroundColor); if (l[3] > 0) layers.push(l); if (l[3] >= 1) break; }
    let acc = rgba(getComputedStyle(document.body).backgroundColor).slice(0, 3);
    for (const [r, g, b, a] of layers.reverse()) acc = [r * a + acc[0] * (1 - a), g * a + acc[1] * (1 - a), b * a + acc[2] * (1 - a)];
    return acc;
  };
  return [...document.querySelectorAll<HTMLElement>('button, .button')].filter((el) => el.offsetParent !== null).map((el) => {
    const a = lum(rgba(getComputedStyle(el).color)), b = lum(bgOf(el));
    return { text: (el.textContent ?? '').trim().slice(0, 40), ratio: Math.round(((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)) * 100) / 100 };
  });
});

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
  // The checkbox is a 44px control; the legal links open in a new tab and the checked box is still there afterwards.
  const box = (await attest(page).boundingBox())!;
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);
  for (const name of ['Terms', 'Privacy Policy']) await expect(page.getByRole('link', { name })).toHaveAttribute('rel', /noopener/);
  await attest(page).check();
  const [popup] = await Promise.all([page.waitForEvent('popup'), page.getByRole('link', { name: 'Terms' }).click()]);
  await expect(popup).toHaveURL(/\/terms$/);
  await popup.close();
  await expect(attest(page)).toBeChecked();
  await attest(page).uncheck();
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
  const before = await maxAttempt();
  await page.getByRole('button', { name: 'Send me a link' }).click();
  await expect(page).toHaveURL(/\/login\/sent\?a=\d+$/);
  const attemptId = Number(page.url().match(/a=(\d+)/)![1]);
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
  expect(attemptId).toBeGreaterThan(before); // this browser's attempt (other specs write attempts in parallel workers)
  const [a] = await sql`select id, method, adult_attested_at, user_id from signup_attempts where id = ${attemptId}`;
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
  // First screen after sign-in: the provisional handle once, a status line, a 44px "Change handle" control.
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(`@${handle}`);
  expect((await page.locator('main').innerText()).split(handle).length - 1).toBe(1);
  await expect(page.getByRole('status')).toHaveText("You're in. Next: connect your brokerage.");
  expect((await page.getByText('Change handle').boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await expect(page.getByRole('link', { name: 'Connect your broker (read-only)' })).toBeVisible();
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
  // Single use: a second tap says "already used" (not "expired"), the address is prefilled from the login_email cookie
  // and the button offers a new link. The address is gone from the link row the moment it was claimed.
  expect((await sql`select 1 from login_links where email = ${email}`).length).toBe(0);
  await page.context().clearCookies({ name: 'sid' });
  await page.goto(link);
  await expect(page).toHaveURL(/\/login\?error=used$/);
  await expect(page.locator('p[role="alert"]')).toHaveText('That link was already used. Send a new one?');
  await expect(page.getByLabel('Email')).toHaveValue(email);
  await expect(page.getByRole('button', { name: 'Send a new link' })).toBeVisible();
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
  // The two links on their own 44px rows, no orphan separator at 375px.
  expect(await page.locator('main').innerText()).not.toContain('·');
  const vendorBox = (await page.getByRole('link', { name: "SnapTrade's security page" }).boundingBox())!;
  const howBox = (await page.getByRole('link', { name: 'How records are calculated' }).boundingBox())!;
  expect(vendorBox.height).toBeGreaterThanOrEqual(44);
  expect(howBox.height).toBeGreaterThanOrEqual(44);
  expect(howBox.y).toBeGreaterThanOrEqual(vendorBox.y + vendorBox.height);
  // Signed out there is no primary and no silent way back to S1: a status line and the sign-in options, each 44px.
  await expect(page.getByRole('link', { name: 'Connect brokerage (read-only)' })).toHaveCount(0);
  await expect(page.getByRole('status')).toHaveText('Sign in first, then connect.');
  const options = page.locator('ul.options a');
  expect(await options.count()).toBeGreaterThanOrEqual(1);
  await expect(options.last()).toHaveText('Sign in with an email link');
  for (const o of await options.all()) {
    expect((await o.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    expect(await o.getAttribute('href')).toMatch(/^\/login\?method=/);
  }
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
  // Brokerage-first signed out ends on the status line, never on S1 unexplained.
  await expect(page.getByRole('status')).toHaveText('Sign in first, then connect.');
  await expect(page.getByRole('link', { name: 'Connect brokerage (read-only)' })).toHaveCount(0);
  // Signed in, the primary is there and goes to the connection flow.
  await devSignIn(page, 'dividend_dan');
  await page.goto('/connect');
  await expect(page.getByRole('status')).toHaveCount(0);
  const primary = page.getByRole('link', { name: 'Connect brokerage (read-only)' });
  await expect(primary).toHaveAttribute('href', '/connect/start');
  expect((await primary.boundingBox())!.height).toBeGreaterThanOrEqual(44);
});

test('primary-button text contrast is at least 4.5:1 on S1, S2 and the own profile, light and dark', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 740 });
  const seen: string[] = [];
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme });
    await page.context().clearCookies();
    await page.goto('/login');
    for (const b of await buttonContrast(page)) { seen.push(`${colorScheme} S1 ${b.text} ${b.ratio}`); expect(b.ratio, `${colorScheme} S1 "${b.text}"`).toBeGreaterThanOrEqual(4.5); }
    await devSignIn(page, 'dividend_dan');
    await page.goto('/connect');
    for (const b of await buttonContrast(page)) { seen.push(`${colorScheme} S2 ${b.text} ${b.ratio}`); expect(b.ratio, `${colorScheme} S2 "${b.text}"`).toBeGreaterThanOrEqual(4.5); }
    await page.goto('/u/dividend_dan');
    for (const b of await buttonContrast(page)) { seen.push(`${colorScheme} profile ${b.text} ${b.ratio}`); expect(b.ratio, `${colorScheme} profile "${b.text}"`).toBeGreaterThanOrEqual(4.5); }
  }
  expect(seen.filter((x) => x.includes('Send me a link')).length).toBe(2); // both schemes measured the primary
  test.info().attach('contrast', { body: seen.join('\n') });
});

test('the emailed link opened on another host of the same server lands signed in on that host (redirects use the request origin)', async ({ page }) => {
  const email = `host-${uniq()}@example.com`;
  await page.goto('/login');
  await attest(page).check();
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: 'Send me a link' }).click();
  await expect(page).toHaveURL(/\/login\/sent\?a=\d+$/);
  const link = new URL(await lastLink(page));
  const other = new URL(link.toString());
  other.hostname = link.hostname === 'localhost' ? '127.0.0.1' : 'localhost';
  await page.goto(other.toString());
  await expect(page).toHaveURL(new RegExp(`^${other.origin.replace(/[.]/g, '\\.')}/u/trader_[a-z0-9]{8}$`));
  const handle = page.url().match(/\/u\/(trader_[a-z0-9]{8})/)![1];
  await expect(page.locator('nav.top .me')).toHaveText(`@${handle}`); // signed in where the cookie was set
  const sql = await db();
  await sql`delete from users where handle = ${handle}`;
});

test('an expired link says expired, keeps the address and offers "Send a new link"', async ({ page }) => {
  const email = `exp-${uniq()}@example.com`;
  await page.goto('/login');
  await attest(page).check();
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: 'Send me a link' }).click();
  await expect(page).toHaveURL(/\/login\/sent\?a=\d+$/);
  const id = Number(page.url().match(/a=(\d+)/)![1]);
  const link = await lastLink(page);
  const sql = await db();
  await sql`update login_links set expires_at = now() - interval '1 second' where attempt_id = ${id}`;
  await page.goto(link);
  await expect(page).toHaveURL(/\/login\?error=expired$/);
  await expect(page.locator('p[role="alert"]')).toHaveText('That link has expired. Send a new one?');
  await expect(page.getByLabel('Email')).toHaveValue(email);
  const again = page.getByRole('button', { name: 'Send a new link' });
  await expect(again).toBeVisible();
  await attest(page).check();
  await again.click();
  await expect(page).toHaveURL(/\/login\/sent\?a=\d+$/); // a new attempt, a new link, no retyping
  expect((await sql`select 1 from login_links where attempt_id = ${id}`).length).toBe(0); // the expired row went with its address
});

test('method memory: a failed submit never reorders S1, the brokerage block stays last; a completed sign-in moves its method first', async ({ page }) => {
  await page.goto('/login');
  const before = await methodOrder(page);
  expect(before[0]).not.toBe('brokerage');
  expect(before[before.length - 1]).toBe('brokerage');
  await page.getByLabel('Email').fill('order@example.com');
  await page.getByRole('button', { name: 'Send me a link' }).click();
  await expect(page.locator('p[role="alert"]')).toHaveText('Confirm you are 18 or older to continue.');
  expect(await methodOrder(page)).toEqual(before); // the tap that failed left the order alone
  await page.goto('/login');
  expect(await methodOrder(page)).toEqual(before);
  const email = `mem-${uniq()}@example.com`;
  await attest(page).check();
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: 'Send me a link' }).click();
  await expect(page).toHaveURL(/\/login\/sent\?a=\d+$/);
  await page.goto('/login');
  expect(await methodOrder(page)).toEqual(before); // sent but not completed: still the same order
  await page.goto(await lastLink(page));
  await expect(page).toHaveURL(/\/u\/trader_[a-z0-9]{8}$/);
  const handle = page.url().match(/\/u\/(trader_[a-z0-9]{8})/)![1];
  await page.context().clearCookies({ name: 'sid' });
  await page.goto('/login');
  const after = await methodOrder(page);
  expect(after[0]).toBe('email');
  expect(after[after.length - 1]).toBe('brokerage');
  expect([...after].sort()).toEqual([...before].sort());
  const sql = await db();
  await sql`delete from users where handle = ${handle}`;
});

test('signed in, /login is the own profile', async ({ page }) => {
  await devSignIn(page, 'momentum_maya');
  await page.goto('/login');
  await expect(page).toHaveURL(/\/u\/momentum_maya$/);
  await page.goto('/login?ref=dividend_dan&via=nav');
  await expect(page).toHaveURL(/\/u\/momentum_maya$/);
});

test('the nav "Publish your trades" on a profile carries ref and via=nav, so landed.source is the profile, not direct', async ({ page }) => {
  await page.goto('/u/momentum_maya');
  const nav = page.locator('nav.top').getByRole('link', { name: 'Publish your trades' });
  await expect(nav).toHaveAttribute('href', '/login?ref=momentum_maya&via=nav');
  await page.goto('/');
  await expect(page.locator('nav.top').getByRole('link', { name: 'Publish your trades' })).toHaveAttribute('href', '/login');
  await page.goto('/u/momentum_maya');
  await nav.click();
  await expect(page).toHaveURL(/\/login\?ref=momentum_maya&via=nav$/);
  await attest(page).check();
  await page.getByLabel('Email').fill(`nav-${uniq()}@example.com`);
  await page.getByRole('button', { name: 'Send me a link' }).click();
  await expect(page).toHaveURL(/\/login\/sent\?a=\d+$/);
  const id = Number(page.url().match(/a=(\d+)/)![1]);
  const sql = await db();
  const [landed] = await sql`select meta from funnel_events where attempt_id = ${id} and name = 'landed'`;
  expect(landed.meta).toEqual({ source: 'profile' });
});

for (const key of ['provider_a', 'provider_b'] as const) {
  test(`${key}: OIDC code flow with PKCE signs in, returns the same user, and refuses a bad state`, async ({ page }) => {
    await page.goto('/login');
    const button = page.locator(`button[name="method"][value="${key}"]`);
    test.skip((await button.count()) === 0, `${key} is not configured on the server (see the header of this spec)`);
    const sub = `sub-${uniq()}`;
    await fetch(`${oidc.base}/_set`, { method: 'POST', body: JSON.stringify({ sub, email: `${sub}@example.com` }) });
    await attest(page).check();
    const before = await maxAttempt();
    await button.click();
    await expect(page).toHaveURL(/\/u\/trader_[a-z0-9]{8}$/);
    const handle = page.url().match(/\/u\/(trader_[a-z0-9]{8})/)![1];
    const sql = await db();
    // The new user's own attempt (a global count races with app.spec.ts's dev sign-ins in the other worker).
    const [att] = await sql`select a.id, a.method, a.completed_at from signup_attempts a join users u on u.signup_attempt_id = a.id where u.handle = ${handle}`;
    expect(Number(att.id)).toBeGreaterThan(before);
    expect(att.method).toBe(key);
    expect(att.completed_at).toBeTruthy();
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
