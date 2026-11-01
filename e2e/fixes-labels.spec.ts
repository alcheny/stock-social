// Fixes-labels (docs/features/logs/fixes-labels/plan.md §6) against the running app at 360×740:
// AC3 the Demo scan (Demo pages never say "verified"), AC5 dates (the year rule, the chart's ends and at-rest subline),
// AC7 the C1 route walk (every app/**/page.tsx that shows a percent figure has the F3 line in view, clear of the fixed
// bars; an unmapped dynamic route fails), AC8 the trade and month boxes end with it, AC15 the month copy, AC16 the
// images. The fixture trader is its own (`fl_owner`), deleted before and after; it is feed-eligible (5 closes in the
// last day, each with a 280-character thesis), so the shared feed lock is held while it exists (as f6 and similar).
import { test, expect, type Browser, type Locator, type Page } from '@playwright/test';
import postgres from 'postgres';
import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { feedLock } from './feed-lock.ts';
import { dateText } from '../lib/date-text.ts';

const sql = postgres(process.env.DATABASE_URL!, { max: 2, onnotice: () => {} });
const VIEW = { width: 360, height: 740 };
const PCT = /[+−-]?\d+(\.\d+)?%/;
const DISCLAIMER = 'Not investment advice. Past performance does not guarantee future results.';
const OWNER = 'fl_owner';
const DAY = 86_400_000;
const THESIS = `${'Bought the breakout after earnings and sold into strength two days later. '.repeat(4)}`.slice(0, 280);
const OLD_CLOSE = new Date('2020-05-30T15:00:00Z');
const BASE = 'http://localhost:3000'; // playwright.config.ts baseURL

test.describe.configure({ mode: 'serial' });

let releaseFeed: (() => Promise<void>) | null = null;
let owner = 0;
const maya = { sell: '', ym: '' };
let lastClose = new Date();

test.beforeAll(async () => {
  releaseFeed = await feedLock('shared');
  await sql`delete from users where handle = ${OWNER}`;
  const [u] = await sql`
    with a as (insert into signup_attempts (method, adult_attested_at) values ('dev', now()) returning id)
    insert into users (handle, display_name, adult_attested_at, signup_attempt_id) select ${OWNER}, 'FL Owner', now(), a.id from a returning id, signup_attempt_id`;
  owner = u.id;
  const now = Date.now();
  const closes = [0.21, -0.18, 0.12, -0.09, 0.15].map((r, i) => ({
    user_id: u.id, sell_id: `${OWNER}-${i}`, account_id: 'a', symbol: `FLX${i}`, opened_at: new Date(now - (0.05 + i * 0.01 + 2) * DAY),
    closed_at: new Date(now - (0.05 + i * 0.01) * DAY), return_pct: r, holding_days: 2, verified: true, thesis: THESIS, thesis_status: 'published',
  }));
  closes.push({ user_id: u.id, sell_id: `${OWNER}-old`, account_id: 'a', symbol: 'FLXO', opened_at: new Date(OLD_CLOSE.getTime() - 3 * DAY), closed_at: OLD_CLOSE,
    return_pct: -0.04, holding_days: 3, verified: true, thesis: null as unknown as string, thesis_status: null as unknown as string });
  await sql`insert into closed_trades ${sql(closes)}`;
  lastClose = closes[0].closed_at;
  await sql`insert into connections (attempt_id, user_id, state, consent_at, importing_at, connected_at, last_progress_at)
    values (${u.signup_attempt_id}, ${u.id}, 'connected', now(), now(), now(), now())`;
  // A like of a Demo trade, so /me/likes prints percent figures.
  await sql`insert into trade_likes (viewer_id, trade_key, trader_id)
    select ${u.id}, t.trade_key, t.user_id from closed_trades t join users m on m.id = t.user_id where m.handle = 'momentum_maya' order by t.closed_at desc limit 1`;
  const [m] = await sql`select t.sell_id, to_char(t.closed_at at time zone 'UTC', 'YYYY-MM') as ym from closed_trades t join users u on u.id = t.user_id
    where u.handle = 'momentum_maya' order by t.closed_at desc limit 1`;
  maya.sell = m.sell_id; maya.ym = m.ym;
});
test.afterAll(async () => {
  await sql`delete from users where handle = ${OWNER}`;
  await releaseFeed?.();
  await sql.end({ timeout: 1 });
});

async function signIn(page: Page, handle: string) {
  await page.goto('/login/dev');
  await page.getByLabel('Handle').fill(handle);
  await page.getByLabel('I am 18 or older').check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(new RegExp(`/u/${handle}$`));
}

// The page's text without the site footer (it carries the F3 line on every page).
const mainText = (page: Page) => page.evaluate(() => (document.querySelector('main') as HTMLElement | null)?.innerText ?? '');

type Box = { x: number; y: number; width: number; height: number };
const meets = (a: Box, b: Box) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

// The F3 line is in the viewport, whole, and under none of the fixed overlays. `fold`: the share of the viewport's
// height it must leave below it (15% headroom on a page; a feed card ends at its bar zone instead, checked apart).
// The record's figures (the strip) centred in the viewport, as a reader scrolling to them sees them.
async function recordInView(page: Page) {
  await page.locator('section[aria-labelledby="whole-record"] [data-strip]').evaluate((el) => el.scrollIntoView({ block: 'center' }));
}

async function inPlainView(page: Page, line: Locator, what: string, fold = 0.15) {
  await expect(line, what).toHaveText(DISCLAIMER);
  await expect(line, what).toBeVisible();
  const box = (await line.boundingBox())!;
  const vh = page.viewportSize()!.height;
  expect(box.y, `${what}: top in view`).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height, `${what}: bottom in view with ${fold * 100}% headroom`).toBeLessThanOrEqual(vh * (1 - fold));
  for (const sel of ['nav.top', '.signin-line:not(:empty)', '.hide-bar p']) {
    for (const o of await page.locator(sel).all()) {
      if (!(await o.isVisible())) continue;
      expect(meets(box, (await o.boundingBox())!), `${what}: clear of ${sel}`).toBe(false);
    }
  }
  return box;
}

// app/**/page.tsx → route patterns ('/u/[handle]', '/t/compare', '/').
function routes(dir = 'app', base = ''): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) out.push(...routes(p, `${base}/${name}`));
    else if (name === 'page.tsx') out.push(base || '/');
  }
  return out.sort();
}

test('C1 (AC7): every route that shows a percent figure has the F3 line in plain view at 360×740; /connect and /login show none; an unmapped dynamic route fails', async ({ browser }) => {
  test.setTimeout(180_000);
  const MAP: Record<string, string> = {
    '/u/[handle]': '/u/momentum_maya',
    '/u/[handle]/trade/[sellId]': `/u/momentum_maya/trade/${encodeURIComponent(maya.sell)}`,
    '/u/[handle]/month/[ym]': `/u/momentum_maya/month/${maya.ym}`,
    '/t/[symbol]': '/t/NVDA',
    '/t/compare': '/t/compare?a=NVDA&b=AMD',
  };
  const SIGNED_IN = new Set(['/me/following', '/me/likes', '/me/record', '/settings']);
  const all = routes();
  expect(all.length).toBeGreaterThan(15);
  const out = await browser.newContext({ viewport: VIEW });
  const inn = await browser.newContext({ viewport: VIEW });
  const signedIn = await inn.newPage();
  await signIn(signedIn, OWNER);
  const anon = await out.newPage();
  const shown: string[] = [];
  try {
    for (const route of all) {
      const url = MAP[route] ?? route;
      expect(url.includes('['), `unmapped dynamic route ${route}: add it to the fixture map`).toBe(false);
      const page = SIGNED_IN.has(route) ? signedIn : anon;
      await page.goto(url);
      const text = await mainText(page);
      const perf = PCT.test(text);
      if (route.startsWith('/connect') || route.startsWith('/login')) { expect(perf, `${route} shows no percent figure`).toBe(false); continue; }
      if (!perf) continue;
      shown.push(route);
      if (route === '/how') {
        // The first percent figure scrolled into view, then the F3 line is in view with it.
        await page.getByText(PCT).first().scrollIntoViewIfNeeded();
      }
      // Merged with F-12 (main #54): the trade and month pages carry one F3 line, the record strip's, right after the
      // record's figures; with the figures in view, the F3 line is in view with them.
      if (route === '/u/[handle]/trade/[sellId]' || route === '/u/[handle]/month/[ym]') await recordInView(page);
      const line = route === '/' ? page.locator('.feed > .row').first().locator('article.card [data-disclaimer]') : page.locator('main [data-disclaimer]').first();
      await inPlainView(page, line, route, route === '/' ? 0 : 0.15);
    }
    // The walk covered the performance routes it must (the list is generated, so a new one is walked too).
    for (const r of ['/', '/u/[handle]', '/u/[handle]/trade/[sellId]', '/u/[handle]/month/[ym]', '/t/[symbol]', '/t/compare', '/me/record', '/me/likes']) expect(shown, r).toContain(r);
  } finally {
    await out.close(); await inn.close();
  }
});

test('C1 (AC7): the feed: the fixture card with a 280-character thesis, its open pane and the first card of the next page each show the F3 line in view; one per card', async ({ browser }) => {
  test.setTimeout(180_000);
  const ctx = await browser.newContext({ viewport: VIEW, javaScriptEnabled: false });
  const page = await ctx.newPage();
  try {
    await page.goto('/');
    // One F3 line per card and per pane (none twice).
    const first = page.locator('.feed > .row').first();
    await expect(first.locator('article.card [data-disclaimer]')).toHaveCount(1);
    // Merged with F-10 (main #54): a card with the record strip carries the strip's F3 line as its footer's last line, so
    // the card's last child holds it (itself, or the footer); a card without a strip ends with the line itself.
    await expect(first.locator('article.card > :last-child').locator('xpath=self::*[@data-disclaimer] | descendant::*[@data-disclaimer]')).toHaveCount(1);
    await expect(first.locator('section.pane [data-disclaimer]')).toHaveCount(1);
    // The next page (the no-JS link is the same rows as the appended page): its first card.
    const more = page.locator('.feed-more a.button[href*="after="]');
    const next = (await more.count()) ? await more.first().getAttribute('href') : null;
    // The fixture card: its page found over plain HTTP (the shared database may hold many feed traders), then loaded.
    const url = await feedPageWith(OWNER);
    expect(url, `${OWNER} not in the feed`).not.toBeNull();
    await page.goto(url!);
    const row = page.locator(`.row[data-handle="${OWNER}"]`).first();
    await row.evaluate((el) => el.scrollIntoView());
    await expect(row.locator('.thesis')).toContainText(THESIS);
    const box = await inPlainView(page, row.locator('article.card [data-disclaimer]'), 'fixture card', 0);
    // Room under it for the fixed bars (16 + 62 + 16 px), so neither can cover it.
    expect(box.y + box.height).toBeLessThanOrEqual(VIEW.height - 78);
    // The card's content fits its row: the hero gives way, nothing overflows.
    expect(await row.locator('article.card').evaluate((el) => el.scrollHeight <= el.clientHeight + 1)).toBe(true);
    // D-05: the card's date follows the year rule.
    const id = await row.getAttribute('data-trade');
    const [t] = await sql`select closed_at from closed_trades where id = ${Number(id)}`;
    // (F-10: with the record strip the strip takes the "held · closed" line's place; the date shows only without one.)
    if (await row.locator('.hero [data-strip]').count()) await expect(row.locator('.hero .muted')).toHaveCount(0);
    else await expect(row.locator('.hero .muted')).toContainText(`closed ${dateText(t.closed_at, new Date())}`);
    // The open pane: the F3 line right after the figures, in view.
    await row.evaluate((el) => el.scrollTo({ left: el.clientWidth }));
    const pane = row.locator('section.pane');
    await inPlainView(page, pane.locator('[data-disclaimer]'), 'open pane');
    // Nothing in the off-screen pane (the chart's ends and their sr-only sentence) widens the page.
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(VIEW.width);
    if (next) {
      await page.goto(next);
      await inPlainView(page, page.locator('.feed > .row').first().locator('article.card [data-disclaimer]'), 'first card of the next page', 0);
    } else test.info().annotations.push({ type: 'note', description: 'one feed page only: no next page to check' });
  } finally {
    await ctx.close();
  }
});

// A plain GET to the app (node:http: no proxy settings from the environment apply to localhost).
const getText = (p: string) => new Promise<string>((resolve, reject) => {
  http.get(new URL(p, BASE), (res) => { let b = ''; res.setEncoding('utf8'); res.on('data', (c) => (b += c)); res.on('end', () => resolve(b)); }).on('error', reject);
});

// The feed page (server-rendered, as without JavaScript) that holds a card of `handle`, walking at most 40 pages.
async function feedPageWith(handle: string): Promise<string | null> {
  let url: string | null = '/';
  for (let i = 0; i < 40 && url; i++) {
    const html = await getText(url);
    if (html.includes(`data-handle="${handle}"`)) return url;
    url = /href="(\/\?after=[A-Za-z0-9_-]+)"/.exec(html)?.[1] ?? null;
  }
  return null;
}

async function touchContext(browser: Browser) {
  return browser.newContext({ viewport: VIEW, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
}
async function touches(page: Page, run: (send: (type: 'touchStart' | 'touchMove' | 'touchEnd', x?: number, y?: number) => Promise<void>) => Promise<void>) {
  const cdp = await page.context().newCDPSession(page);
  await run(async (type, x, y) => { await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: x!, y: y! }] }); });
  await cdp.detach();
}

test('C1 (AC7): with the sign-in line and the Undo bar raised, the first card\'s F3 line stays clear of them', async ({ browser }) => {
  test.setTimeout(120_000);
  // Signed out: a double tap raises the sign-in line (as likes.spec.ts).
  const a = await touchContext(browser);
  try {
    const page = await a.newPage();
    await page.goto('/');
    const row = page.locator('.feed > .row[data-trade]').first();
    const ret = (await row.locator('.card .hero .ret').boundingBox())!;
    const x = Math.round(ret.x + ret.width / 2), y = Math.round(ret.y + ret.height / 2);
    await touches(page, async (send) => { await send('touchStart', x, y); await send('touchEnd'); await page.waitForTimeout(90); await send('touchStart', x, y); await send('touchEnd'); });
    await expect(page.locator('.signin-line')).toContainText('Sign in to like trades.');
    await inPlainView(page, row.locator('article.card [data-disclaimer]'), 'card under the sign-in line', 0);
  } finally { await a.close(); }
  // Signed in: the reject swipe raises the Undo bar; the next card's F3 line stays clear of it.
  const b = await touchContext(browser);
  try {
    const page = await b.newPage();
    await signIn(page, OWNER);
    await page.goto('/');
    const row = page.locator(`.feed > .row[data-trade]:not([data-handle="${OWNER}"])`).first();
    const card = row.locator('article.card');
    const box = (await card.boundingBox())!;
    // A rightward swipe past half the card hides the trade (leftward opens the pane), as in likes.spec.ts.
    await page.waitForTimeout(500); // hydrated
    const y = Math.round(box.y + box.height / 2), x0 = Math.round(box.x + 10), dx = Math.round(box.width * 0.6);
    await touches(page, async (send) => {
      await send('touchStart', x0, y);
      for (let i = 1; i <= 20; i++) { await send('touchMove', x0 + (dx * i) / 20, y); await page.waitForTimeout(16); }
      await page.waitForTimeout(120);
      await send('touchEnd');
    });
    await expect(page.locator('.hide-bar')).toContainText('Trade hidden.');
    const visible = page.locator('.feed > .row[data-trade]:visible').first();
    await visible.evaluate((el) => el.scrollIntoView());
    await inPlainView(page, visible.locator('article.card [data-disclaimer]'), 'card under the Undo bar', 0);
  } finally { await b.close(); }
});

test('AC8 + AC15: the trade and month pages carry one F3 line, right after the record figures, in view; the month shows numbers and a range, never a verdict', async ({ page }) => {
  await page.setViewportSize(VIEW);
  await page.goto(`/u/momentum_maya/trade/${encodeURIComponent(maya.sell)}`);
  // Merged with F-12 (main #54): one F3 line per page, the record strip's, right after the record's figures.
  const trade = page.locator('section[aria-labelledby="this-trade"]');
  await expect(page.locator('main [data-disclaimer]')).toHaveCount(1);
  const tradeRecord = page.locator('section[aria-labelledby="whole-record"]');
  await expect(tradeRecord.locator('[data-strip] + [data-disclaimer]')).toHaveCount(1);
  await recordInView(page);
  await inPlainView(page, tradeRecord.locator('[data-disclaimer]'), 'the trade page\'s record');
  await expect(trade.locator('.badge.demo')).toHaveText('Demo');

  await page.goto(`/u/momentum_maya/month/${maya.ym}`);
  const month = page.locator('section[aria-labelledby="this-month"]');
  await expect(page.locator('main [data-disclaimer]')).toHaveCount(1);
  const monthRecord = page.locator('section[aria-labelledby="whole-record"]');
  await expect(monthRecord.locator('[data-strip] + [data-disclaimer]')).toHaveCount(1);
  await recordInView(page);
  await inPlainView(page, monthRecord.locator('[data-disclaimer]'), 'the month page\'s record');
  await expect(month).not.toContainText('Past results');
  await expect(month).not.toContainText('Evidence');
  // F-12's month figures: the month's average with its 95% range, or Too early to tell; never a win rate.
  await expect(month.locator('[data-strip-scope="month"]')).toHaveText(/^([+−-]?[\d.,]+% average per trade \(.+ to .+\) · 95% range|≈?[+−-]?[\d.,]+% average per trade \(.+ to .+\) · 95% range|Too early to tell)$/);
  await expect(month).not.toContainText(/win rate/i);
  await expect(page.getByTestId('month-of')).toHaveText(/^(The only month on record|1 of \d+ months on record)$/);
});

test('AC3: Demo pages (profile, pane, trade, month, stock, compare) and their images name Demo and never say verified', async ({ page, request }) => {
  test.setTimeout(120_000);
  await page.setViewportSize(VIEW);
  const VERIFIED = /verified/i;
  const pages = [
    '/u/momentum_maya', `/u/momentum_maya/trade/${encodeURIComponent(maya.sell)}`, `/u/momentum_maya/month/${maya.ym}`,
    // NVDA and AVGO are closed only by the Demo trader (no spec inserts real trades in them; AMD gets one in app.spec).
    '/t/NVDA', '/t/compare?a=NVDA&b=AVGO',
  ];
  const images: string[] = [];
  for (const url of pages) {
    await page.goto(url);
    // Other traders' rows (the profile's Similar trades) are not this record.
    const text = await page.evaluate(() => { const m = document.querySelector('main')!.cloneNode(true) as HTMLElement; m.querySelectorAll('.similar').forEach((n) => n.remove()); return m.innerText; });
    expect(text, url).toContain('Demo');
    expect(text.match(/.{0,40}verified.{0,40}/i)?.[0] ?? null, `${url}: main text`).toBeNull();
    expect(await page.title(), `${url}: title`).not.toMatch(VERIFIED);
    for (const sel of ['meta[name="description"]', 'meta[property="og:description"]', 'meta[property="og:image:alt"]']) {
      for (const m of await page.locator(sel).all()) expect(await m.getAttribute('content'), `${url}: ${sel}`).not.toMatch(VERIFIED);
    }
    const og = page.locator('meta[property="og:image"]');
    const img = (await og.count()) ? await og.first().getAttribute('content') : null;
    // The trade, month and stock images (the profile's is F-4's).
    if (img && (/\/(trade|month)\//.test(url) || url === '/t/NVDA')) images.push(new URL(img).pathname);
  }
  expect(await page.title()).toMatch(/Demo/); // the compare page: "NVDA vs AVGO Demo trades"
  // The pane of the Demo record (the feed's, read without JavaScript as the server renders it).
  const at = await feedPageWith('momentum_maya');
  if (at) await page.goto(at);
  const pane = at ? page.locator('.row[data-handle="momentum_maya"]').first().locator('section.pane') : null;
  if (pane) {
    const t = await pane.innerText();
    expect(t).toContain('Demo');
    expect(t).not.toMatch(VERIFIED);
  } else test.info().annotations.push({ type: 'note', description: 'the Demo record has no feed card today' });
  // AC16: the trade, month and stock images render (200, PNG).
  expect(images.length).toBe(3);
  for (const p of images) {
    const res = await request.get(p);
    expect(res.status(), p).toBe(200);
    expect(res.headers()['content-type'], p).toContain('image/png');
  }
});

test('AC5 + AC6: the chart\'s ends and at-rest subline, a 2020 close with its year, and the baseline as facts', async ({ page }) => {
  await page.setViewportSize(VIEW);
  const now = new Date();
  await page.goto(`/u/${OWNER}`);
  const fig = page.locator('figure.chart');
  await expect(fig.locator('.chart-head')).toContainText(`All time · last close ${dateText(lastClose, now)}`);
  const ends = fig.locator('.chart-ends');
  await expect(ends).toHaveCount(1);
  await expect(fig.locator('figcaption .chart-ends')).toHaveCount(0);
  await expect(ends.locator('time')).toHaveText(['May 30, 2020', dateText(lastClose, now)]);
  await expect(ends.locator('time').first()).toHaveAttribute('datetime', OLD_CLOSE.toISOString());
  await expect(ends.locator('.sr-only')).toHaveText(`First close May 30, 2020, last close ${dateText(lastClose, now)}`);
  // Scrubbing keeps the numeric date.
  await page.locator('.chart-stack').focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect(fig.locator('.chart-head')).toContainText(/\d+\/\d+\/\d{4}/);
  // A 2020 close prints its year.
  await page.goto(`/u/${OWNER}/month/2020-05`);
  await expect(page.locator('ol li').first()).toContainText('May 30, 2020');

  await page.goto('/t/NVDA');
  const base = page.getByTestId('baseline');
  await expect(base).toBeVisible();
  if (await base.getAttribute('data-kind') !== 'empty') {
    await expect(base.locator('h2')).toContainText('Closed trades recorded here: this stock and other stocks');
    await expect(base).not.toContainText(/geometric|sits above|sits below|No clear difference|all other stocks/i);
    const lines = [await base.getByTestId('baseline-this').innerText(), await base.getByTestId('baseline-others').innerText()];
    expect(lines.filter((l) => l.includes('per-trade range')).length % 2, lines.join(' | ')).toBe(0);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
});
