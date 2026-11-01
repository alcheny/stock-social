// F-10 follow-ups (approval cycle 2, "Fixes to build now" #15, #16, #18) against the running app, signed out:
// - #15: the fixed "Sign in to like trades." line closes on Escape and when focus moves outside it, so the focused link
//   is never under it (WCAG 2.4.11).
// - #16: Tab never lands in an off-screen pane (the resting row's pane is inert); → moves focus into the pane, ← and Back
//   bring it back to the card; without JavaScript no pane is inert.
// - #18: at 320 px a "+12345.6%" or "≈-100.0%" hero figure, a 40-character name and a 20-character handle stay inside the
//   card (no horizontal scroll, the figure keeps ≥ 10% of the hero spare in the e2e font).
// #23 (the year on card dates) is unit tested (lib/f10-followups.test.ts): every feed card now carries the record strip in
// place of the dated "held · closed" line, and the pane's dates already print the year.
// Fixture traders are its own (`f10f_*`), deleted before and after; they are feed-eligible, so the shared feed lock is
// held while they exist (e2e/feed-lock.ts).
import { test, expect, type Locator, type Page } from '@playwright/test';
import postgres from 'postgres';
import { feedLock } from './feed-lock.ts';

const DAY = 86_400_000;
const sql = postgres(process.env.DATABASE_URL!, { max: 2, onnotice: () => {} });
const LONG = 'f10f_longhandle_abc1'; // 20 characters, the longest handle allowed
const NAME = 'Averyveryverylongdisplaynamewithnospaces'; // 40 characters, the longest name allowed, no break opportunity
const FIXTURES: Record<string, { name: string; closes: number[] }> = {
  [LONG]: { name: NAME, closes: [123.456, 0.3, -0.2, 0.25, -0.15] }, // "+12345.6%"
  f10f_total: { name: 'f10f_total', closes: [-0.99999999999, 0.3, -0.2, 0.25, -0.15] }, // "≈-100.0%"
};
const HANDLES = Object.keys(FIXTURES);

test.describe.configure({ mode: 'serial' });
let releaseFeed: (() => Promise<void>) | null = null;
test.beforeAll(async () => {
  releaseFeed = await feedLock('shared');
  await sql`delete from users where handle in ${sql(HANDLES)}`;
  for (const [handle, f] of Object.entries(FIXTURES)) {
    const [u] = await sql`
      with a as (insert into signup_attempts (method, adult_attested_at) values ('dev', now()) returning id)
      insert into users (handle, display_name, adult_attested_at, signup_attempt_id) select ${handle}, ${f.name}, now(), a.id from a returning id, signup_attempt_id`;
    await sql`insert into closed_trades ${sql(f.closes.map((r, i) => ({
      user_id: u.id, sell_id: `${handle}-${i}`, account_id: 'a', symbol: `${handle === LONG ? 'FFL' : 'FFT'}${i}`,
      opened_at: new Date(Date.now() - (i + 3) * 3_600_000 - 2 * DAY), closed_at: new Date(Date.now() - (i + 1) * 3_600_000),
      return_pct: r, holding_days: 2, verified: true, thesis: null, thesis_status: null,
    })))}`;
    await sql`insert into connections (attempt_id, user_id, state, consent_at, importing_at, last_progress_at, connected_at)
      values (${u.signup_attempt_id}, ${u.id}, 'connected', now(), now(), now(), now() - interval '3 days')`;
  }
});
test.afterAll(async () => {
  await sql`delete from users where handle in ${sql(HANDLES)}`;
  await releaseFeed?.();
  await sql.end({ timeout: 1 });
});

// Hydrated: the pane charts draw their hit layer on the client (as app.spec.ts waits for it).
const hydrated = (page: Page) => expect(page.locator('.feed .pane .chart-hit').first()).toBeAttached();
const isInert = (l: Locator) => l.evaluate((el) => (el as HTMLElement).inert);

// Two taps on the card body, through the touch screen (as e2e/likes.spec.ts does).
async function doubleTap(page: Page, el: Locator) {
  const b = (await el.boundingBox())!;
  const x = Math.round(b.x + b.width / 2), y = Math.round(b.y + b.height / 2);
  const cdp = await page.context().newCDPSession(page);
  const send = (type: 'touchStart' | 'touchEnd') => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  await send('touchStart'); await send('touchEnd'); await page.waitForTimeout(90); await send('touchStart'); await send('touchEnd');
  await cdp.detach();
}

test('#15: signed out, the sign-in line closes on Escape and when focus moves to a link, which is then not covered', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 640 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  try {
    await page.goto('/');
    await hydrated(page);
    const line = page.locator('.signin-line');
    const card = page.locator('.feed > .row').first().locator('.card');
    await doubleTap(page, card.locator('.hero .ret'));
    await expect(line).toContainText('Sign in to like trades.');
    await page.keyboard.press('Escape');
    await expect(line).toHaveText('');
    // Open again; focus moves to the card's bottom link (the area the fixed line covers): the line closes.
    await doubleTap(page, card.locator('.hero .ret'));
    await expect(line).toContainText('Sign in to like trades.');
    const link = card.getByRole('link', { name: /See their record/ });
    await link.focus();
    await expect(link).toBeFocused();
    await expect(line).toHaveText('');
    const covered = await link.evaluate((a) => {
      const r = a.getBoundingClientRect(), hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return !(hit && (hit === a || a.contains(hit)));
    });
    expect(covered).toBe(false);
  } finally {
    await ctx.close();
  }
});

test('#16: Tab from the top of the feed never lands in a pane; resting rows\' panes are inert', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto('/');
  await hydrated(page);
  const rows = new Set<string>();
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press('Tab');
    const at = await page.evaluate(() => {
      const a = document.activeElement;
      return { inPane: !!a?.closest('.feed > .row > .pane'), row: a?.closest('.feed > .row')?.getAttribute('data-trade') ?? null, html: a?.outerHTML.slice(0, 120) ?? '' };
    });
    expect(at.inPane, `Tab ${i + 1}: ${at.html}`).toBe(false);
    if (at.row) rows.add(at.row);
  }
  // The walk crossed from card to card past at least one pane position.
  expect(rows.size).toBeGreaterThanOrEqual(2);
  expect(await page.locator('.feed > .row > .pane[inert]').count()).toBeGreaterThan(0);
  expect(await page.locator('.feed > .row').evaluateAll((rs) => rs.every((r) => r.scrollLeft === 0))).toBe(true);
});

test('#16: → moves focus into the pane, ← and Back bring it back to the card; no JS, no inert', async ({ page, browser }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto('/');
  const row = page.locator('.feed > .row').first();
  const pane = row.locator('.pane');
  // Re-press until hydration has attached the key handler; → is idempotent.
  await expect.poll(async () => { await page.keyboard.press('ArrowRight'); return row.evaluate((el) => el.scrollLeft); }).toBeGreaterThan(300);
  await expect(pane.locator('header .who')).toBeFocused();
  expect(await isInert(pane)).toBe(false);
  await page.keyboard.press('ArrowLeft');
  await expect.poll(() => row.evaluate((el) => el.scrollLeft)).toBe(0);
  await expect(row.locator('.card header .who')).toBeFocused();
  expect(await isInert(pane)).toBe(true);
  // The next Tab stays out of the pane it just left.
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => !!document.activeElement?.closest('.feed > .row > .pane'))).toBe(false);
  // Back (keyboard) returns focus to the card too.
  await row.locator('.card header .who').focus();
  await page.keyboard.press('ArrowRight');
  await expect(pane.locator('header .who')).toBeFocused();
  await expect.poll(() => row.evaluate((el) => el.scrollLeft)).toBeGreaterThan(300);
  await pane.locator('[data-back]').focus();
  await page.keyboard.press('Enter');
  await expect.poll(() => row.evaluate((el) => el.scrollLeft)).toBe(0);
  await expect(row.locator('.card header .who')).toBeFocused();
  expect(await isInert(pane)).toBe(true);
  // Without JavaScript nothing is inert: every pane stays reachable.
  const ctx = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 375, height: 800 } });
  const nojs = await ctx.newPage();
  await nojs.goto('/');
  await expect(nojs.locator('.feed > .row > .pane').first()).toBeAttached();
  expect(await nojs.locator('.feed [inert]').count()).toBe(0);
  await ctx.close();
});

test('#18: at 320 px a long return, a 40-character name and a 20-character handle stay inside the card', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('/');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  for (const [handle, shown] of [[LONG, '+12345.6%'], ['f10f_total', '≈-100.0%']]) {
    const row = page.locator(`.feed > .row[data-handle="${handle}"]`).filter({ has: page.locator('.ret', { hasText: shown }) }).first();
    await row.scrollIntoViewIfNeeded();
    const m = await row.evaluate((r) => {
      const card = r.querySelector('.card')!, hero = card.querySelector('.hero')!, ret = card.querySelector('.ret')!, who = card.querySelector('header .who')!;
      const range = document.createRange();
      range.selectNodeContents(ret);
      const cs = getComputedStyle(card), c = card.getBoundingClientRect();
      return {
        text: range.getBoundingClientRect().width, hero: hero.clientWidth,
        whoRight: who.getBoundingClientRect().right, contentRight: c.right - parseFloat(cs.paddingRight),
        cardWidth: c.width, rowWidth: r.clientWidth, rowScroll: r.scrollWidth,
      };
    });
    expect(m.text, `${shown}: figure width`).toBeLessThanOrEqual(m.hero * 0.9);
    expect(m.whoRight, `${handle}: name inside the card`).toBeLessThanOrEqual(m.contentRight + 1);
    expect(Math.abs(m.cardWidth - m.rowWidth), `${handle}: card as wide as its row`).toBeLessThanOrEqual(1);
    expect(m.rowScroll, `${handle}: card + pane, nothing wider`).toBeLessThanOrEqual(2 * m.rowWidth + 1);
  }
  // The long name and the whole handle are on the card (wrapped, not cut).
  const who = page.locator(`.feed > .row[data-handle="${LONG}"]`).first().locator('.card header .who');
  await expect(who).toHaveText(`${NAME} @${LONG}`);
  expect(await who.evaluate((a) => a.scrollWidth <= a.clientWidth + 1)).toBe(true);
});
