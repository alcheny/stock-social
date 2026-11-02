// F-25 · Similar trades rows on a profile (docs/features/F-25-one-link-rule-for-trade-rows.md, first AC): each row has
// exactly one link to its trade page, in the trade_key form, with no link inside another; the sheet a tap opens (the
// trader's pane) is not part of the row and is not counted. 12 traders of this file's own (random generic handles,
// fictional symbols, closes two days old so the similar pool holds them), removed after; feed lock held shared.
import { expect, test } from '@playwright/test';
import postgres from 'postgres';
import { feedLock } from './feed-lock.ts';
import { handleOf, KEY_RE, makeTrader, marker, removeHandles, symbolOf, type Made } from './f25-fixture.ts';

const sql = postgres(process.env.DATABASE_URL!, { max: 2, onnotice: () => {} });
const MARK = marker();
const made: Made[] = [];
let release: () => Promise<void> = async () => {};

test.beforeAll(async () => {
  release = await feedLock('shared');
  for (let t = 0; t < 12; t++) {
    const m = await makeTrader(sql, { handle: handleOf(`f25s${t.toString(36)}`), verified: true, mark: MARK,
      closes: Array.from({ length: 6 }, (_, i) => ({ symbol: symbolOf(), r: (i + t) % 3 ? 0.04 + i / 100 : -0.05 - t / 100, hoursAgo: 48 + (t * 6 + i) / 60, hold: 3 })) });
    await sql`update users set created_at = now() - interval '60 days' where id = ${m.id}`;
    made.push(m);
  }
});
test.afterAll(async () => {
  await removeHandles(sql, made.map((m) => m.handle));
  await release();
  await sql.end({ timeout: 1 });
});

test('Similar trades: one trade link per row, in the trade_key form, no nesting (the sheet excluded)', async ({ page }) => {
  test.setTimeout(120_000);
  const ours = new Set(made.map((m) => m.handle));
  const keys = new Set(made.flatMap((m) => m.trades.map((t) => `/u/${m.handle}/trade/${t.key}`)));
  const rows = page.locator('.similar > .suggest-in > ul > li');
  // The pool is rebuilt in the background (lib/similar.ts): reload until this file's traders fill it.
  await expect(async () => {
    await page.goto(`/u/${made[0].handle}`);
    await expect(rows).toHaveCount(3, { timeout: 500 });
    for (const h of await rows.evaluateAll((ls) => ls.map((l) => l.getAttribute('data-handle')))) expect(ours.has(h!)).toBe(true);
  }).toPass({ timeout: 60_000, intervals: [500, 2_000, 5_000] });
  for (const li of await rows.all()) {
    // Trade links in the row itself, not in a sheet or dialog it may hold.
    const own = await li.evaluate((l) => [...l.querySelectorAll('a[href*="/trade/"]')]
      .filter((a) => !a.closest('[role="dialog"], dialog, .sheet, section.pane')).map((a) => a.getAttribute('href')));
    expect(own, `row ${await li.getAttribute('data-handle')}`).toHaveLength(1);
    expect(own[0]!.split('/').pop()).toMatch(KEY_RE);
    expect(keys.has(own[0]!), 'the row\'s own trade').toBe(true);
    expect(await li.evaluate((l) => [...l.querySelectorAll('a')].some((a) => a.parentElement?.closest('a') || a.querySelector('a')))).toBe(false);
  }
});
