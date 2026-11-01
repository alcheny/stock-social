// F-2 PR-5: personal ordering, the activity log and the stored-preference rules, against the database. Each case builds
// its own users and closes and deletes them in `finally`. The pool lib/db.ts reuses (`globalThis.sql`) is pre-seeded with
// a query-logging client (the pattern of lib/feed.signed-out.test.ts), so the guard cases can read every query and its
// parameters. Skipped without DATABASE_URL.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import postgres from 'postgres';
import type { FeedPage } from './feed.ts';
import type { RawEvent } from './discovery/events.ts';

const hasDb = !!process.env.DATABASE_URL;
const log: string[] = [];
const params: unknown[][] = [];
if (hasDb) (globalThis as unknown as { sql: postgres.Sql }).sql = postgres(process.env.DATABASE_URL!, { onnotice: () => {}, debug: (_c, q, p) => { log.push(String(q)); params.push(p as unknown[]); } });
const VIEWER_TABLES = /\b(follows|viewer_exclusions|trade_likes|trade_exclusions|discovery_events)\b/i;
const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL' }, fn);
before(async () => { if (hasDb) await (await import('./db.ts')).sql.unsafe(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')).simple(); });
after(async () => { if (hasDb) await (await import('./db.ts')).sql.end({ timeout: 1 }); });
const DAY = 86_400_000;
const HOLDS = [0.5, 3, 14, 60, 300];
const resetLog = () => { log.length = 0; params.length = 0; };

// `viewers` users with no closes, then `n` traders with `closes` closes each (holding period HOLDS[t % 5]). `low`: traders
// from this index on get tiny returns, so they fall outside the 200 ranked candidates (the exploration-only `extra`).
async function fixture(n: number, o: { viewers?: number; closes?: number; low?: number } = {}) {
  const { sql } = await import('./db.ts');
  const { createAttempt, createUserForAttempt } = await import('./auth/attempts.ts');
  const tag = `p${Math.random().toString(36).slice(2, 8)}`;
  const nv = o.viewers ?? 1, k = o.closes ?? 5;
  const ids: number[] = [];
  for (let t = 0; t < nv + n; t++) ids.push((await createUserForAttempt(await createAttempt({ method: 'dev', attested: true }), { handle: `${tag}${t}` })).id);
  await sql`update users set created_at = now() - interval '60 days' where id in ${sql(ids)}`;
  const viewers = ids.slice(0, nv), traders = ids.slice(nv);
  const at = Date.now() - 600_000;
  if (n) await sql`insert into closed_trades ${sql(traders.flatMap((u, t) => Array.from({ length: k }, (_, i) => ({
    user_id: u, sell_id: `${tag}-${t}-${i}`, account_id: 'a', symbol: `P${(t * k + i) % 47}`, opened_at: new Date(at - (t * k + i) * 1000 - HOLDS[t % 5] * DAY),
    closed_at: new Date(at - (t * k + i) * 1000), return_pct: o.low !== undefined && t >= o.low ? 0.0001 * (1 + i) : 0.02 + ((t * 7 + i) % 9) / 100,
    holding_days: HOLDS[t % 5], verified: true,
  }))))}`;
  const handles = new Map(ids.map((id, i) => [id, `${tag}${i}`]));
  const trade = async (trader: number, i = 0) => (await sql`select id::text as id, sell_id, trade_key from closed_trades where user_id = ${trader} order by sell_id limit 1 offset ${i}`)[0] as { id: string; sell_id: string; trade_key: string };
  return { sql, tag, ids, viewer: viewers[0], viewers, traders, handle: (id: number) => handles.get(id)!, trade,
    remove: async () => { await sql`delete from users where id in ${sql(ids)}`; } };
}

// Every page of a feed session, from page 1 through `next`.
async function pages(load: (after?: string) => Promise<FeedPage>): Promise<FeedPage[]> {
  const out = [await load(undefined)];
  while (out.at(-1)!.next) out.push(await load(out.at(-1)!.next!));
  return out;
}
const sells = (ps: FeedPage[]) => ps.flatMap((p) => p.cards.map((c) => c.sell_id));
const traderSeq = (ps: FeedPage[]) => ps.flatMap((p) => p.cards.map((c) => c.user_id));
const ev = (type: RawEvent['type'], target: RawEvent['target'], surface: RawEvent['surface'] = 'feed'): RawEvent => ({ type, surface, target });
const allowBatch = (sql: postgres.Sql, viewer: number) => sql`update users set activity_batch_at = now() - interval '1 minute' where id = ${viewer}`;

// ---- Criterion 3 and the activity switches ----

dbTest('criterion 3: discovery_events has exactly (id, viewer_id, at, surface, type, target_kind, target_user_id, target_trade_key, target_symbol); rows recordEvents writes carry no address, no long number but ids, no price, units or account', async () => {
  const f = await fixture(2);
  const { setActivity, recordEvents } = await import('./discovery/activity.ts');
  try {
    const cols = await f.sql`select column_name from information_schema.columns where table_schema = current_schema() and table_name = 'discovery_events' order by ordinal_position`;
    assert.deepEqual(cols.map((c) => c.column_name), ['id', 'viewer_id', 'at', 'surface', 'type', 'target_kind', 'target_user_id', 'target_trade_key', 'target_symbol']);
    await setActivity(f.viewer, true);
    const t = await f.trade(f.traders[0]);
    const n = await recordEvents(f.viewer, [ev('dwell_long', { kind: 'trader', handle: f.handle(f.traders[1]) }), ev('swipe_open', { kind: 'trade', id: t.id }, 'pane'), ev('impression', { kind: 'trade', id: t.id })]);
    assert.equal(n, 3);
    const rows = await f.sql`select * from discovery_events where viewer_id = ${f.viewer}`;
    assert.equal(rows.length, 3);
    for (const r of rows) {
      const json = JSON.stringify(r);
      assert.doesNotMatch(json, /@/);
      assert.doesNotMatch(json, /price|units|quantity|amount|account|email|ip|agent|device/i);
      if (r.target_trade_key !== null) {
        assert.match(r.target_trade_key, /^[0-9a-f]{64}$/);
        assert.equal(r.target_trade_key, t.trade_key);
      }
      const { id: _i, viewer_id: _v, target_user_id: _u, target_trade_key: _k, ...rest } = r;
      assert.doesNotMatch(JSON.stringify(rest), /[0-9]{7,}/, JSON.stringify(rest));
    }
  } finally { await f.remove(); }
});

dbTest('activity is Off by default; Off or personalize Off stores nothing; On stores; a fourth batch within 10 s is refused; the day cap holds; self and unknown targets are dropped; Clear deletes every event and the profile then reads none', async () => {
  const f = await fixture(3, { viewers: 2 });
  const a = await import('./discovery/activity.ts');
  const { loadPersonal } = await import('./discovery/personal-load.ts');
  const v = f.viewer, [t0, t1, t2] = f.traders;
  const count = async (who = v) => (await f.sql`select count(*)::int as n from discovery_events where viewer_id = ${who}`)[0].n as number;
  const batch = [ev('dwell_long', { kind: 'trader', handle: f.handle(t0) }), ev('profile_open', { kind: 'trader', handle: f.handle(t1) })];
  try {
    assert.deepEqual(await a.settingsFor(v), { personalize: true, activity: false });
    assert.deepEqual(a.DEFAULT_SETTINGS, { personalize: true, activity: false });
    assert.equal(await a.recordEvents(v, batch), 'off');
    assert.equal(await count(), 0);
    await a.setActivity(v, true);
    await a.setPersonalize(v, false);
    assert.equal(await a.recordEvents(v, batch), 'off');
    assert.equal(await count(), 0);
    await a.setPersonalize(v, true);
    assert.deepEqual(await a.settingsFor(v), { personalize: true, activity: true });
    assert.equal(await a.recordEvents(v, batch), 2);
    assert.equal(await count(), 2);
    // Tester finding 1: a window of 3 batches per 10 s (the page-leave batch right after a periodic one is kept); the
    // fourth in the window is refused and stores nothing.
    assert.equal(await a.recordEvents(v, batch), 2);
    assert.equal(await a.recordEvents(v, batch), 2);
    assert.equal(await a.recordEvents(v, batch), 'rate');
    assert.equal(await count(), 6);
    await allowBatch(f.sql, v);
    // Self and unknown targets are dropped: the viewer's own handle and trade, an unknown handle and an unknown trade id.
    const own = f.viewers[1];
    await f.sql`insert into closed_trades (user_id, sell_id, account_id, symbol, opened_at, closed_at, return_pct, holding_days, verified)
      values (${v}, ${`${f.tag}-self`}, 'a', 'PS', now() - interval '2 days', now() - interval '1 day', 0.01, 1, true)`;
    const self = (await f.sql`select id::text as id from closed_trades where sell_id = ${`${f.tag}-self`}`)[0].id as string;
    assert.equal(await a.recordEvents(v, [ev('dwell_long', { kind: 'trader', handle: f.handle(v) }), ev('swipe_open', { kind: 'trade', id: self }),
      ev('dwell_long', { kind: 'trader', handle: 'zz_no_such_handle' }), ev('swipe_open', { kind: 'trade', id: '999999999999999' })]), 0);
    assert.equal(await count(), 6);
    await allowBatch(f.sql, v);
    assert.equal(await a.recordEvents(v, [ev('dwell_long', { kind: 'trader', handle: f.handle(v) }), ev('share', { kind: 'trader', handle: f.handle(t2) })]), 1);
    assert.equal(await count(), 7);
    assert.equal(own !== v, true);
    // The day cap: 1,999 stored today, a batch of 5 stores 1.
    await a.setActivity(own, true);
    await f.sql`insert into discovery_events (viewer_id, surface, type, target_kind, target_user_id) select ${own}, 1, 1, 'trader', ${t0} from generate_series(1, ${a.DAY_MAX - 1})`;
    const five = (['impression', 'dwell_short', 'dwell_long', 'skip', 'share'] as const).map((t) => ev(t, { kind: 'trader', handle: f.handle(t1) }));
    assert.equal(await a.recordEvents(own, five), 1);
    assert.equal(await count(own), a.DAY_MAX);
    await allowBatch(f.sql, own);
    assert.equal(await a.recordEvents(own, five), 0);
    assert.equal(await count(own), a.DAY_MAX);
    // Clear: every event at once; the profile then reads none.
    const before = await loadPersonal(v, new Date());
    assert.ok(before.personalize && before.profile.seen.size > 0 && before.profile.signals > 0);
    assert.equal(await a.clearActivity(v), 7);
    assert.equal(await count(), 0);
    const afterClear = await loadPersonal(v, new Date());
    assert.ok(afterClear.personalize);
    assert.equal(afterClear.profile.seen.size, 0);
    assert.equal(afterClear.profile.signals, 0);
    assert.equal(afterClear.profile.direct.size, 0);
  } finally { await f.remove(); }
});

dbTest('activity Off with stored events: loadPersonal reads no event (no discovery_events query) and the profile equals that of a viewer with none', async () => {
  const f = await fixture(2, { viewers: 2 });
  const a = await import('./discovery/activity.ts');
  const { loadPersonal } = await import('./discovery/personal-load.ts');
  const [v, fresh] = f.viewers;
  try {
    await a.setActivity(v, true);
    assert.equal(await a.recordEvents(v, [ev('swipe_open', { kind: 'trader', handle: f.handle(f.traders[0]) }), ev('dwell_long', { kind: 'trader', handle: f.handle(f.traders[1]) })]), 2);
    await a.setActivity(v, false);
    assert.equal((await f.sql`select count(*)::int as n from discovery_events where viewer_id = ${v}`)[0].n, 2, 'stored until cleared');
    const asOf = new Date();
    resetLog();
    const mine = await loadPersonal(v, asOf);
    assert.deepEqual(log.filter((q) => /discovery_events/.test(q)), []);
    const none = await loadPersonal(fresh, asOf);
    assert.ok(mine.personalize && none.personalize);
    assert.deepEqual(mine.profile, none.profile);
    assert.equal(mine.profile.signals, 0);
    assert.equal(mine.profile.activity, false);
  } finally { await f.remove(); }
});

test('watchlist: watch and unwatch events are dropped; toggleWatch never names discovery_events; personal ordering never names ticker_watches', async () => {
  const { parseBatch, SYMBOL_EVENTS } = await import('./discovery/events.ts');
  assert.equal(SYMBOL_EVENTS, false);
  assert.deepEqual(parseBatch({ events: [
    { type: 'watch', surface: 'feed', target: { kind: 'symbol', symbol: 'ABC' } },
    { type: 'unwatch', surface: 'me', target: { kind: 'symbol', symbol: 'ABC' } },
  ] }), []);
  const actions = readFileSync(new URL('../app/actions.ts', import.meta.url), 'utf8');
  const start = actions.indexOf('export async function toggleWatch');
  assert.ok(start >= 0);
  const next = actions.indexOf('\nexport ', start + 1);
  const body = actions.slice(start, next < 0 ? undefined : next);
  assert.match(body, /ticker_watches/);
  assert.doesNotMatch(body, /discovery_events|recordEvents|discovery\/activity/);
  const dir = new URL('./discovery/', import.meta.url);
  const personal = readdirSync(dir).filter((f) => /^personal.*\.ts$/.test(f) && !f.endsWith('.test.ts'));
  assert.ok(personal.length >= 3, personal.join());
  for (const f of personal) assert.doesNotMatch(readFileSync(new URL(f, dir), 'utf8'), /ticker_watches|watchlist\.ts|watches\.ts/, f);
});

dbTest('fade: likes made 0, 45, 89 and 91 days before asOf weigh about 3, 1.5, 0.03 and nothing; the 91-day like is still stored', async () => {
  const f = await fixture(4);
  const { like } = await import('./likes.ts');
  const { loadPersonal } = await import('./discovery/personal-load.ts');
  const ages = [0, 45, 89, 91];
  try {
    for (const [i, t] of f.traders.entries()) {
      const c = await f.trade(t);
      assert.ok(await like(f.viewer, c.id));
      await f.sql`update trade_likes set created_at = now() - ${ages[i]} * interval '1 day' - interval '1 second' where viewer_id = ${f.viewer} and trade_key = ${c.trade_key}`;
    }
    const p = await loadPersonal(f.viewer, new Date());
    assert.ok(p.personalize);
    const d = (i: number) => p.profile.direct.get(f.traders[i]);
    assert.ok(Math.abs(d(0)! - 3) < 0.01, `${d(0)}`);
    assert.ok(Math.abs(d(1)! - 1.5) < 0.01, `${d(1)}`);
    assert.ok(Math.abs(d(2)! - 3 / 90) < 0.005, `${d(2)}`);
    assert.equal(d(3), undefined);
    assert.equal(p.profile.signals, 3);
    assert.equal((await f.sql`select count(*)::int as n from trade_likes where viewer_id = ${f.viewer}`)[0].n, 4);
  } finally { await f.remove(); }
});

// ---- Ordering ----

dbTest('personalize Off: the order everyone gets minus the viewer\'s own hidden trader and rejected trade; a zero-signal viewer gets exactly the signed-out order and no `personal`', async () => {
  const f = await fixture(40, { viewers: 2 });
  const { loadFeedPage } = await import('./feed.ts');
  const { personalFor } = await import('./discovery/personal-load.ts');
  const { setPersonalize } = await import('./discovery/activity.ts');
  const { exclude, follow } = await import('./follows.ts');
  const { rejectTrade, like } = await import('./likes.ts');
  const [v, zero] = f.viewers;
  try {
    // A session that started 30 s ago: the hide and the reject made now are after its asOf (a display filter, in place).
    const now = Date.now() - 30_000;
    const out = await pages((after) => loadFeedPage(after, { ids: f.traders, now }));
    assert.ok(out.length >= 6);
    await setPersonalize(v, false);
    const hiddenTrader = traderSeq(out)[3];
    const rejected = out[0].cards.find((c) => c.user_id !== hiddenTrader)!;
    // Choices that would shape a personal order; Off they must change nothing but the hides.
    await follow(v, traderSeq(out).at(-1)!);
    assert.ok(await like(v, String(out.at(-1)!.cards.at(-1)!.id)));
    await exclude(v, hiddenTrader, 'not_interested');
    assert.ok(await rejectTrade(v, String(rejected.id)));
    const off = await pages((after) => loadFeedPage(after, { ids: f.traders, now, viewer: v, personal: personalFor(v) }));
    assert.deepEqual(sells(off), sells(out).filter((s) => s !== rejected.sell_id && !out.some((p) => p.cards.some((c) => c.sell_id === s && c.user_id === hiddenTrader))));
    assert.ok(off.every((p) => p.personal === undefined));
    // Zero signals: exactly the signed-out order, no `personal`.
    const z = await pages((after) => loadFeedPage(after, { ids: f.traders, now, viewer: zero, personal: personalFor(zero) }));
    assert.deepEqual(sells(z), sells(out));
    assert.ok(z.every((p) => p.personal === undefined));
    assert.deepEqual(z[0].section?.map((r) => r.userId), out[0].section?.map((r) => r.userId));
  } finally { await f.remove(); }
});

// Engineer demand 3 (plan-pr5-engineer.md): "pass `extra` to both shapeList and personalList". With personalize Off and
// a hide made before asOf, the list is shapeList(kept.ranked, shaping, day) without `extra` (lib/feed.ts#loadFeedPage),
// so the exploration-only traders (outside the 200 ranked candidates) vanish from that viewer's feed: their list is not
// "the order everyone gets minus their own hides".
dbTest('personalize Off with a hide made before asOf: exploration still reaches the traders outside the ranked candidates (everyone\'s list minus the hide)', async () => {
  const f = await fixture(60, { low: 40 });
  const { loadFeedPage } = await import('./feed.ts');
  const { personalFor } = await import('./discovery/personal-load.ts');
  const { setPersonalize } = await import('./discovery/activity.ts');
  const { exclude } = await import('./follows.ts');
  try {
    await setPersonalize(f.viewer, false);
    const hidden = f.traders[0];
    await exclude(f.viewer, hidden, 'not_interested');
    await f.sql`update viewer_exclusions set created_at = now() - interval '1 minute' where viewer_id = ${f.viewer}`;
    const now = Date.now();
    const out = await pages((after) => loadFeedPage(after, { ids: f.traders, now }));
    const outside = new Set(traderSeq(out).filter((t) => f.traders.indexOf(t) >= 40));
    assert.ok(outside.size > 0, 'signed out, exploration shows traders outside the candidates');
    const off = await pages((after) => loadFeedPage(after, { ids: f.traders, now, viewer: f.viewer, personal: personalFor(f.viewer) }));
    assert.ok(!traderSeq(off).includes(hidden));
    const offOutside = new Set(traderSeq(off).filter((t) => f.traders.indexOf(t) >= 40));
    assert.deepEqual([...offOutside].sort(), [...outside].sort(), 'the Off viewer\'s list reaches the same exploration-only traders');
  } finally { await f.remove(); }
});

dbTest('a follow raises the trader: their first card comes earlier than in the signed-out list; an unfollow never removes their cards', async () => {
  const f = await fixture(40);
  const { loadFeedPage } = await import('./feed.ts');
  const { personalFor } = await import('./discovery/personal-load.ts');
  const { follow, unfollow } = await import('./follows.ts');
  try {
    // A session clock a few seconds ahead, so choices made now are at or before its asOf.
    const now = Date.now() + 5_000;
    const out = await pages((after) => loadFeedPage(after, { ids: f.traders, now }));
    const seq = traderSeq(out);
    // The trader whose first card comes last (the mix spreads every trader's first card over the first pages: past page 1).
    const firsts = f.traders.map((t) => ({ t, at: seq.indexOf(t) })).filter((x) => x.at >= 0).sort((a, b) => b.at - a.at);
    const T = firsts[0].t;
    assert.ok(firsts[0].at >= 30, `${firsts[0].at} of ${seq.length}`);
    await follow(f.viewer, T);
    const mine = await pages((after) => loadFeedPage(after, { ids: f.traders, now, viewer: f.viewer, personal: personalFor(f.viewer) }));
    assert.ok(mine[0].personal && mine[0].personal.signals >= 1);
    assert.ok(traderSeq(mine).indexOf(T) < seq.indexOf(T), `${traderSeq(mine).indexOf(T)} < ${seq.indexOf(T)}`);
    assert.equal(traderSeq(mine).filter((t) => t === T).length, seq.filter((t) => t === T).length);
    await unfollow(f.viewer, T);
    const now2 = Date.now() + 5_000;
    const out2 = await pages((after) => loadFeedPage(after, { ids: f.traders, now: now2 }));
    const after2 = await pages((after) => loadFeedPage(after, { ids: f.traders, now: now2, viewer: f.viewer, personal: personalFor(f.viewer) }));
    assert.equal(traderSeq(after2).filter((t) => t === T).length, traderSeq(out2).filter((t) => t === T).length);
    assert.ok(traderSeq(after2).includes(T));
  } finally { await f.remove(); }
});

dbTest('page stability: after like, unlike and unfollow, page 2 is the slice of page 1\'s list: no card repeats, none moves; Clear drops the kept list at once', async () => {
  const f = await fixture(40);
  const { loadFeedPage } = await import('./feed.ts');
  const { personalFor } = await import('./discovery/personal-load.ts');
  const { follow, unfollow } = await import('./follows.ts');
  const { like, unlike } = await import('./likes.ts');
  const a = await import('./discovery/activity.ts');
  const v = f.viewer, [A, B, C, D] = f.traders.slice(-4);
  try {
    const ta = await f.trade(A);
    assert.ok(await like(v, ta.id));
    await follow(v, B);
    await a.setActivity(v, true);
    assert.equal(await a.recordEvents(v, [ev('swipe_open', { kind: 'trader', handle: f.handle(D) })]), 1);
    const now = Date.now() + 5_000;
    const load = (after?: string) => loadFeedPage(after, { ids: f.traders, now, viewer: v, personal: personalFor(v) });
    const p1 = await load();
    assert.ok(p1.personal && p1.next);
    const ref2 = await load(p1.next!);
    assert.ok(await like(v, (await f.trade(C)).id));
    assert.ok(await unlike(v, { id: ta.id }));
    await unfollow(v, B);
    const p2 = await load(p1.next!);
    assert.deepEqual(p2.cards.map((c) => c.sell_id), ref2.cards.map((c) => c.sell_id));
    const s1 = new Set(p1.cards.map((c) => c.sell_id));
    assert.ok(p2.cards.every((c) => !s1.has(c.sell_id)));
    const both = [...p1.cards, ...p2.cards].map((c) => c.sell_id);
    assert.equal(new Set(both).size, both.length);
    assert.equal(p2.from, 31);
    const p3 = await load(p2.next!);
    assert.ok(p3.cards.every((c) => !both.includes(c.sell_id)));
    // Orchestrator review 5: "Clear my activity" drops the kept list at once: the next page is built without anything
    // cleared (here nothing else counts at asOf either, so it is everyone's page 2).
    assert.equal(await a.clearActivity(v), 1);
    const after = await load(p1.next!);
    assert.equal(after.personal?.uses.activity ?? false, false, 'nothing cleared is used');
    const { clearPersonalCache } = await import('./feed.ts');
    clearPersonalCache();
    const fresh = await load(p1.next!);
    assert.deepEqual(after.cards.map((c) => c.sell_id), fresh.cards.map((c) => c.sell_id), 'built afresh from what is stored now');
  } finally { await f.remove(); }
});

dbTest('orchestrator review 1: with choices made before asOf, "Personalize my feed" On changes the order and Off gives exactly everyone\'s order; turning it Off drops the kept list at once', async () => {
  const f = await fixture(40, { viewers: 1 });
  const { loadFeedPage } = await import('./feed.ts');
  const { personalFor } = await import('./discovery/personal-load.ts');
  const a = await import('./discovery/activity.ts');
  const v = f.viewer;
  try {
    const now = Date.now();
    const out = await pages((after) => loadFeedPage(after, { ids: f.traders, now }));
    const seq = traderSeq(out);
    const late = [...new Set(seq)].slice(-3);
    // A follow, a like and an activity event, all made an hour before asOf.
    await f.sql`insert into follows (viewer_id, trader_id, created_at) values (${v}, ${late[0]}, now() - interval '1 hour')`;
    const t = await f.trade(late[1]);
    await f.sql`insert into trade_likes (viewer_id, trade_key, trader_id, created_at) select ${v}, trade_key, user_id, now() - interval '1 hour' from closed_trades where id = ${t.id}`;
    await a.setActivity(v, true);
    await f.sql`insert into discovery_events (viewer_id, at, surface, type, target_kind, target_user_id) values (${v}, now() - interval '1 hour', 1, 3, 'trader', ${late[2]})`;
    const on = await pages((after) => loadFeedPage(after, { ids: f.traders, now, viewer: v, personal: personalFor(v) }));
    assert.ok(on[0].personal, 'On: the choices count');
    assert.notDeepEqual(sells(on), sells(out), 'On changes the order');
    for (const tr of late) assert.ok(traderSeq(on).indexOf(tr) < seq.indexOf(tr), `trader ${tr} moves up`);
    await a.setPersonalize(v, false);
    const off = await pages((after) => loadFeedPage(after, { ids: f.traders, now, viewer: v, personal: personalFor(v) }));
    assert.deepEqual(sells(off), sells(out), 'Off: exactly the order everyone gets (no hides here)');
    assert.ok(off.every((p) => p.personal === undefined));
  } finally { await f.remove(); }
});

dbTest('two viewers: viewer A\'s order never reaches viewer B, who with no signals gets the signed-out order', async () => {
  const f = await fixture(40, { viewers: 2 });
  const { loadFeedPage } = await import('./feed.ts');
  const { personalFor, loadPersonal } = await import('./discovery/personal-load.ts');
  const { follow } = await import('./follows.ts');
  const { like } = await import('./likes.ts');
  const [A, B] = f.viewers;
  try {
    await follow(A, f.traders.at(-1)!);
    assert.ok(await like(A, (await f.trade(f.traders.at(-2)!)).id));
    const now = Date.now() + 5_000;
    const out = await pages((after) => loadFeedPage(after, { ids: f.traders, now }));
    const a = await pages((after) => loadFeedPage(after, { ids: f.traders, now, viewer: A, personal: personalFor(A) }));
    assert.ok(a[0].personal);
    assert.notDeepEqual(sells(a), sells(out), 'A\'s order is personal');
    const b = await pages((after) => loadFeedPage(after, { ids: f.traders, now, viewer: B, personal: personalFor(B) }));
    assert.deepEqual(sells(b), sells(out));
    assert.ok(b.every((p) => p.personal === undefined));
    const pb = await loadPersonal(B, new Date(now));
    assert.ok(pb.personalize && pb.profile.signals === 0 && pb.profile.follows.size === 0 && pb.profile.direct.size === 0);
    // A again after B: still A's own order (the kept personal list is keyed by viewer).
    const a2 = await pages((after) => loadFeedPage(after, { ids: f.traders, now, viewer: A, personal: personalFor(A) }));
    assert.deepEqual(sells(a2), sells(a));
  } finally { await f.remove(); }
});

dbTest('a personal loader that throws gives the impersonal page, never an error', async () => {
  const f = await fixture(40);
  const { loadFeedPage } = await import('./feed.ts');
  const err = console.error;
  try {
    const now = Date.now();
    const out = await loadFeedPage(undefined, { ids: f.traders, now });
    console.error = () => {};
    const p = await loadFeedPage(undefined, { ids: f.traders, now, viewer: f.viewer, personal: async () => { throw new Error('boom'); } });
    console.error = err;
    assert.deepEqual(p.cards.map((c) => c.sell_id), out.cards.map((c) => c.sell_id));
    assert.equal(p.personal, undefined);
  } finally { console.error = err; await f.remove(); }
});

dbTest('section with signals: page.personal is set, rows read in evidence order (weight, closes, trader), and every "similar holding period" row names a followed or liked trader with the row\'s holding bucket', async () => {
  const f = await fixture(40);
  const { loadFeedPage, feedList } = await import('./feed.ts');
  const { personalFor } = await import('./discovery/personal-load.ts');
  const { byEvidence, holdBucket } = await import('./discovery/section.ts');
  const { follow } = await import('./follows.ts');
  const { like } = await import('./likes.ts');
  try {
    const F = f.traders[1]; // HOLDS[1] = 3 days
    const L = f.traders[3]; // HOLDS[3] = 60 days
    await follow(f.viewer, F);
    assert.ok(await like(f.viewer, (await f.trade(L)).id));
    const now = Date.now() + 5_000;
    const p = await loadFeedPage(undefined, { ids: f.traders, now, viewer: f.viewer, personal: personalFor(f.viewer) });
    assert.ok(p.personal && p.personal.signals >= 2);
    assert.ok(p.section && p.section.length === 3, 'a section');
    const { pool } = await feedList({ asOf: p.asOf, day: p.asOf.toISOString().slice(0, 10), ids: f.traders });
    const facts = new Map(pool.map((t) => [t.trader, t]));
    const rows = p.section!.map((r) => facts.get(r.userId)!);
    assert.ok(rows.every(Boolean));
    for (let i = 1; i < rows.length; i++) assert.ok(byEvidence(rows[i - 1], rows[i]) <= 0, JSON.stringify(rows));
    const named = new Map([[f.handle(F), F], [f.handle(L), L]]);
    const similar = p.section!.filter((r) => r.why?.kind === 'similarHold');
    assert.ok(similar.length >= 1, JSON.stringify(p.section));
    for (const r of similar) {
      const h = (r.why as { handle: string }).handle;
      assert.ok(named.has(h), h);
      assert.equal(holdBucket(facts.get(named.get(h)!)!.hold), holdBucket(facts.get(r.userId)!.hold));
      assert.notEqual(named.get(h), r.userId);
    }
    assert.ok(!p.section!.some((r) => r.userId === F), 'a followed trader is never suggested');
  } finally { await f.remove(); }
});

dbTest('guard: every personal read of follows, viewer_exclusions, trade_likes, trade_exclusions or discovery_events carries the viewer\'s id; signed out none of them runs', async () => {
  const f = await fixture(40);
  const { loadFeedPage } = await import('./feed.ts');
  const { loadFeedPage: pagePersonal } = await import('./discovery/personal-feed.ts');
  const { personalFor } = await import('./discovery/personal-load.ts');
  const { follow, exclude } = await import('./follows.ts');
  const { like, rejectTrade } = await import('./likes.ts');
  const a = await import('./discovery/activity.ts');
  const v = f.viewer;
  try {
    await follow(v, f.traders[5]);
    await exclude(v, f.traders[6], 'not_interested');
    assert.ok(await like(v, (await f.trade(f.traders[7])).id));
    assert.ok(await rejectTrade(v, (await f.trade(f.traders[8])).id));
    await a.setActivity(v, true);
    assert.equal(await a.recordEvents(v, [ev('dwell_long', { kind: 'trader', handle: f.handle(f.traders[9]) })]), 1);
    const now = Date.now() + 5_000;
    resetLog();
    const p1 = await loadFeedPage(undefined, { ids: f.traders, now, viewer: v, personal: personalFor(v) });
    await loadFeedPage(p1.next!, { ids: f.traders, now, viewer: v, personal: personalFor(v) });
    const touched = log.map((q, i) => ({ q, p: params[i] })).filter((x) => VIEWER_TABLES.test(x.q));
    for (const t of ['follows', 'viewer_exclusions', 'trade_likes', 'trade_exclusions', 'discovery_events']) assert.ok(touched.some((x) => new RegExp(`\\b${t}\\b`).test(x.q)), `${t} is read signed in`);
    for (const x of touched) assert.ok((x.p ?? []).some((y) => String(y) === String(v)), x.q);
    resetLog();
    const s1 = await loadFeedPage(undefined, { ids: f.traders, now });
    await loadFeedPage(s1.next!, { ids: f.traders, now });
    await pagePersonal(undefined, {});
    assert.ok(log.length > 0);
    assert.deepEqual(log.filter((q) => VIEWER_TABLES.test(q) || /users\s+where\s+id\s*=.*personalize|personalize_feed|activity_log_on_at/.test(q)), []);
  } finally { await f.remove(); }
});

// ---- Deletion, purge, hidden trades ----

dbTest('deletion: deleting a viewer and a trader leaves no discovery_events row made by or naming either', async () => {
  const f = await fixture(3, { viewers: 2 });
  const { deleteProfile } = await import('./delete.ts');
  const [V, W] = f.viewers, [T, U] = f.traders;
  const del = async (id: number) => {
    const [u] = await f.sql`select id, handle, snaptrade_user_id, snaptrade_secret_enc from users where id = ${id}`;
    await deleteProfile(u as unknown as Parameters<typeof deleteProfile>[0], { deleteVendorUser: async () => {} });
    return u.handle as string;
  };
  const refs = (id: number) => f.sql`select count(*)::int as n from discovery_events where viewer_id = ${id} or target_user_id = ${id}`.then((r) => r[0].n as number);
  const gone: string[] = [];
  try {
    const tk = (await f.trade(T)).trade_key;
    await f.sql`insert into discovery_events (viewer_id, surface, type, target_kind, target_user_id, target_trade_key) values
      (${V}, 1, 3, 'trader', ${T}, null), (${V}, 1, 5, 'trade', ${T}, ${tk}), (${V}, 1, 3, 'trader', ${U}, null),
      (${W}, 2, 6, 'trader', ${T}, null), (${W}, 1, 3, 'trader', ${U}, null)`;
    assert.equal(await refs(V), 3);
    gone.push(await del(V));
    assert.equal(await refs(V), 0);
    assert.equal(await refs(T), 1);
    gone.push(await del(T));
    assert.equal(await refs(T), 0);
    assert.equal(await refs(W), 1, 'other rows are kept');
  } finally {
    await f.remove();
    if (gone.length) await f.sql`delete from handle_reservations where handle in ${f.sql(gone)}`;
  }
});

async function purgeOnce() {
  const { purgeDiscovery } = await import('./discovery/purge.ts');
  for (let i = 0; i < 60; i++) {
    const r = await purgeDiscovery();
    if (r.ran && r.done) return r;
    await new Promise((res) => setTimeout(res, 250));
  }
  throw new Error('the purge never ran to the end');
}

dbTest('purge: a "Not interested" that ran its 90 days stays stored (listed, removable); one the viewer ended goes a day later; an orphaned like is marked, kept, deleted 30 days on, and unmarked when its close comes back', async () => {
  const f = await fixture(4);
  const { exclude, endExclusion, expiredHides, removeExpiredHide } = await import('./follows.ts');
  const { tradeKey } = await import('./likes.ts');
  const v = f.viewer, [N, E, T, R] = f.traders;
  const excl = (t: number) => f.sql`select count(*)::int as n from viewer_exclusions where viewer_id = ${v} and trader_id = ${t}`.then((r) => r[0].n as number);
  const likeRow = (k: string) => f.sql`select orphan_at from trade_likes where viewer_id = ${v} and trade_key = ${k}`;
  try {
    await f.sql`insert into viewer_exclusions (viewer_id, trader_id, created_at, until, reason)
      values (${v}, ${N}, now() - interval '190 days', now() - interval '100 days', 'not_interested')`;
    await exclude(v, E, 'not_interested');
    await endExclusion(v, E);
    await f.sql`update viewer_exclusions set until = now() - interval '2 days', ended_at = now() - interval '2 days' where viewer_id = ${v} and trader_id = ${E}`;
    // Orphans: a like whose close is gone (k1), and one whose close comes back (k2).
    const k1 = tradeKey(`${f.tag}-gone-1`), s2 = `${f.tag}-back-2`, k2 = tradeKey(s2);
    await f.sql`insert into trade_likes (viewer_id, trade_key, trader_id) values (${v}, ${k1}, ${T}), (${v}, ${k2}, ${R})`;
    await purgeOnce();
    assert.equal(await excl(N), 1, 'a hide that ran its 90 days is never deleted on a timer');
    assert.equal(await excl(E), 0, 'one the viewer ended goes a day later');
    const l1 = await likeRow(k1), l2 = await likeRow(k2);
    assert.equal(l1.length, 1);
    assert.ok(l1[0].orphan_at !== null, 'marked');
    assert.ok(l2[0].orphan_at !== null, 'marked');
    // The listed expired hide, and Remove.
    const listed = await expiredHides(v);
    assert.deepEqual(listed.map((r) => r.handle), [f.handle(N)]);
    await removeExpiredHide(v, N);
    assert.equal(await excl(N), 0);
    // k1 still gone 31 days on: deleted. k2's close comes back: unmarked, kept.
    await f.sql`update trade_likes set orphan_at = now() - interval '31 days' where viewer_id = ${v} and trade_key = ${k1}`;
    await f.sql`insert into closed_trades (user_id, sell_id, account_id, symbol, opened_at, closed_at, return_pct, holding_days, verified)
      values (${R}, ${s2}, 'a', 'PB', now() - interval '3 days', now() - interval '2 days', 0.01, 1, true)`;
    await purgeOnce();
    assert.equal((await likeRow(k1)).length, 0);
    const back = await likeRow(k2);
    assert.equal(back.length, 1);
    assert.equal(back[0].orphan_at, null);
  } finally { await f.remove(); }
});

dbTest('hidden trades: a rejected trade is counted and listed; "Show again" removes it and restores its like; backHandle names the trader only when not hidden', async () => {
  const f = await fixture(2);
  const { like, rejectTrade, hiddenTradeCount, ownHiddenTrades, showTradeAgain, backHandle } = await import('./likes.ts');
  const v = f.viewer, T = f.traders[0];
  try {
    const c = await f.trade(T);
    assert.ok(await like(v, c.id));
    assert.equal(await hiddenTradeCount(v), 0);
    assert.equal(await backHandle(v, c.trade_key), f.handle(T));
    assert.ok(await rejectTrade(v, c.id));
    assert.equal((await f.sql`select count(*)::int as n from trade_likes where viewer_id = ${v}`)[0].n, 0);
    assert.equal(await hiddenTradeCount(v), 1);
    const listed = await ownHiddenTrades(v);
    assert.deepEqual(listed.rows.map((r) => [r.key, r.handle, r.sellId]), [[c.trade_key, f.handle(T), c.sell_id]]);
    assert.equal(listed.next, null);
    assert.equal(await backHandle(v, c.trade_key), null);
    assert.equal(await backHandle(v, 'not-a-key'), null);
    assert.ok(await showTradeAgain(v, c.trade_key));
    assert.equal(await hiddenTradeCount(v), 0);
    assert.deepEqual((await ownHiddenTrades(v)).rows, []);
    assert.equal((await f.sql`select count(*)::int as n from trade_likes where viewer_id = ${v} and trade_key = ${c.trade_key}`)[0].n, 1, 'the like is back');
    assert.equal(await backHandle(v, c.trade_key), f.handle(T));
    assert.equal(await showTradeAgain(v, 'x'), false);
  } finally { await f.remove(); }
});
