// OPTIONS AC 8–11, 14 and 22 (docs/features/logs/options/plan.md) against the database: raw option rows, the record
// rebuild with the exercise-day share rule, the sync window, the import path, the OCC purge, deletion, and the
// per-trader consent gate. Every test creates and removes its own rows (the database is shared).
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import type { OptionRow } from './options.ts';

const hasDb = !!process.env.DATABASE_URL;
const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL' }, fn);
before(async () => { if (hasDb) await (await import('./db.ts')).sql.unsafe(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')).simple(); });
after(async () => { if (hasDb) await (await import('./db.ts')).sql.end({ timeout: 1 }); });

const prng = (seed: number) => { let t = seed >>> 0; return () => { t = (t + 0x6d2b79f5) >>> 0; let x = Math.imul(t ^ (t >>> 15), 1 | t); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; };
const DAY = 86_400_000;

async function setup() {
  const { sql } = await import('./db.ts');
  const { createAttempt, createUserForAttempt } = await import('./auth/attempts.ts');
  const tag = `o${Math.random().toString(36).slice(2, 10)}`;
  const users: number[] = [];
  const mk = async (n = 'u') => { const u = await createUserForAttempt(await createAttempt({ method: 'dev', attested: true }), { handle: `${tag}${n}` }); users.push(u.id); return u; };
  const opt = (id: string, account: string, kind: string, oc: string | null, at: string, o: Partial<OptionRow> = {}): OptionRow & { raw: unknown } => ({
    externalId: `${tag}-${id}`, accountId: account, kind, openClose: oc, underlying: 'XYZ', underlyingType: 'cs', right: 'CALL', expiry: '2026-12-19',
    strikeMilli: 123_450, multiplier: 100, occTicker: 'XYZ   261219C00123450', units: 1, price: 1, fee: 0, amount: null, currency: 'USD',
    executedAt: new Date(at), verified: true, raw: { t: tag }, ...o,
  });
  const share = (id: string, account: string, side: 'BUY' | 'SELL', price: number, at: string, symbol = 'XYZ') => ({
    externalId: `${tag}-${id}`, accountId: account, symbol, side, units: 1, price, fee: 0, executedAt: new Date(at), verified: true, raw: {},
  });
  const cleanup = async (accounts: string[] = []) => {
    if (users.length) await sql`delete from users where id in ${sql(users)}`;
    if (accounts.length) await sql`delete from broker_accounts where account_id in ${sql(accounts)}`;
  };
  return { sql, tag, mk, opt, share, cleanup };
}

test('AC8: lib/trades.ts has no diff against main in this PR (skipped where main is not fetched)', (t) => {
  let diff: string;
  // Fixes cycle 3 (merged after this PR): the check was "this PR's diff against main". Once the options PR merged (b339d88),
  // a later fix to the share matcher (lib/trades.ts, F3-1/F3-5) is a diff against main too, so the check is pinned to the
  // options PR's own merge: it changed nothing in lib/trades.ts. Skipped where that commit is not fetched, as before.
  try { diff = execFileSync('git', ['diff', 'b339d88^1', 'b339d88', '--', 'lib/trades.ts'], { cwd: new URL('..', import.meta.url), encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); } catch { t.skip('options merge commit not fetched'); return; }
  assert.equal(diff, '');
  // The option code never calls the share matcher, and rebuildRecord reaches rebuildTrades only by calling it.
  for (const f of ['options.ts', 'options-sync.ts', 'options-load.ts', 'options-view.ts']) assert.doesNotMatch(readFileSync(new URL(`./${f}`, import.meta.url), 'utf8'), /matchTrades/, f);
});

dbTest('AC9: option_activities stores 0-price and malformed rows; a re-insert is a no-op; paper accounts and future-dated rows are left out of the rebuild', async () => {
  const { sql, tag, mk, opt, cleanup } = await setup();
  const { insertOptionActivities, rebuildRecord } = await import('./options-sync.ts');
  const u = await mk();
  const acc = `${tag}-acc`, paper = `${tag}-paper`;
  const oct = { expiry: '2026-10-16', occTicker: 'XYZ   261016C00123450' };
  try {
    const rows = [
      opt('b', acc, 'BUY', 'BUY_TO_OPEN', '2026-10-01T15:00:00Z', { price: 2, ...oct }),
      opt('x', acc, 'OPTIONEXPIRATION', null, '2026-10-16T21:00:00Z', { price: 0, units: null, amount: 0, ...oct }), // 0-price expiry
      opt('m', acc, 'OPTIONASSIGNMENT', null, '2026-10-02T15:00:00Z', { underlying: null, right: null, expiry: null, strikeMilli: null, multiplier: null, occTicker: null }),
      opt('d', acc, 'SELL', 'SELL_TO_CLOSE', '2026-10-03T15:00:00Z', { executedAt: null }), // no date: stored, counted
      opt('pb', paper, 'BUY', 'BUY_TO_OPEN', '2026-10-01T15:00:00Z', { price: 2 }), opt('ps', paper, 'SELL', 'SELL_TO_CLOSE', '2026-10-05T15:00:00Z', { price: 3 }),
      opt('fb', acc, 'BUY', 'BUY_TO_OPEN', new Date(Date.now() + 3 * DAY).toISOString(), { right: 'PUT', occTicker: 'XYZ   261219P00123450' }),
    ];
    await insertOptionActivities(u.id, 'snaptrade', rows);
    await insertOptionActivities(u.id, 'snaptrade', rows); // no-op
    const stored = await sql`select external_id, share_price, executed_at, contract_key from option_activities where user_id = ${u.id} order by external_id`;
    assert.equal(stored.length, 7);
    assert.equal(stored.find((r) => r.external_id === `${tag}-x`)!.share_price, 0);
    assert.equal(stored.find((r) => r.external_id === `${tag}-d`)!.contract_key, null);
    await sql`insert into broker_accounts (account_id, user_id, is_paper) values (${paper}, ${u.id}, true)`;
    const r = await rebuildRecord(u.id, undefined, new Date('2026-10-20T00:00:00Z'));
    // Shown: the -100% expiry on acc; counted: the assignment without a contract, the dateless close. Paper and future out.
    assert.equal(r.options.trades, 1);
    assert.equal(r.options.counts.noContract, 1);
    assert.equal(r.options.counts.malformed, 1);
    const [t] = await sql`select return_pct, close_id from option_trades where user_id = ${u.id}`;
    assert.equal(t.close_id, `${tag}-x`);
    assert.equal(t.return_pct, -1);
  } finally { await cleanup([paper]); }
});

dbTest('AC10: rebuildRecord writes option_trades and both counters and is idempotent; the exercise-day rule removes and counts share closes and keeps their theses', async () => {
  const { sql, tag, mk, opt, share, cleanup } = await setup();
  const { insertActivities } = await import('./sync.ts');
  const { insertOptionActivities, rebuildRecord } = await import('./options-sync.ts');
  const u = await mk();
  const acc = `${tag}-acc`;
  try {
    await insertActivities(u.id, 'snaptrade', [
      // A delivered lot (bought on the exercise day D = Oct 10) sold later; a removal sell on D (put assigned); an
      // untouched close in another symbol; and an untouched XYZ close entirely before D.
      share('d-b', acc, 'BUY', 100, '2026-10-10T20:00:00Z'), share('d-s', acc, 'SELL', 120, '2026-10-20T15:00:00Z'),
      share('r-b', acc, 'BUY', 50, '2026-09-01T15:00:00Z', 'QRS'), share('r-s', acc, 'SELL', 45, '2026-10-12T15:00:00Z', 'QRS'),
      share('k-b', acc, 'BUY', 10, '2026-08-01T15:00:00Z', 'ABC'), share('k-s', acc, 'SELL', 11, '2026-10-15T15:00:00Z', 'ABC'),
      share('e-b', acc, 'BUY', 10, '2026-08-01T15:00:00Z'), share('e-s', acc, 'SELL', 11, '2026-08-05T15:00:00Z'),
    ]);
    await insertOptionActivities(u.id, 'snaptrade', [
      opt('1b', acc, 'BUY', 'BUY_TO_OPEN', '2026-09-01T15:00:00Z', { price: 2 }), opt('1x', acc, 'OPTIONEXERCISE', null, '2026-10-10T20:00:00Z'),
      opt('2s', acc, 'SELL', 'SELL_TO_OPEN', '2026-09-01T15:00:00Z', { underlying: 'QRS', right: 'PUT', occTicker: 'QRS   261219P00123450' }),
      opt('2a', acc, 'OPTIONASSIGNMENT', null, '2026-10-12T15:00:00Z', { underlying: 'QRS', right: 'PUT', occTicker: 'QRS   261219P00123450' }),
      opt('3b', acc, 'BUY', 'BUY_TO_OPEN', '2026-09-02T15:00:00Z', { right: 'PUT', occTicker: 'XYZ   261219P00123450', price: 1 }),
      opt('3s', acc, 'SELL', 'SELL_TO_CLOSE', '2026-09-03T15:00:00Z', { right: 'PUT', occTicker: 'XYZ   261219P00123450', price: 1.5 }),
    ]);
    const first = await rebuildRecord(u.id);
    assert.equal(first.trades, 4); // what rebuildTrades wrote
    assert.equal(first.removedForExercise, 2);
    const closes = async () => (await sql`select sell_id from closed_trades where user_id = ${u.id} order by sell_id`).map((r) => r.sell_id as string);
    assert.deepEqual(await closes(), [`${tag}-e-s`, `${tag}-k-s`]);
    const counters = async () => (await sql`select excluded_options_short as s, excluded_options_other as o, excluded_exercise_shares as x from users where id = ${u.id}`)[0];
    // Short: the assignment. Other: the exercise. The 2 removed share closes have their own counter (fix round 1, QA 8).
    assert.deepEqual({ ...await counters() }, { s: 1, o: 1, x: 2 });
    const trades = async () => sql`select close_id, round(return_pct::numeric, 6)::float8 as r from option_trades where user_id = ${u.id}`;
    assert.deepEqual([...await trades()], [{ close_id: `${tag}-3s`, r: 0.5 }]);
    // Idempotent.
    const again = await rebuildRecord(u.id);
    assert.equal(again.removedForExercise, 2);
    assert.deepEqual(await closes(), [`${tag}-e-s`, `${tag}-k-s`]);
    assert.deepEqual({ ...await counters() }, { s: 1, o: 1, x: 2 });
    assert.equal((await trades()).length, 1);
    // A thesis on a removed close survives in kept_theses and re-attaches when the taint goes.
    await sql`delete from option_activities where external_id = ${`${tag}-1x`}`; // own row: the taint goes
    await rebuildRecord(u.id);
    await sql`update closed_trades set thesis = 'kept', thesis_status = 'published' where sell_id = ${`${tag}-d-s`}`;
    await insertOptionActivities(u.id, 'snaptrade', [opt('1x', acc, 'OPTIONEXERCISE', null, '2026-10-10T20:00:00Z')]);
    await rebuildRecord(u.id);
    assert.ok(!(await closes()).includes(`${tag}-d-s`));
    const [k] = await sql`select thesis from kept_theses where user_id = ${u.id} and sell_id = ${`${tag}-d-s`}`;
    assert.equal(k.thesis, 'kept');
    await sql`delete from option_activities where external_id = ${`${tag}-1x`}`;
    await rebuildRecord(u.id);
    const [back] = await sql`select thesis, thesis_status from closed_trades where sell_id = ${`${tag}-d-s`}`;
    assert.deepEqual({ ...back }, { thesis: 'kept', thesis_status: 'published' });
    // No taint: rebuildRecord leaves rebuildTrades' closes as they are.
    assert.equal((await closes()).length, 3);
  } finally { await cleanup(); }
});

dbTest('AC10 (property, 1,000 ledgers): no remaining close spans a taint day of its account and stock; remaining + removed = what rebuildTrades wrote', async () => {
  const { sql, tag, mk, cleanup } = await setup();
  const { rebuildTrades } = await import('./sync.ts');
  const { rebuildRecord } = await import('./options-sync.ts');
  const u = await mk();
  const base = Date.UTC(2026, 0, 1);
  class Rollback extends Error {}
  try {
    for (let s = 1; s <= 1000; s++) {
      const r = prng(s);
      const acts: Record<string, unknown>[] = [], opts: Record<string, unknown>[] = [];
      for (let i = 0; i < 6; i++) {
        const sym = ['XYZ', 'QRS'][Math.floor(r() * 2)], acc = ['a', 'b'][Math.floor(r() * 2)];
        const open = base + Math.floor(r() * 40) * DAY + Math.floor(r() * 20) * 3_600_000, close = open + Math.floor(r() * 15) * DAY + 3_600_000;
        acts.push({ user_id: u.id, source: 'snaptrade', external_id: `${tag}-${s}-${i}b`, account_id: `${tag}${acc}`, symbol: sym, side: 'BUY', units: 1, price: 10, fee: 0, executed_at: new Date(open), raw: {} });
        acts.push({ user_id: u.id, source: 'snaptrade', external_id: `${tag}-${s}-${i}s`, account_id: `${tag}${acc}`, symbol: sym, side: 'SELL', units: 1, price: 9 + r() * 3, fee: 0, executed_at: new Date(close), raw: {} });
      }
      for (let i = 0; i < 2; i++) {
        opts.push({ user_id: u.id, source: 'snaptrade', external_id: `${tag}-${s}-x${i}`, account_id: `${tag}${['a', 'b'][Math.floor(r() * 2)]}`, kind: r() < 0.5 ? 'OPTIONEXERCISE' : 'OPTIONASSIGNMENT',
          underlying: ['XYZ', 'QRS'][Math.floor(r() * 2)], executed_at: new Date(base + Math.floor(r() * 55) * DAY + 12 * 3_600_000), raw: {} });
      }
      await sql.begin(async (tx) => {
        await tx`insert into activities ${tx(acts)}`;
        await tx`insert into option_activities ${tx(opts)}`;
        const wrote = (await rebuildTrades(u.id, tx)).trades;
        const out = await rebuildRecord(u.id, tx);
        const left = await tx`select account_id, symbol, (opened_at at time zone 'UTC')::date::text as o, (closed_at at time zone 'UTC')::date::text as c from closed_trades where user_id = ${u.id}`;
        const days = opts.map((x) => ({ a: x.account_id, s: x.underlying, d: (x.executed_at as Date).toISOString().slice(0, 10) }));
        for (const c of left) for (const d of days) assert.ok(!(c.account_id === d.a && c.symbol === d.s && c.o <= d.d && d.d <= c.c), `seed ${s}: a close spans ${d.d}`);
        assert.equal(left.length + out.removedForExercise, wrote, `seed ${s}`);
        assert.equal(out.trades, wrote, `seed ${s}`);
        throw new Rollback();
      }).catch((e) => { if (!(e instanceof Rollback)) throw e; });
    }
  } finally { await cleanup(); }
});

dbTest('AC11: an options-only trader\'s hourly sync re-reads the 7 days before the newest row across both raw tables; option rows and positions arrive through the sinks', async () => {
  const { sql, tag, mk, opt, cleanup } = await setup();
  const { syncUser } = await import('./sync.ts');
  const { insertOptionActivities } = await import('./options-sync.ts');
  const u = await mk();
  const acc = `${tag}-acc`;
  await sql`update users set snaptrade_user_id = ${`${tag}-v`}, snaptrade_secret_enc = 'enc' where id = ${u.id}`;
  // Backfilled already (fix round 1): this sync reads the week.
  await sql`insert into connections (attempt_id, user_id, vendor_authorization_id, state, consent_at, importing_at, connected_at, accounts, options_backfilled_at)
    select signup_attempt_id, id, 'a', 'connected', now(), now(), now(), ${sql.json([{ id: acc, authorizationId: 'a', institution: 'x', isPaper: false, initialSyncCompleted: true }])}, now() from users where id = ${u.id}`;
  try {
    await insertOptionActivities(u.id, 'snaptrade', [opt('b', acc, 'BUY', 'BUY_TO_OPEN', '2026-10-20T15:00:00Z', { price: 2 })]);
    const since: Date[] = [];
    let paged = 0;
    const broker = {
      listAccounts: async () => [{ id: acc, authorizationId: 'a', institution: 'x', isPaper: false, initialSyncCompleted: true }],
      fetchActivitiesPage: async () => { paged++; return { activities: [], done: true }; },
      fetchActivities: async (_u: unknown, s: Date, _ids?: string[], sink?: (rows: (OptionRow & { raw: unknown })[]) => void) => {
        since.push(s);
        sink?.([opt('s', acc, 'SELL', 'SELL_TO_CLOSE', '2026-10-25T15:00:00Z', { price: 3 })]);
        return [];
      },
      fetchPositions: async (_u: unknown, _id: string, sink?: (s: import('./broker.ts').PositionSplit) => void) => {
        sink?.({ options: [{ positionKey: 'k', underlying: 'XYZ', right: 'PUT', expiry: '2026-12-19', unrealizedPct: -0.2 }], short: 2, unsupported: 1 });
        return [];
      },
    };
    await syncUser({ id: u.id, snaptrade_user_id: `${tag}-v`, snaptrade_secret_enc: 'enc' }, broker as never);
    assert.equal(paged, 0); // stored history exists (option rows), so no whole-history read
    assert.deepEqual(since.map((d) => d.toISOString()), [new Date(Date.parse('2026-10-20T15:00:00Z') - 7 * DAY).toISOString()]);
    assert.equal((await sql`select count(*)::int as n from option_trades where user_id = ${u.id}`)[0].n, 1);
    const [c] = await sql`select open_options_short, open_unsupported from users where id = ${u.id}`;
    assert.deepEqual({ ...c }, { open_options_short: 2, open_unsupported: 1 });
    assert.equal((await sql`select count(*)::int as n from open_option_positions where user_id = ${u.id}`)[0].n, 1);
    // lib/sync.ts only calls the helper (AC 11, AC 23).
    assert.match(readFileSync(new URL('./sync.ts', import.meta.url), 'utf8'), /lastOptionActivityAt\(tx, user\.id\)/);
  } finally { await cleanup([acc]); }
});

dbTest('AC14: purgeOccPositions removes stored OCC rows, a frozen trader\'s included; profile deletion removes every row of the three option tables', async () => {
  const { sql, tag, mk, opt, cleanup } = await setup();
  const { insertOptionActivities, purgeOccPositions, rebuildRecord, replaceOptionPositions } = await import('./options-sync.ts');
  const { deleteProfile } = await import('./delete.ts');
  const frozen = await mk('f');
  const acc = `${tag}-acc`;
  try {
    await sql`insert into connections (attempt_id, user_id, state, consent_at, importing_at, connected_at, disconnected_at)
      select signup_attempt_id, id, 'connected', now(), now(), now(), now() from users where id = ${frozen.id}`;
    await sql`insert into open_positions (user_id, account_id, symbol, unrealized_pct) values
      (${frozen.id}, ${acc}, 'XYZ   261219C00123450', 0.1), (${frozen.id}, ${acc}, 'XYZ261219P00050000', 0.2), (${frozen.id}, ${acc}, 'XYZ', 0.3)`;
    assert.equal(await purgeOccPositions(sql, frozen.id), 2);
    assert.deepEqual((await sql`select symbol from open_positions where user_id = ${frozen.id}`).map((r) => r.symbol), ['XYZ']);
    // Deletion: all three tables.
    const u = await mk('d');
    await insertOptionActivities(u.id, 'snaptrade', [opt('b', acc, 'BUY', 'BUY_TO_OPEN', '2026-10-01T15:00:00Z'), opt('s', acc, 'SELL', 'SELL_TO_CLOSE', '2026-10-02T15:00:00Z', { price: 2 })]);
    await rebuildRecord(u.id);
    await sql.begin((tx) => replaceOptionPositions(tx, u.id, null, new Map([[acc, { options: [{ positionKey: 'k', underlying: 'XYZ', right: 'CALL', expiry: '2026-12-19', unrealizedPct: 0.1 }], short: 0, unsupported: 0 }]])));
    const n = async () => (await sql`select (select count(*) from option_activities where user_id = ${u.id})::int + (select count(*) from option_trades where user_id = ${u.id})::int
      + (select count(*) from open_option_positions where user_id = ${u.id})::int as n`)[0].n as number;
    assert.equal(await n(), 4);
    await deleteProfile({ id: u.id, handle: u.handle, snaptrade_user_id: null, snaptrade_secret_enc: null }, { deleteVendorUser: async () => {}, endBilling: async () => {} });
    assert.equal(await n(), 0);
  } finally { await cleanup(); }
});

dbTest('AC22 (rounds 3–5): with the gate open globally, old or null hashes get counts only, a re-consented trader everything, a demo trader everything; per trader in one batch', async () => {
  const { sql, tag, mk, opt, cleanup } = await setup();
  const { PUBLIC_FIELDS } = await import('./privacy-fields.ts');
  const { OPTION_PUBLIC_COLUMNS } = await import('./options-gate.ts');
  const { CONSENT_VERSIONS, consentHash, CURRENT_CONSENT_HASH } = await import('./consent-versions.ts');
  const { insertOptionActivities, rebuildRecord } = await import('./options-sync.ts');
  const { loadOptionRecord, optionHeadline } = await import('./options-load.ts');
  // Open the global gate and add a covering consent line for this test only (restored in finally).
  const field = { words: 'for options, call or put, expiry date and percent return on the premium paid', columns: [...OPTION_PUBLIC_COLUMNS] };
  PUBLIC_FIELDS.push(field);
  const covering = { line: `${tag} future line`, publicColumns: [...PUBLIC_FIELDS.flatMap((f) => f.columns)] };
  (CONSENT_VERSIONS as unknown as (typeof covering)[]).push(covering);
  const NEW = consentHash(covering.line);
  const conn = (userId: number, accounts: string[], hash: string | null, frozen = false, backfilled = true) => sql`insert into connections (attempt_id, user_id, state, consent_at, importing_at, connected_at, disconnected_at, consent_scope_hash, accounts, options_backfilled_at)
    select signup_attempt_id, id, 'connected', now(), now(), now(), ${frozen ? new Date() : null}, ${hash}, ${sql.json(accounts.map((id) => ({ id, authorizationId: 'a', institution: 'x', isPaper: false })))}, ${backfilled ? new Date() : null} from users where id = ${userId}`;
  const withOptions = async (userId: number, acc: string, source: 'snaptrade' | 'demo' = 'snaptrade') => {
    await insertOptionActivities(userId, source, [opt(`${userId}b`, acc, 'BUY', 'BUY_TO_OPEN', '2026-10-01T15:00:00Z'), opt(`${userId}s`, acc, 'SELL', 'SELL_TO_CLOSE', '2026-10-02T15:00:00Z', { price: 2 })]);
    await rebuildRecord(userId);
  };
  try {
    const old = await mk('old'), nul = await mk('nul'), re = await mk('re'), demo = await mk('demo'), mixed = await mk('mix'), frozen = await mk('frz'), stray = await mk('str');
    await withOptions(old.id, `${tag}-old`); await conn(old.id, [`${tag}-old`], CURRENT_CONSENT_HASH);
    await withOptions(nul.id, `${tag}-nul`); await conn(nul.id, [`${tag}-nul`], null);
    await withOptions(re.id, `${tag}-re`); await conn(re.id, [`${tag}-re`], NEW);
    await withOptions(demo.id, 'demo-acct', 'demo');
    // Round 4: an old share-only connection doesn't block a re-consented option connection.
    await withOptions(mixed.id, `${tag}-mixo`); await conn(mixed.id, [`${tag}-mixo`], NEW); await conn(mixed.id, [`${tag}-mixs`], null);
    // Round 4: a frozen connection holding the option account under an old hash blocks.
    await withOptions(frozen.id, `${tag}-frz`); await conn(frozen.id, [`${tag}-frz`], NEW); await conn(frozen.id, [`${tag}-frz`], CURRENT_CONSENT_HASH, true);
    // Round 5: re-consented on one connection, one option row on an account no connection holds.
    await withOptions(stray.id, `${tag}-str1`); await conn(stray.id, [`${tag}-str1`], NEW);
    await insertOptionActivities(stray.id, 'snaptrade', [opt('lost', `${tag}-str2`, 'BUY', 'BUY_TO_OPEN', '2026-10-01T15:00:00Z')]);
    // Fix round 1 (review 4): re-consented but still owed the option backfill → gated. (QA 12): option rows with no
    // account at all → gated.
    const owed = await mk('owe'), none = await mk('none');
    await withOptions(owed.id, `${tag}-owe`); await conn(owed.id, [`${tag}-owe`], NEW, false, false);
    await insertOptionActivities(none.id, 'snaptrade', [opt('na', null as never, 'SELL', 'SELL_TO_CLOSE', '2026-10-02T15:00:00Z')]);
    await rebuildRecord(none.id);
    const gate = async (id: number) => (await loadOptionRecord(id)).gate;
    assert.equal(await gate(owed.id), 'closed');
    assert.equal(await gate(none.id), 'closed');
    assert.equal(await gate(old.id), 'closed');
    assert.equal(await gate(nul.id), 'closed');
    assert.equal(await gate(re.id), 'open');
    assert.equal(await gate(demo.id), 'open');
    assert.equal(await gate(mixed.id), 'open');
    assert.equal(await gate(frozen.id), 'closed');
    assert.equal(await gate(stray.id), 'closed');
    const closed = await loadOptionRecord(old.id);
    assert.deepEqual(Object.keys(closed).sort(), ['counts', 'gate']); // counts only
    const open = await loadOptionRecord(re.id);
    assert.ok(open.gate === 'open' && open.trades.length === 1 && open.trades[0].underlying === 'XYZ');
    // One batch: each trader its own state.
    const batch = await optionHeadline([old.id, re.id, stray.id, demo.id]);
    assert.deepEqual([old.id, re.id, stray.id, demo.id].map((id) => batch.get(id)!.gate), ['closed', 'open', 'closed', 'open']);
    assert.equal('summary' in batch.get(old.id)!, false);
  } finally {
    PUBLIC_FIELDS.pop();
    (CONSENT_VERSIONS as unknown[]).pop();
    await cleanup();
  }
});

dbTest('AC22: the consent write stores the current scope line\'s hash; the import path stores option rows and positions and rebuilds the record', async () => {
  const { sql, tag, mk, cleanup } = await setup();
  const { startConnection, completeLink, consent, importStep } = await import('./connections.ts');
  const { CURRENT_CONSENT_HASH } = await import('./consent-versions.ts');
  const u = await mk();
  const [{ signup_attempt_id: attempt }] = await sql`select signup_attempt_id from users where id = ${u.id}`;
  const acc = `${tag}-a`;
  const os = { id: 'o', ticker: 'XYZ   261219C00123450', option_type: 'CALL', strike_price: 123.45, expiration_date: '2026-12-19', underlying_symbol: { symbol: 'XYZ', type: { code: 'cs' } } };
  const deps = {
    pageLimit: 10,
    registerUser: async (ref: number | string) => ({ snaptradeUserId: `${tag}-v${ref}`, secretEnc: 'enc' }),
    connectUrl: async () => 'https://vendor.example/portal',
    listAccounts: async () => [{ id: acc, authorizationId: `auth-${acc}`, institution: 'x', isPaper: false, initialSyncCompleted: true }],
    fetchActivitiesPage: async (_u: unknown, _a: string, _o: number, _l?: number, sink?: (rows: unknown[]) => void) => {
      const { toOptionRows } = await import('./broker.ts');
      sink?.(toOptionRows(acc, [
        { id: `${tag}-ob`, type: 'BUY', option_type: 'BUY_TO_OPEN', option_symbol: os, units: 1, price: 2, fee: 0, trade_date: '2026-10-01T15:00:00Z' },
        { id: `${tag}-os`, type: 'SELL', option_type: 'SELL_TO_CLOSE', option_symbol: os, units: 1, price: 3, fee: 0, trade_date: '2026-10-02T15:00:00Z' },
      ] as never));
      return { activities: [], done: true };
    },
    fetchPositions: async (_u: unknown, _a: string, sink?: (s: unknown) => void) => { sink?.({ options: [], short: 1, unsupported: 2 }); return []; },
    deleteConnection: async () => {}, deleteUser: async () => {},
  };
  try {
    await startConnection({ userId: u.id, attemptId: Number(attempt) }, 'https://app.example/connect/done', deps as never);
    const out = await completeLink({ userId: u.id, attemptId: Number(attempt) }, deps as never);
    const id = (out as { id: number }).id;
    await consent(id, new Date(), deps as never);
    const [c] = await sql`select consent_scope_hash from connections where id = ${id}`;
    assert.equal(c.consent_scope_hash, CURRENT_CONSENT_HASH);
    for (let i = 0; i < 6; i++) if ((await importStep(id, deps as never)).state !== 'importing') break;
    assert.equal((await sql`select count(*)::int as n from option_trades where user_id = ${u.id}`)[0].n, 1);
    const [k] = await sql`select open_options_short, open_unsupported from users where id = ${u.id}`;
    assert.deepEqual({ ...k }, { open_options_short: 1, open_unsupported: 2 });
  } finally { await cleanup([acc]); }
});
