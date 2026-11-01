// Known limit removed 2026-11-01 (orchestrator, from the closed privacy session): with 200,000 freshly marked orphan
// likes and no statistics on privacy_orphans, one batch of the orphan-likes delete took 167 s (the planner's join
// choice), far past PRIVACY_PURGE_BOX_MS, which is only checked between batches. Each batch now reads the oldest due keys
// through the first_seen_at index and deletes by primary key, so no plan choice can make a batch scan a table per row.
// This marks 200,000 orphan likes (and 20,000 rejects) as due, with no analyze, and times every batch.
// Skipped unless LOAD=1. How to run (DATABASE_URL set): LOAD=1 node --test lib/privacy-purge.load.test.ts
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const LOAD = process.env.LOAD === '1';
const hasDb = !!process.env.DATABASE_URL;
const log = (s: string) => console.log(`# load: ${s}`);
const LIKES = 200_000, REJECTS = 20_000;

before(async () => { if (LOAD && hasDb) await (await import('./db.ts')).sql.unsafe(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')).simple(); });
after(async () => { if (LOAD && hasDb) await (await import('./db.ts')).sql.end({ timeout: 1 }); });

test('200,000 due orphan likes, statistics taken before they existed: every purge batch stays far inside the time box', { skip: !LOAD ? 'heavy-use suite: set LOAD=1' : !hasDb && 'no DATABASE_URL', timeout: 1_800_000 }, async () => {
  const { sql } = await import('./db.ts');
  const { purgePrivacy, PRIVACY_PURGE_BOX_MS, PRIVACY_PURGE_BATCH, ORPHAN_GRACE_DAYS } = await import('./privacy-purge.ts');
  const tag = `pp${Math.random().toString(36).slice(2, 8)}`;
  const ids = (await sql`
    with a as (insert into signup_attempts (method, adult_attested_at) select 'dev', now() from generate_series(1, 21) returning id),
         n as (select id, row_number() over (order by id) as k from a)
    insert into users (handle, display_name, adult_attested_at, signup_attempt_id) select ${tag} || k, ${tag} || k, now(), id from n order by k returning id`).map((r) => r.id as number);
  const trader = ids[0], viewers = ids.slice(1);
  try {
    const t0 = performance.now();
    const seen = new Date(Date.now() - (ORPHAN_GRACE_DAYS + 1) * 86_400_000);
    // Likes and rejects of trades that are gone (no closed_trades row), already marked as gone 31 days ago: a large
    // mark, with no analyze since.
    await sql`insert into trade_likes (viewer_id, trade_key, trader_id)
      select (${viewers}::int[])[1 + i % ${viewers.length}], ${tag} || '-' || i, ${trader} from generate_series(1, ${LIKES}) i`;
    await sql`insert into trade_exclusions (viewer_id, trade_key, trader_id)
      select (${viewers}::int[])[1 + i % ${viewers.length}], ${tag} || '-x' || i, ${trader} from generate_series(1, ${REJECTS}) i`;
    // The orchestrator's review case: the likes and rejects analyzed with their rows in, privacy_orphans analyzed while
    // (nearly) empty of these rows, then the large mark lands with no analyze since.
    await sql`analyze trade_likes, trade_exclusions, privacy_orphans`;
    await sql`insert into privacy_orphans (kind, viewer_id, trade_key, first_seen_at)
      select 'like', viewer_id, trade_key, ${seen} from trade_likes where trader_id = ${trader}`;
    await sql`insert into privacy_orphans (kind, viewer_id, trade_key, first_seen_at)
      select 'reject', viewer_id, trade_key, ${seen} from trade_exclusions where trader_id = ${trader}`;
    log(`purge fixture: ${LIKES.toLocaleString('en-US')} due orphan likes, ${REJECTS.toLocaleString('en-US')} rejects, ${Math.round(performance.now() - t0)} ms setup (no analyze)`);
    // The box is checked before every batch: the gaps between those checks are the batches' times.
    const marks: number[] = [];
    let left = Infinity, rounds = 0;
    const s = performance.now();
    while (left > 0 && rounds < 20) {
      rounds++;
      const r = await purgePrivacy({ only: ['orphans'], clock: () => { const t = performance.now(); marks.push(t); return Date.now(); } });
      if (!r.ran) { await new Promise((x) => setTimeout(x, 200)); continue; } // another caller holds the purge lock
      [{ left }] = await sql`select (select count(*)::int from trade_likes where trader_id = ${trader}) + (select count(*)::int from trade_exclusions where trader_id = ${trader}) as left`;
    }
    const gaps = marks.slice(1).map((t, i) => t - marks[i]);
    const worst = Math.max(...gaps);
    log(`purge: ${LIKES + REJECTS} due rows removed in ${Math.round(performance.now() - s)} ms over ${rounds} call(s), ${gaps.length} batches of up to ${PRIVACY_PURGE_BATCH}, slowest batch ${worst.toFixed(0)} ms (box ${PRIVACY_PURGE_BOX_MS} ms)`);
    assert.equal(left, 0, 'every due like and reject removed');
    assert.equal((await sql`select count(*)::int as n from privacy_orphans where viewer_id = any(${viewers}) and trade_key like ${`${tag}-%`}`)[0].n, 0, 'their marks too');
    assert.ok(worst < PRIVACY_PURGE_BOX_MS / 4, `slowest batch ${worst.toFixed(0)} ms`);
  } finally {
    await sql`delete from users where id = any(${ids})`;
  }
});
