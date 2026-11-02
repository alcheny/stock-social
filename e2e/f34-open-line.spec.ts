// F-34 · One open-positions line on every surface (docs/features/F-34-one-open-positions-line.md, plan
// docs/features/logs/F-34/plan.md §7, §8) against the running app, signed out: a fictional trader (`f34_*`, deleted
// before and after) with a −15% open loser. The line is byte-identical on the profile, the pane, the feed card, the
// trade and month pages and in the three link previews' descriptions and image alts; the three images make no vendor
// call; the pane keeps its headline and disclaimer in view at 360 px and reflows at 320 px; the feed card's line wraps
// to at most 3 lines at 320 px with "-15.0%" never apart from "down". The trader is feed-eligible (5 closes in the last
// day), so the shared feed lock is held while it exists (as f6-open-positions.spec.ts).
import { test, expect, type Page } from '@playwright/test';
import postgres from 'postgres';
import { feedLock } from './feed-lock.ts';

const DAY = 86_400_000;
const READ = new Date('2026-10-30T12:00:00Z');
const H = 'f34_line';
const NB = ' ';
const TEXT = `Still open: 3 positions · 2${NB}up, 1${NB}down · lowest -15.0%${NB}down, highest +4.0%${NB}up`;
const WITH_AS_OF = `${TEXT}, unrealized as of Oct 30, 2026`;
const ALT = 'Still open: 3 positions, 2 up, 1 down, lowest -15.0% down, highest +4.0% up, unrealized as of Oct 30, 2026.';
const sql = postgres(process.env.DATABASE_URL!, { max: 2, onnotice: () => {} });
let ym = '';

test.describe.configure({ mode: 'serial' });
let releaseFeed: (() => Promise<void>) | null = null;
test.beforeAll(async () => {
  releaseFeed = await feedLock('shared');
  await sql`delete from users where handle = ${H}`;
  const [u] = await sql`
    with a as (insert into signup_attempts (method, adult_attested_at) values ('dev', now()) returning id)
    insert into users (handle, display_name, adult_attested_at, signup_attempt_id) select ${H}, 'F34 Line', now(), a.id from a returning id, signup_attempt_id`;
  const closes = [0.25, -0.22, 0.3, -0.2, 0.24];
  await sql`insert into closed_trades ${sql(closes.map((r, i) => ({
    user_id: u.id, sell_id: `${H}-${i}`, account_id: 'a', symbol: `F34L${i}`, opened_at: new Date(Date.now() - (2.05 + i * 0.01) * DAY),
    closed_at: new Date(Date.now() - (0.05 + i * 0.01) * DAY), return_pct: r, holding_days: 2, verified: true,
  })))}`;
  ym = new Date(Date.now() - 0.05 * DAY).toISOString().slice(0, 7);
  await sql`insert into connections (attempt_id, user_id, state, consent_at, importing_at, last_progress_at) values (${u.signup_attempt_id}, ${u.id}, 'connected', now(), now(), now())`;
  await sql`insert into open_positions ${sql([-0.15, 0.04, 0.012].map((p, i) => ({ user_id: u.id, account_id: 'a', symbol: `F34O${i}`, unrealized_pct: p, fetched_at: READ })))}`;
});
test.afterAll(async () => {
  await sql`delete from users where handle = ${H}`;
  await sql.end({ timeout: 1 });
  await releaseFeed?.();
});

const textOf = (page: Page, sel: string) => page.locator(sel).first().evaluate((el) => el.textContent);
const meta = (page: Page, p: string) => page.locator(`meta[property="${p}"]`).first().getAttribute('content');
async function noHScroll(page: Page, w: number) { expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(w); }
// "-15.0%" and "down" share one line box.
async function together(page: Page, scope: string) {
  const ok = await page.locator(scope).first().evaluate((el) => {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const t = n.textContent ?? '', i = t.indexOf('-15.0%');
      if (i < 0) continue;
      const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + '-15.0% down'.length);
      return r.getClientRects().length === 1;
    }
    return false;
  });
  expect(ok, `"-15.0% down" on one line in ${scope}`).toBe(true);
}

test('F-34 AC1: the profile prints the line; its description and image alt carry withAsOf and the alt form', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto(`/u/${H}`);
  expect(await textOf(page, 'section.open-stats [data-open-line]')).toBe(TEXT);
  await expect(page.locator('section.open-stats .stat small').first()).toHaveText('open positions');
  await expect(page.locator('.chart-note')).toHaveText('Chart: closed trades only. Not plotted: open positions.');
  expect(await meta(page, 'og:description')).toContain(WITH_AS_OF);
  expect(await meta(page, 'og:image:alt')).toContain(ALT);
  await together(page, 'section.open-stats [data-open-line]');
  await noHScroll(page, 360);
  await page.setViewportSize({ width: 320, height: 800 });
  await noHScroll(page, 320);
  await together(page, 'section.open-stats [data-open-line]');
});

test('F-34 AC1: the trade and month pages print withAsOf in the strip; descriptions and alts match', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  for (const path of [`/u/${H}/trade/${H}-0`, `/u/${H}/month/${ym}`]) {
    await page.goto(path);
    expect(await textOf(page, '[data-strip] [data-open-line]'), path).toBe(WITH_AS_OF);
    expect(await meta(page, 'og:description'), path).toContain(WITH_AS_OF);
    const alt = (await meta(page, 'og:image:alt'))!;
    expect(alt, path).toContain(ALT);
    expect(alt.slice(alt.indexOf('Still open')), path).not.toMatch(/[·()]/);
    await noHScroll(page, 360);
    await page.setViewportSize({ width: 320, height: 800 });
    await noHScroll(page, 320);
    await together(page, '[data-strip] [data-open-line]');
    await page.setViewportSize({ width: 360, height: 800 });
  }
});

test('F-34 AC5: the three images render from stored positions with no vendor call', async ({ request }) => {
  const base = process.env.SNAPTRADE_BASE_URL!;
  const before = (await (await request.get(`${base}/_stats`)).json()).requests as number;
  for (const p of [`/u/${H}/opengraph-image`, `/u/${H}/trade/${H}-0/opengraph-image`, `/u/${H}/month/${ym}/opengraph-image`]) {
    const r = await request.get(p);
    expect(r.status(), p).toBe(200);
    expect(r.headers()['content-type'], p).toContain('image/png');
  }
  expect((await (await request.get(`${base}/_stats`)).json()).requests).toBe(before);
});

test('F-34 AC1/AC7 and BL-R2-3: the feed card and the pane print the line; 375/360/320 px checks', async ({ browser }) => {
  const ctx = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 375, height: 740 } });
  const page = await ctx.newPage();
  try {
    let url: string | null = '/';
    let found = false;
    for (let i = 0; i < 12 && url && !found; i++) {
      await page.goto(url);
      found = (await page.locator(`.row[data-handle="${H}"]`).count()) > 0;
      if (!found) url = await page.locator('.feed-more a.button[href*="after="]').getAttribute('href').catch(() => null);
    }
    expect(found, `${H} not in feed list`).toBe(true);
    const row = `.row[data-handle="${H}"]`;
    const also = `${row} article.card p.open-also`;
    expect(await textOf(page, also)).toBe(WITH_AS_OF);
    await expect(page.locator(also)).not.toContainText('Also open');
    await expect(page.locator(`${also} b`).first()).toHaveClass('down');
    expect(await page.locator(`${also} b`).first().evaluate((el) => getComputedStyle(el).fontSize)).toBe(await page.evaluate(() => getComputedStyle(document.body).fontSize));
    expect(await textOf(page, `${row} section.pane [data-open-line]`)).toBe(TEXT);
    // The pane's lines in their fixed order (PANE_LINES); absent slots render nothing.
    expect(await page.locator(`${row} section.pane`).first().evaluate((el) => [...el.querySelectorAll('[data-pane-line]')].map((n) => n.getAttribute('data-pane-line')))).toEqual(['open']);
    for (const w of [375, 320]) {
      await page.setViewportSize({ width: w, height: 740 });
      await noHScroll(page, w);
      await together(page, also);
      if (w === 320) {
        const lines = await page.locator(also).first().evaluate((el) => el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight));
        expect(lines).toBeLessThanOrEqual(3.05);
      }
      const sizes = await page.locator(`${row} article.card`).first().evaluate((card) => {
        const ret = parseFloat(getComputedStyle(card.querySelector('.hero .ret')!).fontSize);
        const max = Math.max(...[...card.querySelectorAll('*')].filter((n) => n.textContent?.trim()).map((n) => parseFloat(getComputedStyle(n).fontSize)));
        return { ret, max };
      });
      expect(sizes.ret).toBe(sizes.max);
    }
    // The pane at 360×740: the realized headline and the disclaimer in the first screen, 24 px spare under it.
    await page.setViewportSize({ width: 360, height: 740 });
    const fit = await page.locator(`${row} section.pane`).first().evaluate((pane) => {
      const top = pane.getBoundingClientRect().top;
      const head = pane.querySelector('section.stats .stat b')!.getBoundingClientRect();
      const disc = [...pane.querySelectorAll('p, footer, div')].find((n) => /Not investment advice/.test(n.textContent ?? '') && !n.querySelector('p'))!.getBoundingClientRect();
      return { head: head.bottom - top, disc: disc.bottom - top };
    });
    expect(fit.head).toBeLessThanOrEqual(740);
    expect(fit.disc).toBeLessThanOrEqual(740 - 24);
    await page.setViewportSize({ width: 320, height: 740 });
    await noHScroll(page, 320);
    await together(page, `${row} section.pane [data-open-line]`);
  } finally {
    await ctx.close();
  }
});
