// F-21 · how the sum reaches each surface (committee decision 9; AC "one function, equal everywhere"): the feed reads the
// counters in exactly one new query per page, the trade and month loaders ride the user query they already make, and
// the feed pane, trade strip and month strip carry the same number as the profile's section (lib/exclusions.ts).
// The pool lib/db.ts reuses is pre-seeded with a query-logging client, as in lib/feed.signed-out.test.ts.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import postgres from 'postgres';

const hasDb = !!process.env.DATABASE_URL;
const log: string[] = [];
if (hasDb) (globalThis as unknown as { sql: postgres.Sql }).sql = postgres(process.env.DATABASE_URL!, { onnotice: () => {}, debug: (_c, q) => { log.push(String(q)); } });
const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL' }, fn);
before(async () => { if (hasDb) await (await import('./db.ts')).sql.unsafe(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')).simple(); });
after(async () => { if (hasDb) await (await import('./db.ts')).sql.end({ timeout: 1 }); });

dbTest('F-21: one exclusion query per feed page; trade and month loaders add none; feed pane, strips and profile carry one number', async () => {
  const { sql } = await import('./db.ts');
  const { loadFeedPage } = await import('./feed.ts');
  const { loadTradeShare } = await import('./trade-share-load.ts');
  const { loadRecap } = await import('./recap-load.ts');
  const { storedExclusions, exclusionInput } = await import('./exclusions-load.ts');
  const { optionHeadline } = await import('./options-load.ts');
  const { exclusionTotal } = await import('./exclusions.ts');
  const { createAttempt, createUserForAttempt } = await import('./auth/attempts.ts');
  const tag = `x${Math.random().toString(36).slice(2, 9)}`;
  const ids: number[] = [];
  for (let t = 0; t < 6; t++) ids.push((await createUserForAttempt(await createAttempt({ method: 'dev', attested: true }), { handle: `${tag}${t}` })).id);
  const at = Date.now() - 600_000;
  await sql`insert into closed_trades ${sql(ids.flatMap((u, t) => Array.from({ length: 5 }, (_, i) => ({
    user_id: u, sell_id: `${tag}-${t}-${i}`, account_id: 'a', symbol: `X${(t * 5 + i) % 23}`, opened_at: new Date(at - 86_400_000),
    closed_at: new Date(at - (t * 5 + i) * 1000), return_pct: ((t + i) % 7 - 3) / 10 || 0.05, holding_days: 1, verified: true,
  }))))}`;
  const [a, b] = ids;
  await sql`update users set excluded_corporate = 2, excluded_shared = 1, excluded_future = 3, excluded_future_sells = 0 where id = ${a}`;
  try {
    log.length = 0;
    const page = await loadFeedPage(undefined, { ids });
    assert.equal(log.filter((q) => /excluded_future_sells/.test(q)).length, 1, 'exactly one new query per page');
    assert.equal(page.exclusions?.get(a), 3);
    assert.equal(page.exclusions?.get(b), 0);
    // ponytail: the profile's number is computed here through storedExclusions, not through the page's own reads
    // (app/u/[handle]/load.ts) — fix: render the profile (or call its load) and read the #excluded heading; the e2e does.
    const profile = exclusionTotal(exclusionInput((await storedExclusions([a])).get(a), (await optionHeadline([a])).get(a)!));
    assert.equal(profile, 3);
    log.length = 0;
    const t = await loadTradeShare(`${tag}0`, `${tag}-0-0`);
    const tq = log.filter((q) => /excluded_future_sells/.test(q));
    assert.equal(tq.length, 1);
    assert.match(tq[0], /from closed_trades ct join users u/, 'rides the trade page\'s own query');
    assert.equal(t?.excluded, profile);
    log.length = 0;
    const ym = new Date(at - 1000).toISOString().slice(0, 7);
    const r = await loadRecap(`${tag}0`, ym);
    const rq = log.filter((q) => /excluded_future_sells/.test(q));
    assert.equal(rq.length, 1);
    assert.match(rq[0], /select id, display_name, public_filer_id/, 'rides the month page\'s own user query');
    assert.equal(r?.excluded, profile);
    assert.equal((await loadTradeShare(`${tag}1`, `${tag}-1-0`))?.excluded, 0);
  } finally {
    await sql`delete from users where id in ${sql(ids)}`;
  }
});
