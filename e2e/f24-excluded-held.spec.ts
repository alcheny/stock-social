// F-24 final review (council cycle 5 RT-2; POLICY F3c "excluded and counted"): sells counted while the importer checks a
// broker row that may repeat an earlier one (users.excluded_held) are named on the signed-out profile at 360 px, with
// PROFILE.excludedHeld's exact text in `[data-excluded-held]`, and only while there are any. The count itself is derived
// by the rebuild (lib/sync-reconcile.hold.test.ts, lib/sync-reconcile.final.test.ts); here the trader is seeded by SQL
// (as e2e/f24-found-close.spec.ts) with its own handle, deleted before and after; with one close it is not
// feed-eligible, so it takes no feed lock.
import { test, expect } from '@playwright/test';
import postgres from 'postgres';
import { PROFILE } from '../lib/copy.ts';

const DAY = 86_400_000;
const HANDLE = 'f24_held';
const sql = postgres(process.env.DATABASE_URL!, { max: 2, onnotice: () => {} });

test.describe.configure({ mode: 'serial' });
test.use({ viewport: { width: 360, height: 800 } });

test.beforeAll(async () => {
  await sql`delete from users where handle = ${HANDLE}`;
  const [u] = await sql`
    with a as (insert into signup_attempts (method, adult_attested_at) values ('dev', now()) returning id)
    insert into users (handle, display_name, adult_attested_at, signup_attempt_id) select ${HANDLE}, 'F24 Held', now(), a.id from a returning id, signup_attempt_id`;
  await sql`insert into connections (attempt_id, user_id, state, consent_at, importing_at, connected_at, last_progress_at)
    values (${u.signup_attempt_id}, ${u.id}, 'connected', now() - interval '60 days', now() - interval '60 days', now() - interval '60 days', now())`;
  const at = (d: number) => new Date(Date.now() - d * DAY);
  const act = (id: string, side: 'BUY' | 'SELL', price: number, executed: Date) => ({
    user_id: u.id, source: 'snaptrade', external_id: `${HANDLE}-${id}`, account_id: `${HANDLE}-a`, symbol: 'F24X', side, units: 10, price, fee: 0,
    executed_at: executed, raw: sql.json({ type: side }),
  });
  await sql`insert into activities ${sql([act('b', 'BUY', 100, at(30)), act('s', 'SELL', 104, at(20))])}`;
  await sql`insert into closed_trades ${sql([{ user_id: u.id, sell_id: `${HANDLE}-s`, account_id: `${HANDLE}-a`, symbol: 'F24X', opened_at: at(30), closed_at: at(20),
    return_pct: 0.04, holding_days: 10, verified: true }])}`;
  await sql`update users set excluded_held = 2 where id = ${u.id}`;
});

test.afterAll(async () => {
  await sql`delete from users where handle = ${HANDLE}`;
  await sql.end({ timeout: 1 });
});

test('F-24 RT-2: excluded_held = 2 → the profile names the 2 sells with PROFILE.excludedHeld(2), no horizontal scroll', async ({ page }) => {
  await page.goto(`/u/${HANDLE}`);
  const line = page.locator('[data-excluded-held]');
  await expect(line).toHaveCount(1);
  await expect(line).toHaveText(PROFILE.excludedHeld(2));
  // FIXES-CYCLE5 (owner decision 2026-11-02, 1): the owner's exact wording, pinned literally as well.
  await expect(line).toHaveText('2 sells excluded while a possible duplicate is checked.');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
});

test('F-24 RT-2: excluded_held = 0 → the line is gone', async ({ page }) => {
  await sql`update users set excluded_held = 0 where handle = ${HANDLE}`;
  await page.goto(`/u/${HANDLE}`);
  await expect(page.locator('h1')).toBeVisible();
  await expect(page.locator('[data-excluded-held]')).toHaveCount(0);
  expect(await page.content()).not.toContain(PROFILE.excludedHeld(0).split(' excluded')[1]);
});
