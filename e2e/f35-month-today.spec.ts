// F-35 AC5 (docs/features/F-35-publish-once-the-date-has-passed.md): a trade is published once its date has passed. A
// trader with a close an hour old and a close dated two hours ahead (dates from the database's now()), rebuilt by the
// app's own rebuild: the month page says "Trades close through today" and lists only the past close; the profile names
// the waiting row on its future line (PROFILE.futureWaiting, muted, beside the other exclusion lines) at 360 px, signed
// out, in light and dark, under browser zones UTC and Pacific/Kiritimati (UTC+14). Once the row's date has passed (its
// rows moved back, the clock untouched) and the record is rebuilt, the close is listed and the line is gone. The server
// zone half is lib/f35-publish.test.ts (AC5 server zone). The trader is seeded by SQL with its own handle, deleted before
// and after; with two closes it is not feed-eligible, so it takes no feed lock.
import { test, expect } from '@playwright/test';
import postgres from 'postgres';
import { PROFILE } from '../lib/copy.ts';

const HOUR = 3_600_000, DAY = 24 * HOUR;
const HANDLE = 'f35_today';
const sql = postgres(process.env.DATABASE_URL!, { max: 2, onnotice: () => {} });
let ym = '';

test.describe.configure({ mode: 'serial' });
test.use({ viewport: { width: 360, height: 800 } });

async function rebuild(id: number) {
  const { rebuildRecord } = await import('../lib/options-sync.ts');
  await rebuildRecord(id);
}

test.beforeAll(async () => {
  await sql`delete from users where handle = ${HANDLE}`;
  const [u] = await sql`
    with a as (insert into signup_attempts (method, adult_attested_at) values ('dev', now()) returning id)
    insert into users (handle, display_name, adult_attested_at, signup_attempt_id) select ${HANDLE}, 'F35 Today', now(), a.id from a returning id, signup_attempt_id`;
  await sql`insert into connections (attempt_id, user_id, state, consent_at, importing_at, connected_at, last_progress_at)
    values (${u.signup_attempt_id}, ${u.id}, 'connected', now() - interval '60 days', now() - interval '60 days', now() - interval '60 days', now())`;
  const [{ t }] = await sql`select extract(epoch from now()) * 1000 as t`;
  const now = Number(t);
  ym = new Date(now - HOUR).toISOString().slice(0, 7);
  const act = (id: string, symbol: string, side: 'BUY' | 'SELL', price: number, ms: number) => ({
    user_id: u.id, source: 'snaptrade', external_id: `${HANDLE}-${id}`, account_id: `${HANDLE}-a`, symbol, side, units: 10, price, fee: 0,
    executed_at: new Date(now + ms), raw: sql.json({ type: side }),
  });
  // A row dated ahead is stored with created_at before its date, as an import stores it.
  await sql`insert into activities ${sql([act('b1', 'FPAST', 'BUY', 100, -3 * DAY), act('s1', 'FPAST', 'SELL', 96, -HOUR), act('b2', 'FWAIT', 'BUY', 100, -3 * DAY), act('s2', 'FWAIT', 'SELL', 108, 2 * HOUR)])}`;
  await rebuild(u.id);
});

test.afterAll(async () => {
  await sql`delete from users where handle = ${HANDLE}`;
  await sql.end({ timeout: 1 });
});

for (const timezoneId of ['UTC', 'Pacific/Kiritimati']) {
  for (const colorScheme of ['light', 'dark'] as const) {
    test.describe(`${timezoneId}, ${colorScheme}`, () => {
      test.use({ timezoneId, colorScheme });

      test(`F-35: the month page lists only closes dated at or before now (${timezoneId}, ${colorScheme})`, async ({ page }) => {
        await page.goto(`/u/${HANDLE}/month/${ym}`);
        const current = ym === new Date().toISOString().slice(0, 7);
        if (current) await expect(page.getByText('Trades close through today.')).toBeVisible();
        const list = page.locator('ol li');
        await expect(list).toHaveCount(1);
        await expect(list.first()).toContainText('FPAST');
        expect(await page.content()).not.toContain('FWAIT');
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
      });

      test(`F-35: the profile names the waiting row on its muted future line (${timezoneId}, ${colorScheme})`, async ({ page }) => {
        await page.goto(`/u/${HANDLE}`);
        const line = page.locator('[data-excluded-future]');
        await expect(line).toHaveCount(1);
        await expect(line).toHaveText(PROFILE.futureWaiting(1));
        await expect(line).toHaveText('1 imported trade excluded: dated in the future by the broker. It waits on this line until that date passes.');
        await expect(line).toHaveClass(/\bmuted\b/);
        const box = await line.boundingBox();
        expect(box && box.x >= 0 && box.x + box.width <= 360).toBeTruthy(); // not cut off at 360 px
        expect(await line.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
        expect(await page.content()).not.toContain('FWAIT');
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
      });
    });
  }
}

test('F-35: once the date has passed, the close is listed and the future line is gone (never "0 imported trades")', async ({ page }) => {
  const [u] = await sql`select id from users where handle = ${HANDLE}`;
  await sql`update activities set executed_at = executed_at - interval '3 hours', created_at = created_at - interval '3 hours' where user_id = ${u.id}`;
  await rebuild(u.id);
  await page.goto(`/u/${HANDLE}`);
  await expect(page.locator('h1')).toBeVisible();
  await expect(page.locator('[data-excluded-future]')).toHaveCount(0);
  expect(await page.content()).not.toContain('0 imported trades');
  const [{ m }] = await sql`select to_char(max(closed_at) at time zone 'UTC', 'YYYY-MM') as m from closed_trades where user_id = ${u.id} and symbol = 'FWAIT'`;
  await page.goto(`/u/${HANDLE}/month/${m}`);
  await expect(page.locator('ol li', { hasText: 'FWAIT' })).toHaveCount(1);
});
