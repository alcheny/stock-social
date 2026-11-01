// F-24 final orchestrator review:
// R2 (lib/trades.ts): once a held row of a pair is reached in the canonical replay order, every later sell of the pair is
//    counted (excludedHeld) and a rename carries the mark; a held row opens no lot; a held sell is counted only when no
//    counted unheld twin stands for it. So no shown close depends on how a held row is decided (H3, H4, the fuzz).
// R1 (lib/reconcile.ts, lib/sync.ts): a row the count rule decided suspected is a duplicate, left out of the rebuild;
//    pending, confirm and give-up rows (suspected, undecided) are held (H5, the busy give-up).
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { matchTrades, type Activity } from './trades.ts';
import type { CorporateAction } from './corporate-actions.ts';

const hasDb = !!process.env.DATABASE_URL;
const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL', timeout: 180_000 }, fn);
before(async () => { if (hasDb) await (await import('./db.ts')).sql.unsafe(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')).simple(); });
after(async () => { if (hasDb) await (await import('./db.ts')).sql.end({ timeout: 1 }); });

const HOUR = 3_600_000, DAY = 24 * HOUR;
const base = Date.now() - 40 * DAY;
const shiftAt = (h: number) => base + h * HOUR - Date.now();
const at = (d: number) => new Date(base + d * DAY);

type Row = { externalId: string; accountId: string; symbol: string; side: 'BUY' | 'SELL'; units: number; price: number; fee: number; executedAt: Date; verified: boolean; raw: unknown };

async function trader() {
  const { sql } = await import('./db.ts');
  const { createAttempt, createUserForAttempt } = await import('./auth/attempts.ts');
  const { syncUser, insertActivities } = await import('./sync.ts');
  const { rebuildRecord } = await import('./options-sync.ts');
  const tag = `rf${Math.random().toString(36).slice(2, 9)}`;
  const u = await createUserForAttempt(await createAttempt({ method: 'dev', attested: true }), { handle: `${tag}u` });
  await sql`update users set snaptrade_user_id = ${`${tag}-v`}, snaptrade_secret_enc = 'enc' where id = ${u.id}`;
  const acc = { id: `${tag}-a`, authorizationId: 'a', institution: 'x', isPaper: false, initialSyncCompleted: true };
  await sql`insert into connections (attempt_id, user_id, vendor_authorization_id, state, consent_at, importing_at, connected_at, accounts, options_backfilled_at)
    select signup_attempt_id, id, 'a', 'connected', now() - interval '400 days', now() - interval '400 days', now() - interval '400 days', ${sql.json([acc])}, now()
    from users where id = ${u.id}`;
  const user = { id: u.id, snaptrade_user_id: `${tag}-v`, snaptrade_secret_enc: 'enc' };
  const row = (id: string, side: 'BUY' | 'SELL', units: number, price: number, date: Date, symbol = 'XX'): Row => ({
    externalId: `${tag}-${id}`, accountId: acc.id, symbol, side, units, price, fee: 0, executedAt: date, verified: true, raw: { type: side },
  });
  // `read` (if set) replaces the activities call (a fake that pages internally); every call is recorded with its round.
  const v = { list: [] as Row[], read: null as null | ((since: Date, sink?: (r: unknown[]) => void) => Row[]), calls: [] as { h: number; kind: 'read' | 'page'; since?: Date; offset?: number }[], h: 0 };
  const broker = {
    pageLimit: 60,
    listAccounts: async () => [acc],
    fetchActivities: async (_u: unknown, since: Date, ids?: string[], sink?: (r: unknown[]) => void) => {
      v.calls.push({ h: v.h, kind: 'read', since });
      if (v.read) return v.read(since, sink);
      return v.list.filter((r) => (ids ?? []).includes(r.accountId) && r.executedAt >= since);
    },
    fetchActivitiesPage: async (_u: unknown, id: string, offset: number, limit = 60) => {
      v.calls.push({ h: v.h, kind: 'page', offset });
      const activities = v.list.filter((r) => r.accountId === id).slice(offset, offset + limit);
      return { activities, unusable: [], done: activities.length < limit };
    },
  };
  const inSync: number[] = [];
  const rebuild = async (id: number, tx: import('postgres').TransactionSql) => {
    await rebuildRecord(id, tx);
    inSync.push((await tx`select count(*)::int as n from closed_trades where user_id = ${id} and symbol = 'XX'`)[0].n);
  };
  const round = (h: number) => { v.h = h; return syncUser(user, broker as never, rebuild, undefined, { cadence: true, shiftMs: shiftAt(h) }); };
  const due = (when: string = '2000-01-01') => sql`update broker_accounts set reconcile_due_at = ${when} where account_id = ${acc.id}`;
  const closes = async () => (await sql`select sell_id from closed_trades where user_id = ${u.id} and symbol = 'XX' order by sell_id`).map((r) => r.sell_id as string);
  const state = async (id: string) => (await sql`select state from activity_reissues where source = 'snaptrade' and external_id = ${`${tag}-${id}`}`)[0]?.state ?? null;
  const cleanup = async () => { await sql`delete from users where id = ${u.id}`; await sql`delete from broker_accounts where account_id = ${acc.id}`; };
  return { sql, tag, user, acc, v, broker, row, round, due, closes, state, inSync, cleanup, store: (r: Row[]) => insertActivities(u.id, 'snaptrade', r) };
}
type T = Awaited<ReturnType<typeof trader>>;

const DAYS = (d: number) => new Date(Date.UTC(2026, 0, 1) + d * DAY);
const act = (id: string, side: 'BUY' | 'SELL', units: number, price: number, d: number, o: { held?: boolean; symbol?: string; account?: string } = {}): Activity => ({
  externalId: id, accountId: o.account ?? 'A', symbol: o.symbol ?? 'XX', side, units, price, fee: 0, executedAt: DAYS(d), verified: true, ...(o.held ? { held: true } : {}),
});
const unheld = (a: Activity): Activity => { const { held: _h, ...r } = a; return r; };
const shownBy = (r: ReturnType<typeof matchTrades>) => new Map(r.trades.map((t) => [t.sellId, t.returnPct]));

test('H3: a held sell and its unheld twin at one instant (the held one first in the order): the twin is counted, never shown at a figure the reading decides', () => {
  const b1 = act('b1', 'BUY', 10, 5, 0), b2 = act('b2', 'BUY', 10, 10, 1);
  const sh = act('s-h', 'SELL', 10, 12, 5, { held: true }), sz = act('s-z', 'SELL', 10, 12, 5);
  const r = matchTrades([b1, b2, sh, sz]);
  assert.deepEqual(r.trades, [], 'no close shown');
  assert.equal(r.excludedHeld, 1, 's-z counted; s-h stands on its counted twin (one real sell counted once)');
  assert.equal(r.excluded, 0);
  // Why: the twin's figure depends on the reading.
  const genuine = shownBy(matchTrades([b1, b2, unheld(sh), sz])), dropped = shownBy(matchTrades([b1, b2, sz]));
  assert.ok(Math.abs(dropped.get('s-z')! - 1.4) < 1e-9, 'dropped: s-z +140% from the 5 lot');
  assert.ok(Math.abs(genuine.get('s-z')! - 0.2) < 1e-9, 'genuine: s-z +20% from the 10 lot');
});

test('H4: a held buy, then a rename OLD → NEW: the new symbol\'s later sell is counted (the rename carries the mark), never +60%', () => {
  const b0 = act('b0', 'BUY', 10, 5, 0, { symbol: 'OLD' }), e = act('e', 'BUY', 10, 10, 1, { symbol: 'OLD' });
  const n = act('n', 'BUY', 10, 10, 1, { symbol: 'OLD', held: true }), s1 = act('s1', 'SELL', 10, 12, 2, { symbol: 'OLD' });
  const s2 = act('s2', 'SELL', 20, 12, 40, { symbol: 'NEW' });
  const rename: CorporateAction = { kind: 'symbol-change', externalId: 'r', accountId: 'A', symbol: 'OLD', executedAt: DAYS(20), newSymbol: 'NEW', outUnits: 20, inUnits: 20 };
  const r = matchTrades([b0, e, n, s1, s2], [rename]);
  assert.ok(!r.trades.some((t) => t.sellId === 's2'), 's2 not shown');
  assert.ok(!r.trades.some((t) => t.sellId === 's1'), 's1 (after the held buy) not shown');
  assert.equal(r.excludedHeld, 2, 's1 and s2 counted');
  // Under the drop, 10 shares are left after s1 and the rename moves them... the reading decides s2's figure:
  const genuine = shownBy(matchTrades([b0, e, unheld(n), s1, s2], [rename]));
  const dropped = matchTrades([b0, e, s1, s2], [rename]);
  assert.ok(genuine.has('s2'), 'genuine: s2 priced from the 10 lots');
  assert.ok(!shownBy(dropped).has('s2') || Math.abs(shownBy(dropped).get('s2')! - genuine.get('s2')!) > 1e-9, 'the readings differ for s2');
});

// A small deterministic PRNG (mulberry32).
const prng = (seed: number) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

test('fuzz (2,000 seeded cases): order independence; every unheld sell counted once and held sells only without a counted twin; no held sell shown; every shown close identical under both readings', () => {
  const sig = (a: Activity) => `${a.accountId}|${a.symbol}|${a.executedAt.getTime()}|${a.units}|${a.price}`;
  for (let seed = 1; seed <= 2000; seed++) {
    const rnd = prng(seed);
    const pick = <X>(xs: X[]) => xs[Math.floor(rnd() * xs.length)];
    const pairs = ['P', 'Q', 'R'].slice(0, 1 + Math.floor(rnd() * 3));
    const rows: Activity[] = [];
    const n = 4 + Math.floor(rnd() * 12);
    for (let i = 0; i < n; i++) {
      const id = `${Math.floor(rnd() * 1e6).toString(36)}-${i}`;
      if (rows.length && rnd() < 0.3) { // a twin of an earlier row under a new id
        const t = pick(rows);
        rows.push({ ...unheld(t), externalId: id, ...(rnd() < 0.5 ? { held: true } : {}) });
        continue;
      }
      rows.push(act(id, rnd() < 0.55 ? 'BUY' : 'SELL', pick([5, 10]), pick([5, 10, 12]), Math.floor(rnd() * 8), { symbol: pick(pairs), ...(rnd() < 0.15 ? { held: true } : {}) }));
    }
    const ctx = `seed ${seed}: ${JSON.stringify(rows.map((r) => [r.externalId, r.symbol, r.side, r.units, r.price, r.executedAt.getTime() / DAY % 1000, !!r.held]))}`;
    const r = matchTrades(rows);
    // (a) order independence
    const shuffled = [...rows];
    for (let i = shuffled.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]; }
    assert.deepEqual(matchTrades(shuffled), r, `(a) ${ctx}`);
    // (c) no held sell shown
    const heldIds = new Set(rows.filter((a) => a.held).map((a) => a.externalId));
    assert.ok(!r.trades.some((t) => heldIds.has(t.sellId)), `(c) ${ctx}`);
    // (b) partition
    const shownIds = new Set(r.trades.map((t) => t.sellId));
    const unheldSells = rows.filter((a) => a.side === 'SELL' && !a.held);
    const countedBySig = new Map<string, number>();
    for (const a of unheldSells) if (!shownIds.has(a.externalId)) countedBySig.set(sig(a), (countedBySig.get(sig(a)) ?? 0) + 1);
    const heldBySig = new Map<string, number>();
    for (const a of rows) if (a.side === 'SELL' && a.held) heldBySig.set(sig(a), (heldBySig.get(sig(a)) ?? 0) + 1);
    let extra = 0;
    for (const [k, h] of heldBySig) extra += Math.max(0, h - (countedBySig.get(k) ?? 0));
    assert.equal(r.trades.length + r.excluded + r.excludedCorporate + (r.excludedHeld ?? 0), unheldSells.length + extra, `(b) ${ctx} -> ${JSON.stringify({ trades: r.trades.length, excluded: r.excluded, held: r.excludedHeld })}`);
    // (d) both readings
    const genuine = shownBy(matchTrades(rows.map(unheld)));
    const dropped = shownBy(matchTrades(rows.filter((a) => !a.held)));
    for (const t of r.trades) {
      assert.equal(genuine.get(t.sellId), t.returnPct, `(d) genuine ${t.sellId} ${ctx}`);
      assert.equal(dropped.get(t.sellId), t.returnPct, `(d) dropped ${t.sellId} ${ctx}`);
    }
  }
});

dbTest('H5: every row re-listed under a new id (originals gone): while pending the count never exceeds the real sells; the passes decide the new rows duplicates (suspected, decided): the 2 original closes shown, excluded_held 0', async () => {
  const t = await trader();
  try {
    const rows = [t.row('b1', 'BUY', 10, 10, at(-26)), t.row('s1', 'SELL', 10, 12, at(-25)), t.row('b2', 'BUY', 10, 8, at(-24)), t.row('s2', 'SELL', 10, 6, at(-23))];
    await t.store(rows);
    t.v.list = rows;
    await t.round(0);
    assert.deepEqual(await t.closes(), [rows[1].externalId, rows[3].externalId]);
    t.v.list = rows.map((r) => ({ ...r, externalId: `${r.externalId}-new`, raw: { ...(r.raw as object), id: `${r.externalId}-new` } }));
    const heldCount = async () => (await t.sql`select excluded_held as n, excluded_positions as p from users where id = ${t.user.id}`)[0];
    const counts: number[] = [];
    for (let h = 25, passes = 0; passes < 2 && h < 400; h += 25) {
      await t.due();
      const pages = t.v.calls.filter((c) => c.kind === 'page').length;
      await t.round(h);
      if (t.v.calls.filter((c) => c.kind === 'page').length > pages) passes++;
      const c = await heldCount();
      counts.push(c.n);
      assert.ok(c.n + (await t.closes()).length <= 2, `h${h}: shown + counted never exceeds the 2 real sells (held ${c.n})`);
      assert.equal(c.p, 0, `h${h}: nothing counted as "no recorded entry"`);
    }
    const st = await t.sql`select external_id, state, undecided from activity_reissues where user_id = ${t.user.id} order by external_id`;
    assert.deepEqual(st.map((r) => [r.external_id, r.state, r.undecided]), rows.map((r) => [`${r.externalId}-new`, 'suspected', false]).sort((a, b) => (a[0] < b[0] ? -1 : 1)));
    assert.deepEqual(await t.closes(), [rows[1].externalId, rows[3].externalId], 'the 2 original closes');
    assert.equal((await heldCount()).n, 0, 'excluded_held 0');
    assert.ok(t.inSync.every((x) => x <= 2), `never more than 2 closes: ${t.inSync.join(',')}`);
  } finally { await t.cleanup(); }
});

dbTest('give-up held: a busy account\'s give-up row (suspected, undecided) keeps its pair\'s later sells counted, never dropped as a duplicate', async () => {
  const t = await trader();
  const { PAGE_LIMIT } = await import('./broker.ts');
  try {
    const b1 = t.row('b1', 'BUY', 30, 10, at(-40)), f1 = t.row('f1', 'SELL', 10, 8, at(-30)), f2 = t.row('f2', 'SELL', 10, 8, at(-30));
    const s = t.row('s', 'SELL', 10, 12, at(-29.5)); // the pair's later sell
    const fill = Array.from({ length: 1100 }, (_, i) => t.row(`fl${i}`, 'BUY', 1, 5, at(-29 + i / 80), 'FL'));
    const stored = [b1, f1, s, ...fill];
    await t.store(stored);
    t.v.list = stored;
    t.broker.pageLimit = 600;
    await t.round(0);
    assert.deepEqual(await t.closes(), [f1.externalId, s.externalId].sort());
    t.v.list = [...stored, f2];
    await t.due();
    for (const h of [25, 50, 75]) await t.round(h);
    assert.equal(await t.state('f2'), 'confirm');
    assert.ok(stored.length >= PAGE_LIMIT);
    await t.round(100); // busy: given up, no widened read
    const [r] = await t.sql`select state, undecided from activity_reissues where external_id = ${f2.externalId}`;
    assert.deepEqual([r.state, r.undecided], ['suspected', true], 'a give-up: suspected, undecided');
    assert.deepEqual(await t.closes(), [f1.externalId], 'the later sell is not shown on a guess');
    assert.equal((await t.sql`select excluded_held as n from users where id = ${t.user.id}`)[0].n, 2, 'the later sell and the held sell (its twin F1 is shown) counted');
    await t.round(125); // and it stays so on the next rebuild
    assert.deepEqual(await t.closes(), [f1.externalId]);
  } finally { await t.cleanup(); }
});
