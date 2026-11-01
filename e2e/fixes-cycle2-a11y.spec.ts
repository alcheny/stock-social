// FIXES-CYCLE2-A11Y (approval council cycle 2 fixes #12, #13, #14, #26 and the range-button target size;
// docs/features/logs/fixes-cycle2-a11y/): the browser side of lib/fixes-cycle2-a11y.test.ts, against the real app
// (needs `npm run db:seed` only for the shared feed to exist). #18's nav and reflow are #55's (e2e/f13-first-visit.spec.ts,
// e2e/a11y-feed.spec.ts) and are not repeated here. Every assertion is scoped to this file's own users: one demo trader
// (unverified closes, so a Demo badge, with a 40-character unbroken display name and a 20-character handle) and
// signed-in viewers with 20-character handles, all removed afterwards; seeded traders are never touched. The trader's
// closes are feed-eligible, so the file holds the feed lock shared (e2e/feed-lock.ts). Fit assertions keep ≥ 15% headroom.
import { expect, test, type Browser, type Locator, type Page } from '@playwright/test';
import postgres from 'postgres';
import { feedLock } from './feed-lock.ts';

const sql = postgres(process.env.DATABASE_URL!, { max: 2, onnotice: () => {} });
const SCHEMES = ['light', 'dark'] as const;
// New gain/loss tokens (#26) as computed colours.
const UPDOWN = { light: { up: 'rgb(11, 107, 112)', down: 'rgb(178, 68, 27)' }, dark: { up: 'rgb(60, 196, 180)', down: 'rgb(255, 138, 91)' } } as const;
const FOCUS = { light: 'rgb(33, 82, 217)', dark: 'rgb(134, 168, 255)' } as const;

// A unique handle of exactly 20 characters, matching ^[a-z0-9_]{3,20}$.
const handle20 = (prefix: string) => (prefix + Array.from({ length: 20 }, () => 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)]).join('')).slice(0, 20);
const NAME40 = ('Unbrokendisplayname' + 'x'.repeat(40)).slice(0, 40);

let release: () => Promise<void> = async () => {};
let trader = { id: 0, handle: '', trades: [] as string[] };
const viewers: string[] = [];

test.beforeAll(async () => {
  release = await feedLock('shared');
  const h = handle20('cy2t');
  const [u] = await sql`with a as (insert into signup_attempts (method, adult_attested_at) values ('dev', now()) returning id)
    insert into users (handle, display_name, adult_attested_at, signup_attempt_id) select ${h}, ${NAME40}, now(), a.id from a returning id`;
  // Five recent demo closes (unverified: the Demo badge), gains and losses, each with a short published thesis.
  const R = [0.124, -0.087, 0.051, -0.033, 0.212];
  const rows = R.map((r, i) => ({ user_id: u.id, sell_id: `${h}-${i}`, account_id: 'demo-acct', symbol: ['AAA', 'BBB', 'CCC', 'DDD', 'EEE'][i],
    opened_at: new Date(Date.now() - (i + 3) * 86_400_000), closed_at: new Date(Date.now() - (i + 1) * 3_600_000), return_pct: r, holding_days: i + 2,
    verified: false, thesis: 'Sold after the plan hit its exit level.', thesis_status: 'published' }));
  const ids = await sql`insert into closed_trades ${sql(rows)} returning id`;
  trader = { id: u.id, handle: h, trades: ids.map((x) => String(x.id)) };
});
// Deletes this file's own users and then their signup attempts (signup_attempts.user_id is only `on delete set null`,
// so the attempt rows would otherwise outlive the users).
async function removeUsers(ids: number[]) {
  if (!ids.length) return;
  const attempts = (await sql`select signup_attempt_id as a from users where id = any(${ids}) and signup_attempt_id is not null`).map((r) => r.a as number);
  // One transaction; the attempts' own child rows (login links, funnel events, connections) go first.
  await sql.begin(async (tx) => {
    await tx`delete from users where id = any(${ids})`;
    if (!attempts.length) return;
    for (const t of ['login_links', 'funnel_events', 'connections']) await tx`delete from ${tx(t)} where attempt_id = any(${attempts})`;
    await tx`delete from signup_attempts where id = any(${attempts})`;
  });
}
test.afterAll(async () => {
  const own = viewers.length ? (await sql`select id from users where handle = any(${viewers})`).map((r) => r.id as number) : [];
  await removeUsers([...(trader.id ? [trader.id] : []), ...own]);
  await release();
  await sql.end({ timeout: 1 });
});

async function signIn(page: Page, h: string) {
  viewers.push(h);
  await page.goto('/login/dev');
  await page.getByLabel('Handle').fill(h);
  await page.getByLabel('I am 18 or older').check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(new RegExp(`/u/${h}$`));
}
async function touchContext(browser: Browser, width: number, height: number, colorScheme: 'light' | 'dark' = 'light') {
  return browser.newContext({ viewport: { width, height }, hasTouch: true, isMobile: true, reducedMotion: 'reduce', colorScheme });
}
async function doubleTap(page: Page, el: Locator) {
  const b = (await el.boundingBox())!;
  const x = Math.round(b.x + b.width / 2), y = Math.round(b.y + b.height / 2);
  const cdp = await page.context().newCDPSession(page);
  const send = (type: 'touchStart' | 'touchEnd', pts: { x: number; y: number }[]) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
  await send('touchStart', [{ x, y }]); await send('touchEnd', []);
  await page.waitForTimeout(90);
  await send('touchStart', [{ x, y }]); await send('touchEnd', []);
  await cdp.detach();
}
// The trader's rows in the feed (page 1), in order; the test needs at least `n`.
async function ownRows(page: Page, n = 1) {
  const rows = page.locator(`.feed > .row[data-handle="${trader.handle}"]`);
  await expect.poll(() => rows.count(), { message: 'the fixture trader is on the first feed page' }).toBeGreaterThanOrEqual(n);
  return rows;
}
async function atRest(row: Locator) {
  await row.evaluate((r) => { r.scrollIntoView({ block: 'start' }); r.scrollLeft = 0; });
  await expect.poll(() => row.evaluate((r) => Math.round(r.getBoundingClientRect().top))).toBe(0);
}
type Box = { top: number; bottom: number; left: number; right: number; height: number };
const rect = (l: Locator): Promise<Box> => l.evaluate((e) => { const b = e.getBoundingClientRect(); return { top: b.top, bottom: b.bottom, left: b.left, right: b.right, height: b.height }; });
const navBottom = (page: Page) => page.locator('nav.top').evaluate((n) => n.getBoundingClientRect().bottom);
const barOf = (page: Page, sel: string) => rect(page.locator(sel));
// Bottom of every focusable element inside `scope`.
const focusables = (scope: Locator) => scope.evaluate((s) => [...s.querySelectorAll<HTMLElement>('a[href], button, summary, input, [tabindex="0"]')]
  .filter((e) => e.offsetParent).map((e) => ({ what: e.textContent!.trim().slice(0, 30), bottom: e.getBoundingClientRect().bottom, top: e.getBoundingClientRect().top })));
// The card's content when not stretched: paddings, gaps, the hero's own children and every other child.
const intrinsic = (card: Locator) => card.evaluate((c) => {
  const cs = getComputedStyle(c), gap = parseFloat(cs.rowGap) || 0;
  const kids = [...c.children].filter((k) => (k as HTMLElement).offsetParent) as HTMLElement[];
  let need = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom) + gap * (kids.length - 1);
  for (const k of kids) {
    const ks = getComputedStyle(k);
    if (k.classList.contains('hero')) {
      const inner = [...k.children] as HTMLElement[];
      need += inner.reduce((a, e) => a + e.getBoundingClientRect().height, 0) + (parseFloat(ks.rowGap) || 0) * (inner.length - 1);
    } else need += k.getBoundingClientRect().height + parseFloat(ks.marginTop) + parseFloat(ks.marginBottom);
  }
  return { need, room: c.clientHeight };
});
// Tab through every focusable element of `scope`, starting on its first; each must sit below the nav and, while the bar
// still shows, ≥ 8 px above it. (The signed-out sign-in line closes once focus moves outside it, #55 / F-10 #15; the
// hide bar stays while the pointer holds it.) Returns how many focused elements were checked against a showing bar.
async function tabThrough(page: Page, scope: Locator, barSel: string) {
  let checked = 0;
  const n = (await focusables(scope)).length;
  expect(n).toBeGreaterThan(0);
  await scope.locator('a[href], button, summary').first().focus();
  for (let i = 0; i < n; i++) {
    const inside = await scope.evaluate((s) => s.contains(document.activeElement));
    if (!inside) break;
    const f = await page.evaluate(() => { const b = document.activeElement!.getBoundingClientRect(); return { top: b.top, bottom: b.bottom, what: document.activeElement!.textContent!.trim().slice(0, 30) }; });
    const shows = await page.locator(barSel).evaluate((b) => b.getBoundingClientRect().height > 0).catch(() => false);
    const nav = await navBottom(page);
    if (shows) { expect(f.bottom, `"${f.what}" ends 8 px above the bar`).toBeLessThanOrEqual((await barOf(page, barSel)).top - 8); checked++; }
    expect(f.top, `"${f.what}" starts below the nav`).toBeGreaterThanOrEqual(nav);
    await page.keyboard.press('Tab');
  }
  return checked;
}
// Colour helpers: computed colours as [r, g, b, a] in 0-255, painted backdrops, WCAG contrast.
type RGBA = [number, number, number, number];
const parseColor = (c: string): RGBA => {
  const m = c.match(/^rgba?\(([^)]+)\)$/);
  if (m) { const p = m[1].split(',').map((v) => parseFloat(v)); return [p[0], p[1], p[2], p[3] ?? 1]; }
  const s = c.match(/^color\(srgb ([\d.e-]+) ([\d.e-]+) ([\d.e-]+)(?: \/ ([\d.]+))?\)$/);
  if (s) return [Number(s[1]) * 255, Number(s[2]) * 255, Number(s[3]) * 255, s[4] ? Number(s[4]) : 1];
  throw new Error(`unparsed colour ${c}`);
};
const lum = ([r, g, b]: RGBA) => { const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const ratio = (a: RGBA, b: RGBA) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
// What is painted behind `el` (its parent chain's backgrounds composited over the page canvas).
const backdrop = (el: Locator) => el.evaluate((e) => {
  const layers: string[] = [];
  for (let n: Element | null = e.parentElement; n; n = n.parentElement) layers.push(getComputedStyle(n).backgroundColor);
  return layers;
}).then((layers) => {
  let out: RGBA = [255, 255, 255, 1];
  for (const l of layers.reverse()) {
    const c = parseColor(l);
    if (c[3] === 0) continue;
    out = [0, 1, 2].map((i) => c[i] * c[3] + out[i] * (1 - c[3])) as unknown as RGBA;
    out[3] = 1;
  }
  return out;
});

test('AC26.4: gain and loss figures on the profile and the feed card use the new tokens in both schemes', async ({ browser }) => {
  for (const colorScheme of SCHEMES) {
    const ctx = await browser.newContext({ viewport: { width: 360, height: 740 }, colorScheme });
    const page = await ctx.newPage();
    await page.goto(`/u/${trader.handle}`);
    const main = page.locator('main.page');
    await expect(main.locator('.badge.demo').first()).toHaveText('Demo');
    await expect(main.locator('.up').first()).toHaveCSS('color', UPDOWN[colorScheme].up);
    await expect(main.locator('.down').first()).toHaveCSS('color', UPDOWN[colorScheme].down);
    // The feed card's figure too.
    await page.goto('/');
    const rows = await ownRows(page);
    for (const id of trader.trades) {
      const ret = page.locator(`.feed > .row[data-trade="${id}"] .card .ret`);
      if (await ret.count()) await expect(ret).toHaveCSS('color', (await ret.getAttribute('class'))!.includes('up') ? UPDOWN[colorScheme].up : UPDOWN[colorScheme].down);
    }
    expect(await rows.count()).toBeGreaterThan(0);
    await ctx.close();
  }
});

// The current-row cue exists where a pane is opened for one trade: a profile's "Similar trades" sheet (app/lazy-pane.tsx;
// the feed's own panes mark no row). The fixture trader's profile has 5 closes held 2-6 days; three more demo traders of
// this file's own, in the same holding bucket and in the section pool (created 60 days ago, closes two days ago: before
// the pool's hour, as e2e/similar.spec.ts does), make sure the section has its 3 rows. The sheet's pane marks the row's trade.
async function similarTraders() {
  const ids: number[] = [];
  const at = Date.now() - 2 * 86_400_000;
  try { for (let t = 0; t < 3; t++) {
    const h = handle20(`cy2s${t}`);
    const [u] = await sql`with a as (insert into signup_attempts (method, adult_attested_at) values ('dev', now()) returning id)
      insert into users (handle, display_name, adult_attested_at, signup_attempt_id, created_at) select ${h}, ${`Similar fixture ${t}`}, now(), a.id, now() - interval '60 days' from a returning id`;
    ids.push(u.id as number);
    await sql`insert into closed_trades ${sql(Array.from({ length: 6 }, (_, i) => ({ user_id: u.id, sell_id: `${h}-${i}`, account_id: 'demo-acct', symbol: `Z${'ABC'[t]}${i}`,
      opened_at: new Date(at - (t * 6 + i) * 60_000 - 3 * 86_400_000), closed_at: new Date(at - (t * 6 + i) * 60_000), return_pct: i % 2 ? 0.05 : -0.04, holding_days: 3, verified: false })))}`;
  } } catch (e) { await removeUsers(ids); throw e; }
  return { remove: () => removeUsers(ids) };
}
test('AC12.2: the pane\'s current row is outlined in --focus (≥ 3:1 on the painted backdrop), offset ≥ 2 px, weight ≥ 600, both schemes', async ({ browser }) => {
  test.setTimeout(120_000);
  const others = await similarTraders();
  try { for (const colorScheme of SCHEMES) {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 800 }, colorScheme, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    // The section's pool is rebuilt in the background (lib/similar.ts): reload until it shows.
    await expect(async () => {
      await page.goto(`/u/${trader.handle}`);
      await expect(page.locator('.similar .sopen').first()).toBeVisible({ timeout: 500 });
    }).toPass({ timeout: 40_000, intervals: [500, 2_000, 5_000] });
    await page.locator('.similar .sopen').first().click();
    const sheet = page.locator('dialog.pane-sheet[open]');
    const hl = sheet.locator('.pane .rows .line.hl');
    await expect(hl).toHaveCount(1);
    await expect(hl).toHaveAttribute('aria-current', 'true');
    const s = await hl.evaluate((e) => { const c = getComputedStyle(e); return { color: c.outlineColor, style: c.outlineStyle, width: c.outlineWidth, offset: c.outlineOffset, weight: c.fontWeight,
      token: getComputedStyle(document.documentElement).getPropertyValue('--focus').trim() }; });
    expect(s.color).toBe(FOCUS[colorScheme]);
    expect(s.token).toBe(colorScheme === 'light' ? '#2152d9' : '#86a8ff');
    expect(s.style).toBe('solid');
    expect(parseFloat(s.width)).toBeGreaterThanOrEqual(2);
    expect(parseFloat(s.offset)).toBeGreaterThanOrEqual(2);
    expect(Number(s.weight)).toBeGreaterThanOrEqual(600);
    // The ring sits 2 px outside the row, on what the sheet paints there.
    const r = ratio(parseColor(s.color), await backdrop(hl));
    expect(r, `${colorScheme} outline ${r.toFixed(2)}:1`).toBeGreaterThanOrEqual(3);
    test.info().annotations.push({ type: `hl ${colorScheme}`, description: r.toFixed(2) });
    await ctx.close();
  } } finally { await others.remove(); }
});

test('AC13.1: control borders (input, pane and menu .secondary, the "…" summary) are ≥ 3:1 against what is painted behind them, both schemes', async ({ browser }) => {
  test.setTimeout(90_000);
  const ctx = await browser.newContext({ viewport: { width: 375, height: 800 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  const check = async (l: Locator, what: string, min = 3) => {
    const c = parseColor(await l.evaluate((e) => getComputedStyle(e).borderTopColor));
    const r = ratio(c, await backdrop(l));
    expect(r, `${what}: ${r.toFixed(2)}:1`).toBeGreaterThanOrEqual(min);
    return r;
  };
  const results: Record<string, string> = {};
  for (const colorScheme of SCHEMES) {
    await page.emulateMedia({ colorScheme });
    await page.goto('/login/dev');
    results[`${colorScheme} input`] = (await check(page.getByLabel('Handle'), `${colorScheme} input`)).toFixed(2);
  }
  await page.emulateMedia({ colorScheme: 'light' });
  await signIn(page, handle20('cy2c'));
  for (const colorScheme of SCHEMES) {
    await page.emulateMedia({ colorScheme });
    await page.goto('/');
    const row = (await ownRows(page)).first();
    await atRest(row);
    const summary = row.locator('.card .more-menu summary');
    results[`${colorScheme} summary`] = (await check(summary, `${colorScheme} .more-menu summary`)).toFixed(2);
    await summary.click();
    results[`${colorScheme} menu`] = (await check(row.locator('.card .more-menu .secondary').first(), `${colorScheme} .more-menu .secondary`)).toFixed(2);
    await summary.click();
    await expect.poll(async () => { await page.keyboard.press('ArrowRight'); return row.evaluate((r) => r.scrollLeft); }).toBeGreaterThan(300);
    results[`${colorScheme} follow`] = (await check(row.locator('.pane .follow.secondary').first(), `${colorScheme} pane .follow.secondary`)).toFixed(2);
    results[`${colorScheme} pane-summary`] = (await check(row.locator('.pane .more-menu summary').first(), `${colorScheme} pane .more-menu summary`)).toFixed(2);
  }
  test.info().annotations.push({ type: 'contrast', description: JSON.stringify(results) });
  await ctx.close();
});

for (const height of [740, 640]) {
  test(`AC14.1 + AC14.4 (360×${height}, signed out): with the sign-in line up, every control in the card ends ≥ 8 px above it; Tab never lands under it; the figure, badge and record link are never clipped`, async ({ browser }) => {
    const ctx = await touchContext(browser, 360, height);
    const page = await ctx.newPage();
    await page.goto('/');
    const row = (await ownRows(page)).first();
    await atRest(row);
    const card = row.locator('.card');
    await expect(card).toHaveCSS('padding-bottom', '28px'); // no bar, no change
    await expect.poll(async () => { await doubleTap(page, card.locator('.hero .ret')); return page.locator('.signin-line').innerText(); }).toContain('Sign in to like trades.');
    await expect(card).toHaveCSS('padding-bottom', '94px');
    const bar = await barOf(page, '.signin-line');
    for (const f of await focusables(card)) expect(f.bottom, `"${f.what}"`).toBeLessThanOrEqual(bar.top - 8);
    // Decision 5: never the signed return figure, the Demo badge or the record link; with F-10, never the card's
    // disclaimer either (POLICY F3).
    const nav = await navBottom(page);
    const clip = await rect(row);
    await expect(card.locator('[data-disclaimer]')).toHaveText('Not investment advice. Past performance does not guarantee future results.');
    for (const sel of ['.hero .ret', '.badge.demo', 'footer a', '[data-disclaimer]']) {
      const b = await rect(card.locator(sel).first());
      expect(b.top, `${sel} below the nav`).toBeGreaterThanOrEqual(nav);
      expect(b.bottom, `${sel} above the bar`).toBeLessThanOrEqual(bar.top - 8);
      expect(b.bottom, `${sel} inside the row`).toBeLessThanOrEqual(clip.bottom);
    }
    await expect(card.locator('footer a')).toHaveText(/See their record/);
    // AC14.4: nothing clips, with 15% to spare.
    expect(await card.evaluate((c) => c.scrollHeight <= c.clientHeight + 1)).toBe(true);
    const fit = await intrinsic(card);
    expect(fit.need, `card content ${fit.need.toFixed(0)} of ${fit.room} px`).toBeLessThanOrEqual(0.85 * fit.room);
    test.info().annotations.push({ type: `fit 360×${height}`, description: JSON.stringify({ need: Math.round(fit.need), room: fit.room, barTop: bar.top,
      disclaimerBottom: (await rect(card.locator('[data-disclaimer]'))).bottom, linkBottom: (await rect(card.locator('footer a'))).bottom }) });
    await tabThrough(page, card, '.signin-line');
    // The row's snap point is unchanged: it still rests at the top.
    await atRest(row);
    await ctx.close();
  });
}

test('AC14.1 (360×480, 360×420, 320×420, signed out): on a short viewport the card scrolls inside itself; the badge and the disclaimer stop ≥ 8 px above the sign-in line; no part is squeezed away', async ({ browser }) => {
  for (const [width, height] of [[360, 480], [360, 420], [320, 420]]) {
    const ctx = await touchContext(browser, width, height);
    const page = await ctx.newPage();
    await page.goto('/');
    const row = (await ownRows(page)).first();
    await atRest(row);
    const card = row.locator('.card');
    await expect.poll(async () => { await doubleTap(page, card.locator('.hero .ret')); return page.locator('.signin-line').innerText(); }).toContain('Sign in to like trades.');
    await expect(card).toHaveCSS('overflow-y', 'auto');
    // The bar's room holds on a short viewport too (it outranks F-10's 12 px card padding).
    await expect(card).toHaveCSS('padding-bottom', '94px');
    await expect(card).toHaveCSS('scroll-padding-bottom', '94px');
    const at = `${width}×${height}`;
    // Nothing collapses to make room: the thesis keeps at least its one line.
    expect((await rect(card.locator('.thesis'))).height, `${at}: thesis`).toBeGreaterThanOrEqual(16);
    const bar = await barOf(page, '.signin-line');
    expect((await rect(card.locator('.badge.demo').first())).bottom, `${at}: badge`).toBeLessThanOrEqual(bar.top - 8);
    // Scrolled to its end (no focus move, so the line stays): the disclaimer clears the bar.
    await card.evaluate((c) => { c.scrollTop = c.scrollHeight; });
    expect((await rect(card.locator('[data-disclaimer]'))).bottom, `${at}: disclaimer at the end`).toBeLessThanOrEqual(bar.top - 8);
    const discBottom = (await rect(card.locator('[data-disclaimer]'))).bottom;
    // At 320×420 the record line wraps to three lines and the card really overflows: it scrolls, nothing is cut.
    if (width === 320) expect(await card.evaluate((c) => c.scrollHeight > c.clientHeight), `${at}: the card overflows and scrolls`).toBe(true);
    test.info().annotations.push({ type: `short ${at}`, description: JSON.stringify({ barTop: bar.top, disclaimerBottom: discBottom, thesis: (await rect(card.locator('.thesis'))).height, scroll: await card.evaluate((c) => [c.scrollHeight, c.clientHeight]) }) });
    // Focus moving into the card closes the sign-in line (#55 / F-10 #15), so focus is never under it; the focused-link
    // case under a bar that stays is the hide bar's, below.
    await card.evaluate((c) => { c.scrollTop = 0; });
    const link = card.locator('footer a');
    await link.focus();
    await expect(page.locator('.signin-line')).toBeEmpty();
    await ctx.close();
  }
});

test('AC14.1 (360×420, signed in): under the hide bar, a focused record link in the short, scrolling card stops ≥ 8 px above the bar (the card\'s own 94 px scroll padding)', async ({ browser }) => {
  test.setTimeout(90_000);
  const ctx = await browser.newContext({ viewport: { width: 360, height: 420 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await signIn(page, handle20('cy2k'));
  await page.goto('/');
  const rows = await ownRows(page, 2);
  const [first, second] = [rows.nth(0), rows.nth(1)];
  const secondId = await second.getAttribute('data-trade');
  await atRest(first);
  await first.locator('.card .more-menu summary').focus();
  await page.keyboard.press('Enter');
  await first.getByRole('button', { name: 'Hide this trade' }).focus();
  await page.keyboard.press('Enter');
  const barP = page.locator('.hide-bar > p');
  await expect(barP).toContainText('Trade hidden.');
  await page.locator('.hide-bar').hover();
  const next = page.locator(`.feed > .row[data-trade="${secondId}"]`);
  await atRest(next);
  const card = next.locator('.card');
  await expect(card).toHaveCSS('overflow-y', 'auto');
  await expect(card).toHaveCSS('scroll-padding-bottom', '94px');
  for (const sel of ['footer a', '[data-disclaimer]']) {
    await card.evaluate((c) => { c.scrollTop = 0; });
    if (sel === 'footer a') await card.locator(sel).focus();
    else await card.evaluate((c) => { c.scrollTop = c.scrollHeight; });
    await expect(barP).toBeVisible();
    const bar = await barOf(page, '.hide-bar > p');
    expect((await rect(card.locator(sel))).bottom, `${sel} clears the hide bar`).toBeLessThanOrEqual(bar.top - 8);
  }
  await ctx.close();
});

test('AC14.2 (360×740, signed in): with the hide bar up, the next card\'s controls and the pane opened with → stay ≥ 8 px above it; Escape puts the padding back to 28 px', async ({ browser }) => {
  test.setTimeout(90_000);
  const ctx = await browser.newContext({ viewport: { width: 360, height: 740 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  const me = handle20('cy2h');
  await signIn(page, me);
  await page.goto('/');
  const rows = await ownRows(page, 2);
  const [first, second] = [rows.nth(0), rows.nth(1)];
  const secondId = await second.getAttribute('data-trade');
  await atRest(first);
  const summary = first.locator('.card .more-menu summary');
  await summary.focus();
  await page.keyboard.press('Enter');
  await first.getByRole('button', { name: 'Hide this trade' }).focus();
  await page.keyboard.press('Enter');
  const barP = page.locator('.hide-bar > p');
  await expect(barP).toContainText('Trade hidden.');
  await page.locator('.hide-bar').hover(); // holds the bar open (WCAG 2.2.1 pause) while we measure
  const next = page.locator(`.feed > .row[data-trade="${secondId}"]`);
  await atRest(next);
  const card = next.locator('.card');
  await expect(card).toHaveCSS('padding-bottom', '94px');
  const bar = await barOf(page, '.hide-bar > p');
  for (const f of await focusables(card)) expect(f.bottom, `"${f.what}"`).toBeLessThanOrEqual(bar.top - 8);
  const fit = await intrinsic(card);
  expect(fit.need).toBeLessThanOrEqual(0.85 * fit.room);
  expect(await tabThrough(page, card, '.hide-bar > p'), 'the hide bar stayed up while Tab moved through the card').toBeGreaterThan(1);
  // The pane, opened with →: its scroller pads 94 px, so Tab never lands under the bar.
  await atRest(next);
  await page.locator('.hide-bar').hover();
  await expect.poll(async () => { await page.keyboard.press('ArrowRight'); return next.evaluate((r) => r.scrollLeft); }).toBeGreaterThan(300);
  const pane = next.locator('.pane');
  await expect(pane).toHaveCSS('scroll-padding-bottom', '94px');
  await expect(pane).toHaveCSS('padding-bottom', '94px');
  await expect(barP).toBeVisible();
  expect(await tabThrough(page, pane, '.hide-bar > p'), 'the hide bar stayed up while Tab moved through the pane').toBeGreaterThan(1);
  await expect(barP).toBeVisible();
  // Escape (from the bar) closes it and the room goes away.
  await page.locator('.hide-bar').getByRole('button', { name: 'Undo' }).focus();
  await page.keyboard.press('Escape');
  await expect(barP).toHaveCount(0);
  await expect(card).toHaveCSS('padding-bottom', '28px');
  await expect(pane).toHaveCSS('padding-bottom', '28px');
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollPaddingBottom)).not.toBe('94px');
  await ctx.close();
});

test('AC14.3 (no JavaScript, ?done=trade-hidden): the confirmation line shows and the card\'s links end ≥ 8 px above it', async ({ browser }) => {
  const js = await browser.newContext({ viewport: { width: 360, height: 740 } });
  const p0 = await js.newPage();
  await signIn(p0, handle20('cy2n'));
  const state = await js.storageState();
  await js.close();
  const ctx = await browser.newContext({ viewport: { width: 360, height: 740 }, javaScriptEnabled: false, storageState: state });
  const page = await ctx.newPage();
  await page.goto('/?done=trade-hidden');
  const done = page.locator('.nojs-done');
  await expect(done).toBeVisible();
  const row = (await ownRows(page)).first();
  await row.scrollIntoViewIfNeeded();
  await expect.poll(async () => Math.round((await rect(row)).top)).toBe(0);
  const card = row.locator('.card');
  await expect(card).toHaveCSS('padding-bottom', '94px');
  const bar = await rect(done);
  for (const f of await focusables(card)) expect(f.bottom, `"${f.what}"`).toBeLessThanOrEqual(bar.top - 8);
  // F-20 (committee R3): the 94 px room covers the bar and its 16 px offset at 360 and 320 (measured 72 px tall at 360).
  for (const width of [360, 320]) {
    await page.setViewportSize({ width, height: 740 });
    const h = (await rect(done)).height;
    test.info().annotations.push({ type: `no-JS bar height ${width}`, description: `${h}` });
    expect(h + 16, `${width}: bar ${h} px + 16 px off the bottom`).toBeLessThanOrEqual(94);
  }
  await ctx.close();
});

test('Target size: the profile chart\'s range buttons are ≥ 44 × 44 px at 320 and 360 and stay on one row inside the viewport', async ({ browser }) => {
  for (const width of [320, 360]) {
    const ctx = await browser.newContext({ viewport: { width, height: 740 }, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await page.goto(`/u/${trader.handle}`);
    const tabs = page.locator('.tabs button');
    await expect(tabs.first()).toBeVisible();
    const boxes = await tabs.evaluateAll((els) => els.map((e) => { const b = e.getBoundingClientRect(); return { w: b.width, h: b.height, top: b.top, left: b.left, right: b.right }; }));
    expect(boxes.length).toBeGreaterThan(1);
    for (const b of boxes) {
      expect(b.h, `${width}: height ${b.h}`).toBeGreaterThanOrEqual(44);
      expect(b.w, `${width}: width ${b.w}`).toBeGreaterThanOrEqual(44);
      expect(b.left).toBeGreaterThanOrEqual(0);
      expect(b.right).toBeLessThanOrEqual(width);
    }
    expect(new Set(boxes.map((b) => Math.round(b.top))).size, `${width}: one row`).toBe(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    test.info().annotations.push({ type: `tabs ${width}`, description: JSON.stringify(boxes.map((b) => [Math.round(b.w), Math.round(b.h)])) });
    await ctx.close();
  }
});
