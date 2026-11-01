// OPTIONS (docs/features/logs/options/plan.md AC 16–21, 24, E12) against the running app at 360 × 740.
//   1. Real app, gated (AC 17): the seeded demo trader with options (yolo_yuki, scripts/seed.ts) shows the "Share trades"
//      label and the one count line, signed out; no contract term, option return, strike (123.45) or contract symbol
//      anywhere in the HTML, the description, the alt text, the JSON the pages fetch or the display log; the headline
//      equals the share-only figures.
//   2. Through the vendor fake (port 4102, the vendor's shapes; needs the server started with SNAPTRADE_BASE_URL, see
//      e2e/connect.spec.ts): option rows with and without option_type, the three events with and without option_symbol,
//      option / future / future_option positions, every D4 case; the import counts them and shows the gated line.
//   3. Surfaces when open (round 4 E3): the pure option components rendered with renderToStaticMarkup from the open-gate
//      model, loaded with app/globals.css by page.setContent, light and dark: no horizontal scroll, single-line rows with
//      15% headroom, 44 px targets, accessible names, the options line in at most 2 lines, no countdown words.
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { Server } from 'node:http';
import postgres from 'postgres';
import { createElement as h, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { startVendorFake, type FakeOptionRow } from './fakes/vendor.ts';
import { OpenOptionRows, OptionsLines, OptionTradesSection, PaneOptions, ShareTradesLabel, UnsupportedLine } from '../app/u/[handle]/options-block.tsx';
import { OPTIONS } from '../lib/copy.ts';
import { paneView, type OptionCounts, type OptionHeadline } from '../lib/options-view.ts';

const VENDOR_PORT = Number(process.env.VENDOR_FAKE_PORT ?? 4102);
const sql = postgres(process.env.DATABASE_URL!, { max: 2, onnotice: () => {} });
const DISCLAIMER = 'Not investment advice. Past performance does not guarantee future results.';
const OCC = /[A-Z]{1,6}\s*\d{6}[CP]\d{8}/;
const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
test.afterAll(async () => { await sql.end({ timeout: 1 }); });
test.use({ viewport: { width: 360, height: 740 } });

// ---- 1. The real app, gated.
test('AC17: signed out, the demo trader with options shows the "Share trades" label and the count line, and no option term, return, strike or contract symbol anywhere', async ({ page, request }) => {
  const [u] = await sql`select id, excluded_options_short, excluded_options_other, open_options_short from users where handle = 'yolo_yuki'`;
  test.skip(!u, 'the demo data is not seeded (npm run db:seed)');
  const [{ shown, open }] = await sql`select (select count(*)::int from option_trades where user_id = ${u.id}) as shown, (select count(*)::int from open_option_positions where user_id = ${u.id}) as open`;
  const line = OPTIONS.gated(shown + u.excluded_options_short + u.excluded_options_other, open + u.open_options_short);
  expect(line).toBe("4 option trades and 1 open option imported, not shown: this record's public consent doesn't cover options yet.");
  const optionPcts = (await sql`select return_pct from option_trades where user_id = ${u.id}`).map((r) => Math.abs(Number(r.return_pct) * 100).toFixed(1));
  const sharePcts = new Set((await sql`select return_pct from closed_trades where user_id = ${u.id}`).map((r) => Math.abs(Number(r.return_pct) * 100).toFixed(1)));
  const json: string[] = [];
  page.on('response', async (r) => { if ((r.headers()['content-type'] ?? '').includes('json')) json.push(await r.text().catch(() => '')); });
  await page.goto('/u/yolo_yuki');
  await expect(page.locator('.share-label')).toHaveText('Share trades');
  await expect(page.locator('.options-gated')).toHaveText(line);
  await expect(page.locator('.options-gated a')).toHaveAttribute('href', '/how#options');
  await expect(page.locator('footer#site-footer')).toContainText(DISCLAIMER);
  // The headline equals the share-only figures (option_trades never reach it).
  const [s] = await sql`select avg(case when return_pct > 0 then 1.0 else 0 end) as w, avg(return_pct) as a from closed_trades where user_id = ${u.id}`;
  await expect(page.locator('section.stats').first().locator('.stat.big').first()).toHaveText(`${(Number(s.w) * 100).toFixed(0)}%win rate`);
  const avg = Number(s.a) * 100;
  await expect(page.locator('section.stats').first().locator('.stat.big').nth(1).locator('b')).toHaveText(`${avg > 0 ? '+' : ''}${avg.toFixed(1)}%`);
  await expect(page.locator('figure.chart figcaption')).toHaveText(`Return if every trade were the same size${OPTIONS.chartShareOnly}`);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  const html = await page.content();
  const description = (await page.locator('meta[name="description"]').getAttribute('content')) ?? '';
  const alt = (await page.locator('meta[property="og:image:alt"]').first().getAttribute('content')) ?? '';
  const pane = await (await request.get('/u/yolo_yuki/pane')).text();
  const chart = await (await request.get('/u/yolo_yuki/pane-chart')).text();
  const { writeDisplayLog } = await import('../lib/display-log.ts');
  await writeDisplayLog({ ids: [u.id] });
  const log = JSON.stringify(await sql`select * from display_log where user_id = ${u.id}`);
  expect(log).toContain(line);
  for (const [where, text] of [['html', html], ['description', description], ['alt', alt], ['pane json', pane], ['chart json', chart], ['fetched json', json.join('\n')], ['display log', log]] as const) {
    expect(text, where).not.toContain('Call option');
    expect(text, where).not.toContain('Put option');
    expect(text, where).not.toMatch(/exp [A-Z][a-z]{2} \d/);
    expect(text, where).not.toContain('123.45');
    expect(text, where).not.toMatch(OCC);
    for (const p of optionPcts) if (!sharePcts.has(p)) expect(text, `${where}: option return ${p}%`).not.toContain(`${p}%`);
  }
  expect(alt).toContain(line);
  expect(alt).toContain('average per share trade');
});

test('AC17/AC24: a record with no options renders exactly as before (no label, no line)', async ({ page }) => {
  await page.goto('/u/momentum_maya');
  await expect(page.locator('main')).toContainText('win rate');
  await expect(page.locator('.share-label, .options-gated, .options-line, .option-trades')).toHaveCount(0);
  await expect(page.locator('figure.chart figcaption')).toHaveText('Return if every trade were the same size');
});

// ---- 2. Through the vendor fake.
const os = (o: { right?: 'CALL' | 'PUT'; expiry?: string; mini?: boolean; underlying?: string; type?: string; root?: string } = {}) => {
  const right = o.right ?? 'CALL', expiry = o.expiry ?? '2025-12-19', u = o.underlying ?? 'XYZ';
  return { id: `os-${u}-${right}-${expiry}`, ticker: `${(o.root ?? u).padEnd(6, ' ')}${expiry.slice(2).replace(/-/g, '')}${right[0]}00123450`, option_type: right,
    strike_price: 123.45, expiration_date: expiry, is_mini_option: o.mini ?? false, underlying_symbol: { symbol: u, type: { code: o.type ?? 'cs' } } };
};
// Every D4 case, in the vendor's shapes (AccountUniversalActivity). Dates are in 2025 (past, so none is quarantined).
function d4Rows(p: string): FakeOptionRow[] {
  const r = (id: string, type: FakeOptionRow['type'], at: string, o: Partial<FakeOptionRow> = {}): FakeOptionRow =>
    ({ id: `${p}-${id}`, type, units: 1, price: 1.5, fee: 0.65, currency: { code: 'USD' }, trade_date: `${at}T15:00:00Z`, ...o });
  return [
    r('a1', 'BUY', '2025-03-03', { option_type: 'BUY_TO_OPEN', option_symbol: os() }), r('a2', 'SELL', '2025-03-10', { option_type: 'SELL_TO_CLOSE', option_symbol: os(), price: 2.5 }), // shown
    r('b1', 'BUY', '2025-03-04', { option_symbol: os({ right: 'PUT' }) }), r('b2', 'SELL', '2025-03-11', { option_symbol: os({ right: 'PUT' }), price: 0.9 }), // no option_type: inferred, shown
    r('c1', 'BUY', '2025-04-01', { option_type: 'BUY_TO_OPEN', option_symbol: os({ expiry: '2025-06-20' }) }), r('c2', 'OPTIONEXPIRATION', '2025-06-20', { option_symbol: os({ expiry: '2025-06-20' }), price: 0, amount: 0, fee: 0 }), // -100%, shown
    r('d1', 'SELL', '2025-04-02', { option_type: 'SELL_TO_OPEN', option_symbol: os({ right: 'PUT', expiry: '2025-06-20' }) }), r('d2', 'BUY', '2025-04-09', { option_type: 'BUY_TO_CLOSE', option_symbol: os({ right: 'PUT', expiry: '2025-06-20' }) }), // short
    r('e1', 'SELL', '2025-04-03', { option_type: 'SELL_TO_OPEN', option_symbol: os({ expiry: '2025-09-19' }) }), r('e2', 'OPTIONASSIGNMENT', '2025-05-05', { option_symbol: os({ expiry: '2025-09-19' }) }), // short
    r('f1', 'BUY', '2025-05-01', { option_type: 'BUY_TO_OPEN', option_symbol: os({ expiry: '2025-07-18' }) }), r('f2', 'OPTIONEXERCISE', '2025-05-15', { option_symbol: os({ expiry: '2025-07-18' }) }), // exercise (+ the share close held over that day)
    r('g1', 'OPTIONEXPIRATION', '2025-05-16'), // an event with no option_symbol
    r('h1', 'BUY', '2025-06-02', { option_type: 'BUY_TO_OPEN', option_symbol: os({ right: 'PUT', expiry: '2025-07-18' }) }), r('h2', 'OPTIONEXPIRATION', '2025-07-18', { option_symbol: os({ right: 'PUT', expiry: '2025-07-18' }), amount: 250 }), // expiry with cash
    r('i1', 'BUY', '2025-06-03', { option_type: 'BUY_TO_OPEN', option_symbol: os({ expiry: '2025-08-15', root: 'XYZ1' }) }), r('i2', 'SELL', '2025-06-10', { option_type: 'SELL_TO_CLOSE', option_symbol: os({ expiry: '2025-08-15', root: 'XYZ1' }) }), // adjusted root
    r('j1', 'BUY', '2025-06-04', { option_type: 'BUY_TO_OPEN', option_symbol: os({ expiry: '2025-10-17' }) }), r('j2', 'SELL', '2025-06-11', { option_type: 'SELL_TO_CLOSE', option_symbol: os({ expiry: '2025-10-17', mini: true }) }), // multiplier mismatch
    r('k1', 'BUY', '2025-06-05', { option_type: 'BUY_TO_OPEN', option_symbol: os({ underlying: 'FUTX', type: 'fut' }) }), r('k2', 'SELL', '2025-06-12', { option_type: 'SELL_TO_CLOSE', option_symbol: os({ underlying: 'FUTX', type: 'fut' }) }), // outside the allowlist
    r('l1', 'BUY', '2025-01-06', { option_type: 'BUY_TO_OPEN', option_symbol: os({ right: 'PUT', expiry: '2025-02-21' }) }), // dangling
    r('m1', 'SELL', '2025-06-13', { option_type: 'SELL_TO_CLOSE', option_symbol: os({ right: 'PUT', expiry: '2025-11-21' }) }), // a close with no open
    r('n1', 'BUY', '2025-06-16', { option_type: 'BUY_TO_OPEN', option_symbol: os({ expiry: '2025-11-21' }), price: 2, amount: -2 }), r('n2', 'SELL', '2025-06-17', { option_type: 'SELL_TO_CLOSE', option_symbol: os({ expiry: '2025-11-21' }), price: 3, amount: 3 }), // cash scale
    r('o1', 'BUY', '2025-06-18', { option_type: 'BUY_TO_OPEN', option_symbol: os({ right: 'PUT', expiry: '2025-12-19', underlying: 'QRS' }) }), r('o2', 'SELL', '2025-06-19', { option_type: 'SELL_TO_CLOSE', option_symbol: os({ right: 'PUT', expiry: '2025-12-19', underlying: 'QRS' }), units: 3 }), // flip
    r('p1', 'BUY', '2025-06-20', { option_type: 'BUY_TO_OPEN', option_symbol: os({ expiry: '2025-12-12' }) }), r('p2', 'SELL', '2025-06-23', { option_type: 'SELL_TO_CLOSE', option_symbol: os({ expiry: '2025-12-12' }), currency: { code: 'CAD' } }), // currency
    r('q1', 'BUY', '2025-06-24', { option_type: 'BUY_TO_OPEN', option_symbol: os({ expiry: '2025-12-05' }) }), r('q2', 'SELL', '2025-06-25', { option_type: 'SELL_TO_CLOSE', option_symbol: os({ expiry: '2025-12-05' }), price: undefined }), // malformed
  ];
}
const optionInstrument = (right: 'CALL' | 'PUT', units: string, price: string, cost: string) => ({
  instrument: { kind: 'option', id: `oi-${right}`, symbol: `XYZ   271217${right[0]}00123450`, option_type: right, strike_price: '123.45', expiration_date: '2027-12-17', multiplier: '100',
    underlying: { kind: 'stock', id: 'xyz', symbol: 'XYZ', raw_symbol: 'XYZ' } }, units, price, cost_basis: cost,
});

const step = async (req: APIRequestContext): Promise<{ state: string }> => {
  for (let i = 0; ; i++) {
    const r = await req.post('/api/import/step');
    if (r.status() !== 429 || i >= 20) return r.json();
    await new Promise((done) => setTimeout(done, 1_000 * Number(r.headers()['retry-after'] ?? 1) + 50));
  }
};

test('E12: through the vendor fake, every D4 case is imported, matched and counted; the profile shows the label, the count line and the futures count, and no term', async ({ page }) => {
  let vendor: { server: Server; base: string };
  try { vendor = await startVendorFake(VENDOR_PORT); } catch { test.skip(true, `port ${VENDOR_PORT} is in use (run this spec with --workers=1 beside connect.spec.ts)`); return; }
  const handle = `opt${Math.random().toString(36).slice(2, 8)}`;
  const acc = `e2e-${handle}`;
  try {
    await page.context().route('**/api/import/step', (r) => r.abort()); // the test drives the steps
    await page.goto('/login/dev');
    await page.getByLabel('Handle').fill(handle);
    await page.getByLabel('I am 18 or older').check();
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page).toHaveURL(new RegExp(`/u/${handle}$`));
    const start = await page.request.get('/connect/start', { maxRedirects: 0 });
    test.skip(!(start.headers()['location'] ?? '').startsWith(vendor.base), 'the server has no vendor fake configured (see e2e/connect.spec.ts)');
    const shares = [
      { id: `${acc}-s1`, symbol: 'ABC', type: 'BUY' as const, units: 10, price: 20, fee: 0, trade_date: '2025-02-03T15:00:00Z' },
      { id: `${acc}-s2`, symbol: 'ABC', type: 'SELL' as const, units: 10, price: 22, fee: 0, trade_date: '2025-02-10T15:00:00Z' },
      // Delivered by the exercise on 2025-05-15, sold later: removed and counted (D4 c).
      { id: `${acc}-s3`, symbol: 'XYZ', type: 'BUY' as const, units: 100, price: 123.45, fee: 0, trade_date: '2025-05-15T20:00:00Z' },
      { id: `${acc}-s4`, symbol: 'XYZ', type: 'SELL' as const, units: 100, price: 130, fee: 0, trade_date: '2025-05-20T15:00:00Z' },
    ];
    await fetch(`${vendor.base}/_scenario`, { method: 'POST', body: JSON.stringify({ accounts: [{ id: acc, activities: shares, optionActivities: d4Rows(acc),
      positions: [{ symbol: 'QQQ', units: 10, price: 11, cost_basis: 10 }],
      instruments: [optionInstrument('CALL', '2', '1.80', '1.20'), optionInstrument('PUT', '-1', '2', '3'),
        { instrument: { kind: 'future', id: 'f', symbol: 'FUTZ7' }, units: '1', price: '1', cost_basis: '1' },
        { instrument: { kind: 'future_option', id: 'fo', symbol: 'FUTZ7 C100' }, units: '1', price: '1', cost_basis: '1' }] }] }) });
    await page.goto('/connect');
    await page.getByRole('link', { name: 'Connect brokerage (read-only)' }).click();
    await page.frameLocator('dialog.portal iframe').getByRole('button', { name: 'Connect' }).click();
    await expect(page).toHaveURL(/\/connect\/consent\?c=\d+$/);
    await page.getByRole('button', { name: 'Import my record' }).click();
    await expect(page).toHaveURL(new RegExp(`/u/${handle}$`));
    let r = await step(page.request);
    for (let i = 0; i < 8 && r.state === 'importing'; i++) r = await step(page.request);
    expect(r.state).toBe('connected');
    const [u] = await sql`select id, excluded_options_short, excluded_options_other, open_options_short, open_unsupported from users where handle = ${handle}`;
    expect((await sql`select count(*)::int as n from option_activities where user_id = ${u.id}`)[0].n).toBe(d4Rows(acc).length);
    const shown = (await sql`select close_id, round(return_pct::numeric, 4)::float8 as r from option_trades where user_id = ${u.id} order by close_id`).map((x) => [x.close_id, x.r]);
    // a: (2 × 250 ... ) per contract: (250 - 0.65 - 150.65) / 150.65; b: (90 - 0.65 - 150.65) / 150.65; c: -150 / 150 = -1.
    expect(shown).toEqual([[`${acc}-a2`, Number(((250 - 0.65 - 150.65) / 150.65).toFixed(4))], [`${acc}-b2`, Number(((90 - 0.65 - 150.65) / 150.65).toFixed(4))], [`${acc}-c2`, Number((-150.65 / 150.65).toFixed(4))]]);
    expect(u.excluded_options_short).toBe(2);
    // Other (option rows only): exercise, the event with no contract, expiry with cash, adjusted root, the mini sell with
    // no mini open and the standard open left dangling (two ledgers, fix round 1), outside the allowlist, dangling, no
    // open, cash scale, flip, currency, malformed. The share close held over the exercise day has its own counter.
    expect(u.excluded_options_other).toBe(13);
    expect((await sql`select excluded_exercise_shares as n from users where id = ${u.id}`)[0].n).toBe(1);
    expect([u.open_options_short, u.open_unsupported]).toEqual([1, 2]);
    expect((await sql`select symbol from open_positions where user_id = ${u.id}`).map((x) => x.symbol)).toEqual(['QQQ']); // no contract symbol
    expect((await sql`select sell_id from closed_trades where user_id = ${u.id}`).map((x) => x.sell_id)).toEqual([`${acc}-s2`]);
    // Signed out: the label, the count line and the futures count; nothing else about options.
    await page.context().clearCookies();
    await page.goto(`/u/${handle}`);
    await expect(page.locator('.share-label')).toHaveText('Share trades');
    await expect(page.locator('.options-gated')).toHaveText(OPTIONS.gated(3 + 2 + 13, 2));
    await expect(page.locator('.options-unsupported')).toHaveText('Plus 2 open positions not shown: futures and similar contracts are out of scope.');
    await expect(page.locator('.options-exercise-shares')).toHaveText(OPTIONS.exerciseShares(1));
    const html = await page.content();
    for (const bad of ['Call option', 'Put option', '123.45', 'FUTZ7']) expect(html).not.toContain(bad);
    expect(html).not.toMatch(OCC);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  } finally {
    await sql`delete from users where handle = ${handle}`;
    await sql`delete from broker_accounts where account_id = ${acc}`;
    vendor!.server.close();
  }
});

// ---- Fix round 1 (QA 1): the element trees the option components return (what a server component serializes into the
// page payload: every key and prop) carry no strike, contract symbol, contract key or multiplier. (The react-server
// flight renderer can't load the app's TSX components outside Next's bundler, so the trees are walked directly.)
test('fix round 1 B: the rendered element trees\' keys and props carry no strike or contract key', () => {
  const STRIKE = /123\.45|123450|\|100\b|\|10\b|[A-Z]{1,6}\s*\d{6}[CP]\d{8}/;
  const seen: string[] = [];
  const walk = (n: unknown): void => {
    if (Array.isArray(n)) { n.forEach(walk); return; }
    if (!n || typeof n !== 'object') { if (n !== null && n !== undefined && n !== false) seen.push(String(n)); return; }
    const el = n as { key?: unknown; type?: unknown; props?: Record<string, unknown> };
    if (el.key !== null && el.key !== undefined) seen.push(`key=${String(el.key)}`);
    const props = el.props ?? {};
    for (const [k, v] of Object.entries(props)) if (k !== 'children') seen.push(`${k}=${typeof v === 'object' ? JSON.stringify(v) : String(v)}`);
    if (typeof el.type === 'function') walk((el.type as (p: unknown) => unknown)(props));
    else walk(props.children);
  };
  walk(h(OptionTradesSection, { trades: trades.map((t) => ({ ...t, underlying: 'XYZ' })), handle: 'opt_open' }));
  walk(h(OpenOptionRows, { open: [{ underlying: 'XYZ', right: 'CALL' as const, expiry: '2026-12-11', pct: 0.1 }, { underlying: 'XYZ', right: 'CALL' as const, expiry: '2026-12-11', pct: 0.2 }] }));
  walk(h(OptionsLines, { m: openModel }));
  expect(seen.some((s) => s.startsWith('key='))).toBe(true);
  for (const s of seen) expect(s).not.toMatch(STRIKE);
  expect(seen).toContain('key=XYZ|2026-12-11|CALL|1'); // two rows of one contract stay apart without the strike
});

// ---- 3. Surfaces when open: static markup of the pure components with the app's stylesheet.
const counts = (o: Partial<OptionCounts> = {}): OptionCounts => ({ shown: 0, short: 0, other: 0, openLong: 0, openShort: 0, openOther: 0, unsupported: 0, exerciseShares: 0, ...o });
const DAY = 86_400_000;
const worst = { id: '1', underlying: 'ABCDE', right: 'PUT' as const, expiry: '2026-12-19', openedAt: new Date('2026-09-01'), closedAt: new Date('2026-10-03T15:00:00Z'), returnPct: -1, holdingDays: 32, verified: true };
const trades = [worst, ...Array.from({ length: 13 }, (_, i) => ({ ...worst, id: String(i + 2), underlying: ['XYZ', 'QRS', 'LMNOP'][i % 3], right: (i % 2 ? 'CALL' : 'PUT') as 'CALL' | 'PUT', returnPct: [-0.5, 0.31, -0.12, 0.08][i % 4], closedAt: new Date(Date.parse('2026-10-03') - i * DAY) }))];
const summary = { n: 14, winRate: 5 / 14, avg: -0.22, range: { low: -0.41, high: -0.03 }, bets: 9 };
const openModel: OptionHeadline = { gate: 'open', counts: counts({ shown: 14, short: 3, other: 2, openLong: 1, openShort: 2, unsupported: 2 }), summary };
const openRows = [{ key: 'k', underlying: 'ABCDE', right: 'PUT' as const, expiry: '2026-12-19', pct: -0.999 }];

async function mount(page: Page, nodes: ReactElement[], scheme: 'light' | 'dark') {
  await page.emulateMedia({ colorScheme: scheme });
  const markup = renderToStaticMarkup(h('main', { className: 'page' }, ...nodes));
  await page.setContent(`<!doctype html><html><head><meta name="viewport" content="width=device-width"><style>${css}</style></head><body>${markup}</body></html>`);
  return markup;
}
const noHScroll = async (page: Page) => expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);

for (const scheme of ['light', 'dark'] as const) {
  test(`AC18 (${scheme}): the worst row (5-character underlying, "Put option", -100.0%) fits one line with 15% headroom; 44 px targets; accessible names; the options line in ≤ 2 lines`, async ({ page }) => {
    await mount(page, [h(ShareTradesLabel, { counts: openModel.counts }), h(OptionsLines, { m: openModel }), h(OptionTradesSection, { trades, handle: 'opt_open' })], scheme);
    await noHScroll(page);
    const rows = page.locator('.rows.options li');
    await expect(rows).toHaveCount(14);
    await expect(rows.first()).toHaveAttribute('aria-label', 'ABCDE put option, exp Dec 19, 2026, -100.0%');
    await expect(rows.first().locator('.line')).toContainText('ABCDE');
    await expect(rows.first().locator('.chip')).toHaveText('Put option');
    await expect(rows.first().locator('.line b').last()).toHaveText('-100.0%');
    await expect(rows.first().locator('.option-meta')).toHaveText('closed Oct 3, 2026 · exp Dec 19, 2026');
    for (const li of await rows.all()) {
      const fit = await li.locator('.line').evaluate((el) => {
        const kids = [...el.children] as HTMLElement[];
        const used = kids.reduce((a, k) => a + k.scrollWidth, 0) + 8;
        const lineH = parseFloat(getComputedStyle(kids[0]).lineHeight) || 24;
        return { used, width: el.clientWidth, height: Math.max(...kids.map((k) => k.getBoundingClientRect().height)), lineH };
      });
      expect(fit.used, 'one line with 15% headroom').toBeLessThanOrEqual(fit.width * 0.85);
      expect(fit.height).toBeLessThan(fit.lineH * 2 + 1);
      const box = (await li.locator('a').first().boundingBox())!;
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.width).toBeGreaterThanOrEqual(44);
    }
    const ol = page.locator('.options-line');
    await expect(ol).toHaveText('Options: 14 trades · 36% wins · -22.0% avg (-41.0% to -3.0%)');
    const lines = await ol.evaluate((el) => el.getBoundingClientRect().height / (parseFloat(getComputedStyle(el).lineHeight) || 1));
    expect(lines).toBeLessThanOrEqual(2 * 0.85 + 0.5); // at most 2 lines (with room)
    expect(await ol.locator('b').getAttribute('class')).toBe('down');
    // Existing tokens only: every color used by the new rules is a var() of the stylesheet's own tokens.
    const optionsCss = css.slice(css.indexOf('/* OPTIONS'));
    expect(optionsCss).not.toMatch(/#[0-9a-f]{3,6}\b|rgb\(|hsl\(/i);
  });

  test(`AC19/20 (${scheme}): the short line stands alone; one expiry format; the open block shows a long option with its chip, the short count and the futures count; no countdown words`, async ({ page }) => {
    const markup = await mount(page, [h(OptionsLines, { m: openModel }), h(UnsupportedLine, { counts: openModel.counts }), h(OpenOptionRows, { open: openRows })], scheme);
    await noHScroll(page);
    const short = page.locator('.options-short');
    await expect(short).toHaveText(OPTIONS.short(3, 2));
    expect(await short.evaluate((el) => getComputedStyle(el).display)).toBe('block');
    expect(await short.evaluate((el) => el.previousElementSibling?.className)).toBe('options-line');
    await expect(page.locator('.options-technical')).toHaveText(OPTIONS.technical(2));
    await expect(page.locator('.options-unsupported')).toHaveText('Plus 2 open positions not shown: futures and similar contracts are out of scope.');
    const open = page.locator('.rows.options-open li');
    await expect(open).toHaveAttribute('aria-label', 'ABCDE put option, exp Dec 19, 2026, -99.9% unrealized');
    await expect(open.locator('.chip')).toHaveText('Put option');
    expect((await open.locator('a').boundingBox())!.height).toBeGreaterThanOrEqual(44);
    for (const m of markup.matchAll(/exp [A-Z][a-z]{2} \d{1,2}, \d{4}/g)) expect(m[0]).toBe('exp Dec 19, 2026');
    expect(markup).not.toMatch(/expiring|days left|expires in|soon|countdown/i);
    expect(markup).not.toMatch(/123\.45|premium|strike|\$/i);
  });

  test(`AC16/AC24 (${scheme}): the closed-gate render is the count line only; the pane part is the label and the line (or the options line once open)`, async ({ page }) => {
    const closed: OptionHeadline = { gate: 'closed', counts: counts({ shown: 3, short: 1, openLong: 1 }) };
    const markup = await mount(page, [h(ShareTradesLabel, { counts: closed.counts }), h(OptionsLines, { m: closed }), h('section', { className: 'pane' }, h(PaneOptions, { v: paneView(closed) }))], scheme);
    await noHScroll(page);
    await expect(page.locator('.share-label')).toHaveText('Share trades');
    await expect(page.locator('.options-gated')).toHaveText([OPTIONS.gated(4, 1), OPTIONS.gated(4, 1)]);
    expect(markup).not.toMatch(/Call option|Put option|exp |%|Options:/);
    await mount(page, [h('section', { className: 'pane' }, h(ShareTradesLabel, { counts: openModel.counts }), h(PaneOptions, { v: paneView(openModel) }))], scheme);
    await expect(page.locator('.pane .options-line')).toHaveText('Options: 14 trades · 36% wins · -22.0% avg (-41.0% to -3.0%)');
    // Zero: nothing renders.
    expect(renderToStaticMarkup(h('div', null, h(ShareTradesLabel, { counts: counts() }), h(OptionsLines, { m: { gate: 'closed', counts: counts() } }), h(PaneOptions, { v: paneView({ gate: 'closed', counts: counts() }) })))).toBe('<div></div>');
  });
}
