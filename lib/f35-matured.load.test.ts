// F-35 AC7 (docs/features/F-35-publish-once-the-date-has-passed.md): the matured-rows query (lib/sync-shard.ts#maturedQuery)
// at the LOAD shape: 100,000 traders, 2,000,000 activities (1% stored while dated ahead: half matured inside the window,
// half still ahead), 200,000 option rows and 20,000 corporate actions with the same split. The plan must read the three
// partial indexes in both branches, never a sequential scan of a raw table, and the rows it reads from the raw tables
// must stay within the future-stored rows (EXPLAIN ANALYZE rows-read and buffers, never wall-clock timings).
// Everything is created in one transaction that is rolled back (no row is left, none of another test's rows is changed).
// Skipped unless LOAD=1. How to run (DATABASE_URL set): LOAD=1 node --test lib/f35-matured.load.test.ts
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const LOAD = process.env.LOAD === '1';
const hasDb = !!process.env.DATABASE_URL;
const FIX = { traders: 100_000, activities: 20, options: 2, actions: 0.2, futureEvery: 100 };
const log = (s: string) => console.log(`# load: ${s}`);

before(async () => { if (LOAD && hasDb) await (await import('./db.ts')).sql.unsafe(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')).simple(); });
after(async () => { if (LOAD && hasDb) await (await import('./db.ts')).sql.end({ timeout: 1 }); });

type Node = { 'Node Type': string; 'Relation Name'?: string; 'Index Name'?: string; 'Actual Rows'?: number; 'Actual Loops'?: number; 'Rows Removed by Filter'?: number; 'Shared Hit Blocks'?: number; 'Shared Read Blocks'?: number; Plans?: Node[] };

test('F-35 AC7 at the LOAD shape: the matured-rows query reads the partial indexes only (both branches), rows read bounded by the future-stored rows', { skip: !LOAD ? 'heavy-use suite: set LOAD=1' : !hasDb && 'no DATABASE_URL', timeout: 1_800_000 }, async () => {
  const { sql } = await import('./db.ts');
  const H = await import('./sync-shard.ts');
  const rollback = Symbol('rollback');
  try {
    await sql.begin(async (tx) => {
      const tag = `l${Math.random().toString(36).slice(2, 7)}`;
      const ids = (await tx`with a as (insert into signup_attempts (method, adult_attested_at) select 'dev', now() from generate_series(1, ${FIX.traders}) returning id)
        insert into users (handle, display_name, adult_attested_at, signup_attempt_id) select ${tag} || a.id, 'Load', now(), a.id from a returning id`).map((r) => r.id as number);
      const lo = Math.min(...ids), hi = Math.max(...ids);
      // Row k of a table: every futureEvery-th row stored while dated ahead (even ones matured inside the window, odd ones
      // still ahead); every other row dated in the past, stored an hour after its date.
      const dates = (k: string) => tx`case when ${tx.unsafe(k)} % ${FIX.futureEvery} = 0 then
          (case when (${tx.unsafe(k)} / ${FIX.futureEvery}) % 2 = 0 then now() - (random() * 7) * interval '1 day' else now() + (random() * 2) * interval '1 day' end)
        else now() - (1 + random() * 1000) * interval '1 day' end`;
      await tx`insert into activities (user_id, source, external_id, account_id, symbol, side, units, price, fee, executed_at, raw, created_at)
        select x.uid, 'snaptrade', ${tag} || '-a' || x.k, ${tag} || '-acc', 'L' || (x.k % 50), case when x.k % 2 = 0 then 'BUY' else 'SELL' end, 1, 10, 0, x.e, '{}'::jsonb,
          case when x.k % ${FIX.futureEvery} = 0 then x.e - interval '30 hours' else x.e + interval '1 hour' end
        from (select ${lo}::int + (k % ${FIX.traders}) as uid, k, ${dates('k')} as e from generate_series(0, ${FIX.traders * FIX.activities - 1}) k) x`;
      await tx`insert into option_activities (user_id, source, external_id, account_id, executed_at, raw, created_at)
        select x.uid, 'snaptrade', ${tag} || '-o' || x.k, ${tag} || '-acc', x.e, '{}'::jsonb,
          case when x.k % ${FIX.futureEvery} = 0 then x.e - interval '30 hours' else x.e + interval '1 hour' end
        from (select ${lo}::int + (k % ${FIX.traders}) as uid, k, ${dates('k')} as e from generate_series(0, ${FIX.traders * FIX.options - 1}) k) x`;
      await tx`insert into corporate_actions (user_id, source, external_id, account_id, symbol, kind, detail, executed_at, raw, created_at)
        select x.uid, 'snaptrade', ${tag} || '-c' || x.k, ${tag} || '-acc', 'L1', 'split', '{}'::jsonb, x.e, '{}'::jsonb,
          case when x.k % ${FIX.futureEvery} = 0 then x.e - interval '30 hours' else x.e + interval '1 hour' end
        from (select ${lo}::int + (k % ${FIX.traders}) as uid, k, ${dates('k')} as e from generate_series(0, ${Math.round(FIX.traders * FIX.actions) - 1}) k) x`;
      // Half the traders already rebuilt (a watermark a day back), half never (null: the catch-up branch).
      await tx`update users set published_through = now() - interval '1 day' where id between ${lo} and ${hi} and id % 2 = 0`;
      await tx`analyze activities`;
      await tx`analyze option_activities`;
      await tx`analyze corporate_actions`;
      await tx`analyze users`;
      const futureStored: Record<string, number> = {};
      for (const t of ['activities', 'option_activities', 'corporate_actions']) {
        futureStored[t] = (await tx`select count(*)::int as n from ${tx(t)} where user_id between ${lo} and ${hi} and executed_at > created_at`)[0].n as number;
      }
      const [{ 'QUERY PLAN': plan }] = await tx`explain (analyze, buffers, format json) ${H.maturedQuery({ shard: 0, of: 1 }, { idRange: [lo, hi] }, H.MATURED_PER_RUN)}`;
      const nodes: Node[] = [];
      const walk = (n: Node) => { nodes.push(n); for (const c of n.Plans ?? []) walk(c); };
      walk((plan as { Plan: Node }[])[0].Plan);
      const scans = nodes.filter((n) => n['Relation Name'] && ['activities', 'option_activities', 'corporate_actions'].includes(n['Relation Name']));
      for (const n of scans) log(`${n['Node Type']} ${n['Relation Name']} ${n['Index Name'] ?? ''} rows=${n['Actual Rows']}×${n['Actual Loops']} removed=${n['Rows Removed by Filter'] ?? 0} hit=${n['Shared Hit Blocks'] ?? 0} read=${n['Shared Read Blocks'] ?? 0}`);
      const bitmap = nodes.filter((n) => n['Node Type'] === 'Bitmap Index Scan').map((n) => n['Index Name']);
      log(`future-stored rows: ${JSON.stringify(futureStored)}; bitmap index scans: ${JSON.stringify(bitmap)}`);
      for (const t of ['activities', 'option_activities', 'corporate_actions']) {
        const own = scans.filter((n) => n['Relation Name'] === t);
        assert.ok(!own.some((n) => n['Node Type'] === 'Seq Scan'), `no sequential scan of ${t}`);
        const used = own.filter((n) => n['Index Name'] === `${t}_future_stored`).length + bitmap.filter((i) => i === `${t}_future_stored`).length;
        assert.ok(used >= 2, `${t}_future_stored drives both branches (${used})`);
        assert.ok(own.every((n) => !n['Index Name'] || n['Index Name'] === `${t}_future_stored`), `${t} is read through its partial index only`);
        // Rows read from the table (returned plus removed by a filter), over both branches: within the future-stored rows.
        const read = own.reduce((a, n) => a + ((n['Actual Rows'] ?? 0) + (n['Rows Removed by Filter'] ?? 0)) * (n['Actual Loops'] ?? 1), 0);
        log(`${t}: rows read ${read}, future-stored ${futureStored[t]}`);
        assert.ok(read <= futureStored[t] + 1_000, `${t}: rows read ${read} within the future-stored rows ${futureStored[t]} (+ other records' few)`);
      }
      throw rollback;
    });
  } catch (e) { if (e !== rollback) throw e; }
});
