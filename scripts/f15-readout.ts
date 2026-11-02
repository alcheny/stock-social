// F-15 owner readout (docs/features/F-15-measurement-foundation.md; plan docs/features/logs/F-15/plan.md §5 Q7 and
// "Readout rules"). Descriptive counts only, for the owner, run by hand once a week:
//   node --env-file=.env scripts/f15-readout.ts --out <dir outside the repo>
// F-31: READOUT_INTERNAL_HANDLES (env on this machine only, comma- or space-separated) adds the internal-accounts rows.
// The output is never committed: --out must resolve outside the repository (resolveOut). It names no handle, no user id
// and no return, prints the DESIGN §3.5 metric and threshold verbatim beside every gate figure, and never redefines a gate
// (MRC2-3 stays with the owner). Every printed count from 1 to 4 reads "<5" (POLICY P3: a count of 1 on an invite link
// reveals who opened it), with complementary suppression so a hidden cell can't be worked out from the others.
// buildReadout is pure (tested in scripts/f15-readout.test.ts); main is a thin shell around the database.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, realpathSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { PendingQuery, Row, Sql } from 'postgres';
import { INVITE_VIAS, SHARE_VIAS, VIA_NONE, isViewVia, normalizeHandle } from '../lib/referral.ts';
import { logSafe } from '../lib/privacy-log.ts';
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
export const DELETION_LINE = "Deleting a trader removes that trader's rows, so past sums can change between runs, and two runs around a deletion can reveal that trader's counts; a connect, a disconnect or a deletion between runs can also reveal one trader's share status (G1, G2): compare runs only with that in mind.";
export const G4_TEXT = "strict G4 can't be read in this slice; signed-out D7 return is not measured";
// Cycle 4 F4-12 (C4-20): F-15 decided invite codes are counted on views and outreach links point at Demo profiles, so
// Demo-target invite views are counted in the invite rows only (same base cells, same suppression as every other row).
export const DEMO_INVITE_LINE = 'Invite links point at Demo profiles (F-15 decision, 2026-11-01), so invite views of Demo profiles are counted in the invite links row and the "invite landings on Demo profiles" row, and nowhere else; the same small-cell rules apply to both rows.';

// ---- input ----
// rollup: view_rollup summed over user_id, deleted targets excluded by the query; demo marks a Demo target (a demo
// activity or a fictional fixture filer, loadRollup), counted only in the invite rows. drops: view_drops.
// g1: strict = non-demo, non-deleted users with a connection in state 'connected'; partial = such users whose
// connections exist but none is 'connected'. Only the fields named here are read; anything else on a row is ignored.
export type Day = string | Date;
// F-31: filer marks a public-filing target, internal a trader target on the env list (both ignored by the base keys);
// top: per week, the largest single profile's strict G3 views (loadTop); cap: the address-cap day marks (loadCapMarks);
// internal: the env list's state and how many entries were ignored (never a handle).
export type RollupRow = { day: Day; surface: string; ref_class: string; via: string; self_view: boolean; n: number; demo?: boolean; filer?: boolean; internal?: boolean };
export type DropRow = { day: Day; surface: string; reason: string; n: number };
export type InternalState = 'unset' | 'none-valid' | 'set';
export type ReadoutInput = {
  rollup: RollupRow[]; drops: DropRow[]; g1: { strict: number; partial: number }; g2: G2Input;
  top?: { week: Day; n: number }[]; cap?: { day: Day; trusted: boolean }[]; internal?: { state: InternalState; ignored: number; listed?: number };
  // F-33: how many visible, non-Demo records carry ranking weight above 0 at the run (loadRanked). A count only.
  ranked?: number;
};

// ---- F-33: records with ranking weight above 0 (docs/features/F-33-ranking-weight-needs-evidence.md, AC10) ----
// One cell, no total or difference row: 0, "<5" for 1 to 4, else the count; "not loaded" when the input lacks it.
export const RANKED_LABEL = '- records with ranking weight above 0: ';
export const RANKED_LINE = '  Counts visible records that are not Demo and whose ranking weight is above 0 at the time of the run (30 or more independent bets over 90 or more days and a likely range clear of zero). A count only: no handle, no id, no return.';
export const rankedCell = (n: unknown): string =>
  typeof n !== 'number' || !Number.isFinite(n) || n < 0 ? 'not loaded' : n > 0 && n < SMALL ? '<5' : Math.floor(n).toLocaleString('en-US');

// ---- F-31: the limits block, the strict family and the new rows (docs/features/F-31-readout-limits-and-partial-rows.md;
// plan docs/features/logs/F-31/plan.md §2-§3) ----
export const LIMITS_HEADING = '## Limits of these counts';
export const LIMIT_LINES = [
  "- These are first-party counts from the app's own view beacon. They can be inflated, and they are not verified figures.",
  '- Signed-out views by a trader of their own record, by the owner or by the team can\'t be told apart from anyone else\'s views; only self-views made while signed in are removed (row "self-views removed (signed in)").',
  '- A scripted client can forge a view and its via tag; a forged view that passes the bot filter is counted and leaves no trace in the drops table.',
  '- A tagged link opened with no referrer is outside the strict G3 row, which counts external referrers only; the row "partial: tagged link or external referrer" counts both.',
  '- "Views, not people" applies to every row that counts views: one person can add many views.',
  '- Whether filer views count toward G3, and how any gate is read, is the owner\'s call (MRC2-3); the "of which" rows only show trader and filer views apart.',
];
export const factsHeading = (mondayMs: number) => `This week's facts (${weekHeader(mondayMs)}, the latest week printed):`;
export type CapState = 'live' | 'untrusted' | 'none';
export function capFactLine(state: CapState): string {
  if (state === 'live') return '- address cap: live (every beacon that week was checked against a trusted client address; the cap is per server instance).';
  if (state === 'untrusted') return '- address cap: not live (some beacons that week had no trusted client address, so the per-address rate cap was skipped for them).';
  return '- address cap: not live (not shown live: no address check was recorded that week).';
}
export const CAP_NOT_LIVE = 'not readable as a gate: address cap not live';
export const CAP_FLAG_LINE = `- While the address cap is not shown live, strict G3 is not readable as a gate; it still prints, and the row "address cap" under it reads "${CAP_NOT_LIVE}" for each such week.`;
export const G1_INTERNAL_ROW = 'partial: strict G1 without internal accounts';
export const G3_INTERNAL_ROW = "partial: strict G3 without internal accounts' profiles";
// listed: how many valid handles the env list holds (never which), so readouts made with different lists differ visibly
// (orchestrator review of #98, D6 residual).
export function internalFactLine(state: InternalState, ignored: number, listed = 0): string {
  if (state === 'unset') return '- internal accounts: not removed (READOUT_INTERNAL_HANDLES is unset).';
  if (state === 'none-valid') return '- internal accounts: not removed (READOUT_INTERNAL_HANDLES lists no valid handle).';
  const n = Math.max(0, Math.floor(ignored));
  const extra = n === 0 ? '' : n === 1 ? ' 1 listed entry was not a valid handle and was ignored.' : ` ${n} listed entries were not a valid handle and were ignored.`;
  const k = Math.max(0, Math.floor(listed));
  const valid = ` The list holds ${k} valid handle${k === 1 ? '' : 's'}.`;
  return `- internal accounts: removed only in the rows "${G1_INTERNAL_ROW}" and "${G3_INTERNAL_ROW}"; every other row still counts them.${valid}${extra}`;
}
export const INTERNAL_RUNS_LINE = "- Changing the internal list between runs can reveal one profile's counts; compare runs only with the same list.";
// Rows printed on every run, in G3 order (address cap, the pair, concentration, tagged-or-external, self-views); the
// internal rows print only when the env list is set.
export const F31_ROW_LABELS = ['address cap', 'of which: broker-trader profiles', 'of which: public-filing profiles',
  "largest single profile's share of strict G3", 'partial: tagged link or external referrer', 'self-views removed (signed in)'] as const;
export const F31_INTERNAL_ROW_LABELS = [G1_INTERNAL_ROW, G3_INTERNAL_ROW] as const;
export const SPLIT_LINE = 'The "of which" rows split the strict row by profile: a broker-trader profile or a public-filing profile. They print only in a week whose strict figure is exact, and read "(s)" when either part, or anything that could be worked out from them and the rows below, would be 1 to 4; they have no total and no difference row.';
export const TOP_LINE = 'The largest single profile\'s share is one profile\'s strict G3 views over the week\'s strict G3, rounded down to a whole percent; it names no profile, reads "(s)" unless that profile has 5 or more views and nothing from 1 to 4 can be worked out from it, and reads "—" when the strict figure is 0.';
export const SELF_LINE = '"self-views removed (signed in)" counts traders\' views of their own profile, trade and month pages made while signed in; they are in no other row. Signed-out self-views can\'t be told apart and stay in the counts.';
export const INTERNAL_LINE = 'Internal accounts come from an env list read only on the machine that runs this readout; no handle is printed. The G1 row reads "(s)" when strict G1, or what is left without internal accounts, is 1 to 4; the G3 row reads "(s)" when 1 to 4 views of internal profiles, or 1 to 4 of what is left, would be worked out by subtraction. The G1 row may reveal how many listed accounts have a connected broker.';

const okCount = (x: number) => x === 0 || x >= SMALL;
// One week's strict family, from the strict cell's three atoms: a = other trader targets, b = internal trader targets,
// c = filer targets (a + b + c = the strict cell, which the caller has checked is exact). Every printed value is an exact
// sum of atoms or "(s)", never a bound (S − bound would give the hidden part away), and nothing derivable from the
// printed values and S is 1 to 4 (plan §3.1; scripts/f31-readout.test.ts enumerates every split). top = the largest
// single profile's views M; its share prints only when M >= 5 and every class quantity the owner can know minus M is 0
// or 5+ (a profile has one class, so M sits inside one of them).
// ponytail: only the single largest profile's share is shown; a few profiles together carrying the gate are not — fix:
// a top-3 share row under the same rule, with its own exhaustive test.
export function strictFamily(atoms: { a: number; b: number; c: number }, top: number | null, internalSet: boolean):
  { trader: string; filer: string; withoutInternal: string | null; top: string } {
  const { a, b, c } = atoms, S = a + b + c;
  const pair = okCount(a + b) && okCount(c);
  const inner = internalSet && okCount(a + c) && okCount(b) && (!pair || okCount(a));
  const known = [S];
  if (pair) known.push(a + b, c);
  if (inner) known.push(a + c, b);
  if (pair && inner) known.push(a, b + c);
  let share: string;
  if (S === 0) share = '—';
  else if (top === null || !Number.isFinite(top) || top < SMALL || top > S || top > Math.max(a, b, c)
    || known.some((k) => k >= top && !okCount(k - top))) share = '(s)';
  else share = `${Math.floor((100 * top) / S)}%`;
  return { trader: pair ? fmt(a + b) : '(s)', filer: pair ? fmt(c) : '(s)', withoutInternal: internalSet ? (inner ? fmt(a + c) : '(s)') : null, top: share };
}

// The G1 internal row: strict G1 (g) without the listed internal accounts among it (k). k may be 1 to 4: it counts the
// owner's own listed accounts (business lead B1); g and g − k (third parties) must be 0 or 5+.
export function g1Internal(g: number, k: number): string {
  return k >= 0 && k <= g && okCount(g) && okCount(g - k) ? fmt(g - k) : '(s)';
}

// READOUT_INTERNAL_HANDLES → valid, deduplicated handles (lib/referral.ts#normalizeHandle, one leading @ stripped). A
// public filer (pf_) is never an internal account. Entries are never echoed; only how many were ignored.
export function parseInternalHandles(raw: string | undefined): { state: InternalState; handles: string[]; ignored: number } {
  if (typeof raw !== 'string' || raw.trim() === '') return { state: 'unset', handles: [], ignored: 0 };
  const handles: string[] = [];
  let ignored = 0;
  for (const part of raw.split(/[\s,]+/)) {
    if (!part) continue;
    const h = normalizeHandle(part.replace(/^@/, ''));
    if (!h || h.startsWith('pf_')) { ignored++; continue; }
    if (!handles.includes(h)) handles.push(h);
  }
  return { state: handles.length ? 'set' : 'none-valid', handles, ignored };
}

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

// A view base key: surface | via | ref group (external or other) | target (trader or Demo). Self-views are never
// counted anywhere; Demo-target keys exist only for invite vias and feed only the invite rows (F4-12).
type ViewKey = { surface: string; via: string; ext: boolean; demo: boolean };
const keyOf = (k: ViewKey) => `${k.surface}|${k.via}|${k.ext ? 'ext' : 'oth'}|${k.demo ? 'demo' : 'trader'}`;
const parseKey = (key: string): ViewKey => { const [surface, via, e, t] = key.split('|'); return { surface, via, ext: e === 'ext', demo: t === 'demo' }; };
const isInvite = (via: string) => (INVITE_VIAS as readonly string[]).includes(via);
// F-31: a tagged link is a share or invite code (nav and profile are in-app codes, plan D7); record surfaces carry a
// viewed trader, so a self-view exists only there.
const TAGGED_VIAS: readonly string[] = [...SHARE_VIAS, ...INVITE_VIAS];
const RECORD_SURFACES: readonly string[] = ['profile', 'trade', 'month'];
// The G1 internal cell: "(s)" when the trader list doesn't match strict G1 (the same blind case as G2).
const g1InternalCell = (input: ReadoutInput): string => {
  const traders = Array.isArray(input.g2?.traders) ? input.g2.traders : [];
  const g = count(input.g1?.strict);
  if (traders.length !== g) return '(s)';
  return g1Internal(g, traders.filter((t) => t?.internal === true).length);
};

export function buildReadout(input: ReadoutInput, now: Date): string {
  const { mondays } = weekWindow(now);
  const W = mondays.length, weeksIdx = mondays.map((_, w) => w);
  const weekHead = mondays.map(weekHeader);

  // Views. Only registry values reach the counts: an unknown surface is skipped, an unknown via is counted as none.
  const views = new Base(W);
  // F-31: internal state (env list), the strict cell's atoms per week [a, b, c] and the signed-in self-views.
  const internalState: InternalState = input.internal?.state === 'set' || input.internal?.state === 'none-valid' ? input.internal.state : 'unset';
  const internalSet = internalState === 'set';
  const atoms = weeksIdx.map(() => [0, 0, 0]);
  const selfs = new Base(W);
  selfs.add('self', 0, 0);
  for (const r of input.rollup ?? []) {
    if ((SURFACES as readonly string[]).includes(r.surface) && r.self_view === true && r.demo !== true && RECORD_SURFACES.includes(r.surface)) {
      const w = weekIndex(mondays, r.day);
      if (w >= 0) selfs.add('self', w, count(r.n));
    }
    if (!(SURFACES as readonly string[]).includes(r.surface) || r.self_view === true) continue;
    const w = weekIndex(mondays, r.day);
    if (w < 0) continue;
    const via = isViewVia(r.via) ? r.via : VIA_NONE, demo = r.demo === true;
    if (demo && !isInvite(via)) continue; // a Demo profile view without an invite code is counted nowhere
    views.add(keyOf({ surface: r.surface, via, ext: r.ref_class === 'external', demo }), w, count(r.n));
    // The same rows the strict cell sums (profile surface, external referrer, trader target), split by target class.
    if (r.surface === 'profile' && r.ref_class === 'external' && !demo) atoms[w][r.filer === true ? 2 : internalSet && r.internal === true ? 1 : 0] += count(r.n);
  }
  views.seal();
  selfs.seal();
  // F-31: the largest single profile per week, and the address-cap marks per week.
  const topOf: (number | null)[] = weeksIdx.map(() => null);
  for (const t of input.top ?? []) {
    const w = weekIndex(mondays, t?.week);
    if (w >= 0 && typeof t.n === 'number' && Number.isFinite(t.n)) topOf[w] = Math.max(topOf[w] ?? 0, Math.floor(t.n));
  }
  const trustedSeen = weeksIdx.map(() => false), untrustedSeen = weeksIdx.map(() => false);
  for (const m of input.cap ?? []) {
    const w = weekIndex(mondays, m?.day);
    if (w < 0) continue;
    if (m.trusted === true) trustedSeen[w] = true;
    else untrustedSeen[w] = true;
  }
  const live = weeksIdx.map((w) => trustedSeen[w] && !untrustedSeen[w]);
  const lastW = W - 1;
  const capState: CapState = live[lastW] ? 'live' : untrustedSeen[lastW] ? 'untrusted' : 'none';
  // select: trader targets only (every row but the two invite rows); selectAny: Demo targets too.
  const selectAny = (p: (k: ViewKey) => boolean) => views.keys().filter((k) => p(parseKey(k)));
  const select = (p: (k: ViewKey) => boolean) => selectAny((k) => !k.demo && p(k));
  const at = (keys: string[], w: number): BaseRef[] => keys.map((key) => ({ key, w }));
  const allWeeks = (keys: string[]): BaseRef[] => keys.flatMap((key) => weeksIdx.map((w) => ({ key, w })));

  const out: string[] = [];
  out.push('# F-15 owner readout');
  out.push('');
  out.push(`Generated ${now.toISOString().slice(0, 10)} (UTC days, ISO weeks). Owner-only; descriptive counts only; never commit this file.`);
  out.push(`Weeks: the ${WEEKS} complete ISO weeks before this one; the current week is not printed, so a printed week does not change between runs.`);
  out.push(DELETION_LINE);
  out.push('Strict DESIGN §3.5 numbers come first; anything else is labelled partial (gate definitions: MRC2-3, owner).');
  out.push('Self-views are excluded everywhere; Demo profiles are excluded except in the two invite rows (see the G3 notes). "<5" = a count from 1 to 4; "(s)" = hidden so a small count can\'t be worked out; "≥ n" = a sum with hidden parts (n counts only the visible parts).');
  out.push('');
  // F-31: the limits block, above the first G-row, on every run.
  out.push(LIMITS_HEADING, '', ...LIMIT_LINES, '', factsHeading(mondays[lastW]), capFactLine(capState));
  if (live.some((l) => !l)) out.push(CAP_FLAG_LINE);
  out.push(internalFactLine(internalState, count(input.internal?.ignored), count(input.internal?.listed)));
  if (internalSet) out.push(INTERNAL_RUNS_LINE);
  out.push(`${RANKED_LABEL}${rankedCell(input.ranked)}`, RANKED_LINE); // F-33
  out.push('');

  // G1: two disjoint single counts, no total.
  const g1 = [count(input.g1?.strict), count(input.g1?.partial)];
  const small = (v: number) => (v > 0 && v < SMALL ? '<5' : fmt(v));
  out.push('## G1');
  out.push('');
  out.push(table(['Metric (DESIGN §3.5)', 'Continue if', 'Now'], [
    [GATES[0].metric, GATES[0].threshold, small(g1[0])],
    ['partial: traders whose connections are all frozen or failed (none connected)', '', small(g1[1])],
    ...(internalSet ? [[G1_INTERNAL_ROW, '', g1InternalCell(input)]] : []),
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
    ['partial: invite links (inv_*)', '', selectAny((k) => isInvite(k.via))],
    ['partial: invite landings on Demo profiles', '', selectAny((k) => k.demo && isInvite(k.via))],
    ['partial: nav/profile CTA links', '', select((k) => k.via === 'nav' || k.via === 'profile' || (tm(k.via) && k.surface === 'login'))],
    ['partial: trade surface, external referrer', '', select((k) => k.surface === 'trade' && k.ext)],
    ['partial: month surface, external referrer', '', select((k) => k.surface === 'month' && k.ext)],
  ];
  // F-31 rows (plan §1, §3): under the strict row, its address cap, its family and the tagged-or-external row; the
  // self-views row last. No Continue-if cell and no total on any of them.
  const g3Rows = g3.map(([label, th, keys]) => [label, th, ...weeksIdx.map((w) => views.print(at(keys, w)))]);
  const strictKeys = g3[0][2];
  const family = weeksIdx.map((w) => {
    if (!views.exact(at(strictKeys, w))) return { trader: '(s)', filer: '(s)', withoutInternal: internalSet ? '(s)' : null, top: '(s)' };
    const [a, b, c] = atoms[w];
    return strictFamily({ a, b, c }, topOf[w], internalSet);
  });
  const [capRow, traderRow, filerRow, topRow, taggedRow, selfRow] = F31_ROW_LABELS;
  const tagged = select((k) => k.surface === 'profile' && (k.ext || TAGGED_VIAS.includes(k.via)));
  const f31Rows: string[][] = [
    [capRow, '', ...weeksIdx.map((w) => (live[w] ? 'live' : CAP_NOT_LIVE))],
    [traderRow, '', ...family.map((f) => f.trader)],
    [filerRow, '', ...family.map((f) => f.filer)],
    [topRow, '', ...family.map((f) => f.top)],
    ...(internalSet ? [[G3_INTERNAL_ROW, '', ...family.map((f) => f.withoutInternal ?? '(s)')]] : []),
    [taggedRow, '', ...weeksIdx.map((w) => views.print(at(tagged, w)))],
  ];
  out.push('## G3');
  out.push('');
  out.push(table(['Metric (DESIGN §3.5)', 'Continue if', ...weekHead],
    [g3Rows[0], ...f31Rows, ...g3Rows.slice(1), [selfRow, '', ...weeksIdx.map((w) => selfs.print([{ key: 'self', w }]))]]));
  out.push('');
  out.push(`All G3 rows count ${G3_LABEL}. The partial rows overlap and are not a split of the strict row.`);
  out.push(G3_OWNER_LINE);
  out.push(DEMO_INVITE_LINE);
  out.push(SPLIT_LINE, TOP_LINE, SELF_LINE);
  if (internalSet) out.push(INTERNAL_LINE);
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
  const allViews = select(() => true); // trader targets only: Demo-target invite views are in the invite rows alone
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
export type SharerRow = { card: boolean; story: boolean; record: boolean; sheet: boolean; copy: boolean; down: boolean; internal?: boolean };
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

// The printed G2 values (strict row, then G2_ROWS) for given cells and G1. blind: G1 "<5" or a trader list that doesn't
// match G1, so every value is "(s)". A row prints "(s)" when the rest of its partition (G1 − row) holds a hidden cell
// and is under 5 (a bound or an exact row would give that small complement away), or when its visible part is 0.
export function g2Print(cells: Record<G2Cell, number>, g1: number, blind = false): string[] {
  const hidden = g2Hidden(cells);
  const value = (ks: G2Cell[], group: number): string => {
    if (blind || (g1 > 0 && g1 < SMALL)) return '(s)';
    const vis = ks.filter((k) => !hidden.has(k));
    const n = vis.reduce((s, k) => s + cells[k], 0);
    const rest = G2_GROUPS[group].filter((k) => !ks.includes(k));
    const restN = rest.reduce((s, k) => s + cells[k], 0);
    if (rest.some((k) => hidden.has(k)) && restN < SMALL) return '(s)';
    // A lower bound carries its percent so it reads against the threshold (business lead BL-1); a bound of 0 says nothing
    // and reads as "none", so it prints "(s)" (UX lead UX-1).
    if (vis.length < ks.length) return n === 0 ? '(s)' : `≥ ${fmt(n)} of ${fmt(g1)} (≥ ${Math.floor((100 * n) / g1)}%)`;
    return g1 === 0 ? `0 of 0` : `${fmt(n)} of ${fmt(g1)} (${Math.round((100 * n) / g1)}%)`;
  };
  return [value(G2_STRICT_CELLS, 0), ...G2_ROWS.map(([, ks, group]) => value(ks, group))];
}

// The readout counts share rows from G2_FLOOR_OFFSET days before the window's last day. The window ends 1-7 days before
// the run and the purge deletes rows older than the retention bound before today, so with the offset 7 days inside the
// bound no counted row can have been purged: the same window gives the same G2 before and after any purge.
export const g2FloorOffset = (retentionDays: number) => Math.max(0, retentionDays - 7);

function g2Section(input: ReadoutInput, lastDay: string): string[] {
  const g2 = input.g2;
  const traders = Array.isArray(g2?.traders) ? g2.traders : [];
  const g1 = count(input.g1?.strict);
  const printed = g2Print(g2Cells(traders), g1, traders.length !== g1);
  const first = g2?.firstDay != null ? isoDay(g2.firstDay) : null;
  const days = count(g2?.retentionDays);
  return [
    '## G2',
    '',
    table(['Metric (DESIGN §3.5)', 'Continue if', 'Now'], [
      [GATES[1].metric, GATES[1].threshold, printed[0]],
      ...G2_ROWS.map(([label], i) => [label, '', printed[i + 1]]),
    ]),
    '',
    `Traders with a connected broker (strict G1), not share actions. The strict row counts a profile link or picture share (card or story) on or before ${lastDay}${days ? `, within the ${g2FloorOffset(days)} days before the window's end` : ''}. The partial rows overlap and are not a split of the strict row.`,
    g2PreSliceLine(first),
    G2_OUTCOME_LINE,
    G2_COHORT_LINE,
    '',
  ];
}

// G2 input from the database: one row per strict-G1 trader (non-demo, non-deleted, a connection in state 'connected'),
// only which classes of share_action rows exist from the floor (g2FloorOffset) to the window's last day. No id, handle
// or return is selected. onlyUsers narrows the traders (db tests on a shared database read only their own rows).
// F-31: internal = the trader's handle is on the env list (bound as one parameter, compared, never selected).
export async function loadG2(sql: Sql, to: string, retentionDays: number, onlyUsers?: number[], internal: string[] = []): Promise<G2Input> {
  const floor = g2FloorOffset(retentionDays);
  const traders = await sql<SharerRow[]>`
    select coalesce(bool_or(s.surface = 'card'), false) as card, coalesce(bool_or(s.surface = 'story'), false) as story,
           coalesce(bool_or(s.surface in ('trade', 'month')), false) as record,
           coalesce(bool_or(s.outcome = 'sheet'), false) as sheet, coalesce(bool_or(s.outcome = 'copy'), false) as copy,
           coalesce(bool_or(s.record_sign = 'down'), false) as down,
           coalesce(bool_or(u.public_filer_id is null and u.handle = any(${internal}::text[])), false) as internal
    from users u
    left join share_action s on s.user_id = u.id and s.day <= ${to}::date and s.day >= ${to}::date - ${floor}::int
    where u.deleted_at is null
      and not ${demoUser(sql, sql`u.id`)}
      and exists (select 1 from connections c where c.user_id = u.id and c.state = 'connected')
      ${onlyUsers ? sql`and u.id = any(${onlyUsers}::int[])` : sql``}
    group by u.id`;
  return { traders: traders.map((t) => ({ card: t.card, story: t.story, record: t.record, sheet: t.sheet, copy: t.copy, down: t.down, internal: t.internal === true })), firstDay: null, retentionDays };
}

// F-33: the records the feed would weigh, counted. One statement: the visible, non-Demo users first (the predicates the
// feed and G1 use: lib/visible-users.ts, lib/public-gate.ts#filerVisibleSql, demoUser below), then their closed trades
// with the feed weight's own row filters (lib/feed.ts#ready, #importedBy, closed by asOf), grouped by user as
// lib/feed.ts#weights() groups them; rankWeight runs per user in JS. Returns the count only. onlyUsers narrows the users
// (db tests on a shared database read only their own rows).
// ponytail: reads every visible record's closes once a run — fix: read the feed's cached TraderFacts or a per-user
// summary when records grow.
// Wrapped in { q } because a query is a thenable: awaiting this function must not run it (the db test EXPLAINs it).
export async function rankedQuery(sql: Sql, asOf: Date, onlyUsers?: number[]): Promise<{ q: PendingQuery<Row[]> }> {
  const { ready, importedBy } = await import('../lib/feed.ts');
  const { visibleUser } = await import('../lib/visible-users.ts');
  const { filerVisibleSql } = await import('../lib/public-gate.ts');
  return { q: sql`
    with v as (
      select u.id from users u
      where ${visibleUser('u')} and ${filerVisibleSql('u')} and not ${demoUser(sql, sql`u.id`)}
        ${onlyUsers ? sql`and u.id = any(${onlyUsers}::int[])` : sql``})
    select t.user_id, '[' || string_agg(concat_ws(',', to_json(t.symbol)::text, t.return_pct, t.holding_days,
      date_part('epoch', t.opened_at) * 1000, date_part('epoch', t.closed_at) * 1000), ',') || ']' as j
    from closed_trades t join v on v.id = t.user_id
    where t.closed_at <= ${asOf} and ${ready('t', asOf)} and ${importedBy(sql`t.sell_imported_at`, asOf)}
    group by t.user_id` };
}
export async function loadRanked(sql: Sql, asOf: Date, onlyUsers?: number[]): Promise<number> {
  const { rankWeight } = await import('../lib/rank-weight.ts');
  let n = 0;
  for (const r of await (await rankedQuery(sql, asOf, onlyUsers)).q) {
    const a = JSON.parse(r.j as string) as (string | number)[], ts = [];
    for (let k = 0; k < a.length; k += 5) ts.push({ symbol: a[k] as string, returnPct: a[k + 1] as number, holdingDays: a[k + 2] as number,
      openedAt: new Date(a[k + 3] as number), closedAt: new Date(a[k + 4] as number) });
    if (rankWeight(ts) > 0) n++;
  }
  return n;
}

// Demo target (cycle 4 F4-11, C4-4): a user with a demo activity (lib/demo.ts) or a fictional fixture filer
// (public_filers.demo, lib/public-import.ts), whose closed trades are written without any activity row.
const demoUser = (sql: Sql, id: PendingQuery<Row[]>) => sql`(exists (select 1 from activities a where a.user_id = ${id} and a.source = 'demo')
  or exists (select 1 from users du join public_filers pf on pf.id = du.public_filer_id where du.id = ${id} and pf.demo))`;

// Rollup input from the database: user_id is summed away; no handle, name, id or return is selected. Deleted targets are
// dropped; demo says the target is a Demo profile (buildReadout counts those in the invite rows only). onlyUsers narrows
// the rows to those users' (db tests on a shared database read only their own rows).
// F-31: filer = a public-filing target; internal = a trader target whose handle is on the env list (bound as one
// parameter and compared, never selected). Both are booleans; the base keys ignore them.
export async function loadRollup(sql: Sql, from: string, to: string, onlyUsers?: number[], internal: string[] = []): Promise<RollupRow[]> {
  const rows = await sql<RollupRow[]>`
    select to_char(r.day, 'YYYY-MM-DD') as day, r.surface, r.ref_class, r.via, r.self_view,
           (r.user_id is not null and ${demoUser(sql, sql`r.user_id`)}) as demo, sum(r.n)::int as n,
           (r.user_id is not null and u.public_filer_id is not null) as filer,
           (r.user_id is not null and u.public_filer_id is null and u.handle = any(${internal}::text[])) as internal
    from view_rollup r left join users u on u.id = r.user_id
    where r.day between ${from}::date and ${to}::date
      and (r.user_id is null or u.deleted_at is null)
      ${onlyUsers ? sql`and r.user_id = any(${onlyUsers}::int[])` : sql``}
    group by 1, 2, 3, 4, 5, 6, 8, 9`;
  return [...rows];
}

// F-31: per ISO week (Monday), the largest single profile's strict G3 views: the strict cell's own filters (profile
// surface, external referrer, no self-view, no Demo target, no deleted user). user_id is grouped by, never selected.
export async function loadTop(sql: Sql, from: string, to: string, onlyUsers?: number[]): Promise<{ week: string; n: number }[]> {
  const rows = await sql<{ week: string; n: number }[]>`
    select to_char(p.wk, 'YYYY-MM-DD') as week, max(p.n)::int as n
    from (select date_trunc('week', r.day::timestamp)::date as wk, sum(r.n) as n
          from view_rollup r join users u on u.id = r.user_id
          where r.day between ${from}::date and ${to}::date
            and r.surface = 'profile' and r.ref_class = 'external' and not r.self_view
            and u.deleted_at is null and not ${demoUser(sql, sql`r.user_id`)}
            ${onlyUsers ? sql`and r.user_id = any(${onlyUsers}::int[])` : sql``}
          group by 1, r.user_id) p
    group by 1`;
  return rows.map((r) => ({ week: r.week, n: r.n }));
}

// F-31: the address-cap day marks in the window (lib/views.ts#markCapDay): a day and a flag, nothing else.
export async function loadCapMarks(sql: Sql, from: string, to: string): Promise<{ day: string; trusted: boolean }[]> {
  const rows = await sql<{ day: string; trusted: boolean }[]>`
    select to_char(day, 'YYYY-MM-DD') as day, trusted from view_cap_days where day between ${from}::date and ${to}::date`;
  return rows.map((r) => ({ day: r.day, trusted: r.trusted }));
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
  // F-31: the internal handles go only to the loaders as one bound parameter; never printed, logged or passed on.
  const internal = parseInternalHandles(process.env.READOUT_INTERNAL_HANDLES);
  try {
    const rollup = await loadRollup(sql, from, to, undefined, internal.handles);
    const drops = await sql<DropRow[]>`
      select to_char(day, 'YYYY-MM-DD') as day, surface, reason, sum(n)::int as n from view_drops
      where day between ${from}::date and ${to}::date group by day, surface, reason`;
    const { SHARE_RETENTION_DAYS } = await import('../lib/share-actions.ts');
    const g2 = await loadG2(sql, to, SHARE_RETENTION_DAYS, undefined, internal.handles);
    const top = await loadTop(sql, from, to);
    const cap = await loadCapMarks(sql, from, to);
    const [g1] = await sql<{ strict: number; partial: number }[]>`
      select count(*) filter (where t.connected)::int as strict, count(*) filter (where not t.connected)::int as partial
      from (select bool_or(c.state = 'connected') as connected
            from users u join connections c on c.user_id = u.id
            where u.deleted_at is null
              and not ${demoUser(sql, sql`u.id`)}
            group by u.id) t`;
    const ranked = await loadRanked(sql, now); // F-33
    // G1 strict is the G2 trader count itself, so the two can't disagree.
    const text = buildReadout({ ranked,
      rollup, drops: [...drops], g1: { strict: g2.traders.length, partial: g1?.partial ?? 0 }, g2,
      top, cap, internal: { state: internal.state, ignored: internal.ignored, listed: internal.handles.length },
    }, now);
    mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `f15-readout-${now.toISOString().slice(0, 10)}.md`);
    writeFileSync(file, text, { mode: 0o600 });
    console.log(`wrote ${file}`);
  } catch (e) {
    // F-31: a database error is reported by class and code only, so a driver message can't echo a bound handle.
    console.error('readout failed', logSafe(e));
    process.exitCode = 1;
  } finally {
    await sql.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
}
