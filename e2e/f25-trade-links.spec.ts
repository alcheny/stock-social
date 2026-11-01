// F-25 · one link rule for trade rows (docs/features/F-25-one-link-rule-for-trade-rows.md), against the running app.
// Covers: one trade link per closed-trade row on the feed card, the pane, the profile, the month page, the stock page
// (trades and notes lists), likes, hidden trades and the new-trades prompt, each to `tradePageHref` of that row; names
// with the symbol, the printed %, the sign word and "trade page" / "This trade" (a loss row on each surface); no nested
// links; Shape R names (no aria-label, visible text first, "Demo" / "Verified" without the glyph); Shape C hit boxes
// (44 × 44 px, a 0.0% figure too); the card footer's two links (one line at 360 and 780 px, stacked at 320 px, 44 px
// tall, 8 px apart, unique per trader, "Record, wins and losses" first); page 1's first card with the first-visit line
// dismissed (the swipe hint on the footer line) within the height budget; signed out, every trade link answers 200 with
// the row's symbol and figure; /me/record posts tradeKey and saving and clearing a reflection still work.
// Fixture traders are this file's own (random generic handles, random fictional symbols), removed after; the feed lock is
// held shared while they exist (their closes are feed-eligible). Fit assertions keep ≥ 15% headroom.
import { expect, test, type Locator, type Page } from '@playwright/test';
import postgres from 'postgres';
import { feedLock } from './feed-lock.ts';
import { handleOf, KEY_RE, makeTrader, marker, printed, removeHandles, signWordOf, symbolOf, type Made } from './f25-fixture.ts';

const sql = postgres(process.env.DATABASE_URL!, { max: 2, onnotice: () => {} });
const S1 = symbolOf(), S2 = symbolOf();
const MARK = marker();
const NOTE = 'Sold after the plan hit its exit level.';
let A: Made, B: Made; // A: Verified (connected), gains, losses and a 0.0% close; B: Demo, losses only
const viewers: string[] = [];
let release: () => Promise<void> = async () => {};

test.beforeAll(async () => {
  release = await feedLock('shared');
  A = await makeTrader(sql, { handle: handleOf('f25a'), verified: true, mark: MARK, closes: [
    { symbol: S1, r: 0.123, hoursAgo: 0.1, thesis: NOTE }, { symbol: S1, r: -0.074, hoursAgo: 0.2, thesis: NOTE },
    { symbol: S2, r: 0.0002, hoursAgo: 0.3 }, { symbol: S2, r: -0.051, hoursAgo: 0.4 },
    { symbol: S1, r: 0.033, hoursAgo: 0.5 }, { symbol: S2, r: 0.021, hoursAgo: 0.6 },
  ] });
  B = await makeTrader(sql, { handle: handleOf('f25b'), verified: false, mark: MARK, closes: [
    { symbol: S1, r: -0.042, hoursAgo: 0.15, thesis: NOTE }, { symbol: S1, r: -0.081, hoursAgo: 0.25 },
    { symbol: S2, r: -0.015, hoursAgo: 0.35 }, { symbol: S1, r: -0.03, hoursAgo: 0.45 }, { symbol: S2, r: -0.06, hoursAgo: 0.55 },
  ] });
});
test.afterAll(async () => {
  await removeHandles(sql, [A?.handle, B?.handle, ...viewers].filter(Boolean));
  await release();
  await sql.end({ timeout: 1 });
});

const href = (m: Made, key: string) => `/u/${m.handle}/trade/${key}`;
const tradeOf = (key: string) => [...A.trades, ...B.trades].find((t) => t.key === key);
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// The computed accessible name, as the browser's accessibility tree reports it (Playwright's aria snapshot).
async function nameOf(link: Locator): Promise<string> {
  const snap = await link.ariaSnapshot();
  // The first line reads `- link "name"` (YAML-quoted as `- 'link "name"'` when the name holds ": ").
  const m = /^- '?link "((?:[^"\\]|\\.)*)"/.exec(snap);
  if (!m) throw new Error(`not a named link: ${snap.split('\n')[0]}`);
  return JSON.parse(`"${m[1]}"`) as string;
}
// The link's visible text: its text without visually hidden or aria-hidden parts.
const visibleText = (link: Locator) => link.evaluate((a) => {
  const c = a.cloneNode(true) as HTMLElement;
  c.querySelectorAll('.sr-only, [aria-hidden="true"]').forEach((e) => e.remove());
  return (c.textContent ?? '').replace(/\s+/g, ' ').trim();
});
const noWs = (s: string) => s.replace(/\s+/g, '');
// Every trade link in `scope`: a trade href, one per row, none nested in or holding another link.
async function noNesting(page: Page) {
  const bad = await page.evaluate(() => {
    const out: string[] = [];
    for (const a of document.querySelectorAll('a[href], [role="link"]')) {
      if (a.parentElement?.closest('a[href], [role="link"]')) out.push(`nested: ${a.getAttribute('href')}`);
      if (a.querySelector('a[href], [role="link"]')) out.push(`holds a link: ${a.getAttribute('href')}`);
    }
    return out;
  });
  expect(bad, 'no link inside a link').toEqual([]);
}
// The name rule: symbol, printed %, sign word matching the figure, and "trade page" or "This trade".
async function nameRule(link: Locator, t: { symbol: string; r: number }, what: string) {
  const name = await nameOf(link);
  expect(name, `${what}: symbol`).toContain(t.symbol);
  expect(name, `${what}: printed %`).toContain(printed(t.r));
  expect(name, `${what}: sign word`).toMatch(new RegExp(`\\b${signWordOf(t.r)}\\b`));
  expect(name, `${what}: destination`).toMatch(/trade page|This trade/);
  return name;
}
// Shape R: no aria-label; the name starts with the row's visible text (the sign word and the suffix are visually hidden);
// the badge word inside the row as a word, never the check mark's.
async function shapeR(link: Locator, t: { symbol: string; r: number }, what: string, badge?: 'Demo' | 'Verified') {
  expect(await link.getAttribute('aria-label'), `${what}: no aria-label`).toBeNull();
  const name = await nameRule(link, t, what);
  const shown = await visibleText(link);
  expect(noWs(name.replace(`${signWordOf(t.r)} `, '')).startsWith(noWs(shown)), `${what}: "${name}" starts with "${shown}"`).toBe(true);
  expect(name, `${what}: suffix`).toMatch(new RegExp(`, open ${esc(t.symbol)} trade page$`));
  if (badge) expect(name, `${what}: badge word`).toMatch(new RegExp(`\\b${badge}\\b`));
  expect(name, `${what}: no glyph name`).not.toMatch(/check mark|✓/i);
}

test('feed card and pane: one trade link per row to its trade_key page; names with symbol, figure, sign word; a loss on each', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('/');
  for (const m of [A, B]) {
    const rows = page.locator(`.feed > .row[data-handle="${m.handle}"]`);
    await expect.poll(() => rows.count(), { message: `${m.handle} on page 1` }).toBeGreaterThan(0);
    const n = await rows.count();
    for (let i = 0; i < n; i++) {
      const row = rows.nth(i), card = row.locator('article.card');
      const key = (await row.getAttribute('data-key'))!;
      expect(key).toMatch(KEY_RE);
      const t = tradeOf(key)!;
      expect(t, 'the card is one of the fixture closes').toBeTruthy();
      // Exactly one trade link in the card, the footer's "This trade →"; the big figure is not a link.
      const links = card.locator('a[href*="/trade/"]');
      await expect(links).toHaveCount(1);
      await expect(links).toHaveAttribute('href', href(m, key));
      await expect(card.locator('.ret a, a .ret')).toHaveCount(0);
      const name = await nameRule(links, t, `card ${t.symbol}`);
      // Chromium pads the visually hidden (absolutely positioned) span with a space ("This trade : X"); punctuation spacing
      // aside, the name is the decided one.
      expect(name.replace(/\s+([:,])/g, '$1'), 'the decided name').toBe(`This trade: ${t.symbol} ${signWordOf(t.r)} ${printed(t.r)}`);
      expect(name, 'WCAG 2.5.3: visible text in the name').toContain(await visibleText(links));
      // The name still links to the profile and the symbol to its stock page.
      await expect(card.locator(`header a.who[href="/u/${m.handle}"]`)).toHaveCount(1);
      await expect(card.locator(`.symbol a[href="/t/${t.symbol}"]`)).toHaveCount(1);
      // The pane: the last 5 rows, each one link to its own trade page.
      const pane = row.locator('section.pane ul.rows > li');
      await expect(pane).toHaveCount(5);
      const latest = [...m.trades].slice(0, 5);
      for (let k = 0; k < 5; k++) {
        const li = pane.nth(k), a = li.locator('a');
        await expect(a).toHaveCount(1);
        await expect(a).toHaveAttribute('href', href(m, latest[k].key));
        await shapeR(a, latest[k], `pane ${m.handle} row ${k}`);
      }
    }
  }
  // A loss on the feed card (B's closes are all losses) and in the pane (A's second-latest close).
  const lossCard = page.locator(`.feed > .row[data-handle="${B.handle}"] article.card footer a[href*="/trade/"]`).first();
  await expect(lossCard).toHaveAccessibleName(/^This trade ?: Q[A-Z]{4} Loss -\d+\.\d%$/);
  const lossPane = page.locator(`.feed > .row[data-handle="${A.handle}"]`).first().locator(`section.pane a[href="${href(A, A.trades[1].key)}"]`);
  await expect(lossPane).toHaveAccessibleName(new RegExp(`Loss ${esc(printed(A.trades[1].r))} ?, open ${S1} trade page$`));
  await noNesting(page);
});

test('profile (Shape C): one figure link per row, named with the sign word; 44 × 44 px including a 0.0% figure; no nesting', async ({ page }) => {
  for (const width of [320, 360, 780]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto(`/u/${A.handle}`);
    for (const t of A.trades) {
      const li = page.locator(`li#trade-${t.id}`);
      const links = li.locator('a[href*="/trade/"]');
      await expect(links, `${width}: ${t.symbol} ${printed(t.r)}`).toHaveCount(1);
      await expect(links).toHaveAttribute('href', href(A, t.key));
      await expect(links).toHaveAccessibleName(`${t.symbol} ${signWordOf(t.r)} ${printed(t.r)}, open trade page`);
      await nameRule(links, t, `profile ${printed(t.r)}`);
      expect(await nameOf(links), 'WCAG 2.5.3').toContain(await visibleText(links));
      await expect(li.locator(`a[href="/t/${t.symbol}"]`)).toHaveCount(1); // the symbol keeps its stock link
      await links.scrollIntoViewIfNeeded();
      const b = (await links.boundingBox())!;
      expect(b.height, `${width}: ${printed(t.r)} height`).toBeGreaterThanOrEqual(44);
      expect(b.width, `${width}: ${printed(t.r)} width`).toBeGreaterThanOrEqual(44);
    }
    // The 0.0% figure is there and padded.
    await expect(page.locator(`li#trade-${A.trades[2].id} a.trade-link`)).toHaveText('0.0%');
    await noNesting(page);
  }
});

test('month page (Shape R): list rows and best / worst cards link to the trade page; names lead with the visible text', async ({ page }) => {
  const months = await sql`select to_char(closed_at at time zone 'UTC', 'YYYY-MM') ym, trade_key k from closed_trades where user_id = ${A.id}`;
  const ym = months[0].ym as string;
  const inMonth = A.trades.filter((t) => months.find((x) => x.k === t.key)!.ym === ym);
  for (const width of [320, 360, 780]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto(`/u/${A.handle}/month/${ym}`);
    const list = page.locator('ol li');
    await expect(list).toHaveCount(inMonth.length);
    for (const t of inMonth) {
      const a = page.locator(`ol li a[href="${href(A, t.key)}"]`);
      await expect(a).toHaveCount(1);
      await expect(a.locator('xpath=ancestor::li').locator('a[href*="/trade/"]')).toHaveCount(1);
      await shapeR(a, t, `month ${printed(t.r)}`);
      expect((await a.boundingBox())!.height, `${width}: month row height`).toBeGreaterThanOrEqual(44);
    }
    for (const card of await page.locator('section.trade-card').filter({ has: page.locator('a.f25-row') }).all()) {
      const a = card.locator('a[href*="/trade/"]');
      await expect(a).toHaveCount(1);
      const t = tradeOf((await a.getAttribute('href'))!.split('/').pop()!)!;
      await shapeR(a, t, `month card ${printed(t.r)}`);
      expect((await a.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    // A loss row on the month page.
    const loss = inMonth.find((t) => t.r < 0)!;
    await expect(page.locator(`ol li a[href="${href(A, loss.key)}"]`)).toHaveAccessibleName(new RegExp(`Loss ${esc(printed(loss.r))}`));
    await noNesting(page);
  }
});

test('stock page (Shape R): trades and notes lists link each row to its trade page; badge word in the name, no glyph', async ({ page }) => {
  for (const width of [320, 360, 780]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto(`/t/${S1}`);
    const mine = [...A.trades, ...B.trades].filter((t) => t.symbol === S1);
    const list = 'ul.ticker-rows[aria-label^="Closed trades in"]'; // not "Also closed by these traders" (stock links)
    const trades = page.locator(`${list} > li`);
    await expect(trades).toHaveCount(mine.length);
    for (const t of mine) {
      const m = A.trades.includes(t) ? A : B;
      const a = page.locator(`${list} a[href="${href(m, t.key)}"]`);
      await expect(a).toHaveCount(1);
      await expect(a.locator('xpath=ancestor::li').locator('a')).toHaveCount(1); // nothing else to link in a Shape R row
      await shapeR(a, t, `stock ${m === A ? 'A' : 'B'} ${printed(t.r)}`, m === A ? 'Verified' : 'Demo');
      expect((await a.boundingBox())!.height, `${width}: stock row height`).toBeGreaterThanOrEqual(44);
    }
    // The profile is no longer the row's destination.
    await expect(page.locator(`.ticker-rows a[href="/u/${A.handle}"], .ticker-rows a[href="/u/${B.handle}"]`)).toHaveCount(0);
    // Notes list: the rows with a published note, each one link to its trade page; the note sits after the link.
    const noted = mine.filter((t) => [A.trades[0], A.trades[1], B.trades[0]].includes(t));
    for (const t of noted) {
      const m = A.trades.includes(t) ? A : B;
      const a = page.locator(`.thesis-rows a[href="${href(m, t.key)}"]`);
      await expect(a).toHaveCount(1);
      await shapeR(a, t, `notes ${printed(t.r)}`, m === A ? 'Verified' : 'Demo');
      expect(await nameOf(a), 'the note text is not in the row name').not.toContain(NOTE);
    }
    await expect(page.locator(`${list} a[href="${href(A, A.trades[1].key)}"]`)).toHaveAccessibleName(new RegExp(`Loss ${esc(printed(A.trades[1].r))}`));
    await noNesting(page);
  }
});

test('likes, hidden trades and the new-trades prompt link to the trade_key page', async ({ page }) => {
  const v = handleOf('f25v');
  viewers.push(v);
  await signIn(page, v);
  const [me] = await sql`select id from users where handle = ${v}`;
  await sql`insert into trade_likes (viewer_id, trade_key, trader_id) values (${me.id}, ${A.trades[1].key}, ${A.id})`;
  await sql`insert into trade_exclusions (viewer_id, trade_key, trader_id) values (${me.id}, ${A.trades[3].key}, ${A.id})`;
  await page.goto('/me/likes');
  await expect(page.locator(`a[href="${href(A, A.trades[1].key)}"]`)).toHaveCount(1);
  await expect(page.locator('main a[href*="/trade/"]')).toHaveCount(1);
  await noNesting(page);
  await page.goto('/me/hidden');
  await expect(page.locator(`a[href="${href(A, A.trades[3].key)}"]`)).toHaveCount(1);
  await noNesting(page);
  // The new-trades prompt on A's own profile: every close is newer than the last visit.
  await sql`update users set trades_prompt_seen_at = now() - interval '10 days', trades_prompt_action = null, share_prompt_seen_at = now() where id = ${A.id}`;
  await page.context().clearCookies();
  await signIn(page, A.handle);
  await page.goto(`/u/${A.handle}`);
  const rows = page.locator('.new-trades li a');
  await expect(rows.first()).toBeVisible();
  for (const a of await rows.all()) {
    const h = (await a.getAttribute('href'))!;
    expect(h).toMatch(new RegExp(`^/u/${A.handle}/trade/[0-9a-f]{64}$`));
    expect(A.trades.map((t) => href(A, t.key))).toContain(h);
  }
  await noNesting(page);
});

test('feed footer: one line at 360 and 780 px, stacked at 320 px; 44 px tall, ≥ 8 px apart, no overlap; unique record-link names', async ({ page }) => {
  const box = (l: Locator) => l.evaluate((e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
  for (const [width, height] of [[360, 640], [780, 360], [320, 640]] as const) {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    const row = page.locator(`.feed > .row[data-handle="${A.handle}"]`).first();
    await expect(row).toBeAttached();
    await row.evaluate((r) => { r.scrollIntoView({ block: 'start' }); r.scrollLeft = 0; });
    const trade = row.locator('article.card footer a[href*="/trade/"]');
    const rec = row.locator(`article.card footer a[href="/u/${A.handle}"]`);
    await expect(trade).toHaveText(/^This trade/);
    await expect(rec).toHaveText(/^Record, wins and losses/);
    // In this order, at 0.875rem.
    expect(await row.locator('article.card footer a').evaluateAll((as) => as.map((a) => a.getAttribute('href')))).toEqual([href(A, (await row.getAttribute('data-key'))!), `/u/${A.handle}`]);
    for (const l of [trade, rec]) await expect(l).toHaveCSS('font-size', '14px');
    const [t, r] = [await box(trade), await box(rec)];
    const at = `${width}×${height}`;
    for (const [b, w] of [[t, 'trade'], [r, 'record']] as const) expect(b.h, `${at}: ${w} link 44 px tall`).toBeGreaterThanOrEqual(44);
    const overlap = !(t.x + t.w <= r.x || r.x + r.w <= t.x || t.y + t.h <= r.y || r.y + r.h <= t.y);
    expect(overlap, `${at}: hit boxes do not overlap`).toBe(false);
    if (width >= 360) {
      expect(Math.abs((t.y + t.h / 2) - (r.y + r.h / 2)), `${at}: one line`).toBeLessThanOrEqual(1);
      expect(r.x - (t.x + t.w), `${at}: ≥ 8 px apart side by side`).toBeGreaterThanOrEqual(8);
    } else {
      expect(r.y - (t.y + t.h), `${at}: stacked, ≥ 8 px apart`).toBeGreaterThanOrEqual(8);
      expect(Math.abs(r.x - t.x), `${at}: stacked at the same start`).toBeLessThanOrEqual(1);
    }
  }
  // Names: each starts with "Record, wins and losses"; one name per trader (a trader's cards share their one destination),
  // and two traders never share a name.
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto('/');
  const recs = page.locator('.feed > .row article.card footer a:not([href*="/trade/"])');
  const byName = new Map<string, Set<string>>();
  for (const a of await recs.all()) {
    const name = await nameOf(a);
    expect(name).toMatch(/^Record, wins and losses/);
    byName.set(name, (byName.get(name) ?? new Set()).add((await a.getAttribute('href'))!));
  }
  expect(new Set([...byName.values()].flatMap((s) => [...s])).size, 'two or more traders on the page').toBeGreaterThanOrEqual(2);
  for (const [name, hrefs] of byName) expect([...hrefs], `"${name}" names one trader`).toHaveLength(1);
  expect(byName.size, 'one distinct name per trader').toBe(new Set([...byName.values()].flatMap((s) => [...s])).size);
});

const LONG_NOTE = 'Bought after the second earnings beat in a row and a raised outlook; sold when the move stalled near the old high. '.repeat(3).slice(0, 280);
type Box = { x: number; y: number; w: number; h: number };
const boxOf = (l: Locator): Promise<Box> => l.evaluate((e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
const overlaps = (a: Box, b: Box) => !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);
// The card's content when not stretched, with 15% headroom on the blocks (e2e/record-strip.spec.ts AC8's measure).
const fitOf = (card: Locator) => card.evaluate((c) => {
  const h = (e: Element) => { const cs = getComputedStyle(e); return (e as HTMLElement).offsetParent || cs.position === 'fixed' ? e.getBoundingClientRect().height + parseFloat(cs.marginTop) + parseFloat(cs.marginBottom) : 0; };
  const cs = getComputedStyle(c), hero = c.querySelector('.hero')!, hs = getComputedStyle(hero);
  const kids = [...c.children].filter((k) => (k as HTMLElement).offsetParent);
  const heroNat = [...hero.children].reduce((t, k) => t + k.getBoundingClientRect().height, 0) + (parseFloat(hs.rowGap) || 0) * (hero.children.length - 1);
  const blocks = kids.reduce((t, k) => t + (k === hero ? heroNat : h(k)), 0);
  const fixed = (parseFloat(cs.rowGap) || 0) * (kids.length - 1) + parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
  return { need: blocks * 1.15 + fixed, room: c.clientHeight, scrolls: c.scrollHeight > c.clientHeight + 1 };
});

test('feed footer at a 115% root font size (360 and 780 px): the two hit boxes never overlap and stay ≥ 8 px apart, wrapped or not', async ({ browser }) => {
  for (const [width, height] of [[360, 640], [780, 360]] as const) {
    const ctx = await browser.newContext({ viewport: { width, height } });
    await ctx.addInitScript(() => { document.addEventListener('DOMContentLoaded', () => { document.documentElement.style.fontSize = '115%'; }); });
    const page = await ctx.newPage();
    await page.goto('/');
    await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).fontSize)).toBe('18.4px');
    const row = page.locator(`.feed > .row[data-handle="${A.handle}"]`).first();
    await row.evaluate((r) => { r.scrollIntoView({ block: 'start' }); r.scrollLeft = 0; });
    const t = await boxOf(row.locator('article.card footer a[href*="/trade/"]'));
    const r = await boxOf(row.locator(`article.card footer a[href="/u/${A.handle}"]`));
    const at = `${width}×${height} at 115%`;
    expect(overlaps(t, r), `${at}: hit boxes do not overlap`).toBe(false);
    for (const [b, w] of [[t, 'trade'], [r, 'record']] as const) expect(b.h, `${at}: ${w} link 44 px tall`).toBeGreaterThanOrEqual(44);
    const sideBySide = Math.abs((t.y + t.h / 2) - (r.y + r.h / 2)) <= 1;
    if (sideBySide) expect(r.x - (t.x + t.w), `${at}: ≥ 8 px apart side by side`).toBeGreaterThanOrEqual(8);
    else expect(r.y - (t.y + t.h), `${at}: wrapped, ≥ 8 px apart stacked`).toBeGreaterThanOrEqual(8);
    expect.soft(await page.evaluate(() => document.documentElement.scrollWidth), `${at}: no horizontal page scroll`).toBeLessThanOrEqual(width);
    await ctx.close();
  }
});

test('page 1 card 1 with the first-visit line dismissed and a 280-character note: the swipe hint shares the footer line; the card fits with 15% to spare', async ({ browser }) => {
  test.setTimeout(120_000);
  // A trader of this test's own whose closes all carry a 280-character note and whose strong record ranks it first.
  const N = await makeTrader(sql, { handle: handleOf('f25n'), verified: true, mark: MARK,
    closes: Array.from({ length: 12 }, (_, i) => ({ symbol: symbolOf(), r: 0.6 + (i % 2 ? 0.01 : -0.01), hoursAgo: 0.02 * (i + 1), thesis: LONG_NOTE })) });
  try {
    for (const [width, height] of [[320, 640], [360, 640], [780, 360]] as const) {
      const ctx = await browser.newContext({ viewport: { width, height } });
      await ctx.addInitScript(() => { try { localStorage.setItem('ss.firstVisitLine', 'dismissed'); } catch { /* blocked */ } });
      const page = await ctx.newPage();
      await page.goto('/');
      await expect(page.locator('html')).toHaveAttribute('data-ss-seen', /(^|\s)line(\s|$)/);
      const row = page.locator('.feed > .row').first();
      await expect(row, 'the long-note trader is page 1 card 1').toHaveAttribute('data-handle', N.handle);
      const card = row.locator(':scope > .card');
      await expect(card.locator('.thesis')).toContainText(LONG_NOTE.slice(0, 60));
      await expect(card.locator('[data-first-visit]')).toBeHidden();
      const hint = card.locator('footer [data-swipe-hint]');
      await expect(hint).toBeVisible();
      const trade = card.locator('footer a[href*="/trade/"]'), rec = card.locator(`footer a[href="/u/${N.handle}"]`);
      await expect(trade).toHaveCount(1);
      const at = `${width}×${height}`;
      const fit = await fitOf(card);
      expect.soft(fit.need, `${at}: card content with 15% headroom`).toBeLessThanOrEqual(fit.room);
      expect.soft(fit.scrolls, `${at}: the card does not scroll`).toBe(false);
      // The hint sits on the footer line, before the links, and its box touches neither link's hit box.
      const [h, t, r] = [await boxOf(hint), await boxOf(trade), await boxOf(rec)];
      expect.soft(Math.abs((h.y + h.h / 2) - (t.y + t.h / 2)) <= 4, `${at}: the hint shares the trade link's line (hint ${JSON.stringify(h)}, link ${JSON.stringify(t)})`).toBe(true);
      expect.soft(h.x + h.w <= t.x, `${at}: the hint comes before "This trade"`).toBe(true);
      expect.soft(overlaps(h, t) || overlaps(h, r), `${at}: the hint overlaps no link hit box`).toBe(false);
      expect.soft(overlaps(t, r), `${at}: the links' hit boxes do not overlap`).toBe(false);
      for (const sel of ['footer a[href*="/trade/"]', 'footer a:not([href*="/trade/"])', '[data-disclaimer]']) {
        await expect.soft(card.locator(sel).first(), `${at}: ${sel} in view`).toBeInViewport();
      }
      test.info().annotations.push({ type: `card 1 ${at}`, description: JSON.stringify({ need: Math.round(fit.need), room: fit.room, hint: h, trade: t, record: r }) });
      expect.soft(await page.evaluate(() => document.documentElement.scrollWidth), `${at}: no horizontal page scroll`).toBeLessThanOrEqual(width);
      await ctx.close();
    }
  } finally {
    await removeHandles(sql, [N.handle]);
  }
});

test('signed out, each trade link answers 200 and the page shows the row\'s symbol and figure as printed', async ({ page, request }) => {
  for (const m of [A, B]) {
    for (const t of m.trades) {
      const res = await request.get(href(m, t.key), { maxRedirects: 0 });
      expect(res.status(), `${m.handle} ${t.symbol} ${printed(t.r)}`).toBe(200);
      await page.goto(href(m, t.key));
      await expect(page.locator('h1')).toHaveText(t.symbol);
      await expect(page.locator('.trade-card .big')).toContainText(printed(t.r));
    }
  }
  // The same links as rendered on the profile and the stock page lead there too.
  await page.goto(`/u/${A.handle}`);
  const first = page.locator(`li#trade-${A.trades[1].id} a.trade-link`);
  const shown = await first.innerText();
  await first.click();
  await expect(page).toHaveURL(new RegExp(`${esc(href(A, A.trades[1].key))}$`));
  await expect(page.locator('.trade-card .big')).toContainText(shown);
});

test('/me/record posts tradeKey, never a sell id; saving and clearing a reflection still work', async ({ page }) => {
  await signIn(page, A.handle);
  await page.goto('/me/record');
  const forms = page.locator('form[aria-label^="Why I took it"]');
  await expect(forms).toHaveCount(A.trades.length);
  expect(await page.locator('input[name="sellId"]').count()).toBe(0);
  const keys = await page.locator('form input[type="hidden"][name="tradeKey"]').evaluateAll((es) => es.map((e) => (e as HTMLInputElement).value));
  expect(keys.sort()).toEqual(A.trades.map((t) => t.key).sort());
  const t = A.trades[1];
  const form = page.locator('form').filter({ has: page.locator(`input[name="tradeKey"][value="${t.key}"]`) });
  const reflection = () => sql`select reason from trade_reflections where user_id = ${A.id} and sell_id = ${t.sell}`;
  // The posted form carries tradeKey.
  const posted = page.waitForRequest((r) => r.method() === 'POST' && (r.postData() ?? '').includes(t.key));
  await form.getByRole('button', { name: /^Planned/ }).click();
  expect((await posted).postData()).not.toContain(t.sell);
  await expect.poll(async () => (await reflection())[0]?.reason ?? null).toBe('planned');
  await expect(form.getByRole('button', { name: /^Planned/ })).toHaveAttribute('aria-pressed', 'true');
  await form.getByRole('button', { name: /^Planned/ }).click();
  await expect.poll(async () => (await reflection()).length).toBe(0);
  await expect(form.getByRole('button', { name: /^Planned/ })).toHaveAttribute('aria-pressed', 'false');
});

async function signIn(page: Page, h: string) {
  await page.goto('/login/dev');
  await page.getByLabel('Handle').fill(h);
  await page.getByLabel('I am 18 or older').check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(new RegExp(`/u/${h}$`));
}
