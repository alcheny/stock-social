// F-15 owner readout (docs/features/F-15-measurement-foundation.md; plan docs/features/logs/F-15/plan.md §5 Q7 and
// "Readout rules"). Descriptive counts only, for the owner, run by hand once a week:
//   node --env-file=.env scripts/f15-readout.ts --out <dir outside the repo>
// The output is never committed: --out must resolve outside the repository (resolveOut). It names no handle, no user id
// and no return, prints the DESIGN §3.5 metric and threshold verbatim beside every gate figure, and never redefines a gate
// (MRC2-3 stays with the owner). Every printed count from 1 to 4 reads "<5" (POLICY P3: a count of 1 on an invite link
// reveals who opened it), with complementary suppression so a hidden cell can't be worked out from the others.
// buildReadout is pure (tested in scripts/f15-readout.test.ts); main is a thin shell around the database.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, realpathSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { INVITE_VIAS, VIA_NONE, isViewVia } from '../lib/referral.ts';
import { DROP_REASONS, SURFACES } from '../lib/views.ts';

export const WEEKS = 8;
export const SMALL = 5; // counts 1..SMALL-1 print as "<5"

// DESIGN §3.5 (docs/DESIGN.md), verbatim: metric | continue if.
export const GATES = [
  { id: 'G1', metric: 'Traders with a connected broker', threshold: '≥ 50' },
  { id: 'G2', metric: 'Of those, share their card at least once', threshold: '≥ 60%' },
  { id: 'G3', metric: 'Profile views from external referrers / week', threshold: '≥ 5,000' },
  { id: 'G4', metric: 'Viewer D7 return', threshold: '≥ 15%' },
] as const;
export const G2_TEXT = 'after the share_action slice';
export const G3_LABEL = 'views, not people';
export const G3_OWNER_LINE = "Signed-out owner views can't be told from other views.";
export const G4_TEXT = "strict G4 can't be read in this slice; signed-out D7 return is not measured";

// ---- input ----
// rollup: view_rollup summed over user_id, demo and deleted targets already excluded by the query. drops: view_drops.
// counted: every rollup view per day (demo targets included, like view_drops), the drop-share denominator.
// g1: strict = non-demo, non-deleted users with a connection in state 'connected'; partial = such users whose
// connections exist but none is 'connected'. Only the fields named here are read; anything else on a row is ignored.
export type Day = string | Date;
export type RollupRow = { day: Day; surface: string; ref_class: string; via: string; self_view: boolean; n: number };
export type DropRow = { day: Day; surface: string; reason: string; n: number };
export type CountRow = { day: Day; n: number };
export type ReadoutInput = { rollup: RollupRow[]; drops: DropRow[]; counted: CountRow[]; g1: { strict: number; partial: number } };

// ---- weeks (ISO, Monday start, UTC) ----
const DAY_MS = 86_400_000;
const isoDay = (d: Day): string | null => {
  if (d instanceof Date) return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  return typeof d === 'string' && /^\d{4}-\d{2}-\d{2}/.test(d) ? d.slice(0, 10) : null;
};
const mondayOf = (ms: number): number => {
  const d = Math.floor(ms / DAY_MS) * DAY_MS;
  return d - ((new Date(d).getUTCDay() + 6) % 7) * DAY_MS;
};
export function isoWeekLabel(mondayMs: number): string {
  const thu = new Date(mondayMs + 3 * DAY_MS);
  const y = thu.getUTCFullYear();
  const w = 1 + Math.floor((thu.getTime() - Date.UTC(y, 0, 1)) / DAY_MS / 7);
  return `${y}-W${String(w).padStart(2, '0')}`;
}
// The WEEKS ISO weeks ending with the one holding `now` (that one is partial).
export function weekWindow(now: Date): { from: string; to: string; mondays: number[] } {
  const last = mondayOf(now.getTime());
  const mondays = Array.from({ length: WEEKS }, (_, i) => last - (WEEKS - 1 - i) * 7 * DAY_MS);
  return { from: new Date(mondays[0]).toISOString().slice(0, 10), to: new Date(last + 6 * DAY_MS).toISOString().slice(0, 10), mondays };
}
const weekIndex = (mondays: number[], d: Day): number => {
  const s = isoDay(d);
  if (!s) return -1;
  return mondays.indexOf(mondayOf(Date.parse(`${s}T00:00:00Z`)));
};
const count = (n: unknown): number => (typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.floor(n) : 0);

// ---- small-cell suppression ----
// hidden[r][c]: true = not printed. Cells 1..4 are hidden; when exactly one cell of a row (and, with cols, of a column)
// is hidden, the next-smallest non-zero visible cell is hidden too; repeated until nothing changes.
export function suppress(grid: number[][], cols: boolean, start?: boolean[][]): boolean[][] {
  const hidden = grid.map((row, r) => row.map((v, c) => (v > 0 && v < SMALL) || start?.[r]?.[c] === true));
  const groups: [number, number][][] = grid.map((row, r) => row.map((_, c) => [r, c] as [number, number]));
  if (cols && grid.length) for (let c = 0; c < grid[0].length; c++) groups.push(grid.map((_, r) => [r, c] as [number, number]));
  for (let changed = true; changed;) {
    changed = false;
    for (const g of groups) {
      if (g.filter(([r, c]) => hidden[r][c]).length !== 1) continue;
      let best: [number, number] | null = null;
      for (const [r, c] of g) if (!hidden[r][c] && grid[r][c] > 0 && (!best || grid[r][c] < grid[best[0]][best[1]])) best = [r, c];
      if (best) { hidden[best[0]][best[1]] = true; changed = true; }
    }
  }
  return hidden;
}
const fmt = (n: number) => n.toLocaleString('en-US');
// A printed count: 0 → "0", 1..4 → "<5", a complementary-hidden cell → "(s)".
const cell = (v: number, hidden: boolean) => (v > 0 && v < SMALL ? '<5' : hidden ? '(s)' : fmt(v));
// A total over cells: exact only when none is hidden, else "≥ n" over the visible ones (and never a value 1..4).
function total(values: number[], hidden: boolean[]): string {
  const visible = values.reduce((s, v, i) => s + (hidden[i] ? 0 : v), 0);
  if (hidden.some(Boolean)) return `≥ ${fmt(visible)}`;
  return cell(visible, false);
}

// ---- markdown ----
const table = (head: string[], rows: string[][]) =>
  [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.join(' | ')} |`)].join('\n');
const safeLabel = (s: string) => s.replace(/[^a-z0-9_]/gi, ''); // registry codes only; never free text

type Pred = (r: RollupRow) => boolean;

export function buildReadout(input: ReadoutInput, now: Date): string {
  const { mondays } = weekWindow(now);
  const weekHead = mondays.map((m, i) => isoWeekLabel(m) + (i === mondays.length - 1 ? ' (partial)' : ''));
  // Only registry values reach the counts: a row with an unknown surface is skipped, an unknown via is counted as none.
  const rollup: RollupRow[] = [];
  for (const r of input.rollup ?? []) {
    if (!(SURFACES as readonly string[]).includes(r.surface)) continue;
    rollup.push({ day: r.day, surface: r.surface, ref_class: String(r.ref_class), via: isViewVia(r.via) ? r.via : VIA_NONE, self_view: r.self_view === true, n: count(r.n) });
  }
  const weekly = (p: Pred): number[] => {
    const out = mondays.map(() => 0);
    for (const r of rollup) { const w = weekIndex(mondays, r.day); if (w >= 0 && p(r)) out[w] += r.n; }
    return out;
  };
  const rowCells = (values: number[]) => { const h = suppress([values], false)[0]; return values.map((v, i) => cell(v, h[i])); };

  const out: string[] = [];
  out.push('# F-15 owner readout');
  out.push('');
  out.push(`Generated ${now.toISOString().slice(0, 10)} (UTC days, ISO weeks). Owner-only; descriptive counts only; never commit this file.`);
  out.push('Strict DESIGN §3.5 numbers come first; anything else is labelled partial (gate definitions: MRC2-3, owner).');
  out.push('Demo profiles are excluded. "<5" = a count from 1 to 4; "(s)" = hidden so a small count can\'t be worked out; "≥ n" = a total with hidden cells.');
  out.push('');

  // G1
  const g1 = [count(input.g1?.strict), count(input.g1?.partial)];
  out.push('## G1');
  out.push('');
  out.push(table(['Metric (DESIGN §3.5)', 'Continue if', 'Now'], [
    [GATES[0].metric, GATES[0].threshold, cell(g1[0], false)],
    ['partial: traders whose connections are all frozen or failed (none connected)', '', cell(g1[1], false)],
  ]));
  out.push('');

  // G2
  out.push('## G2');
  out.push('');
  out.push(table(['Metric (DESIGN §3.5)', 'Continue if', 'Now'], [[GATES[1].metric, GATES[1].threshold, G2_TEXT]]));
  out.push('');

  // G3
  const notSelf: Pred = (r) => !r.self_view;
  const isShareTM = (r: RollupRow) => (r.via === 'trade' || r.via === 'month') && r.surface !== 'login';
  const isCta = (r: RollupRow) => r.via === 'nav' || r.via === 'profile' || ((r.via === 'trade' || r.via === 'month') && r.surface === 'login');
  const g3: [string, string, Pred][] = [
    [`${GATES[2].metric} (${G3_LABEL})`, GATES[2].threshold, (r) => r.surface === 'profile' && r.ref_class === 'external' && notSelf(r)],
    ['partial: tagged links, card', '', (r) => notSelf(r) && r.via === 'card'],
    ['partial: tagged links, story', '', (r) => notSelf(r) && r.via === 'story'],
    ['partial: tagged links, trade/month share', '', (r) => notSelf(r) && isShareTM(r)],
    ['partial: invite links (inv_*)', '', (r) => notSelf(r) && (INVITE_VIAS as readonly string[]).includes(r.via)],
    ['partial: nav/profile CTA links', '', (r) => notSelf(r) && isCta(r)],
    ['partial: trade surface, external referrer', '', (r) => notSelf(r) && r.surface === 'trade' && r.ref_class === 'external'],
    ['partial: month surface, external referrer', '', (r) => notSelf(r) && r.surface === 'month' && r.ref_class === 'external'],
  ];
  out.push('## G3');
  out.push('');
  out.push(table(['Metric (DESIGN §3.5)', 'Continue if', ...weekHead], g3.map(([label, th, p]) => [label, th, ...rowCells(weekly(p))])));
  out.push('');
  out.push(`All G3 rows count ${G3_LABEL}, self-views excluded. The partial rows overlap and are not a split of the strict row.`);
  out.push(G3_OWNER_LINE);
  out.push('');

  // G4
  out.push('## G4');
  out.push('');
  out.push(table(['Metric (DESIGN §3.5)', 'Continue if', 'Now'], [[GATES[3].metric, GATES[3].threshold, G4_TEXT]]));
  out.push('');

  // Drops by reason × week, and the drop share.
  const reasons = DROP_REASONS as readonly string[];
  const dropGrid = reasons.map(() => mondays.map(() => 0));
  for (const d of input.drops ?? []) {
    const ri = reasons.indexOf(d.reason), w = weekIndex(mondays, d.day);
    if (ri >= 0 && w >= 0) dropGrid[ri][w] += count(d.n);
  }
  const counted = mondays.map(() => 0);
  for (const c of input.counted ?? []) { const w = weekIndex(mondays, c.day); if (w >= 0) counted[w] += count(c.n); }
  const dropHidden = suppress(dropGrid, true);
  const countedHidden = suppress([counted], false)[0];
  const dropTotals = mondays.map((_, w) => ({ values: dropGrid.map((r) => r[w]), hidden: dropGrid.map((_, r) => dropHidden[r][w]) }));
  out.push('## Bot filter drops (all surfaces, demo profiles included)');
  out.push('');
  out.push(table(['Reason', ...weekHead, 'Total'], [
    ...reasons.map((reason, r) => [reason, ...dropGrid[r].map((v, w) => cell(v, dropHidden[r][w])), total(dropGrid[r], dropHidden[r])]),
    ['all drops', ...dropTotals.map((t) => total(t.values, t.hidden)), total(dropGrid.flat(), dropHidden.flat())],
    ['counted views', ...counted.map((v, w) => cell(v, countedHidden[w])), total(counted, countedHidden)],
    ['drop share', ...dropTotals.map((t, w) => {
      const dropped = t.values.reduce((s, v) => s + v, 0);
      if (t.hidden.some(Boolean) || countedHidden[w] || (counted[w] > 0 && counted[w] < SMALL) || (dropped > 0 && dropped < SMALL)) return 'n/a (small cells)';
      return dropped + counted[w] === 0 ? '—' : `${((100 * dropped) / (dropped + counted[w])).toFixed(1)}% dropped`;
    }), ''],
  ]));
  out.push('');
  out.push('Drop share = dropped beacons / (dropped + counted views) in the week; it tells an instrument change from a traffic change.');
  out.push('');

  // Surface × via × week (self-views excluded). Rows with every week under 5 roll into "other"; a kept row's cell under 5
  // moves into "other" for that week and prints "<5".
  const keys = new Map<string, number[]>();
  for (const r of rollup) {
    if (r.self_view) continue;
    const w = weekIndex(mondays, r.day);
    if (w < 0) continue;
    const k = `${r.surface}|${r.via}`;
    if (!keys.has(k)) keys.set(k, mondays.map(() => 0));
    keys.get(k)![w] += r.n;
  }
  const order = (k: string) => { const [s, v] = k.split('|'); return [(SURFACES as readonly string[]).indexOf(s), v === VIA_NONE ? '' : v] as const; };
  const sorted = [...keys.keys()].sort((a, b) => { const [sa, va] = order(a), [sb, vb] = order(b); return sa - sb || va.localeCompare(vb); });
  const other = mondays.map(() => 0);
  const kept: { label: string[]; values: number[]; rolled: boolean[] }[] = [];
  for (const k of sorted) {
    const values = keys.get(k)!;
    if (values.every((v) => v < SMALL)) { values.forEach((v, w) => { other[w] += v; }); continue; }
    const rolled = values.map((v) => v > 0 && v < SMALL);
    values.forEach((v, w) => { if (rolled[w]) other[w] += v; });
    const [s, v] = k.split('|');
    kept.push({ label: [safeLabel(s), safeLabel(v)], values: values.map((x, w) => (rolled[w] ? 0 : x)), rolled });
  }
  const grid = [...kept.map((k) => k.values), other];
  // A rolled cell is hidden too, so complementary suppression runs with it in place.
  const rerun = suppress(grid, true, [...kept.map((k) => k.rolled), other.map(() => false)]);
  const cellOf = (r: number, w: number) => (r < kept.length && kept[r].rolled[w] ? '<5' : cell(grid[r][w], rerun[r][w]));
  out.push('## Views by surface × via × week (self-views excluded)');
  out.push('');
  out.push(table(['Surface', 'Via', ...weekHead, 'Total'], [
    ...kept.map((k, r) => [...k.label, ...mondays.map((_, w) => cellOf(r, w)), total(k.values, rerun[r])]),
    ['other', 'other', ...mondays.map((_, w) => cellOf(kept.length, w)), total(other, rerun[kept.length])],
    ['all', 'all', ...mondays.map((_, w) => total(grid.map((row) => row[w]), grid.map((_, r) => rerun[r][w]))), total(grid.flat(), rerun.flat())],
  ]));
  out.push('');
  out.push('"other" holds every surface × via cell under 5. Counts are views, not people.');
  out.push('');
  return out.join('\n');
}

// ---- output guard ----
// The output directory, refused unless it resolves outside the repository (real paths, so a symlink into the repo is
// refused, and a sibling folder sharing the repo's name prefix is accepted).
export function resolveOut(outArg: string | undefined, repoRoot: string): string {
  if (typeof outArg !== 'string' || outArg.trim() === '') throw new Error('--out <dir> is required (a folder outside the repository)');
  const abs = path.resolve(outArg);
  let base = abs;
  const rest: string[] = [];
  while (!existsSync(base)) {
    const up = path.dirname(base);
    if (up === base) break;
    rest.unshift(path.basename(base));
    base = up;
  }
  const real = path.join(realpathSync(base), ...rest);
  const root = realpathSync(repoRoot);
  const rel = path.relative(root, real);
  const outside = rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel);
  if (rel === '' || !outside) throw new Error('--out must be outside the repository (the readout is never committed)');
  return real;
}

export function parseOutArg(argv: string[]): string {
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--out' && argv[i + 1] && !argv[i + 1].startsWith('--')) return argv[i + 1];
    if (argv[i].startsWith('--out=') && argv[i].length > 6) return argv[i].slice(6);
  }
  throw new Error('--out <dir> is required (a folder outside the repository)');
}

// ---- main (database → file) ----
async function main() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: here, encoding: 'utf8' }).trim();
  const dir = resolveOut(parseOutArg(process.argv.slice(2)), repoRoot);
  const { sql } = await import('../lib/db.ts');
  const now = new Date();
  const { from, to } = weekWindow(now);
  try {
    // Demo target = any activity with source 'demo' (lib/demo.ts). user_id is summed away; no handle, name, id or return
    // is selected.
    const rollup = await sql<RollupRow[]>`
      select to_char(r.day, 'YYYY-MM-DD') as day, r.surface, r.ref_class, r.via, r.self_view, sum(r.n)::int as n
      from view_rollup r left join users u on u.id = r.user_id
      where r.day between ${from}::date and ${to}::date
        and (r.user_id is null or (u.deleted_at is null
          and not exists (select 1 from activities a where a.user_id = r.user_id and a.source = 'demo')))
      group by r.day, r.surface, r.ref_class, r.via, r.self_view`;
    const drops = await sql<DropRow[]>`
      select to_char(day, 'YYYY-MM-DD') as day, surface, reason, sum(n)::int as n from view_drops
      where day between ${from}::date and ${to}::date group by day, surface, reason`;
    const counted = await sql<CountRow[]>`
      select to_char(day, 'YYYY-MM-DD') as day, sum(n)::int as n from view_rollup
      where day between ${from}::date and ${to}::date group by day`;
    const [g1] = await sql<{ strict: number; partial: number }[]>`
      select count(*) filter (where t.connected)::int as strict, count(*) filter (where not t.connected)::int as partial
      from (select u.id, bool_or(c.state = 'connected') as connected
            from users u join connections c on c.user_id = u.id
            where u.deleted_at is null
              and not exists (select 1 from activities a where a.user_id = u.id and a.source = 'demo')
            group by u.id) t`;
    const text = buildReadout({ rollup: [...rollup], drops: [...drops], counted: [...counted], g1: g1 ?? { strict: 0, partial: 0 } }, now);
    mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `f15-readout-${now.toISOString().slice(0, 10)}.md`);
    writeFileSync(file, text, { mode: 0o600 });
    console.log(`wrote ${file}`);
  } finally {
    await sql.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
}
