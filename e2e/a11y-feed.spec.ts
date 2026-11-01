// A11Y-FIXES (approval council fixes #15–#19, 2026-11-01; committee B4, B5) against the real app (needs `npm run db:seed`).
// Keyboard and reflow checks for the feed and the profile: off-screen panes are inert (#17), → and Back move focus, the
// fixed nav never covers focus (#15), the signed-out sign-in line closes on Esc, focus moving and a row change (#16),
// the Like button is named by its visible text (#18), and long names and short viewports reflow (#19).
// Every row made here is this file's own (generic handles, synthetic returns) and removed after; nothing else is counted.
import { expect, test, type Browser, type Locator, type Page } from '@playwright/test';
import postgres from 'postgres';
import { feedLock } from './feed-lock.ts';

const sql = postgres(process.env.DATABASE_URL!, { max: 2, onnotice: () => {} });
test.afterAll(async () => { await sql.end({ timeout: 1 }); });

const rand = () => Math.random().toString(36).slice(2, 8);
async function signIn(page: Page, handle: string) {
  await page.goto('/login/dev');
  await page.getByLabel('Handle').fill(handle);
  await page.getByLabel('I am 18 or older').check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(new RegExp(`/u/${handle}$`));
}
// One trader with `n` closes: the first five fresh with a large move (so they rank on feed page 1), the rest older.
async function trader(handle: string, name: string, n: number, opts: { verified?: boolean; prefix?: string } = {}) {
  const [{ id: attempt }] = await sql`insert into signup_attempts (method, adult_attested_at) values ('dev', now()) returning id`;
  const [{ id }] = await sql`insert into users (handle, display_name, adult_attested_at, signup_attempt_id) values (${handle}, ${name}, now(), ${attempt}) returning id`;
  const L = (k: number) => String.fromCharCode(65 + (k % 26));
  const now = Date.now();
  const rows = Array.from({ length: n }, (_, i) => {
    const closed = new Date(i < 5 ? now - (i + 1) * 5_000 : now - (i + 1) * 3_600_000);
    return { user_id: id, sell_id: `${handle}-${i}`, account_id: 'a', symbol: `${opts.prefix ?? 'QZ'}${L(i)}${L(Math.floor(i / 26))}`,
      opened_at: new Date(closed.getTime() - 86_400_000), closed_at: closed, return_pct: i % 3 === 1 ? -0.85 : 0.9, holding_days: 1, verified: opts.verified ?? true };
  });
  await sql`insert into closed_trades ${sql(rows)}`;
  return { id, remove: async () => { await sql`delete from users where id = ${id}`; await sql`delete from signup_attempts where id = ${attempt}`; } };
}
const firstRow = (page: Page) => page.locator('.feed > .row[data-trade]').first();
// #16 and #17 (sign-in line, inert panes and focus moves) are built and tested by fix cycle 2 (#60: lib/feed-focus.ts and
// its tests); this file keeps #15, #18, #19 and the no-JS check.
// The focused element's box, and the fixed nav's bottom edge.
const focusBox = (page: Page) => page.evaluate(() => {
  const a = document.activeElement as HTMLElement | null, r = a?.getBoundingClientRect();
  const nav = document.querySelector('nav.top')?.getBoundingClientRect().bottom ?? 0;
  const row = a?.closest<HTMLElement>('.feed > .row');
  const inPane = !!a?.closest('.feed > .row > .pane');
  return { tag: a?.tagName ?? '', top: r?.top ?? 0, bottom: r?.bottom ?? 0, left: r?.left ?? 0, right: r?.right ?? 0, nav, vh: innerHeight, vw: innerWidth, inPane,
    rowOnCard: row ? row.scrollLeft <= row.clientWidth / 2 : null, inMain: !!a?.closest('main') };
});

test('#17: without JavaScript nothing in the feed is inert', async ({ browser }) => {
  const release = await feedLock('shared');
  const ctx = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 360, height: 640 } });
  try {
    const page = await ctx.newPage();
    await page.goto('/');
    await expect(firstRow(page)).toBeAttached();
    expect(await page.locator('[inert]').count()).toBe(0);
  } finally {
    await ctx.close(); await release();
  }
});

test('#15: on a profile with 50+ closes, keyboard focus in the closed-trades list is never under the fixed nav', async ({ page }) => {
  test.setTimeout(120_000);
  const release = await feedLock('shared'); // the fixture is feed-eligible
  const h = `a11yn_${rand()}`;
  const t = await trader(h, 'Nav Check', 60, { prefix: 'NC' });
  try {
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto(`/u/${h}`);
    await page.locator('.rows li .trade-link').first().focus();
    let checked = 0;
    for (let i = 0; i < 60; i++) {
      await page.keyboard.press('Tab');
      const f = await page.evaluate(() => {
        const a = document.activeElement as HTMLElement, r = a.getBoundingClientRect();
        return { inRows: !!a.closest('.rows'), top: r.top, bottom: r.bottom, nav: document.querySelector('nav.top')!.getBoundingClientRect().bottom, vh: innerHeight };
      });
      if (!f.inRows) continue;
      checked++;
      expect(f.top, `Tab ${i + 1} under the nav`).toBeGreaterThanOrEqual(f.nav - 0.5);
      expect(f.bottom, `Tab ${i + 1} below the screen`).toBeLessThanOrEqual(f.vh + 0.5);
    }
    expect(checked).toBeGreaterThan(20);
  } finally {
    await t.remove(); await release();
  }
});

// Real touch events through the browser's input pipeline (as e2e/likes.spec.ts).
async function doubleTap(page: Page, el: Locator) {
  const b = (await el.boundingBox())!;
  const x = Math.round(b.x + b.width / 2), y = Math.round(b.y + b.height / 2);
  const cdp = await page.context().newCDPSession(page);
  const send = (type: 'touchStart' | 'touchEnd') => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  await send('touchStart'); await send('touchEnd'); await page.waitForTimeout(90); await send('touchStart'); await send('touchEnd');
  await cdp.detach();
}
async function touchPage(browser: Browser) {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 640 }, hasTouch: true, isMobile: true });
  return { ctx, page: await ctx.newPage() };
}

test('#18: the card\'s Like button is named by its visible text, with aria-pressed and the note as its description', async ({ page }) => {
  test.setTimeout(90_000);
  const release = await feedLock('shared');
  const me = `a11yl${rand()}`;
  try {
    await page.setViewportSize({ width: 1280, height: 900 });
    await signIn(page, me);
    await page.goto('/');
    const row = firstRow(page);
    await row.locator('.card .more-menu summary').click();
    const like = row.getByRole('button', { name: 'Like', exact: true, pressed: false });
    await expect(like).toBeVisible();
    await expect(like).toHaveAccessibleDescription('Only you can see likes.');
    await like.click();
    const liked = row.getByRole('button', { name: 'Liked', exact: true, pressed: true });
    await expect(liked).toBeVisible();
    await expect(liked).toHaveAccessibleDescription('Only you can see likes.');
    await liked.click(); // unlike: leave nothing behind
    await expect(row.getByRole('button', { name: 'Like', exact: true, pressed: false })).toBeVisible();
  } finally {
    await sql`delete from users where handle = ${me}`;
    await release();
  }
});

test('#19: a 20-character handle and a long name at 320 px never widen the page, and the Demo badge stays on screen', async ({ page }) => {
  test.setTimeout(120_000);
  const release = await feedLock('exclusive'); // its cards lead the feed for a moment
  const h = `a11yr_${rand()}xxxxxxxxxxxxxxxx`.slice(0, 20);
  const t = await trader(h, 'Averyveryverylongdisplaynamewithoutspace', 5, { verified: false, prefix: 'RF' });
  try {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto(`/u/${h}`);
    await expect(page.locator('h1')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
    const badge = page.locator('main .badge.demo').first();
    await expect(badge).toBeVisible();
    const pb = (await badge.boundingBox())!;
    expect(pb.x).toBeGreaterThanOrEqual(0);
    expect(pb.x + pb.width).toBeLessThanOrEqual(320);
    await page.goto('/');
    const row = page.locator(`.feed > .row[data-handle="${h}"]`).first();
    await expect(row).toBeAttached();
    await row.evaluate((el) => el.scrollIntoView());
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
    const card = row.locator(':scope > .card');
    expect(await card.evaluate((c) => c.scrollWidth <= c.clientWidth + 1)).toBe(true);
    const cb = (await card.locator('.badge.demo').first().boundingBox())!; // F-10 (#54): the badge leads the record line, not the header
    expect(cb.x).toBeGreaterThanOrEqual(0);
    expect(cb.x + cb.width).toBeLessThanOrEqual(320);
  } finally {
    await t.remove(); await release();
  }
});

test('#19: on short viewports (780×360, 320×256) the first card is not clipped and its footer link is reachable; at 360×640 the card does not scroll (committee B4)', async ({ page }) => {
  test.setTimeout(90_000);
  const release = await feedLock('shared');
  try {
    for (const [width, height] of [[780, 360], [320, 256]] as const) {
      await page.setViewportSize({ width, height });
      await page.goto('/');
      const card = firstRow(page).locator(':scope > .card');
      await expect(card).toBeVisible();
      expect(await card.evaluate((c) => getComputedStyle(c).overflowY), `${width}×${height}`).toBe('auto');
      // Signed-out page 1's card 1 also holds F-13's first-visit line, so at 320×256 the return may sit below the card's
      // first screen: it must be reachable by scrolling the card (never clipped), and fully inside the card's box then.
      await card.evaluate((c) => { c.scrollTop = 0; });
      await card.locator('.ret').scrollIntoViewIfNeeded();
      await expect(card.locator('.ret'), `${width}×${height}: the return is reachable`).toBeInViewport({ ratio: 0.95 }); // sub-pixel edge
      const ret = (await card.locator('.ret').boundingBox())!, box = (await card.boundingBox())!;
      expect(ret.y + ret.height, `${width}×${height}: the return fits the card`).toBeLessThanOrEqual(box.y + box.height + 0.5);
      const link = card.locator('footer a');
      await link.scrollIntoViewIfNeeded();
      await expect(link, `${width}×${height}: footer link`).toBeInViewport();
      expect(await page.evaluate(() => document.documentElement.scrollWidth), `${width}×${height}`).toBeLessThanOrEqual(width);
    }
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto('/');
    const row = firstRow(page);
    await expect(row).toBeVisible();
    expect(await row.locator(':scope > .card').evaluate((c) => getComputedStyle(c).overflowY)).not.toMatch(/auto|scroll/);
    expect(await row.evaluate((r) => getComputedStyle(r).overflowY)).toBe('hidden');
  } finally {
    await release();
  }
});
