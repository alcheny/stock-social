// F-10 (plan §7 DB, committee round 2 engineer (2) and (8)): the feed's record strip costs no extra statement, and its
// K (bets) is the profile's K for the same record. Runs by default with DATABASE_URL. The pool lib/db.ts reuses
// (`globalThis.sql`) is pre-seeded with a query-logging client, as in lib/feed.signed-out.test.ts. Every fixture row is
// created here under a unique handle prefix and removed by id; nothing counts rows it did not create.
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

// The driver's one-time type lookups (pg_catalog, on the first use of an array type) are not the page's statements.
const app = () => log.filter((q) => !/pg_catalog\./.test(q));
const RECORDS_SQL = /string_agg\(concat_ws\(',', id, to_json\(symbol\)/;
const DAY = 86_400_000;

async function traders(tag: string, n: number): Promise<number[]> {
  const { createAttempt, createUserForAttempt } = await import('./auth/attempts.ts');
  const ids: number[] = [];
  for (let t = 0; t < n; t++) ids.push((await createUserForAttempt(await createAttempt({ method: 'dev', attested: true }), { handle: `${tag}${t}` })).id);
  return ids;
}

// Six closes per trader, a few hours apart, each a one-day hold; mixed signs so averages and ranges vary.
async function closes(tag: string, ids: number[], at: number) {
  const { sql } = await import('./db.ts');
  await sql`insert into closed_trades ${sql(ids.flatMap((u, t) => Array.from({ length: 6 }, (_, i) => ({
    user_id: u, sell_id: `${tag}-${t}-${i}`, account_id: 'a', symbol: `F${t % 13}${i}`, opened_at: new Date(at - DAY - i * 3_600_000),
    closed_at: new Date(at - i * 3_600_000 - t * 1000), return_pct: ((t + i) % 7 - 3) / 50 || 0.01, holding_days: 1, verified: true,
  }))))}`;
}

dbTest('F-10 AC4: the feed page with ~10 and with ~30 traders issues the same number of statements; records() at most 2', async () => {
  const { sql } = await import('./db.ts');
  const { loadFeedPage, records } = await import('./feed.ts');
  const tag = `fx${Math.random().toString(36).slice(2, 8)}`;
  const ids = await traders(tag, 40);
  try {
    const now = Date.now();
    await closes(tag, ids, now - 600_000);
    const few = ids.slice(0, 10), many = ids.slice(10, 40);
    // Warm the module state (pool, schema caches) with an unrelated call so both counts are of the same kind of page.
    await loadFeedPage(undefined, { now, ids: ids.slice(0, 3) });
    log.length = 0;
    const p10 = await loadFeedPage(undefined, { now, ids: few });
    const n10 = app().length, r10 = log.filter((q) => RECORDS_SQL.test(q)).length;
    log.length = 0;
    const p30 = await loadFeedPage(undefined, { now, ids: many });
    const n30 = app().length, r30 = log.filter((q) => RECORDS_SQL.test(q)).length;
    assert.ok(p10.cards.length > 0 && p30.cards.length > 0);
    // Both pages hold a strip for every card's trader, built from the rows the page already read.
    for (const p of [p10, p30]) for (const c of p.cards) assert.ok(p.strips?.get(c.user_id), `strip for ${c.user_id}`);
    assert.equal(n30, n10, `statements: ${n10} for ~10 traders, ${n30} for ~30`);
    assert.ok(r10 <= 2 && r30 <= 2, `records() statements: ${r10}, ${r30}`);
    log.length = 0;
    const rows = await records(many);
    assert.ok(log.length <= 2, `records() issued ${log.length} statements`);
    assert.ok(rows.every((r) => r.openedAt instanceof Date && !Number.isNaN(r.openedAt.getTime())));
  } finally {
    await sql`delete from users where id in ${sql(ids)}`;
  }
});

dbTest('F-10 AC3 (K equality): the strip from records() rows equals stripEvidence over the profile\'s own read, touching boundary included', async () => {
  const { sql } = await import('./db.ts');
  const { loadFeedPage, records } = await import('./feed.ts');
  const { cardEvidence } = await import('./record-card.ts');
  const { stripEvidence, stripFigures, forgetFeedStrips } = await import('./record-strip.ts');
  const tag = `fk${Math.random().toString(36).slice(2, 8)}`;
  const ids = await traders(tag, 2);
  const [uid, other] = ids;
  try {
    // Microsecond timestamps, as the database stores them. TOUCH0 closes at exactly the instant TOUCH1 opens (same
    // symbol): one bet on the profile (lib/bets.ts: the boundary instant is included), so it must be one here too.
    const T = '2026-10-20 14:30:00.123456+00';
    await sql`insert into closed_trades (user_id, sell_id, account_id, symbol, opened_at, closed_at, return_pct, holding_days, verified) values
      (${uid}, ${`${tag}-t0`}, 'a', 'TOUCH', ${T}::timestamptz - interval '2 days', ${T}::timestamptz, 0.04, 2, true),
      (${uid}, ${`${tag}-t1`}, 'a', 'TOUCH', ${T}::timestamptz, ${T}::timestamptz + interval '1 day', -0.03, 1, true),
      (${uid}, ${`${tag}-t2`}, 'a', 'TOUCH', ${T}::timestamptz + interval '1 day 00:00:00.001', ${T}::timestamptz + interval '3 days', 0.02, 2, true)`;
    // More one-bet closes so the record is past 5 bets (a range, not Too early, for at least one variant of the test).
    await sql`insert into closed_trades ${sql(Array.from({ length: 8 }, (_, i) => ({
      user_id: uid, sell_id: `${tag}-b${i}`, account_id: 'a', symbol: `KB${i}`, opened_at: new Date(Date.UTC(2026, 8, 1 + i * 2, 10, 0, 0, 7)),
      closed_at: new Date(Date.UTC(2026, 8, 2 + i * 2, 15, 0, 0, 7)), return_pct: 0.01 + (i % 3) * 0.004 - 0.003, holding_days: 1, verified: true,
    })))}`;
    // One recent close, so the trader is on the feed page below.
    await sql`insert into closed_trades (user_id, sell_id, account_id, symbol, opened_at, closed_at, return_pct, holding_days, verified) values
      (${uid}, ${`${tag}-r`}, 'a', 'KREC', ${new Date(Date.now() - DAY - 600_000)}, ${new Date(Date.now() - 600_000)}, -0.02, 1, true)`;
    // A second trader so the page holds two records (the feed reads them in one aggregate).
    await closes(tag, [other], Date.now() - 600_000);

    // The profile's read and mapping (app/u/[handle]/page.tsx: closed_trades with opened_at, then cardEvidence).
    const prof = await sql`select symbol, return_pct, holding_days, opened_at, closed_at from closed_trades where user_id = ${uid} order by closed_at desc, id desc`;
    const profInput = prof.map((t) => ({ symbol: t.symbol as string, openedAt: t.opened_at as Date, closedAt: t.closed_at as Date, returnPct: Number(t.return_pct), holdingDays: Number(t.holding_days) }));
    const now = new Date();
    const fromProfile = stripEvidence(profInput, now);
    assert.equal(fromProfile.k, cardEvidence(profInput, now).k);
    // The touching pair is one bet; the entry 1 ms later starts another (12 closes, 11 bets). Both reads keep milliseconds
    // (a JS Date), so an entry under 1 ms after a close touches it on the profile and here alike.
    assert.equal(fromProfile.n, 12);
    assert.equal(fromProfile.k, 11);

    const rows = (await records([uid, other])).filter((r) => r.userId === uid);
    assert.equal(rows.length, 12);
    assert.deepEqual(stripEvidence(rows, now), fromProfile);
    assert.deepEqual(stripFigures(rows, now), stripFigures(profInput, now));

    // And through the page: page.strips is the same evidence.
    forgetFeedStrips();
    const page = await loadFeedPage(undefined, { ids });
    assert.ok(page.cards.some((c) => c.user_id === uid), 'the trader has a card on the page');
    assert.deepEqual(page.strips?.get(uid)?.evidence, fromProfile);
  } finally {
    await sql`delete from users where id in ${sql(ids)}`;
  }
});

// F4-19 (cycle 4, C4-22): AC4 with the options gate forced open (test-only: a covering scope line and consent version,
// restored in finally) and every trader holding options. The gate is one query for the page's traders; the rule still
// runs per trader, so open, re-consented, old-hash and demo traders each keep their own state.
dbTest('F-10 AC4 (F4-19): with the options gate open and option holders on every card, ~10 and ~30 traders issue the same number of statements', async () => {
  const { sql } = await import('./db.ts');
  const { loadFeedPage } = await import('./feed.ts');
  const { PUBLIC_FIELDS } = await import('./privacy-fields.ts');
  const { OPTION_PUBLIC_COLUMNS, optionsPublic } = await import('./options-gate.ts');
  const { CONSENT_VERSIONS, consentHash, CURRENT_CONSENT_HASH } = await import('./consent-versions.ts');
  const { traderOptionsPublic } = await import('./options-load.ts');
  const tag = `fo${Math.random().toString(36).slice(2, 8)}`;
  const ids = await traders(tag, 40);
  PUBLIC_FIELDS.push({ words: 'for options, call or put, expiry date and percent return on the premium paid', columns: [...OPTION_PUBLIC_COLUMNS] });
  const covering = { line: `${tag} future line`, publicColumns: [...PUBLIC_FIELDS.flatMap((f) => f.columns)] };
  (CONSENT_VERSIONS as unknown as (typeof covering)[]).push(covering);
  try {
    assert.equal(optionsPublic(), true);
    const NEW = consentHash(covering.line);
    const now = Date.now();
    await closes(tag, ids, now - 600_000);
    // Every trader holds options (a counted close); four kinds in turn: demo, re-consented, old hash, two accounts one unheld.
    await sql`update users set excluded_options_other = 1 where id in ${sql(ids)}`;
    const acts: Record<string, unknown>[] = [];
    const conns: Record<string, unknown>[] = [];
    ids.forEach((u, t) => {
      const kind = t % 4, acc = `${tag}-${t}`;
      acts.push({ user_id: u, source: kind === 0 ? 'demo' : 'snaptrade', external_id: `${acc}-o`, account_id: acc, raw: sql.json({}) });
      if (kind === 3) acts.push({ user_id: u, source: 'snaptrade', external_id: `${acc}-o2`, account_id: `${acc}-x`, raw: sql.json({}) });
      if (kind !== 0) conns.push({ user_id: u, hash: kind === 2 ? CURRENT_CONSENT_HASH : NEW, accounts: sql.json([{ id: acc, authorizationId: 'a', institution: 'x', isPaper: false }]) });
    });
    await sql`insert into option_activities ${sql(acts)}`;
    for (const c of conns) await sql`insert into connections (attempt_id, user_id, state, consent_at, importing_at, connected_at, consent_scope_hash, accounts, options_backfilled_at)
      select signup_attempt_id, id, 'connected', now(), now(), now(), ${c.hash as string}, ${c.accounts as never}, now() from users where id = ${c.user_id as number}`;
    const few = ids.slice(0, 10), many = ids.slice(10, 40);
    await loadFeedPage(undefined, { now, ids: ids.slice(0, 3) });
    log.length = 0;
    const p10 = await loadFeedPage(undefined, { now, ids: few });
    const n10 = app().length;
    log.length = 0;
    const p30 = await loadFeedPage(undefined, { now, ids: many });
    const n30 = app().length;
    assert.ok(p10.cards.length > 0 && p30.cards.length > 0);
    assert.equal(n30, n10, `statements: ${n10} for ~10 traders, ${n30} for ~30`);
    // The batch gives each trader the state the single-trader gate gives: demo and re-consented open, the rest closed.
    for (const p of [p10, p30]) {
      const shown = [...new Set(p.cards.map((c) => c.user_id))];
      assert.ok(shown.length > 3);
      for (const id of shown) {
        const t = ids.indexOf(id);
        assert.equal(p.options?.get(id)?.open, t % 4 < 2, `trader ${t}`);
        assert.equal(await traderOptionsPublic(id), t % 4 < 2, `single gate, trader ${t}`);
      }
    }
  } finally {
    PUBLIC_FIELDS.pop();
    (CONSENT_VERSIONS as unknown[]).pop();
    await sql`delete from users where id in ${sql(ids)}`;
  }
});
