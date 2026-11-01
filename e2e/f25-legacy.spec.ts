// F-25 · old trade links (docs/features/F-25-one-link-rule-for-trade-rows.md, "Trade URLs move from the vendor id to the
// stored key"): `/u/<handle>/trade/<sell_id>` and its image answer 308 to the trade_key form (query string kept), and the
// landed page and image work; an unknown segment, another handle's sell id, a hidden or removed public filer's and a
// deleted user's sell id answer 404 with no redirect; no meta refresh; the landed page's view beacon records via=trade.
// Fixture traders and filers are this file's own (random generic handles, fictional symbols), removed after; the feed
// lock is held shared while they exist.
import { expect, test } from '@playwright/test';
import postgres from 'postgres';
import { feedLock } from './feed-lock.ts';
import { watch } from './f15-watch.ts';
import { deleteFilers, ensureImportState, insertFiler } from './f7-fixture.ts';
import { handleOf, makeTrader, marker, removeHandles, symbolOf, type Made } from './f25-fixture.ts';

const sql = postgres(process.env.DATABASE_URL!, { max: 2, onnotice: () => {} });
const MARK = marker();
const S = symbolOf();
let A: Made, B: Made, GONE: Made;
const HID = handleOf('pf_f25h'), REM = handleOf('pf_f25r');
let release: () => Promise<void> = async () => {};

test.beforeAll(async () => {
  release = await feedLock('shared');
  A = await makeTrader(sql, { handle: handleOf('f25la'), verified: true, mark: MARK, closes: [{ symbol: S, r: -0.052, hoursAgo: 0.2 }, { symbol: S, r: 0.031, hoursAgo: 0.4 }] });
  B = await makeTrader(sql, { handle: handleOf('f25lb'), verified: false, mark: MARK, closes: [{ symbol: S, r: 0.044, hoursAgo: 0.3 }] });
  GONE = await makeTrader(sql, { handle: handleOf('f25lg'), verified: false, mark: MARK, closes: [{ symbol: S, r: 0.011, hoursAgo: 0.5 }] });
  await sql`update users set deleted_at = now() where id = ${GONE.id}`;
  await ensureImportState(sql);
  await insertFiler(sql, { handle: HID, name: 'Fictional Filer Hidden', hidden: true, closes: [{ symbol: S, r: 0.02, daysAgo: 3 }] });
  const rem = await insertFiler(sql, { handle: REM, name: 'Fictional Filer Removed', closes: [{ symbol: S, r: 0.02, daysAgo: 3 }] });
  await sql`update public_filers set removed_at = now() where id = ${rem.filerId}`;
});
test.afterAll(async () => {
  await removeHandles(sql, [A, B, GONE].filter(Boolean).map((m) => m.handle));
  await deleteFilers(sql, [HID, REM]);
  await release();
  await sql.end({ timeout: 1 });
});

const keyed = (m: Made, i = 0) => `/u/${m.handle}/trade/${m.trades[i].key}`;
const legacy = (m: Made, i = 0) => `/u/${m.handle}/trade/${encodeURIComponent(m.trades[i].sell)}`;

test('an old sell-id page and image answer 308 to the trade_key form; following them, the page is 200 and the image a PNG', async ({ request }) => {
  const page = await request.get(legacy(A), { maxRedirects: 0 });
  expect(page.status()).toBe(308);
  expect(page.headers()['location']).toBe(keyed(A));
  expect(await page.text()).not.toMatch(/http-equiv=["']?refresh/i);
  const img = await request.get(`${legacy(A)}/opengraph-image`, { maxRedirects: 0 });
  expect(img.status()).toBe(308);
  expect(img.headers()['location']).toBe(`${keyed(A)}/opengraph-image`);
  expect(await img.text()).not.toMatch(/http-equiv=["']?refresh/i);
  const landed = await request.get(page.headers()['location'], { maxRedirects: 0 });
  expect(landed.status()).toBe(200);
  expect(await landed.text()).not.toMatch(/http-equiv=["']?refresh/i);
  const pic = await request.get(img.headers()['location'], { maxRedirects: 0 });
  expect(pic.status()).toBe(200);
  expect(pic.headers()['content-type']).toContain('image/png');
  expect((await pic.body()).subarray(1, 4).toString('latin1')).toBe('PNG');
  // Followed in one go, as a browser or an unfurler does.
  expect((await request.get(legacy(A, 1))).status()).toBe(200);
  expect((await request.get(`${legacy(A, 1)}/opengraph-image`)).headers()['content-type']).toContain('image/png');
});

test('?via=trade survives the 308, and the landed page\'s beacon records via=trade', async ({ request, browser }) => {
  const res = await request.get(`${legacy(A)}?via=trade`, { maxRedirects: 0 });
  expect(res.status()).toBe(308);
  expect(res.headers()['location']).toBe(`${keyed(A)}?via=trade`);
  // The beacon in a browser that does not report automation (as a person's would; e2e/f15-beacon-human.spec.ts).
  const ctx = await browser.newContext({ userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36' });
  await ctx.addInitScript(() => Object.defineProperty(Navigator.prototype, 'webdriver', { configurable: true, get: () => false }));
  const page = await ctx.newPage();
  const counted = async () => Number((await sql`select coalesce(sum(n), 0)::int n from view_rollup where user_id = ${A.id} and day = current_date and surface = 'trade' and via = 'trade'`)[0].n);
  const before = await counted();
  const seen = watch(page);
  const landed = await page.goto(`${legacy(A)}?via=trade`);
  expect(landed?.status()).toBe(200);
  expect(new URL(page.url()).pathname + new URL(page.url()).search).toBe(`${keyed(A)}?via=trade`);
  await expect.poll(() => seen.length, { timeout: 8_000 }).toBe(1);
  expect(seen[0].body).toMatchObject({ path: keyed(A), via: 'trade' });
  expect((await seen[0].req.response())?.status()).toBe(204);
  await expect.poll(counted).toBe(before + 1);
  await ctx.close();
});

test('404 with no redirect: an unknown segment, another handle\'s sell id, a hidden or removed filer\'s, a deleted user\'s', async ({ request }) => {
  const [hid] = await sql`select ct.sell_id s, ct.trade_key k from closed_trades ct join users u on u.id = ct.user_id where u.handle = ${HID}`;
  const [rem] = await sql`select ct.sell_id s, ct.trade_key k from closed_trades ct join users u on u.id = ct.user_id where u.handle = ${REM}`;
  const cases: [string, string][] = [
    ['unknown segment', `/u/${A.handle}/trade/${MARK}-no-such-sell`],
    ['unknown key-shaped segment', `/u/${A.handle}/trade/${'0'.repeat(64)}`],
    ['another handle\'s sell id', `/u/${A.handle}/trade/${encodeURIComponent(B.trades[0].sell)}`],
    ['another handle\'s trade key', `/u/${A.handle}/trade/${B.trades[0].key}`],
    ['hidden filer\'s sell id', `/u/${HID}/trade/${encodeURIComponent(hid.s)}`],
    ['hidden filer\'s key', `/u/${HID}/trade/${hid.k}`],
    ['removed filer\'s sell id', `/u/${REM}/trade/${encodeURIComponent(rem.s)}`],
    ['removed filer\'s key', `/u/${REM}/trade/${rem.k}`],
    ['deleted user\'s sell id', legacy(GONE)],
    ['deleted user\'s key', keyed(GONE)],
  ];
  for (const [what, path] of cases) {
    for (const p of [path, `${path}/opengraph-image`]) {
      const res = await request.get(p, { maxRedirects: 0 });
      expect(res.status(), `${what}: ${p}`).toBe(404);
      expect(res.headers()['location'], `${what}: no redirect`).toBeUndefined();
      expect(await res.text(), `${what}: no meta refresh`).not.toMatch(/http-equiv=["']?refresh/i);
    }
  }
});
