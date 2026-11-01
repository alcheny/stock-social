// Known limit removed 2026-11-01 (orchestrator, from the closed privacy session): with 200,000 freshly marked orphan
// likes and no statistics on privacy_orphans, one batch of the orphan-likes delete took 167 s (the planner's join
// choice), far past PRIVACY_PURGE_BOX_MS, which is only checked between batches. Each batch now reads the oldest due keys
// through the first_seen_at index and deletes by primary key, so no plan choice can make a batch scan a table per row.
// This marks 200,000 orphan likes (and 20,000 rejects) as due, with no analyze, and times every batch.
// Known-limits sweep 2 (purge): the second case holds 1,000,000 orphans of which 100 are due, and shows that a call does
// bounded work (the clearing and marking steps walk a window of the trade_key hash space per batch, within a per-step
// budget, from a persisted cursor) and that one lap over every key still takes at most 10 calls.
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
    let left = Infinity, rounds = 0, waits = 0;
    const s = performance.now();
    while (left > 0 && rounds < 20 && waits < 600) {
      const r = await purgePrivacy({ only: ['orphans'], clock: () => { const t = performance.now(); marks.push(t); return Date.now(); } });
      if (!r.ran) { waits++; await new Promise((x) => setTimeout(x, 200)); continue; } // another caller holds the purge lock
      rounds++;
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

test('1,000,000 orphans, 100 due, statistics taken before the marks: each call does bounded work, the due rows go on the first call, one lap over every key takes at most 10 calls', { skip: !LOAD ? 'heavy-use suite: set LOAD=1' : !hasDb && 'no DATABASE_URL', timeout: 3_600_000 }, async () => {
  const { sql } = await import('./db.ts');
  const m = await import('./privacy-purge.ts');
  const { purgePrivacy, PRIVACY_PURGE_BOX_MS, ORPHAN_GRACE_DAYS } = m;
  const ORPHANS = 1_000_000, DUE = 100;
  const tag = `pq${Math.random().toString(36).slice(2, 8)}`;
  const ids = (await sql`
    with a as (insert into signup_attempts (method, adult_attested_at) select 'dev', now() from generate_series(1, 21) returning id),
         n as (select id, row_number() over (order by id) as k from a)
    insert into users (handle, display_name, adult_attested_at, signup_attempt_id) select ${tag} || k, ${tag} || k, now(), id from n order by k returning id`).map((r) => r.id as number);
  const trader = ids[0], viewers = ids.slice(1);
  const attempts = (await sql`select signup_attempt_id as a from users where id = any(${ids})`).map((r) => r.a as number);
  try {
    const t0 = performance.now();
    // Likes of trades that are gone, with sha256-shaped keys (a real trade_key's shape), all marked: 100 marked 31 days
    // ago (due), the rest yesterday. Statistics taken before the marks exist, none since.
    await sql`insert into trade_likes (viewer_id, trade_key, trader_id)
      select (${viewers}::int[])[1 + i % ${viewers.length}], encode(sha256((${tag} || ':' || i)::bytea), 'hex'), ${trader} from generate_series(1, ${ORPHANS}) i`;
    await sql`analyze trade_likes, trade_exclusions, privacy_orphans`;
    const due = new Date(Date.now() - (ORPHAN_GRACE_DAYS + 1) * 86_400_000), fresh = new Date(Date.now() - 86_400_000);
    // A concurrent purge may mark some of these likes first (the upsert), or deadlock with this insert on them (retried).
    for (let attempt = 1; ; attempt++) {
      try {
        await sql`insert into privacy_orphans (kind, viewer_id, trade_key, first_seen_at)
          select 'like', (${viewers}::int[])[1 + i % ${viewers.length}], encode(sha256((${tag} || ':' || i)::bytea), 'hex'), case when i <= ${DUE} then ${due}::timestamptz else ${fresh}::timestamptz end
          from generate_series(1, ${ORPHANS}) i
          on conflict (kind, viewer_id, trade_key) do update set first_seen_at = excluded.first_seen_at`;
        break;
      } catch (e) { if ((e as { code?: string }).code !== '40P01' || attempt >= 3) throw e; }
    }
    log(`purge fixture: ${ORPHANS.toLocaleString('en-US')} orphan likes (${DUE} due), ${Math.round(performance.now() - t0)} ms setup (no analyze since the marks)`);
    const lapsOf = async () => {
      try { return new Map((await sql`select step, laps::int as laps from privacy_purge_cursors`).map((r) => [r.step as string, r.laps as number])); } catch { return null; }
    };
    // Every cursor at the start of the hash space, so the lap is a whole one, with the widest window (the worst case: a
    // span learned while the tables were small, then a large growth).
    try {
      await sql`insert into privacy_purge_cursors (step, pos, span) select s, 0, 4294967296 from unnest(${['clear', 'mark-like', 'mark-reject']}::text[]) s
        on conflict (step) do update set pos = 0, span = 4294967296, swept = 0`;
    } catch { /* no cursor table: the code before the change */ }
    const start = await lapsOf();
    const steps = ['clear', 'mark-like', 'mark-reject'];
    const lapped = (now: Map<string, number> | null) => !!now && steps.every((s) => (now.get(s) ?? 0) > (start?.get(s) ?? 0));
    const calls: number[] = [], marks: number[] = [];
    let removed = 0, lapCalls = 0, leftAfterFirst = -1;
    for (let waits = 0; calls.length < (start ? 12 : 3) && waits < 600;) {
      const s = performance.now();
      const r = await purgePrivacy({ only: ['orphans'], clock: () => { marks.push(performance.now()); return Date.now(); } });
      if (!r.ran) { waits++; await new Promise((x) => setTimeout(x, 200)); continue; } // another caller holds the purge lock
      calls.push(performance.now() - s);
      removed += r.likes;
      if (calls.length === 1) leftAfterFirst = (await sql`select count(*)::int as n from trade_likes where trader_id = ${trader}`)[0].n;
      if (!lapCalls && lapped(await lapsOf())) { lapCalls = calls.length; break; }
    }
    const gaps = marks.slice(1).map((t, i) => t - marks[i]);
    log(`purge 1M: calls ${calls.map((c) => c.toFixed(0)).join(', ')} ms; slowest batch ${Math.max(...gaps).toFixed(0)} ms; one lap in ${lapCalls || 'n/a'} call(s); removed ${removed}`);
    assert.equal(leftAfterFirst, ORPHANS - DUE, 'the due likes go on the first call');
    assert.ok(Math.max(...calls) < PRIVACY_PURGE_BOX_MS * 0.6, `slowest call ${Math.max(...calls).toFixed(0)} ms`);
    assert.ok(Math.max(...gaps) < PRIVACY_PURGE_BOX_MS / 4, `slowest batch ${Math.max(...gaps).toFixed(0)} ms`);
    assert.ok(lapCalls > 0 && lapCalls <= 10, `one lap over every key in ${lapCalls} calls`);
    assert.equal((await sql`select count(*)::int as n from privacy_orphans where viewer_id = any(${viewers})`)[0].n, ORPHANS - DUE, 'the other marks stay');
  } finally {
    await sql`delete from users where id = any(${ids})`;
    await sql`delete from signup_attempts where id = any(${attempts})`;
  }
});
