// F-2 PR-4: private likes (double tap, +3) and the feed card's reject swipe (O1), against the real app (needs
// `npm run db:seed`). Likes are private (no count anywhere), quiet (no animation) and have a keyboard route in the card's
// "…" menu; the reject swipe hides that trade with Undo; the opening swipe still opens the pane (SW-1); no request to
// any event endpoint is ever sent. Screenshots in docs/features/logs/F-2/screenshots/pr4/.
import { expect, test, type Browser, type BrowserContext, type Locator, type Page } from '@playwright/test';
import postgres from 'postgres';
import { feedLock } from './feed-lock.ts';

const SHOTS = 'docs/features/logs/F-2/screenshots/pr4';
const sql = postgres(process.env.DATABASE_URL!, { max: 2, onnotice: () => {} });
test.afterAll(async () => { await sql.end({ timeout: 1 }); });
const shoot = async (page: Page, name: string) => {
  for (const colorScheme of ['light', 'dark'] as const) { await page.emulateMedia({ colorScheme }); await page.screenshot({ path: `${SHOTS}/${name}-${colorScheme}.png` }); }
  await page.emulateMedia({ colorScheme: 'light' });
};
async function signIn(page: Page, handle: string) {
  await page.goto('/login/dev');
  await page.getByLabel('Handle').fill(handle);
  await page.getByLabel('I am 18 or older').check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(new RegExp(`/u/${handle}$`));
}
const handle = () => `lk${Math.random().toString(36).slice(2, 9)}`;
const count = async (table: 'trade_likes' | 'trade_exclusions', h: string) =>
  (await sql`select count(*)::int as n from ${sql(table)} x join users u on u.id = x.viewer_id where u.handle = ${h}`)[0].n as number;
const removeUser = (h: string) => sql`delete from users where handle = ${h}`;
// Every request to an event endpoint, of any kind (PR-5's, which must not exist yet).
function watchEvents(ctx: BrowserContext): string[] {
  const seen: string[] = [];
  ctx.on('request', (r) => { if (/\/api\/events|discovery-log|[?&/]events?\b/i.test(r.url())) seen.push(r.url()); });
  return seen;
}
async function touchPage(browser: Browser) {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 800 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  return { ctx, page: await ctx.newPage(), events: watchEvents(ctx) };
}
// Real touch events through the browser's input pipeline.
async function touches(page: Page, run: (send: (type: 'touchStart' | 'touchMove' | 'touchEnd', x?: number, y?: number) => Promise<void>) => Promise<void>) {
  const cdp = await page.context().newCDPSession(page);
  await run(async (type, x, y) => { await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: x!, y: y! }] }); });
  await cdp.detach();
}
async function doubleTap(page: Page, el: Locator, gap = 90) {
  const b = (await el.boundingBox())!;
  const x = Math.round(b.x + b.width / 2), y = Math.round(b.y + b.height / 2);
  await touches(page, async (send) => { await send('touchStart', x, y); await send('touchEnd'); await page.waitForTimeout(gap); await send('touchStart', x, y); await send('touchEnd'); });
}
async function swipe(page: Page, el: Locator, dx: number, dy = 0) {
  const b = (await el.boundingBox())!;
  const y = Math.round(b.y + b.height / 2), x0 = Math.round(dx < 0 ? b.x + b.width - 10 : b.x + 10);
  const steps = Math.max(2, Math.round(Math.max(Math.abs(dx), Math.abs(dy)) / 10));
  await touches(page, async (send) => {
    await send('touchStart', x0, y);
    for (let i = 1; i <= steps; i++) { await send('touchMove', x0 + (dx * i) / steps, y + (dy * i) / steps); await page.waitForTimeout(16); }
    await page.waitForTimeout(120);
    await send('touchEnd');
  });
}
const firstRow = (page: Page) => page.locator('.feed > .row[data-trade]').first();

test('F-2 PR-4: double tap likes once, privately and quietly; again unlikes; a vertical swipe or a single tap never likes; the likes list shows it and Remove ends it; no event request', async ({ browser }) => {
  test.setTimeout(120_000);
  const release = await feedLock('shared');
  const me = handle();
  const { ctx, page, events } = await touchPage(browser);
  try {
    await signIn(page, me);
    await page.goto('/');
    const row = firstRow(page);
    await expect(row.locator('.card .more-menu summary')).toBeVisible();
    const body = row.locator('.card .hero .ret');
    // One tap, then a slow second one: no like.
    await doubleTap(page, body, 450);
    await page.waitForTimeout(300);
    expect(await count('trade_likes', me)).toBe(0);
    // A vertical swipe across the card: it scrolls, never likes.
    await swipe(page, row.locator('.card'), 0, -120);
    await swipe(page, row.locator('.card'), 0, -120);
    await page.waitForTimeout(400);
    expect(await count('trade_likes', me)).toBe(0);
    await page.locator('main.feed').evaluate((f) => f.scrollTo({ top: 0 }));
    await page.waitForTimeout(300);
    // The double tap: one like, the button pressed, a quiet mark, a polite line; no count anywhere on the page.
    const t0 = Date.now();
    await doubleTap(page, body);
    await expect(row.locator('.like-mark')).toBeVisible();
    const feedbackMs = Date.now() - t0;
    console.log(`# double tap to the liked state: ${feedbackMs} ms (includes the test driver's round trips)`);
    await expect(row.locator('[data-like]')).toHaveAttribute('aria-pressed', 'true');
    await expect(row.locator('.card-menu [role="status"]')).toHaveText('Liked. Only you can see likes.');
    await expect.poll(() => count('trade_likes', me)).toBe(1);
    expect(await row.locator('.card').evaluate((c) => getComputedStyle(c).animationName + getComputedStyle(c.querySelector('.like-mark')!).animationName)).toBe('nonenone');
    await expect(page.locator('body')).not.toContainText(/\d+ likes?\b/i);
    await shoot(page, 'like-state-375');
    await row.locator('.card .more-menu summary').tap();
    await shoot(page, 'card-menu-375');
    await page.keyboard.press('Escape');
    // Again: unliked.
    await doubleTap(page, body);
    await expect(row.locator('.like-mark')).toHaveCount(0);
    await expect.poll(() => count('trade_likes', me)).toBe(0);
    await doubleTap(page, body);
    await expect.poll(() => count('trade_likes', me)).toBe(1);
    // The likes list (signed in only, the viewer's own), then Remove.
    await page.goto('/me/likes');
    await expect(page.getByRole('heading', { name: 'Liked trades', level: 1 })).toBeVisible();
    await expect(page.locator('.likes li')).toHaveCount(1);
    await shoot(page, 'likes-list-375');
    await page.getByRole('button', { name: /^Remove like on / }).tap();
    await expect(page.locator('.likes li')).toHaveCount(0);
    expect(await count('trade_likes', me)).toBe(0);
    await expect(page.getByText('You haven’t liked a trade yet.', { exact: false })).toBeVisible();
    expect(events).toEqual([]);
  } finally {
    await ctx.close(); await removeUser(me); await release();
  }
});

test('F-2 PR-4: on a feed card the reject swipe hides that trade (one row) with Undo; a short one snaps back; the opening swipe still opens the pane and writes nothing; right after the pane closes the reject swipe never commits', async ({ browser }) => {
  test.setTimeout(120_000);
  const release = await feedLock('shared');
  const me = handle();
  const { ctx, page, events } = await touchPage(browser);
  try {
    await signIn(page, me);
    await page.goto('/');
    await expect(page.locator('.feed .pane .chart-hit').first()).toBeAttached();
    const row = firstRow(page);
    const id = await row.getAttribute('data-trade');
    const card = row.locator('.card');
    const w = await card.evaluate((c) => c.clientWidth);
    // The opening swipe: the pane (SW-1), no exclusion of any kind.
    await swipe(page, card, -300);
    await expect.poll(() => row.evaluate((el) => el.scrollLeft)).toBeGreaterThan(300);
    // Back, then at once the reject swipe (from the card's place on screen): within 400 ms of the close, it never commits.
    await swipe(page, row.locator('.pane'), 300);
    await swipe(page, row, Math.round(w * 0.6));
    await expect.poll(() => row.evaluate((el) => el.scrollLeft)).toBe(0);
    await page.waitForTimeout(500);
    expect(await count('trade_exclusions', me)).toBe(0);
    await expect(row).toBeVisible();
    await page.waitForTimeout(500);
    // A short swipe (30% of the card) snaps back.
    await swipe(page, card, Math.round(w * 0.3));
    await page.waitForTimeout(400);
    expect(await count('trade_exclusions', me)).toBe(0);
    expect(await card.evaluate((c) => (c as HTMLElement).style.transform)).toBe('');
    // Past half the card: that trade is hidden (one row), only that card leaves; Undo brings it back.
    await swipe(page, card, Math.round(w * 0.6));
    await expect(row).toBeHidden();
    await expect(page.locator('.hide-bar')).toContainText('Trade hidden.');
    await expect.poll(() => count('trade_exclusions', me)).toBe(1);
    expect(await count('trade_likes', me)).toBe(0);
    await shoot(page, 'reject-undo-375');
    await page.locator('.hide-bar').getByRole('button', { name: 'Undo' }).tap();
    await expect(page.locator(`.feed > .row[data-trade="${id}"]`)).toBeVisible();
    await expect.poll(() => count('trade_exclusions', me)).toBe(0);
    // Swiped again and left: after a reload the trade stays out of this viewer's feed.
    await swipe(page, card, Math.round(w * 0.6));
    await expect.poll(() => count('trade_exclusions', me)).toBe(1);
    await page.waitForTimeout(5_500);
    await page.reload();
    await expect(page.locator(`.feed > .row[data-trade="${id}"]`)).toHaveCount(0);
    expect(events).toEqual([]);
  } finally {
    await ctx.close(); await removeUser(me); await release();
  }
});

test('F-2 PR-4: the keyboard route: the card\'s "…" menu has Like (aria-pressed, 44 px) and "Hide this trade"; signed out a double tap shows one sign-in line and the card has no menu; no event request', async ({ browser }) => {
  test.setTimeout(120_000);
  const release = await feedLock('shared');
  const me = handle();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const events = watchEvents(ctx);
  const page = await ctx.newPage();
  try {
    // Signed out first.
    const t = await touchPage(browser);
    await t.page.goto('/');
    const out = firstRow(t.page);
    await expect(out.locator('.more-menu')).toHaveCount(0);
    await doubleTap(t.page, out.locator('.card .hero .ret'));
    await expect(t.page.locator('.signin-line')).toContainText('Sign in to like trades.');
    await shoot(t.page, 'signed-out-signin-line-375');
    expect(t.events).toEqual([]);
    await t.ctx.close();
    await signIn(page, me);
    await page.goto('/');
    const row = firstRow(page);
    const summary = row.locator('.card .more-menu summary');
    await summary.focus();
    await page.keyboard.press('Enter');
    const likeBtn = row.locator('[data-like]');
    await expect(likeBtn).toBeVisible();
    expect((await likeBtn.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    expect((await summary.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await expect(likeBtn).toHaveAccessibleName(/^Like\. Only you can see likes\.$/);
    await likeBtn.focus();
    await page.keyboard.press('Enter');
    await expect(likeBtn).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => count('trade_likes', me)).toBe(1);
    await shoot(page, 'like-state-1280');
    await page.keyboard.press('Enter');
    await expect(likeBtn).toHaveAttribute('aria-pressed', 'false');
    await expect.poll(() => count('trade_likes', me)).toBe(0);
    await row.getByRole('button', { name: 'Hide this trade' }).focus();
    await page.keyboard.press('Enter');
    await expect(row).toBeHidden();
    await expect(page.locator('.hide-bar').getByRole('button', { name: 'Undo' })).toBeFocused();
    await expect.poll(() => count('trade_exclusions', me)).toBe(1);
    await shoot(page, 'reject-undo-1280');
    await page.keyboard.press('Enter');
    await expect(row).toBeVisible();
    await expect.poll(() => count('trade_exclusions', me)).toBe(0);
    expect(events).toEqual([]);
  } finally {
    await ctx.close(); await removeUser(me); await release();
  }
});

test('F-2 PR-4: without JavaScript the card\'s menu posts Like and lands on the likes list; Remove works there too', async ({ browser }) => {
  test.setTimeout(90_000);
  const release = await feedLock('shared');
  const me = handle();
  const ctx = await browser.newContext({ viewport: { width: 375, height: 800 }, javaScriptEnabled: false });
  const page = await ctx.newPage();
  try {
    await page.goto('/login/dev');
    await page.getByLabel('Handle').fill(me);
    await page.getByLabel('I am 18 or older').check();
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.goto('/');
    const row = firstRow(page);
    await row.locator('.card .more-menu summary').click();
    await row.locator('[data-like]').click();
    await expect(page).toHaveURL(/\/me\/likes$/);
    await expect(page.locator('.likes li')).toHaveCount(1);
    expect(await count('trade_likes', me)).toBe(1);
    await shoot(page, 'likes-list-nojs-375');
    await page.getByRole('button', { name: /^Remove like on / }).click();
    await expect(page.locator('.likes li')).toHaveCount(0);
    expect(await count('trade_likes', me)).toBe(0);
  } finally {
    await ctx.close(); await removeUser(me); await release();
  }
});

// F-2 PR-4 fix round 1: a hidden trade is never also liked (Undo restores the like); the menu reads "Liked" when liked;
// the toast says the hide is permanent; on touch the Undo bar times out; no-JS hide confirms; the likes list wraps at 320.
const FIX1 = 'docs/features/logs/F-2/screenshots/pr4-fix1';
const shoot1 = async (page: Page, name: string) => {
  for (const colorScheme of ['light', 'dark'] as const) { await page.emulateMedia({ colorScheme }); await page.screenshot({ path: `${FIX1}/${name}-${colorScheme}.png` }); }
  await page.emulateMedia({ colorScheme: 'light' });
};
test('F-2 PR-4 fix round 1: hiding a liked trade removes the like and Undo restores it; the menu reads "Liked" when liked; the toast says it is for good', async ({ browser }) => {
  test.setTimeout(120_000);
  const release = await feedLock('shared');
  const me = handle();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  try {
    await signIn(page, me);
    await page.goto('/');
    const row = firstRow(page);
    const summary = row.locator('.card .more-menu summary');
    await summary.focus();
    await page.keyboard.press('Enter');
    const likeBtn = row.locator('[data-like]');
    await expect(likeBtn).toHaveText(/♡\s*Like$/);
    await likeBtn.focus();
    await page.keyboard.press('Enter');
    await expect(likeBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(likeBtn).toHaveText(/♥\s*Liked$/);
    await expect(likeBtn).toHaveAccessibleName(/^Like\. Only you can see likes\.$/);
    await expect.poll(() => count('trade_likes', me)).toBe(1);
    await shoot1(page, 'liked-menu-1280');
    await row.getByRole('button', { name: 'Hide this trade' }).focus();
    await page.keyboard.press('Enter');
    await expect(row).toBeHidden();
    await expect(page.locator('.hide-bar')).toContainText('Trade hidden. You won’t see it again.');
    await expect.poll(() => count('trade_exclusions', me)).toBe(1);
    await expect.poll(() => count('trade_likes', me)).toBe(0);
    await shoot1(page, 'hide-toast-1280');
    await page.keyboard.press('Enter'); // Undo has focus
    await expect(row).toBeVisible();
    await expect.poll(() => count('trade_exclusions', me)).toBe(0);
    await expect.poll(() => count('trade_likes', me)).toBe(1);
    await expect(likeBtn).toHaveAttribute('aria-pressed', 'true');
    // Hidden for good: the likes list is empty.
    await summary.click();
    await row.getByRole('button', { name: 'Hide this trade' }).click();
    await expect.poll(() => count('trade_likes', me)).toBe(0);
    await page.waitForTimeout(5_500);
    await page.goto('/me/likes');
    await expect(page.locator('.likes li')).toHaveCount(0);
  } finally {
    await ctx.close(); await removeUser(me); await release();
  }
});

test('F-2 PR-4 fix round 1: on touch the Undo bar times out after the reject swipe; without JavaScript a hide shows a line; the likes list date is whole at 320; the signed-out close is quiet', async ({ browser }) => {
  test.setTimeout(120_000);
  const release = await feedLock('shared');
  const me = handle(), me2 = handle();
  const { ctx, page } = await touchPage(browser);
  const nojs = await browser.newContext({ viewport: { width: 320, height: 700 }, javaScriptEnabled: false });
  try {
    await signIn(page, me);
    await page.goto('/');
    const row = firstRow(page);
    const card = row.locator('.card');
    const w = await card.evaluate((c) => c.clientWidth);
    await page.waitForTimeout(500);
    await swipe(page, card, Math.round(w * 0.6));
    await expect(page.locator('.hide-bar')).toContainText('Trade hidden.');
    await expect(page.locator('.hide-bar').getByRole('button', { name: 'Undo' })).toBeFocused();
    await page.waitForTimeout(6_000);
    await expect(page.locator('.hide-bar p')).toHaveCount(0);
    // Without JavaScript, at 320: hide, then a line; like, then the likes list with its date whole.
    const p2 = await nojs.newPage();
    await p2.goto('/login/dev');
    await p2.getByLabel('Handle').fill(me2);
    await p2.getByLabel('I am 18 or older').check();
    await p2.getByRole('button', { name: 'Continue' }).click();
    await p2.goto('/');
    await firstRow(p2).locator('.card .more-menu summary').click();
    await firstRow(p2).getByRole('button', { name: 'Hide this trade' }).click();
    await expect(p2).toHaveURL(/\/\?done=trade-hidden$/);
    await expect(p2.locator('.nojs-done')).toHaveText('Trade hidden. You won’t see it again.');
    expect(await count('trade_exclusions', me2)).toBe(1);
    await shoot1(p2, 'nojs-hide-line-320');
    await firstRow(p2).locator('.card .more-menu summary').click();
    await firstRow(p2).locator('[data-like]').click();
    await expect(p2).toHaveURL(/\/me\/likes$/);
    const link = p2.locator('.likes .who-col a').first();
    await expect(link).toHaveText(/, closed \w{3} \d{1,2}, \d{4}$/);
    expect(await link.evaluate((a) => a.scrollWidth <= a.clientWidth + 1)).toBe(true);
    await shoot1(p2, 'likes-320');
    // Signed out at 320: the line's close is a quiet × (no filled background), still 44 px.
    const out = await browser.newContext({ viewport: { width: 320, height: 700 }, hasTouch: true, isMobile: true });
    const p3 = await out.newPage();
    await p3.goto('/');
    await doubleTap(p3, firstRow(p3).locator('.card .hero .ret'));
    const x = p3.locator('.signin-line button');
    await expect(x).toBeVisible();
    expect(await x.evaluate((b) => getComputedStyle(b).backgroundColor)).toBe('rgba(0, 0, 0, 0)');
    expect((await x.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await shoot1(p3, 'signedout-line-320');
    await out.close();
  } finally {
    await ctx.close(); await nojs.close(); await removeUser(me); await removeUser(me2); await release();
  }
});
