// Known limits 2 (profile): the profile's record reads, once per request. generateMetadata, the page and the record
// card (record-card-data.ts) all read through these, so one profile view reads users, closed_trades, open_positions,
// the record state and the demo flag once each instead of 2–4 times. In the app `perRequest` is React's `cache`
// (memoized per server request, never across requests: node_modules/next/dist/docs/01-app/02-guides/
// caching-without-cache-components.md); tests pass their own per-scope memo. Relative imports so node:test loads it.
// Callers must not mutate what these return: the rows are shared by everyone in the request.
import { cache } from 'react';
import { sql } from '../../../lib/db.ts';
import { applyClocks, publicRecordDetail } from '../../../lib/connections.ts';
import { isDemoUser as readDemo } from '../../../lib/demo.ts';
import { filerInfo } from '../../../lib/public-gate.ts';
import { visibleId, visibleUser } from '../../../lib/visible-users.ts';

export type PerRequest = <F extends (...args: never[]) => unknown>(fn: F) => F;

export function profileReads(perRequest: PerRequest) {
  return {
    user: perRequest(async (handle: string) => (await sql`select id, handle, display_name, excluded_positions, excluded_future, excluded_corporate, last_synced_at, snaptrade_user_id, share_prompt_seen_at, trades_prompt_seen_at, public_filer_id from users where handle = ${handle} and ${visibleUser('users')}`)[0]), // F-16: a hidden profile is not found
    trades: perRequest((userId: number) => sql`
      select id, sell_id, symbol, return_pct, holding_days, opened_at, closed_at, verified, thesis, thesis_status, filing_url,
        thesis_written_at, thesis_edited_at, thesis_hold_rule
      from closed_trades where user_id = ${userId} and ${visibleId(userId)} order by closed_at desc, id desc`), // list order (lib/paging.ts); F-16: the shared predicate
    positions: perRequest((userId: number) => sql`select account_id, symbol, unrealized_pct, fetched_at from open_positions where user_id = ${userId} and ${visibleId(userId)} order by symbol, account_id`), // F-16: the shared predicate
    // F-1 clocks (marking only), once per request with one `now`. Idempotent: both UPDATEs match only rows still in
    // their old state, and a funnel event is recorded only for the rows an UPDATE returned, so a second run (or a
    // concurrent one: READ COMMITTED re-checks the WHERE after the row lock) marks and records nothing.
    clocks: perRequest((userId: number) => applyClocks(new Date(), { userId })),
    // Ordering: on the profile, load() awaits `clocks` before `detail`, and the record card is only read after
    // `await load()` (page.tsx generateMetadata and the share prompt), so the cached detail is the post-clock read.
    // opengraph-image and story never run the clocks (as before this change).
    detail: perRequest((userId: number) => publicRecordDetail(userId)),
    demo: perRequest((userId: number) => readDemo(userId)),
    // F-7: the filer behind a users row (null for a broker or demo user); visibility is lib/public-gate.ts#filerVisible.
    filer: perRequest((userId: number) => filerInfo(userId)),
  };
}
export type ProfileReads = ReturnType<typeof profileReads>;

export const reads = profileReads(cache);
export const isDemoUser = reads.demo;
