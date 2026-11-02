// F-25 · Shape R focus rings (docs/features/F-25-one-link-rule-for-trade-rows.md: "Each Shape R link shows its focus ring
// around the whole row, not clipped by its container, in light and dark"). On the stock page's trades list and the
// feed pane's last-trades list: the focused row link shows an outline, the outline's box (the link's box grown by the
// outline offset and width) lies inside the box of its nearest clipping (scroll) container, and a screenshot of the row
// with its ring is attached, in both colour schemes. The trader is this file's own, removed after; feed lock held shared.
import { expect, test, type Locator, type Page } from '@playwright/test';
import postgres from 'postgres';
import { feedLock } from './feed-lock.ts';
import { handleOf, makeTrader, marker, removeHandles, symbolOf, type Made } from './f25-fixture.ts';

const sql = postgres(process.env.DATABASE_URL!, { max: 2, onnotice: () => {} });
const S = symbolOf();
let F: Made;
let release: () => Promise<void> = async () => {};

test.beforeAll(async () => {
  release = await feedLock('shared');
  F = await makeTrader(sql, { handle: handleOf('f25f'), verified: true, mark: marker(), closes: [
    { symbol: S, r: 0.091, hoursAgo: 0.1 }, { symbol: S, r: -0.047, hoursAgo: 0.2 }, { symbol: S, r: 0.013, hoursAgo: 0.3 },
    { symbol: S, r: -0.02, hoursAgo: 0.4 }, { symbol: S, r: 0.066, hoursAgo: 0.5 },
  ] });
});
test.afterAll(async () => {
  if (F) await removeHandles(sql, [F.handle]);
  await release();
  await sql.end({ timeout: 1 });
});

// The focused link's outline box and its clipping container's visible box (client area), in viewport pixels.
const ringGeometry = (link: Locator) => link.evaluate((a) => {
  const cs = getComputedStyle(a), r = a.getBoundingClientRect();
  const grow = (parseFloat(cs.outlineOffset) || 0) + (parseFloat(cs.outlineWidth) || 0);
  const ring = { left: r.left - grow, top: r.top - grow, right: r.right + grow, bottom: r.bottom + grow };
  let c: Element | null = a.parentElement;
  while (c && c !== document.documentElement) {
    const s = getComputedStyle(c);
    if (s.overflowX !== 'visible' || s.overflowY !== 'visible') break;
    c = c.parentElement;
  }
  let clip = { left: 0, top: 0, right: document.documentElement.clientWidth, bottom: window.innerHeight }, what = 'viewport';
  if (c && c !== document.documentElement) {
    const b = c.getBoundingClientRect(), el = c as HTMLElement;
    clip = { left: b.left + el.clientLeft, top: b.top + el.clientTop, right: b.left + el.clientLeft + el.clientWidth, bottom: b.top + el.clientTop + el.clientHeight };
    what = `${c.tagName.toLowerCase()}.${[...c.classList].join('.')}`;
  }
  return { ring, clip, what, style: cs.outlineStyle, width: cs.outlineWidth, focusVisible: a.matches(':focus-visible') };
});
async function checkRing(page: Page, link: Locator, name: string) {
  await expect(link).toBeFocused();
  const g = await ringGeometry(link);
  expect(g.focusVisible, `${name}: :focus-visible`).toBe(true);
  expect(g.style, `${name}: an outline is drawn`).not.toBe('none');
  expect(parseFloat(g.width), `${name}: outline width`).toBeGreaterThan(0);
  const at = `${name}: ring ${JSON.stringify(g.ring)} inside ${g.what} ${JSON.stringify(g.clip)}`;
  expect(g.ring.left, at).toBeGreaterThanOrEqual(g.clip.left - 0.5);
  expect(g.ring.top, at).toBeGreaterThanOrEqual(g.clip.top - 0.5);
  expect(g.ring.right, at).toBeLessThanOrEqual(g.clip.right + 0.5);
  expect(g.ring.bottom, at).toBeLessThanOrEqual(g.clip.bottom + 0.5);
  const pad = 10, vw = page.viewportSize()!;
  const x = Math.max(0, g.ring.left - pad), y = Math.max(0, g.ring.top - pad);
  const shot = await page.screenshot({ clip: { x, y, width: Math.min(vw.width - x, g.ring.right - g.ring.left + 2 * pad), height: Math.min(vw.height - y, g.ring.bottom - g.ring.top + 2 * pad) } });
  await test.info().attach(`${name}.png`, { body: shot, contentType: 'image/png' });
}

for (const colorScheme of ['light', 'dark'] as const) {
  test(`stock page trades list (${colorScheme}): the focused row link's ring is whole and unclipped`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 360, height: 740 }, colorScheme });
    const page = await ctx.newPage();
    await page.goto(`/t/${S}`);
    const links = page.locator('ul.ticker-rows[aria-label^="Closed trades in"] a.trow');
    await expect(links).toHaveCount(F.trades.length);
    // Keyboard focus: Tab until the first row link has it.
    await page.locator('body').click({ position: { x: 1, y: 1 } });
    await expect.poll(async () => { await page.keyboard.press('Tab'); return links.first().evaluate((a) => a === document.activeElement); }, { timeout: 20_000, intervals: [0] }).toBe(true);
    await links.first().scrollIntoViewIfNeeded();
    await checkRing(page, links.first(), `stock-${colorScheme}-row1`);
    await page.keyboard.press('Tab');
    await checkRing(page, links.nth(1), `stock-${colorScheme}-row2`);
    await ctx.close();
  });

  test(`feed pane last trades (${colorScheme}): the focused row link's ring is whole and unclipped`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 360, height: 740 }, colorScheme, reducedMotion: 'reduce' });
    await ctx.addInitScript(() => { try { localStorage.setItem('ss.firstVisitLine', 'dismissed'); } catch { /* blocked */ } });
    const page = await ctx.newPage();
    await page.goto('/');
    const row = page.locator(`.feed > .row[data-handle="${F.handle}"]`).first();
    await expect(row).toBeAttached();
    await row.evaluate((r) => { r.scrollIntoView({ block: 'start' }); r.scrollLeft = 0; });
    // → on the card moves focus into the pane (app/feed-keys.tsx), then Tab to the first last-trades row.
    await row.locator('article.card header a.who').focus();
    await page.keyboard.press('ArrowRight');
    await expect.poll(() => row.evaluate((r) => r.scrollLeft)).toBeGreaterThan(100);
    const links = row.locator('section.pane ul.rows a.line');
    await expect(links).toHaveCount(5);
    await expect.poll(async () => { await page.keyboard.press('Tab'); return links.first().evaluate((a) => a === document.activeElement); }, { timeout: 20_000, intervals: [0] }).toBe(true);
    await page.waitForTimeout(300); // the scroll that brought the row into view settles
    await checkRing(page, links.first(), `pane-${colorScheme}-row1`);
    await page.keyboard.press('Tab');
    await page.waitForTimeout(300);
    await checkRing(page, links.nth(1), `pane-${colorScheme}-row2`);
    await ctx.close();
  });
}
