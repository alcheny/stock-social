// F-24 AC7 (docs/features/F-24-late-sell-reconciliation.md, plan docs/features/logs/F-24/plan.md §5, §6) against the
// running app at 360 px: a close the reconciliation pass found shows on the signed-out profile and its trade page like any
// close. No "late", "corrected" or "new" wording on its row or trade section, its thesis attached, no horizontal scroll.
//
// Seeding: the pass itself (syncUser with cadence, a due pass, the vendor's paged read) is exercised in
// lib/sync-reconcile.copy.test.ts, which renders these same pages from what a real pass stored. Here the trader is seeded
// with this suite's usual direct SQL (as f6-open-positions.spec.ts), in the shape a pass leaves: `snaptrade` activities
// (never `demo`: the record stays Verified), the found sell stored now with a trade date 12 days back, and the derived
// closes, whose insert trigger stamps sell_imported_at from that late-stored sell. The fixture trader is its own
// (`f24_found`), deleted before and after; with 3 closes it is not feed-eligible, so it takes no feed lock.
import { test, expect } from '@playwright/test';
import postgres from 'postgres';

const DAY = 86_400_000;
const HANDLE = 'f24_found';
const FLAGGED = /\blate\b|corrected|\bnew\b/i;
const THESIS = 'Trimmed after the guidance cut; the thesis was wrong.';
const sql = postgres(process.env.DATABASE_URL!, { max: 2, onnotice: () => {} });
let foundId = '';

test.describe.configure({ mode: 'serial' });
test.use({ viewport: { width: 360, height: 800 } });

test.beforeAll(async () => {
  await sql`delete from users where handle = ${HANDLE}`;
  const [u] = await sql`
    with a as (insert into signup_attempts (method, adult_attested_at) values ('dev', now()) returning id)
    insert into users (handle, display_name, adult_attested_at, signup_attempt_id) select ${HANDLE}, 'F24 Found', now(), a.id from a returning id, signup_attempt_id`;
  await sql`insert into connections (attempt_id, user_id, state, consent_at, importing_at, connected_at, last_progress_at)
    values (${u.signup_attempt_id}, ${u.id}, 'connected', now() - interval '60 days', now() - interval '60 days', now() - interval '60 days', now())`;
  const at = (d: number) => new Date(Date.now() - d * DAY);
  const act = (id: string, symbol: string, side: 'BUY' | 'SELL', price: number, executed: Date, stored: Date) => ({
    user_id: u.id, source: 'snaptrade', external_id: `${HANDLE}-${id}`, account_id: `${HANDLE}-a`, symbol, side, units: 10, price, fee: 0,
    executed_at: executed, raw: sql.json({ type: side }), created_at: stored,
  });
  // Two closes the week reads stored on time, and the found one: its sell was stored by a pass today, 12 days after it traded.
  await sql`insert into activities ${sql([
    act('gb', 'F24G', 'BUY', 100, at(30), at(30)), act('gs', 'F24G', 'SELL', 106, at(20), at(20)),
    act('hb', 'F24H', 'BUY', 100, at(30), at(30)), act('hs', 'F24H', 'SELL', 97, at(18), at(18)),
    act('lb', 'F24L', 'BUY', 100, at(30), at(30)), act('ls', 'F24L', 'SELL', 92, at(12), new Date()),
  ])}`;
  const close = (s: string, symbol: string, r: number, opened: Date, closed: Date, thesis?: string) => ({
    user_id: u.id, sell_id: `${HANDLE}-${s}`, account_id: `${HANDLE}-a`, symbol, opened_at: opened, closed_at: closed, return_pct: r,
    holding_days: (closed.getTime() - opened.getTime()) / DAY, verified: true, thesis: thesis ?? null, thesis_status: thesis ? 'published' : null,
    thesis_written_at: thesis ? new Date() : null,
  });
  const rows = await sql`insert into closed_trades ${sql([
    close('gs', 'F24G', 0.06, at(30), at(20)), close('hs', 'F24H', -0.03, at(30), at(18)), close('ls', 'F24L', -0.08, at(30), at(12), THESIS),
  ])} returning id, sell_id, sell_imported_at`;
  const found = rows.find((r) => r.sell_id === `${HANDLE}-ls`)!;
  expect(Date.now() - new Date(found.sell_imported_at).getTime()).toBeLessThan(DAY); // stored late, as a pass stores it
  foundId = String(found.id);
});

test.afterAll(async () => {
  await sql`delete from users where handle = ${HANDLE}`;
  await sql.end({ timeout: 1 });
});

test('F-24 AC7: the found close\'s profile row reads like any close, keeps its thesis, and the page has no horizontal scroll', async ({ page }) => {
  await page.goto(`/u/${HANDLE}`);
  const row = page.locator(`#trade-${foundId}`);
  await expect(row).toBeVisible();
  await expect(row).toContainText('F24L');
  await expect(row).toContainText('-8.0%');
  await expect(row).toContainText(THESIS);
  expect(await row.innerText()).not.toMatch(FLAGGED);
  expect(await row.evaluate((el) => [el, ...el.querySelectorAll('*')].map((e) => e.className).join(' '))).not.toMatch(/\b(late|corrected|new|found|reissue)\b/i);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
});

test('F-24 AC7: the found close\'s trade page reads like any close, keeps its thesis, and has no horizontal scroll', async ({ page }) => {
  await page.goto(`/u/${HANDLE}/trade/${encodeURIComponent(`${HANDLE}-ls`)}`);
  // Since FIXES-LABELS (#85) the close's figures and its note are two sections; both are the close's own and checked.
  const section = page.locator('section[aria-labelledby="this-trade"]');
  const note = page.locator('section[aria-labelledby="trade-thesis"]');
  await expect(section).toContainText('F24L');
  await expect(section).toContainText('-8.0%');
  await expect(note).toContainText(THESIS);
  expect(await section.innerText()).not.toMatch(FLAGGED);
  expect(await note.innerText()).not.toMatch(FLAGGED);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
});
