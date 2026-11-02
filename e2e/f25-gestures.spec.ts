// F-25 · feed card gestures with the footer's trade link (docs/features/F-25-one-link-rule-for-trade-rows.md, "Gestures
// on the feed card are unchanged"): one tap on "This trade →" opens the trade page; a double tap on the card body never
// navigates (signed out it shows the sign-in line); a touch swipe that starts on "This trade →" or on a pane row link opens
// the pane, rejects or scrolls as before and never follows the link; a pointer that leaves a link before release does not
// follow it (WCAG 2.5.2). Real touch events through the browser's input pipeline (CDP Input.dispatchTouchEvent), never
// mouse drags, except for the pointer-leave case, which is also run with a mouse. The trader is this file's own (random
// generic handle, fictional symbols), removed after; the feed lock is held shared while it exists.
import { expect, test, type Browser, type Locator, type Page } from '@playwright/test';
import postgres from 'postgres';
import { feedLock } from './feed-lock.ts';
import { handleOf, makeTrader, marker, removeHandles, symbolOf, type Made } from './f25-fixture.ts';

const sql = postgres(process.env.DATABASE_URL!, { max: 2, onnotice: () => {} });
let G: Made;
let release: () => Promise<void> = async () => {};

test.beforeAll(async () => {
  release = await feedLock('shared');
  const S = symbolOf();
  G = await makeTrader(sql, { handle: handleOf('f25g'), verified: false, mark: marker(), closes: [
    { symbol: S, r: 0.118, hoursAgo: 0.1 }, { symbol: S, r: -0.064, hoursAgo: 0.2 }, { symbol: S, r: 0.035, hoursAgo: 0.3 },
    { symbol: S, r: -0.022, hoursAgo: 0.4 }, { symbol: S, r: 0.051, hoursAgo: 0.5 },
  ] });
});
test.afterAll(async () => {
  if (G) await removeHandles(sql, [G.handle]);
  await release();
  await sql.end({ timeout: 1 });
});

async function touchPage(browser: Browser) {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 800 }, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
  // A returning visitor: no first-visit line over the card.
  await ctx.addInitScript(() => { try { localStorage.setItem('ss.firstVisitLine', 'dismissed'); } catch { /* blocked */ } });
  const page = await ctx.newPage();
  await page.goto('/');
  const row = page.locator(`.feed > .row[data-handle="${G.handle}"]`).first();
  await expect(row).toBeAttached();
  await row.evaluate((r) => { r.scrollIntoView({ block: 'start' }); r.scrollLeft = 0; });
  await expect.poll(() => row.evaluate((r) => Math.round(r.getBoundingClientRect().top))).toBe(0);
  return { ctx, page, row };
}
async function touches(page: Page, run: (send: (type: 'touchStart' | 'touchMove' | 'touchEnd', x?: number, y?: number) => Promise<void>) => Promise<void>) {
  const cdp = await page.context().newCDPSession(page);
  await run(async (type, x, y) => { await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: x!, y: y! }] }); });
  await cdp.detach();
}
const center = async (el: Locator) => { const b = (await el.boundingBox())!; return { x: Math.round(b.x + b.width / 2), y: Math.round(b.y + b.height / 2) }; };
async function swipeFrom(page: Page, el: Locator, dx: number, dy = 0) {
  const { x, y } = await center(el);
  const steps = Math.max(2, Math.round(Math.max(Math.abs(dx), Math.abs(dy)) / 10));
  await touches(page, async (send) => {
    await send('touchStart', x, y);
    for (let i = 1; i <= steps; i++) { await send('touchMove', x + (dx * i) / steps, y + (dy * i) / steps); await page.waitForTimeout(16); }
    await page.waitForTimeout(120);
    await send('touchEnd');
  });
}
// Still on the feed after the gesture had time to navigate.
async function stillOnFeed(page: Page, what: string) {
  await page.waitForTimeout(800);
  expect(new URL(page.url()).pathname, `${what}: no navigation`).toBe('/');
}
const tradeLink = (row: Locator) => row.locator('article.card footer a[href*="/trade/"]');

test('one tap on "This trade →" opens the trade page', async ({ browser }) => {
  const { ctx, page, row } = await touchPage(browser);
  const link = tradeLink(row);
  const href = (await link.getAttribute('href'))!;
  const { x, y } = await center(link);
  await touches(page, async (send) => { await send('touchStart', x, y); await send('touchEnd'); });
  await expect(page).toHaveURL(new RegExp(`${href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`));
  await expect(page.locator('h1')).toHaveText(/^Q[A-Z]{4}$/);
  await ctx.close();
});

test('a double tap on the card body never navigates; signed out it shows the sign-in line', async ({ browser }) => {
  const { ctx, page, row } = await touchPage(browser);
  for (const sel of ['.hero .ret', '.hero [data-strip]']) {
    const { x, y } = await center(row.locator(`article.card ${sel}`).first());
    await touches(page, async (send) => { await send('touchStart', x, y); await send('touchEnd'); await page.waitForTimeout(90); await send('touchStart', x, y); await send('touchEnd'); });
    await expect(page.locator('.signin-line')).toContainText('Sign in to like trades.');
    await stillOnFeed(page, `double tap on ${sel}`);
    await page.keyboard.press('Escape');
  }
  await ctx.close();
});

test('a touch swipe that starts on "This trade →" opens the pane, rejects or scrolls, and never follows the link', async ({ browser }) => {
  const { ctx, page, row } = await touchPage(browser);
  // Toward the profile: SW-1 opens the pane.
  await swipeFrom(page, tradeLink(row), -260);
  await stillOnFeed(page, 'swipe left from This trade');
  await expect.poll(() => row.evaluate((r) => r.scrollLeft), { message: 'the pane opened' }).toBeGreaterThan(100);
  // Back to the card, then the other way (signed out there is no reject: it snaps back) and a vertical scroll.
  await row.evaluate((r) => { r.scrollLeft = 0; });
  await expect.poll(() => row.evaluate((r) => r.scrollLeft)).toBe(0);
  await swipeFrom(page, tradeLink(row), 260);
  await stillOnFeed(page, 'swipe right from This trade');
  await row.evaluate((r) => { r.scrollIntoView({ block: 'start' }); r.scrollLeft = 0; });
  const top = await page.locator('.feed').evaluate((f) => f.scrollTop);
  await swipeFrom(page, tradeLink(row), 0, -650); // past half the row, so the snap lands on the next card
  await stillOnFeed(page, 'swipe up from This trade');
  expect(await page.locator('.feed').evaluate((f) => f.scrollTop), 'the feed scrolled').not.toBe(top);
  await ctx.close();
});

test('a touch swipe that starts on a pane row link never follows it', async ({ browser }) => {
  const { ctx, page, row } = await touchPage(browser);
  await row.evaluate((r) => { r.scrollLeft = r.scrollWidth; });
  await expect.poll(() => row.evaluate((r) => r.scrollLeft)).toBeGreaterThan(100);
  await page.waitForTimeout(300);
  const link = row.locator('section.pane ul.rows a').first();
  await link.scrollIntoViewIfNeeded();
  await expect(link).toBeInViewport();
  // Back toward the card.
  await swipeFrom(page, link, 260);
  await stillOnFeed(page, 'swipe right from a pane row');
  // Up and down inside the pane.
  await row.evaluate((r) => { r.scrollLeft = r.scrollWidth; });
  await page.waitForTimeout(300);
  await link.scrollIntoViewIfNeeded();
  await swipeFrom(page, link, 0, -200);
  await stillOnFeed(page, 'swipe up from a pane row');
  await swipeFrom(page, link, 0, 200);
  await stillOnFeed(page, 'swipe down from a pane row');
  await ctx.close();
});

test('a pointer that leaves a link before release does not follow it (touch and mouse)', async ({ browser }) => {
  const { ctx, page, row } = await touchPage(browser);
  // Touch: down on the link, move off it (onto the card body), lift.
  const link = tradeLink(row);
  const { x, y } = await center(link);
  const ret = await center(row.locator('article.card .hero .ret'));
  await touches(page, async (send) => {
    await send('touchStart', x, y);
    for (let i = 1; i <= 12; i++) { await send('touchMove', x + ((ret.x - x) * i) / 12, y + ((ret.y - y) * i) / 12); await page.waitForTimeout(16); }
    await send('touchEnd');
  });
  await stillOnFeed(page, 'touch moved off This trade');
  await ctx.close();
  // Mouse: press on each footer link, move off, release.
  const desk = await browser.newContext({ viewport: { width: 780, height: 900 } });
  await desk.addInitScript(() => { try { localStorage.setItem('ss.firstVisitLine', 'dismissed'); } catch { /* blocked */ } });
  const p = await desk.newPage();
  await p.goto('/');
  const r = p.locator(`.feed > .row[data-handle="${G.handle}"]`).first();
  await r.evaluate((e) => { e.scrollIntoView({ block: 'start' }); e.scrollLeft = 0; });
  for (const l of [tradeLink(r), r.locator(`article.card footer a[href="/u/${G.handle}"]`)]) {
    const c = await center(l), body = await center(r.locator('article.card .hero .ret'));
    await p.mouse.move(c.x, c.y);
    await p.mouse.down();
    await p.mouse.move(body.x, body.y, { steps: 8 });
    await p.mouse.up();
    await stillOnFeed(p, `mouse left ${await l.getAttribute('href')}`);
  }
  await desk.close();
});
