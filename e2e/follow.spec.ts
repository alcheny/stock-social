// F-2 PR-2: follow and "Not interested" against the real app (needs `npm run db:seed`). Private to the viewer: no count
// or list on any public page, card, share image or route. Screenshots in docs/features/logs/F-2/screenshots/pr2/.
import { expect, test, type Page } from '@playwright/test';

const SHOTS = 'docs/features/logs/F-2/screenshots/pr2-fix1'; // fix round 1 (the build's own shots stay in pr2/)
const db = async () => (await import('../lib/db.ts')).sql;
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
const shown = (page: Page) => page.locator('.feed > .row').evaluateAll((rows) => rows.filter((r) => (r as HTMLElement).offsetParent).map((r) => ({ trade: r.getAttribute('data-trade')!, handle: r.getAttribute('data-handle')! })));
const rowsOf = (sql: Awaited<ReturnType<typeof db>>, handle: string) => sql`select
  (select count(*) from follows f join users u on u.id = f.viewer_id where u.handle = ${handle})::int as follows,
  (select count(*) from viewer_exclusions x join users u on u.id = x.viewer_id where u.handle = ${handle})::int as exclusions`.then((r) => r[0]);

// F-2 PR-4 fix round 1 (tester Note 3): this test expects the demo traders on page 1, so it holds the feed lock (shared)
// and waits while a heavy fixture fills the feed; released after the test, pass or fail.
let held: (() => Promise<void>) | null = null;
test.afterEach(async () => { await held?.(); held = null; });
test('F-2 PR-2: follow and unfollow from the profile and the pane, keyboard only; the first follow says only you can see it; /me/following reached by tapping; signed out there is no control; no public page or route shows follow data; deletion leaves zero rows', async ({ page, browser, request }) => {
  held = await (await import('./feed-lock.ts')).feedLock('shared');
  test.setTimeout(180_000);
  const sql = await db();
  const me = `f2v${Math.random().toString(36).slice(2, 8)}`;
  const publicBodies = async () => Promise.all(['/', '/u/momentum_maya', '/u/momentum_maya/pane-chart', '/u/momentum_maya/opengraph-image', '/u/momentum_maya/story?format=square']
    .map(async (p) => { const r = await request.get(p); expect(r.status(), p).toBe(200); return r.body(); }));
  const before = await publicBodies();
  await page.setViewportSize({ width: 375, height: 800 });
  await signIn(page, me);
  await expect(page.locator('.profile-follow')).toHaveCount(0); // never on your own profile
  await page.goto('/u/momentum_maya');
  const btn = page.locator('.profile-follow button.follow');
  await expect(btn).toHaveText('Follow');
  await expect(btn).toHaveAttribute('aria-pressed', 'false');
  expect((await btn.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await btn.focus();
  await page.keyboard.press('Enter');
  await expect(btn).toHaveAttribute('aria-pressed', 'true');
  await expect(btn).toHaveText('Following');
  await expect(page.locator('.profile-follow .follow-status[aria-live="polite"]')).toHaveText('Following @momentum_maya. Only you can see this.');
  await shoot(page, 'profile-first-follow-375');
  await expect.poll(async () => (await rowsOf(sql, me)).follows).toBe(1);
  await page.reload();
  await expect(page.locator('.profile-follow button.follow')).toHaveAttribute('aria-pressed', 'true');
  await page.setViewportSize({ width: 1280, height: 800 });
  await shoot(page, 'profile-following-1280');
  await page.setViewportSize({ width: 375, height: 800 });

  // The pane: Follow, then unfollow. Fix round 1: unfollow hides nothing from the feed and says nothing ("Follow"
  // coming back is the feedback; tapping it again is the undo). The status region is always in the tree.
  await page.goto('/');
  const row = page.locator('.feed > .row[data-handle="dividend_dan"]').first();
  await row.evaluate((el) => el.scrollIntoView());
  await expect.poll(async () => { await page.keyboard.press('ArrowRight'); return row.evaluate((el) => el.scrollLeft); }).toBeGreaterThan(300);
  const paneBtn = row.locator('.pane .pane-actions button.follow');
  // The header spacing fix: the name and the handle no longer touch ("Name@handle").
  const [name, handle] = await row.locator('.pane header .who').evaluate((el) => [...el.children].map((c) => c.getBoundingClientRect()));
  expect(handle.left - name.right).toBeGreaterThanOrEqual(4);
  await expect(row.locator('.pane .follow-status[aria-live="polite"]')).toHaveCount(1); // registered before it speaks
  await paneBtn.focus();
  await page.keyboard.press('Enter');
  await expect(paneBtn).toHaveAttribute('aria-pressed', 'true');
  await expect(row.locator('.pane .follow-status').first()).toHaveText(''); // not this viewer's first follow
  // Outline in both states, and the same width either way ("…" does not move under the finger).
  const look = () => paneBtn.evaluate((el) => { const c = getComputedStyle(el); return { bg: c.backgroundColor, w: Math.round(el.getBoundingClientRect().width) }; });
  const onLook = await look();
  await shoot(page, 'pane-following-375');
  const dans = async () => page.locator('.feed > .row[data-handle="dividend_dan"]').evaluateAll((rs) => rs.filter((r) => (r as HTMLElement).offsetParent).length);
  const dansBefore = await dans();
  // Tap to feedback < 100 ms: the toggle shows on the next frame, before the server answers (optimistic).
  const [ms, pressed] = await paneBtn.evaluate(async (el) => { const t = performance.now(); (el as HTMLElement).click(); await new Promise((r) => requestAnimationFrame(r)); return [performance.now() - t, el.getAttribute('aria-pressed')]; });
  console.log(`follow toggle feedback: ${Number(ms).toFixed(1)} ms`);
  expect(pressed).toBe('false');
  expect(Number(ms)).toBeLessThan(100);
  expect(await look()).toEqual(onLook);
  await expect.poll(async () => (await sql`select count(*)::int as n from viewer_exclusions x join users u on u.id = x.viewer_id where u.handle = ${me} and x.reason = 'unfollow' and x.until > now()`)[0].n).toBe(1);
  await expect(row.locator('.pane .follow-status')).toHaveText('');
  await expect(row.locator('.pane .follow-status button')).toHaveCount(0); // no Undo
  expect(await dans()).toBe(dansBefore); // the cards stay
  await page.goto('/');
  await expect.poll(async () => (await shown(page)).some((c) => c.handle === 'dividend_dan')).toBe(true); // and stay on the next page 1
  await shoot(page, 'pane-unfollowed-375');
  const row2 = page.locator('.feed > .row[data-handle="dividend_dan"]').first();
  await row2.evaluate((el) => el.scrollIntoView());
  await expect.poll(async () => { await page.keyboard.press('ArrowRight'); return row2.evaluate((el) => el.scrollLeft); }).toBeGreaterThan(300);
  await row2.locator('.pane .pane-actions button.follow').click(); // following again is the undo
  await expect(row2.locator('.pane .pane-actions button.follow')).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(async () => (await sql`select count(*)::int as n from viewer_exclusions x join users u on u.id = x.viewer_id where u.handle = ${me} and x.until > now()`)[0].n).toBe(0);

  // /me/following, reached by tapping only (business lead demand 2): @handle in the nav → Settings → the list.
  await page.locator('nav.top a.me').click();
  await expect(page).toHaveURL(new RegExp(`/u/${me}$`));
  await page.locator('main').getByRole('link', { name: 'Settings', exact: true }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
  await page.getByRole('link', { name: 'Following and hidden traders' }).click();
  await expect(page).toHaveURL(/\/me\/following$/);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Following and hidden traders');
  await expect(page.getByRole('heading', { level: 2, name: 'Following' })).toBeVisible();
  await expect(page.locator('.people li')).toHaveCount(2);
  await expect(page.getByText('No one is hidden.')).toBeVisible(); // the unfollow is not listed as "Not interested"
  await expect(page.getByText('Only you can see these lists. Traders are never told.')).toBeVisible();
  // One row shape: the control on one line, inside the screen.
  for (const b of await page.locator('.people li button.follow').all()) { const r = (await b.boundingBox())!; expect(r.height).toBeLessThan(50); expect(r.x + r.width).toBeLessThanOrEqual(375); }
  await shoot(page, 'me-following-375');

  // Nothing public changed: the same pages and images, byte for byte, and no follow wording or viewer handle anywhere.
  const afterBodies = await publicBodies();
  for (const i of [3, 4]) expect(afterBodies[i].equals(before[i]), 'share images unchanged').toBe(true);
  for (const b of afterBodies.slice(0, 3)) { const t = b.toString(); expect(t).not.toContain(me); expect(t).not.toMatch(/follower/i); }

  // Signed out (fix round 1, business lead demand 4): no follow control on the profile or in the pane, no "…".
  const anon = await (await browser.newContext({ viewport: { width: 375, height: 800 } })).newPage();
  await anon.goto('/u/momentum_maya');
  await expect(anon.locator('.profile-follow, .follow')).toHaveCount(0);
  await anon.goto('/');
  await expect(anon.locator('.feed .row').first()).toBeAttached();
  await expect(anon.locator('.feed .pane-actions, .feed .follow, .feed .more-menu')).toHaveCount(0);
  await anon.context().close();
  // Without JavaScript, signed in: the form follows and lands on the trader with a line saying so.
  const nojs = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 375, height: 800 }, storageState: await page.context().storageState() });
  const np = await nojs.newPage();
  await np.goto('/u/yolo_yuki');
  await np.locator('.profile-follow button.follow').click();
  await expect(np).toHaveURL(/\/u\/yolo_yuki\?done=follow/);
  await expect(np.locator('.profile-follow button.follow')).toHaveText('Following');
  await expect(np.locator('.profile-follow p[role="status"]', { hasText: 'Following @yolo_yuki.' })).toBeVisible();
  await shoot(np, 'nojs-profile-following-375');
  await np.goto('/u/momentum_maya?done=unfollow'); // a crafted link claims nothing: still following
  await expect(np.getByText('Unfollowed @momentum_maya.')).toHaveCount(0);
  await nojs.close();
  expect((await rowsOf(sql, me)).follows).toBe(3);

  // Deletion via /settings: both tables hold nothing for this account the same moment.
  await sql`insert into viewer_exclusions (viewer_id, trader_id, until, reason) select v.id, t.id, now() + interval '90 days', 'not_interested' from users v, users t where v.handle = ${me} and t.handle = 'momentum_maya' on conflict do nothing`;
  await page.goto('/settings');
  await page.getByTestId('delete-first').click();
  await page.getByTestId('delete-final').click();
  await expect.poll(async () => (await sql`select 1 from users where handle = ${me}`).length).toBe(0);
  expect(await rowsOf(sql, me)).toEqual({ follows: 0, exclusions: 0 });
  await sql`delete from handle_reservations where handle = ${me}`;
});

// 45 traders × 5 fresh closes, one symbol each (as app.spec.ts's paging fixture): enough for three pages.
async function fixture() {
  const sql = await db();
  const now = Date.now();
  const L = (n: number) => String.fromCharCode(65 + (n % 26));
  const [{ id: attempt }] = await sql`insert into signup_attempts (method, adult_attested_at) values ('dev', now()) returning id`;
  const users = await sql`insert into users (handle, display_name, adult_attested_at, signup_attempt_id)
    select 'ni_e2e_' || i, 'Ni ' || i, now(), ${attempt} from generate_series(0, 44) i on conflict (handle) do update set handle = excluded.handle returning id, handle`;
  const rows = users.flatMap((u) => { const h = Number(String(u.handle).slice(7)); return Array.from({ length: 5 }, (_, i) => ({
    user_id: u.id, sell_id: `${u.handle}-${i}`, account_id: 'a', symbol: `N${L(h)}${L(Math.floor(h / 26))}${L(i)}`, opened_at: new Date(now - 2 * 86_400_000),
    closed_at: new Date(now - (h * 5 + i + 1) * 20_000), return_pct: (i + h) % 3 ? 0.3 + ((h * 7 + i) % 10) / 40 : -0.25 - ((h + i) % 5) / 40, holding_days: 1, verified: true })); });
  await sql`delete from closed_trades where user_id in ${sql(users.map((u) => u.id))}`;
  await sql`insert into closed_trades ${sql(rows)}`;
  return { remove: async () => { await sql`delete from users where id in ${sql(users.map((u) => u.id))}`; await sql`delete from signup_attempts where id = ${attempt}`; } };
}

test('F-2 PR-2: "Not interested" in the pane: the trader\'s cards drop in place, "Hidden for 90 days." with Undo for 5 s; Undo restores them; page 2 leaves them out in order; "Show again" on /me/following', async ({ page }) => {
  test.setTimeout(180_000);
  const { feedLock } = await import('./feed-lock.ts');
  const release = await feedLock('exclusive');
  const fx = await fixture();
  const sql = await db();
  const me = `f2n${Math.random().toString(36).slice(2, 8)}`;
  try {
    await page.setViewportSize({ width: 375, height: 800 });
    await signIn(page, me);
    await page.goto('/');
    const rows = page.locator('.feed > .row');
    await expect(rows).toHaveCount(30);
    await expect(page.locator('.feed .pane .chart-hit').first()).toBeAttached(); // hydrated
    await rows.nth(24).evaluate((el) => el.scrollIntoView());
    await expect(rows).toHaveCount(60);
    const all = await shown(page);
    const p1 = all.slice(0, 30), p2 = all.slice(30);
    const x = p1.slice(2).find((c) => p2.some((d) => d.handle === c.handle))!.handle;
    // A new page 1 (the same list today), then the hide from the first card of x past card 2.
    await page.goto('/');
    await expect(rows).toHaveCount(30);
    await expect(page.locator('.feed .pane .chart-hit').first()).toBeAttached();
    const at = p1.findIndex((c, i) => i >= 2 && c.handle === x);
    const row = rows.nth(at);
    await row.evaluate((el) => el.scrollIntoView());
    await expect.poll(async () => { await page.keyboard.press('ArrowRight'); return row.evaluate((el) => el.scrollLeft); }).toBeGreaterThan(300);
    const summary = row.locator('.pane .more-menu summary');
    expect((await summary.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await summary.focus();
    await page.keyboard.press('Enter');
    await expect(row.locator('.feed-card, .card').getByText(`Not interested in @${x}`)).toHaveCount(0); // never on a feed card
    await shoot(page, 'pane-menu-375');
    await row.getByRole('button', { name: `Not interested in @${x}` }).click();
    const bar = page.locator('.hide-bar');
    await expect(bar).toHaveText(/Hidden for 90 days\.\s*Undo/);
    await expect(bar.getByRole('button', { name: 'Undo' })).toBeFocused();
    const left = await shown(page);
    expect(left.map((c) => c.trade)).toEqual(p1.filter((c) => c.handle !== x).map((c) => c.trade)); // in place, nothing reorders
    // The card after the one the reader was on is at the top.
    const next = p1.slice(at).find((c) => c.handle !== x)!;
    await expect.poll(() => page.locator(`.feed > .row[data-trade="${next.trade}"]`).evaluate((el) => Math.round(el.getBoundingClientRect().top))).toBe(0);
    await shoot(page, 'not-interested-undo-375');
    await page.setViewportSize({ width: 1280, height: 800 });
    await shoot(page, 'not-interested-undo-1280');
    await page.setViewportSize({ width: 375, height: 800 });
    await bar.getByRole('button', { name: 'Undo' }).click();
    await expect.poll(async () => (await shown(page)).length).toBe(30);
    await expect.poll(async () => (await sql`select count(*)::int as n from viewer_exclusions x join users u on u.id = x.viewer_id where u.handle = ${me} and x.until > now()`)[0].n).toBe(0);
    await expect(row.locator('.pane .more-menu summary')).toBeFocused(); // fix round 1: back on the control the reader used
    // Hide again and let the 5 s pass: the bar goes, focus lands on a card; then page 2 arrives without x, in order.
    await row.evaluate((el) => el.scrollIntoView());
    await row.locator('.pane .more-menu summary').click();
    await row.getByRole('button', { name: `Not interested in @${x}` }).click();
    await expect(bar).toHaveText(/Hidden for 90 days\./);
    await expect.poll(async () => (await rowsOf(sql, me)).exclusions).toBe(1);
    await page.waitForTimeout(5_300);
    await expect(bar).toHaveText('');
    await expect(page.locator('.feed .card .who:focus')).toHaveCount(1);
    await page.evaluate(() => { const v = [...document.querySelectorAll<HTMLElement>('.feed > .row')].filter((r) => r.offsetParent); v[v.length - 5].scrollIntoView(); });
    await expect.poll(async () => (await shown(page)).length).toBe(60 - all.filter((c) => c.handle === x).length);
    expect((await shown(page)).map((c) => c.trade)).toEqual(all.filter((c) => c.handle !== x).map((c) => c.trade));
    // Never on a profile (TR-1): x's profile still lists every one of x's trades.
    const syms = (await sql`select symbol from closed_trades t join users u on u.id = t.user_id where u.handle = ${x}`).map((r) => r.symbol as string);
    await page.goto(`/u/${x}`);
    for (const sym of syms) expect(await page.locator('main').getByText(sym, { exact: true }).count(), sym).toBeGreaterThan(0);
    // "Show again" on /me/following ends it; the next feed has x again.
    await page.goto('/me/following');
    await expect(page.locator('.people li')).toHaveCount(1);
    await expect(page.locator('.people li')).toContainText(`@${x}`);
    await shoot(page, 'me-following-show-again-375');
    await page.getByRole('button', { name: `Show @${x} again` }).click(); // fix round 1: a name per trader
    await expect(page.getByText('No one is hidden.')).toBeVisible();
    await expect(page.locator('[role="status"]', { hasText: `@${x} is back in your feed.` })).toBeVisible(); // and feedback
    await page.goto('/');
    await expect.poll(async () => (await shown(page)).some((c) => c.handle === x)).toBe(true);
  } finally {
    await sql`delete from users where handle = ${me}`;
    await fx.remove();
    await release();
  }
});

// Fix round 1 (business lead and UX blocker; tester Low 2; UX 7): the "…" menu stays inside the screen at 375 and 320
// with a 20-character handle (the longest) beside "Following"; it closes on Esc (focus back on "…"), a click outside
// and Tab away; the hide bar's timer pauses while Undo has keyboard focus, and Esc closes it onto a card.
test('F-2 PR-2 fix round 1: the "…" menu fits the screen with a 20-character handle and closes on Esc, outside click and Tab away; the Undo timer pauses under keyboard focus', async ({ page }) => {
  test.setTimeout(120_000);
  const { feedLock } = await import('./feed-lock.ts');
  const release = await feedLock('exclusive');
  const sql = await db();
  const h = `f2m_${Math.random().toString(36).slice(2)}xxxxxxxxxxxxxxxx`.slice(0, 20);
  const me = `f2k${Math.random().toString(36).slice(2, 8)}`;
  const [{ id: attempt }] = await sql`insert into signup_attempts (method, adult_attested_at) values ('dev', now()) returning id`;
  // Five closes: the feed's minimum record.
  const [{ id: trader }] = await sql`insert into users (handle, display_name, adult_attested_at, signup_attempt_id) values (${h}, 'Long Handle', now(), ${attempt}) returning id`;
  await sql`insert into closed_trades ${sql([0, 1, 2, 3, 4].map((i) => ({ user_id: trader, sell_id: `${h}-${i}`, account_id: 'a', symbol: `LH${'ABCDE'[i]}`, opened_at: new Date(Date.now() - 86_400_000),
    closed_at: new Date(Date.now() - (i + 1) * 5_000), return_pct: i === 1 ? -0.9 : 0.9, holding_days: 1, verified: true })))}`;
  try {
    await page.setViewportSize({ width: 375, height: 800 });
    await signIn(page, me);
    await page.goto('/');
    const row = page.locator(`.feed > .row[data-handle="${h}"]`).first();
    await expect(row).toBeAttached();
    await expect(page.locator('.feed .pane .chart-hit').first()).toBeAttached(); // hydrated
    const toPane = async () => { await row.evaluate((el) => el.scrollIntoView()); await expect.poll(async () => { await page.keyboard.press('ArrowRight'); return row.evaluate((el) => el.scrollLeft); }).toBeGreaterThan(200); };
    await toPane();
    await row.locator('.pane .pane-actions button.follow').click();
    await expect(row.locator('.pane .pane-actions button.follow')).toHaveText('Following');
    const summary = row.locator('.pane .more-menu summary');
    const item = row.getByRole('button', { name: `Not interested in @${h}` });
    const fits = async (w: number) => {
      const b = (await item.boundingBox())!;
      expect(b.x, `left edge at ${w}`).toBeGreaterThanOrEqual(16 - 0.5);
      expect(b.x + b.width, `right edge at ${w}`).toBeLessThanOrEqual(w - 16 + 0.5);
      expect(await item.evaluate((el) => el.scrollWidth <= el.clientWidth + 1), 'text not cut').toBe(true);
    };
    await summary.focus();
    await page.keyboard.press('Enter');
    await expect(item).toBeVisible();
    await fits(375);
    await shoot(page, 'pane-menu-20char-375');
    // Esc closes it and puts focus back on "…".
    await page.keyboard.press('Escape');
    await expect(item).toBeHidden();
    await expect(summary).toBeFocused();
    // A click outside closes it.
    await page.keyboard.press('Enter');
    await expect(item).toBeVisible();
    await page.mouse.click(8, 600);
    await expect(item).toBeHidden();
    // Tab away closes it.
    await summary.focus();
    await page.keyboard.press('Enter');
    await page.keyboard.press('Tab');
    await expect(item).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(item).toBeHidden();
    // 320 wide: still inside, wrapping if it must.
    await page.setViewportSize({ width: 320, height: 640 });
    await toPane();
    await summary.focus();
    await page.keyboard.press('Enter');
    await fits(320);
    await shoot(page, 'pane-menu-20char-320');
    // Hide by keyboard: Undo has focus and the 5 s do not run out under it; Esc closes the bar onto a card.
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    const bar = page.locator('.hide-bar');
    await expect(bar.getByRole('button', { name: 'Undo' })).toBeFocused();
    await page.waitForTimeout(5_600);
    await expect(bar).toHaveText(/Hidden for 90 days\./);
    await shoot(page, 'hide-bar-paused-320');
    await page.keyboard.press('Escape');
    await expect(bar).toHaveText('');
    await expect(page.locator('.feed .card .who:focus')).toHaveCount(1);
  } finally {
    await sql`delete from users where handle in ${sql([h, me])}`;
    await sql`delete from signup_attempts where id = ${attempt}`;
    await sql`delete from handle_reservations where handle = ${me}`;
    await release();
  }
});
