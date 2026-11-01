// F-7 importer (hourly-sync stage and dry run): daily index from a cursor, ≤ MAX_FILINGS_PER_TICK a tick, directors and
// officers only, removed filers never touched, one transaction per filing, counts-only logs (legal C8).
import { sql } from './db.ts';
import { deleteProfile, type DeletableUser } from './delete.ts';
import { filingsClient, FilingsStopped, parseFiling, type IndexEntry } from './public-filings.ts';
import { publicSources, publicTradersOn, type PublicSource } from './public-gate.ts';
import { matchPublic, rebuildPublicTrades, type PubRow } from './public-trades.ts';
import { logSafe } from './privacy-log.ts';
import { isLoopbackUrl, type Env } from './vendor-env.ts';

export const MAX_FILINGS_PER_TICK = 50, PUBLIC_IMPORT_LOCK = 47; // lock (47, hashtext(state)): one run at a time across instances
const SOURCE: PublicSource = 'insider_reports';
const zero = { ran: false, busy: false, dryRun: false, stopped: false, filings: 0, docsSkipped: 0, rowsSkipped: 0, roleSkipped: 0, removedSkipped: 0, failed: 0, filers: 0, priced: 0, five: 0 };
export type ImportReport = typeof zero & { excluded: Record<string, number> };
type Opts = { boxMs: number; env?: Env; baseUrl?: string; dryRun?: boolean; from?: string; max?: number; state?: string; today?: string };
const nextDay = (d: string) => new Date(Date.parse(`${d}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
export async function importPublicFilings(o: Opts): Promise<ImportReport> {
  const env = o.env ?? process.env, base = o.baseUrl ?? env.PUBLIC_FILINGS_BASE_URL;
  const report: ImportReport = { ...zero, dryRun: !!o.dryRun, excluded: {} }; if (!publicTradersOn(env) || !publicSources(env).includes(SOURCE) || !base) return report;
  if (o.dryRun && !(env.PUBLIC_TRADERS === '1' && env.PUBLIC_FILINGS_CONTACT?.trim())) throw new Error('the dry run needs PUBLIC_TRADERS=1 and PUBLIC_FILINGS_CONTACT');
  const state = o.state ?? SOURCE, conn = await sql.reserve(); // the 4 req/s pace is per process: overlapping runs skip
  try {
    if (!(await conn`select pg_try_advisory_lock(${PUBLIC_IMPORT_LOCK}, hashtext(${state})) as got`)[0].got) return { ...report, busy: true };
    try { return await run(o, env, base, state, report); } finally { await conn`select pg_advisory_unlock(${PUBLIC_IMPORT_LOCK}, hashtext(${state}))`; }
  } finally { conn.release(); }
}
async function run(o: Opts, env: Env, base: string, state: string, report: ImportReport): Promise<ImportReport> {
  const deadline = Date.now() + o.boxMs, client = filingsClient(base, env, deadline), demo = isLoopbackUrl(base); // loopback: fixture filers, Demo (C11)
  report.ran = true; const today = o.today ?? new Date().toISOString().slice(0, 10);
  const [st] = await sql`select cursor from public_import_state where source = ${state}`;
  // ponytail: a source with no cursor starts today (no backfill) — the dry run's day or a seeded cursor reads history.
  // The cursor's day is re-listed whole; ids already read that day are skipped (an entry listed late is never lost).
  let day: string = o.from ?? st?.cursor?.day ?? today, seen = new Set<string>(o.from ? [] : st?.cursor?.seen ?? []);
  const touched = new Set<string>(), dry = new Map<string, PubRow[]>(); async function one(e: IndexEntry) {
    const xml = await client.fetchFiling(e.id), { filing: f, skipped } = xml ? parseFiling(xml) : { filing: null, skipped: 0 };
    report.rowsSkipped += skipped;
    // ponytail: a filing with more than one reporting owner is skipped and counted — splitting joint rows needs a rule.
    if (!f || f.owners !== 1) return void report.docsSkipped++;
    if (!f.director && !f.officer) return void report.roleSkipped++;
    const rows: PubRow[] = f.rows.map((r, i) => ({
      external_id: `${e.id}:${i}`, filing_id: e.id, amends: e.amends ?? null, filing_url: e.url, symbol: f.symbol, code: r.code,
      side: r.code === 'P' && r.acquired ? 'BUY' : r.code === 'S' && !r.acquired ? 'SELL' : null, units: r.units, price: r.price, held_after: r.heldAfter,
      indirect: r.indirect, derivative: r.derivative, acquired: r.acquired, executed_at: new Date(`${r.date}T00:00:00Z`), filed_at: new Date(e.filedAt),
    }));
    touched.add(f.ownerKey);
    if (o.dryRun) return void dry.set(f.ownerKey, [...(dry.get(f.ownerKey) ?? []), ...rows]);
    await sql.begin(async (tx) => {
      const [pf] = await tx`insert into public_filers (source, filer_key, demo) values (${SOURCE}, ${f.ownerKey}, ${demo})
        on conflict (source, filer_key) do update set source = excluded.source returning id, removed_at`;
      if (pf.removed_at) return void report.removedSkipped++;
      if (rows.length) await tx`insert into public_transactions ${tx(rows.map((r) => ({ ...r, filer_id: pf.id })))} on conflict (filer_id, external_id) do nothing`;
      await rebuildPublicTrades(pf.id, tx, f.ownerName);
    });
  }
  try {
    walk: while (day <= today && Date.now() < deadline) {
      const list = await client.listFilings({ day });
      for (const e of list.filter((x) => !seen.has(x.id))) {
        if (report.filings >= (o.max ?? MAX_FILINGS_PER_TICK) || Date.now() >= deadline) break walk;
        // ponytail: a filing that fails to store is passed over; a re-read from an earlier cursor retries it
        try { await one(e); } catch (x) { if (x instanceof FilingsStopped) throw x; report.failed++; console.error('public import: filing failed', logSafe(x)); }
        report.filings++; seen.add(e.id);
      }
      if (day === today) break;
      day = nextDay(day); seen = new Set();
    }
  } catch (e) { if (!(e instanceof FilingsStopped)) throw e; report.stopped = true; }
  report.filers = touched.size;
  for (const m of [...dry.values()].map(matchPublic)) {
    report.priced += +(m.trades.length > 0); report.five += +(m.trades.length >= 5);
    for (const [k, n] of Object.entries(m.excluded)) report.excluded[k] = (report.excluded[k] ?? 0) + n;
  }
  if (!o.dryRun) {
    const ok = !report.stopped && !report.failed;
    await sql`insert into public_import_state (source, cursor, last_success_at) values (${state}, ${sql.json({ day, seen: [...seen] })}, ${ok ? sql`now()` : null})
      on conflict (source) do update set cursor = excluded.cursor, last_success_at = coalesce(excluded.last_success_at, public_import_state.last_success_at)`;
  }
  console.log('public import', JSON.stringify(report)); // counts only
  return report;
}
export const FILER_ACTIONS = ['hide', 'unhide', 'remove'] as const;
export const FILER_REASONS = ['request', 'review', 'error', 'amendment'] as const;
// Operator actions (C13, C14), logged with a reason code only. Remove: removed_at first (never re-imported), profile deleted as
// an account deletion (handle reserved), raw rows and counts cleared.
export async function filerAction(filerId: number, action: (typeof FILER_ACTIONS)[number], reason: string): Promise<boolean> {
  if (!FILER_ACTIONS.includes(action) || !(FILER_REASONS as readonly string[]).includes(reason)) throw new Error('unknown action or reason');
  const [pf] = await sql`update public_filers set hidden_at = case ${action} when 'hide' then coalesce(hidden_at, now()) when 'unhide' then null else hidden_at end,
    removed_at = case when ${action} = 'remove' then now() end where id = ${filerId} and removed_at is null returning id`;
  if (!pf) return false;
  if (action === 'remove') {
    const [u] = await sql<DeletableUser[]>`select id, handle, snaptrade_user_id, snaptrade_secret_enc from users where public_filer_id = ${filerId}`;
    if (u) await deleteProfile(u);
    await sql`delete from public_transactions where filer_id = ${filerId}`;
    await sql`update public_filers set excluded = '{}', open_symbols = '{}', hidden_at = null where id = ${filerId}`;
  }
  await sql`insert into public_filer_log (filer_id, action, reason) values (${filerId}, ${action}, ${reason})`;
  return true;
}
