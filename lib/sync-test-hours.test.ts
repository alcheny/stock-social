// lib/sync-test-hours.ts: every test file that writes or reads sync_read_counts has its own range of hours, the ranges
// are disjoint and behind the live hour, and a claim is exclusive and releases only its own rows.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { HOUR, HOUR_RANGES, claimHours, pickT0 } from './sync-test-hours.ts';

const FILE = 'lib/sync-test-hours.test.ts';
const hasDb = !!process.env.DATABASE_URL;
const root = new URL('..', import.meta.url).pathname;
before(async () => { if (hasDb) await (await import('./privacy-test-schema.ts')).applySchemaForTests(); });
after(async () => { if (hasDb) await (await import('./db.ts')).sql.end({ timeout: 1 }); });

const testFiles = (dir: string): string[] => readdirSync(join(root, dir), { withFileTypes: true }).flatMap((e) =>
  e.isDirectory() ? (e.name === 'node_modules' || e.name.startsWith('.') ? [] : testFiles(join(dir, e.name)))
    : /\.(test|spec)\.tsx?$/.test(e.name) ? [relative(root, join(root, dir, e.name))] : []);

test('the ranges are disjoint, at least a day apart and at least 2 h behind the live hour', () => {
  const ranges = Object.entries(HOUR_RANGES).sort((a, b) => a[1].from - b[1].from);
  assert.ok(ranges[0][1].from >= 2, 'the live hour (and the one before) is never a test\'s');
  for (const [file, r] of ranges) assert.ok(Number.isInteger(r.from) && Number.isInteger(r.to) && r.from < r.to, file);
  for (let i = 1; i < ranges.length; i++) {
    const [a, ra] = ranges[i - 1], [b, rb] = ranges[i];
    assert.ok(rb.from - ra.to >= 24, `${a} [${ra.from}, ${ra.to}) and ${b} [${rb.from}, ${rb.to}) are less than 24 h apart`);
  }
});

test('every test file that runs runShard, names sync_read_counts or asserts on the read counts has a range, and claims its hours', () => {
  const files = ['lib', 'app', 'scripts', 'e2e'].flatMap(testFiles);
  const users = files.filter((f) => /runShard\(\{|sync_read_counts|activitiesReads24h|capRatio|capBreach/.test(readFileSync(join(root, f), 'utf8')));
  assert.ok(users.includes('lib/sync-cadence.db.test.ts') && users.includes('lib/options-shard.test.ts'), users.join(', '));
  for (const f of users) assert.ok(HOUR_RANGES[f], `${f} writes or reads sync_read_counts but has no range in lib/sync-test-hours.ts`);
  for (const [f, r] of Object.entries(HOUR_RANGES)) {
    assert.ok(users.includes(f), `${f} has a range but no longer uses the table`);
    const src = readFileSync(join(root, f), 'utf8');
    if (r.claims) assert.ok(src.includes('claimHours(') && src.includes(`'${f}'`), `${f} claims its hours`);
  }
  // The one file that cannot claim (its runs are in worker processes) asserts nothing on the table.
  for (const [f] of Object.entries(HOUR_RANGES).filter(([, r]) => !r.claims)) {
    assert.doesNotMatch(readFileSync(join(root, f), 'utf8'), /sync_read_counts|activitiesReads24h|capRatio|capBreach/, f);
  }
});

test('pickT0: on an hour mark, every hour of the span inside the file\'s range, across the whole range', () => {
  const now = Date.UTC(2026, 10, 1, 12, 34, 56);
  const mark = Date.UTC(2026, 10, 1, 12);
  for (const [file, r] of Object.entries(HOUR_RANGES)) {
    for (const span of [[0, 0], [-2, 3], [0, 12]] as const) {
      const backs: number[] = [];
      for (const x of [0, 0.25, 0.5, 0.999999, Math.random()]) {
        const T0 = pickT0(file, span, now, x);
        assert.equal(T0 % HOUR, 0);
        for (let k = span[0]; k <= span[1]; k++) {
          const back = (mark - (T0 + k * HOUR)) / HOUR;
          assert.ok(back >= r.from && back < r.to, `${file} ${span}: hour ${k} is ${back} h back`);
        }
        backs.push((mark - T0) / HOUR);
      }
      // The extremes: r = 0 reaches the range's near end, r → 1 its far end.
      assert.equal(backs[0] - span[1], r.from, file);
      assert.equal(backs[3] - span[0], r.to - 1, file);
    }
  }
  assert.throws(() => pickT0('lib/unknown.test.ts', [0, 1]), /no range/);
  assert.throws(() => pickT0(FILE, [0, 5000]), /does not fit/);
  assert.throws(() => pickT0(FILE, [3, 1]), /does not fit/);
});

test('claimHours: a claim owns every hour of its span; a second claim over any of them draws again and leaves no row; release deletes exactly the claimed rows', { skip: !hasDb && 'no DATABASE_URL' }, async () => {
  const { sql } = await import('./db.ts');
  const a = await claimHours(FILE, [-2, 5]);
  const rows = async (from: Date, to: Date) => (await sql`select hour, account_lists, activities, positions from sync_read_counts
    where hour between ${from} and ${to} order by hour`).map((x) => ({ ...x }));
  let b: Awaited<ReturnType<typeof claimHours>> | null = null;
  try {
    assert.equal(a.first.getTime(), a.T0 - 2 * HOUR);
    assert.equal(a.last.getTime(), a.T0 + 5 * HOUR);
    const mine = await rows(a.first, a.last);
    assert.deepEqual(mine.map((x) => x.hour.getTime()), Array.from({ length: 8 }, (_, k) => a.T0 + (k - 2) * HOUR));
    assert.ok(mine.every((x) => x.account_lists === 0 && x.activities === 0 && x.positions === 0), 'a claim adds no reads');
    assert.ok(a.owns(a.T0 - 2 * HOUR) && a.owns(a.T0 + 5 * HOUR + 59 * 60_000) && !a.owns(a.T0 - 2 * HOUR - 1) && !a.owns(a.T0 + 6 * HOUR));
    // A second claim whose first draw overlaps the last 3 hours of `a` (and 4 free ones after): that draw fails, keeps none
    // of its 4 new rows, and the next draw (2 days later, free) is taken.
    const draws = [a.T0 + 3 * HOUR, a.T0 + 48 * HOUR];
    let n = 0;
    b = await claimHours(FILE, [0, 6], () => draws[n++]);
    assert.equal(n, 2);
    assert.equal(b.T0, a.T0 + 48 * HOUR);
    assert.equal((await rows(new Date(a.last.getTime() + HOUR), new Date(a.T0 + 9 * HOUR))).length, 0, 'the failed draw\'s own rows are gone');
    assert.deepEqual((await rows(a.first, a.last)).map((x) => x.hour.getTime()), mine.map((x) => x.hour.getTime()), 'a\'s rows are untouched');
    // A draw that never finds free hours gives up.
    await assert.rejects(claimHours(FILE, [0, 0], () => a.T0, 3), /no free hours/);
    // Release: exactly a's rows go; b's stay until b releases.
    await a.release();
    assert.equal((await rows(a.first, a.last)).length, 0);
    assert.equal((await rows(b.first, b.last)).length, 7);
  } finally {
    await a.release();
    await b?.release();
  }
  assert.equal((await rows(b!.first, b!.last)).length, 0);
});
