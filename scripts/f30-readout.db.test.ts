// F-30's residual readout row against the database (docs/features/F-30-same-instant-order-on-date-only-stamps.md,
// decision 2026-11-01): loadStamps counts same-instant open-and-close events by UTC clock time, and buildReadout prints
// the three classes. Shared database: every test makes its own fictional traders and broker activities, reads only its
// own traders (onlyUsers) and deletes what it made. The one run of main asserts presence and absence, never values.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const hasDb = !!process.env.DATABASE_URL;
const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL' }, fn);
before(async () => { if (hasDb) await (await import('../lib/db.ts')).sql.unsafe(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')).simple(); });
after(async () => { if (hasDb) await (await import('../lib/db.ts')).sql.end({ timeout: 1 }); });

const rand = () => Math.random().toString(36).slice(2, 10);

async function fixtures() {
  const { sql } = await import('../lib/db.ts');
  const tag = `f30${rand()}`;
  const ids: number[] = [], attempts: number[] = [];
  let k = 0;
  const user = async () => {
    const [a] = await sql`insert into signup_attempts (method, adult_attested_at) values ('dev', now()) returning id`;
    const h = `${tag}${ids.length}`;
    const [u] = await sql`insert into users (handle, display_name, adult_attested_at, signup_attempt_id) values (${h}, ${h}, now(), ${a.id}) returning id`;
    ids.push(u.id); attempts.push(a.id);
    return { id: u.id as number, handle: h };
  };
  // One fictional broker activity; `at` is an ISO instant (offsets allowed), cast from text so the driver keeps its
  // microseconds (a timestamptz parameter goes through a Date, which has milliseconds only).
  const act = (userId: number, side: 'BUY' | 'SELL', symbol: string, at: string, o: { account?: string; source?: string } = {}) =>
    sql`insert into activities (user_id, source, external_id, account_id, symbol, side, units, price, executed_at, raw)
      values (${userId}, ${o.source ?? 'snaptrade'}, ${`${tag}-${k++}`}, ${o.account ?? `${tag}-acct`}, ${symbol}, ${side}, 1, 10, ${at}::text::timestamptz, '{}'::jsonb)`;
  const pair = async (userId: number, symbol: string, at: string, o: { account?: string; source?: string } = {}) => {
    await act(userId, 'BUY', symbol, at, o);
    await act(userId, 'SELL', symbol, at, o);
  };
  const cleanup = async () => {
    await sql`delete from users where id = any(${ids}::int[])`;
    await sql`delete from signup_attempts where id = any(${attempts}::bigint[])`;
  };
  return { sql, tag, user, act, pair, cleanup };
}

dbTest('F-30 readout (DB): same-instant buy and sell pairs are counted by UTC clock class; anything else is not an event', async () => {
  const f = await fixtures();
  const { loadStamps, stampCounts, buildReadout, STAMP_ROWS } = await import('./f15-readout.ts');
  try {
    const t = await f.user();
    // Five date-only (00:00:00Z) events, on five fictional symbols.
    for (let i = 0; i < 5; i++) await f.pair(t.id, `ZZM${i}`, `2020-03-0${i + 2}T00:00:00Z`);
    // Two other whole hours: 05:00Z, and a local midnight written with an offset (00:00-05:00 is 05:00Z).
    await f.pair(t.id, 'ZZH1', '2020-03-02T05:00:00Z');
    await f.pair(t.id, 'ZZH2', '2020-03-03T00:00:00-05:00');
    // One intraday event, and one a microsecond after midnight (intraday too).
    await f.pair(t.id, 'ZZI1', '2020-03-02T14:37:12.5Z');
    await f.pair(t.id, 'ZZI2', '2020-03-04T00:00:00.000001Z');
    // Not events: a buy and a sell on different instants, two buys at one instant, one instant in two accounts, two
    // symbols at one instant.
    await f.act(t.id, 'BUY', 'ZZN1', '2020-04-01T00:00:00Z');
    await f.act(t.id, 'SELL', 'ZZN1', '2020-04-02T00:00:00Z');
    await f.act(t.id, 'BUY', 'ZZN2', '2020-04-01T00:00:00Z');
    await f.act(t.id, 'BUY', 'ZZN2', '2020-04-01T00:00:00Z');
    await f.act(t.id, 'BUY', 'ZZN3', '2020-04-03T00:00:00Z', { account: `${f.tag}-a2` });
    await f.act(t.id, 'SELL', 'ZZN3', '2020-04-03T00:00:00Z', { account: `${f.tag}-a3` });
    await f.act(t.id, 'BUY', 'ZZN4', '2020-04-04T00:00:00Z');
    await f.act(t.id, 'SELL', 'ZZN5', '2020-04-04T00:00:00Z');
    // A pair with two buys and a sell at one instant is one event.
    await f.act(t.id, 'BUY', 'ZZM9', '2020-05-01T00:00:00Z');
    await f.pair(t.id, 'ZZM9', '2020-05-01T00:00:00Z');
    const rows = await loadStamps(f.sql, [t.id]);
    assert.deepEqual(stampCounts(rows), { midnight: 6, hour: 2, intraday: 2 });
    for (const r of rows) assert.deepEqual(Object.keys(r).sort(), ['clock', 'n'], 'a clock time and a count, nothing else');
    const md = buildReadout({ rollup: [], drops: [], g1: { strict: 0, partial: 0 }, g2: { traders: [], firstDay: null, retentionDays: 120 }, stamps: stampCounts(rows) }, new Date());
    const printed = STAMP_ROWS.map(([, label]) => (md.split('\n').find((l) => l.startsWith(`| ${label} |`)) ?? '').slice(1, -1).split('|')[1].trim());
    assert.deepEqual(printed, ['6', '<5', '<5']);
    assert.ok(!md.includes(t.handle) && !/ZZ[MHIN]\d/.test(md), 'no handle or symbol');
  } finally {
    await f.cleanup();
  }
});

dbTest('F-30 readout (DB): deleted traders, Demo traders and Demo activity are left out', async () => {
  const f = await fixtures();
  const { loadStamps, stampCounts } = await import('./f15-readout.ts');
  try {
    const live = await f.user(), gone = await f.user(), demo = await f.user();
    await f.pair(live.id, 'ZZL1', '2020-06-01T00:00:00Z');
    await f.pair(gone.id, 'ZZD1', '2020-06-01T00:00:00Z');
    await f.sql`update users set deleted_at = now() where id = ${gone.id}`;
    // A Demo trader: its demo activity marks the profile; neither its demo pairs nor a broker pair on it count.
    await f.pair(demo.id, 'ZZX1', '2020-06-01T00:00:00Z', { source: 'demo' });
    await f.pair(demo.id, 'ZZX2', '2020-06-02T00:00:00Z');
    assert.deepEqual(stampCounts(await loadStamps(f.sql, [live.id, gone.id, demo.id])), { midnight: 1, hour: 0, intraday: 0 });
  } finally {
    await f.cleanup();
  }
});

dbTest('F-30 readout (DB): main prints the stamp-pattern row under the limits block and no handle or symbol', async () => {
  const f = await fixtures();
  const { LIMITS_HEADING, STAMP_HEADING, STAMP_ROWS } = await import('./f15-readout.ts');
  const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const out = mkdtempSync(path.join(tmpdir(), 'f30-readout-'));
  try {
    const t = await f.user();
    await f.pair(t.id, 'ZZQ1', '2020-07-01T00:00:00Z');
    const run = spawnSync(process.execPath, ['scripts/f15-readout.ts', '--out', out], { cwd: repo, encoding: 'utf8', env: process.env });
    assert.equal(run.status, 0, run.stderr);
    const files = readdirSync(out);
    assert.equal(files.length, 1);
    const md = readFileSync(path.join(out, files[0]), 'utf8');
    const head = md.indexOf(`\n${STAMP_HEADING}\n`);
    assert.ok(head > md.indexOf(`\n${LIMITS_HEADING}\n`) && head < md.indexOf('\n## G1\n'));
    for (const [, label] of STAMP_ROWS) assert.ok(md.split('\n').some((l) => l.startsWith(`| ${label} |`)), label);
    for (const text of [md, run.stdout, run.stderr]) assert.ok(!text.includes(t.handle) && !text.includes('ZZQ1'), 'no handle or symbol');
  } finally {
    rmSync(out, { recursive: true, force: true });
    await f.cleanup();
  }
});
