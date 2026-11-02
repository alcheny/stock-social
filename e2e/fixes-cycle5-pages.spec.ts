// FIXES-CYCLE5 WP4 pages: F5-10 (month picks titled by sign; no picks for a two-trade month), F5-12 (the chart
// subline's date stays on one line at 320 px), F5-19 (no X-Powered-By header). The fixture trader is seeded by SQL with
// its own handle (as e2e/f24-excluded-held.spec.ts), deleted before and after; its closes are months old, so it is not
// in the feed's recent windows, and it holds the shared feed lock while it exists.
import { expect, test } from '@playwright/test';
import postgres from 'postgres';
import { FC5 } from '../lib/copy.ts';
import { feedLock } from './feed-lock.ts';

const HANDLE = 'fc5d_pages';
const SYM = 'ZZQX';
const sql = postgres(process.env.DATABASE_URL!, { max: 2, onnotice: () => {} });
let release: () => Promise<void>;

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  release = await feedLock('shared');
  await sql`delete from users where handle = ${HANDLE}`;
  const [u] = await sql`
    with a as (insert into signup_attempts (method, adult_attested_at) values ('dev', now()) returning id)
    insert into users (handle, display_name, adult_attested_at, signup_attempt_id) select ${HANDLE}, 'FC5 Pages', now(), a.id from a returning id, signup_attempt_id`;
  await sql`insert into connections (attempt_id, user_id, state, consent_at, importing_at, connected_at, last_progress_at)
    values (${u.signup_attempt_id}, ${u.id}, 'connected', '2026-05-01', '2026-05-01', '2026-05-01', now())`;
  // August 2026: three closes, all gains. July 2026: two closes. June 2026: one close. The last close is Aug 28.
  const closes: [string, number][] = [
    ['2026-06-10T15:00:00Z', 0.02],
    ['2026-07-08T15:00:00Z', 0.03], ['2026-07-20T15:00:00Z', -0.01],
    ['2026-08-05T15:00:00Z', 0.05], ['2026-08-14T15:00:00Z', 0.01], ['2026-08-28T15:00:00Z', 0.02],
  ];
  await sql`insert into closed_trades ${sql(closes.map(([at, r], i) => ({
    user_id: u.id, sell_id: `${HANDLE}-s${i}`, account_id: `${HANDLE}-a`, symbol: SYM, opened_at: new Date(Date.parse(at) - 5 * 86_400_000), closed_at: new Date(at),
    return_pct: r, holding_days: 5, verified: true,
  })))}`;
});

test.afterAll(async () => {
  await sql`delete from users where handle = ${HANDLE}`;
  await release?.();
  await sql.end({ timeout: 1 });
});

test('F5-10: an all-gain month shows "Best trade" and "Lowest return", never "Worst trade"', async ({ page }) => {
  await page.goto(`/u/${HANDLE}/month/2026-08`);
  const h2 = await page.locator('main h2').allInnerTexts();
  expect(h2).toContain('Best trade');
  expect(h2).toContain(FC5.lowest);
  expect(await page.locator('main').innerText()).not.toContain('Worst trade');
  await expect(page.getByRole('region', { name: FC5.lowest })).toContainText('+1.0%');
});

test('F5-10: a two-trade month shows no picks (the list holds both); a one-trade month shows it once', async ({ page }) => {
  await page.goto(`/u/${HANDLE}/month/2026-07`);
  const h2 = await page.locator('main h2').allInnerTexts();
  for (const t of ['Best trade', 'Worst trade', FC5.highest, FC5.lowest, 'Only trade this month']) expect(h2).not.toContain(t);
  await expect(page.locator('main ol li')).toHaveCount(2);
  await page.goto(`/u/${HANDLE}/month/2026-06`);
  expect((await page.locator('main h2').allInnerTexts()).filter((t) => t === 'Only trade this month')).toHaveLength(1);
});

test('F5-12: at 320 px the chart subline date "Aug 28" is one client rect (it never wraps inside itself)', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto(`/u/${HANDLE}`);
  const head = page.locator('figure.chart .chart-head');
  await expect(head).toContainText('last close Aug');
  const rects = await head.evaluate((el) => {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const i = n.textContent!.indexOf('Aug 28');
      if (i < 0) continue;
      const r = document.createRange();
      r.setStart(n, i);
      r.setEnd(n, i + 6);
      return r.getClientRects().length;
    }
    return -1;
  });
  expect(rects).toBe(1);
});

test('F5-19: no X-Powered-By on the feed, a demo profile, a stock page, an image route or /api/sync (401)', async ({ request }) => {
  for (const [path, status] of [['/', 200], ['/u/momentum_maya', 200], [`/t/${SYM}`, 200], ['/u/momentum_maya/opengraph-image', 200]] as const) {
    const r = await request.get(path);
    expect(r.status(), path).toBe(status);
    expect(r.headers()['x-powered-by'], path).toBeUndefined();
  }
  const s = await request.post('/api/sync');
  expect(s.status()).toBe(401);
  expect(s.headers()['x-powered-by']).toBeUndefined();
});
