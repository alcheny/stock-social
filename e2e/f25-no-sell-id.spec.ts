// F-25 · no vendor activity id leaves the server (docs/features/F-25-one-link-rule-for-trade-rows.md: "No rendered href,
// `data-*` attribute, form field, client prop, RSC payload or JSON response carries a `sell_id`"). A fixture trader whose
// sell ids all carry a unique marker string; the marker must appear in none of: the HTML and the RSC payload (`RSC: 1`)
// of the feed, profile, month, stock and trade pages and /me/record (signed in as that trader); the feed's paging (the
// no-JS `?after=` pages and the in-page action that appends the next page); the /pane and /pane-chart JSON; the trade
// page's metadata. Each scan also checks the trader's trade_key is there, so the scan saw the trader's rows.
// The trader is this file's own (random generic handle, fictional symbol), removed after; the feed lock is held shared.
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import postgres from 'postgres';
import { feedLock } from './feed-lock.ts';
import { handleOf, makeTrader, marker, removeHandles, symbolOf, type Made } from './f25-fixture.ts';

const sql = postgres(process.env.DATABASE_URL!, { max: 2, onnotice: () => {} });
const MARK = marker();
const S = symbolOf();
let A: Made;
let ym = '';
let release: () => Promise<void> = async () => {};

test.beforeAll(async () => {
  release = await feedLock('shared');
  A = await makeTrader(sql, { handle: handleOf('f25m'), verified: true, mark: MARK, closes: [
    { symbol: S, r: 0.141, hoursAgo: 0.1, thesis: 'Sold after the plan hit its exit level.' }, { symbol: S, r: -0.062, hoursAgo: 0.2 },
    { symbol: S, r: 0.0001, hoursAgo: 0.3 }, { symbol: S, r: -0.024, hoursAgo: 0.4 }, { symbol: S, r: 0.055, hoursAgo: 0.5 },
    { symbol: S, r: 0.012, hoursAgo: 0.6 },
  ] });
  ym = (await sql`select to_char(closed_at at time zone 'UTC', 'YYYY-MM') ym from closed_trades where user_id = ${A.id} order by closed_at desc limit 1`)[0].ym;
  expect(A.trades.every((t) => t.sell.includes(MARK))).toBe(true);
});
test.afterAll(async () => {
  if (A) await removeHandles(sql, [A.handle]);
  await release();
  await sql.end({ timeout: 1 });
});

const pages = () => ({
  feed: '/',
  profile: `/u/${A.handle}`,
  month: `/u/${A.handle}/month/${ym}`,
  stock: `/t/${S}`,
  trade: `/u/${A.handle}/trade/${A.trades[0].key}`,
  'trade (loss)': `/u/${A.handle}/trade/${A.trades[1].key}`,
});
const anyKey = (body: string) => A.trades.some((t) => body.includes(t.key));
async function scan(req: APIRequestContext, what: string, path: string, headers: Record<string, string> = {}) {
  let res = await req.get(path, { headers, maxRedirects: 0 });
  // An RSC request first answers 307 to the same path with the framework's `_rsc` cache key; follow that one hop only.
  const loc = res.headers()['location'];
  if (headers.RSC && res.status() === 307 && loc && new URL(loc, 'http://x').pathname === new URL(path, 'http://x').pathname && loc.includes('_rsc')) {
    res = await req.get(loc, { headers, maxRedirects: 0 });
    expect(res.headers()['content-type'], `${what}: an RSC payload`).toContain('text/x-component');
  }
  expect(res.status(), `${what} ${path}`).toBe(200);
  const body = await res.text();
  expect(body.includes(MARK), `${what}: no sell id in ${path}`).toBe(false);
  return body;
}

test('signed out: HTML and RSC payload of the feed, profile, month, stock and trade pages carry no sell id', async ({ request }) => {
  for (const [what, path] of Object.entries(pages())) {
    const html = await scan(request, `${what} HTML`, path);
    const rsc = await scan(request, `${what} RSC`, path, { RSC: '1' });
    if (what !== 'feed') {
      expect(anyKey(html), `${what}: the scan saw the trader's rows`).toBe(true);
      expect(anyKey(rsc), `${what} RSC: the scan saw the trader's rows`).toBe(true);
    }
  }
});

test('trade page metadata (title, canonical, og image, alt) uses the trade_key, never the sell id', async ({ request }) => {
  for (const t of A.trades) {
    const html = await scan(request, 'trade', `/u/${A.handle}/trade/${t.key}`);
    const head = html.slice(0, html.indexOf('</head>'));
    expect(head).toContain(`/u/${A.handle}/trade/${t.key}/opengraph-image`);
    expect(head).toMatch(new RegExp(`<link rel="canonical" href="[^"]*/u/${A.handle}/trade/${t.key}"`));
    expect(head.includes(MARK)).toBe(false);
  }
});

test('/u/<handle>/pane and /pane-chart JSON carry no sell id; the pane carries at most 5 trade keys', async ({ request }) => {
  const pane = await scan(request, 'pane', `/u/${A.handle}/pane`);
  const keys = A.trades.filter((t) => pane.includes(t.key)).length;
  expect(keys).toBeGreaterThan(0);
  expect(keys).toBeLessThanOrEqual(5);
  await scan(request, 'pane-chart', `/u/${A.handle}/pane-chart`);
});

test('feed paging: the no-JS ?after= pages and the in-page next-page action carry no sell id', async ({ request, page }) => {
  test.setTimeout(180_000);
  // Enough feed-eligible traders of this file's own for a second page, every sell id with the marker too.
  const filler: Made[] = [];
  try {
  for (let h = 0; h < 36; h++) filler.push(await makeTrader(sql, { handle: handleOf('f25p'), verified: false, mark: MARK,
    closes: Array.from({ length: 5 }, (_, i) => ({ symbol: symbolOf(), r: (i + h) % 3 ? 0.2 + ((h + i) % 7) / 50 : -0.15 - ((h + i) % 5) / 50, hoursAgo: 0.05 * (i + 1) + h * 0.01 })) }));
  // The no-JS chain, page after page, while there is a next page (bounded).
  let url = '/', seenTrader = false;
  for (let i = 0; i < 12 && url; i++) {
    const html = await scan(request, `feed page ${i + 1}`, url);
    const rsc = await scan(request, `feed page ${i + 1} RSC`, url, { RSC: '1' });
    seenTrader ||= anyKey(html) || anyKey(rsc);
    const next = /href="\/\?after=([A-Za-z0-9_-]+)"/.exec(html)?.[1];
    url = next ? `/?after=${next}` : '';
  }
  expect(seenTrader, 'the trader is on one of the feed pages scanned').toBe(true);
  // The in-page action: scroll toward the end of page 1 so the next 30 cards are fetched and appended.
  const bodies: string[] = [];
  page.on('response', async (r) => {
    if (r.request().method() === 'POST' && r.request().headers()['next-action']) bodies.push(await r.text().catch(() => ''));
  });
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto('/');
  const rows = page.locator('.feed > .row[data-trade]');
  await expect(rows.first()).toBeVisible();
  const first = await rows.count();
  await expect(page.locator('.feed .feed-more a[href^="/?after="]')).toBeAttached();
  await expect.poll(async () => {
    await rows.last().scrollIntoViewIfNeeded();
    return rows.count();
  }, { timeout: 30_000 }).toBeGreaterThan(first);
  await expect.poll(() => bodies.length).toBeGreaterThan(0);
  for (const b of bodies) expect(b.includes(MARK), 'no sell id in the next-page action response').toBe(false);
  expect(bodies.some((b) => /[0-9a-f]{64}/.test(b)), 'the action response holds trade rows').toBe(true);
  expect(await page.content()).not.toContain(MARK);
  } finally {
    await removeHandles(sql, filler.map((m) => m.handle));
  }
});

test('signed in as the trader: feed, profile, month, stock, trade and /me/record HTML and RSC carry no sell id; the form posts tradeKey', async ({ page }) => {
  await signIn(page, A.handle);
  const req = page.request; // carries the session cookie
  for (const [what, path] of Object.entries({ ...pages(), record: '/me/record' })) {
    const html = await scan(req, `${what} HTML (signed in)`, path);
    await scan(req, `${what} RSC (signed in)`, path, { RSC: '1' });
    if (what === 'record') {
      expect(anyKey(html), '/me/record: the forms carry the trade keys').toBe(true);
      expect(html).not.toContain('name="sellId"');
    }
  }
  // The rendered DOM after hydration (attributes set on the client included).
  for (const path of [`/u/${A.handle}`, '/me/record', `/u/${A.handle}/trade/${A.trades[0].key}`]) {
    await page.goto(path);
    expect(await page.content(), path).not.toContain(MARK);
  }
});

async function signIn(page: Page, h: string) {
  await page.goto('/login/dev');
  await page.getByLabel('Handle').fill(h);
  await page.getByLabel('I am 18 or older').check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(new RegExp(`/u/${h}$`));
}
