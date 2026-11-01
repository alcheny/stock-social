// Fix #4 (approval council cycle 2): one rule for which users' data appears on public aggregate surfaces. A user whose
// deletion is in progress (deleted_at set; lib/delete.ts keeps the rows until the vendor step succeeds) is never counted
// or charted. F-16 (docs/features/logs/F-16-F-17/plan.md §5.1): a profile the owner hid (users.hidden_at, set only by
// the audited lib/trust-hide.ts) is skipped by the same rule, so the hide is this one place.
// ponytail: only the reads that call these helpers skip a hidden profile; compare, the stock share image,
// app/t/open-positions.ts and the feed, profile, pane, image and likes reads still filter on `deleted_at is null` or
// not at all — fix: the F-16 predicate sweep (plan §5.2, §13 A) moves every public closed_trades / open_positions read
// here, proved by lib/f16-visible-reads.test.ts, and empties PENDING_VISIBLE in lib/fixes-cycle2-trust.test.ts.
import { sql } from './db.ts';
import { routeHandle } from './params.ts';
import { FILER_HANDLE_PREFIX } from './public-gate.ts';

// The rule in SQL, as a condition on a users alias: `join users u on u.id = t.user_id and ${visibleUser('u')}`.
export const visibleUser = (alias: string) => sql`(${sql(alias)}.deleted_at is null and ${sql(alias)}.hidden_at is null)`;

// The feed's snapshot form (lib/feed.ts, plan v2 E5): a hide counts from its time like a deletion, so a page read as of
// `asOf` keeps a trader hidden or deleted after it (the later card and people reads use visibleUser: a gap, never a
// shift). With no snapshot time it is visibleUser.
export const visibleUserAsOf = (alias: string, asOf: Date | null) => asOf
  ? sql`((${sql(alias)}.deleted_at is null or ${sql(alias)}.deleted_at > ${asOf}) and (${sql(alias)}.hidden_at is null or ${sql(alias)}.hidden_at > ${asOf}))`
  : visibleUser(alias);

// The ids of visible users, for queries that don't join users: `where t.user_id in (${visibleUserIds()})`.
export const visibleUserIds = () => sql`select v.id from users v where ${visibleUser('v')}`;

// For reads that don't join users (profile-scoped reads, aggregates), correlated on a column of the read's table:
// `where user_id = ${id} and ${visibleOwner('closed_trades')}` (or `${visibleOwner('t', 'trader_id')}`).
export const visibleOwner = (alias: string, col = 'user_id') =>
  sql`exists (select 1 from users v where v.id = ${sql(alias)}.${sql(col)} and ${visibleUser('v')})`;

// Uncorrelated form for single-trader reads (plan v2 E8): `where user_id = ${id} and ${visibleId(id)}`.
export const visibleId = (id: number) => sql`exists (select 1 from users v where v.id = ${id} and ${visibleUser('v')})`;

// The same rule on a loaded row, for code that already holds the user (tests pin that the two agree). hidden_at is
// optional so callers that load only deleted_at keep compiling; they should select hidden_at too.
export const isVisibleUser = (u: { deleted_at: Date | null; hidden_at?: Date | null }) => u.deleted_at === null && !u.hidden_at;

// What /u/<handle> renders (plan §5.1, v2 E13; app/u/[handle]/not-found.tsx picks its title and notice from it):
// - visible / hidden: a live users row (deleted_at null) with that handle, without or with the owner's hide;
// - retired: no live row, but an active hold (handle_reservations.until > now(), a rename's old handle or a deleted
//   account's) or a row whose deletion is in progress;
// - none: junk (routeHandle), an F-7 filer handle (its own hidden state, public_filers.hidden_at, keeps the generic
//   404) or a handle nobody holds.
export type HandleStatus = 'visible' | 'hidden' | 'retired' | 'none';
export async function handleStatus(handle: string): Promise<HandleStatus> {
  const h = routeHandle(handle);
  if (!h || h.startsWith(FILER_HANDLE_PREFIX)) return 'none';
  const [r] = await sql`
    select (select u.hidden_at is not null from users u where u.handle = ${h} and u.deleted_at is null) as hidden,
      (exists (select 1 from users u where u.handle = ${h} and u.deleted_at is not null)
        or exists (select 1 from handle_reservations r where r.handle = ${h} and r.until > now())) as retired`;
  if (r.hidden !== null) return r.hidden ? 'hidden' : 'visible';
  return r.retired ? 'retired' : 'none';
}
