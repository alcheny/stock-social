// F-21 · Exclusion counts beside the headline (docs/features/F-21-exclusion-counts-beside-the-headline.md; committee
// decisions 10 and 12; legal R1-R5). Signed out at 360 px: the swipe pane shows one muted line under its headline when the
// record's exclusions sum to more than 0 and none at 0; the feed card keeps one record line; the trade and month pages'
// record strips carry the same line; every count equals the profile's #excluded heading, whose reason lines add up to it;
// the link lands on #excluded with focus; the disclaimer stays in view at 360×740 in both pane orders; 320 px reflows;
// the colour is --muted. Fixtures: SQL-seeded traders under random handles, feed-eligible, so the feed lock is shared.
import { test, expect, type Page } from '@playwright/test';
import { readFileSync, mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { EXCLUSIONS, OPTIONS } from '../lib/copy.ts';
import { PAYLOAD_V } from '../lib/chart-series.ts';
import { exclusionTotal } from '../lib/exclusions.ts';
import { ExcludedSection } from '../app/u/[handle]/excluded-section.tsx';
import { feedLock } from './feed-lock.ts';

const DAY = 86_400_000;
const R = randomUUID().replace(/-/g, '').slice(0, 5); // fixture tag (crypto: CodeQL flags Math.random)
const A = `f21a_${R}`; // excluded_corporate = 2, one open position (the open-positions order)
const B = `f21b_${R}`; // corporate 2 and 1,000 option closes excluded: the line wraps to two lines; no open positions
const W = `f21w_${R}`; // the wrap fixture with an open position (decision 10: both orders)
const Z = `f21z_${R}`; // every count 0
const ALL = [A, B, W, Z];
const sql = postgres(process.env.DATABASE_URL!, { max: 2, onnotice: () => {} });
const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
const SHOTS = new URL('../docs/features/logs/F-21/screenshots/', import.meta.url);

test.describe.configure({ mode: 'serial' });
test.use({ viewport: { width: 360, height: 740 } });

let release: (() => Promise<void>) | null = null;
const sells: Record<string, string> = {};
test.beforeAll(async () => {
  release = await feedLock('shared');
  await sql`delete from users where handle in ${sql(ALL)}`;
  for (const [k, handle] of ALL.entries()) {
    const [u] = await sql`
      with a as (insert into signup_attempts (method, adult_attested_at) values ('dev', now()) returning id)
      insert into users (handle, display_name, adult_attested_at, signup_attempt_id) select ${handle}, ${`F21 Fixture ${k}`}, now(), a.id from a returning id, signup_attempt_id`;
    await sql`insert into connections (attempt_id, user_id, state, consent_at, importing_at, connected_at, last_progress_at)
      values (${u.signup_attempt_id}, ${u.id}, 'connected', now() - interval '60 days', now() - interval '60 days', now() - interval '60 days', now())`;
    const at = (d: number) => new Date(Date.now() - d * DAY);
    // Five recent closes with large moves (feed-eligible, near the top), the newest a few minutes old.
    await sql`insert into closed_trades ${sql(Array.from({ length: 5 }, (_, i) => ({ user_id: u.id, sell_id: `${handle}-s${i}`, account_id: `${handle}-a`, symbol: `F21${'ABCDE'[i]}`,
      opened_at: at(i + 3), closed_at: new Date(Date.now() - (i + 1) * 300_000), return_pct: [0.42, -0.31, 0.27, -0.22, 0.18][i], holding_days: 3, verified: true })))}`;
    sells[handle] = `${handle}-s0`;
    if (handle === A || handle === W) await sql`insert into open_positions (user_id, account_id, symbol, unrealized_pct) values (${u.id}, ${`${handle}-a`}, 'F21O', 0.05)`;
  }
  await sql`update users set excluded_corporate = 2 where handle = ${A}`;
  await sql`update users set excluded_corporate = 2, excluded_options_other = 1000 where handle in ${sql([B, W])}`;
});
test.afterAll(async () => {
  await sql`delete from users where handle in ${sql(ALL)}`;
  await sql.end({ timeout: 1 });
  await release?.();
});

// The feed rows of the given handles, walking the no-JS feed's plain next links (at most 12 pages).
async function feedRows(page: Page, handles: string[]) {
  let url: string | null = '/';
  const seen = new Set<string>();
  for (let i = 0; i < 12 && url && seen.size < handles.length; i++) {
    await page.goto(url);
    for (const hd of handles) if (await page.locator(`.row[data-handle="${hd}"]`).count()) seen.add(hd);
    if (seen.size < handles.length) url = await page.locator('.feed-more a.button[href*="after="]').getAttribute('href').catch(() => null);
  }
  return seen;
}
const countIn = (s: string | null) => Number((s ?? '').replace(/,/g, '').match(/^(\d+) trades? excluded/)?.[1] ?? NaN);
const noHScroll = async (page: Page, w: number) => expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(w);

test('F-21 pane (360×740, signed out): the line under the headline at n > 0, none at 0; one record line on the card; disclaimer in view in both orders', async ({ browser }) => {
  test.setTimeout(test.info().timeout + 60_000);
  const ctx = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 360, height: 740 } });
  const page = await ctx.newPage();
  try {
    const found = await feedRows(page, [A, W]);
    expect([...found].sort()).toEqual([A, W].sort());
    for (const hd of [A, W]) {
      await feedRows(page, [hd]);
      const row = page.locator(`.row[data-handle="${hd}"]`).first();
      const pane = row.locator('section.pane');
      const line = pane.locator('[data-exclusions]');
      await expect(line).toHaveCount(1);
      await expect(line).toHaveText(EXCLUSIONS.line(hd === A ? 2 : 1002));
      await expect(line.locator('a')).toHaveAttribute('href', `/u/${hd}#excluded`);
      // AC (D22): the card holds exactly one record line and no exclusions line.
      const card = row.locator('article.card');
      await expect(card.locator('[data-strip]')).toHaveCount(1);
      await expect(card.locator('[data-exclusions]')).toHaveCount(0);
      // Open-positions order: stats, exclusions, open grid, then the disclaimer, whose bottom stays within 740 of the pane top.
      const m = await pane.evaluate((el) => {
        const top = el.getBoundingClientRect().top;
        const q = (s: string) => el.querySelector(s)!;
        const seq = [...el.querySelectorAll('section.stats, [data-exclusions], .pane-options, [data-disclaimer]')].map((n) => (n as HTMLElement).dataset.exclusions !== undefined ? 'exclusions' : n.classList.contains('open-stats') ? 'open' : n.classList.contains('pane-options') ? 'options' : n.matches('[data-disclaimer]') ? 'disclaimer' : 'stats');
        const ln = q('[data-exclusions] a') as HTMLElement;
        const layout = [...el.children].map((c) => `${c.tagName}.${c.className}:${Math.round(c.getBoundingClientRect().top - top)}+${Math.round(c.getBoundingClientRect().height)}`).join(' ');
        return { f3: q('[data-disclaimer]').getBoundingClientRect().bottom - top, seq, layout, lines: Math.round(ln.getBoundingClientRect().height / parseFloat(getComputedStyle(ln).lineHeight)) };
      });
      expect(m.f3, m.layout).toBeLessThanOrEqual(740);
      expect(m.seq.slice(0, 3)).toEqual(['stats', 'exclusions', 'open']);
      expect(m.seq.indexOf('disclaimer')).toBeGreaterThan(m.seq.indexOf('open'));
      if (hd === W) {
        expect(m.lines, 'the wrap fixture wraps').toBeGreaterThanOrEqual(2);
        // Slot AC (F-29/F-34 not built yet): the options qualifier line follows exclusions and open; F-34's open line is absent today.
        expect(m.seq.indexOf('options')).toBeGreaterThan(m.seq.indexOf('open'));
      }
    }
    // Without open positions (chart first, then the disclaimer, then the figures): the line cannot push the disclaimer.
    await feedRows(page, [B]);
    const pb = page.locator(`.row[data-handle="${B}"] section.pane`).first();
    await expect(pb.locator('[data-exclusions]')).toHaveText(EXCLUSIONS.line(1002));
    const fb = await pb.evaluate((el) => {
      const top = el.getBoundingClientRect().top;
      return { f3: el.querySelector('[data-disclaimer]')!.getBoundingClientRect().bottom - top, after: !!(el.querySelector('[data-disclaimer]')!.compareDocumentPosition(el.querySelector('[data-exclusions]')!) & Node.DOCUMENT_POSITION_FOLLOWING) };
    });
    expect(fb.f3).toBeLessThanOrEqual(740);
    expect(fb.after).toBe(true);
    // Zero: no line.
    await feedRows(page, [Z]);
    await expect(page.locator(`.row[data-handle="${Z}"] [data-exclusions]`)).toHaveCount(0);
    // Screenshots of the pane in the open-positions order, light and dark (decision 14), only when asked (F21_SHOTS=1), so
    // an ordinary run never rewrites the committed files.
    if (!process.env.F21_SHOTS) return;
    mkdirSync(SHOTS, { recursive: true });
    await feedRows(page, [W]);
    for (const scheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await page.locator(`.row[data-handle="${W}"] section.pane`).first().screenshot({ path: new URL(`pane-open-order-360-${scheme}.png`, SHOTS).pathname });
    }
  } finally {
    await ctx.close();
  }
});

test('F-21 equality and the link: pane JSON, profile heading, trade and month strips carry one number; the link lands on #excluded with focus', async ({ page, request }) => {
  const body = await (await request.get(`/u/${A}/pane?v=${PAYLOAD_V}`)).json();
  expect(body.model.excluded).toBe(2);
  expect((await (await request.get(`/u/${Z}/pane?v=${PAYLOAD_V}`)).json()).model.excluded).toBe(0);
  await page.goto(`/u/${A}`);
  const heading = await page.locator('#excluded-h').textContent();
  expect(heading).toBe(EXCLUSIONS.title(2));
  const ym = new Date(Date.now() - 300_000).toISOString().slice(0, 7);
  const trade = `/u/${A}/trade/${encodeURIComponent(sells[A])}`;
  for (const path of [trade, `/u/${A}/month/${ym}`]) {
    await page.goto(path);
    const line = page.locator('section[aria-labelledby="whole-record"] [data-exclusions]');
    await expect(line).toHaveCount(1);
    expect(countIn(await line.textContent()), path).toBe(countIn(heading));
    // Right after the F3 line, which stays right after the figures (fixes-labels AC8: [data-strip] + [data-disclaimer]).
    expect(await line.evaluate((el) => [el.previousElementSibling?.matches('[data-disclaimer]'), el.previousElementSibling?.previousElementSibling?.matches('[data-strip]')])).toEqual([true, true]);
    await noHScroll(page, 360);
  }
  await page.goto(`/u/${Z}/trade/${encodeURIComponent(sells[Z])}`);
  await expect(page.locator('[data-exclusions]')).toHaveCount(0);
  // The link: a real link, its name says where it goes, a 44 px target; it lands on #excluded and focus moves there.
  await page.goto(trade);
  const link = page.getByRole('link', { name: /excluded from these figures · reasons on the profile/ });
  await expect(link).toHaveCount(1);
  expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await link.click();
  await expect(page).toHaveURL(new RegExp(`/u/${A}#excluded$`));
  await expect.poll(() => page.evaluate(() => document.activeElement?.id)).toBe('excluded');
  await expect(page.locator('#excluded [data-reason="corporate"]')).toHaveCount(1);
  // A direct load focuses it too.
  await page.goto(`/u/${A}#excluded`);
  await expect.poll(() => page.evaluate(() => document.activeElement?.id)).toBe('excluded');
});

test('F-21 profile #excluded (R1, R4): the reason lines add up to the heading, gate closed on the app and gate open as markup', async ({ page }) => {
  await page.goto(`/u/${B}`);
  const sum = async () => (await page.locator('#excluded [data-n]').evaluateAll((els) => els.map((e) => Number((e as HTMLElement).dataset.n)))).reduce((a, n) => a + n, 0);
  expect(countIn(await page.locator('#excluded-h').textContent())).toBe(1002);
  expect(await sum()).toBe(1002);
  // Gate closed: the gated line word for word (with its /how link), no short or technical line.
  await expect(page.locator('#excluded .options-gated')).toHaveText(`${OPTIONS.gated(1000, 0)} ${OPTIONS.howLink}`);
  await expect(page.locator('#excluded .options-technical, #excluded .options-short')).toHaveCount(0);
  // Gate open (the options consent gate cannot open in this build): the section's own markup, with the app's stylesheet.
  const c = { excluded_positions: 1, excluded_future_sells: 0, excluded_corporate: 2, excluded_held: 1, excluded_shared: 1, public: null,
    options: { shown: 3, short: 1, other: 2, openLong: 1, openShort: 1, openOther: 1, unsupported: 0, exerciseShares: 1 }, gate: 'open' as const };
  await page.setContent(`<!doctype html><html><head><meta name="viewport" content="width=device-width"><style>${css}</style></head><body><main class="page">${renderToStaticMarkup(h(ExcludedSection, { c }))}</main></body></html>`);
  expect(countIn(await page.locator('#excluded-h').textContent())).toBe(exclusionTotal(c));
  expect(await sum()).toBe(exclusionTotal(c));
  await expect(page.locator('#excluded .options-summarized')).toHaveText(EXCLUSIONS.optionsSummarized(3));
  await noHScroll(page, 360);
});

test('F-21 reflow at 320 px and the muted colour in both schemes', async ({ browser }) => {
  for (const scheme of ['light', 'dark'] as const) {
    const ctx = await browser.newContext({ viewport: { width: 320, height: 640 }, colorScheme: scheme });
    const page = await ctx.newPage();
    try {
      for (const path of [`/u/${A}`, `/u/${A}/trade/${encodeURIComponent(sells[A])}`, `/u/${B}/trade/${encodeURIComponent(sells[B])}`]) {
        await page.goto(path);
        await noHScroll(page, 320);
      }
      const a = page.locator('[data-exclusions] a');
      const [colour, muted] = await a.evaluate((el) => {
        const probe = document.createElement('span');
        probe.style.color = 'var(--muted)';
        document.body.appendChild(probe);
        const m = getComputedStyle(probe).color;
        probe.remove();
        return [getComputedStyle(el).color, m];
      });
      expect(colour, scheme).toBe(muted);
      expect(await a.evaluate((el) => getComputedStyle(el).textDecorationLine)).toContain('underline');
      expect(await page.locator('[data-exclusions] svg, [data-exclusions] [data-warn-icon]').count()).toBe(0);
    } finally {
      await ctx.close();
    }
  }
});
