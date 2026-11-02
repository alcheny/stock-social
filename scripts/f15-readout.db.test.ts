// F-15 second half · the readout's G2 floor (orchestrator review A): the readout counts share_action rows from
// g2FloorOffset(SHARE_RETENTION_DAYS) days before the window's last day, so a purge run up to 7 days after the window
// (the latest a run can see that window) never removes a counted row: same window, same G2 before and after the purge.
// Shared database: this test makes its own users and rows, uses a far-past window and reads only its own users.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const hasDb = !!process.env.DATABASE_URL;
const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL' }, fn);
before(async () => { if (hasDb) await (await import('../lib/db.ts')).sql.unsafe(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')).simple(); });
after(async () => { if (hasDb) await (await import('../lib/db.ts')).sql.end({ timeout: 1 }); });

dbTest('F-15 G2: the same window prints the same G2 before and after purgePrivacy step shares', async () => {
  const { sql } = await import('../lib/db.ts');
  const { SHARE_RETENTION_DAYS } = await import('../lib/share-actions.ts');
  const { purgePrivacy } = await import('../lib/privacy-purge.ts');
  const { buildReadout, g2FloorOffset, loadG2, weekWindow } = await import('./f15-readout.ts');
  const now = new Date(Date.UTC(1992, 5, 17, 12)); // a Wednesday; the window ends Sunday 1992-06-14
  const { to } = weekWindow(now);
  assert.equal(to, '1992-06-14');
  const floor = g2FloorOffset(SHARE_RETENTION_DAYS);
  const day = (back: number) => new Date(Date.parse(`${to}T00:00:00Z`) - back * 86_400_000);
  const ids: number[] = [];
  const user = async () => {
    const [a] = await sql`insert into signup_attempts (method, adult_attested_at) values ('dev', now()) returning id`;
    const h = `f15r${Math.random().toString(36).slice(2, 10)}`;
    const [u] = await sql`insert into users (handle, display_name, adult_attested_at, signup_attempt_id) values (${h}, ${h}, now(), ${a.id}) returning id`;
    await sql`insert into connections (attempt_id, user_id, state, connected_at) values (${a.id}, ${u.id}, 'connected', now())`;
    ids.push(u.id);
    return u.id as number;
  };
  const share = (id: number, back: number, surface = 'card', outcome = 'sheet', sign = 'up') =>
    sql`insert into share_action (user_id, day, surface, outcome, record_sign) values (${id}, ${day(back)}::date, ${surface}, ${outcome}, ${sign})`;
  try {
    // 7 card sharers (no cell under 5, so every G2 figure prints): one only on the floor's edge day, the rest inside.
    await share(await user(), floor);
    for (let i = 0; i < 6; i++) await share(await user(), 10 + i);
    // 5 traders whose only rows are older than the floor (inside the 120-day bound at the window's end, purged 7 days
    // later) or after the window: counted by neither run.
    for (let i = 0; i < 4; i++) { const id = await user(); await share(id, floor + 1); await share(id, SHARE_RETENTION_DAYS - 2); }
    await share(await user(), -3);
    const g2Of = async () => {
      const g2 = await loadG2(sql, to, SHARE_RETENTION_DAYS, ids);
      const md = buildReadout({ rollup: [], drops: [], g1: { strict: g2.traders.length, partial: 0 }, g2 }, now);
      return md.slice(md.indexOf('## G2'), md.indexOf('## G3'));
    };
    const beforePurge = await g2Of();
    assert.match(beforePurge, /\| Of those, share their card at least once \| ≥ 60% \| 7 of 12 \(58%\) \|/);
    const old = async () => (await sql`select count(*)::int n from share_action where user_id = any(${ids}::int[]) and day < ${day(floor)}::date`)[0].n;
    assert.equal(await old(), 8);
    const r = await purgePrivacy({ now: new Date(Date.parse(`${to}T23:30:00Z`) + 7 * 86_400_000), only: ['shares'] });
    assert.equal(r.done, true);
    assert.equal(await old(), 0, 'the purge removed the rows past the bound');
    const kept = await sql`select count(*)::int n from share_action where user_id = any(${ids}::int[]) and day = ${day(floor)}::date`;
    assert.equal(kept[0].n, 1, 'the floor edge day survives the purge');
    assert.equal(await g2Of(), beforePurge);
  } finally {
    await sql`delete from users where id = any(${ids}::int[])`;
  }
});

// Cycle 4 F4-11 (C4-4) and F4-12 (C4-20): the rollup query's demo predicate covers fictional fixture filers
// (public_filers.demo), not only users with a demo activity; Demo-target invite views reach the invite rows only.
dbTest('F-15 readout: a fixture filer view is in no G3 row and not in "all"; a Demo invite view reaches only the invite rows', async () => {
  const { sql } = await import('../lib/db.ts');
  const { buildReadout, loadRollup, weekWindow } = await import('./f15-readout.ts');
  const now = new Date(Date.UTC(1993, 2, 10, 12)); // a Wednesday; the window's last week is 1993-03-01..07
  const { from, to } = weekWindow(now);
  const day = '1993-03-02';
  const ids: number[] = [], attempts: number[] = [], filers: number[] = [];
  const user = async () => {
    const [a] = await sql`insert into signup_attempts (method, adult_attested_at) values ('dev', now()) returning id`;
    const h = `f15d${Math.random().toString(36).slice(2, 10)}`;
    const [u] = await sql`insert into users (handle, display_name, adult_attested_at, signup_attempt_id) values (${h}, ${h}, now(), ${a.id}) returning id`;
    ids.push(u.id); attempts.push(a.id);
    return u.id as number;
  };
  const views = (userId: number, n: number, via = 'none', surface = 'profile') =>
    sql`insert into view_rollup (day, surface, user_id, ref_class, via, signed_in, self_view, n) values (${day}::date, ${surface}, ${userId}, 'external', ${via}, false, false, ${n})`;
  try {
    const trader = await user();
    await views(trader, 7);
    const filerUser = await user();
    const [f] = await sql`insert into public_filers (source, filer_key, demo) values ('insider_reports', ${'f15d-' + Math.random().toString(36).slice(2, 10)}, true) returning id`;
    filers.push(f.id);
    await sql`update users set public_filer_id = ${f.id} where id = ${filerUser}`;
    await views(filerUser, 11);
    await views(filerUser, 6, 'card', 'trade');
    const demoUser = await user();
    await sql`insert into activities (user_id, source, external_id, account_id, symbol, side, units, price, executed_at, raw)
      values (${demoUser}, 'demo', ${'f15d-' + Math.random().toString(36).slice(2, 12)}, 'a', 'F15D', 'BUY', 1, 1, now(), '{}')`;
    await views(demoUser, 8, 'inv_t');
    await views(demoUser, 13); // a Demo view without an invite code
    const rollup = await loadRollup(sql, from, to, ids);
    const md = buildReadout({ rollup, drops: [], g1: { strict: 0, partial: 0 }, g2: { traders: [], firstDay: null, retentionDays: 120 } }, now);
    const cells = (label: string) => (md.split('\n').find((l) => l.startsWith(`| ${label}`)) ?? '').slice(1, -1).split('|').map((c) => c.trim());
    const last = (label: string, skip = 2) => cells(label).slice(skip)[7];
    assert.equal(last('Profile views from external referrers / week'), '7', 'the trader only: no filer, no Demo user');
    assert.equal(last('partial: tagged links, card'), '0', 'the fixture filer\'s card view is not counted');
    assert.equal(last('partial: trade surface, external referrer'), '0');
    assert.equal(last('partial: invite links (inv_*)'), '8');
    assert.equal(last('partial: invite landings on Demo profiles'), '8');
    assert.equal(last('all | all'), '7');
    assert.equal(last('counted views', 1), '7');
  } finally {
    await sql`delete from users where id = any(${ids}::int[])`;
    await sql`delete from public_filers where id = any(${filers}::int[])`;
    await sql`delete from signup_attempts where id = any(${attempts}::bigint[])`;
  }
});

// ---- F-33 AC10: the ranked-records loader (one statement; EXPLAIN rows read) ----
type PlanNode = { 'Node Type': string; 'Relation Name'?: string; 'Index Name'?: string; 'Actual Rows': number; 'Actual Loops': number;
  'Rows Removed by Filter'?: number; 'Rows Removed by Index Recheck'?: number; Plans?: PlanNode[] };
const planNodes = (n: PlanNode): PlanNode[] => [n, ...(n.Plans ?? []).flatMap(planNodes)];
const rowsRead = (n: PlanNode) => (n['Actual Rows'] + (n['Rows Removed by Filter'] ?? 0) + (n['Rows Removed by Index Recheck'] ?? 0)) * n['Actual Loops'];

dbTest('F-33 AC10: loadRanked counts visible, non-Demo records with ranking weight above 0 in one statement that reads each close once (EXPLAIN)', async () => {
  const { sql } = await import('../lib/db.ts');
  const { loadRanked } = await import('./f15-readout.ts');
  const { rankedQuery } = await import('../lib/feed.ts');
  const ids: number[] = [];
  const DAY = 86_400_000, now = Date.now();
  const user = async () => {
    const [a] = await sql`insert into signup_attempts (method, adult_attested_at) values ('dev', now()) returning id`;
    const h = `f33r${Math.random().toString(36).slice(2, 10)}`;
    const [u] = await sql`insert into users (handle, display_name, adult_attested_at, signup_attempt_id) values (${h}, ${h}, now(), ${a.id}) returning id`;
    ids.push(u.id);
    return u.id as number;
  };
  // k one-day bets over `days` days, each +2% ± 1 point (weighted once at the tier), or ± 30 points (crosses zero).
  const closes = (u: number, k: number, days: number, spread = 0.01) => Array.from({ length: k }, (_, i) => {
    const closed = now - DAY - (i / (k - 1)) * (days - 1) * DAY;
    return { user_id: u, sell_id: `f33r-${u}-${i}`, account_id: 'a', symbol: `F33R${i}`, opened_at: new Date(closed - DAY), closed_at: new Date(closed),
      return_pct: 0.02 + (i % 2 ? spread : -spread), holding_days: 1, verified: true };
  });
  try {
    const weighted = await Promise.all([1, 2, 3].map(() => user()));
    const [short, crossing, demo, deleted] = [await user(), await user(), await user(), await user()];
    const rows = [...weighted.flatMap((u) => closes(u, 40, 120)), ...closes(short, 20, 120), ...closes(crossing, 40, 120, 0.3), ...closes(demo, 40, 120), ...closes(deleted, 40, 120)];
    await sql`insert into closed_trades ${sql(rows)}`;
    await sql`insert into activities (user_id, source, external_id, account_id, symbol, side, units, price, executed_at, raw)
      values (${demo}, 'demo', ${'f33r-' + Math.random().toString(36).slice(2, 12)}, 'a', 'F33R', 'BUY', 1, 1, now(), '{}')`;
    await sql`update users set deleted_at = now() where id = ${deleted}`;
    assert.equal(await loadRanked(sql, new Date(), ids), 3, 'the three weighted records; not the short, crossing, Demo or deleted one');
    // Closes after asOf are not counted: at a time before every close, nothing weighs.
    assert.equal(await loadRanked(sql, new Date(now - 200 * DAY), ids), 0);
    // One statement; closed_trades is read once per close of the users it keeps, never per user per close.
    const [r] = await sql`explain (analyze, format json) ${rankedQuery(new Date(), sql`exists (select 1 from activities a where a.user_id = u.id and a.source = 'demo')`, ids).q}`;
    const nodes = planNodes((r['QUERY PLAN'] as { Plan: PlanNode }[])[0].Plan);
    // On a small table the planner reads it in one pass; with the user filter selective it reads only those users' closes
    // through the user index. Either way at most one read per close in the table: never once per user per close.
    const read = nodes.filter((n) => n['Relation Name'] === 'closed_trades' || n['Index Name']?.startsWith('closed_trades_')).reduce((a, n) => a + rowsRead(n), 0);
    const [{ total }] = await sql`select count(*)::int as total from closed_trades`;
    assert.ok(read >= rows.length - 80, `at least the kept users' closes are read (${read})`); // 80: the Demo and deleted users' closes may be skipped
    assert.ok(read <= Math.max(total, rows.length), `closed_trades rows read: ${read}, rows in the table: ${total}`);
    assert.equal(nodes.filter((n) => n['Node Type'] === 'Seq Scan' && n['Relation Name'] === 'closed_trades' && n['Actual Loops'] > 1).length, 0, 'no repeated scan');
    const acts = nodes.filter((n) => n['Relation Name'] === 'activities');
    for (const n of acts) assert.ok(n['Actual Loops'] <= ids.length, `the Demo check runs per user (${n['Actual Loops']} loops), never per close`);
  } finally {
    await sql`delete from users where id in ${sql(ids)}`;
  }
});
