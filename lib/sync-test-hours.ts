// Test helper (not a test file): the hours of `sync_read_counts` a test file owns.
//
// `sync_read_counts` holds one row per hour for the whole site: lib/sync-shard.ts#runShard adds each run's vendor reads
// to the row of its (shifted) clock's hour, and #coverage sums the rows of the 24 hours before its clock. Test files run
// in parallel against one database, and the database keeps rows from earlier runs (a killed run, or a file that never
// deleted its rows), so a test that sums those rows sees every other writer of the same hours. It flaked that way: the
// coverage test counted 5 activities reads where it had written 4 (lib/sync-cadence.db.test.ts).
//
// So every test that runs runShard on a shifted clock, or reads the sums:
// 1. draws its hours from its own range below (hours behind the current hour; disjoint, and never the live hour),
//    which lib/sync-test-hours.test.ts checks against every test file that writes or reads the table;
// 2. claims them (`claimHours`): one all-zero row per hour, inserted only where no row exists. The claim holds only when
//    every row is its own (the primary key makes two claims of one hour exclusive); otherwise it deletes the rows it
//    made and draws again. No one else writes a claimed hour, so a sum over claimed hours counts this test's reads only;
// 3. releases them at the end, deleting exactly the rows it claimed.
// ponytail: a run killed before its release leaves its claimed all-zero rows (harmless: sums add 0 and later claims draw
// around them) — a sweep of all-zero rows older than a day would reclaim them.
export const HOUR = 3_600_000;

/** Hours behind the current hour, `from` inclusive and `to` exclusive. `claims: false` only for a file that asserts
 * nothing on the table and cannot claim (its rounds run in worker processes at fixed hours). */
export type HourRange = { from: number; to: number; claims: boolean };
export const HOUR_RANGES: Record<string, HourRange> = {
  // LOAD=1 only: rounds 10 and 11 h back and one run 20 h back, in worker processes.
  // ponytail: the load suite's hours are fixed and unclaimed (it asserts nothing on the table) — claim them in its parent
  // process before the rounds if it ever reads the sums.
  'lib/sync-shard.load.test.ts': { from: 2, to: 30, claims: false },
  'lib/sync-shard.test.ts': { from: 60, to: 700, claims: true },
  // Its traders consented 400 days (9,600 h) back: its clock stays after that.
  'lib/sync-cadence.review.test.ts': { from: 760, to: 2900, claims: true },
  'lib/options-shard.test.ts': { from: 3000, to: 6000, claims: true },
  'lib/sync-cadence.db.test.ts': { from: 6100, to: 46000, claims: true },
  'lib/sync-test-hours.test.ts': { from: 46100, to: 48000, claims: true },
  // F-35: their runs (the matured pass) use a fake sync that makes no vendor read, so they write no row and assert nothing
  // on the table; the ranges keep the hours apart should they ever read it.
  'lib/f35-publish.test.ts': { from: 48100, to: 48200, claims: false },
  'lib/sync.test.ts': { from: 48300, to: 48400, claims: false },
};

/** Hours from T0, both inclusive: [-2, 100] is the two hours before T0 to the hundredth after. */
export type Span = readonly [first: number, last: number];

/** A random T0 on an hour mark such that every hour of `span` from it lies in `file`'s range. */
export function pickT0(file: string, span: Span, now = Date.now(), r = Math.random()): number {
  const range = HOUR_RANGES[file];
  if (!range) throw new Error(`${file} has no range in lib/sync-test-hours.ts`);
  const lo = range.from + span[1], hi = range.to - 1 + span[0]; // T0's hours back
  if (span[0] > span[1] || lo > hi) throw new Error(`span ${span.join('..')} does not fit ${file}'s range`);
  return Math.floor(now / HOUR) * HOUR - (lo + Math.floor(r * (hi - lo + 1))) * HOUR;
}

export type Claim = { T0: number; first: Date; last: Date; owns: (ms: number) => boolean; release: () => Promise<void> };

/** Claims the hours of `span` from a T0 in `file`'s range (see the top of this file). `pick` is a test seam. */
export async function claimHours(file: string, span: Span, pick = () => pickT0(file, span), tries = 50): Promise<Claim> {
  const { sql } = await import('./db.ts');
  for (let i = 0; i < tries; i++) {
    const T0 = pick();
    const first = new Date(T0 + span[0] * HOUR), last = new Date(T0 + span[1] * HOUR);
    const mine = await sql`insert into sync_read_counts (hour)
      select generate_series(${first}::timestamptz, ${last}::timestamptz, interval '1 hour')
      on conflict (hour) do nothing returning hour`;
    if (mine.length === span[1] - span[0] + 1) {
      const owns = (ms: number) => { const h = Math.floor(ms / HOUR) * HOUR; return h >= first.getTime() && h <= last.getTime(); };
      let released = false; // once: after it, the hours may be another test's
      const release = async () => { if (!released) { released = true; await sql`delete from sync_read_counts where hour between ${first} and ${last}`; } };
      return { T0, first, last, owns, release };
    }
    if (mine.length) await sql`delete from sync_read_counts where hour in ${sql(mine.map((r) => r.hour as Date))}`;
  }
  throw new Error(`no free hours for ${file} after ${tries} draws`);
}
