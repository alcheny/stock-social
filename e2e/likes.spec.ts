// F-2 PR-4: likes and the feed card's reject swipe, against the real app (needs `npm run db:seed`), at 375 px with touch.
// Double tap likes once (private: no count anywhere, only the viewer's own list); the heart is the keyboard route; the
// reject swipe (owner decision O1) hides that one trade with "Trade hidden for 90 days." and Undo, armed only at rest;
// the opening swipe still opens the pane (SW-1) and writes nothing; no event endpoint is ever called. Screenshots in
// docs/features/logs/F-2/screenshots/pr4/ (fix round 1: pr4-fix1/).
// Fix round 1: signed in only (no heart signed out); "Hide this trade" in the card's "…"; Undo after a swipe lasts 5 s
// (on the card and on a section row) and pauses only under the keyboard; Unlike keeps focus on the page.
import { expect, test, type Browser, type Page } from '@playwright/test';
import postgres from 'postgres';
import { feedLock } from './feed-lock.ts';

const SHOTS = 'docs/features/logs/F-2/screenshots/pr4-fix1';
const HOLDS = [0.5, 3, 14, 60, 300];
const DAY = 86_400_000;
const sql = postgres(process.env.DATABASE_URL!, { max: 2, onnotice: () => {} });
test.afterAll(async () => { await sql.end({ timeout: 1 }); });

const shoot = async (page: Page, name: string) => {
  for (const colorScheme of ['light', 'dark'] as const) { await page.emulateMedia({ colorScheme }); await page.screenshot({ path: `${SHOTS}/${name}-${colorScheme}.png` }); }
  await page.emulateMedia({ colorScheme: 'light' });
};
// 40 traders × 5 fresh closes (so the fixture fills the first page), accounts 60 days old, varied holding periods (so
// page 1 has a section); trader 0 has a 20-character handle.
async function fixture() {
  const tag = `p4${Math.random().toString(36).slice(2, 6)}`;
  const ids: number[] = [];
  const at = Date.now() - 600_000;
  for (let t = 0; t < 40; t++) {
    const [u] = await sql`with a as (insert into signup_attempts (method, adult_attested_at) values ('dev', now()) returning id)
      insert into users (handle, display_name, adult_attested_at, signup_attempt_id, created_at) select ${t ? `${tag}_${t}` : `${tag}_long_handle_xx`.slice(0, 20)}, ${`Card Trader ${t}`}, now(), a.id, now() - interval '60 days' from a returning id`;
    ids.push(u.id as number);
    await sql`insert into closed_trades ${sql(Array.from({ length: 5 }, (_, i) => ({
      user_id: u.id, sell_id: `${tag}-${t}-${i}`, account_id: 'a', symbol: `Y${String.fromCharCode(65 + (t % 26))}${String.fromCharCode(65 + ((t * 5 + i) % 26))}${i}`,
      opened_at: new Date(at - (t * 5 + i) * 20_000 - HOLDS[t % 5] * DAY), closed_at: new Date(at - (t * 5 + i) * 20_000),
      return_pct: (i + t) % 3 ? 0.2 + ((t * 7 + i) % 10) / 40 : -0.2 - ((t + i) % 5) / 40, holding_days: HOLDS[t % 5], verified: true,
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

const heartOf = (row: Loc) => row.getByRole('button', { name: /^Like .* Only you can see likes\.$/ });
const bar = (page: Page) => page.locator('.hide-bar');
// Undo's 5 s: the bar is open at 4.8 s after `t0` and gone by 5.8 s (fix round 1: never paused by a touch's focus).
async function closesInFive(page: Page, t0: number) {
  await expect(bar(page).getByRole('button', { name: 'Undo' })).toBeFocused();
  expect(await bar(page).getByRole('button', { name: 'Undo' }).evaluate((el) => getComputedStyle(el).outlineStyle)).toBe('none'); // no ring after a touch
  await page.waitForTimeout(Math.max(0, t0 + 4_800 - Date.now()));
  await expect(bar(page).getByRole('button', { name: 'Undo' })).toBeVisible();
  await page.waitForTimeout(Math.max(0, t0 + 5_800 - Date.now()));
  await expect(bar(page)).toHaveText('');
}

test('F-2 PR-4: double tap likes once and privately; a vertical swipe never likes; the heart is the keyboard route (aria-pressed, 44 px, no count) and never shows empty before filled; likes are listed on /me/following only, where Unlike keeps focus and says so', async ({ browser }) => {
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
    const heart = heartOf(row);
    await expect(heart).toHaveAttribute('data-ready', '');
    await expect(heart).toHaveAttribute('aria-pressed', 'false');
    const box = (await heart.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect((await heart.textContent())!.trim()).toBe(''); // an icon, never a count
    // Business lead D1: one footer line at 375 (the link, the heart, "…").
    expect(await row.locator('.card footer').evaluate((el) => el.clientHeight)).toBeLessThanOrEqual(46);
    const link = row.locator('.card footer > a');
    expect(await link.evaluate((el) => el.getClientRects().length === 1 && el.getBoundingClientRect().height < 30)).toBe(true); // the link on one line
    await shoot(page, 'card-footer-375');
    // A vertical swipe on the card scrolls the feed; it never likes.
    await swipe(page, row.locator('.hero'), 0, -250);
    await page.waitForTimeout(400);
    expect(await likes(me)).toBe(0);
    await page.locator('main.feed').evaluate((el) => { el.scrollTop = 0; });
    await page.waitForTimeout(300);
    // Two taps 400 ms apart: no like. A double tap (90 ms): one like, filled; a second one never unlikes.
    await doubleTap(page, row.locator('.ret'), 400);
    await page.waitForTimeout(400);
    expect(await likes(me)).toBe(0);
    await doubleTap(page, row.locator('.ret'));
    await expect(heart).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => likes(me)).toBe(1);
    await doubleTap(page, row.locator('.ret'));
    await page.waitForTimeout(500);
    expect(await likes(me)).toBe(1);
    await expect(heart).toHaveAttribute('aria-pressed', 'true');
    // Keyboard: Enter on the heart unlikes, Space likes again.
    await heart.focus();
    await page.keyboard.press('Enter');
    await expect(heart).toHaveAttribute('aria-pressed', 'false');
    await expect.poll(() => likes(me)).toBe(0);
    await page.keyboard.press('Space');
    await expect(heart).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => likes(me)).toBe(1);
    // UX D4: with the liked-state read 700 ms slow, the liked heart is invisible until it is known, then filled: never ♡ first.
    await page.route('**/me/liked**', async (r) => { await new Promise((ok) => setTimeout(ok, 700)); await r.continue(); });
    await page.reload();
    const again = heartOf(page.locator('.feed > .row').first());
    const seen: string[] = [];
    for (let i = 0; i < 20; i++) {
      seen.push(await again.evaluate((el) => (getComputedStyle(el).visibility === 'hidden' ? 'hidden' : el.getAttribute('aria-pressed')!)).catch(() => 'none'));
      await page.waitForTimeout(60);
    }
    expect(seen.filter((x) => x !== 'none' && x !== 'hidden').every((x) => x === 'true')).toBe(true);
    await expect(again).toHaveAttribute('aria-pressed', 'true');
    await expect(again).toHaveAttribute('data-ready', '');
    await page.unroute('**/me/liked**');
    // Nothing public shows it.
    const handle = (await row.getAttribute('data-handle'))!;
    expect(await (await page.request.get(`/u/${handle}`)).text()).not.toMatch(/\blikes?\b|data-like/i);
    // /me/following: a second like (trader 0, a 20-character handle) so the list has two rows; nothing is clipped.
    await sql`insert into trade_likes (viewer_id, trade_key, trader_id) select v.id, t.trade_key, t.user_id from users v, closed_trades t
      where v.handle = ${me} and t.user_id = ${fx.ids[0]} order by t.closed_at desc limit 1`;
    await page.goto('/me/following');
    await expect(page.getByRole('heading', { name: 'Liked records' })).toBeVisible();
    const items = page.locator('#liked ~ ul li');
    await expect(items).toHaveCount(2);
    await expect(items.first()).toContainText(fx.tag); // the newest like first: trader 0's long handle, whole
    for (const a of await items.locator('a').all()) expect(await a.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    await expect(page.getByText('Only you can see likes.')).toHaveCount(0); // D3: the page's own privacy line says it once
    await shoot(page, 'liked-list-375');
    // UX demand 2: Unlike by keyboard moves focus to the next row's Unlike, then (last row) to the heading; never the body.
    await items.first().getByRole('button', { name: /^Unlike / }).focus();
    await page.keyboard.press('Enter');
    await expect(items).toHaveCount(1);
    await expect(items.first().getByRole('button', { name: /^Unlike / })).toBeFocused();
    await expect(page.locator('[role="status"]', { hasText: /^Unliked .* by @/ })).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(page.getByText('No liked records yet.', { exact: false })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Liked records' })).toBeFocused();
    await expect(page.locator('[role="status"]', { hasText: `by @${handle}.` })).toBeVisible();
    await shoot(page, 'liked-list-after-unlike-375');
    expect(await likes(me)).toBe(0);
    expect(events).toEqual([]);
  } finally {
    await ctx.close();
    await sql`delete from users where handle = ${me}`;
    await fx.remove();
    await release();
  }
});

test('F-2 PR-4: the reject swipe hides that trade only, with "Trade hidden for 90 days." and Undo for 5 s; the next card\'s controls stay reachable; a short drag snaps back; the opening swipe still opens the pane; right after the pane closes it never commits; "Hide this trade" in the card\'s "…" is its button (keyboard pauses the bar; a double tap never undoes)', async ({ browser }) => {
  test.setTimeout(240_000);
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
    // Straight back from the pane, then at once the reject direction again: never a reject.
    await swipe(page, row.locator('.pane'), 300);
    await swipe(page, card, Math.round(w * 0.6));
    await expect.poll(() => row.evaluate((el) => el.scrollLeft)).toBe(0);
    await page.waitForTimeout(400);
    expect(await rejects(me)).toBe(0);
    await expect(row).toBeVisible();
    await page.waitForTimeout(500);
    // A short drag (40% of the card) snaps back; under half the tray is not marked.
    const lift40 = await swipe(page, card, Math.round(w * 0.4), 0, true);
    await expect(row).not.toHaveClass(/\bpast\b/);
    await lift40();
    await expect.poll(() => card.evaluate((el) => el.style.transform)).toBe('');
    await page.waitForTimeout(300);
    expect(await rejects(me)).toBe(0);
    // Mid-drag past half: the tray's label is whole and marked (UX/BL follow-up: the commit point).
    const lift = await swipe(page, card, Math.round(w * 0.6), 0, true);
    await expect(row.locator('.ctray')).toBeVisible();
    await expect(row.locator('.ctray')).toHaveText('Hide this trade');
    await expect(row).toHaveClass(/\bpast\b/);
    const [l, r] = await row.locator('.ctray span').evaluate((el) => { const b = el.getBoundingClientRect(); return [b.left, b.right]; });
    expect(l).toBeGreaterThanOrEqual(0);
    expect(r).toBeLessThanOrEqual(Math.round(w * 0.6) + 12);
    await shoot(page, 'reject-mid-drag-375');
    const handle = (await row.getAttribute('data-handle'))!, key = (await row.getAttribute('data-key'))!;
    await lift();
    const t0 = Date.now();
    // Released past half: that trade is hidden; the bar says so; the trader's other cards stay.
    await expect(page.locator(`.feed > .row[data-key="${key}"]`)).toBeHidden();
    await expect.poll(() => rejects(me)).toBe(1);
    await expect(bar(page)).toContainText('Trade hidden for 90 days.');
    expect(await page.locator(`.feed > .row[data-handle="${handle}"]:not([data-key="${key}"])`).evaluateAll((rs) => rs.every((x) => getComputedStyle(x).display !== 'none'))).toBe(true);
    // Tester Medium 1: the next card's heart and "…" are above the bar, not under it.
    const next = page.locator('.feed > .row:visible').first();
    for (const c of [heartOf(next), next.locator('.card .more-menu summary')]) {
      const b = (await c.boundingBox())!;
      expect(await page.evaluate(([x, y]) => !!document.elementFromPoint(x, y)?.closest('.hide-bar'), [b.x + b.width / 2, b.y + b.height / 2])).toBe(false);
    }
    await shoot(page, 'reject-bar-375');
    // UX D1 / tester High 1: the bar closes at 5 s, with no ring on Undo; focus lands on the next card's name.
    await closesInFive(page, t0);
    await expect(page.locator('.feed .card .who:focus')).toHaveCount(1);
    await sql`update trade_rejects set until = now() from users u where u.id = trade_rejects.viewer_id and u.handle = ${me}`;
    // "Hide this trade" in the card's "…", by keyboard: Undo takes focus and the bar waits while it has it; Undo returns
    // focus to "…".
    const key2 = (await next.getAttribute('data-key'))!, row2 = page.locator(`.feed > .row[data-key="${key2}"]`);
    const summary = row2.locator('.card .more-menu summary');
    await expect(summary).toHaveAccessibleName(/^More for .* by @/);
    expect((await summary.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await summary.focus();
    await page.keyboard.press('Enter');
    await expect(row2.getByRole('button', { name: 'Hide this trade' })).toBeVisible();
    await shoot(page, 'card-menu-375');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    await expect(row2).toBeHidden();
    await expect.poll(() => rejects(me)).toBe(1);
    const undo = bar(page).getByRole('button', { name: 'Undo' });
    await expect(undo).toBeFocused();
    await page.waitForTimeout(5_800);
    await expect(undo).toBeFocused(); // paused under the keyboard (WCAG 2.2.1)
    await page.keyboard.press('Enter');
    await expect(row2).toBeVisible();
    await expect(summary).toBeFocused();
    await expect.poll(() => rejects(me)).toBe(0);
    // Tester Medium 1: a double tap on "Hide this trade" hides once and never undoes; a second hide right after keeps both.
    await summary.tap();
    const item = row2.getByRole('button', { name: 'Hide this trade' });
    const ib = (await item.boundingBox())!;
    await page.touchscreen.tap(ib.x + ib.width / 2, ib.y + ib.height / 2);
    await page.waitForTimeout(120);
    await page.touchscreen.tap(ib.x + ib.width / 2, ib.y + ib.height / 2);
    await page.waitForTimeout(600);
    await expect(page.locator(`.feed > .row[data-key="${key2}"]`)).toBeHidden();
    expect(await rejects(me)).toBe(1);
    const key3 = (await page.locator('.feed > .row:visible').first().getAttribute('data-key'))!, row3 = page.locator(`.feed > .row[data-key="${key3}"]`);
    await row3.locator('.card .more-menu summary').tap();
    await row3.getByRole('button', { name: 'Hide this trade' }).tap();
    await expect.poll(() => rejects(me)).toBe(2);
    await expect(page.locator(`.feed > .row[data-key="${key2}"]`)).toBeHidden();
    // A rejected trade stays out of the next page 1.
    await page.goto('/');
    await expect(page.locator('.feed > .row').first()).toBeVisible();
    await expect(page.locator(`.feed > .row[data-key="${key2}"]`)).toHaveCount(0);
    expect(events).toEqual([]);
  } finally {
    await ctx.close();
    await sql`delete from users where handle = ${me}`;
    await fx.remove();
    await release();
  }
});

test('F-2 PR-4 fix round 1: the section-row reject swipe (PR-3) also gets its 5 s: the bar closes on time with no ring on Undo', async ({ browser }) => {
  test.setTimeout(120_000);
  const release = await feedLock('exclusive');
  const fx = await fixture();
  const me = `p4s${Math.random().toString(36).slice(2, 7)}`;
  const { ctx, page } = await touchPage(browser);
  try {
    await signIn(page, me);
    await page.goto('/');
    await expect(page.locator('.feed .pane .chart-hit').first()).toBeAttached();
    const s = page.locator('.feed > .suggest').first();
    await s.evaluate((el) => el.scrollIntoView());
    const srow = s.locator('.suggest-in > ul > li').first().locator('.srow');
    await expect(s.locator('.stray').first()).toBeAttached();
    const cardW = await s.locator('.srow-wrap').first().evaluate((el) => el.clientWidth);
    await page.waitForTimeout(500);
    await swipe(page, srow, Math.round(cardW * 0.55));
    const t0 = Date.now();
    await expect(bar(page)).toContainText('Hidden for 90 days.');
    await closesInFive(page, t0);
  } finally {
    await ctx.close();
    await sql`delete from users where handle = ${me}`;
    await fx.remove();
    await release();
  }
});

test('F-2 PR-4: signed out there is no heart, no "…", no tray (business lead D2, as Follow); a double tap or a swipe writes nothing; the liked-state read returns nothing; the footer has the same height as signed in', async ({ browser }) => {
  const release = await feedLock('shared');
  const { ctx, page } = await touchPage(browser);
  const writes: string[] = [];
  page.on('request', (r) => { if (r.method() !== 'GET') writes.push(r.url()); });
  try {
    await page.goto('/');
    await expect(page.locator('.feed .pane .chart-hit').first()).toBeAttached();
    const row = page.locator('.feed > .row').first();
    await expect(page.locator('.feed [data-like], .feed .card .more-menu, .feed .ctray, .like-signin')).toHaveCount(0);
    const h = await row.locator('.card footer').evaluate((el) => el.clientHeight);
    expect(h).toBeGreaterThanOrEqual(44);
    expect(h).toBeLessThanOrEqual(46);
    await shoot(page, 'signed-out-card-375');
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
