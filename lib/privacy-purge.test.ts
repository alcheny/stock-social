// Privacy work (2026-11-01, committee D10–D13): the purges on the tick (lib/privacy-purge.ts). Dated steps run at a
// past `now` so rows of tests running at the same time are untouched; the orphan step runs at the real time.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const hasDb = !!process.env.DATABASE_URL;
const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL' }, fn);
before(async () => { if (hasDb) await (await import('./privacy-test-schema.ts')).applySchemaForTests(); });
after(async () => { if (hasDb) await (await import('./db.ts')).sql.end({ timeout: 1 }); });

const NOW = new Date('2001-06-01T00:00:00Z');
const at = (iso: string) => new Date(`2001-${iso}T00:00:00Z`);
const DAY = 86_400_000;
// The orphan step runs at the real time over every viewer, so it can meet a users row another test file deletes at that
// moment (23503 on the mark's foreign key). The tick tolerates that (caught, resumed next tick); the test retries it.
async function orphansPass(opts: Record<string, unknown> = {}) {
  const { purgePrivacy } = await import('./privacy-purge.ts');
  for (let i = 1; ; i++) {
    try { return await purgePrivacy({ only: ['orphans'], ...opts }); } catch (e) { if ((e as { code?: string }).code !== '23503' || i >= 5) throw e; }
  }
}

// A call that ran: another caller (another test file's purge) may hold the lock for a moment; past a minute the test
// fails with that reason instead of hanging.
async function ranPass(opts: Record<string, unknown> = {}) {
  for (let i = 0; ; i++) {
    const r = await orphansPass(opts);
    if (r.ran) return r;
    if (i >= 600) throw new Error('another caller held the purge lock for over 60 s');
    await new Promise((x) => setTimeout(x, 100));
  }
}
// Calls until each cursor step has counted `need` more full laps (a lap is the whole hash space since its last wrap; on a
// shared database one call may not finish one). Two laps guarantee one that began after the caller's rows were written.
async function lapPass(need: number, opts: Record<string, unknown> = {}, steps = ['clear', 'mark-like', 'mark-reject']) {
  const base = await Promise.all(steps.map(lapsOf));
  for (let calls = 1; ; calls++) {
    const r = await ranPass(opts);
    const laps = await Promise.all(steps.map(lapsOf));
    if (laps.every((l, i) => l >= base[i] + need)) return r;
    assert.ok(calls < 40, `no ${need} full lap(s) of ${steps.join(', ')} within 40 calls`);
  }
}

async function person(tag: string) {
  const { createAttempt, createUserForAttempt } = await import('./auth/attempts.ts');
  return (await createUserForAttempt(await createAttempt({ method: 'dev', attested: true }), { handle: `${tag}${Math.random().toString(36).slice(2, 7)}` })).id;
}
async function attempt(created: Date) {
  const { sql } = await import('./db.ts');
  const [a] = await sql`insert into signup_attempts (method, adult_attested_at, created_at) values ('email', ${created}, ${created}) returning id`;
  await sql`insert into funnel_events (attempt_id, name, at) values (${a.id}, 'landed', ${created}), (${a.id}, 'attested', ${created})`;
  return Number(a.id);
}
const link = async (attemptId: number, expires: Date, used: Date | null = null) => {
  const { sql } = await import('./db.ts');
  const hash = `pp${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
  await sql`insert into login_links (token_hash, email, attempt_id, expires_at, used_at) values (${hash}, ${used ? '' : 'someone@example.test'}, ${attemptId}, ${expires}, ${used})`;
  return hash;
};

dbTest('expired sessions go; live ones stay', async () => {
  const { sql } = await import('./db.ts');
  const { purgePrivacy } = await import('./privacy-purge.ts');
  const u = await person('pps');
  try {
    await sql`insert into sessions (token_hash, user_id, created_at, expires_at) values (${`pp-old-${u}`}, ${u}, ${at('04-01')}, ${at('05-01')}), (${`pp-live-${u}`}, ${u}, ${at('05-15')}, ${at('07-01')})`;
    const r = await purgePrivacy({ now: NOW, only: ['sessions'] });
    assert.equal(r.ran, true);
    assert.equal(r.done, true);
    assert.ok(r.sessions >= 1);
    const left = await sql`select token_hash from sessions where user_id = ${u} order by token_hash`;
    assert.deepEqual(left.map((x) => x.token_hash), [`pp-live-${u}`]);
  } finally {
    await sql`delete from users where id = ${u}`;
  }
});

dbTest('unused sign-in links go when expired or when their attempt finished; a used link and a live one on an open attempt stay', async () => {
  const { sql } = await import('./db.ts');
  const { purgePrivacy } = await import('./privacy-purge.ts');
  const open = await attempt(at('05-30'));
  const done = await attempt(at('05-30'));
  const u = await person('ppl');
  await sql`update signup_attempts set user_id = ${u}, completed_at = ${at('05-31')} where id = ${done}`;
  const expired = await link(open, at('05-31'));
  const live = await link(open, at('07-01'));
  const unusedOnDone = await link(done, at('07-01'));
  const usedOnDone = await link(done, at('07-01'), at('05-31'));
  try {
    await purgePrivacy({ now: NOW, only: ['links'] });
    const left = (await sql`select token_hash from login_links where attempt_id in (${open}, ${done})`).map((x) => x.token_hash).sort();
    assert.deepEqual(left, [live, usedOnDone].sort());
    assert.ok(![expired, unusedOnDone].some((h) => left.includes(h)));
  } finally {
    await sql`delete from login_links where attempt_id in (${open}, ${done})`;
    await sql`delete from users where id = ${u}`;
  }
});

dbTest('unfinished sign-ups older than 30 days go with their funnel steps, links and signed-out connections; younger, vendor-held, user-referenced or live ones stay', async () => {
  const { sql } = await import('./db.ts');
  const { purgePrivacy } = await import('./privacy-purge.ts');
  const old = await attempt(at('04-01'));
  const young = await attempt(at('05-20'));
  const vendorHeld = await attempt(at('04-01'));
  await sql`update signup_attempts set snaptrade_user_id = ${`pp-vendor-${vendorHeld}`} where id = ${vendorHeld}`;
  const liveConn = await attempt(at('04-01'));
  const referenced = await attempt(at('04-01'));
  const u = await person('ppa');
  const [{ signup_attempt_id: own }] = await sql`select signup_attempt_id from users where id = ${u}`;
  await sql`update users set signup_attempt_id = ${referenced} where id = ${u}`; // a users row inserted before its attempt was marked complete
  await link(old, at('04-02'));
  const [declined] = await sql`insert into connections (attempt_id, state, pending_at, declined_at, cleanup_done_at) values (${old}, 'declined', ${at('04-01')}, ${at('04-01')}, ${at('04-01')}) returning id`;
  await sql`insert into connections (attempt_id, state, pending_at) values (${liveConn}, 'pending', ${at('04-01')})`;
  try {
    const r = await purgePrivacy({ now: NOW, only: ['attempts'] });
    assert.ok(r.attempts >= 1);
    const left = (await sql`select id from signup_attempts where id in ${sql([old, young, vendorHeld, liveConn, referenced])}`).map((x) => Number(x.id)).sort((a, b) => a - b);
    assert.deepEqual(left, [young, vendorHeld, liveConn, referenced].sort((a, b) => a - b));
    assert.equal((await sql`select count(*)::int as n from funnel_events where attempt_id = ${old}`)[0].n, 0);
    assert.equal((await sql`select count(*)::int as n from login_links where attempt_id = ${old}`)[0].n, 0);
    assert.equal((await sql`select count(*)::int as n from connections where id = ${declined.id}`)[0].n, 0);
    assert.equal((await sql`select count(*)::int as n from funnel_events where attempt_id = ${young}`)[0].n, 2);
  } finally {
    await sql`update users set signup_attempt_id = ${own} where id = ${u}`;
    await sql`delete from users where id = ${u}`;
    const ids = [old, young, vendorHeld, liveConn, referenced];
    await sql`delete from funnel_events where attempt_id in ${sql(ids)}`;
    await sql`delete from login_links where attempt_id in ${sql(ids)}`;
    await sql`delete from connections where attempt_id in ${sql(ids)}`;
    await sql`delete from signup_attempts where id in ${sql(ids)}`;
  }
});

dbTest('a like or reject whose trade is gone is marked, kept for 30 days, then removed; one whose trade returns is unmarked and kept; a like on a live trade is never touched', async () => {
  const { sql } = await import('./db.ts');
  const { purgePrivacy } = await import('./privacy-purge.ts');
  const { tradeKey } = await import('./likes.ts');
  const viewer = await person('ppv');
  const trader = await person('ppt');
  const sell = (s: string) => `pp-${trader}-${s}`;
  const k = (s: string) => tradeKey(sell(s));
  const now = Date.now();
  const close = (s: string) => sql`insert into closed_trades (user_id, sell_id, account_id, symbol, opened_at, closed_at, return_pct, holding_days, verified)
    values (${trader}, ${sell(s)}, 'acct', 'PPX', ${new Date(now - 2 * DAY)}, ${new Date(now - DAY)}, 0.05, 1, true)`;
  try {
    await close('live');
    await close('back');
    for (const s of ['live', 'back', 'oldgone', 'newgone']) {
      await sql`insert into trade_likes (viewer_id, trade_key, trader_id) values (${viewer}, ${k(s)}, ${trader})`;
      await sql`insert into trade_exclusions (viewer_id, trade_key, trader_id) values (${viewer}, ${k(`x${s}`)}, ${trader})`;
    }
    await close('xlive');
    await close('xback');
    // Marks from earlier ticks: 'oldgone' gone for 31 days; 'back' was gone 31 days ago and has returned.
    for (const [kind, s] of [['like', 'oldgone'], ['like', 'back'], ['reject', 'xoldgone'], ['reject', 'xback']]) {
      await sql`insert into privacy_orphans (kind, viewer_id, trade_key, first_seen_at) values (${kind}, ${viewer}, ${k(s)}, ${new Date(now - 31 * DAY)})`;
    }
    const r = await lapPass(2);
    assert.equal(r.done, true);
    const likes = (await sql`select trade_key from trade_likes where viewer_id = ${viewer}`).map((x) => x.trade_key).sort();
    assert.deepEqual(likes, [k('live'), k('back'), k('newgone')].sort());
    const rejects = (await sql`select trade_key from trade_exclusions where viewer_id = ${viewer}`).map((x) => x.trade_key).sort();
    assert.deepEqual(rejects, [k('xlive'), k('xback'), k('xnewgone')].sort());
    const marks = (await sql`select kind, trade_key from privacy_orphans where viewer_id = ${viewer} order by kind`).map((x) => `${x.kind}:${x.trade_key}`).sort();
    assert.deepEqual(marks, [`like:${k('newgone')}`, `reject:${k('xnewgone')}`].sort(), 'new orphans marked; returned and removed ones unmarked');
    // A second tick inside the grace removes nothing more.
    await orphansPass();
    assert.equal((await sql`select count(*)::int as n from trade_likes where viewer_id = ${viewer}`)[0].n, 3);
  } finally {
    await sql`delete from users where id in (${viewer}, ${trader})`;
  }
  assert.equal((await sql`select count(*)::int as n from privacy_orphans where viewer_id = ${viewer}`)[0].n, 0, 'marks go with the account');
});

dbTest('one caller at a time: while the lock is held a second call skips; a purge that throws or is skipped never stops the sync tick', async () => {
  const { purgePrivacy } = await import('./privacy-purge.ts');
  let release!: () => void;
  const held = new Promise<void>((r) => { release = r; });
  let entered!: () => void;
  const inside = new Promise<void>((r) => { entered = r; });
  const first = purgePrivacy({ only: ['orphans'], hold: async () => { entered(); await held; } });
  await inside;
  const second = await orphansPass();
  assert.equal(second.ran, false);
  release();
  assert.equal((await first).ran, true);
  const route = readFileSync(new URL('../app/api/sync/route.ts', import.meta.url), 'utf8');
  const pos = (s: string) => route.indexOf(s);
  // A fixed slot before the sync (never starved) and the time left after it (never taking the sync's), each call in its
  // own try/catch (business lead re-sit 2, orchestrator review 2).
  assert.ok(pos('purgeDiscovery()') < pos('await privacyStages(PRIVACY_SLOT_MS)') && pos('await privacyStages(PRIVACY_SLOT_MS)') < pos('await runShard(')
    && pos('await runShard(') < pos('await privacyStages(Math.min(PRIVACY_STAGE_MS, left()))'));
  assert.match(route, /try \{ if \(boxMs > 0\) privacy = await purgePrivacy\(\{ boxMs \}\); \} catch \(e\) \{ console\.error\('privacy purge failed', logSafe\(e\)\); \}/);
  assert.match(route, /try \{ if \(boxMs > 0 && left\(\) > 0\) displayLog = await writeDisplayLog\(\{ boxMs \}\); \} catch \(e\) \{ console\.error\('display log failed', logSafe\(e\)\); \}/);
  assert.match(route, /const PRIVACY_SLOT_MS = 5_000;/);
});

dbTest('a time box of zero stops before any batch and says so', async () => {
  const { purgePrivacy } = await import('./privacy-purge.ts');
  const r = await purgePrivacy({ boxMs: 0, only: ['orphans'] });
  assert.deepEqual([r.ran, r.done, r.likes], [true, false, 0]);
});

// Known-limits sweep 2 (purge): the clearing and marking steps walk the trade_key hash space a window at a time from a
// persisted cursor (privacy_purge_cursors), so a call does bounded work and a lap still reaches every key.
const SPACE = 2 ** 32;
const posOf = (key: string) => parseInt(key.slice(0, 8), 16);
async function setCursor(step: string, pos: number, span: number) {
  const { sql } = await import('./db.ts');
  await sql`insert into privacy_purge_cursors (step, pos, span, swept) values (${step}, ${pos}, ${span}, 0)
    on conflict (step) do update set pos = excluded.pos, span = excluded.span, swept = 0`;
}
const lapsOf = async (step: string) => {
  const { sql } = await import('./db.ts');
  return Number((await sql`select laps from privacy_purge_cursors where step = ${step}`)[0]?.laps ?? 0);
};

dbTest('an orphan behind the marking cursor is marked, and a returned trade behind the clearing cursor is unmarked, on the next lap', async () => {
  const { sql } = await import('./db.ts');
  const { tradeKey } = await import('./likes.ts');
  const viewer = await person('ppc');
  const trader = await person('ppd');
  const sell = (s: string) => `pp-${trader}-${s}`;
  const k = (s: string) => tradeKey(sell(s));
  const now = Date.now();
  try {
    await sql`insert into closed_trades (user_id, sell_id, account_id, symbol, opened_at, closed_at, return_pct, holding_days, verified)
      values (${trader}, ${sell('back')}, 'acct', 'PPX', ${new Date(now - 2 * DAY)}, ${new Date(now - DAY)}, 0.05, 1, true)`;
    for (const s of ['gone', 'back']) await sql`insert into trade_likes (viewer_id, trade_key, trader_id) values (${viewer}, ${k(s)}, ${trader})`;
    await sql`insert into privacy_orphans (kind, viewer_id, trade_key, first_seen_at) values ('like', ${viewer}, ${k('back')}, ${new Date(now - DAY)})`;
    // Each cursor just past its key: the key is behind it, reached only after the lap wraps.
    await setCursor('mark-like', (posOf(k('gone')) + 1) % SPACE, 2 ** 24);
    await setCursor('clear', (posOf(k('back')) + 1) % SPACE, 2 ** 24);
    const [markLaps, clearLaps] = [await lapsOf('mark-like'), await lapsOf('clear')];
    // The walk from each cursor to the end wraps without a lap (half a lap); the next full lap covers both keys.
    const r = await lapPass(1, {}, ['clear', 'mark-like']);
    assert.equal(r.done, true);
    const marks = (await sql`select trade_key from privacy_orphans where viewer_id = ${viewer}`).map((x) => x.trade_key);
    assert.deepEqual(marks, [k('gone')], 'the orphan behind the cursor marked; the returned trade unmarked');
    assert.ok(await lapsOf('mark-like') > markLaps && await lapsOf('clear') > clearLaps, 'both cursors wrapped');
    assert.equal((await sql`select count(*)::int as n from trade_likes where viewer_id = ${viewer}`)[0].n, 2, 'marking and clearing delete no like');
  } finally {
    await sql`delete from users where id in (${viewer}, ${trader})`;
  }
});

dbTest('a window that hits the statement timeout shrinks and leaves the cursor in place; the next call walks on and marks every orphan', async () => {
  const { sql } = await import('./db.ts');
  const { purgePrivacy, nextSpan, ORPHAN_STEP_MS } = await import('./privacy-purge.ts');
  // The span rule: cut 16-fold by a timeout, halved by a slow batch (never below 1), doubled by a fast one (never past
  // the space).
  assert.equal(nextSpan(SPACE, 0, true), SPACE / 16);
  assert.equal(nextSpan(1, 0, true), 1);
  assert.equal(nextSpan(1024, ORPHAN_STEP_MS + 1, false), 512);
  assert.equal(nextSpan(1024, 1, false), 2048);
  assert.equal(nextSpan(SPACE, 1, false), SPACE);
  assert.equal(nextSpan(1024, ORPHAN_STEP_MS / 2, false), 1024);
  const viewer = await person('ppw');
  const trader = await person('ppu');
  const N = 20_000;
  try {
    await sql`insert into trade_likes (viewer_id, trade_key, trader_id)
      select ${viewer}, encode(sha256((${`pp-${viewer}:`} || i)::bytea), 'hex'), ${trader} from generate_series(1, ${N}) i`;
    await setCursor('mark-like', 0, SPACE); // one window over the whole space: far more than a 1 ms statement can do
    let first;
    for (let i = 0; ; i++) {
      assert.ok(i < 300, 'the purge lock stays held'); first = await purgePrivacy({ only: ['orphans'], orphanSteps: ['mark-like'], timeoutMs: 1, boxMs: 300 }); /* a short box: the lock is held briefly */ if (first.ran) break; await new Promise((x) => setTimeout(x, 100)); }
    assert.ok(first.orphanTimeouts >= 1, 'the window timed out, rolled back and shrank');
    const laps = await lapsOf('mark-like');
    // The next calls walk on (each within its budget) until a full lap from the cursor completes.
    const r = await lapPass(1, { orphanSteps: ['mark-like'] }, ['mark-like']);
    assert.equal(r.done, true);
    assert.ok(await lapsOf('mark-like') > laps, 'the cursor moved on and wrapped');
    assert.equal((await sql`select count(*)::int as n from privacy_orphans where viewer_id = ${viewer}`)[0].n, N, 'every orphan marked');
  } finally {
    await sql`delete from users where id in (${viewer}, ${trader})`;
  }
});

dbTest('a lap begun mid-space counts only once the whole space is walked: a wide window from the middle wraps without a lap, the next full window makes one', async () => {
  const { purgePrivacy } = await import('./privacy-purge.ts');
  // One window per call: the box ends right after the first batch (a clock that jumps once the step has started).
  const oneWindow = () => { let n = 0; return () => (n++ < 4 ? 0 : 1e12); };
  const run = async () => {
    for (let i = 0; ; i++) {
      assert.ok(i < 300, 'the purge lock stays held');
      const r = await purgePrivacy({ only: ['orphans'], orphanSteps: ['mark-like'], clock: oneWindow() });
      if (r.ran) return r;
      await new Promise((x) => setTimeout(x, 100));
    }
  };
  // Another file's purge between these steps could add laps; it can never take one away, so a retry cannot hide a lap
  // counted early.
  let ok = false;
  for (let attempt = 1; attempt <= 3 && !ok; attempt++) {
    await setCursor('mark-like', SPACE / 2, SPACE);
    const l0 = await lapsOf('mark-like');
    await run(); // walks [middle, end) and wraps: half the space
    const l1 = await lapsOf('mark-like');
    await run(); // walks [0, end): now the whole space since the wrap
    const l2 = await lapsOf('mark-like');
    ok = l1 === l0 && l2 === l0 + 1;
    if (attempt === 3) assert.deepEqual([l1 - l0, l2 - l0], [0, 1], 'no lap for the half walk, one for the full one');
  }
});

dbTest('due marks whose trade came back never block a later due orphan; the like count is the likes removed', async () => {
  const { sql } = await import('./db.ts');
  const { purgePrivacy } = await import('./privacy-purge.ts');
  const { tradeKey } = await import('./likes.ts');
  const viewer = await person('ppb');
  const trader = await person('ppe');
  const sell = (s: string) => `pp-${trader}-${s}`;
  const k = (s: string) => tradeKey(sell(s));
  try {
    for (const s of ['r1', 'r2', 'r3']) {
      await sql`insert into closed_trades (user_id, sell_id, account_id, symbol, opened_at, closed_at, return_pct, holding_days, verified)
        values (${trader}, ${sell(s)}, 'acct', 'PPX', ${at('03-01')}, ${at('03-02')}, 0.05, 1, true)`;
    }
    // A full batch (3) of the oldest due marks have their trade back; the real orphan is due after them. Run at a past
    // `now` with the cursor steps off, so no other test's mark is due and none is marked at that date. A call at the real
    // time (another test file's) may take these due rows first; the fixture is then laid again, so the count is checked
    // on a call that found them.
    let r;
    for (let attempt = 1; ; attempt++) {
      await sql`insert into trade_likes (viewer_id, trade_key, trader_id) select ${viewer}, k, ${trader} from unnest(${['r1', 'r2', 'r3', 'gone'].map(k)}::text[]) k on conflict do nothing`;
      await sql`insert into privacy_orphans (kind, viewer_id, trade_key, first_seen_at)
        select 'like', ${viewer}, k, ${at('04-01')}::timestamptz + (k = ${k('gone')})::int * interval '1 day' from unnest(${['r1', 'r2', 'r3', 'gone'].map(k)}::text[]) k
        on conflict (kind, viewer_id, trade_key) do update set first_seen_at = excluded.first_seen_at`;
      for (let i = 0; ; i++) {
        assert.ok(i < 300, 'the purge lock stays held');
        r = await purgePrivacy({ now: NOW, only: ['orphans'], orphanSteps: [], batch: 3 });
        if (r.ran) break;
        await new Promise((x) => setTimeout(x, 100));
      }
      assert.equal(r.done, true);
      if (r.likes > 0 || attempt >= 5) break;
    }
    assert.equal(r.likes, 1, 'one like removed');
    const likes = (await sql`select trade_key from trade_likes where viewer_id = ${viewer}`).map((x) => x.trade_key).sort();
    assert.deepEqual(likes, [k('r1'), k('r2'), k('r3')].sort(), 'likes on returned trades kept');
    assert.equal((await sql`select count(*)::int as n from privacy_orphans where viewer_id = ${viewer}`)[0].n, 0, 'every due mark resolved');
  } finally {
    await sql`delete from users where id in (${viewer}, ${trader})`;
  }
});

dbTest('the cursor holds a position in the hash space only (no viewer, key or trade), and hex keys sort in hash order under the database collation', async () => {
  const { sql } = await import('./db.ts');
  const { tradeKey } = await import('./likes.ts');
  const cols = (await sql`select column_name from information_schema.columns where table_schema = current_schema() and table_name = 'privacy_purge_cursors' order by column_name`).map((x) => x.column_name);
  assert.deepEqual(cols, ['laps', 'pos', 'span', 'step', 'swept', 'updated_at']);
  const [o] = await sql`select '0f' < '10' as a, '9f' < 'a0' as b, 'ffffffff' < 'g' as c, '' < '00000000' as d, '7fffffff' < '80000000' as e`;
  assert.deepEqual(Object.values(o), [true, true, true, true, true]);
  assert.match(tradeKey('any sell id'), /^[0-9a-f]{64}$/, 'trade keys are lowercase sha256 hex');
});

dbTest('a shared Similar-trades pool idle past a day goes; a fresh one stays', async () => {
  const { sql } = await import('./db.ts');
  const { purgePrivacy } = await import('./privacy-purge.ts');
  const p = `pp-sim-${Math.random().toString(36).slice(2, 8)}`;
  // Dated at a past `now`, so no real pool (key '*' among them) is idle at that date.
  await sql`insert into similar_pools (key, hour, built_at, claimed_at) values
    (${`${p}-idle`}, ${at('05-01')}, ${at('05-01')}, null), (${`${p}-claimed`}, ${at('05-01')}, null, ${at('05-01')}), (${`${p}-fresh`}, ${at('05-31')}, ${new Date(NOW.getTime() - DAY / 2)}, null)`;
  try {
    let r;
    for (let i = 0; ; i++) {
      assert.ok(i < 300, 'the purge lock stays held'); r = await purgePrivacy({ now: NOW, only: ['similar'] }); if (r.ran) break; await new Promise((x) => setTimeout(x, 100)); }
    assert.equal(r.done, true);
    assert.ok(r.similarPools >= 2);
    const left = (await sql`select key from similar_pools where key like ${`${p}-%`}`).map((x) => x.key);
    assert.deepEqual(left, [`${p}-fresh`]);
  } finally {
    await sql`delete from similar_pools where key like ${`${p}-%`}`;
  }
});
