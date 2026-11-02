// FIXES-CYCLE5 WP4 focus and timing in the browser: F5-7 (the email error keeps the trader in place, and the trader's own
// 18+ tick survives it for one render; legal committee 2026-11-02 item 1 A1-A9), F5-21 (the hide bar waits for the
// reader; Playwright clock), F5-22 (rule forms keep focus), F5-23 (delete step 1 focuses its alert).
// Each test makes its own users (handle prefix fc5d_) and deletes them; the feed test takes the shared feed lock.
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import postgres from 'postgres';
import { FC5, FC5_WP4, SIGNIN } from '../lib/copy.ts';
import { ATTEST_KEEP_COOKIE } from '../lib/auth/attest-keep.ts';
import { feedLock } from './feed-lock.ts';

const sql = postgres(process.env.DATABASE_URL!, { max: 2, onnotice: () => {} });
test.afterAll(async () => { await sql.end({ timeout: 1 }); });
const uniq = () => Math.random().toString(36).slice(2, 8);
const box = (page: Page) => page.getByRole('checkbox', { name: /I am 18 or older/ });
const described = (page: Page) => page.locator('#email').evaluate((el) => el.getAttribute('aria-describedby')?.split(' ').map((id) => document.getElementById(id)?.textContent ?? '').join(' ') ?? '');
const keptCookie = async (ctx: BrowserContext) => (await ctx.cookies()).find((c) => c.name === ATTEST_KEEP_COOKIE);

test.describe('F5-7 email error', () => {
  test.use({ viewport: { width: 360, height: 640 } });

  test('a short address + Enter: #email focused, value kept, both sentences in its description, and the box still ticked', async ({ page, context }) => {
    await page.goto('/login');
    await box(page).check();
    await page.locator('#email').fill('trader@mailhost');
    await page.locator('#email').press('Enter');
    await expect(page).toHaveURL(/\/login\?.*error=email/);
    await expect(page.locator('#email')).toBeFocused();
    await expect(page.locator('#email')).toHaveValue('trader@mailhost');
    await expect(page.locator('#email')).toHaveAttribute('aria-describedby', 'email-err');
    await expect(page.locator('#email-err')).toHaveAttribute('role', 'alert');
    expect(await described(page)).toBe(`${SIGNIN.emailError} ${FC5_WP4.tickKept}`);
    await expect(box(page)).toBeChecked();
    // A2, A3: one fixed value, httpOnly, lax, /login, at most 60 s.
    const c = await keptCookie(context);
    expect(c).toBeTruthy();
    expect(c!.value).toBe('1');
    expect(c!.httpOnly).toBe(true);
    expect(c!.sameSite).toBe('Lax');
    expect(c!.path).toBe('/login');
    expect(c!.expires * 1000 - Date.now()).toBeLessThanOrEqual(60_000);
    expect(c!.expires).toBeGreaterThan(0);
    // The example address is never prefilled or a placeholder (B4).
    await expect(page.locator('#email')).not.toHaveAttribute('placeholder', /.*/);
    // Fix the address and send: the link page (the attestation is this submit's own tick).
    await page.locator('#email').fill(`fc5d-${uniq()}@example.com`);
    await page.locator('#email').press('Enter');
    await expect(page).toHaveURL(/\/login\/sent\?a=\d+/);
    expect(await keptCookie(context)).toBeUndefined();
  });

  test('A5: once only: a reload after the bounce shows the box unticked and asks for the tick again', async ({ page, context }) => {
    await page.goto('/login');
    await box(page).check();
    await page.locator('#email').fill('trader@mailhost');
    await page.locator('#email').press('Enter');
    await expect(page).toHaveURL(/error=email/);
    await expect(box(page)).toBeChecked();
    await page.reload();
    await expect(box(page)).not.toBeChecked();
    expect(await described(page)).toBe(`${SIGNIN.emailError} ${FC5.attestAgain}`);
    expect(await keptCookie(context)).toBeUndefined();
    await expect(page.locator('#email')).toHaveValue('trader@mailhost');
  });

  test('an empty address: the same focus and description; Shift+Tab to the box, Space unticks it, then error=attest (A9)', async ({ page }) => {
    await page.goto('/login');
    await box(page).check();
    await page.getByRole('button', { name: SIGNIN.emailButton }).click();
    await expect(page).toHaveURL(/error=email/);
    await expect(page.locator('#email')).toBeFocused();
    await expect(page.locator('#email')).toHaveValue('');
    expect(await described(page)).toBe(`${SIGNIN.emailError} ${FC5_WP4.tickKept}`);
    // The box is a normal control: reachable by keyboard and untickable; unticked, the submit is refused.
    for (let i = 0; i < 10 && !(await box(page).evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press('Shift+Tab');
    await expect(box(page)).toBeFocused();
    await page.keyboard.press('Space');
    await expect(box(page)).not.toBeChecked();
    await page.locator('#email').fill(`fc5d-${uniq()}@example.com`);
    await page.locator('#email').press('Enter');
    await expect(page).toHaveURL(/error=attest/);
    await expect(box(page)).not.toBeChecked();
  });

  test('without the bounce: tick it again by keyboard after an unticked error, fix the address, Enter → /login/sent', async ({ page }) => {
    await page.goto('/login?error=email');
    await expect(box(page)).not.toBeChecked();
    expect(await described(page)).toBe(`${SIGNIN.emailError} ${FC5.attestAgain}`);
    await expect(page.locator('#email')).toBeFocused();
    for (let i = 0; i < 10 && !(await box(page).evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Space');
    await expect(box(page)).toBeChecked();
    await page.locator('#email').fill(`fc5d-${uniq()}@example.com`);
    await page.locator('#email').press('Enter');
    await expect(page).toHaveURL(/\/login\/sent\?a=\d+/);
  });

  test('A4: no URL can tick the box; the cookie ticks it only with error=email', async ({ page, context }) => {
    await page.goto('/login?error=email&adult=on&attest=1&checked=1');
    await expect(box(page)).not.toBeChecked();
    await page.goto('/login?adult=on#adult');
    await expect(box(page)).not.toBeChecked();
    // A planted cookie (as a sibling page could) with no error, or another error: still unticked, and cleared.
    for (const q of ['', '?error=attest', '?error=rate', '?error=email']) {
      await context.addCookies([{ name: ATTEST_KEEP_COOKIE, value: '1', domain: 'localhost', path: '/login' }]);
      await page.goto(`/login${q}`);
      await expect(box(page), q).not.toBeChecked(); // a GET never sees it (only the action's own bounce does)
      expect(await keptCookie(context), q).toBeUndefined();
    }
  });

  test('A1, A6: other errors set no cookie; a POST carrying the cookie but no tick is refused (error=attest)', async ({ page, context }) => {
    await page.goto('/login');
    await page.locator('#email').fill(`fc5d-${uniq()}@example.com`);
    await page.locator('#email').press('Enter');
    await expect(page).toHaveURL(/error=attest/);
    expect(await keptCookie(context)).toBeUndefined();
    await context.addCookies([{ name: ATTEST_KEEP_COOKIE, value: '1', domain: 'localhost', path: '/login' }]);
    await page.locator('#email').fill(`fc5d-${uniq()}@example.com`);
    const posted = page.waitForResponse((r) => r.request().method() === 'POST' && new URL(r.url()).pathname === '/login');
    await page.locator('#email').press('Enter');
    // The URL already says error=attest from the first submit: wait for this submit's own response, which clears it.
    expect((await (await posted).headersArray()).filter((h) => /^set-cookie$/i.test(h.name)).map((h) => h.value)).toContain(`${ATTEST_KEEP_COOKIE}=; Path=/login; Max-Age=0; HttpOnly; SameSite=lax`);
    await expect(page).toHaveURL(/error=attest/);
    await expect(box(page)).not.toBeChecked();
    expect(await keptCookie(context)).toBeUndefined();
    expect((await context.cookies()).map((c) => c.name)).not.toContain('login_attempt');
  });

  test('error=rate: the alert takes focus', async ({ page }) => {
    await page.goto('/login?error=rate');
    await expect(page.locator('#email-rate')).toBeFocused();
    await expect(page.locator('#email-rate')).toHaveText(SIGNIN.tooMany);
  });
});

async function signIn(page: Page, handle: string) {
  await page.goto('/login/dev');
  await page.getByLabel('Handle').fill(handle);
  await page.getByLabel('I am 18 or older').check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(new RegExp(`/u/${handle}$`));
}
const SEEDED = ['momentum_maya', 'dividend_dan', 'yolo_yuki'];
const seededRows = (page: Page) => page.locator(`.feed > .row[data-trade]:is(${SEEDED.map((h) => `[data-handle="${h}"]`).join(', ')})`);
// Hide the first seeded card's trade by tap (its "…" menu, then "Hide this trade"); returns the next visible row's id.
async function hideFirst(page: Page): Promise<string> {
  const row = seededRows(page).first();
  await row.evaluate((el) => el.scrollIntoView());
  const id = await row.getAttribute('data-trade');
  const next = await page.locator('.feed > .row[data-trade]').evaluateAll((rs, id) => {
    const i = rs.findIndex((r) => r.getAttribute('data-trade') === id);
    return rs.slice(i + 1).find((r) => (r as HTMLElement).offsetParent)?.getAttribute('data-trade') ?? '';
  }, id);
  await row.locator('.card .more-menu summary').click();
  await row.getByRole('button', { name: 'Hide this trade' }).click();
  await expect(row).toBeHidden();
  await expect(page.locator('.hide-bar')).toContainText('Trade hidden.');
  await expect(page.locator('.hide-bar').getByRole('button', { name: 'Undo' })).toBeFocused();
  return next;
}
const nextFocused = (page: Page, next: string) => expect(page.locator(`.feed > .row[data-trade="${next}"] .card .who`)).toBeFocused();

test.describe('F5-21 the hide bar waits for the reader', () => {
  test.use({ viewport: { width: 360, height: 640 } });
  let release: () => Promise<void>;
  const me = `fc5d${uniq()}`;
  test.beforeAll(async () => { release = await feedLock('shared'); });
  test.afterAll(async () => { await sql`delete from users where handle = ${me}`; await release(); });

  test('hide by tap: there at 19 s, gone at 21 s with focus on the next card name; Dismiss (44 px) closes onto it too', async ({ page }) => {
    test.setTimeout(90_000);
    await signIn(page, me);
    await page.clock.install();
    await page.goto('/');
    const next = await hideFirst(page);
    const bar = page.locator('.hide-bar > p');
    await page.clock.runFor(19_000);
    await expect(bar).toBeVisible();
    await page.clock.runFor(2_000);
    await expect(bar).toHaveCount(0);
    await nextFocused(page, next);
    // Dismiss.
    await page.goto('/');
    const next2 = await hideFirst(page);
    const dismiss = page.locator('.hide-bar').getByRole('button', { name: FC5.dismiss });
    const b = (await dismiss.boundingBox())!;
    expect(b.height).toBeGreaterThanOrEqual(44);
    expect(b.width).toBeGreaterThanOrEqual(44);
    await dismiss.click();
    await expect(bar).toHaveCount(0);
    await nextFocused(page, next2);
  });

  test('Tab to Dismiss pauses it (still there at 60 s); Tab out starts a fresh 20 s; Esc closes onto the next card', async ({ page }) => {
    test.setTimeout(90_000);
    await signIn(page, me);
    await page.clock.install();
    await page.goto('/');
    await hideFirst(page);
    const bar = page.locator('.hide-bar > p');
    await page.keyboard.press('Tab');
    await expect(page.locator('.hide-bar').getByRole('button', { name: FC5.dismiss })).toBeFocused();
    await page.clock.runFor(60_000);
    await expect(bar).toBeVisible();
    await page.keyboard.press('Tab'); // out of the bar
    await expect(page.locator('.hide-bar :focus')).toHaveCount(0);
    await page.clock.runFor(19_000);
    await expect(bar).toBeVisible();
    await page.clock.runFor(2_000);
    await expect(bar).toHaveCount(0);
    // Esc from the bar closes it onto the next card.
    await page.goto('/');
    const next = await hideFirst(page);
    await page.keyboard.press('Escape');
    await expect(bar).toHaveCount(0);
    await nextFocused(page, next);
  });

  test('/me/hidden: Show again focuses the status line naming the trader', async ({ page }) => {
    await signIn(page, me);
    await page.goto('/me/hidden');
    const show = page.getByRole('button', { name: /Show again/ }).first();
    await expect(show).toBeVisible();
    await show.click();
    await expect(page).toHaveURL(/\/me\/hidden\?.*back=/);
    await expect(page.locator('#hidden-back')).toBeFocused();
    await expect(page.locator('#hidden-back')).toContainText(/@(momentum_maya|dividend_dan|yolo_yuki)/);
  });
});

test.describe('F5-22, F5-23 forms keep focus', () => {
  test.use({ viewport: { width: 360, height: 640 } });
  const me = `fc5d${uniq()}`;
  test.afterAll(async () => { await sql`delete from users where handle = ${me}`; });

  test('a rule form: Set and Clear focus the card heading, in view, with a status that says what changed', async ({ page }) => {
    await signIn(page, me);
    await page.goto('/me/record');
    const card = page.getByRole('region', { name: 'Close losing trades within N days' });
    await card.getByLabel('Days').fill('5');
    await card.getByRole('button', { name: 'Set rule' }).click();
    await expect(page).toHaveURL(/\/me\/record\?rule=cut_losers&did=set#rule-cut_losers$/);
    const h = page.locator('#rule-cut_losers-h');
    await expect(h).toBeFocused();
    await expect(h).toBeInViewport();
    await expect(card.locator('p[role="status"]')).toHaveText(FC5.ruleSet('Close losing trades within 5 days'));
    await expect(page.locator('#rule-hold_winners p[role="status"]')).toHaveCount(0);
    await card.getByRole('button', { name: 'Clear rule' }).click();
    await expect(page).toHaveURL(/did=clear#rule-cut_losers$/);
    await expect(h).toBeFocused();
    await expect(h).toBeInViewport();
    await expect(card.locator('p[role="status"]')).toHaveText(FC5.ruleCleared);
    await expect(card.getByText('Not set')).toBeVisible();
    // A crafted URL with an unknown kind or verb says nothing.
    await page.goto('/me/record?rule=nope&did=set');
    await expect(page.locator('.rec-card p[role="status"]')).toHaveCount(0);
  });

  test('delete step 1 lands on its alert; the next Tab reaches the final delete button', async ({ page }) => {
    await signIn(page, me);
    await page.goto('/settings');
    await page.getByTestId('delete-first').click();
    await expect(page).toHaveURL(/\/settings\?confirm=1$/);
    await expect(page.locator('#delete-confirm')).toBeFocused();
    await expect(page.locator('#delete-confirm')).toHaveAttribute('role', 'alert');
    await page.keyboard.press('Tab');
    await expect(page.getByTestId('delete-final')).toBeFocused();
  });
});
