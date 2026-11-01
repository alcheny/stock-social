// F-7 public-record traders: the profile, trade, month and pane surfaces of a fictional filer at 360 px
// (plan-round2-engineer.md §4.3 AC 14-19, 25, 26, 28, 30, 34 as amended by docs/features/logs/F-7/plan.md Rounds 4-5).
// The fixture filers are this spec's own (`pf_e7*`), inserted with SQL and deleted before and after. pf_e7p is not
// feed-eligible (4 closes), so this spec takes no feed lock.
import { test, expect, type Page } from '@playwright/test';
import postgres from 'postgres';
import { buyFilingUrl, deleteFilers, ensureImportState, filingUrl, insertFiler, RAW_AMOUNTS } from './f7-fixture.ts';

const DISCLAIMER = 'Not investment advice. Past performance does not guarantee future results.';
const NOT_JOINED = 'Built from public filings. This person has not joined Stock Social, has not connected a broker, has not reviewed this record and does not endorse it.';
const sql = postgres(process.env.DATABASE_URL!, { max: 2, onnotice: () => {} });
const P = 'pf_e7p', HID = 'pf_e7h', REAL = 'pf_e7r', EMPTY = 'pf_e7e';
const HANDLES = [P, HID, REAL, EMPTY];
const CLOSES = [{ symbol: 'ZQXA', r: 0.12, daysAgo: 40 }, { symbol: 'ZQXB', r: -0.07, daysAgo: 50 }, { symbol: 'ZQXC', r: 0.03, daysAgo: 60 },
  // Filed this week: inside the feed floor, but on the profile at once (AC 21).
  { symbol: 'ZQXD', r: -0.2, daysAgo: 2, feedAfterDaysAgo: -28 }];

test.describe.configure({ mode: 'serial' });
test.use({ viewport: { width: 360, height: 800 } });

test.beforeAll(async () => {
  await deleteFilers(sql, HANDLES);
  await ensureImportState(sql);
  await insertFiler(sql, { handle: P, name: 'Fictional Filer Prime', excluded: { no_price: 3, unreconciled: 1, indirect: 2 }, openSymbols: ['ZQXQ', 'ZQXO'], closes: CLOSES });
  await insertFiler(sql, { handle: HID, name: 'Fictional Filer Hidden', hidden: true, closes: CLOSES.slice(0, 1) });
  await insertFiler(sql, { handle: EMPTY, name: 'Fictional Filer Empty', excluded: { no_price: 2 }, closes: [] });
  await insertFiler(sql, { handle: REAL, name: 'Fictional Filer Plain', demo: false, closes: CLOSES.slice(0, 2) });
});
test.afterAll(async () => {
  await deleteFilers(sql, HANDLES);
  await sql.end({ timeout: 1 });
});

// AC 14, 34 (C9): the share image's alt, as og:image:alt and twitter:image:alt, carries the label and the line.
async function imageAlts(page: Page, imagePath: string) {
  for (const sel of ['meta[property="og:image:alt"]', 'meta[name="twitter:image:alt"]']) {
    const v = (await page.locator(sel).first().getAttribute('content'))!;
    expect(v, sel).toContain('Public filing');
    expect(v, sel).toContain('has not joined Stock Social');
    expect(v, sel).not.toMatch(/verified/i);
    for (const a of RAW_AMOUNTS) expect(v).not.toContain(a);
  }
  expect(await page.locator('meta[property="og:image"]').first().getAttribute('content')).toContain(imagePath);
}

async function common(page: Page) {
  await expect(page.locator('footer#site-footer')).toContainText(DISCLAIMER);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  // Never Verified, never an amount, on any public surface (AC 14, 17).
  await expect(page.locator('.badge.verified')).toHaveCount(0);
  const html = await page.content();
  for (const a of RAW_AMOUNTS) expect(html).not.toContain(a);
  expect(await page.locator('main').innerText()).not.toMatch(/\bVerified\b|insider (buying|trading)|smart money|\bsignals?\b/i);
}
// Every link in these blocks is at least 44 px tall (AC 26).
async function tall(page: Page, selector: string) {
  const hs = await page.locator(selector).evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
  expect(hs.length).toBeGreaterThan(0);
  for (const h of hs) expect(h).toBeGreaterThanOrEqual(44);
}

test('AC 14, 15: profile labels and the top block, in order, with the correction link (Round 4 item 1)', async ({ page }) => {
  await page.goto(`/u/${P}`);
  await expect(page.locator('h1')).toHaveText('Fictional Filer Prime');
  const row1 = page.locator('main > p.muted').first();
  await expect(row1.locator('.badge.public')).toHaveText('Public filing');
  await expect(row1.locator('.badge.demo')).toHaveText('Demo');
  await expect(row1).toContainText('Company insider');
  const top = page.locator('[data-public-top] > p');
  await expect(top.nth(0)).toHaveText(NOT_JOINED);
  await expect(top.nth(1)).toContainText(/^Record since \w{3} \d{1,2}, \d{4} · last checked (\w{3} \d{1,2}, \d{4}|not yet) · Request a correction or removal →$/);
  const [{ last }] = await sql`select last_success_at as last from public_import_state where source = 'insider_reports'`;
  const stale = !last || Date.now() - (last as Date).getTime() > 7 * 86_400_000;
  await expect(top.nth(2)).toHaveText(`Filings can be late, amended or missing.${stale ? ' This record may be out of date.' : ''}`);
  // The block sits right under the badge row, above the stats.
  const y = async (sel: string) => (await page.locator(sel).first().boundingBox())!.y;
  expect(await y('main > p.muted')).toBeLessThan(await y('[data-public-top]'));
  expect(await y('[data-public-top]')).toBeLessThan(await y('section.stats'));
  await tall(page, '[data-public-top] a');
  await expect(page.locator('.badge.new')).toHaveCount(0); // AC 31
  await common(page);
  await page.locator('[data-public-top] a').click();
  await expect(page).toHaveURL(/\/public-records$/);
  await expect(page.locator('[data-contact]')).not.toBeEmpty();
});

test('AC 16, 18, 19: filing links per row, exclusions by reason, open symbols with no percent', async ({ page }) => {
  await page.goto(`/u/${P}`);
  const rows = page.locator('ul.closes > li');
  await expect(rows).toHaveCount(CLOSES.length); // the close inside the feed floor shows here at once
  const links = page.locator('ul.closes a.filing-link');
  await expect(links).toHaveCount(CLOSES.length);
  const hrefs = await links.evaluateAll((els) => els.map((e) => e.getAttribute('href')));
  expect(new Set(hrefs)).toEqual(new Set(CLOSES.map((_, i) => filingUrl(P, i))));
  for (const l of await links.all()) {
    await expect(l).toHaveText('Filing ↗');
    await expect(l).toHaveAccessibleName(/^Public filing for the ZQX[A-D] sale closed .+, opens another site$/);
    await expect(l).toHaveAttribute('target', '_blank');
  }
  await tall(page, 'ul.closes a.filing-link');
  const ex = page.locator('[data-public-excluded]');
  await expect(ex).toHaveText([
    '3 sales excluded: no priced open-market purchase before them in the filings (for example shares received as pay).',
    "1 sale excluded: holdings didn't reconcile, possibly a stock split.",
    '2 transactions in indirectly held shares excluded.',
  ]);
  const open = page.locator('[data-public-open]');
  await expect(open.locator('h2')).toHaveText('Open positions');
  await expect(open.locator('p').first()).toHaveText('ZQXO, ZQXQ');
  expect(await open.innerText()).not.toContain('%');
  await expect(page.locator('section.open-stats, ul.positions')).toHaveCount(0);
});

test('AC 28, 30, 34: no Follow, thesis, share prompt or join CTA; noindex; unfurl and alt carry the label and the line', async ({ page, request }) => {
  await page.goto(`/u/${P}`);
  await expect(page.getByRole('button', { name: /follow/i })).toHaveCount(0);
  await expect(page.locator('form input[name="thesis"], .share-prompt, .join-cta, .similar')).toHaveCount(0);
  expect(await page.locator('meta[name="robots"]').getAttribute('content')).toMatch(/noindex/);
  for (const sel of ['meta[name="description"]', 'meta[property="og:description"]', 'meta[property="og:image:alt"]']) {
    const v = (await page.locator(sel).first().getAttribute('content'))!;
    expect(v, sel).toContain('Public filing');
    expect(v, sel).toContain('has not joined Stock Social');
    expect(v, sel).not.toMatch(/verified/i);
    for (const a of RAW_AMOUNTS) expect(v).not.toContain(a);
  }
  const img = await request.get(`/u/${P}/opengraph-image`);
  expect(img.status()).toBe(200);
  expect(img.headers()['content-type']).toContain('image/png');
  const map = await (await request.get('/sitemap.xml')).text();
  expect(map).not.toContain('pf_');
  expect(map).not.toMatch(/ZQX/);
});

test('AC 25: signed out and signed in see the same profile', async ({ browser, page }) => {
  await page.goto(`/u/${P}`, { waitUntil: 'networkidle' }); // both read after hydration (the chart adds its list)
  const out = await page.locator('main').innerText();
  const ctx = await browser.newContext({ viewport: { width: 360, height: 800 } });
  const me = await ctx.newPage();
  const h = `e7v${Math.random().toString(36).slice(2, 8)}`;
  try {
    await me.goto('/login/dev');
    await me.getByLabel('Handle').fill(h);
    await me.getByLabel('I am 18 or older').check();
    await me.getByRole('button', { name: 'Continue' }).click();
    await expect(me).toHaveURL(new RegExp(`/u/${h}$`));
    await me.goto(`/u/${P}`, { waitUntil: 'networkidle' });
    expect(await me.locator('main').innerText()).toBe(out);
    await expect(me.getByRole('button', { name: /follow/i })).toHaveCount(0);
  } finally {
    await ctx.close();
    await sql`delete from users where handle = ${h}`;
  }
});

test('AC 14, 16, 17: the trade page links both filings, carries the line and the labels; the month page too', async ({ page }) => {
  await page.goto(`/u/${P}/trade/${encodeURIComponent(`pub:${P}:0`)}`);
  await expect(page.locator('.badge.public')).toHaveText('Public filing');
  await expect(page.locator('.badge.demo')).toHaveCount(1);
  await expect(page.locator('[data-public-line]')).toContainText(NOT_JOINED);
  await expect(page.locator('[data-public-line] a')).toHaveAttribute('href', '/public-records');
  await expect(page.getByRole('link', { name: 'Public filing for the ZQXA sale, opens another site' })).toHaveAttribute('href', filingUrl(P, 0));
  await expect(page.getByRole('link', { name: 'Public filing for the ZQXA purchase, opens another site' })).toHaveAttribute('href', buyFilingUrl(P, 0));
  await tall(page, '.filing-links a, [data-public-line] a');
  await expect(page.locator('.join-cta, .badge.new')).toHaveCount(0);
  const desc = (await page.locator('meta[name="description"]').getAttribute('content'))!;
  expect(desc).toContain('Public filing');
  expect(desc).toContain('has not joined Stock Social');
  await imageAlts(page, `/u/${P}/trade/${encodeURIComponent(`pub:${P}:0`)}/opengraph-image`);
  await common(page);
  const ym = new Date(Date.now() - 40 * 86_400_000).toISOString().slice(0, 7);
  await page.goto(`/u/${P}/month/${ym}`);
  await imageAlts(page, `/u/${P}/month/${ym}/opengraph-image`);
  // UX (F3a): a filer's month list is not a completeness claim.
  await expect(page.getByRole('heading', { name: 'Closed trades this month' })).toBeVisible();
  await expect(page.getByText('All trades this month')).toHaveCount(0);
  await expect(page.locator('.badge.public')).toHaveText('Public filing');
  await expect(page.locator('[data-public-line]')).toContainText(NOT_JOINED);
  await expect(page.locator('[data-public-line] a')).toHaveText('Request a correction or removal →');
  await common(page);
});

test('AC 13 (C11): a filer not marked demo shows Public filing without Demo; the pane data says public', async ({ page, request }) => {
  await page.goto(`/u/${REAL}`);
  await expect(page.locator('.badge.public')).toHaveCount(1);
  await expect(page.locator('.badge.demo')).toHaveCount(0);
  await common(page);
  const pane = await (await request.get(`/u/${P}/pane`)).json();
  expect(pane.state).toBe('public_demo');
  expect(JSON.stringify(pane)).not.toMatch(/4321|98\.76/);
});

test('AC 9, 23: a hidden filer is 404 on every surface', async ({ request }) => {
  const sell = encodeURIComponent(`pub:${HID}:0`);
  const ym = new Date(Date.now() - 40 * 86_400_000).toISOString().slice(0, 7);
  for (const path of [`/u/${HID}`, `/u/${HID}/pane`, `/u/${HID}/pane-chart`, `/u/${HID}/story`, `/u/${HID}/opengraph-image`, `/u/${HID}/trade/${sell}`, `/u/${HID}/month/${ym}`]) {
    expect((await request.get(path)).status(), path).toBe(404);
  }
  // The share images of a hidden record draw "not found", never the record.
  const img = await request.get(`/u/${HID}/trade/${sell}/opengraph-image`);
  expect(img.status()).not.toBe(500);
});

test('Round 4 item 2: a filer with no priced closed trade has no page and no card', async ({ request }) => {
  for (const path of [`/u/${EMPTY}`, `/u/${EMPTY}/opengraph-image`, `/u/${EMPTY}/story`]) expect((await request.get(path)).status(), path).toBe(404);
});

test('AC 7: the dev login form with a filer handle creates no session', async ({ page }) => {
  await page.goto('/login/dev');
  await page.getByLabel('Handle').fill(P);
  await page.getByLabel('I am 18 or older').check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.waitForLoadState('networkidle');
  expect(page.url()).not.toMatch(new RegExp(`/u/${P}$`));
  // The form's own error, not a server error page.
  await expect(page.locator('main').getByRole('alert')).toHaveText('That handle is taken or reserved.');
  await expect(page.getByLabel('Handle')).toBeVisible();
  await page.goto('/how');
  await expect(page.locator('body')).toHaveAttribute('data-viewer', 'guest');
  const [{ n }] = await sql`select count(*)::int as n from sessions s join users u on u.id = s.user_id where u.handle = ${P}`.catch(() => [{ n: 0 }]);
  expect(n).toBe(0);
});
