// F-2 PR-4: likes and the feed card's reject swipe, against the real app (needs `npm run db:seed`), at 375 px with touch.
// Double tap likes once (private: no count anywhere, only the viewer's own list); the heart is the keyboard route; the
// reject swipe (owner decision O1) hides that one trade with "Hidden for 90 days." and Undo, armed only at rest; the
// opening swipe still opens the pane (SW-1) and writes nothing; no event endpoint is ever called. Screenshots in
// docs/features/logs/F-2/screenshots/pr4/.
import { expect, test, type Browser, type Page } from '@playwright/test';
import postgres from 'postgres';
import { feedLock } from './feed-lock.ts';

const SHOTS = 'docs/features/logs/F-2/screenshots/pr4';
const DAY = 86_400_000;
const sql = postgres(process.env.DATABASE_URL!, { max: 2, onnotice: () => {} });
test.afterAll(async () => { await sql.end({ timeout: 1 }); });

const shoot = async (page: Page, name: string) => {
  for (const colorScheme of ['light', 'dark'] as const) { await page.emulateMedia({ colorScheme }); await page.screenshot({ path: `${SHOTS}/${name}-${colorScheme}.png` }); }
  await page.emulateMedia({ colorScheme: 'light' });
};
// 40 traders × 5 fresh closes (so the fixture fills the first page), accounts 60 days old.
async function fixture() {
  const tag = `p4${Math.random().toString(36).slice(2, 6)}`;
  const ids: number[] = [];
  const at = Date.now() - 600_000;
  for (let t = 0; t < 40; t++) {
    const [u] = await sql`with a as (insert into signup_attempts (method, adult_attested_at) values ('dev', now()) returning id)
      insert into users (handle, display_name, adult_attested_at, signup_attempt_id, created_at) select ${`${tag}_${t}`}, ${`Card Trader ${t}`}, now(), a.id, now() - interval '60 days' from a returning id`;
    ids.push(u.id as number);
    await sql`insert into closed_trades ${sql(Array.from({ length: 5 }, (_, i) => ({
      user_id: u.id, sell_id: `${tag}-${t}-${i}`, account_id: 'a', symbol: `Y${String.fromCharCode(65 + (t % 26))}${String.fromCharCode(65 + ((t * 5 + i) % 26))}${i}`,
      opened_at: new Date(at - (t * 5 + i) * 20_000 - 3 * DAY), closed_at: new Date(at - (t * 5 + i) * 20_000),
      return_pct: (i + t) % 3 ? 0.2 + ((t * 7 + i) % 10) / 40 : -0.2 - ((t + i) % 5) / 40, holding_days: 3, verified: true,
    })))}`;
  }
  return { tag, ids, remove: () => sql`delete from users where id = any(${ids})` };
}
async function signIn(page: Page, handle: string) {
  await page.goto('/login/dev');
  await page.getByLabel('Handle').fill(handle);
  await page.getByLabel('I am 18 or older').check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(new RegExp(`/u/${handle}$`));
}
async function touchPage(browser: Browser) {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 800 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  return { ctx, page: await ctx.newPage() };
}
type Loc = ReturnType<Page['locator']>;
// Real touch events through the browser's input pipeline. `hold`: keep the finger down at the end (mid-drag checks).
async function swipe(page: Page, el: Loc, dx: number, dy = 0, hold = false) {
  const b = (await el.boundingBox())!;
  const y = Math.round(b.y + b.height / 2), x0 = Math.round(dx < 0 ? b.x + b.width - 10 : b.x + 10);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y }] });
  const steps = Math.max(2, Math.round(Math.max(Math.abs(dx), Math.abs(dy)) / 10));
  for (let i = 1; i <= steps; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + (dx * i) / steps, y: y + (dy * i) / steps }] }); await page.waitForTimeout(16); }
  await page.waitForTimeout(120);
  if (hold) return async () => { await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await cdp.detach(); };
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
  return async () => {};
}
async function doubleTap(page: Page, el: Loc, gap = 90) {
  const b = (await el.boundingBox())!;
  const x = Math.round(b.x + b.width / 2), y = Math.round(b.y + b.height / 2);
  const cdp = await page.context().newCDPSession(page);
  for (let k = 0; k < 2; k++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    if (!k) await page.waitForTimeout(gap);
  }
  await cdp.detach();
}
const likes = async (handle: string) => (await sql`select count(*)::int as n from trade_likes l join users u on u.id = l.viewer_id where u.handle = ${handle}`)[0].n as number;
const rejects = async (handle: string) => (await sql`select count(*)::int as n from trade_rejects r join users u on u.id = r.viewer_id where u.handle = ${handle} and r.until > now()`)[0].n as number;

test('F-2 PR-4: double tap likes once and privately; a vertical swipe never likes; the heart is the keyboard route (aria-pressed, 44 px, no count); likes come back after a reload and are listed on /me/following only', async ({ browser }) => {
  test.setTimeout(180_000);
  const release = await feedLock('exclusive');
  const fx = await fixture();
  const me = `p4l${Math.random().toString(36).slice(2, 7)}`;
  const { ctx, page } = await touchPage(browser);
  const events: string[] = [];
  await page.route('**/api/events**', (r) => { events.push(r.request().url()); return r.abort(); });
  try {
    await signIn(page, me);
    await page.goto('/');
    await expect(page.locator('.feed .pane .chart-hit').first()).toBeAttached(); // hydrated
    const row = page.locator('.feed > .row').first();
    const heart = row.getByRole('button', { name: 'Like. Only you can see likes.' });
    await expect(heart).toHaveAttribute('aria-pressed', 'false');
    const box = (await heart.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect((await heart.textContent())!.trim()).toBe(''); // an icon, never a count
    // A vertical swipe on the card scrolls the feed; it never likes.
    await swipe(page, row.locator('.hero'), 0, -250);
    await page.waitForTimeout(400);
    expect(await likes(me)).toBe(0);
    await page.locator('main.feed').evaluate((el) => { el.scrollTop = 0; });
    await page.waitForTimeout(300);
    // Two taps 400 ms apart: no like. A double tap (90 ms): one like, filled.
    await doubleTap(page, row.locator('.ret'), 400);
    await page.waitForTimeout(400);
    expect(await likes(me)).toBe(0);
    await doubleTap(page, row.locator('.ret'));
    await expect(heart).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => likes(me)).toBe(1);
    await doubleTap(page, row.locator('.ret')); // a second double tap likes once: never an unlike
    await page.waitForTimeout(500);
    expect(await likes(me)).toBe(1);
    await expect(heart).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.ctray').first()).toBeHidden(); // no burst, no tray, nothing else changes
    await shoot(page, 'card-liked-375');
    // Keyboard: Enter on the heart unlikes, Space likes again.
    await heart.focus();
    await page.keyboard.press('Enter');
    await expect(heart).toHaveAttribute('aria-pressed', 'false');
    await expect.poll(() => likes(me)).toBe(0);
    await page.keyboard.press('Space');
    await expect(heart).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => likes(me)).toBe(1);
    // After a reload the pressed state comes back (read for this viewer only).
    await page.reload();
    await expect(page.locator('.feed > .row').first().getByRole('button', { name: 'Like. Only you can see likes.' })).toHaveAttribute('aria-pressed', 'true');
    // Nothing public shows it: the trader's profile and the pane carry no count or list of likes.
    const handle = (await row.getAttribute('data-handle'))!;
    const profile = await (await page.request.get(`/u/${handle}`)).text();
    expect(profile).not.toMatch(/\blikes?\b|data-like/i);
    // /me/following lists it, with Unlike.
    await page.goto('/me/following');
    await expect(page.getByRole('heading', { name: 'Liked records' })).toBeVisible();
    const item = page.locator('#liked + p + ul li').first();
    await expect(item).toContainText(`@${handle}`);
    await shoot(page, 'liked-list-375');
    await item.getByRole('button', { name: /^Unlike / }).tap();
    await expect(page.getByText('No liked records yet.', { exact: false })).toBeVisible();
    expect(await likes(me)).toBe(0);
    expect(events).toEqual([]);
  } finally {
    await ctx.close();
    await sql`delete from users where handle = ${me}`;
    await fx.remove();
    await release();
  }
});

test('F-2 PR-4: the reject swipe on a feed card hides that trade only, with "Hidden for 90 days." and Undo; a short drag snaps back; the opening swipe still opens the pane and writes nothing; right after the pane closes the reject never commits; "Hide this trade" is its button', async ({ browser }) => {
  test.setTimeout(180_000);
  const release = await feedLock('exclusive');
  const fx = await fixture();
  const me = `p4r${Math.random().toString(36).slice(2, 7)}`;
  const { ctx, page } = await touchPage(browser);
  const events: string[] = [];
  await page.route('**/api/events**', (r) => { events.push(r.request().url()); return r.abort(); });
  try {
    await signIn(page, me);
    await page.goto('/');
    await expect(page.locator('.feed .pane .chart-hit').first()).toBeAttached();
    const row = page.locator('.feed > .row').first();
    const card = row.locator('.card');
    const w = await card.evaluate((el) => el.clientWidth);
    expect(w).toBeGreaterThan(300);
    // The opening swipe opens the pane (SW-1) and writes nothing.
    await swipe(page, card, -300);
    await expect.poll(() => row.evaluate((el) => el.scrollLeft)).toBeGreaterThan(300);
    // Straight back from the pane, then at once the reject direction again: never a reject (the row was not at rest).
    await swipe(page, row.locator('.pane'), 300);
    await swipe(page, card, Math.round(w * 0.6));
    await expect.poll(() => row.evaluate((el) => el.scrollLeft)).toBe(0);
    await page.waitForTimeout(400);
    expect(await rejects(me)).toBe(0);
    await expect(row).toBeVisible();
    await page.waitForTimeout(500);
    // A short drag (40% of the card) snaps back.
    await swipe(page, card, Math.round(w * 0.4));
    await expect.poll(() => card.evaluate((el) => el.style.transform)).toBe('');
    await page.waitForTimeout(300);
    expect(await rejects(me)).toBe(0);
    // Mid-drag past half: the tray shows its whole label.
    const lift = await swipe(page, card, Math.round(w * 0.6), 0, true);
    await expect(row.locator('.ctray')).toBeVisible();
    const [l, r] = await row.locator('.ctray span').evaluate((el) => { const b = el.getBoundingClientRect(); return [b.left, b.right]; });
    expect(l).toBeGreaterThanOrEqual(0);
    expect(r).toBeLessThanOrEqual(Math.round(w * 0.6) + 12);
    await shoot(page, 'reject-mid-drag-375');
    await lift();
    // Released past half: that trade is hidden, the bar says so with Undo; the trader's other cards stay.
    const handle = (await row.getAttribute('data-handle'))!, key = (await row.getAttribute('data-key'))!;
    await expect(page.locator(`.feed > .row[data-key="${key}"]`)).toBeHidden();
    await expect.poll(() => rejects(me)).toBe(1);
    await expect(page.locator('.hide-bar')).toContainText('Hidden for 90 days.');
    const others = page.locator(`.feed > .row[data-handle="${handle}"]:not([data-key="${key}"])`);
    if (await others.count()) await expect(others.first()).toBeAttached();
    expect(await others.evaluateAll((rs) => rs.every((x) => getComputedStyle(x).display !== 'none'))).toBe(true);
    await shoot(page, 'reject-undo-375');
    await page.locator('.hide-bar').getByRole('button', { name: 'Undo' }).tap();
    await expect(page.locator(`.feed > .row[data-key="${key}"]`)).toBeVisible();
    await expect.poll(() => rejects(me)).toBe(0);
    await expect.poll(() => card.evaluate((el) => el.style.transform)).toBe('');
    // Keyboard: "Hide this trade" is the same action; Undo takes focus, then returns to the button.
    const hide = row.getByRole('button', { name: 'Hide this trade' });
    expect((await hide.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await hide.focus();
    await page.keyboard.press('Enter');
    await expect(row).toBeHidden();
    await expect.poll(() => rejects(me)).toBe(1);
    const undo = page.locator('.hide-bar').getByRole('button', { name: 'Undo' });
    await expect(undo).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(row).toBeVisible();
    await expect(hide).toBeFocused();
    await expect.poll(() => rejects(me)).toBe(0);
    // A rejected trade stays out of the next page 1 (and the row reads the same once Undo ran).
    await hide.click();
    await expect.poll(() => rejects(me)).toBe(1);
    await page.goto('/');
    await expect(page.locator('.feed > .row').first()).toBeVisible();
    await expect(page.locator(`.feed > .row[data-key="${key}"]`)).toHaveCount(0);
    expect(events).toEqual([]);
  } finally {
    await ctx.close();
    await sql`delete from users where handle = ${me}`;
    await fx.remove();
    await release();
  }
});

test('F-2 PR-4: signed out, the heart shows one sign-in line and writes nothing; no reject tray or hide button; the liked-state read returns nothing', async ({ browser }) => {
  const release = await feedLock('shared');
  const { ctx, page } = await touchPage(browser);
  const writes: string[] = [];
  page.on('request', (r) => { if (r.method() !== 'GET') writes.push(r.url()); });
  try {
    await page.goto('/');
    await expect(page.locator('.feed .pane .chart-hit').first()).toBeAttached();
    const row = page.locator('.feed > .row').first();
    await expect(row.locator('.ctray')).toHaveCount(0);
    await expect(row.getByRole('button', { name: 'Hide this trade' })).toHaveCount(0);
    const line = row.locator('.like-signin');
    await expect(line).toBeHidden();
    await row.getByRole('button', { name: 'Like. Only you can see likes.' }).tap();
    await expect(line).toBeVisible();
    await expect(line).toContainText('Sign in to like records. Only you can see likes.');
    await expect(line.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
    await shoot(page, 'signed-out-like-375');
    await doubleTap(page, row.locator('.ret'));
    await swipe(page, row.locator('.card'), 220);
    await page.waitForTimeout(500);
    expect(writes).toEqual([]);
    const key = (await row.getAttribute('data-key'))!;
    expect(await (await page.request.get(`/me/liked?k=${key}`)).json()).toEqual({ liked: [] });
  } finally {
    await ctx.close();
    await release();
  }
});
