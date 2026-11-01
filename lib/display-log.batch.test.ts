// Known-limits sweep 2 (display-log): the set-based writer (lib/display-log.ts#writeDisplayLog, #snapshotsFor).
// The gate: its rows are byte-for-byte the rows today's per-trader snapshotFor wrote (a verbatim copy is kept below).
// Every import of ./db.ts is dynamic, after a counting client is installed as the shared pool (lib/db.ts reuses
// globalThis.sql), so the query count per chunk is measured on the real client, not inferred from timing.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import postgres from 'postgres';

const hasDb = !!process.env.DATABASE_URL;
let queries = 0;
if (hasDb) (globalThis as unknown as { sql?: postgres.Sql }).sql ??= postgres(process.env.DATABASE_URL!, { onnotice: () => {}, debug: () => { queries++; } });
const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL' }, fn);
const DAY = 86_400_000;
const made: number[] = [];
const attempts: number[] = [];
const accounts: string[] = [];
const tag = `kb${Math.random().toString(36).slice(2, 7)}`;

before(async () => { if (hasDb) await (await import('./privacy-test-schema.ts')).applySchemaForTests(); });
after(async () => {
  if (!hasDb) return;
  const { sql } = await import('./db.ts');
  if (made.length) await sql`delete from connections where user_id in ${sql(made)}`;
  if (accounts.length) await sql`delete from broker_accounts where account_id in ${sql(accounts)}`;
  if (made.length) await sql`delete from users where id in ${sql(made)}`;
  if (attempts.length) await sql`delete from signup_attempts where id in ${sql(attempts)}`;
  await sql.end({ timeout: 1 });
});

let seq = 0;
async function person(): Promise<{ id: number; attempt: number }> {
  const { sql } = await import('./db.ts');
  const [{ id: attempt }] = await sql`insert into signup_attempts (method, adult_attested_at) values ('dev', now()) returning id`;
  attempts.push(Number(attempt));
  const [{ id }] = await sql`insert into users (handle, display_name, adult_attested_at, signup_attempt_id) values (${`${tag}${seq++}`}, 'Batch', now(), ${attempt}) returning id`;
  made.push(id as number);
  return { id: id as number, attempt: Number(attempt) };
}
type T = { symbol: string; openedDaysAgo: number; closedDaysAgo: number; r: number; hold?: number };
// Inserted in the profile's order (closed_at desc; every close in a record at a distinct time), so the unmodified
// per-trader read (no ORDER BY: heap order = insertion order for fresh rows) sees the same order as the batch read.
async function trades(u: number, list: T[], now: Date, order: 'profile' | 'shuffled' = 'profile') {
  const { sql } = await import('./db.ts');
  const rows = [...list].sort((a, b) => a.closedDaysAgo - b.closedDaysAgo);
  if (order === 'shuffled') rows.reverse();
  for (const [i, t] of rows.entries()) {
    await sql`insert into closed_trades (user_id, sell_id, account_id, symbol, opened_at, closed_at, return_pct, holding_days, verified)
      values (${u}, ${`${tag}-${u}-${i}`}, 'acct', ${t.symbol}, ${new Date(now.getTime() - t.openedDaysAgo * DAY)}, ${new Date(now.getTime() - t.closedDaysAgo * DAY)}, ${t.r}, ${t.hold ?? t.openedDaysAgo - t.closedDaysAgo}, true)`;
  }
}
async function positions(u: number, list: [string, string, number][]) {
  const { sql } = await import('./db.ts');
  for (const [a, s, p] of list) await sql`insert into open_positions (user_id, account_id, symbol, unrealized_pct) values (${u}, ${a}, ${s}, ${p})`;
}
async function legacyAccount(u: number) {
  const { sql } = await import('./db.ts');
  const id = `${tag}-acct-${u}`;
  accounts.push(id);
  await sql`insert into broker_accounts (account_id, user_id, confirmed_at) values (${id}, ${u}, now())`;
}
async function connection(p: { id: number; attempt: number }, state: 'importing' | 'failed' | 'connected') {
  const { sql } = await import('./db.ts');
  await sql`insert into connections (attempt_id, user_id, state, consent_at) values (${p.attempt}, ${p.id}, ${state}, now())`;
}
async function demo(u: number) {
  const { sql } = await import('./db.ts');
  await sql`insert into activities (user_id, source, external_id, account_id, symbol, side, units, price, executed_at, raw)
    values (${u}, 'demo', ${`${tag}-demo-${u}`}, 'acct', 'DM', 'BUY', 1, 10, now() - interval '60 days', '{}')`;
}

// The per-trader snapshot exactly as lib/display-log.ts had it before this change (git main, :44-59), unmodified.
async function legacySnapshotFor(userId: number, now: Date) {
  const { sql } = await import('./db.ts');
  const { publicRecordDetail } = await import('./connections.ts');
  const { snapshotText } = await import('./display-log.ts');
  const { public: { state } } = await publicRecordDetail(userId);
  if (state === 'importing') return null;
  const trades = await sql`select symbol, opened_at, closed_at, return_pct, holding_days from closed_trades where user_id = ${userId}`;
  const positions = state !== 'none' ? await sql`select account_id, symbol, unrealized_pct from open_positions where user_id = ${userId}` : [];
  if (!trades.length && !positions.length) return null;
  const [d] = await sql`select exists(select 1 from activities where user_id = ${userId} and source = 'demo') as demo`;
  return {
    demo: d.demo as boolean,
    ...snapshotText(
      trades.map((t) => ({ symbol: t.symbol, openedAt: t.opened_at, closedAt: t.closed_at, returnPct: t.return_pct, holdingDays: t.holding_days })),
      positions.map((p) => ({ accountId: p.account_id as string, symbol: p.symbol as string, pct: p.unrealized_pct as number })),
      now,
    ),
  };
}
// The same with the profile's ORDER BY added (the only difference): the reference for records inserted out of order.
async function orderedSnapshotFor(userId: number, now: Date) {
  const { sql } = await import('./db.ts');
  const { publicRecordDetail } = await import('./connections.ts');
  const { snapshotText } = await import('./display-log.ts');
  const { public: { state } } = await publicRecordDetail(userId);
  if (state === 'importing') return null;
  const trades = await sql`select symbol, opened_at, closed_at, return_pct, holding_days from closed_trades where user_id = ${userId} order by closed_at desc, id desc`;
  const positions = state !== 'none' ? await sql`select account_id, symbol, unrealized_pct from open_positions where user_id = ${userId}` : [];
  if (!trades.length && !positions.length) return null;
  const [d] = await sql`select exists(select 1 from activities where user_id = ${userId} and source = 'demo') as demo`;
  return {
    demo: d.demo as boolean,
    ...snapshotText(
      trades.map((t) => ({ symbol: t.symbol, openedAt: t.opened_at, closedAt: t.closed_at, returnPct: t.return_pct, holdingDays: t.holding_days })),
      positions.map((p) => ({ accountId: p.account_id as string, symbol: p.symbol as string, pct: p.unrealized_pct as number })),
      now,
    ),
  };
}
async function rowOf(u: number, day: string) {
  const { sql } = await import('./db.ts');
  const [r] = await sql`select demo, headline, range_text, trade_count, open_summary, evidence from display_log where user_id = ${u} and day = ${day}::date`;
  return r ? { demo: r.demo, headline: r.headline, rangeText: r.range_text, tradeCount: r.trade_count, openSummary: r.open_summary, evidence: r.evidence } : null;
}

// Three closes whose average is exactly on a rounding boundary (-0.0535): summed in one order the float average rounds
// to -5.3%, in the other to -5.4%. This is why the unmodified read (no ORDER BY) is order-dependent, and why the batch
// read uses the profile's order.
const BOUNDARY = [-0.06585, -0.06685, -0.0278];

test('why order matters: snapshotText sums floats in input order, so the same record can print a different last digit', async () => {
  const { snapshotText } = await import('./display-log.ts');
  const today = new Date('2026-11-01T12:00:00Z');
  const closes = BOUNDARY.map((r, i) => ({ symbol: `S${i}`, openedAt: new Date(today.getTime() - (40 + 3 * i) * DAY), closedAt: new Date(today.getTime() - (10 + 3 * i) * DAY), returnPct: r, holdingDays: 30 }));
  assert.equal(snapshotText(closes, [], today).headline, '0% win rate · -5.3% avg return / trade');
  assert.equal(snapshotText([...closes].reverse(), [], today).headline, '0% win rate · -5.4% avg return / trade');
});

test('chunks hold at most the row cap of closed trades; a record over the cap is a chunk by itself; id order is kept', async () => {
  const { chunkByRows } = await import('./display-log.ts');
  assert.deepEqual(chunkByRows([{ id: 1, n: 3 }, { id: 2, n: 3 }, { id: 3, n: 10 }, { id: 4, n: 0 }, { id: 5, n: 4 }], 6), [[1, 2], [3], [4, 5]]);
  assert.deepEqual(chunkByRows([], 6), []);
  assert.deepEqual(chunkByRows([{ id: 1, n: 0 }, { id: 2, n: 0 }], 1), [[1, 2]]);
});

// A spread of records: verified with a range, demo, losses, positions in several accounts (some hidden: state none),
// importing, failed, empty, deleted, positions only, and the rounding-boundary record.
async function fixtures(now: Date, order: 'profile' | 'shuffled') {
  const f: Record<string, number> = {};
  const many: T[] = Array.from({ length: 40 }, (_, g) => ({ symbol: `M${g % 9}`, openedDaysAgo: 300 - g * 7, closedDaysAgo: 290 - g * 7 - (g % 3) / 10, r: ((g * 37) % 41 - 18) / 300 }));
  const p1 = await person(); f.verified = p1.id; await legacyAccount(p1.id); await trades(p1.id, many, now, order); await positions(p1.id, [['b', 'ZZ', -0.031], ['a', 'ZZ', 0.02], ['a', 'AA', 0]]);
  const p2 = await person(); f.demo = p2.id; await demo(p2.id); await trades(p2.id, [{ symbol: 'DLX', openedDaysAgo: 3, closedDaysAgo: 1, r: -0.04 }], now, order);
  const p3 = await person(); f.boundary = p3.id; await legacyAccount(p3.id); await trades(p3.id, BOUNDARY.map((r, i) => ({ symbol: `B${i}`, openedDaysAgo: 40 + 3 * i, closedDaysAgo: 10 + 3 * i, r })), now, order);
  const p4 = await person(); f.none = p4.id; await trades(p4.id, many.slice(0, 7), now, order); await positions(p4.id, [['a', 'HID', 0.5]]);
  const p5 = await person(); f.importing = p5.id; await connection(p5, 'importing'); await trades(p5.id, many.slice(0, 3), now, order);
  const p6 = await person(); f.failed = p6.id; await connection(p6, 'failed'); await trades(p6.id, many.slice(5, 12), now, order); await positions(p6.id, [['x', 'FL', -0.2]]);
  const p7 = await person(); f.connected = p7.id; await connection(p7, 'connected'); await trades(p7.id, many.map((t) => ({ ...t, r: -t.r })), now, order);
  const p8 = await person(); f.positionsOnly = p8.id; await legacyAccount(p8.id); await positions(p8.id, [['a', 'PO', 0.012], ['b', 'PO', -0.012]]);
  const p9 = await person(); f.positionsHidden = p9.id; await positions(p9.id, [['a', 'PH', 0.3]]);
  const p10 = await person(); f.empty = p10.id;
  const p11 = await person(); f.deleted = p11.id; await trades(p11.id, many.slice(0, 2), now, order);
  const { sql } = await import('./db.ts');
  await sql`update users set deleted_at = now() where id = ${p11.id}`;
  return f;
}

dbTest('the gate: the batch writer writes byte-for-byte the rows the unmodified per-trader snapshotFor wrote, for every kind of record', async () => {
  const { writeDisplayLog } = await import('./display-log.ts');
  const now = new Date();
  const day = now.toISOString().slice(0, 10);
  const f = await fixtures(now, 'profile');
  const ids = Object.values(f);
  const want = new Map<number, unknown>();
  for (const id of ids) want.set(id, (await legacySnapshotFor(id, now)) ?? null);
  // The deleted record is excluded by the candidate query (as before), not by snapshotFor.
  want.set(f.deleted, null);
  const r = await writeDisplayLog({ now, ids });
  assert.equal(r.done, true);
  for (const [name, id] of Object.entries(f)) assert.deepEqual(await rowOf(id, day), want.get(id), name);
  assert.equal(r.written, [...want.values()].filter(Boolean).length);
  // The fixture covers what it claims.
  for (const n of ['importing', 'empty', 'deleted', 'positionsHidden']) assert.equal(await rowOf(f[n], day), null, n);
  assert.notEqual((await rowOf(f.verified, day))?.rangeText, null, 'a record with a range');
  assert.match(String((await rowOf(f.verified, day))?.openSummary), /account 1/);
  assert.equal((await rowOf(f.none, day))?.openSummary, 'No open positions', 'state none hides positions');
  assert.equal((await rowOf(f.demo, day))?.demo, true);
  assert.equal((await rowOf(f.boundary, day))?.headline, '0% win rate · -5.3% avg return / trade', 'the profile order (latest close first)');
});

dbTest('records stored out of the profile\'s order: the batch writer equals snapshotFor with the profile\'s ORDER BY (the only change)', async () => {
  const { writeDisplayLog } = await import('./display-log.ts');
  const now = new Date();
  const day = now.toISOString().slice(0, 10);
  const f = await fixtures(now, 'shuffled');
  const ids = Object.values(f);
  const want = new Map<number, unknown>();
  for (const id of ids) want.set(id, (await orderedSnapshotFor(id, now)) ?? null);
  want.set(f.deleted, null);
  await writeDisplayLog({ now, ids });
  for (const [name, id] of Object.entries(f)) assert.deepEqual(await rowOf(id, day), want.get(id), name);
  assert.equal((await rowOf(f.boundary, day))?.headline, '0% win rate · -5.3% avg return / trade', 'same digit however the rows were stored');
});

dbTest('a chunk is split at the row cap and every record still gets exactly one row', async () => {
  const { sql } = await import('./db.ts');
  const { writeDisplayLog } = await import('./display-log.ts');
  const now = new Date();
  const ids: number[] = [];
  for (let i = 0; i < 5; i++) {
    const p = await person(); ids.push(p.id);
    await trades(p.id, Array.from({ length: i + 1 }, (_, g) => ({ symbol: `C${g}`, openedDaysAgo: 30 + g, closedDaysAgo: 10 + g, r: 0.01 * (g - 1) })), now);
  }
  const r = await writeDisplayLog({ now, ids, rowCap: 3 });
  assert.deepEqual(r, { written: 5, done: true });
  const rows = await sql`select user_id, count(*)::int as n from display_log where user_id = any(${ids}) group by 1`;
  assert.equal(rows.length, 5);
  assert.ok(rows.every((x) => x.n === 1));
});

dbTest('box and resume: a call cut after its first chunk returns done:false; the next call writes the rest; no record twice', async () => {
  const { sql } = await import('./db.ts');
  const { writeDisplayLog } = await import('./display-log.ts');
  const now = new Date();
  const ids: number[] = [];
  for (let i = 0; i < 4; i++) {
    const p = await person(); ids.push(p.id);
    await trades(p.id, [{ symbol: 'R', openedDaysAgo: 5, closedDaysAgo: 2, r: 0.02 }], now);
  }
  let t = 0;
  // Clock: 0 sets the end (0 + 2); 1 lets the first chunk run; 2 is past the box at the second chunk.
  const first = await writeDisplayLog({ now, ids, batch: 2, boxMs: 2, clock: () => t++ });
  assert.deepEqual(first, { written: 2, done: false });
  t = 0;
  assert.deepEqual(await writeDisplayLog({ now, ids, batch: 2, boxMs: 2, clock: () => t++ }), { written: 2, done: true }, 'resumes at the records still missing');
  assert.deepEqual(await writeDisplayLog({ now, ids, batch: 2 }), { written: 0, done: true });
  const [{ n, d }] = await sql`select count(*)::int as n, count(distinct user_id)::int as d from display_log where user_id = any(${ids})`;
  assert.deepEqual([n, d], [4, 4]);
});

dbTest('one record that fails does not block its chunk: the chunk is retried one record at a time, the rest are written, the failure is counted', async () => {
  const { sql } = await import('./db.ts');
  const { writeDisplayLog, snapshotsFor } = await import('./display-log.ts');
  const now = new Date();
  const ids: number[] = [];
  for (let i = 0; i < 4; i++) {
    const p = await person(); ids.push(p.id);
    await trades(p.id, [{ symbol: 'F', openedDaysAgo: 5, closedDaysAgo: 2, r: 0.03 }], now);
  }
  const bad = ids[1];
  const snapshots: typeof snapshotsFor = async (chunk, at) => {
    if (chunk.includes(bad)) throw new Error('boom');
    return snapshotsFor(chunk, at);
  };
  const errors = console.error;
  console.error = () => {};
  try {
    assert.deepEqual(await writeDisplayLog({ now, ids, deps: { snapshots } }), { written: 3, done: true, failed: 1 });
  } finally {
    console.error = errors;
  }
  const rows = (await sql`select user_id from display_log where user_id = any(${ids})`).map((r) => r.user_id as number).sort((a, b) => a - b);
  assert.deepEqual(rows, ids.filter((id) => id !== bad).sort((a, b) => a - b));
  // The next tick writes it once it no longer fails.
  assert.deepEqual(await writeDisplayLog({ now, ids }), { written: 1, done: true });
});

dbTest('queries per chunk do not grow with its records (counted on the client): 3 records and 30 records take the same number', async () => {
  const { writeDisplayLog } = await import('./display-log.ts');
  const now = new Date();
  const make = async (k: number) => {
    const ids: number[] = [];
    for (let i = 0; i < k; i++) {
      const p = await person(); ids.push(p.id);
      if (i % 2) await legacyAccount(p.id);
      await trades(p.id, [{ symbol: 'Q', openedDaysAgo: 9, closedDaysAgo: 3, r: -0.01 * i }], now);
      await positions(p.id, [['a', 'QP', 0.01]]);
    }
    return ids;
  };
  const small = await make(3), large = await make(30);
  queries = 0;
  assert.equal((await writeDisplayLog({ now, ids: small })).written, 3);
  const q3 = queries;
  queries = 0;
  assert.equal((await writeDisplayLog({ now, ids: large })).written, 30);
  const q30 = queries;
  assert.equal(q30, q3, `${q3} vs ${q30} queries`);
  // One candidate read, recordStates (2), closed trades, open positions, demo, one insert.
  assert.ok(q3 <= 7, `${q3} queries`);
});
