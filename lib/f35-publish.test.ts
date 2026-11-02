// F-35 (docs/features/F-35-publish-once-the-date-has-passed.md; plan docs/features/logs/F-35/plan.md): a trade is
// published once its date has passed (executed_at <= the database's now()), never on the 24-hour grace. Rows dated ahead
// are stored, counted on the future line, and published by the first sync tick at or after their date with no new
// activity: the matured-rows pass (lib/sync-shard.ts#maturePass) rebuilds each such record once, under the per-user lock,
// and the watermark (users.published_through) advances only with a committed rebuild.
// Every date here is relative to the database's now(). Time passing is simulated by moving this test's own rows (and its
// watermark) back by the same interval; the database clock is never moved, and no row another test created is touched.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PROFILE } from './copy.ts';

const hasDb = !!process.env.DATABASE_URL;
const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL', timeout: 180_000 }, fn);
before(async () => { if (hasDb) await (await import('./db.ts')).sql.unsafe(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')).simple(); });
after(async () => { if (hasDb) await (await import('./db.ts')).sql.end({ timeout: 1 }); });

const HOUR = 3_600_000, DAY = 24 * HOUR;

async function harness() {
  const { sql } = await import('./db.ts');
  const { createAttempt, createUserForAttempt } = await import('./auth/attempts.ts');
  const S = await import('./sync.ts');
  const O = await import('./options-sync.ts');
  const H = await import('./sync-shard.ts');
  const tag = `f35${Math.random().toString(36).slice(2, 9)}`;
  const users: number[] = [], accounts: string[] = [], ofs: number[] = [];
  const [{ t }] = await sql`select extract(epoch from now()) * 1000 as t`;
  const now = Number(t); // the database clock at the start (rows are dated hours away from it)
  const at = (ms: number) => new Date(now + ms);
  type U = { id: number; handle: string; acc: string; user: { id: number; snaptrade_user_id: string; snaptrade_secret_enc: string } };
  const mk = async (n: string, o: { state?: 'connected' | 'importing'; frozen?: boolean } = {}): Promise<U> => {
    const handle = `${tag}${n}`;
    const u = await createUserForAttempt(await createAttempt({ method: 'dev', attested: true }), { handle });
    users.push(u.id);
    const acc = `${tag}-${n}-a`;
    accounts.push(acc);
    await sql`update users set snaptrade_user_id = ${`${tag}-${n}-v`}, snaptrade_secret_enc = 'enc' where id = ${u.id}`;
    const a = { id: acc, authorizationId: 'a', institution: 'x', isPaper: false, initialSyncCompleted: true };
    await sql`insert into connections (attempt_id, user_id, vendor_authorization_id, state, consent_at, importing_at, connected_at, accounts, options_backfilled_at, disconnected_at)
      select signup_attempt_id, id, 'a', ${o.state ?? 'connected'}, now() - interval '60 days', now() - interval '60 days', now() - interval '60 days', ${sql.json([a])}, now(),
        ${o.frozen ? sql`now() - interval '1 day'` : null}
      from users where id = ${u.id}`;
    return { id: u.id, handle, acc, user: { id: u.id, snaptrade_user_id: `${tag}-${n}-v`, snaptrade_secret_enc: 'enc' } };
  };
  const share = (u: U, id: string, side: 'BUY' | 'SELL', price: number, ms: number, symbol = 'FTF') => ({
    externalId: `${tag}-${id}`, accountId: u.acc, symbol, side, units: 1, price, fee: 0, executedAt: at(ms), verified: true, raw: { t: tag },
  });
  const opt = (u: U, id: string, kind: string, oc: string, price: number, ms: number) => ({
    externalId: `${tag}-${id}`, accountId: u.acc, kind, openClose: oc, underlying: 'FTF', underlyingType: 'cs', right: 'CALL', expiry: new Date(now + 200 * DAY).toISOString().slice(0, 10),
    strikeMilli: 50_000, multiplier: 100, occTicker: null, units: 1, price, fee: 0, amount: null, currency: 'USD', executedAt: at(ms), verified: true, raw: { t: tag },
  });
  // Time passes by `ms` for this record: its rows and its watermark move back together.
  const age = async (u: U, ms: number) => {
    const d = sql`${ms}::float8 * interval '1 millisecond'`;
    await sql`update activities set executed_at = executed_at - ${d}, created_at = created_at - ${d} where user_id = ${u.id}`;
    await sql`update option_activities set executed_at = executed_at - ${d}, created_at = created_at - ${d} where user_id = ${u.id}`;
    await sql`update corporate_actions set executed_at = executed_at - ${d}, created_at = created_at - ${d} where user_id = ${u.id}`;
    await sql`update users set published_through = published_through - ${d} where id = ${u.id}`;
  };
  const closes = async (u: U) => (await sql`select sell_id from closed_trades where user_id = ${u.id} order by sell_id`).map((r) => String(r.sell_id).slice(tag.length + 1));
  const optionCloses = async (u: U) => (await sql`select count(*)::int as n from option_trades where user_id = ${u.id}`)[0].n as number;
  const counts = async (u: U) => (await sql`select excluded_future as future, excluded_future_options as options, excluded_held as held, excluded_positions as positions from users where id = ${u.id}`)[0];
  const mark = async (u: U) => (await sql`select published_through::text as w, last_synced_at::text as s from users where id = ${u.id}`)[0];
  // Shard counts 100..499 are this file's (sync-shard.test 500-1000, cadence/options 1001-1024, 1, 3 and 40 elsewhere).
  const freshOf = () => { const of = 100 + Math.floor(Math.random() * 400); ofs.push(of); return of; };
  // One sync tick for these records: the shard run with the pass on, a worker sync that reads nothing (no rebuild), and
  // the rebuild counted per record.
  const rebuilds = new Map<number, number>();
  const count = async (id: number, tx: Parameters<typeof O.rebuildWithoutRead>[1]) => { rebuilds.set(id, (rebuilds.get(id) ?? 0) + 1); return O.rebuildWithoutRead(id, tx); };
  type Report = Awaited<ReturnType<typeof H.runShard>>;
  const tick = async (us: U[], o: Partial<Parameters<typeof H.runShard>[0]> = {}, of = freshOf()): Promise<Report> => {
    // One run per shard the records fall in (a run reads its own shard only); the counters summed.
    const shards = [...new Set(us.map((u) => u.id % of))];
    let sum: Report | null = null;
    for (const shard of shards) {
      const r = await H.runShard({
        shard: { shard, of }, ids: us.filter((u) => u.id % of === shard).map((u) => u.id), jitterMs: 0, config: { concurrency: 1, rps: 1000, burst: 1000, page: 500 }, log: () => {},
        sync: async () => 0, mature: true, matureRebuild: count, ...o,
      });
      assert.equal(r.busy, false);
      const s0 = sum as Report | null;
      sum = s0 ? { ...s0, matured: s0.matured + r.matured, maturedInitial: s0.maturedInitial + r.maturedInitial, maturedBusy: s0.maturedBusy + r.maturedBusy, maturedFailed: s0.maturedFailed + r.maturedFailed, done: s0.done + r.done } : r;
    }
    return sum!;
  };
  const cleanup = async () => {
    if (users.length) await sql`delete from users where id in ${sql(users)}`;
    if (accounts.length) await sql`delete from broker_accounts where account_id in ${sql(accounts)}`;
    if (ofs.length) await sql`delete from sync_shards where of in ${sql(ofs)}`;
  };
  return { sql, S, O, H, tag, now, at, mk, share, opt, age, closes, optionCloses, counts, mark, tick, rebuilds, freshOf, cleanup };
}

dbTest('AC1–AC3, AC8: a sell dated 12 h ahead is absent and counted; the first tick after its date publishes it with no new activity; two ticks give one rebuild, a third none', async () => {
  const h = await harness();
  try {
    const u = await h.mk('a');
    await h.S.insertActivities(u.id, 'snaptrade', [h.share(u, 'b', 'BUY', 100, -2 * DAY), h.share(u, 's', 'SELL', 90, 12 * HOUR), h.share(u, 'b2', 'BUY', 50, -DAY, 'FAR'), h.share(u, 's2', 'SELL', 60, 2 * DAY, 'FAR')]);
    await h.O.rebuildRecord(u.id);
    // AC1: absent from the record every surface reads, counted on the future line (the +2 d row stays counted, unchanged).
    assert.deepEqual(await h.closes(u), []);
    assert.deepEqual({ ...(await h.counts(u)) }, { future: 2, options: 0, held: 0, positions: 0 });
    const { compareCards } = await import('./record-tools.ts');
    const [card] = await compareCards([{ id: u.id, handle: u.handle, name: 'F35' }]);
    assert.equal(card.closed, 0);
    assert.ok(card.excluded.includes(PROFILE.excludedFuture(2)), JSON.stringify(card.excluded));
    const { profileReads } = await import('../app/u/[handle]/load.ts');
    const reads = profileReads((f) => f);
    assert.equal((await reads.trades(u.id)).length, 0, 'the profile list, chart and stats read no close');
    const w0 = await h.mark(u);
    // A tick before the date: nothing matured, nothing rebuilt.
    let r = await h.tick([u]);
    assert.deepEqual([r.matured, r.maturedInitial, r.maturedFailed], [0, 0, 0]);
    assert.deepEqual(await h.closes(u), []);
    // AC2: 13 h later (the sell is 1 h old), no new activity: the first tick publishes it.
    await h.age(u, 13 * HOUR);
    const synced = (await h.mark(u)).s;
    r = await h.tick([u]);
    assert.equal(r.matured, 1);
    assert.deepEqual(await h.closes(u), ['s']);
    assert.equal((await h.counts(u)).future, 1, 'the +2 d row (now +11 h) still waits');
    assert.equal((await h.mark(u)).s, synced, '"Updated" never claims a vendor read the pass did not make');
    assert.notEqual((await h.mark(u)).w, w0.w, 'the watermark advanced');
    // AC3: the next two ticks rebuild nothing; one rebuild in all.
    for (let i = 0; i < 2; i++) assert.equal((await h.tick([u])).matured, 0);
    assert.equal(h.rebuilds.get(u.id), 1, 'exactly one rebuild across the ticks');
  } finally { await h.cleanup(); }
});

dbTest('AC4: a failed rebuild leaves the watermark and the record as they were; the next tick retries and publishes', async () => {
  const h = await harness();
  try {
    const u = await h.mk('f');
    await h.S.insertActivities(u.id, 'snaptrade', [h.share(u, 'b', 'BUY', 100, -2 * DAY), h.share(u, 's', 'SELL', 80, 2 * HOUR)]);
    await h.O.rebuildRecord(u.id);
    await h.age(u, 3 * HOUR);
    const before = await h.mark(u);
    const r = await h.tick([u], { matureRebuild: async (id, tx) => { await h.O.rebuildWithoutRead(id, tx); throw new Error('boom'); } });
    assert.deepEqual([r.matured, r.maturedFailed], [0, 1]);
    assert.equal((await h.mark(u)).w, before.w, 'the watermark did not move');
    assert.deepEqual(await h.closes(u), [], 'the failed rebuild published nothing');
    assert.equal((await h.tick([u])).matured, 1);
    assert.deepEqual(await h.closes(u), ['s']);
  } finally { await h.cleanup(); }
});

dbTest('a record whose lock another sync holds is left for the next tick (busy), then published', async () => {
  const h = await harness();
  const conn = await h.sql.reserve();
  try {
    const u = await h.mk('l');
    await h.S.insertActivities(u.id, 'snaptrade', [h.share(u, 'b', 'BUY', 100, -2 * DAY), h.share(u, 's', 'SELL', 110, HOUR)]);
    await h.O.rebuildRecord(u.id);
    await h.age(u, 2 * HOUR);
    await conn`select pg_advisory_lock(${h.S.USER_LOCK}, ${u.id})`;
    const r = await h.tick([u]);
    assert.deepEqual([r.matured, r.maturedBusy], [0, 1]);
    assert.deepEqual(await h.closes(u), []);
    await conn`select pg_advisory_unlock(${h.S.USER_LOCK}, ${u.id})`;
    assert.equal((await h.tick([u])).matured, 1);
    assert.deepEqual(await h.closes(u), ['s']);
  } finally { conn.release(); await h.cleanup(); }
});

dbTest('scope: a frozen record publishes (a loss counted in win rate and average, its status and "Updated" unchanged); deleted, importing and other-shard records are skipped', async () => {
  const h = await harness();
  try {
    const frozen = await h.mk('z', { frozen: true }), gone = await h.mk('d'), importing = await h.mk('i', { state: 'importing' }), other = await h.mk('o');
    for (const u of [frozen, gone, importing, other]) {
      await h.S.insertActivities(u.id, 'snaptrade', [h.share(u, `${u.id}b`, 'BUY', 100, -2 * DAY), h.share(u, `${u.id}s`, 'SELL', 70, HOUR)]);
      await h.O.rebuildRecord(u.id);
      await h.age(u, 2 * HOUR);
    }
    await h.sql`update users set deleted_at = now() where id = ${gone.id}`;
    const { publicRecordDetail } = await import('./connections.ts');
    const state = (await publicRecordDetail(frozen.id)).public.state;
    const synced = (await h.mark(frozen)).s;
    const read = (await h.sql`select activities_read_at::text as r from broker_accounts where user_id = ${frozen.id}`).map((x) => x.r);
    const r = await h.tick([frozen, gone, importing]);
    assert.equal(r.matured, 1, 'only the frozen record');
    assert.deepEqual(await h.closes(frozen), [`${frozen.id}s`]);
    const [t] = await h.sql`select return_pct from closed_trades where user_id = ${frozen.id}`;
    assert.ok(Number(t.return_pct) < 0, 'the matured loss is published');
    const { stats } = await import('./trades.ts');
    const s = stats([{ returnPct: Number(t.return_pct), holdingDays: 2, closedAt: new Date() }]);
    assert.deepEqual([s.winRate, s.avgReturn < 0], [0, true], 'and counts in win rate and average return');
    assert.equal((await publicRecordDetail(frozen.id)).public.state, state, 'the frozen status is unchanged');
    assert.equal((await h.mark(frozen)).s, synced);
    assert.deepEqual((await h.sql`select activities_read_at::text as r from broker_accounts where user_id = ${frozen.id}`).map((x) => x.r), read);
    for (const u of [gone, importing]) assert.deepEqual(await h.closes(u), [], 'deleted and importing records are skipped');
    // A record outside the run's shard is never rebuilt by it.
    const of = h.freshOf();
    const r2 = await h.H.runShard({ shard: { shard: (other.id + 1) % of, of }, ids: [other.id], jitterMs: 0, config: { concurrency: 1, rps: 1000, burst: 1000, page: 500 }, log: () => {}, sync: async () => 0, mature: true });
    assert.equal(r2.matured, 0);
    assert.deepEqual(await h.closes(other), []);
  } finally { await h.cleanup(); }
});

dbTest('F-21: a maturing future BUY moves only the future line; F-24: a held sell dated ahead is counted once, before and after it matures', async () => {
  const h = await harness();
  try {
    const u = await h.mk('h');
    await h.S.insertActivities(u.id, 'snaptrade', [h.share(u, 'b', 'BUY', 100, 3 * HOUR)]);
    await h.O.rebuildRecord(u.id);
    assert.deepEqual([(await h.counts(u)).future, (await h.counts(u)).positions], [1, 0]);
    await h.age(u, 4 * HOUR);
    await h.tick([u]);
    assert.deepEqual([(await h.counts(u)).future, (await h.counts(u)).positions, (await h.counts(u)).held], [0, 0, 0], 'a matured buy opens a lot; no other count moves');
    // A held possible re-issue dated ahead: on the future line only, then on the held line only.
    const v = await h.mk('v');
    await h.S.insertActivities(v.id, 'snaptrade', [h.share(v, 'vb', 'BUY', 100, -3 * DAY), h.share(v, 've', 'SELL', 110, -DAY), h.share(v, 'vn', 'SELL', 110, 2 * HOUR)]);
    await h.sql`insert into activity_reissues (user_id, source, external_id, account_id, original_id, state) values (${v.id}, 'snaptrade', ${`${h.tag}-vn`}, ${v.acc}, ${`${h.tag}-ve`}, 'pending')`;
    await h.O.rebuildRecord(v.id);
    const c0 = await h.counts(v);
    assert.deepEqual([c0.future, c0.held], [1, 0]);
    await h.age(v, 3 * HOUR);
    await h.tick([v]);
    const c1 = await h.counts(v);
    assert.deepEqual([c1.future, c1.held], [0, 1], 'never on both lines');
  } finally { await h.cleanup(); }
});

dbTest('options: an option close dated ahead is absent and counted, then published by the pass', async () => {
  const h = await harness();
  try {
    const u = await h.mk('p');
    await h.O.insertOptionActivities(u.id, 'snaptrade', [h.opt(u, 'ob', 'BUY', 'BUY_TO_OPEN', 2, -3 * DAY), h.opt(u, 'os', 'SELL', 'SELL_TO_CLOSE', 3, 5 * HOUR)]);
    await h.O.rebuildRecord(u.id);
    assert.equal(await h.optionCloses(u), 0);
    assert.equal((await h.counts(u)).options, 1);
    const { compareCards } = await import('./record-tools.ts');
    assert.ok((await compareCards([{ id: u.id, handle: u.handle, name: 'F35' }]))[0].excluded.includes(PROFILE.excludedFuture(1)), 'the line shows shares + options');
    await h.age(u, 6 * HOUR);
    assert.equal((await h.tick([u])).matured, 1);
    assert.equal(await h.optionCloses(u), 1);
    assert.equal((await h.counts(u)).options, 0);
  } finally { await h.cleanup(); }
});

dbTest('a corporate action dated ahead is not applied until its date; the pass picks its record up when it matures', async () => {
  const h = await harness();
  try {
    const u = await h.mk('c');
    await h.S.insertActivities(u.id, 'snaptrade', [h.share(u, 'b', 'BUY', 100, -3 * DAY), h.share(u, 's', 'SELL', 110, -DAY)]);
    await h.O.rebuildRecord(u.id);
    const { insertCorporateActions, loadCorporateActions } = await import('./corporate-actions.ts');
    await insertCorporateActions(h.sql, u.id, 'snaptrade', [{ externalId: `${h.tag}-ca`, accountId: u.acc, symbol: 'FTF', kind: 'split', units: 1, executedAt: h.at(3 * HOUR), raw: { t: h.tag } } as never]);
    const published = h.sql`executed_at <= now()`;
    assert.equal((await loadCorporateActions(h.sql, u.id, published)).length, 0);
    assert.equal((await h.tick([u])).matured, 0);
    await h.age(u, 4 * HOUR);
    assert.equal((await h.tick([u])).matured, 1, 'a matured corporate action rebuilds its record');
    assert.equal((await loadCorporateActions(h.sql, u.id, published)).length, 1);
  } finally { await h.cleanup(); }
});

dbTest('deploy catch-up: a record with no watermark that shows an early close is rebuilt once (maturedInitial), shares or options only; its thesis is kept and returns; a null-watermark record with nothing ahead is never selected', async () => {
  const h = await harness();
  try {
    const u = await h.mk('n'), p = await h.mk('q'), idle = await h.mk('x');
    await h.S.insertActivities(u.id, 'snaptrade', [h.share(u, 'b', 'BUY', 100, -2 * DAY), h.share(u, 's', 'SELL', 120, 12 * HOUR)]);
    await h.O.insertOptionActivities(p.id, 'snaptrade', [h.opt(p, 'pb', 'BUY', 'BUY_TO_OPEN', 2, -3 * DAY), h.opt(p, 'ps', 'SELL', 'SELL_TO_CLOSE', 3, 12 * HOUR)]);
    await h.S.insertActivities(idle.id, 'snaptrade', [h.share(idle, 'ib', 'BUY', 100, -2 * DAY), h.share(idle, 'is', 'SELL', 120, -DAY)]);
    // The state before F-35: closes published on the 24 h grace, a thesis on the share close, no watermark.
    await h.sql`insert into closed_trades (user_id, sell_id, account_id, symbol, opened_at, closed_at, return_pct, holding_days, verified, thesis, thesis_status, thesis_written_at)
      values (${u.id}, ${`${h.tag}-s`}, ${u.acc}, 'FTF', ${h.at(-2 * DAY)}, ${h.at(12 * HOUR)}, 0.2, 2.5, true, 'Why I sold.', 'published', now())`;
    await h.sql`insert into option_trades (user_id, close_id, account_id, verified, underlying, option_right, option_expiry, opened_at, closed_at, return_pct, holding_days)
      values (${p.id}, ${`${h.tag}-ps`}, ${p.acc}, true, 'FTF', 'CALL', ${new Date(h.now + 200 * DAY).toISOString().slice(0, 10)}, ${h.at(-3 * DAY)}, ${h.at(12 * HOUR)}, 0.5, 3.5)`;
    await h.sql`update users set published_through = null where id in ${h.sql([u.id, p.id, idle.id])}`;
    const r = await h.tick([u, p, idle]);
    assert.deepEqual([r.maturedInitial, r.matured], [2, 0]);
    assert.deepEqual(await h.closes(u), [], 'the early share close is gone');
    assert.equal(await h.optionCloses(p), 0, 'the early option close is gone');
    assert.equal((await h.counts(p)).options, 1, 'and counted');
    for (const x of [u, p]) assert.notEqual((await h.mark(x)).w, null, 'the watermark is set');
    assert.equal((await h.mark(idle)).w, null, 'a record with nothing ahead is never selected');
    assert.equal(h.rebuilds.get(idle.id), undefined);
    const [k] = await h.sql`select thesis from kept_theses where user_id = ${u.id} and sell_id = ${`${h.tag}-s`}`;
    assert.equal(k?.thesis, 'Why I sold.', 'the thesis is kept aside');
    const r2 = await h.tick([u, p, idle]);
    assert.deepEqual([r2.maturedInitial, r2.matured], [0, 0], 'never selected twice');
    await h.age(u, 13 * HOUR);
    await h.tick([u]);
    const [back] = await h.sql`select thesis, thesis_status from closed_trades where user_id = ${u.id}`;
    assert.deepEqual([back?.thesis, back?.thesis_status], ['Why I sold.', 'published'], 'the thesis returns unchanged with its close');
  } finally { await h.cleanup(); }
});

dbTest('insert side: a row stored dated ahead by a transaction whose clock predates a later rebuild lowers the watermark, so the pass still finds it (one rebuild); a null watermark stays null', async () => {
  const h = await harness();
  const conn = await h.sql.reserve();
  try {
    const u = await h.mk('w');
    await h.S.insertActivities(u.id, 'snaptrade', [h.share(u, 'b', 'BUY', 100, -2 * DAY)]);
    await h.O.rebuildRecord(u.id);
    // Transaction A starts (its now() = tA), then a rebuild commits a watermark W > tA, then A stores a sell dated in
    // (tA, W] and commits without rebuilding (an import step after the first).
    await conn`begin`;
    const [{ ta }] = await conn`select now()::text as ta`;
    await h.sql`select pg_sleep(0.3)`;
    await h.O.rebuildRecord(u.id);
    const w = (await h.mark(u)).w;
    assert.ok(new Date(w) > new Date(ta));
    await h.S.insertActivities(u.id, 'snaptrade', [{ ...h.share(u, 's', 'SELL', 90, 0), executedAt: new Date(new Date(ta).getTime() + 100) }], conn as never);
    await conn`commit`;
    assert.equal((await h.sql`select published_through = ${ta}::text::timestamptz as same from users where id = ${u.id}`)[0].same, true, 'lowered to the inserting transaction\'s clock');
    await h.age(u, HOUR);
    const r1 = await h.tick([u]), r2 = await h.tick([u]);
    assert.deepEqual([r1.matured, r2.matured], [1, 0]);
    assert.equal(h.rebuilds.get(u.id), 1, 'exactly one rebuild');
    assert.deepEqual(await h.closes(u), ['s']);
    // A null watermark is never filled by an insert: the record stays visible to the deploy catch-up.
    const n = await h.mk('m');
    await h.sql`update users set published_through = null where id = ${n.id}`;
    await h.S.insertActivities(n.id, 'snaptrade', [h.share(n, 'nb', 'BUY', 100, 2 * HOUR)]);
    assert.equal((await h.mark(n)).w, null);
    assert.equal((await h.tick([n])).maturedInitial, 1);
  } finally { conn.release(); await h.cleanup(); }
});

dbTest('the watermark is the rebuild\'s own publish clock (the transaction\'s now())', async () => {
  const h = await harness();
  try {
    const u = await h.mk('k');
    await h.sql.begin(async (tx) => {
      await h.O.rebuildRecord(u.id, tx);
      const [{ same }] = await tx`select published_through = now() as same from users where id = ${u.id}`;
      assert.equal(same, true);
    });
  } finally { await h.cleanup(); }
});

dbTest('budget: the pass never starves the workers: with 50 matured records and a slow rebuild it stops at its time box and the workers still sync that tick', async () => {
  const h = await harness();
  try {
    // Shard 0 of 2 is this test's own (no other test file runs of = 2): about 50 of 100 records fall in it.
    const all = [];
    for (let i = 0; i < 100; i++) all.push(await h.mk(`g${i}`));
    const us = all.filter((u) => u.id % 2 === 0).slice(0, 50);
    for (const [i, u] of us.entries()) await h.S.insertActivities(u.id, 'snaptrade', [h.share(u, `g${i}b`, 'BUY', 100, -2 * DAY), h.share(u, `g${i}s`, 'SELL', 101, HOUR)]);
    await h.sql`update users set published_through = now() where id in ${h.sql(us.map((u) => u.id))}`;
    for (const u of us) await h.age(u, 2 * HOUR);
    let synced = 0;
    const r = await h.H.runShard({
      shard: { shard: 0, of: 2 }, ids: us.map((u) => u.id), jitterMs: 0, config: { concurrency: 2, rps: 1000, burst: 1000, page: 500 }, log: () => {},
      sync: async () => { synced++; return 0; }, mature: true, maturedBoxMs: 300,
      matureRebuild: async (id, tx) => { await new Promise((res) => setTimeout(res, 40)); return h.O.rebuildWithoutRead(id, tx); },
    });
    assert.equal(r.busy, false);
    assert.ok(us.length >= 30, `enough records in the shard (${us.length})`);
    assert.ok(r.matured >= 1 && r.matured < us.length, `the time box stopped the pass (matured ${r.matured} of ${us.length})`);
    assert.ok(synced > 0 && r.done > 0, 'the workers still synced traders');
    await h.sql`delete from sync_shards where of = 2`;
  } finally { await h.cleanup(); }
});

dbTest('AC7: the matured-rows query reads the partial indexes (both branches), never a sequential scan of the raw tables', async () => {
  const h = await harness();
  try {
    const plan = await h.sql.begin(async (tx) => {
      await tx`set local enable_seqscan = off`;
      const [{ 'QUERY PLAN': p }] = await tx`explain (format json) ${h.H.maturedQuery({ shard: 0, of: 1 }, {}, 50)}`;
      return JSON.stringify(p);
    });
    const nodes: { 'Node Type': string; 'Relation Name'?: string; 'Index Name'?: string }[] = [];
    const walk = (n: Record<string, unknown>) => { nodes.push(n as never); for (const c of (n.Plans as Record<string, unknown>[] | undefined) ?? []) walk(c); };
    walk(JSON.parse(plan)[0].Plan);
    for (const idx of ['activities_future_stored', 'option_activities_future_stored', 'corporate_actions_future_stored']) {
      assert.ok(nodes.filter((n) => n['Index Name'] === idx).length >= 2, `${idx} drives both branches`);
    }
    for (const t of ['activities', 'option_activities', 'corporate_actions']) assert.ok(!nodes.some((n) => n['Node Type'] === 'Seq Scan' && n['Relation Name'] === t), `no seq scan on ${t}`);
  } finally { await h.cleanup(); }
});

dbTest('AC5 (server zone): under TZ=Pacific/Kiritimati the month page\'s data holds "Trades close through today": the waiting close is absent and every shown close is at or before the database now()', async () => {
  const h = await harness();
  const zone = process.env.TZ;
  try {
    process.env.TZ = 'Pacific/Kiritimati'; // UTC+14: the server's local date is a day ahead of UTC for part of each day
    const u = await h.mk('t');
    await h.S.insertActivities(u.id, 'snaptrade', [h.share(u, 'b', 'BUY', 100, -3 * DAY), h.share(u, 'p', 'SELL', 110, -HOUR, 'FTF'),
      h.share(u, 'b2', 'BUY', 100, -3 * DAY, 'FWT'), h.share(u, 'w', 'SELL', 90, 2 * HOUR, 'FWT')]);
    await h.O.rebuildRecord(u.id);
    const ym = new Date(h.now - HOUR).toISOString().slice(0, 7); // the UTC month of the shown close (parseYm's bounds)
    const { loadRecap } = await import('./recap-load.ts');
    const r = await loadRecap(u.handle, ym);
    assert.ok(r, 'the month page renders');
    assert.deepEqual(r.recap.trades.map((t) => t.symbol), ['FTF'], 'the close dated ahead is absent');
    const [{ t }] = await h.sql`select extract(epoch from now()) * 1000 as t`;
    for (const x of r.recap.trades) assert.ok(x.closedAt.getTime() <= Number(t), 'no close after now()');
    assert.equal(r.recap.monthSoFar, new Date(h.now).toISOString().slice(0, 7) === ym);
  } finally { if (zone === undefined) delete process.env.TZ; else process.env.TZ = zone; await h.cleanup(); }
});

test('the future line says plainly that a waiting row stays on it until its date passes (no promise of publication)', () => {
  assert.equal(PROFILE.futureWaiting(1), '1 imported trade excluded: dated in the future by the broker. It waits on this line until that date passes.');
  assert.equal(PROFILE.futureWaiting(1_200), '1,200 imported trades excluded: dated in the future by the broker. They wait on this line until their dates pass.');
  for (const n of [1, 2]) assert.ok(PROFILE.futureWaiting(n).startsWith(PROFILE.excludedFuture(n)), 'the pinned first sentence is kept');
  for (const n of [1, 2, 9]) assert.ok(!/\b(will|guarantee|every|all|always)\b/i.test(PROFILE.futureWaiting(n)), 'no promise, no completeness word');
});

test('docs and code: the 24 h grace no longer publishes; FUTURE_GRACE_HOURS bounds the re-read window only', () => {
  const src = readFileSync(new URL('./sync.ts', import.meta.url), 'utf8');
  const pages = src.split('export async function rebuildTrades')[1].split('type TradeRead')[0];
  assert.ok(!/\$\{notFuture\(tx\)\}/.test(pages), 'the rebuild reads published rows only');
  const opt = readFileSync(new URL('./options-sync.ts', import.meta.url), 'utf8');
  assert.ok(!/and \$\{notFuture\(tx\)\}/.test(opt), 'the option rebuild reads published rows only');
});
