// F-23 (docs/features/F-23-public-payload-precision.md; plan docs/features/logs/F-23/plan.md) against the running app:
// rounding the public payloads changes nothing a person sees. Main cannot be snapshotted in CI, so every expected string
// is computed here from the STORED fixture values with the app's own formatters (pct/tone from lib/format.ts, stats from
// lib/trades.ts), and the rendered text and tone classes must match it exactly.
// - AC 3: the pane headline (feed pane and the /pane model behind the Similar sheet) equals the profile headline, for a
//   record whose stored average sits on a rounding edge (the average of the rounded returns would print differently).
// - AC 4: two closes on the same UTC day keep their order in the profile chart; arrows, Enter, a click and a drag-release
//   each open the right trade; the scrubbed date is the UTC day in far-east and far-west browser zones, with no
//   hydration error.
// - AC 5: no figure, tone or Flat label changes on the profile, the feed card and the feed pane.
// Own fixture trader only (`f23d` + a random tag), removed at the end. Feed-eligible, so the feed lock is held shared.
import { expect, test, type Browser, type Page } from '@playwright/test';
import postgres from 'postgres';
import { feedLock } from './feed-lock.ts';
import { pct, tone } from '../lib/format.ts';
import { stats } from '../lib/trades.ts';
import { wirePct } from '../lib/public-wire.ts';

const DAY = 86_400_000;
const HOUR = 3_600_000;
const tag = Math.random().toString(36).slice(2, 7);
const H = `f23d${tag}`;
const SYM = tag.replace(/[^a-z]/g, '').slice(0, 2).toUpperCase().padEnd(2, 'Q');
const DISCLAIMER = 'Not investment advice. Past performance does not guarantee future results.';
const sql = postgres(process.env.DATABASE_URL!, { max: 2, onnotice: () => {} });

// The stored closes. Times: the same-day pair on yesterday's UTC day (09:05:00 and 14:31:07), the rest in the last hours.
const now = Date.now();
const yday = Math.floor(now / DAY) * DAY - DAY;
type Close = { key: string; r: number; at: number; hold: number; symbol: string; id?: string };
const CLOSES: Close[] = [
  { key: 'big', r: 0.30951, at: now - 30 * 60_000, hold: 3.25, symbol: `G${SYM}` },
  { key: 'early', r: 0.03246, at: yday + 9 * HOUR + 5 * 60_000, hold: 1.35, symbol: `A${SYM}` }, // same day, first
  { key: 'late', r: 0.01652, at: yday + 14 * HOUR + 31 * 60_000 + 7_000, hold: 0.45, symbol: `B${SYM}` }, // same day, second
  { key: 'edge', r: 0.0245, at: now - 2 * HOUR, hold: 2.35, symbol: `C${SYM}` },
  { key: 'flat', r: 0.0000049, at: now - 3 * HOUR, hold: 4.05, symbol: `F${SYM}` }, // prints "0.0%", no tone
  { key: 'loss', r: -0.2, at: now - 4 * HOUR, hold: 6.15, symbol: `L${SYM}` },
];
const byKey = (k: string) => CLOSES.find((c) => c.key === k)!;

// Expected strings, from stored values.
const asc = [...CLOSES].sort((a, b) => a.at - b.at);
const newestFirst = [...CLOSES].sort((a, b) => b.at - a.at);
const cumulative = (() => { let e = 1; return asc.map((c) => (e *= 1 + c.r) - 1); })();
const total = cumulative[cumulative.length - 1];
const S = stats(CLOSES.map((c) => ({ returnPct: c.r, holdingDays: c.hold, closedAt: new Date(c.at) })));
const WIN = `${(S.winRate * 100).toFixed(0)}%`;
const AVG = pct(S.avgReturn);
const cls = (x: number) => { const t = tone(x); return t === 'flat' ? null : t; };
const utcDay = (t: number) => { const d = new Date(t); return `${d.getUTCMonth() + 1}/${d.getUTCDate()}/${d.getUTCFullYear()}`; };
const worst = CLOSES.reduce((w, c) => (c.r < w.r ? c : w));

// Exact tone classes: up/down per tone(), none for a printed zero.
async function expectTone(page: Page, sel: string, x: number, label: string, scope?: ReturnType<Page['locator']>) {
  const el = (scope ?? page.locator('body')).locator(sel).first();
  const c = (await el.getAttribute('class')) ?? '';
  const has = (t: string) => c.split(/\s+/).includes(t);
  const want = cls(x);
  expect(has('up'), `${label} class "${c}" up`).toBe(want === 'up');
  expect(has('down'), `${label} class "${c}" down`).toBe(want === 'down');
}

test.describe.configure({ mode: 'serial' });
let release: (() => Promise<void>) | null = null;

test.beforeAll(async () => {
  release = await feedLock('shared');
  const [u] = await sql`with a as (insert into signup_attempts (method, adult_attested_at) values ('dev', now()) returning id)
    insert into users (handle, display_name, adult_attested_at, signup_attempt_id) select ${H}, ${H}, now(), a.id from a returning id, signup_attempt_id`;
  const rows = await sql`insert into closed_trades ${sql(CLOSES.map((c, i) => ({
    user_id: u.id, sell_id: `${H}-${i}`, account_id: 'a', symbol: c.symbol,
    opened_at: new Date(c.at - c.hold * DAY), closed_at: new Date(c.at),
    return_pct: c.r, holding_days: c.hold, verified: true, thesis: null, thesis_status: null,
  })))} returning id::text as id, symbol`;
  for (const r of rows) CLOSES.find((c) => c.symbol === r.symbol)!.id = r.id;
  await sql`insert into connections (attempt_id, user_id, state, consent_at, importing_at, last_progress_at, connected_at)
    values (${u.signup_attempt_id}, ${u.id}, 'connected', now(), now(), now(), now() - interval '3 days')`;
});
test.afterAll(async () => {
  await sql`delete from users where handle = ${H}`;
  await release?.();
  await sql.end({ timeout: 1 });
});

test('F-23 fixture: the stored average sits on a rounding edge (the average of the rounded returns prints differently)', () => {
  const rounded = CLOSES.map((c) => wirePct(c.r));
  const trap = pct(rounded.reduce((s, x) => s + x, 0) / rounded.length);
  expect(AVG).not.toBe(trap);
  expect(byKey('flat').r).toBeGreaterThan(0);
  expect(pct(byKey('flat').r)).toBe('0.0%');
  expect(tone(byKey('flat').r)).toBe('flat');
  expect(utcDay(byKey('early').at)).toBe(utcDay(byKey('late').at));
  expect(new Set(CLOSES.map((c) => c.symbol)).size).toBe(CLOSES.length);
});

// The profile at 360 px, in a browser zone: headline, rows, chart at rest, every scrubbed point, the sheet, pointer.
async function profileChecks(browser: Browser, timezoneId: string | undefined) {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 800 }, ...(timezoneId ? { timezoneId } : {}) });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  const where = timezoneId ?? 'default zone';
  try {
    await page.goto(`/u/${H}`);
    // Headline (AC 3, AC 5).
    const big = page.locator('main section.stats').first().locator('.stat.big > b');
    await expect(big.nth(0)).toHaveText(WIN);
    await expect(big.nth(1)).toHaveText(AVG);
    await expectTone(page, 'main section.stats .stat.big:nth-child(2) > b', S.avgReturn, `${where} profile avg`);
    await expect(page.locator('main p[data-disclaimer]').first()).toHaveText(DISCLAIMER);
    // Every closed-trade row: figure and tone.
    for (const c of CLOSES) {
      const b = page.locator(`#trade-${c.id} .trade-link b`);
      await expect(b, `${where} row ${c.symbol}`).toHaveText(pct(c.r));
      await expectTone(page, `#trade-${c.id} .trade-link b`, c.r, `${where} row ${c.symbol}`);
      await expect(page.locator(`#trade-${c.id} .trade-link`)).toHaveAttribute('aria-label', `${c.symbol} ${pct(c.r)}, open trade page`);
    }
    // Chart at rest: ALL total compounded from stored returns; the accessible name.
    const chart = page.locator('main figure.chart').first();
    const value = chart.locator('.chart-head .chart-value');
    const sub = chart.locator('.chart-head > span.muted');
    await expect(value).toHaveText(pct(total));
    await expectTone(page, '.chart-head .chart-value', total, `${where} chart at rest`, chart);
    await expect(chart.locator('svg[role="img"]')).toHaveAttribute('aria-label', `${CLOSES.length} trades, ${pct(total, 0)} total, max drawdown ${pct(-S.maxDrawdown, 0)}`);
    await expect(chart.locator('.chart-hit a')).toHaveCount(CLOSES.length); // hydrated

    // Keyboard: the range start, then each close in time order, each with its own cumulative value, UTC day and symbol.
    const stack = chart.locator('.chart-stack');
    await stack.focus();
    await page.keyboard.press('ArrowRight');
    await expect(value).toHaveText('0.0%');
    expect(await sub.textContent()).toBe(` · ${utcDay(asc[0].at)}`);
    for (let i = 0; i < asc.length; i++) {
      const c = asc[i];
      await page.keyboard.press('ArrowRight');
      await expect(value, `${where} point ${i + 1}`).toHaveText(pct(cumulative[i]));
      expect(await sub.textContent(), `${where} point ${i + 1} subline`).toBe(` · ${utcDay(c.at)} · ${c.symbol}`);
      await expectTone(page, '.chart-head .chart-value', cumulative[i], `${where} point ${i + 1}`, chart);
    }
    // Enter on each of the same-day pair opens that trade's sheet.
    const sheet = chart.locator('.sheet');
    const sheetChecks = async (c: Close, how: string) => {
      await expect(sheet, `${where} ${how}`).toHaveClass(/\bopen\b/);
      await expect(sheet.locator('.line b').first(), `${where} ${how} symbol`).toHaveText(c.symbol);
      expect(await sheet.locator('.line .muted').first().textContent(), `${where} ${how} date`).toBe(`${utcDay(c.at)} · `);
      await expect(sheet.locator('.line > b'), `${where} ${how} pct`).toHaveText(pct(c.r));
      await expectTone(page, '.line > b', c.r, `${where} ${how} pct`, sheet);
      await expect(sheet.getByText(/^Held /), `${where} ${how} held`).toHaveText(`Held ${c.hold.toFixed(1)} days`);
    };
    // To point n (0: the range start): back to the start (arrows clamp there), then n steps right.
    const toPoint = async (n: number) => {
      await page.keyboard.press('Escape');
      for (let j = 0; j <= asc.length; j++) await page.keyboard.press('ArrowLeft');
      await expect(value).toHaveText('0.0%');
      for (let j = 0; j < n; j++) await page.keyboard.press('ArrowRight');
    };
    for (const k of ['early', 'late'] as const) {
      const c = byKey(k);
      const i = asc.indexOf(c);
      await toPoint(i + 1);
      await expect(value).toHaveText(pct(cumulative[i]));
      expect(await sub.textContent()).toBe(` · ${utcDay(c.at)} · ${c.symbol}`);
      await page.keyboard.press('Enter');
      await sheetChecks(c, `Enter on ${k}`);
    }
    // And the Flat close's sheet: "0.0%" with no tone class.
    {
      const c = byKey('flat'), i = asc.indexOf(c);
      await toPoint(i + 1);
      await page.keyboard.press('Enter');
      await sheetChecks(c, 'Enter on flat');
    }
    await page.keyboard.press('Escape');
    await stack.blur();

    // Pointer: the same-day pair's points sit at different x; a click and a drag-release on each open that trade.
    const centre = async (c: Close) => {
      const b = (await chart.locator(`.chart-hit a[aria-label^="${c.symbol} "] circle`).boundingBox())!;
      return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    };
    await stack.scrollIntoViewIfNeeded();
    const pE = await centre(byKey('early')), pL = await centre(byKey('late'));
    expect(pL.x - pE.x, `${where} same-day points: later one to the right`).toBeGreaterThan(4);
    const box = (await stack.boundingBox())!;
    const midY = box.y + box.height / 2;
    for (const [k, p] of [['early', pE], ['late', pL]] as const) {
      await page.mouse.click(p.x, p.y);
      await sheetChecks(byKey(k), `click on ${k}`);
      await page.mouse.move(box.x + 3, midY);
      await page.mouse.down();
      await page.mouse.move(p.x, midY, { steps: 8 });
      await expect(value).toHaveText(pct(cumulative[asc.indexOf(byKey(k))]));
      expect(await sub.textContent()).toBe(` · ${utcDay(byKey(k).at)} · ${byKey(k).symbol}`);
      await page.mouse.up();
      await sheetChecks(byKey(k), `drag-release on ${k}`);
      await expect(value).toHaveText(pct(total)); // release restores the total
    }
    expect(errors.filter((e) => /hydrat|did not match|server rendered|#418|#423|#425/i.test(e)), `${where} hydration errors`).toEqual([]);
  } finally {
    await ctx.close();
  }
}

test('F-23 AC 3/4/5 profile at 360 px: headline, rows, chart total, label, every scrubbed point, the sheet (keys, click, drag) from stored values', async ({ browser }) => {
  test.setTimeout(120_000);
  await profileChecks(browser, undefined);
});

for (const tz of ['Pacific/Auckland', 'America/Los_Angeles']) {
  test(`F-23 AC 4 profile in ${tz}: scrubbed dates are the UTC day, same-day order kept, no hydration error`, async ({ browser }) => {
    test.setTimeout(120_000);
    await profileChecks(browser, tz);
  });
}

test('F-23 AC 3/5 feed: the card and its swiped-open pane print the stored-value figures; the /pane model prints the profile headline', async ({ browser, request }) => {
  test.setTimeout(120_000);
  // The /pane model (the lazy Similar-sheet pane renders from it): headline, worst, last 5, as printed.
  const body = await (await request.get(`/u/${H}/pane?v=2`)).json();
  expect(`${(body.model.winRate * 100).toFixed(0)}%`).toBe(WIN);
  expect(pct(body.model.avgReturn)).toBe(AVG);
  expect(tone(body.model.avgReturn)).toBe(tone(S.avgReturn));
  expect(pct(body.model.worst.returnPct)).toBe(pct(worst.r));
  expect(body.model.recent.map((t: { symbol: string; returnPct: number; day: number }) => [t.symbol, pct(t.returnPct), tone(t.returnPct), utcDay(t.day * DAY)]))
    .toEqual(newestFirst.slice(0, 5).map((c) => [c.symbol, pct(c.r), tone(c.r), utcDay(c.at)]));

  // Find the page that carries this trader's card (server-rendered pages, walked without JS), then open it with JS.
  const nojs = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 360, height: 800 } });
  const np = await nojs.newPage();
  let url: string | null = '/', at: string | null = null;
  for (let i = 0; i < 12 && url && !at; i++) {
    await np.goto(url);
    if ((await np.locator(`.row[data-handle="${H}"]`).count()) > 0) at = url;
    else url = await np.locator('.feed-more a.button[href*="after="]').getAttribute('href').catch(() => null);
  }
  await nojs.close();
  expect(at, `${H} not in the feed`).not.toBeNull();

  const ctx = await browser.newContext({ viewport: { width: 360, height: 800 } });
  const page = await ctx.newPage();
  try {
    await page.goto(at!);
    // Every card of this trader: the card's figure and tone.
    const cards = page.locator(`.row[data-handle="${H}"]`);
    expect(await cards.count()).toBeGreaterThan(0);
    for (const id of await cards.evaluateAll((rs) => rs.map((r) => r.getAttribute('data-trade')!))) {
      const c = CLOSES.find((x) => x.id === id)!;
      expect(c, `card ${id} is one of the fixture's closes`).toBeTruthy();
      await expect(page.locator(`.row[data-trade="${id}"] .card .hero .ret`)).toHaveText(pct(c.r));
      await expectTone(page, `.row[data-trade="${id}"] .card .hero .ret`, c.r, `card ${c.symbol}`);
    }
    // Swipe this trader's row open (→ moves the row at the top of the viewport).
    const row = cards.first();
    await row.evaluate((el) => el.scrollIntoView({ block: 'start' }));
    await expect.poll(async () => { await page.keyboard.press('ArrowRight'); return row.evaluate((el) => el.scrollLeft); }).toBeGreaterThan(300);
    const pane = row.locator('section.pane');
    await expect(pane).toBeInViewport();
    const big = pane.locator('section.stats .stat.big > b');
    await expect(big.nth(0)).toHaveText(WIN);
    await expect(big.nth(1)).toHaveText(AVG);
    await expectTone(page, 'section.stats .stat.big:nth-child(2) > b', S.avgReturn, 'pane avg', pane);
    await expect(pane.locator('p.summary b')).toHaveText(pct(worst.r));
    await expect(pane.locator('p.summary')).toContainText(`Worst: ${worst.symbol} ${pct(worst.r)}.`);
    await expectTone(page, 'p.summary b', worst.r, 'pane worst', pane);
    await expect(pane.locator('p[data-disclaimer]')).toHaveText(DISCLAIMER);
    // The pane chart at rest and its accessible name.
    await expect(pane.locator('.chart-head .chart-value')).toHaveText(pct(total));
    await expectTone(page, '.chart-head .chart-value', total, 'pane chart at rest', pane);
    await expect(pane.locator('figure.chart svg[role="img"]')).toHaveAttribute('aria-label', `${CLOSES.length} trades, ${pct(total, 0)} total, max drawdown ${pct(-S.maxDrawdown, 0)}`);
    // Last 5: symbol, the UTC day as M/D/YYYY, figure, tone (the Flat close: "0.0%", no tone class).
    const items = pane.locator('ul.rows > li');
    await expect(items).toHaveCount(5);
    const want = newestFirst.slice(0, 5);
    for (let i = 0; i < 5; i++) {
      const c = want[i], li = items.nth(i);
      await expect(li.locator('span > b')).toHaveText(c.symbol);
      await expect(li.locator('span > span.muted')).toHaveText(utcDay(c.at));
      await expect(li.locator(':scope > b')).toHaveText(pct(c.r));
      await expectTone(page, ':scope > b', c.r, `pane row ${c.symbol}`, li);
    }
    expect(want.some((c) => c.key === 'flat'), 'the Flat close is among the last 5').toBe(true);
  } finally {
    await ctx.close();
  }
});

// Business lead demand 2 (user test): on the seeded demo records shared links land on, the last key step and a release
// at the chart's right edge open the list's top row, and the header then shows the range total; in UTC and Auckland.
for (const timezoneId of ['UTC', 'Pacific/Auckland']) {
  test(`F-23 AC 4 demo records (${timezoneId}): the last key step and the right-edge release open the list top row`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 360, height: 800 }, timezoneId });
    const page = await ctx.newPage();
    try {
      for (const handle of ['momentum_maya', 'dividend_dan', 'yolo_yuki']) {
        await page.goto(`/u/${handle}`);
        const top = (await page.locator('ul.rows.closes li').first().locator('.line b').first().innerText()).trim();
        const fig = page.locator('figure.chart');
        await expect(fig.locator('.chart-hit')).toHaveCount(1); // hydrated
        const totalText = (await fig.locator('.chart-value').innerText()).trim();
        // Keys: from rest, ArrowLeft lands on the last point.
        await fig.locator('.chart-stack').focus();
        await page.keyboard.press('ArrowLeft');
        await expect(fig.locator('.chart-head'), handle).toContainText(` · ${top}`);
        await expect(fig.locator('.chart-value'), handle).toHaveText(totalText);
        await page.keyboard.press('Enter');
        await expect(fig.locator('.sheet .line b').first(), handle).toHaveText(top);
        await page.keyboard.press('Escape');
        // Pointer: press and release at the right edge.
        const box = (await fig.locator('.chart-stack').boundingBox())!;
        await page.mouse.move(box.x + box.width - 1, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.up();
        await expect(fig.locator('.sheet .line b').first(), `${handle} edge release`).toHaveText(top);
      }
    } finally {
      await ctx.close();
    }
  });
}

// Tester Medium 1: a dense record (4,700 closes, one every 2 hours: most inside every range) stays under the profile's
// 400 KB budget with the server-packed chart (the compact form, lib/chart-series.ts#compact). Own handle, removed after.
test('F-23 dense profile: 4,700 closes two hours apart weigh under 400 KB of HTML, and the chart is the compact form', async ({ request }) => {
  test.setTimeout(120_000);
  const h = `f23x${tag}`;
  const [u] = await sql`with a as (insert into signup_attempts (method, adult_attested_at) values ('dev', now()) returning id)
    insert into users (handle, display_name, adult_attested_at, signup_attempt_id) select ${h}, ${h}, now(), a.id from a returning id`;
  try {
    const t0 = Date.now() - HOUR;
    const rows = Array.from({ length: 4_700 }, (_, i) => ({
      user_id: u.id, sell_id: `${h}-${i}`, account_id: 'a', symbol: `X${i % 40}`,
      opened_at: new Date(t0 - i * 2 * HOUR - DAY), closed_at: new Date(t0 - i * 2 * HOUR),
      return_pct: (((i * 37) % 200) - 100) / 1000 + 0.000123, holding_days: 1, verified: true, thesis: null, thesis_status: null,
    }));
    for (let i = 0; i < rows.length; i += 1_000) await sql`insert into closed_trades ${sql(rows.slice(i, i + 1_000))}`;
    const html = await (await request.get(`/u/${h}`)).text();
    const bytes = Buffer.byteLength(html);
    test.info().annotations.push({ type: 'f23-dense-profile-bytes', description: String(bytes) });
    expect(bytes).toBeLessThan(400_000);
    expect(html).toMatch(/\\"sfx\\":1/);
  } finally {
    await sql`delete from users where id = ${u.id}`;
  }
});
