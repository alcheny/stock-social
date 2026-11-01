// Fix #4 (approval council cycle 2): one rule for which users' data appears on public aggregate surfaces (stock pages,
// the stock index and compare, the stock share image, the sitemap). A user whose deletion is in progress (deleted_at set,
// lib/delete.ts keeps the rows until the vendor step succeeds) is never counted or charted. F-16 extends this predicate
// with "hidden"; every stock query reads it from here, so that change is one place.
import { sql } from './db.ts';

// The rule in SQL, as a condition on a users alias: `join users u on u.id = t.user_id and ${visibleUser('u')}`.
export const visibleUser = (alias: string) => sql`${sql(alias)}.deleted_at is null`;

// The ids of visible users, for queries that don't join users: `where t.user_id in (${visibleUserIds()})`.
export const visibleUserIds = () => sql`select v.id from users v where ${visibleUser('v')}`;

// The same rule on a loaded row, for code that already holds the user (tests pin that the two agree).
export const isVisibleUser = (u: { deleted_at: Date | null }) => u.deleted_at === null;
