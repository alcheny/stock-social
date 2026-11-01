// F-14 sync cadence (docs/features/F-14-sync-cadence.md; committee docs/features/logs/F-14/committee-2026-11-01.md): per
// account, activities (with the share moves, same vendor endpoint) are read at most once per 24 h and positions at most
// 4 times in any 24 h. One SQL rule, used by lib/sync.ts#syncUser before its vendor reads and by the shard runner's page
// query to plan its request budget. Everything compares on the database clock (shifted by the tests' hook).
import { sql } from './db.ts';

export const ACTIVITIES_EVERY_MS = 24 * 3_600_000;
export const POSITIONS_EVERY_MS = 6 * 3_600_000;
export const POSITIONS_PER_DAY = 4;
// G2: after a successful activities read, the next one waits at least this long even if the sync rolled back.
export const ATTEMPT_FLOOR_MS = 6 * 3_600_000;
// G1: a timestamp further ahead of the database clock than this is treated as due (a clock or column bug never
// freezes a record).
export const FUTURE_SLACK_MS = 5 * 60_000;

// A query fragment (postgres.js): interpolated into a larger statement.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Frag = any;
const ms = (n: number) => sql`${n}::float8 * interval '1 millisecond'`;
// A timestamp that does not hold a read back: null, older than `every`, in the future, or before the consent.
const free = (col: Frag, every: number, t: Frag, consent: Frag) =>
  sql`(${col} is null or ${col} <= ${t} - ${ms(every)} or ${col} > ${t} + ${ms(FUTURE_SLACK_MS)} or ${col} < ${consent})`;

// The flags of one account as a subquery's columns, over (account id, user id) expressions and a clock expression:
// - `activities_due`: the committed read 24 h old and the last vendor read 6 h old (G1, G2), or a consent since;
// - `positions_own`: the last positions read 6 h old and at most 2 in the trailing 24 h (round 2);
// - `positions_24h`: positions reads in the trailing 24 h (a read an activities read forces needs fewer than 4);
// - `consent_new`: a consent (a consented import or a reconnect: the latest connected_at of a connected connection
//   whose snapshot lists the account, engineer 1) since the account was last read, or never read: read at once (G5),
//   once: a vendor read attempted since that consent (its sync rolled back) ends the exemption, so the 6 h floor
//   applies to the retries (G2) instead of a read every round.
// F-14 tester fix: without the attempt clause a sync that kept rolling back after a never-read account's or a
// reconnected account's first read re-read activities (and share moves and positions) every round.
// Future timestamps count as free (G1); the window ignores reads in the future.
export function dueSql(accountId: Frag, userId: Frag, t: Frag) {
  // Aliases are prefixed (cad_*) so an outer query's own aliases (c, a, u) can be used in the arguments.
  // A consent dated past the clock's slack (connected_at is written from the app's clock) is ignored, so a skewed or
  // buggy connected_at never turns the throttle off (code review).
  const consent = sql`coalesce((select max(cad_c.connected_at) from connections cad_c, jsonb_array_elements(cad_c.accounts) cad_a
      where cad_c.user_id = ${userId} and cad_c.state = 'connected' and cad_a->>'id' = ${accountId}
        and cad_c.connected_at <= ${t} + ${ms(FUTURE_SLACK_MS)}), '-infinity'::timestamptz)`;
  const reads = sql`coalesce(cad_m.positions_reads, '{}'::timestamptz[])`;
  const last24 = sql`(select count(*)::int from unnest(${reads}) cad_r(r) where r > ${t} - ${ms(ACTIVITIES_EVERY_MS)} and r <= ${t} + ${ms(FUTURE_SLACK_MS)})`;
  const lastPos = sql`(select max(r) from unnest(${reads}) cad_r(r) where r <= ${t} + ${ms(FUTURE_SLACK_MS)})`;
  return sql`(select
      ${free(sql`cad_ba.activities_read_at`, ACTIVITIES_EVERY_MS, t, consent)}
        and ${free(sql`cad_m.activities_attempted_at`, ATTEMPT_FLOOR_MS, t, consent)} as activities_due,
      ${free(lastPos, POSITIONS_EVERY_MS, t, consent)} and ${last24} <= ${POSITIONS_PER_DAY - 2} as positions_own,
      ${last24} as positions_24h,
      (cad_ba.account_id is null or cad_ba.activities_read_at is null or cad_ba.activities_read_at < ${consent})
        and (cad_m.activities_attempted_at is null or cad_m.activities_attempted_at < ${consent} or cad_m.activities_attempted_at > ${t} + ${ms(FUTURE_SLACK_MS)}) as consent_new
    from (select 1) cad_one
      left join broker_accounts cad_ba on cad_ba.account_id = ${accountId} and cad_ba.user_id = ${userId}
      left join sync_read_marks cad_m on cad_m.user_id = ${userId} and cad_m.account_id = ${accountId})`;
}

// The decision for one account's flags (also the unit tests' model of the rule; committee round 3, signed):
// - a consent (a consented import or a reconnect): both now (the approved exemption);
// - else activities due: both, while fewer than 4 positions reads fall in the trailing 24 h; with 4 (only while syncs
//   keep rolling back), neither: the activities read is deferred, never made without its positions read (TR-4);
// - else positions on their own clock (6 h old, at most 2 in the trailing 24 h).
export type DueFlags = { activities_due: boolean; positions_own: boolean; positions_24h: number; consent_new: boolean };
export function decide(f: DueFlags): { activities: boolean; positions: boolean; deferred: boolean } {
  if (f.consent_new) return { activities: true, positions: true, deferred: false };
  if (f.activities_due) {
    const slot = Number(f.positions_24h) < POSITIONS_PER_DAY;
    return { activities: slot, positions: slot, deferred: !slot };
  }
  return { activities: false, positions: !!f.positions_own, deferred: false };
}

// The marks write (G2): after the sync's transaction ends, whatever its outcome, the successful vendor reads it made.
// Fire and forget: a failure is counted by the caller, never fatal. F-14 tester fix: reads stored in the future (a clock
// or column bug) are dropped when a read is added; kept, they were the 4 latest forever, so every real read was dropped
// at once and the positions window stayed empty (positions read every round until the clock caught up).
export async function writeMarks(userId: number, activities: string[], positions: string[], shiftMs = 0) {
  const t = sql`now() + ${shiftMs}::float8 * interval '1 millisecond'`;
  const ids = [...new Set([...activities, ...positions])];
  if (!ids.length) return;
  for (const id of ids) {
    const a = activities.includes(id), p = positions.includes(id);
    await sql`insert into sync_read_marks (user_id, account_id, activities_attempted_at, positions_reads)
      values (${userId}, ${id}, ${a ? t : null}, ${p ? sql`array[${t}]` : sql`'{}'::timestamptz[]`})
      on conflict (user_id, account_id) do update set
        activities_attempted_at = ${a ? t : sql`sync_read_marks.activities_attempted_at`},
        positions_reads = ${p ? sql`(select coalesce(array_agg(r order by r), '{}') from (select r from unnest(sync_read_marks.positions_reads || ${t}) r where r <= ${t} + ${ms(FUTURE_SLACK_MS)} order by r desc limit ${POSITIONS_PER_DAY}) last)` : sql`sync_read_marks.positions_reads`}`;
  }
}

// G7: the vendor requests one trader's due reads make (an estimate for the shard runner's budget, computed with the same
// rule as `decide`): 1 account list, then per real consented account 3 (activities, share moves, positions) when
// activities are read, 1 when only positions are.
// F-24 committee (option C): an account's widened confirm read (from a day before its earliest 'confirm' row) may span
// more than one vendor page; the extra pages are charged too: ceil(stored rows since that date / 1,000) − 1.
// ponytail: charged whether or not the account's activities read is due that round, so the estimate can run high (never
// low) for a day — fix: add it inside the activities-due branch per account.
export function dueRequestsSql(userId: Frag, t: Frag) {
  return sql`(select 1 + coalesce(sum(case when d.consent_new or (d.activities_due and d.positions_24h < ${POSITIONS_PER_DAY}) then 3
        when not d.activities_due and d.positions_own then 1 else 0 end), 0)::int
      + (select coalesce(sum(greatest(ceil(req_w.n / 1000.0)::int - 1, 0)), 0)::int from (select count(req_x.*) as n
          from (select req_r.account_id, min(req_n.executed_at) as since from activity_reissues req_r
            join activities req_n on req_n.source = req_r.source and req_n.external_id = req_r.external_id
            where req_r.user_id = ${userId} and req_r.state = 'confirm' group by req_r.account_id) req_f
          join activities req_x on req_x.user_id = ${userId} and req_x.account_id = req_f.account_id and req_x.executed_at >= req_f.since - interval '1 day'
          group by req_f.account_id) req_w)
      from connections req_c, jsonb_array_elements(req_c.accounts) req_a, lateral ${dueSql(sql`(req_a->>'id')`, userId, t)} d
      where req_c.user_id = ${userId} and req_c.state = 'connected' and coalesce((req_a->>'isPaper')::boolean, false) = false)`;
}
