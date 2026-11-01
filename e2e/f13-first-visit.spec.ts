// F-13 (D27, SW-1): the signed-out first-visit line, the "Swipe ← for profile" hint and the nav's "Trades by stock",
// against the real app (needs `npm run db:seed`). Acceptance: docs/features/F-13-first-visit-line.md; committee demands
// F1–F4 and the engineering conditions in docs/features/logs/F-13/committee-2026-11-01.md.
import { expect, test, type Browser, type BrowserContextOptions, type Page } from '@playwright/test';
import postgres from 'postgres';
import { feedLock } from './feed-lock.ts';

const LINE = 'Verified trades, straight from the broker. Losses included.'; // D27, verbatim
const HINT = 'Swipe ← for profile';
const sql = postgres(process.env.DATABASE_URL!, { max: 2, onnotice: () => {} });
let release: () => Promise<void>;
test.beforeAll(async () => { release = await feedLock('shared'); });
test.afterAll(async () => { await release?.(); await sql.end({ timeout: 1 }); });

const VIEWPORTS = [{ width: 360, height: 640 }, { width: 320, height: 568 }];
const handle = () => `fv${Math.random().toString(36).slice(2, 9)}`;
const firstRow = (page: Page) => page.locator('.feed > .row[data-trade]').first();
const line = (page: Page) => page.locator('.first-visit');
const hint = (page: Page) => page.locator('.swipe-hint');

async function fresh(browser: Browser, opts: BrowserContextOptions = {}) {
  const ctx = await browser.newContext({ viewport: VIEWPORTS[0], ...opts });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  return { ctx, page, errors };
}
// Storage blocked: reading either store throws, as a browser with site data blocked does.
const BLOCK_STORAGE = () => {
  for (const k of ['localStorage', 'sessionStorage']) {
    Object.defineProperty(window, k, { configurable: true, get() { throw new DOMException('denied', 'SecurityError'); } });
  }
};
async function signIn(page: Page, h: string) {
  await page.goto('/login/dev');
  await page.getByLabel('Handle').fill(h);
  await page.getByLabel('I am 18 or older').check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(new RegExp(`/u/${h}$`));
}
// Real touch events through the browser's input pipeline (as e2e/likes.spec.ts).
async function swipe(page: Page, dx: number) {
  const b = (await firstRow(page).locator('.card').boundingBox())!;
  const y = Math.round(b.y + b.height / 2), x0 = Math.round(b.x + b.width - 10);
  const cdp = await page.context().newCDPSession(page);
  const send = (type: 'touchStart' | 'touchMove' | 'touchEnd', x?: number) =>
    cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: x!, y }] });
  await send('touchStart', x0);
  for (let i = 1; i <= 30; i++) { await send('touchMove', x0 + (dx * i) / 30); await page.waitForTimeout(16); }
  await page.waitForTimeout(120);
  await send('touchEnd');
  await cdp.detach();
}
const tabTo = async (page: Page, name: string) => {
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    if (await page.evaluate((n) => document.activeElement?.getAttribute('aria-label') === n, name)) return i + 1;
  }
  return -1;
};

for (const vp of VIEWPORTS) {
  test(`F-13 at ${vp.width}×${vp.height}: signed out, the line is verbatim with the How link, the Demo badge beside it, and the first card's symbol, return and badge in the first viewport; nothing covers the card`, async ({ browser }) => {
    const { ctx, page, errors } = await fresh(browser, { viewport: vp });
    await page.goto('/');
    await expect(line(page)).toHaveCount(1);
    await expect(line(page).locator('.fv-line > span')).toHaveText(LINE, { useInnerText: true });
    await expect(line(page).getByRole('link', { name: 'How records are calculated' })).toHaveAttribute('href', '/how');
    // While any record shown is demo, the Demo badge sits in the same viewport as the line (POLICY F3a, P2).
    if (await page.locator('.feed .card .badge.demo').count()) {
      await expect(line(page).locator('.badge.demo')).toBeInViewport({ ratio: 1 });
      await expect(line(page)).toBeInViewport();
    }
    // Committee F1.
    const card = firstRow(page).locator('.card');
    await expect(card.locator('.symbol')).toBeInViewport({ ratio: 1 });
    await expect(card.locator('.ret')).toBeInViewport({ ratio: 1 });
    if (await card.locator('header .badge').count()) await expect(card.locator('header .badge')).toBeInViewport({ ratio: 1 });
    // Inline, never an overlay (WCAG 2.4.11): static, no dialog, no modal; it never overlaps the focused card link.
    expect(await line(page).evaluate((el) => getComputedStyle(el).position)).toBe('static');
    expect(await hint(page).evaluate((el) => getComputedStyle(el).position)).toBe('static');
    await expect(page.locator('dialog[open], [role="dialog"], [aria-modal]')).toHaveCount(0);
    const link = card.locator('[data-first-card-link]');
    await link.focus();
    const [a, b] = [await line(page).boundingBox(), await link.boundingBox()];
    if (a && b) expect(a.y + a.height <= b.y || b.y + b.height <= a.y || a.x + a.width <= b.x || b.x + b.width <= a.x).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
    await ctx.close();
  });
}

test('F-13: the dismiss control is a labelled button reached by keyboard; Enter removes the line, focus lands on the first card, it stays dismissed; a new device shows it again; no new cookie', async ({ browser }) => {
  const { ctx, page, errors } = await fresh(browser);
  await page.goto('/');
  const before = (await ctx.cookies()).map((c) => c.name).sort();
  await expect(line(page)).toBeVisible();
  const tabs = await tabTo(page, 'Dismiss this note');
  expect(tabs).toBeGreaterThan(0);
  expect(tabs).toBeLessThanOrEqual(7); // skip link + nav + the line's link, then Dismiss
  await expect(page.getByRole('button', { name: 'Dismiss this note' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(line(page)).toHaveCount(0);
  expect(await page.evaluate(() => !!document.activeElement?.closest('.feed > .row .card'))).toBe(true);
  await page.reload();
  await expect(line(page)).toBeHidden();
  expect((await ctx.cookies()).map((c) => c.name).sort()).toEqual(before);
  expect(errors).toEqual([]);
  await ctx.close();
  const again = await fresh(browser);
  await again.page.goto('/');
  await expect(line(again.page)).toBeVisible();
  await again.ctx.close();
});

test('F-13 (SW-1): the first card shows the hint once; it is in view after one scroll to the card (F2); gone after → and on reload; never on the second card; no new cookie', async ({ browser }) => {
  const { ctx, page, errors } = await fresh(browser);
  await page.goto('/');
  const before = (await ctx.cookies()).map((c) => c.name).sort();
  await expect(firstRow(page).locator('.swipe-hint')).toHaveText(HINT);
  await expect(page.locator('.feed > .row[data-trade]').nth(1).locator('.swipe-hint')).toHaveCount(0);
  await expect(hint(page)).toHaveCount(1);
  // One scroll: the feed snaps to the first card.
  const feed = page.locator('main.feed');
  const fb = (await feed.boundingBox())!;
  await page.mouse.move(fb.x + fb.width / 2, fb.y + fb.height / 2);
  await page.mouse.wheel(0, 200);
  await expect.poll(() => firstRow(page).evaluate((el) => Math.abs(el.getBoundingClientRect().top)), { timeout: 5000 }).toBeLessThan(2);
  await expect(hint(page)).toBeInViewport({ ratio: 1 });
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => firstRow(page).evaluate((el) => el.scrollLeft)).toBeGreaterThan(100);
  await expect(hint(page)).toBeHidden();
  await page.reload();
  await expect(hint(page)).toBeHidden();
  expect((await ctx.cookies()).map((c) => c.name).sort()).toEqual(before);
  expect(errors).toEqual([]);
  await ctx.close();
});

test('F-13 (SW-1): a touch swipe ends the hint for the device', async ({ browser }) => {
  const { ctx, page, errors } = await fresh(browser, { hasTouch: true, isMobile: true });
  await page.goto('/');
  await expect(hint(page)).toBeVisible();
  await swipe(page, -300);
  await expect.poll(() => firstRow(page).evaluate((el) => el.scrollLeft)).toBeGreaterThan(100);
  await expect(hint(page)).toBeHidden();
  await page.reload();
  await expect(hint(page)).toBeHidden();
  expect(errors).toEqual([]);
  await ctx.close();
});

test('F-13: with storage blocked both render, both can be dismissed for the page, no error, and a reload shows them again', async ({ browser }) => {
  const { ctx, page, errors } = await fresh(browser);
  await ctx.addInitScript(BLOCK_STORAGE);
  await page.goto('/');
  expect(await page.evaluate(() => { try { void localStorage.length; return false; } catch { return true; } })).toBe(true);
  await expect(line(page)).toBeVisible();
  await expect(hint(page)).toBeVisible();
  await page.getByRole('button', { name: 'Dismiss this note' }).focus();
  await page.keyboard.press('Enter');
  await expect(line(page)).toHaveCount(0);
  await page.locator('[data-first-card-link]').focus();
  await page.keyboard.press('ArrowRight');
  await expect(hint(page)).toBeHidden();
  await page.reload();
  await expect(line(page)).toBeVisible();
  await expect(hint(page)).toBeVisible();
  expect(errors).toEqual([]);
  await ctx.close();
});

test('F-13: no animation under reduced motion', async ({ browser }) => {
  const { ctx, page } = await fresh(browser, { reducedMotion: 'reduce' });
  await page.goto('/');
  for (const el of [line(page), hint(page)]) {
    const s = await el.evaluate((e) => { const c = getComputedStyle(e); return [c.animationName, c.transitionDuration]; });
    expect(s).toEqual(['none', '0s']);
  }
  await ctx.close();
});

test('F-13: signed in, the line never shows; the hint is a device first run for everyone; no line on a later page', async ({ browser }) => {
  const h = handle();
  const { ctx, page } = await fresh(browser);
  try {
    await signIn(page, h);
    await page.goto('/');
    await expect(page.locator('.feed .card').first()).toBeVisible();
    await expect(line(page)).toHaveCount(0);
    await expect(hint(page)).toBeVisible();
  } finally {
    await ctx.close();
    await sql`delete from users where handle = ${h}`;
  }
  // A later page (`?after=`) never carries the line or the hint.
  const anon = await fresh(browser);
  await anon.page.goto('/');
  // The seeded feed may fit on one page: then there is no later page to check (no wait for a link that never comes).
  // ponytail: the later-page check runs only when the shared DB holds more than one page — a fixture with 31+ cards would make it always run.
  const links = anon.page.locator('a[href*="after="]');
  const next = (await links.count()) ? await links.first().getAttribute('href') : null;
  if (next) {
    await anon.page.goto(next);
    await expect(line(anon.page)).toHaveCount(0);
    await expect(hint(anon.page)).toHaveCount(0);
  }
  await anon.ctx.close();
});

test('F-13: the nav reads "Trades by stock", goes to /t, and fits at 320, 360 and 390 px signed out and signed in (≤ 56 px tall)', async ({ browser }) => {
  const fits = async (page: Page) => {
    for (const width of [320, 360, 390]) {
      await page.setViewportSize({ width, height: 640 });
      await page.goto('/');
      const m = await page.locator('nav.top').evaluate((n) => ({ sw: n.scrollWidth, cw: n.clientWidth, h: (n as HTMLElement).offsetHeight, doc: document.documentElement.scrollWidth, iw: innerWidth }));
      expect(m.sw, `nav at ${width}`).toBeLessThanOrEqual(m.cw);
      expect(m.doc, `page at ${width}`).toBeLessThanOrEqual(m.iw);
      expect(m.h, `nav height at ${width}`).toBeLessThanOrEqual(56);
    }
  };
  const { ctx, page } = await fresh(browser);
  await fits(page);
  await page.locator('nav.top').getByRole('link', { name: 'Trades by stock' }).click();
  await expect(page).toHaveURL(/\/t$/);
  await ctx.close();
  const h = handle();
  const signed = await fresh(browser);
  try {
    await signIn(signed.page, h);
    await fits(signed.page);
  } finally {
    await signed.ctx.close();
    await sql`delete from users where handle = ${h}`;
  }
});
