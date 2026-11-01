// Known-limits sweep 2 (display-log): throughput of the daily display-log writer (lib/display-log.ts#writeDisplayLog).
// 2,000 traders with varied record sizes (0 to 1,000 closed trades, some open positions, some demo, half with a
// confirmed broker account so their positions show): how many records get today's row within one 20 s box, and how
// long until every one has its row.
// Skipped unless LOAD=1, so `npm test` stays fast. How to run (DATABASE_URL set):
//   LOAD=1 node --test lib/display-log.load.test.ts
// Timings print as `# load: …` lines.
// Both writers run in the same process on the same fixture: the writer as it was before this change (one trader at a
// time, ~6 queries each; a verbatim copy below, writing yesterday's rows) and the set-based writer (today's rows). The
// asserted bound is their ratio, so a slower machine or a busy shared database moves both.
// Measured on a development container (2026-11-01, shared database, local socket): see LOAD_MEASURED.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';

const LOAD = process.env.LOAD === '1';
const hasDb = !!process.env.DATABASE_URL;
const loadTest = (name: string, fn: () => Promise<void>) =>
  test(name, { skip: !LOAD ? 'heavy-use suite: set LOAD=1' : !hasDb && 'no DATABASE_URL', timeout: 900_000 }, fn);

export const LOAD_MEASURED = {
  // The unchanged lib/display-log.ts, this test's first version (its own run, before any edit): 2,000 rows in 6,197 ms.
  before: { perSecond: [323, 116] }, // unchanged code alone (quiet database); the same-run copy (busy database)
  after: { perSecond: [1_048, 643, 467, 563] }, // four runs; the last is the same run as 116 (speedup 4.84x)
};
// The bound (asserted): the set-based writer is at least this many times faster than the per-trader one, same run.
export const MIN_SPEEDUP = 1.5;

const TRADERS = 2_000;
const SIZES = [0, 1, 1, 5, 10, 10, 30, 100, 100, 1_000]; // closed trades by i % 10 (0 = open positions only)
const tag = `dz${Math.random().toString(36).slice(2, 8)}`;
const log = (s: string) => console.log(`# load: ${s}`);
let ids: number[] = [];
let attempt = 0;

before(async () => {
  if (!LOAD || !hasDb) return;
  const { applySchemaForTests } = await import('./privacy-test-schema.ts');
  await applySchemaForTests();
  const { sql } = await import('./db.ts');
  const t0 = performance.now();
  [{ id: attempt }] = await sql`insert into signup_attempts (method, adult_attested_at) values ('dev', now()) returning id`;
  ids = (await sql`insert into users (handle, display_name, adult_attested_at, signup_attempt_id)
    select ${tag} || i, 'Load ' || i, now(), ${attempt} from generate_series(0, ${TRADERS - 1}) i returning id`).map((r) => r.id as number).sort((a, b) => a - b);
  const sized = ids.map((id, i) => ({ id, i, n: SIZES[i % SIZES.length] }));
  for (let k = 0; k < sized.length; k += 200) {
    const part = sized.slice(k, k + 200);
    await sql`insert into closed_trades (user_id, sell_id, account_id, symbol, opened_at, closed_at, return_pct, holding_days, verified)
      select u.id, ${tag} || '-' || u.id || '-' || g, 'acct', 'S' || (g % 17),
        now() - ((g + 40) || ' days')::interval, now() - (g || ' hours')::interval - ((g % 30) || ' days')::interval,
        ((g * 7919 + u.id) % 401 - 180) / 1000.0, 30 + (g % 30), true
      from unnest(${part.map((p) => p.id)}::int[], ${part.map((p) => p.n)}::int[]) as u(id, n), generate_series(1, u.n) g`;
  }
  const withPositions = sized.filter((p) => p.i % 3 === 0 || p.n === 0).map((p) => p.id);
  await sql`insert into open_positions (user_id, account_id, symbol, unrealized_pct)
    select u, 'acct-' || a, 'P' || a, ((u * 31 + a) % 200 - 100) / 1000.0 from unnest(${withPositions}::int[]) u, generate_series(1, 2) a`;
  const legacy = sized.filter((p) => p.i % 2 === 0).map((p) => p.id);
  await sql`insert into broker_accounts (account_id, user_id, confirmed_at) select ${tag} || '-acct-' || u, u, now() from unnest(${legacy}::int[]) u`;
  const demo = sized.filter((p) => p.i % 7 === 0).map((p) => p.id);
  await sql`insert into activities (user_id, source, external_id, account_id, symbol, side, units, price, executed_at, raw)
    select u, 'demo', ${tag} || '-demo-' || u, 'acct', 'D', 'BUY', 1, 10, now() - interval '50 days', '{}' from unnest(${demo}::int[]) u`;
  await sql`analyze closed_trades`;
  log(`fixture: ${TRADERS} traders, ${sized.reduce((s, p) => s + p.n, 0)} closed trades, ${withPositions.length * 2} open positions, ${legacy.length} with a confirmed account, ${demo.length} demo (${Math.round(performance.now() - t0)} ms)`);
});
after(async () => {
  if (!LOAD || !hasDb) return;
  const { sql } = await import('./db.ts');
  for (let k = 0; k < ids.length; k += 500) await sql`delete from users where id in ${sql(ids.slice(k, k + 500))}`;
  await sql`delete from broker_accounts where account_id like ${tag + '-acct-%'}`;
  if (attempt) await sql`delete from signup_attempts where id = ${attempt}`;
  await sql.end({ timeout: 1 });
});

// The per-trader writer exactly as lib/display-log.ts has it on main (snapshotFor and the loop, with main's OPTIONS
// line, #62), unmodified.
async function legacySnapshotFor(userId: number, now: Date) {
  const { sql } = await import('./db.ts');
  const { publicRecordDetail } = await import('./connections.ts');
  const { snapshotText } = await import('./display-log.ts');
  const { loadOptionDisplayText } = await import('./options-load.ts');
  const { public: { state } } = await publicRecordDetail(userId);
  if (state === 'importing') return null;
  const trades = await sql`select symbol, opened_at, closed_at, return_pct, holding_days from closed_trades where user_id = ${userId}`;
  const positions = state !== 'none' ? await sql`select account_id, symbol, unrealized_pct from open_positions where user_id = ${userId}` : [];
  if (!trades.length && !positions.length) return null;
  const [d] = await sql`select exists(select 1 from activities where user_id = ${userId} and source = 'demo') as demo`;
  return {
    demo: d.demo as boolean,
    optionsLine: await loadOptionDisplayText(userId), // OPTIONS
    ...snapshotText(
      trades.map((t) => ({ symbol: t.symbol, openedAt: t.opened_at, closedAt: t.closed_at, returnPct: t.return_pct, holdingDays: t.holding_days })),
      positions.map((p) => ({ accountId: p.account_id as string, symbol: p.symbol as string, pct: p.unrealized_pct as number })),
      now,
    ),
  };
}
async function legacyWriteDisplayLog(opts: { now: Date; boxMs: number; ids: number[] }) {
  const { sql } = await import('./db.ts');
  const day = opts.now.toISOString().slice(0, 10);
  const end = Date.now() + opts.boxMs, batch = 200;
  let after = 0, written = 0;
  for (;;) {
    const users = await sql`select u.id from users u where u.deleted_at is null and u.id > ${after}
      and u.id in ${sql(opts.ids)}
      and not exists (select 1 from display_log l where l.user_id = u.id and l.day = ${day}::date)
      and (exists (select 1 from closed_trades c where c.user_id = u.id) or exists (select 1 from open_positions p where p.user_id = u.id))
      order by u.id limit ${batch}`;
    for (const u of users) {
      if (Date.now() >= end) return { written, done: false };
      after = u.id as number;
      const snap = await legacySnapshotFor(after, opts.now);
      if (!snap) continue;
      const r = await sql`insert into display_log (user_id, day, demo, headline, range_text, trade_count, open_summary, evidence, options_line)
        values (${after}, ${day}::date, ${snap.demo}, ${snap.headline}, ${snap.rangeText}, ${snap.tradeCount}, ${snap.openSummary}, ${snap.evidence}, ${snap.optionsLine})
        on conflict (user_id, day) do nothing`;
      written += r.count;
    }
    if (users.length < batch) return { written, done: true };
  }
}

loadTest('display log: 2,000 traders with varied record sizes, records written within one 20 s box, and the ticks until all are written', async () => {
  const { sql } = await import('./db.ts');
  const { writeDisplayLog, DISPLAY_LOG_BOX_MS } = await import('./display-log.ts');
  const now = new Date();
  const yesterday = new Date(now.getTime() - 86_400_000);
  const l0 = performance.now();
  const old = await legacyWriteDisplayLog({ now: yesterday, ids, boxMs: DISPLAY_LOG_BOX_MS });
  const oldMs = performance.now() - l0;
  const oldRate = old.written / (oldMs / 1000);
  log(`before (per trader), one box (${DISPLAY_LOG_BOX_MS} ms): ${old.written} records written in ${Math.round(oldMs)} ms (${oldRate.toFixed(1)} records/s), done=${old.done}`);
  const t0 = performance.now();
  const first = await writeDisplayLog({ now, ids, boxMs: DISPLAY_LOG_BOX_MS });
  const firstMs = performance.now() - t0;
  const newRate = first.written / (firstMs / 1000);
  log(`after (set-based), one box (${DISPLAY_LOG_BOX_MS} ms): ${first.written} records written in ${Math.round(firstMs)} ms (${(first.written / (firstMs / 1000)).toFixed(1)} records/s), done=${first.done}`);
  let ticks = 1, written = first.written, done = first.done;
  while (!done && ticks < 40) {
    const r = await writeDisplayLog({ now, ids, boxMs: DISPLAY_LOG_BOX_MS });
    ticks++; written += r.written; done = r.done;
  }
  const totalMs = performance.now() - t0;
  const [{ n }] = await sql`select count(*)::int as n from display_log where user_id = any(${ids}) and day = ${now.toISOString().slice(0, 10)}::date`;
  log(`all records: ${n} rows after ${ticks} box(es), ${Math.round(totalMs)} ms (${(n / (totalMs / 1000)).toFixed(1)} records/s overall)`);
  assert.ok(done, 'finishes');
  assert.equal(written, n);
  // Every trader shows something: the open-positions-only ones (i % 10 = 0) are even, so they hold a confirmed account.
  assert.equal(n, TRADERS);
  const ratio = newRate / oldRate;
  log(`speedup ${ratio.toFixed(2)}x (bound ${MIN_SPEEDUP}x); per 20 s box: before ~${Math.round(oldRate * 20)}, after ~${Math.round(newRate * 20)} records`);
  assert.ok(ratio >= MIN_SPEEDUP, `speedup ${ratio.toFixed(2)}x`);
});
