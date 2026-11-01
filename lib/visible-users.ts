// Fix #4 (approval council cycle 2): one rule for which users' data appears on public aggregate surfaces. A user whose
// deletion is in progress (deleted_at set; lib/delete.ts keeps the rows until the vendor step succeeds) is never counted
// or charted. Used by every stock surface (page, index, compare, share image, open positions) and the sitemap;
// lib/fixes-cycle2-trust.test.ts fails on any closed_trades / open_positions read there without it.
// F-16 extends this predicate with "hidden", so that change is one place.
import { sql } from './db.ts';

// The rule in SQL, as a condition on a users alias: `join users u on u.id = t.user_id and ${visibleUser('u')}`.
export const visibleUser = (alias: string) => sql`${sql(alias)}.deleted_at is null`;

// The ids of visible users, for queries that don't join users: `where t.user_id in (${visibleUserIds()})`.
export const visibleUserIds = () => sql`select v.id from users v where ${visibleUser('v')}`;

// The same rule on a loaded row, for code that already holds the user (tests pin that the two agree).
export const isVisibleUser = (u: { deleted_at: Date | null }) => u.deleted_at === null;
