// F-31 (docs/features/F-31-readout-limits-and-partial-rows.md; plan docs/features/logs/F-31/plan.md §8): the readout's
// loaders against the database. Shared database: every test makes its own fictional users (and one fictional non-demo
// filer), reads only its own users (onlyUsers) in a far-past window or its own random cap day, and deletes what it made.
// The one run of main itself (AC5) asserts only presence and absence, never values.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ReadoutInput, RollupRow } from './f15-readout.ts';

const hasDb = !!process.env.DATABASE_URL;
const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL' }, fn);
before(async () => { if (hasDb) await (await import('../lib/db.ts')).sql.unsafe(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')).simple(); });
after(async () => { if (hasDb) await (await import('../lib/db.ts')).sql.end({ timeout: 1 }); });

const DAY = 86_400_000;
const rand = () => Math.random().toString(36).slice(2, 10);
const STRICT = 'Profile views from external referrers / week';

async function fixtures() {
  const { sql } = await import('../lib/db.ts');
  const ids: number[] = [], attempts: number[] = [], filers: number[] = [];
  const user = async (prefix: string, connected = false) => {
    const [a] = await sql`insert into signup_attempts (method, adult_attested_at) values ('dev', now()) returning id`;
    const h = `${prefix}${rand()}`;
    const [u] = await sql`insert into users (handle, display_name, adult_attested_at, signup_attempt_id) values (${h}, ${h}, now(), ${a.id}) returning id`;
    if (connected) await sql`insert into connections (attempt_id, user_id, state, connected_at) values (${a.id}, ${u.id}, 'connected', now())`;
    ids.push(u.id); attempts.push(a.id);
    return { id: u.id as number, handle: h };
  };
  const filer = async (demo = false) => {
    const u = await user('pf_f31');
    const [f] = await sql`insert into public_filers (source, filer_key, demo) values ('insider_reports', ${'f31-' + rand()}, ${demo}) returning id`;
    filers.push(f.id);
    await sql`update users set public_filer_id = ${f.id} where id = ${u.id}`;
    return u;
  };
  const views = (userId: number, day: string, n: number, o: { selfView?: boolean; via?: string; ref?: string } = {}) =>
    sql`insert into view_rollup (day, surface, user_id, ref_class, via, signed_in, self_view, n)
      values (${day}::date, 'profile', ${userId}, ${o.ref ?? 'external'}, ${o.via ?? 'none'}, ${!!o.selfView}, ${!!o.selfView}, ${n})`;
  const cleanup = async () => {
    await sql`delete from users where id = any(${ids}::int[])`;
    await sql`delete from public_filers where id = any(${filers}::int[])`;
    await sql`delete from signup_attempts where id = any(${attempts}::bigint[])`;
  };
  return { sql, ids, user, filer, views, cleanup };
}

const emptyInput = (rollup: RollupRow[], extra: Partial<ReadoutInput> = {}): ReadoutInput =>
  ({ rollup, drops: [], g1: { strict: 0, partial: 0 }, g2: { traders: [], firstDay: null, retentionDays: 120 }, ...extra });
const cellsOf = (line: string | undefined) => (line ?? '').slice(1, -1).split('|').map((c) => c.trim());
const g3 = (md: string, label: string) => cellsOf(md.split('\n').find((l) => l.startsWith(`| ${label}`))).slice(2);

dbTest('F-31 AC1: a real-filer view and a trader view print both "of which" rows; strict G3 equals today\'s value', async () => {
  const f = await fixtures();
  const { buildReadout, loadRollup, weekWindow, F31_ROW_LABELS, F31_INTERNAL_ROW_LABELS } = await import('./f15-readout.ts');
  const [, TRADER_ROW, FILER_ROW] = F31_ROW_LABELS;
  const now = new Date(Date.UTC(1994, 4, 11, 12)); // a Wednesday; the window's last week is 1994-05-02..08
  const { from, to } = weekWindow(now);
  const day = '1994-05-03';
  try {
    const trader = await f.user('f31t'), filer = await f.filer();
    await f.views(trader.id, day, 1);
    await f.views(filer.id, day, 1);
    const strip = (rows: RollupRow[]) => rows.map(({ filer: _f, internal: _i, ...r }) => r);
    const one = await loadRollup(f.sql, from, to, f.ids);
    assert.deepEqual(one.map((r) => r.filer).sort(), [false, true]);
    const md1 = buildReadout(emptyInput(one), now);
    assert.equal(g3(md1, STRICT)[7], '<5', 'the pre-F-31 rule for a strict 2');
    assert.equal(g3(md1, TRADER_ROW)[7], '(s)');
    assert.equal(g3(md1, FILER_ROW)[7], '(s)');
    assert.deepEqual(g3(md1, STRICT), g3(buildReadout(emptyInput(strip(one)), now), STRICT));

    await f.sql`update view_rollup set n = 7 where user_id = ${trader.id}`;
    await f.sql`update view_rollup set n = 9 where user_id = ${filer.id}`;
    const two = await loadRollup(f.sql, from, to, f.ids);
    const md2 = buildReadout(emptyInput(two), now);
    assert.equal(g3(md2, STRICT)[7], '16');
    assert.equal(g3(md2, TRADER_ROW)[7], '7');
    assert.equal(g3(md2, FILER_ROW)[7], '9');
    assert.deepEqual(g3(md2, STRICT), g3(buildReadout(emptyInput(strip(two)), now), STRICT), 'the strict row is the pre-F-31 strict row');

    // E5: the internal list never changes the strict row.
    const three = await loadRollup(f.sql, from, to, f.ids, [trader.handle, filer.handle]);
    assert.deepEqual(three.map((r) => [r.filer, r.internal]).sort(), [[false, true], [true, false]], 'a filer is never internal');
    const md3 = buildReadout(emptyInput(three, { internal: { state: 'set', ignored: 0 } }), now);
    assert.deepEqual(g3(md3, STRICT), g3(md2, STRICT));
    assert.equal(g3(md3, F31_INTERNAL_ROW_LABELS[1])[7], '9');
  } finally {
    await f.cleanup();
  }
});

dbTest('F-31 AC6: loadTop returns only the week and the largest profile\'s strict views; self, Demo and deleted views don\'t change it', async () => {
  const f = await fixtures();
  const { buildReadout, loadRollup, loadTop, weekWindow, F31_ROW_LABELS } = await import('./f15-readout.ts');
  const now = new Date(Date.UTC(1995, 2, 15, 12)); // a Wednesday; the window's last week is 1995-03-06..12
  const { from, to } = weekWindow(now);
  const day = '1995-03-07';
  try {
    const p1 = await f.user('f31p'), p2 = await f.filer();
    await f.views(p1.id, day, 30);
    await f.views(p2.id, day, 10);
    const top1 = await loadTop(f.sql, from, to, f.ids);
    assert.equal(top1.length, 1);
    assert.deepEqual(Object.keys(top1[0]).sort(), ['n', 'week']);
    assert.deepEqual({ ...top1[0] }, { week: '1995-03-06', n: 30 });
    await f.views(p2.id, day, 100, { selfView: true });
    await f.views(p2.id, '1995-03-08', 6, { via: 'card' }); // p2 now 16: still under p1
    const demo = await f.user('f31d');
    await f.sql`insert into activities (user_id, source, external_id, account_id, symbol, side, units, price, executed_at, raw)
      values (${demo.id}, 'demo', ${'f31d-' + rand()}, 'a', 'F31D', 'BUY', 1, 1, now(), '{}')`;
    await f.views(demo.id, day, 200);
    const fixture = await f.filer(true);
    await f.views(fixture.id, day, 250);
    const gone = await f.user('f31g');
    await f.views(gone.id, day, 300);
    await f.sql`update users set deleted_at = now() where id = ${gone.id}`;
    const other = await f.user('f31o');
    await f.views(other.id, day, 400, { ref: 'none' });
    const top2 = await loadTop(f.sql, from, to, f.ids);
    assert.deepEqual(top2.map((t) => ({ ...t })), [{ week: '1995-03-06', n: 30 }]);
    const rollup = await loadRollup(f.sql, from, to, f.ids);
    const S = rollup.filter((r) => r.surface === 'profile' && r.ref_class === 'external' && !r.self_view && !r.demo).reduce((s, r) => s + r.n, 0);
    assert.equal(S, 46);
    assert.ok(top2[0].n <= S);
    const md = buildReadout(emptyInput(rollup, { top: top2 }), now);
    assert.equal(g3(md, STRICT)[7], '46');
    assert.equal(g3(md, F31_ROW_LABELS[3])[7], '65%');
  } finally {
    await f.cleanup();
  }
});

dbTest('F-31 AC4: a cap mark is written once per day and kind, read back, and purged with the view rows', async () => {
  const { sql } = await import('../lib/db.ts');
  const { insertCapDay, VIEW_RETENTION_DAYS } = await import('../lib/views.ts');
  const { loadCapMarks } = await import('./f15-readout.ts');
  const { purgePrivacy } = await import('../lib/privacy-purge.ts');
  // Read-back on a per-run random far-future day Y: no purge (here or in a parallel test) ever reaches it. The purge
  // check on a per-run random day X before 1985: a parallel purge (lib/f15-purge.db.test.ts, 1990) can only delete the
  // same mark sooner, so the assertion that it is gone holds either way, and this purge's cutoff (X + 1) stays below
  // every other test's view rows.
  const Y = new Date(Date.UTC(2400, 0, 1) + Math.floor(Math.random() * 30_000) * DAY).toISOString().slice(0, 10);
  const X = new Date(Date.UTC(1900, 0, 1) + Math.floor(Math.random() * 30_000) * DAY).toISOString().slice(0, 10);
  try {
    await insertCapDay(Y, true);
    await insertCapDay(Y, true);
    await insertCapDay(Y, false);
    const marks = await loadCapMarks(sql, Y, Y);
    assert.deepEqual(marks.map((m) => ({ ...m })).sort((a, b) => Number(a.trusted) - Number(b.trusted)), [{ day: Y, trusted: false }, { day: Y, trusted: true }]);
    assert.equal((await sql`select count(*)::int n from view_cap_days where day = ${Y}::date`)[0].n, 2);
    await insertCapDay(X, true);
    const r = await purgePrivacy({ only: ['views'], now: new Date(Date.parse(`${X}T12:00:00Z`) + (VIEW_RETENTION_DAYS + 1) * DAY) });
    assert.equal(r.done, true);
    assert.equal((await sql`select count(*)::int n from view_cap_days where day = ${X}::date`)[0].n, 0);
    assert.equal((await sql`select count(*)::int n from view_cap_days where day = ${Y}::date`)[0].n, 2, 'a mark inside the bound is kept');
  } finally {
    await sql`delete from view_cap_days where day = any(${[X, Y]}::date[])`;
  }
});

dbTest('F-31 AC5: main with READOUT_INTERNAL_HANDLES set prints both internal rows and no handle in the file, stdout or stderr', async () => {
  const f = await fixtures();
  const { weekWindow, F31_INTERNAL_ROW_LABELS, INTERNAL_RUNS_LINE } = await import('./f15-readout.ts');
  const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const out = mkdtempSync(path.join(tmpdir(), 'f31-readout-'));
  try {
    const a = await f.user('f31ia', true), b = await f.user('f31ib');
    const day = weekWindow(new Date()).to;
    await f.views(a.id, day, 6);
    await f.views(b.id, day, 7);
    const run = spawnSync(process.execPath, ['scripts/f15-readout.ts', '--out', out], {
      cwd: repo, encoding: 'utf8', env: { ...process.env, READOUT_INTERNAL_HANDLES: `@${a.handle}, ${b.handle.toUpperCase()}, x` },
    });
    assert.equal(run.status, 0, run.stderr);
    const files = readdirSync(out);
    assert.equal(files.length, 1);
    const md = readFileSync(path.join(out, files[0]), 'utf8');
    // The rows themselves, not only the facts line that names them (code review 1).
    for (const l of F31_INTERNAL_ROW_LABELS) assert.ok(md.split('\n').some((line) => line.startsWith(`| ${l} |`)), l);
    assert.ok(md.includes(INTERNAL_RUNS_LINE));
    assert.ok(md.includes('1 listed entry was not a valid handle and was ignored.'));
    for (const text of [md, run.stdout, run.stderr]) {
      for (const h of [a.handle, b.handle]) assert.ok(!text.toLowerCase().includes(h), 'no handle');
    }
  } finally {
    rmSync(out, { recursive: true, force: true });
    await f.cleanup();
  }
});
