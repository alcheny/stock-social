// Privacy work (2026-11-01, committee D10–D13): the purges on the tick (lib/privacy-purge.ts). Dated steps run at a
// past `now` so rows of tests running at the same time are untouched; the orphan step runs at the real time.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const hasDb = !!process.env.DATABASE_URL;
const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL' }, fn);
before(async () => { if (hasDb) await (await import('./db.ts')).sql.unsafe(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')).simple(); });
after(async () => { if (hasDb) await (await import('./db.ts')).sql.end({ timeout: 1 }); });

const NOW = new Date('2001-06-01T00:00:00Z');
const at = (iso: string) => new Date(`2001-${iso}T00:00:00Z`);
const DAY = 86_400_000;

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
    const r = await purgePrivacy({ only: ['orphans'] });
    assert.equal(r.done, true);
    const likes = (await sql`select trade_key from trade_likes where viewer_id = ${viewer}`).map((x) => x.trade_key).sort();
    assert.deepEqual(likes, [k('live'), k('back'), k('newgone')].sort());
    const rejects = (await sql`select trade_key from trade_exclusions where viewer_id = ${viewer}`).map((x) => x.trade_key).sort();
    assert.deepEqual(rejects, [k('xlive'), k('xback'), k('xnewgone')].sort());
    const marks = (await sql`select kind, trade_key from privacy_orphans where viewer_id = ${viewer} order by kind`).map((x) => `${x.kind}:${x.trade_key}`).sort();
    assert.deepEqual(marks, [`like:${k('newgone')}`, `reject:${k('xnewgone')}`].sort(), 'new orphans marked; returned and removed ones unmarked');
    // A second tick inside the grace removes nothing more.
    await purgePrivacy({ only: ['orphans'] });
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
  const second = await purgePrivacy({ only: ['orphans'] });
  assert.equal(second.ran, false);
  release();
  assert.equal((await first).ran, true);
  const route = readFileSync(new URL('../app/api/sync/route.ts', import.meta.url), 'utf8');
  const pos = (s: string) => route.indexOf(s);
  // A fixed slot before the sync (never starved) and the time left after it (never taking the sync's), each call in its
  // own try/catch (business lead re-sit 2, orchestrator review 2).
  assert.ok(pos('purgeDiscovery()') < pos('await privacyStages(PRIVACY_SLOT_MS)') && pos('await privacyStages(PRIVACY_SLOT_MS)') < pos('await syncTick(')
    && pos('await syncTick(') < pos('await privacyStages(Math.min(PRIVACY_STAGE_MS, left()))'));
  assert.match(route, /try \{ if \(boxMs > 0\) privacy = await purgePrivacy\(\{ boxMs \}\); \} catch \(e\) \{ console\.error\('privacy purge failed', logSafe\(e\)\); \}/);
  assert.match(route, /try \{ if \(boxMs > 0 && left\(\) > 0\) displayLog = await writeDisplayLog\(\{ boxMs \}\); \} catch \(e\) \{ console\.error\('display log failed', logSafe\(e\)\); \}/);
  assert.match(route, /const PRIVACY_SLOT_MS = 5_000;/);
});

dbTest('a time box of zero stops before any batch and says so', async () => {
  const { purgePrivacy } = await import('./privacy-purge.ts');
  const r = await purgePrivacy({ boxMs: 0, only: ['orphans'] });
  assert.deepEqual([r.ran, r.done, r.likes], [true, false, 0]);
});
