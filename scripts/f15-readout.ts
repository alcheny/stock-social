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
export const G3_LABEL = 'views, not people';
export const G3_OWNER_LINE = "Signed-out owner views can't be told from other views.";
export const RECONCILE_LINE = 'Three weekly totals, read together: the G3 strict row counts profile views from external referrers only; the surface × via "all" row and the drops table "counted views" row are the same number, every counted surface and every referrer class (external, internal, none); all three exclude self-views and demo profiles, while the drop counts include demo profiles.';
export const DELETION_LINE = "Deleting a trader removes that trader's rows, so past sums can change between runs, and two runs around a deletion can reveal that trader's counts: compare runs only with that in mind.";
export const G4_TEXT = "strict G4 can't be read in this slice; signed-out D7 return is not measured";

// ---- input ----
// rollup: view_rollup summed over user_id, demo and deleted targets already excluded by the query. drops: view_drops.
// g1: strict = non-demo, non-deleted users with a connection in state 'connected'; partial = such users whose
// connections exist but none is 'connected'. Only the fields named here are read; anything else on a row is ignored.
export type Day = string | Date;
export type RollupRow = { day: Day; surface: string; ref_class: string; via: string; self_view: boolean; n: number };
export type DropRow = { day: Day; surface: string; reason: string; n: number };
export type ReadoutInput = { rollup: RollupRow[]; drops: DropRow[]; g1: { strict: number; partial: number }; g2: G2Input };

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
// "2026-W44, Oct 26–Nov 1" (UTC; the end month is repeated only when it changes).
export function weekHeader(mondayMs: number): string {
  const md = (ms: number) => { const d = new Date(ms); return { m: d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }), d: d.getUTCDate() }; };
  const a = md(mondayMs), b = md(mondayMs + 6 * DAY_MS);
  return `${isoWeekLabel(mondayMs)}, ${a.m} ${a.d}–${a.m === b.m ? '' : `${b.m} `}${b.d}`;
}
// The WEEKS complete ISO weeks before the one holding `now`. The current week is never printed: a partial week's count
// would change between two runs and the difference could reveal a small count (POLICY P3); a complete week's count
// stays fixed (except after a deletion, see the header line).
export function weekWindow(now: Date): { from: string; to: string; mondays: number[] } {
  const last = mondayOf(now.getTime()) - 7 * DAY_MS;
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

// ---- base cells: one source for every printed count ----
// Every printed count (G3 rows, the surface × via table, its totals, the drops table, the counted-views row) is a sum
// of base cells. A base cell is hidden when it is 1..4 or a complement (suppress, per base row over the weeks). A
// printed sum is exact only when none of its base cells is hidden; otherwise it reads "<5" (one small cell alone),
// "(s)" (only hidden cells) or "≥ n" with n the sum of its visible base cells. So no hidden value ever enters a printed
// number, and no subtraction across rows, columns or tables can recover one (POLICY P3).
type BaseRef = { key: string; w: number };
class Base {
  rows = new Map<string, number[]>();
  hidden = new Map<string, boolean[]>();
  weeks: number;
  constructor(weeks: number) { this.weeks = weeks; }
  add(key: string, w: number, n: number) {
    if (!this.rows.has(key)) this.rows.set(key, Array.from({ length: this.weeks }, () => 0));
    this.rows.get(key)![w] += n;
  }
  seal() { for (const [k, v] of this.rows) this.hidden.set(k, suppress([v], false)[0]); }
  value(cells: BaseRef[]) { return cells.reduce((s, c) => s + this.rows.get(c.key)![c.w], 0); }
  print(cells: BaseRef[]): string {
    let visible = 0, hiddenN = 0, smallN = 0;
    for (const { key, w } of cells) {
      const v = this.rows.get(key)![w];
      if (this.hidden.get(key)![w]) { hiddenN++; if (v < SMALL) smallN++; } else visible += v;
    }
    if (hiddenN === 0) return fmt(visible);
    if (visible === 0) return hiddenN === 1 && smallN === 1 ? '<5' : '(s)';
    return `≥ ${fmt(visible)}`;
  }
  exact(cells: BaseRef[]) { return cells.every(({ key, w }) => !this.hidden.get(key)![w]); }
  keys() { return [...this.rows.keys()]; }
}

// ---- markdown ----
const table = (head: string[], rows: string[][]) =>
  [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.join(' | ')} |`)].join('\n');
const safeLabel = (s: string) => s.replace(/[^a-z0-9_]/gi, ''); // registry codes only; never free text

// A view base key: surface | via | ref group (external or other). Self-views are never counted anywhere.
type ViewKey = { surface: string; via: string; ext: boolean };
const keyOf = (k: ViewKey) => `${k.surface}|${k.via}|${k.ext ? 'ext' : 'oth'}`;
const parseKey = (key: string): ViewKey => { const [surface, via, e] = key.split('|'); return { surface, via, ext: e === 'ext' }; };

export function buildReadout(input: ReadoutInput, now: Date): string {
  const { mondays } = weekWindow(now);
  const W = mondays.length, weeksIdx = mondays.map((_, w) => w);
  const weekHead = mondays.map(weekHeader);

  // Views. Only registry values reach the counts: an unknown surface is skipped, an unknown via is counted as none.
  const views = new Base(W);
  for (const r of input.rollup ?? []) {
    if (!(SURFACES as readonly string[]).includes(r.surface) || r.self_view === true) continue;
    const w = weekIndex(mondays, r.day);
    if (w < 0) continue;
    views.add(keyOf({ surface: r.surface, via: isViewVia(r.via) ? r.via : VIA_NONE, ext: r.ref_class === 'external' }), w, count(r.n));
  }
  views.seal();
  const select = (p: (k: ViewKey) => boolean) => views.keys().filter((k) => p(parseKey(k)));
  const at = (keys: string[], w: number): BaseRef[] => keys.map((key) => ({ key, w }));
  const allWeeks = (keys: string[]): BaseRef[] => keys.flatMap((key) => weeksIdx.map((w) => ({ key, w })));

  const out: string[] = [];
  out.push('# F-15 owner readout');
  out.push('');
  out.push(`Generated ${now.toISOString().slice(0, 10)} (UTC days, ISO weeks). Owner-only; descriptive counts only; never commit this file.`);
  out.push(`Weeks: the ${WEEKS} complete ISO weeks before this one; the current week is not printed, so a printed week does not change between runs.`);
  out.push(DELETION_LINE);
  out.push('Strict DESIGN §3.5 numbers come first; anything else is labelled partial (gate definitions: MRC2-3, owner).');
  out.push('Demo profiles and self-views are excluded. "<5" = a count from 1 to 4; "(s)" = hidden so a small count can\'t be worked out; "≥ n" = a sum with hidden parts (n counts only the visible parts).');
  out.push('');

  // G1: two disjoint single counts, no total.
  const g1 = [count(input.g1?.strict), count(input.g1?.partial)];
  const small = (v: number) => (v > 0 && v < SMALL ? '<5' : fmt(v));
  out.push('## G1');
  out.push('');
  out.push(table(['Metric (DESIGN §3.5)', 'Continue if', 'Now'], [
    [GATES[0].metric, GATES[0].threshold, small(g1[0])],
    ['partial: traders whose connections are all frozen or failed (none connected)', '', small(g1[1])],
  ]));
  out.push('');

  out.push(...g2Section(input, weekWindow(now).to));

  // G3: every row is a sum of the same base cells the surface × via table prints.
  const tm = (v: string) => v === 'trade' || v === 'month';
  const g3: [string, string, string[]][] = [
    [`${GATES[2].metric} (${G3_LABEL})`, GATES[2].threshold, select((k) => k.surface === 'profile' && k.ext)],
    ['partial: tagged links, card', '', select((k) => k.via === 'card')],
    ['partial: tagged links, story', '', select((k) => k.via === 'story')],
    ['partial: tagged links, trade/month share', '', select((k) => tm(k.via) && k.surface !== 'login')],
    ['partial: invite links (inv_*)', '', select((k) => (INVITE_VIAS as readonly string[]).includes(k.via))],
    ['partial: nav/profile CTA links', '', select((k) => k.via === 'nav' || k.via === 'profile' || (tm(k.via) && k.surface === 'login'))],
    ['partial: trade surface, external referrer', '', select((k) => k.surface === 'trade' && k.ext)],
    ['partial: month surface, external referrer', '', select((k) => k.surface === 'month' && k.ext)],
  ];
  out.push('## G3');
  out.push('');
  out.push(table(['Metric (DESIGN §3.5)', 'Continue if', ...weekHead],
    g3.map(([label, th, keys]) => [label, th, ...weeksIdx.map((w) => views.print(at(keys, w)))])));
  out.push('');
  out.push(`All G3 rows count ${G3_LABEL}. The partial rows overlap and are not a split of the strict row.`);
  out.push(G3_OWNER_LINE);
  out.push('');

  out.push('## G4');
  out.push('');
  out.push(table(['Metric (DESIGN §3.5)', 'Continue if', 'Now'], [[GATES[3].metric, GATES[3].threshold, G4_TEXT]]));
  out.push('');

  // Drops: base cells are reason × week (surface is never printed). Counted views = the sum of every view base cell.
  const drops = new Base(W);
  for (const r of DROP_REASONS) drops.add(r, 0, 0);
  for (const d of input.drops ?? []) {
    const w = weekIndex(mondays, d.day);
    if ((DROP_REASONS as readonly string[]).includes(d.reason) && w >= 0) drops.add(d.reason, w, count(d.n));
  }
  drops.seal();
  const allViews = views.keys();
  out.push('## Bot filter drops (all surfaces, demo profiles included)');
  out.push('');
  out.push(table(['Reason', ...weekHead, 'Total'], [
    ...DROP_REASONS.map((r) => [r, ...weeksIdx.map((w) => drops.print([{ key: r, w }])), drops.print(weeksIdx.map((w) => ({ key: r, w })))]),
    ['all drops', ...weeksIdx.map((w) => drops.print(at([...DROP_REASONS], w))), drops.print(allWeeks([...DROP_REASONS]))],
    ['counted views', ...weeksIdx.map((w) => views.print(at(allViews, w))), views.print(allWeeks(allViews))],
    ['drop share', ...weeksIdx.map((w) => {
      const d = at([...DROP_REASONS], w), v = at(allViews, w);
      if (!drops.exact(d) || !views.exact(v)) return 'n/a (small cells)';
      const dropped = drops.value(d), counted = views.value(v);
      return dropped + counted === 0 ? '—' : `${((100 * dropped) / (dropped + counted)).toFixed(1)}% dropped`;
    }), ''],
  ]));
  out.push('');
  out.push('Drop share = dropped beacons / (dropped + counted views) in the week, from exact counts only; it tells an instrument change from a traffic change. Drops include demo profiles; counted views do not.');
  out.push('');

  // Surface × via × week. A row (summed over referrer groups) with every week under 5 rolls into "other".
  const pairs = new Map<string, string[]>();
  for (const key of allViews) {
    const k = parseKey(key), p = `${k.surface}|${k.via}`;
    if (!pairs.has(p)) pairs.set(p, []);
    pairs.get(p)!.push(key);
  }
  const order = (p: string) => { const [s, v] = p.split('|'); return [(SURFACES as readonly string[]).indexOf(s), v === VIA_NONE ? '' : v] as const; };
  const sorted = [...pairs.keys()].sort((a, b) => { const [sa, va] = order(a), [sb, vb] = order(b); return sa - sb || va.localeCompare(vb); });
  const otherKeys: string[] = [];
  const kept: [string, string[]][] = [];
  for (const p of sorted) {
    const keys = pairs.get(p)!;
    if (weeksIdx.every((w) => views.value(at(keys, w)) < SMALL)) otherKeys.push(...keys);
    else kept.push([p, keys]);
  }
  const row = (keys: string[]) => [...weeksIdx.map((w) => views.print(at(keys, w))), views.print(allWeeks(keys))];
  out.push('## Views by surface × via × week');
  out.push('');
  out.push(table(['Surface', 'Via', ...weekHead, 'Total'], [
    ...kept.map(([p, keys]) => [...p.split('|').map(safeLabel), ...row(keys)]),
    ['other', 'other', ...row(otherKeys)],
    ['all', 'all', ...row(allViews)],
  ]));
  out.push('');
  out.push('"other" holds every surface × via row with no week of 5 or more. Counts are views, not people.');
  out.push('');
  out.push(RECONCILE_LINE);
  out.push('');
  return out.join('\n');
}

// ---- G2: share_action, per trader on the strict-G1 denominator ----
// Three disjoint partitions of the strict-G1 traders, sharing one "non" cell (traders with no share row):
//   by surface: story (shared the picture) | card (profile link, no picture) | other (trade/month links only) | non
//   by outcome: sheet only | copy only | both | non
//   by sign:    shared with the record down | shared, never down | non
// Each partition sums to G1. A cell from 1 to 4 is hidden; when exactly one cell of a partition is hidden, the
// next-smallest non-zero visible cell of that partition is hidden too (repeated until nothing changes, so the shared
// "non" cell carries its hidden state into every partition). Every printed row is a sum of cells: exact only when none
// of its cells is hidden and the rest of its partition (G1 − row) is either free of hidden cells or 5 or more (else
// G1 − row would be a small count worked out by subtraction); otherwise "≥ n" over the row's visible cells, or "(s)"
// when all of the row's cells are hidden. So no
// count from 1 to 4, of a cell, a row or G1 − row, can be worked out from the rows or against G1
// (scripts/f15-readout.test.ts enumerates every consistent split).
export type SharerRow = { card: boolean; story: boolean; record: boolean; sheet: boolean; copy: boolean; down: boolean };
export type G2Input = { traders: SharerRow[]; firstDay: Day | null; retentionDays: number };
export const G2_CELLS = ['story', 'card', 'other', 'non', 'sheetOnly', 'copyOnly', 'both', 'down', 'upOnly'] as const;
type G2Cell = (typeof G2_CELLS)[number];
const G2_GROUPS: G2Cell[][] = [['story', 'card', 'other', 'non'], ['sheetOnly', 'copyOnly', 'both', 'non'], ['down', 'upOnly', 'non']];
// Each row: its label, its cells and the partition (G2_GROUPS index) they come from.
export const G2_ROWS: [string, G2Cell[], number][] = [
  ['partial: shared any surface (profile link, picture, trade or month)', ['story', 'card', 'other'], 0],
  ['partial: used the share sheet', ['sheetOnly', 'both'], 1],
  ['partial: copied the link', ['copyOnly', 'both'], 1],
  ['partial: shared the picture', ['story'], 0],
  ['partial: shared while the record was down', ['down'], 2],
];
export const G2_STRICT_CELLS: G2Cell[] = ['story', 'card'];
export const G2_COHORT_LINE = '14-day share rate per weekly cohort: not printed (gate definition, MRC2-3, owner)';
export const G2_OUTCOME_LINE = 'sheet = the share sheet resolved, not that anything was posted; copy = the link copied; both as the trader\'s own browser reports them';
// No date is printed: the first row's day would say that some trader shared on that day (orchestrator review).
export const g2PreSliceLine = (_first?: string | null) =>
  'Shares made before the share_action rows began are not counted (the old users columns are not read).';

export function g2Cells(traders: SharerRow[]): Record<G2Cell, number> {
  const c = Object.fromEntries(G2_CELLS.map((k) => [k, 0])) as Record<G2Cell, number>;
  for (const t of traders) {
    const sharer = t.card === true || t.story === true || t.record === true;
    if (!sharer) { c.non++; continue; }
    c[t.story === true ? 'story' : t.card === true ? 'card' : 'other']++;
    // A share row always has an outcome; a sharer without one (not written by the app) is counted with copy only.
    c[t.sheet === true && t.copy === true ? 'both' : t.sheet === true ? 'sheetOnly' : 'copyOnly']++;
    c[t.down === true ? 'down' : 'upOnly']++;
  }
  return c;
}

export function g2Hidden(cells: Record<G2Cell, number>): Set<G2Cell> {
  const hidden = new Set<G2Cell>(G2_CELLS.filter((k) => cells[k] > 0 && cells[k] < SMALL));
  for (let changed = true; changed;) {
    changed = false;
    for (const g of G2_GROUPS) {
      if (g.filter((k) => hidden.has(k)).length !== 1) continue;
      let best: G2Cell | null = null;
      for (const k of g) if (!hidden.has(k) && cells[k] > 0 && (best === null || cells[k] < cells[best])) best = k;
      if (best) { hidden.add(best); changed = true; }
    }
  }
  return hidden;
}

function g2Section(input: ReadoutInput, lastDay: string): string[] {
  const g2 = input.g2;
  const traders = Array.isArray(g2?.traders) ? g2.traders : [];
  const g1 = count(input.g1?.strict);
  const cells = g2Cells(traders);
  const hidden = g2Hidden(cells);
  // G1 "<5", or a trader list that doesn't match G1: every G2 cell is "(s)".
  const blind = (g1 > 0 && g1 < SMALL) || traders.length !== g1;
  const value = (ks: G2Cell[], group: number): string => {
    if (blind) return '(s)';
    const vis = ks.filter((k) => !hidden.has(k));
    if (vis.length === 0 && ks.some((k) => cells[k] > 0)) return '(s)';
    const n = vis.reduce((s, k) => s + cells[k], 0);
    const rest = G2_GROUPS[group].filter((k) => !ks.includes(k));
    const restN = rest.reduce((s, k) => s + cells[k], 0);
    // A lower bound carries its percent so it reads against the threshold (business lead BL-1); a bound of 0 says nothing
    // and reads as "none", so it prints "(s)" (UX lead UX-1).
    if (vis.length < ks.length || (rest.some((k) => hidden.has(k)) && restN < SMALL)) return n === 0 ? '(s)' : `≥ ${fmt(n)} of ${fmt(g1)} (≥ ${Math.floor((100 * n) / g1)}%)`;
    return g1 === 0 ? `0 of 0` : `${fmt(n)} of ${fmt(g1)} (${Math.round((100 * n) / g1)}%)`;
  };
  const first = g2?.firstDay != null ? isoDay(g2.firstDay) : null;
  const days = count(g2?.retentionDays);
  return [
    '## G2',
    '',
    table(['Metric (DESIGN §3.5)', 'Continue if', 'Now'], [
      [GATES[1].metric, GATES[1].threshold, value(G2_STRICT_CELLS, 0)],
      ...G2_ROWS.map(([label, ks, group]) => [label, '', value(ks, group)]),
    ]),
    '',
    `Traders with a connected broker (strict G1), not share actions. The strict row counts a profile link or picture share (card or story) on or before ${lastDay}${days ? `, within the ${days}-day retention` : ''}. The partial rows overlap and are not a split of the strict row.`,
    g2PreSliceLine(first),
    G2_OUTCOME_LINE,
    G2_COHORT_LINE,
    '',
  ];
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
    const { SHARE_RETENTION_DAYS } = await import('../lib/share-actions.ts');
    // G2: one row per strict-G1 trader (non-demo, non-deleted, a connection in state 'connected'), only which classes
    // of share_action rows exist up to the window's last day and within retention. No id, handle or return is selected.
    const traders = await sql<SharerRow[]>`
      select coalesce(bool_or(s.surface = 'card'), false) as card, coalesce(bool_or(s.surface = 'story'), false) as story,
             coalesce(bool_or(s.surface in ('trade', 'month')), false) as record,
             coalesce(bool_or(s.outcome = 'sheet'), false) as sheet, coalesce(bool_or(s.outcome = 'copy'), false) as copy,
             coalesce(bool_or(s.record_sign = 'down'), false) as down
      from users u
      left join share_action s on s.user_id = u.id and s.day <= ${to}::date
        and s.day >= ${to}::date - ${SHARE_RETENTION_DAYS}::int -- anchored to the window, so a printed week's figure is stable across runs
      where u.deleted_at is null
        and not exists (select 1 from activities a where a.user_id = u.id and a.source = 'demo')
        and exists (select 1 from connections c where c.user_id = u.id and c.state = 'connected')
      group by u.id`;
    const [g1] = await sql<{ strict: number; partial: number }[]>`
      select count(*) filter (where t.connected)::int as strict, count(*) filter (where not t.connected)::int as partial
      from (select u.id, bool_or(c.state = 'connected') as connected
            from users u join connections c on c.user_id = u.id
            where u.deleted_at is null
              and not exists (select 1 from activities a where a.user_id = u.id and a.source = 'demo')
            group by u.id) t`;
    // G1 strict is the G2 trader count itself, so the two can't disagree.
    const text = buildReadout({
      rollup: [...rollup], drops: [...drops], g1: { strict: traders.length, partial: g1?.partial ?? 0 },
      g2: { traders: [...traders], firstDay: null, retentionDays: SHARE_RETENTION_DAYS }, // no first-share date is read
    }, now);
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
