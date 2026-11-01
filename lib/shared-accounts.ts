// TR-6 follow-up (known limit removed 2026-11-01): profiles that already shared one broker account before the claim
// existed. broker_accounts gives each account to the profile with its earliest activity (db/schema.sql backfill,
// docs/specs/issue-54-single.md); any other profile holding activities of that account is a shared case. Deleting data
// is the owner's (POLICY H), so nothing here deletes a row: the owner's script reports the cases (counts only), marks
// them when asked (`--mark`), and rebuilds the marked profiles when asked (`--rebuild`). A rebuild leaves a marked
// (account, profile) out, like a simulated account; the raw activities stay and theses are kept (kept_theses).
import type { TransactionSql } from 'postgres';
import { sql } from './db.ts';

type Db = TransactionSql | typeof sql;

// The rebuild's filter for activity rows `a` of `userId`: not of an account marked as another profile's.
export const notShared = (db: Db, userId: number) =>
  db`not exists (select 1 from shared_account_marks m where m.user_id = ${userId} and m.account_id = a.account_id)`;

// Every shared case: (account, profile) pairs where the profile holds verified activities of an account claimed by
// another profile. `scope` (tests only) limits it to those profiles; the script passes none.
// What it can find (reliability review, 2026-11-01): two profiles under one vendor account id. Vendor ids are per
// connection, so this needs one vendor user behind both profiles; activity ids are unique per source, so each activity
// row belongs to the profile that imported it first and the claimant's own record may lack some of the account's trades.
// Moving rows between profiles is a data change for the owner; the report counts the activities involved.
// ponytail: only same-vendor-id duplicates are found here, and the claimant's record may lack the rows the other profile
// imported first — past dodges under two vendor ids resolve through the identity claim (lib/claims.ts) once
// lib/broker.ts passes the identity; moving activity rows to the claimant needs the owner's decision.
export type Scope = number[] | undefined;
const shared = (db: Db, scope: Scope) => db`
  select distinct a.account_id, a.user_id from activities a join broker_accounts b on b.account_id = a.account_id
  where a.source = 'snaptrade' and a.user_id <> b.user_id ${scope ? db`and a.user_id = any(${scope})` : db``}`;

export type SharedReport = { accounts: number; profiles: number; activities: number; marked: number; unmarked: number; markedProfiles: number };
// Counts only (no ids): accounts and profiles in shared cases, the non-claimants' activities of those accounts, and how
// many cases are marked.
export async function sharedReport(db: Db = sql, scope?: Scope): Promise<SharedReport> {
  const [r] = await db`
    with s as (${shared(db, scope)})
    select (select count(distinct account_id)::int from s) as accounts, (select count(distinct user_id)::int from s) as profiles,
           (select count(*)::int from activities a join s on s.account_id = a.account_id and s.user_id = a.user_id where a.source = 'snaptrade') as activities,
           (select count(*)::int from s join shared_account_marks m using (account_id, user_id)) as marked,
           (select count(*)::int from s where not exists (select 1 from shared_account_marks m where m.account_id = s.account_id and m.user_id = s.user_id)) as unmarked,
           (select count(distinct user_id)::int from shared_account_marks ${scope ? db`where user_id = any(${scope})` : db``}) as marked_profiles`;
  return { accounts: r.accounts, profiles: r.profiles, activities: r.activities, marked: r.marked, unmarked: r.unmarked, markedProfiles: r.marked_profiles };
}

// Marks every shared case not yet marked. Idempotent. Returns how many it marked.
export async function markShared(db: Db = sql, scope?: Scope, now = new Date()): Promise<number> {
  const rows = await db`insert into shared_account_marks (account_id, user_id, marked_at)
    select account_id, user_id, ${now} from (${shared(db, scope)}) s on conflict (user_id, account_id) do nothing returning 1`;
  return rows.length;
}

// The marked profiles, for the owner's `--rebuild` (ids stay in memory, never printed).
export async function markedProfiles(db: Db = sql, scope?: Scope): Promise<number[]> {
  return (await db`select distinct user_id from shared_account_marks ${scope ? db`where user_id = any(${scope})` : db``} order by user_id`).map((r) => r.user_id as number);
}
