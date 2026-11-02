// Fixes cycle 5 (docs/features/logs/fixes-cycle5/plan-round2.md):
// F5-17 (C5-15): the deploy rebuild logs why records failed, as a count per error class only (no id, no handle), and a
//   failing record never stops the others.
// F5-18 (C5-16): the cron's pending deletions are bounded: at most 5 a call, each started only with a vendor timeout
//   left before the deadline, never waited on past it, a failure backs off and goes later in line, none is dropped.
//   A fake clock drives every deadline (no wall-clock bounds).
// Every test creates its own users (unique tag) and deletes exactly what it created.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const hasDb = !!process.env.DATABASE_URL;
const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL', timeout: 120_000 }, fn);
before(async () => { if (hasDb) await (await import('./db.ts')).sql.unsafe(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')).simple(); });
after(async () => { if (hasDb) await (await import('./db.ts')).sql.end({ timeout: 1 }); });

async function setup(prefix: string) {
  const { sql } = await import('./db.ts');
  const tag = `${prefix}${Math.random().toString(36).slice(2, 8)}`;
  const users: number[] = [], attempts: number[] = [], handles: string[] = [];
  const mk = async (i: number) => {
    const handle = `${tag}${i}`;
    const [a] = await sql`insert into signup_attempts (method, adult_attested_at) values ('dev', now()) returning id`;
    const [u] = await sql`insert into users (handle, display_name, adult_attested_at, signup_attempt_id) values (${handle}, ${handle}, now(), ${a.id}) returning id`;
    users.push(u.id as number); attempts.push(a.id as number); handles.push(handle);
    return { id: u.id as number, handle };
  };
  const cleanup = async () => {
    if (users.length) await sql`delete from users where id in ${sql(users)}`;
    if (handles.length) await sql`delete from handle_reservations where handle in ${sql(handles)}`;
    if (attempts.length) await sql`delete from signup_attempts where id in ${sql(attempts)}`;
  };
  return { sql, tag, mk, users, cleanup };
}

const capture = async <T>(fn: () => Promise<T>): Promise<{ out: T; lines: string[] }> => {
  const lines: string[] = [];
  const orig = console.error;
  console.error = (...a: unknown[]) => { lines.push(a.map(String).join(' ')); };
  try { return { out: await fn(), lines }; } finally { console.error = orig; }
};

dbTest('F5-17: one record that throws lets the others be rebuilt and marked; the log counts its error class and names no record', async () => {
  const t = await setup('fc5wp2r');
  const { rebuildAllForMatcher } = await import('./matcher-rebuild.ts');
  const { rebuildRecord } = await import('./options-sync.ts');
  const version = 9000 + Math.floor(Math.random() * 900);
  try {
    const us = [await t.mk(0), await t.mk(1), await t.mk(2)];
    for (const u of us) {
      await t.sql`insert into activities (user_id, source, external_id, account_id, symbol, side, units, price, executed_at, raw)
        values (${u.id}, 'snaptrade', ${`${t.tag}-${u.id}`}, ${`${t.tag}-acc`}, 'FAKE', 'BUY', 1, 10, now() - interval '2 days', '{}')`;
    }
    const bad = us[1].id;
    const rebuild: typeof rebuildRecord = async (id, tx) => {
      if (id === bad) throw new TypeError(`fixture failure for ${us[1].handle}`);
      return rebuildRecord(id, tx);
    };
    const { out, lines } = await capture(() => rebuildAllForMatcher(version, us.map((u) => u.id), 600_000, rebuild));
    assert.deepEqual(out, { rebuilt: 2, failed: 1, left: 1 });
    const marked = await t.sql`select user_id from matcher_rebuilt where user_id in ${t.sql(us.map((u) => u.id))} and version = ${version} order by user_id`;
    assert.deepEqual(marked.map((r) => r.user_id), [us[0].id, us[2].id]);
    const line = lines.find((l) => l.startsWith('matcher rebuild:'));
    assert.ok(line, lines.join('\n'));
    assert.match(line, /\{"count":1,"byClass":\{"TypeError":1\}\}/);
    for (const u of us) {
      assert.ok(!line.includes(u.handle), 'no handle');
      assert.doesNotMatch(line, new RegExp(`\\b${u.id}\\b`), 'no id');
    }
    assert.ok(!line.includes('fixture failure'), 'no error message');
  } finally { await t.cleanup(); }
});

// A fake clock: `now` is a number the test moves; a timer resolves once the test (or a fake step) advances to it.
function fakeClock(t0: number) {
  const c = {
    t: t0,
    timers: [] as { at: number; fire: () => void }[],
    now: () => c.t,
    timer: (ms: number) => {
      let fire!: () => void;
      const done = new Promise<void>((r) => { fire = r; });
      const entry = { at: c.t + ms, fire };
      c.timers.push(entry);
      return { done, clear: () => { c.timers = c.timers.filter((x) => x !== entry); } };
    },
    // Moves the clock forward, firing every timer due by then.
    advance: (ms: number) => { c.t += ms; for (const x of c.timers.filter((y) => y.at <= c.t)) x.fire(); },
  };
  return c;
}

dbTest('F5-18: 20 hanging deletions: at most 5 start, the call stops at the deadline, and the stages after it still run', async () => {
  const t = await setup('fc5wp2h');
  const { pendingDeletions, deletionSteps, DELETIONS_PER_CALL } = await import('./delete.ts');
  const { VENDOR_TIMEOUT_MS } = await import('./broker.ts');
  const { syncAll } = await import('./sync.ts');
  try {
    for (let i = 0; i < 20; i++) await t.mk(i);
    await t.sql`update users set deleted_at = now() where id in ${t.sql(t.users)}`;
    const t0 = Date.UTC(2030, 0, 1);
    const at = new Date(t0);
    assert.equal(DELETIONS_PER_CALL, 5);

    // (a) Truly hanging (never settles): the first try starts and is cut when the clock reaches the deadline.
    const c = fakeClock(t0);
    const deadline = t0 + 10 * VENDOR_TIMEOUT_MS;
    let started = 0;
    const steps = deletionSteps(deadline, { clock: c, del: () => { started++; queueMicrotask(() => c.advance(deadline - c.now())); return new Promise<void>(() => {}); } });
    const pending = await pendingDeletions(at, t.users);
    assert.equal(pending.length, 5, 'capped at 5 a call');
    const { out: r } = await capture(() => syncAll(pending, steps.run));
    assert.equal(started, 1);
    assert.ok(started <= 5);
    assert.equal(c.now(), deadline, 'the call returned at the deadline, not later');
    assert.deepEqual(steps.report, { started: 1, deferred: 4, stoppedAtDeadline: true });
    assert.equal(r.failed.length, 1);
    // The stages after it: the route awaits the deletions, then the discovery purge, then the shard run (its source).
    const route = readFileSync(new URL('../app/api/sync/route.ts', import.meta.url), 'utf8');
    const ix = (s: string) => route.indexOf(s);
    assert.ok(ix('deletionSteps(deadline)') > 0 && ix('deletionSteps(deadline)') < ix('syncAll(pendingDeletes, steps.run)'));
    assert.ok(ix('syncAll(pendingDeletes, steps.run)') < ix('purgeDiscovery()') && ix('purgeDiscovery()') < ix('privacyStages(PRIVACY_SLOT_MS)') && ix('privacyStages(PRIVACY_SLOT_MS)') < ix('await runShard('));

    // (b) Each try takes a whole vendor timeout of the fake clock and fails: exactly 5 start with time to spare, and
    // with less time, a try starts only while a vendor timeout is left before the deadline.
    for (const [span, want] of [[20, 5], [3.5, 3], [1, 0]] as const) {
      await t.sql`update users set deletion_attempts = 0, deletion_next_at = null where id in ${t.sql(t.users)}`;
      const k = fakeClock(t0);
      let n = 0;
      const s = deletionSteps(t0 + span * VENDOR_TIMEOUT_MS, { clock: k, del: async () => { n++; k.advance(VENDOR_TIMEOUT_MS); throw new Error('vendor timeout'); } });
      const due = await pendingDeletions(at, t.users);
      await capture(() => syncAll(due, s.run));
      assert.equal(n, want, `span ${span}`);
      assert.ok(k.now() <= t0 + span * VENDOR_TIMEOUT_MS, 'no try ran past the deadline');
      const [{ backed }] = await t.sql`select count(*)::int as backed from users where id in ${t.sql(t.users)} and deletion_attempts = 1`;
      assert.equal(backed, want, 'every started try that failed backed off; the rest are untouched');
    }
    const [{ left }] = await t.sql`select count(*)::int as left from users where id in ${t.sql(t.users)} and deleted_at is not null`;
    assert.equal(left, 20, 'none dropped');
  } finally { await t.cleanup(); }
});

dbTest('F5-18: a failed deletion goes later in line (backoff 1, 2, 4 minutes … at most 24 h); all 20 finish over successive calls', async () => {
  const t = await setup('fc5wp2f');
  const { pendingDeletions, deletionSteps, deleteProfile } = await import('./delete.ts');
  const { syncAll } = await import('./sync.ts');
  try {
    for (let i = 0; i < 20; i++) await t.mk(i);
    await t.sql`update users set deleted_at = now() where id in ${t.sql(t.users)}`;
    const t0 = Date.UTC(2030, 0, 1);
    const first = t.users[0];
    // The first in line fails once.
    const c = fakeClock(t0);
    let calls = 0;
    const s = deletionSteps(t0 + 300_000, { clock: c, del: async (u) => { calls++; if (u.id === first) throw new Error('vendor 500'); await deleteProfile(u, { deleteVendorUser: async () => {}, endBilling: async () => {} }); } });
    const p1 = await pendingDeletions(new Date(t0), t.users);
    assert.equal(p1[0].id, first);
    await capture(() => syncAll(p1, s.run));
    assert.equal(calls, 5);
    const [row] = await t.sql`select deletion_attempts, deletion_next_at from users where id = ${first}`;
    assert.equal(row.deletion_attempts, 1);
    assert.equal((row.deletion_next_at as Date).getTime(), t0 + 60_000, 'one minute after the failed try');
    // Not due yet: it is skipped; once due, it comes after every untried deletion.
    assert.ok(!(await pendingDeletions(new Date(t0 + 30_000), t.users)).some((u) => u.id === first));
    const later = await pendingDeletions(new Date(t0 + 60_000), t.users);
    assert.ok(!later.slice(0, 5).some((u) => u.id === first), 'untried ones first');
    // Backoff doubles and is capped at 24 h.
    const k = fakeClock(t0);
    for (let i = 0; i < 14; i++) {
      await deletionSteps(t0 + 300_000, { clock: k, del: async () => { throw new Error('vendor 500'); } }).run({ id: first, handle: '', snaptrade_user_id: null, snaptrade_secret_enc: null }).catch(() => {});
    }
    const [capped] = await t.sql`select deletion_attempts, deletion_next_at from users where id = ${first}`;
    assert.equal(capped.deletion_attempts, 15);
    assert.equal((capped.deletion_next_at as Date).getTime(), t0 + 24 * 3_600_000);
    // Successive calls (the clock a day apart) finish every deletion, at most 5 a call.
    let rounds = 0;
    for (let now = t0 + 25 * 3_600_000; rounds < 10; now += 25 * 3_600_000) {
      const due = await pendingDeletions(new Date(now), t.users);
      if (!due.length) break;
      assert.ok(due.length <= 5);
      const r = await syncAll(due, deletionSteps(now + 300_000, { clock: fakeClock(now), del: (u) => deleteProfile(u, { deleteVendorUser: async () => {}, endBilling: async () => {} }) }).run);
      assert.equal(r.failed.length, 0);
      rounds++;
    }
    assert.equal(rounds, 4, '16 left after the first call: 4 more calls of up to 5');
    const [{ n }] = await t.sql`select count(*)::int as n from users where id in ${t.sql(t.users)}`;
    assert.equal(n, 0, 'all 20 finished');
  } finally { await t.cleanup(); }
});
