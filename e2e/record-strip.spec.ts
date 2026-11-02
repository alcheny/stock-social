// F-10 / F-12: the record strip against the running app (plan docs/features/logs/F-10/plan.md §7). Feed cards (one strip
// per card, Too early on a wide short record, F-6's open line beside it, reflow at 320 / 360×640 / 780×360, the 360 px
// glance), the trade and month pages (label, figures, "@handle's record", "losses included", the disclaimer, no
// completeness words, no win rate, no verdict, alt text), and the three images (PNG decoded with lib/png.ts: nothing
// outside the square crop but the brand box, text in the band, inside the 1.91:1 crop). Fixture traders are its own
// (`f10_*`), deleted before and after; both are feed-eligible, so the shared feed lock is held while they exist.
import { test, expect, type Page } from '@playwright/test';
import postgres from 'postgres';
import { feedLock } from './feed-lock.ts';
import { decodePng, pixel } from '../lib/png.ts';
import { BRAND_BOX, SQUARE_CROP, STRIP_BAND } from '../lib/record-strip.ts';

const DAY = 86_400_000;
const DISCLAIMER = 'Not investment advice. Past performance does not guarantee future results.';
const sql = postgres(process.env.DATABASE_URL!, { max: 2, onnotice: () => {} });

// f10_strip: 12 closes within the day, a narrow spread (a range shows), two open positions. f10_early: 5 closes, wide
// (Too early to tell). Large moves so both reach the feed's first page.
const FIXTURES = {
  f10_strip: { closes: Array.from({ length: 12 }, (_, i) => 0.6 + (i % 2 ? 0.01 : -0.01)), open: [0.12, -0.08] },
  f10_early: { closes: [0.9, -0.85, 0.95, -0.8, 0.9], open: [] as number[] },
};
const HANDLES = Object.keys(FIXTURES);
const LONG_THESIS = 'Bought after the second earnings beat in a row and a raised outlook; sold when the move stalled near the old high. '.repeat(3).slice(0, 280);

test.describe.configure({ mode: 'serial' });
let releaseFeed: (() => Promise<void>) | null = null;
test.beforeAll(async () => {
  releaseFeed = await feedLock('shared');
  await sql`delete from users where handle in ${sql(HANDLES)}`;
  for (const [handle, f] of Object.entries(FIXTURES)) {
    const [u] = await sql`
      with a as (insert into signup_attempts (method, adult_attested_at) values ('dev', now()) returning id)
      insert into users (handle, display_name, adult_attested_at, signup_attempt_id) select ${handle}, ${handle}, now(), a.id from a returning id, signup_attempt_id`;
    await sql`insert into closed_trades ${sql(f.closes.map((r, i) => ({
      user_id: u.id, sell_id: `${handle}-${i}`, account_id: 'a', symbol: `${handle === 'f10_strip' ? 'FTS' : 'FTE'}${i}`,
      opened_at: new Date(Date.now() - (i + 3) * 3_600_000 - 2 * DAY), closed_at: new Date(Date.now() - (i + 1) * 3_600_000),
      return_pct: r, holding_days: 2, verified: true,
      // The worst case for the card's height: a 280-character thesis on the newest close of f10_strip.
      ...(handle === 'f10_strip' && i === 0 ? { thesis: LONG_THESIS, thesis_status: 'published' } : { thesis: null, thesis_status: null }),
    })))}`;
    await sql`insert into connections (attempt_id, user_id, state, consent_at, importing_at, last_progress_at, connected_at)
      values (${u.signup_attempt_id}, ${u.id}, 'connected', now(), now(), now(), now() - interval '3 days')`;
    if (f.open.length) await sql`insert into open_positions ${sql(f.open.map((p, k) => ({ user_id: u.id, account_id: 'a', symbol: `FTO${k}`, unrealized_pct: p, fetched_at: new Date() })))}`;
  }
});
test.afterAll(async () => {
  await sql`delete from users where handle in ${sql(HANDLES)}`;
  await releaseFeed?.();
  await sql.end({ timeout: 1 });
});

const cardOf = (page: Page, handle: string) => page.locator(`.row[data-handle="${handle}"] .card`).first();
async function noHScroll(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

test('F-10 AC1/AC2/AC3/AC6: one strip per card in place of "held · closed"; Too early on a wide short record; the profile\'s range; open line beside', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/');
  const cards = page.locator('.card');
  await expect(cards.first()).toBeVisible();
  const n = await cards.count();
  for (let k = 0; k < n; k++) {
    await expect(cards.nth(k).locator('.hero [data-strip]')).toHaveCount(1);
    await expect(cards.nth(k)).not.toContainText(/held [\d.]+[hd] · closed/);
  }
  const strip = cardOf(page, 'f10_strip').locator('[data-strip]');
  await expect(strip).toContainText(/^(✓ Verified |Demo )?12 closed trades · \+\d+\.\d% average per trade \(.+ to .+\) · 95% range$/);
  const early = cardOf(page, 'f10_early').locator('[data-strip]');
  await expect(early).toHaveText(/^(✓ Verified |Demo )?5 closed trades · Too early to tell$/);
  // DS-22: the trust badge leads the record line, not the header.
  await expect(cardOf(page, 'f10_early').locator('.hero [data-strip] .badge')).toHaveCount(1);
  await expect(cardOf(page, 'f10_early').locator('header .badge')).toHaveCount(0);
  await expect(early.locator('b[data-role="early"]')).toBeVisible();
  // F-6's line still renders beside the strip.
  await expect(cardOf(page, 'f10_strip').locator('[data-open]')).toBeVisible();
  // AC3: the card's range is the profile's.
  const cardRange = await strip.locator('[data-role="range"]').innerText();
  await page.goto('/u/f10_strip');
  await expect(page.locator('.range').first()).toContainText(cardRange);
});

test('F-10 AC8: reflow at 320, 360×640 and 780×360: no horizontal scroll, the strip on two lines (three at 320 with the badge), the card link works', async ({ page }) => {
  for (const [w, h] of [[320, 640], [360, 640], [780, 360]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto('/');
    await noHScroll(page);
    const strip = cardOf(page, 'f10_strip').locator('[data-strip]');
    await strip.scrollIntoViewIfNeeded();
    const box = (await strip.boundingBox())!;
    const lh = await strip.evaluate((el) => parseFloat(getComputedStyle(el).lineHeight) || parseFloat(getComputedStyle(el).fontSize) * 1.45);
    // With the badge leading (DS-22) and the range labelled (user test 2026-11-01), three lines at phone widths, the design
    // system council's own budget for the 320 px box (§4.3); two in landscape. F-10 follow-up (review of #54): counted in
    // lines, with 0.1 line for subpixel rounding (the old 1.15× allowance let a strip run past its budget by half a line).
    expect(box.height / lh, `${w}x${h} strip lines`).toBeLessThanOrEqual((w >= 780 ? 2 : 3) + 0.1);
    // Nothing clipped: the strip fits its card.
    const card = (await cardOf(page, 'f10_strip').boundingBox())!;
    // The card's disclaimer stays inside its screen even with a 280-character thesis (rows are one screen tall); 2 px for
    // subpixel rounding. It still fails if the disclaimer is pushed off the row.
    const row = (await page.locator('.row[data-handle="f10_strip"]').first().boundingBox())!;
    const disc = (await cardOf(page, 'f10_strip').locator('[data-disclaimer]').boundingBox())!;
    expect(disc.y + disc.height, `${w}x${h} disclaimer`).toBeLessThanOrEqual(row.y + row.height + 2);
    // F-10 follow-up (repo lesson: ≥ 15% headroom in fit assertions): the card's content still fits its row if every block
    // were 15% taller (a wider font, one more wrapped line). Natural heights: the hero (flex: 1, it takes the spare) counts
    // as its children plus their gaps; gaps between blocks and the card's padding count once.
    const fit = await cardOf(page, 'f10_strip').evaluate((card) => {
      const hero = card.querySelector('.hero')!, cs = getComputedStyle(card), hs = getComputedStyle(hero);
      const h = (el: Element) => el.getBoundingClientRect().height;
      const heroNat = [...hero.children].reduce((t, c) => t + h(c), 0) + (parseFloat(hs.rowGap) || 0) * (hero.children.length - 1);
      const blocks = [...card.children].reduce((t, c) => t + (c === hero ? heroNat : h(c)), 0);
      const fixed = (parseFloat(cs.rowGap) || 0) * (card.children.length - 1) + parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
      return { need: blocks * 1.15 + fixed, row: card.parentElement!.clientHeight };
    });
    expect(fit.need, `${w}x${h} card content with 15% headroom`).toBeLessThanOrEqual(fit.row);
    expect(box.x).toBeGreaterThanOrEqual(card.x - 1);
    expect(box.x + box.width).toBeLessThanOrEqual(card.x + card.width + 1);
  }
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto('/');
  await cardOf(page, 'f10_strip').getByRole('link', { name: /Record, wins and losses/ }).click();
  await expect(page).toHaveURL(/\/u\/f10_strip$/);
});

test('business lead glance: at 360×640 signed out, the first card\'s return and its whole strip are in the first screen', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto('/');
  const first = page.locator('.card').first();
  await expect(first.locator('.ret')).toBeInViewport({ ratio: 1 });
  await expect(first.locator('[data-strip]')).toBeInViewport({ ratio: 1 });
  // F-10 AC10: the disclaimer is on the first screen too.
  await expect(first.locator('[data-disclaimer]')).toHaveText(DISCLAIMER);
  await expect(first.locator('[data-disclaimer]')).toBeInViewport({ ratio: 1 });
});

test('F-10 AC9: the strip is real text after the return in the card\'s reading order, never hidden from assistive tech', async ({ page }) => {
  await page.goto('/');
  const card = cardOf(page, 'f10_strip');
  const snap = await card.ariaSnapshot();
  const ret = snap.search(/\+\d+\.\d%/), strip = snap.indexOf('12 closed trades');
  expect(ret).toBeGreaterThanOrEqual(0);
  expect(strip).toBeGreaterThan(ret);
  expect(await card.locator('[data-strip]').evaluate((el) => el.closest('[aria-hidden="true"]') === null)).toBe(true);
});

async function pageFacts(page: Page) {
  const body = await page.locator('main').innerText();
  expect(body).not.toMatch(/full record|whole record|every trade/i);
  expect(body).not.toMatch(/win rate/i);
  const alt = await page.locator('meta[property="og:image:alt"]').getAttribute('content');
  expect(alt).toBeTruthy();
  expect(alt!).not.toMatch(/win rate|full record|whole record|every trade/i);
  expect(alt!).toContain(DISCLAIMER);
  expect(alt!).toMatch(/Losses included/);
  return { body, alt: alt! };
}

test('F-12 AC1/AC4: the trade page shows the strip with "@handle\'s record", losses included and the disclaimer; the alt says the same', async ({ page }) => {
  await page.goto('/u/f10_strip/trade/f10_strip-0');
  const section = page.locator('section[aria-labelledby="whole-record"]');
  await expect(section.getByRole('heading', { name: "@f10_strip's record" })).toBeVisible();
  await expect(section.locator('[data-strip]')).toContainText(/12 closed trades · \+[\d.]+% average per trade \(.+\) · 95% range · losses included · Still open: 2 positions · 1\sup, 1\sdown · lowest -8\.0%\sdown, highest \+12\.0%\sup, unrealized as of [A-Z][a-z]{2} \d{1,2}, \d{4}/);
  const link = section.getByRole('link', { name: "@f10_strip's record" });
  await expect(link).toHaveAttribute('href', '/u/f10_strip');
  await expect(section.locator('[data-disclaimer]')).toHaveText(DISCLAIMER);
  await expect(page.getByRole('link', { name: '← @f10_strip\'s record' })).toBeVisible();
  // One link per destination: the duplicate footer record link is gone.
  await expect(page.getByRole('link', { name: /(See t|T)heir record, wins and losses|Record, wins and losses/ })).toHaveCount(0);
  const { alt } = await pageFacts(page);
  expect(alt).toMatch(/12 closed trades, average per trade \+[\d.]+%, 95% range .+ to .+\./);
  expect(alt).not.toMatch(/[·()]/);
});

test('F-12 AC1/AC6: month pages show the same fields for a losing and a winning month, no verdict, no win rate', async ({ page }) => {
  // The demo traders have several months; compare a month with a negative average with one with a positive average.
  const months = await sql`select u.handle, to_char(date_trunc('month', c.closed_at), 'YYYY-MM') as ym, avg(c.return_pct) as a, count(*)::int as n
    from closed_trades c join users u on u.id = c.user_id where u.handle in ('momentum_maya', 'dividend_dan', 'yolo_yuki')
    group by 1, 2 order by 3`;
  const pick = [months[0], months[months.length - 1]];
  expect(Number(pick[0].a)).toBeLessThan(Number(pick[1].a));
  const shape: string[][] = [];
  for (const m of pick) {
    await page.goto(`/u/${m.handle}/month/${m.ym}`);
    const body = await page.locator('main').innerText();
    expect(body).not.toMatch(/Past results/);
    expect(body).not.toMatch(/full record|whole record|every trade|win rate/i);
    await expect(page.getByText(new RegExp(`^${m.n} closed trades? this month$`))).toBeVisible();
    await expect(page.locator('[data-strip-scope="month"]')).toHaveCount(1);
    await expect(page.locator('[data-strip-scope="month"]')).not.toContainText('closed trade');
    const section = page.locator('section[aria-labelledby="whole-record"]');
    await expect(section.locator('[data-strip]')).toContainText('losses included');
    await expect(section.getByRole('link', { name: `@${m.handle}'s record` })).toHaveAttribute('href', `/u/${m.handle}`);
    await expect(section.locator('[data-disclaimer]')).toHaveText(DISCLAIMER);
    // Business lead user test: the month's result is the hero, at least the size of the count line.
    const sizes = await page.locator('section[aria-labelledby="this-month"]').evaluate((sec) => {
      const fig = sec.querySelector('[data-strip-scope="month"]')!, count = [...sec.querySelectorAll('p')].find((p) => /this month$/.test(p.textContent ?? ''))!;
      return [parseFloat(getComputedStyle(fig).fontSize), parseFloat(getComputedStyle(count).fontSize)];
    });
    expect(sizes[0]).toBeGreaterThan(sizes[1]);
    shape.push(await page.locator('main h2').allInnerTexts().then((hs) => hs.map((h) => h.replace(/@\w+/, '@h').replace(/\s*New record$/, '').replace(/^(Best|Worst) trade$|^Only trade this month$/, 'pick'))));
    const alt = (await page.locator('meta[property="og:image:alt"]').getAttribute('content'))!;
    expect(alt).toContain(DISCLAIMER);
    expect(alt).not.toMatch(/win rate/i);
  }
  // Same sections, losing month and winning month alike.
  expect(new Set(shape[0])).toEqual(new Set(shape[1]));
});

test('F-12 AC10: a demo record\'s strip says Demo and never "verified"', async ({ page }) => {
  const [t] = await sql`select c.sell_id from closed_trades c join users u on u.id = c.user_id where u.handle = 'momentum_maya' order by c.closed_at desc limit 1`;
  await page.goto(`/u/momentum_maya/trade/${encodeURIComponent(t.sell_id)}`);
  const section = page.locator('section[aria-labelledby="whole-record"]');
  await expect(section).toContainText('Demo data');
  expect(await section.innerText()).not.toMatch(/verified/i);
  const alt = (await page.locator('meta[property="og:image:alt"]').getAttribute('content'))!;
  expect(alt).toMatch(/Demo data/);
  expect(alt).not.toMatch(/verified/i);
});

// The image band: decoded pixels. Background = the image's own corner colour.
async function bandCheck(png: Buffer, label: string) {
  const img = decodePng(png);
  expect(img.width).toBe(1200);
  expect(img.height).toBe(630);
  const bg = pixel(img, img.width - 1, img.height - 1);
  const ink = (x: number, y: number) => { const p = pixel(img, x, y); return Math.abs(p[0] - bg[0]) + Math.abs(p[1] - bg[1]) + Math.abs(p[2] - bg[2]) > 60; };
  const inBrand = (x: number, y: number) => x >= BRAND_BOX.x && x < BRAND_BOX.x + BRAND_BOX.width && y >= BRAND_BOX.y && y < BRAND_BOX.y + BRAND_BOX.height;
  // Nothing outside the square crop's columns but the brand box; nothing in the 1.91:1 crop's cut rows.
  for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) {
    if (x >= SQUARE_CROP.x0 && x < SQUARE_CROP.x1 && y >= 1 && y < img.height - 1) continue;
    if (inBrand(x, y)) continue;
    if (ink(x, y)) throw new Error(`${label}: ink outside the safe area at ${x},${y}`);
  }
  // Text rows inside the band: at least the strip's lines and the three disclaimer lines, the last one low in the band.
  const rows: number[] = [];
  for (let y = STRIP_BAND.top; y < STRIP_BAND.bottom; y++) {
    let hit = false;
    for (let x = STRIP_BAND.x; x < STRIP_BAND.x + STRIP_BAND.width && !hit; x++) hit = ink(x, y);
    if (hit) rows.push(y);
  }
  const runs = rows.filter((y, k) => k === 0 || rows[k - 1] !== y - 1).length;
  expect(runs, `${label}: text lines in the band`).toBeGreaterThanOrEqual(6);
  expect(rows[rows.length - 1], `${label}: the disclaimer sits low in the band`).toBeGreaterThan(450);
}

test('F-12 AC3: the trade, month and stock images keep everything but the brand inside the crop-safe band', async ({ request }) => {
  const [m] = await sql`select to_char(max(closed_at), 'YYYY-MM') as ym from closed_trades c join users u on u.id = c.user_id where u.handle = 'f10_strip'`;
  for (const [label, url] of [
    ['trade', '/u/f10_strip/trade/f10_strip-0/opengraph-image'],
    ['trade (too early)', '/u/f10_early/trade/f10_early-0/opengraph-image'],
    ['month', `/u/f10_strip/month/${m.ym}/opengraph-image`],
    ['stock', '/t/FTS0/opengraph-image'],
  ]) {
    const r = await request.get(url);
    expect(r.status(), label).toBe(200);
    expect(r.headers()['content-type']).toContain('image/png');
    await bandCheck(Buffer.from(await r.body()), label);
  }
});
