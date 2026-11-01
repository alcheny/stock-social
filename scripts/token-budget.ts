// Token budget governor (spec: docs/token-budget.md). The orchestrator of the parallel agent build passes one JSON
// snapshot (the clock, the usage window, running sessions, the queue, earlier readings) and gets one JSON plan: which
// queued sessions to start now, so that running sessions keep their reserve and new work fills the window up to its
// cap. Pure and deterministic: `now` comes from the snapshot, nothing here reads the clock, and bad input never throws
// (it is normalised, bounded and listed in `issues`). The governor never limits rate: no pacing or concurrency caps.
//
//   node scripts/token-budget.ts plan snapshot.json     # or `plan -` to read stdin; exit 2 when no plan can be built
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// ponytail: cost is a proxy for tokens (the cap is on tokens; cache reads are cheap in dollars but may weigh
// differently) — a per-session token count from the provider would replace every dollar figure here.

const H = 3_600_000;
const MIN = 60_000;
const KINDS = ['build', 'council', 'review', 'orchestrator'] as const;
const STATUSES = ['allowed', 'allowed_warning', 'rejected'] as const;
const WINDOW_HOURS: Record<string, number> = { seven_day: 7 * 24, five_hour: 5 };

export type Kind = (typeof KINDS)[number];
export type Range = { low: number; point: number; high: number };
export type Issue = { level: 'warn' | 'error'; code: string; detail: string };
export type Prior = { low: number | null; point: number | null; high: number | null; typicalHours: number | null; tailHours: number; floorUsd: number };
export type Brake = 'none' | 'rejected' | 'overage' | 'unknown-status';

// Expected total cost of a whole session (USD), calibrated on 2026-11-01's runs (table in the spec).
// ponytail: priors come from one day's runs — refit them from finished sessions' costs as more runs complete.
export const DEFAULT_PRIORS: Readonly<Record<string, Prior>> = {
  build: { low: 20, point: 40, high: 55, typicalHours: 5, tailHours: 1, floorUsd: 4 },
  'build:small': { low: 5, point: 9, high: 12, typicalHours: 2, tailHours: 0.5, floorUsd: 2 },
  council: { low: 30, point: 40, high: 60, typicalHours: 4, tailHours: 1, floorUsd: 4 },
  review: { low: 1, point: 3, high: 4, typicalHours: 0.5, tailHours: 0.25, floorUsd: 1 },
  // The orchestrator runs until reset: no prior, and no tail (its remaining hours are the hours to reset).
  orchestrator: { low: null, point: null, high: null, typicalHours: null, tailHours: 0, floorUsd: 2 },
};

// No rate, pacing or concurrency knob, by design (the spec's "never limits rate").
export const DEFAULT_CONFIG = { warnFraction: 0.75, safety: 1.5 } as const;

// Input bounds: anything outside is invalid (reported) so every figure in the plan stays finite.
const MAX_USD = 1e12;
const MAX_HOURS = 1e4;
const MAX_TIME_MS = 8.64e15;         // the Date range
const SAFETY_RANGE = [1, 100] as const;
const WARN_RANGE = [0.01, 0.99] as const;
const EPS = 1e-9;                    // money comparisons: 0.1 + 0.2 fits under 0.3

const RECENT_MIN_AGE_MS = 5 * MIN;   // a `recent` reading younger than this is too noisy to give a burn
const MIN_ACTIVE_HOURS = 0.25;       // lifetime burn is averaged over at least 15 minutes
const YOUNG_HOURS = 0.5;             // before this age (and below its low prior) a session's burn is not projected
const SLOPE_LOOKBACK_MS = 2 * H;     // history readings used for the window-spend slope
const SLOPE_MIN_GAP_MS = 15 * MIN;
const BURN_MISMATCH = 2;             // history slope vs the sessions' burns: report a gap above this factor
const BRACKET_WIDE = 1.25;           // calibrated cap high / low above this is reported
const PAUSE_RULE = 'pause in this order until status is allowed again; the orchestrator is never paused';

// --- Plan shape ------------------------------------------------------------------------------------------------

export type SessionReserve = {
  id: string; kind: Kind; phase: string | null; priority: number; spentUsd: number; priorUsd: Range | null;
  burnUsdPerHour: number; remainingHours: number; remaining: Range; basis: 'prior' | 'burn' | 'floor';
};
export type Item = { id: string; kind: Kind; priority: number; estimate: Range };
export type ReadingRef = { at: string | null; spendUsd: number; status: string; resetsAt: string | null };
export type Cap = {
  low: number | null; point: number | null; high: number | null; source: 'config' | 'calibrated' | 'unknown'; known: boolean;
  // The reading that set the high end, plus each reading that set a value.
  calibratedFrom?: ReadingRef & { warning?: ReadingRef; rejected?: ReadingRef; allowedLow?: ReadingRef };
  lowerBoundUsd: number;
};
export type Plan = {
  version: 1; now: string; summary: string; brake: Brake; warning: boolean;
  window: { type: string; startAt: string | null; resetsAt: string | null; assumed: boolean; rolledOver: boolean; status: string | null; isUsingOverage: boolean; hoursToReset: number | null };
  cap: Cap;
  spend: { windowUsd: number };
  reserve: { totalUsd: number; lowUsd: number; highUsd: number; safety: number; sessions: SessionReserve[] };
  capacity: { headroomUsd: number | null; admittedLowUsd: number; admittedPointUsd: number; admittedHighUsd: number };
  admit: Item[];
  queued: (Item & { reason: string; nextAdmitAt: string | null })[];
  projection: {
    burnUsdPerHour: number; burnSource: 'history' | 'sessions'; timeToCapHours: number | null; capHitAt: string | null;
    capHitBeforeReset: boolean | null; runningProjectedSpendUsd: number; runningFits: boolean | null; runningFitsWithSafety: boolean | null;
    overshoot: { worstCaseSpendUsd: number; vsCapLowUsd: number | null; risk: 'none' | 'possible' | 'likely' | 'unknown' };
  };
  fill: { expectedUnusedUsd: number | null; recommendAdmitUsd: number; suggestedKinds: string[]; message: string };
  pause: { stallRisk: boolean; reason: string | null; rule: string; recommend: string[] };
  issues: Issue[];
  historyEntry: { at: string; totalCostUsd: number; status: string | null; resetsAt: string | null };
};

// --- Small pure helpers ----------------------------------------------------------------------------------------

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isMoney = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= MAX_USD;
const isHours = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= MAX_HOURS;
const own = <T>(table: Readonly<Record<string, T>>, key: string): T | undefined => (Object.hasOwn(table, key) ? table[key] : undefined);
const cents = (x: number) => Math.round(x * 100) / 100;
const centsRange = (r: Range): Range => ({ low: cents(r.low), point: cents(r.point), high: cents(r.high) });
const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
const maxOf = (xs: number[], start: number) => xs.reduce((m, x) => (x > m ? x : m), start);
const usd = (x: number) => `$${cents(x).toFixed(2)}`;

// ISO time rounded to whole seconds, or null outside the Date range.
export function iso(ms: number): string | null {
  return Number.isFinite(ms) && Math.abs(ms) <= MAX_TIME_MS ? new Date(Math.round(ms / 1000) * 1000).toISOString() : null;
}

// ISO string, unix seconds or unix milliseconds (also as digit strings) → ms, or null (also outside the Date range).
export function parseTime(v: unknown): number | null {
  if (typeof v === 'string' && /^\s*-?\d+(\.\d+)?\s*$/.test(v)) v = Number(v);
  let ms: number | null = null;
  if (typeof v === 'number' && Number.isFinite(v)) ms = Math.abs(v) < 1e11 ? v * 1000 : v;
  else if (typeof v === 'string') { const p = Date.parse(v); ms = Number.isFinite(p) ? p : null; }
  return ms !== null && Math.abs(ms) <= MAX_TIME_MS ? ms : null;
}

// The `resetsAt` of the window that contains `atMs`, on the grid of fixed-length windows through `anchorResetsMs`.
// ponytail: windows are assumed fixed-length and back to back — a provider that shifts its reset times would need the
// entry's own `resetsAt` (the orchestrator appends `historyEntry`, which carries it).
function windowOf(atMs: number, anchorResetsMs: number, durMs: number): number {
  return anchorResetsMs + durMs * (Math.floor((atMs - anchorResetsMs) / durMs) + 1);
}

// --- Spend, remaining cost and cap: the exported building blocks --------------------------------------------------

export type SpendSession = { costUsd: number; startedAtMs: number; lastActiveAtMs: number };

// Window spend: a session that started inside the window counts in full; one that started before counts pro rata.
export function windowSpend(sessions: SpendSession[], windowStartMs: number): number {
  return sum(sessions.map((s) => {
    if (s.startedAtMs >= windowStartMs) return s.costUsd;
    if (s.lastActiveAtMs <= windowStartMs) return 0;
    // ponytail: pro rata assumes an even burn over the active span of a session that spans the window start — a
    // cost reading taken at each window start would give the exact split.
    return s.costUsd * (s.lastActiveAtMs - windowStartMs) / (s.lastActiveAtMs - s.startedAtMs);
  }));
}

export type RunningSession = SpendSession & { kind: string; phase?: string | null; recent?: { costUsd: number; atMs: number } | null };
export type Remaining = { priorUsd: Range | null; burnUsdPerHour: number; remainingHours: number; remaining: Range; basis: 'prior' | 'burn' | 'floor' };

export function priorFor(kind: string, phase: string | null | undefined, priors: Readonly<Record<string, Prior>> = DEFAULT_PRIORS): Prior {
  return (phase ? own(priors, `${kind}:${phase}`) : undefined) ?? own(priors, kind) ?? own(priors, 'build') ?? DEFAULT_PRIORS.build;
}

function burnRate(s: RunningSession, nowMs: number): number {
  if (s.recent && nowMs - s.recent.atMs >= RECENT_MIN_AGE_MS && s.recent.costUsd <= s.costUsd) {
    return (s.costUsd - s.recent.costUsd) / ((nowMs - s.recent.atMs) / H);
  }
  // ponytail: without a recent reading the burn is the lifetime average, which lags a session that just sped up or
  // went idle — the orchestrator passing `recent` for every session fixes it.
  const activeHours = Math.max(MIN_ACTIVE_HOURS, (s.lastActiveAtMs - s.startedAtMs) / H);
  return s.costUsd / activeHours;
}

// Remaining cost of a running session, three times (low/point/high prior): max(prior − spent, burn × hours, floor).
// The high figure is widened by `safety`. Never 0: the floor is positive.
export function remainingCost(s: RunningSession, nowMs: number, resetsAtMs: number,
  priors: Readonly<Record<string, Prior>> = DEFAULT_PRIORS, safety: number = DEFAULT_CONFIG.safety): Remaining {
  const p = priorFor(s.kind, s.phase, priors);
  const burn = burnRate(s, nowMs);
  const ageHours = (nowMs - s.startedAtMs) / H;
  // ponytail: remaining hours do not stop at reset, so work that runs past the reset is reserved in this window —
  // splitting each session's remaining cost at `resetsAt` would free that part (conservative as it is).
  const hours = p.typicalHours === null ? Math.max(0, (resetsAtMs - nowMs) / H)
    : Math.max(p.typicalHours - ageHours, p.tailHours);
  // ponytail: a session younger than 30 minutes (and below its low prior) is reserved at its prior, not its burn,
  // because a few minutes' average extrapolates startup bursts — a per-kind early-burn profile would replace this.
  const burnCounts = p.low === null || ageHours >= YOUNG_HOURS || s.costUsd >= p.low;
  const byBurn = burnCounts ? burn * hours : 0;
  const one = (prior: number | null) => Math.max(prior === null ? 0 : prior - s.costUsd, byBurn, p.floorUsd);
  const pointPrior = p.point === null ? -Infinity : p.point - s.costUsd;
  const basis = pointPrior >= byBurn && pointPrior >= p.floorUsd ? 'prior' : byBurn >= p.floorUsd ? 'burn' : 'floor';
  const priorUsd = p.low === null || p.point === null || p.high === null ? null : { low: p.low, point: p.point, high: p.high };
  return { priorUsd, burnUsdPerHour: burn, remainingHours: hours, remaining: { low: one(p.low), point: one(p.point), high: one(p.high) * safety }, basis };
}

export type Reading = { atMs: number; totalCostUsd: number; status: string | null; resetsAtMs: number };
type CapOptions = { capUsd?: number | null; warnFraction: number; currentResetsAtMs: number };

const ref = (r: Reading): ReadingRef => ({ at: iso(r.atMs), spendUsd: cents(r.totalCostUsd), status: r.status ?? '', resetsAt: iso(r.resetsAtMs) });

// The cap as low/point/high: from config, else calibrated from the most recent warning (and a rejected reading of the
// same or a newer window), raised by this window's allowed readings when the calibration is from an older window.
// ponytail: the provider reports no percentage used, so the cap is inferred from the spend at which status first
// turned allowed_warning (and spend the orchestrator cannot see, like a person's own sessions, makes it low) — a
// percent-used or remaining-tokens figure from the provider would replace this estimate.
export function estimateCap(readings: Reading[], o: CapOptions, onIssue: (code: string, detail: string) => void = () => {}): Cap {
  const sorted = [...readings].sort((a, b) => a.atMs - b.atMs);
  const wf = o.warnFraction;
  let lowerBoundUsd = sorted.reduce((m, r) => (r.status === 'allowed' && r.resetsAtMs === o.currentResetsAtMs ? Math.max(m, r.totalCostUsd / wf) : m), 0);
  if (o.capUsd != null) return { low: o.capUsd, point: o.capUsd, high: o.capUsd, source: 'config', known: true, lowerBoundUsd };

  const latestWindow = (status: string) => sorted.reduce((m, r) => (r.status === status && r.resetsAtMs > m ? r.resetsAtMs : m), -Infinity);
  const firstIn = (status: string, win: number) => sorted.find((r) => r.status === status && r.resetsAtMs === win);
  const allowedBefore = (x: Reading) => sorted.filter((r) => r.status === 'allowed' && r.resetsAtMs === x.resetsAtMs && r.atMs < x.atMs).pop();
  const wWin = latestWindow('allowed_warning'), rWin = latestWindow('rejected');
  const warning = firstIn('allowed_warning', wWin);
  const rejected = warning && rWin < wWin ? undefined : firstIn('rejected', rWin); // an older window's rejection is stale
  if (!warning && !rejected) return { low: null, point: null, high: null, source: 'unknown', known: false, lowerBoundUsd };

  let low = Infinity, high = Infinity;
  let allowedLow: Reading | undefined;
  if (warning) {
    high = warning.totalCostUsd / wf;
    allowedLow = allowedBefore(warning);
    // An allowed reading above the warning spend (inconsistent input) cannot raise low above high.
    low = Math.min(high, allowedLow ? allowedLow.totalCostUsd / wf : warning.totalCostUsd);
  }
  if (rejected) {
    const R = rejected.totalCostUsd;
    if (!warning) {
      allowedLow = allowedBefore(rejected);
      low = allowedLow ? allowedLow.totalCostUsd / wf : R;
    }
    high = Math.min(high, R);
    low = Math.min(low, R);
  }
  const top = rejected && (!warning || rejected.totalCostUsd <= warning.totalCostUsd / wf) ? rejected : warning!;
  const sourceWindow = Math.max(warning?.resetsAtMs ?? -Infinity, rejected?.resetsAtMs ?? -Infinity);
  if (sourceWindow < o.currentResetsAtMs && lowerBoundUsd > low) {
    onIssue('cap-raised', `the cap was calibrated in an older window (low ${usd(low)}, high ${usd(high)}); this window's allowed readings prove it is above ${usd(lowerBoundUsd)}, so it is raised`);
    low = Math.max(low, lowerBoundUsd);
    high = Math.max(high, lowerBoundUsd);
  }
  if (rejected && lowerBoundUsd > high) {
    onIssue('lower-bound-clamped', `allowed readings suggest the cap is above ${usd(lowerBoundUsd)}, but a rejected reading at ${usd(high)} caps it; lowerBoundUsd clamped`);
    lowerBoundUsd = high;
  }
  if (low > 0 && high / low > BRACKET_WIDE) onIssue('cap-bracket-wide', `the calibrated cap is only known to lie between ${usd(low)} and ${usd(high)}; more frequent history readings narrow it`);
  return {
    low, point: (low + high) / 2, high, source: 'calibrated', known: true, lowerBoundUsd,
    calibratedFrom: { ...ref(top), ...(warning ? { warning: ref(warning) } : {}), ...(rejected ? { rejected: ref(rejected) } : {}), ...(allowedLow ? { allowedLow: ref(allowedLow) } : {}) },
  };
}

// --- Normalising the snapshot ----------------------------------------------------------------------------------

type Ctx = { issues: Issue[]; nowMs: number };
const warn = (c: Ctx, code: string, detail: string) => c.issues.push({ level: 'warn', code, detail });
const error = (c: Ctx, code: string, detail: string) => c.issues.push({ level: 'error', code, detail });
const show = (v: unknown) => (typeof v === 'number' && !Number.isFinite(v) ? String(v) : JSON.stringify(v) ?? 'missing');

type Config = { capUsd: number | null; warnFraction: number; safety: number; priors: Record<string, Prior> };
type Session = RunningSession & { id: string; kind: Kind; phase: string | null; priority: number; done: boolean };
type QueueItem = Item & { phase: string | null };

function normKind(c: Ctx, v: unknown, where: string): Kind {
  if ((KINDS as readonly unknown[]).includes(v)) return v as Kind;
  warn(c, 'unknown-kind', `${where}: kind ${show(v)} treated as build`);
  return 'build';
}

function normPriority(c: Ctx, v: unknown, where: string): number {
  if (v === undefined || v === null) return 0;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  warn(c, 'bad-priority', `${where}: priority ${show(v)} treated as 0`);
  return 0;
}

const PRIOR_FIELDS = ['low', 'point', 'high', 'typicalHours', 'tailHours', 'floorUsd'] as const;
const validPriorField = (f: string, v: unknown) =>
  f === 'typicalHours' || f === 'tailHours' ? isHours(v) : f === 'floorUsd' ? isMoney(v) && v > 0 : isMoney(v);

function normPriors(c: Ctx, over: unknown): Record<string, Prior> {
  const table: Record<string, Prior> = { ...DEFAULT_PRIORS };
  if (over === undefined) return table;
  if (!isObj(over)) { warn(c, 'bad-config', 'config.priors is not an object; defaults used'); return table; }
  for (const [key, v] of Object.entries(over)) {
    const kind = key.split(':')[0];
    if (!(KINDS as readonly string[]).includes(kind)) { warn(c, 'bad-config', `config.priors.${key}: unknown kind; ignored`); continue; }
    const base = own(table, key) ?? own(table, kind)!;
    let next: Prior | null = null;
    if (isMoney(v)) next = { ...base, low: v, point: v, high: v };
    else if (isObj(v) && Object.keys(v).every((f) => (PRIOR_FIELDS as readonly string[]).includes(f))
      && PRIOR_FIELDS.every((f) => v[f] === undefined || validPriorField(f, v[f]))) {
      next = { ...base, ...(v as Partial<Prior>) };
    }
    const ordered = next && (next.low === null || next.point === null || next.high === null || (next.low <= next.point && next.point <= next.high));
    if (next && ordered) table[key] = next;
    else warn(c, 'bad-config', `config.priors.${key}: ${show(v)} is not a cost or { low ≤ point ≤ high } within bounds; default kept`);
  }
  return table;
}

function normConfig(c: Ctx, raw: unknown): Config {
  const cfg: Config = { capUsd: null, warnFraction: DEFAULT_CONFIG.warnFraction, safety: DEFAULT_CONFIG.safety, priors: { ...DEFAULT_PRIORS } };
  if (raw === undefined || raw === null) return cfg;
  if (!isObj(raw)) { warn(c, 'bad-config', 'config is not an object; defaults used'); return cfg; }
  if (raw.capUsd !== undefined && raw.capUsd !== null) {
    if (isMoney(raw.capUsd) && raw.capUsd > 0) cfg.capUsd = raw.capUsd;
    else warn(c, 'bad-config', `config.capUsd ${show(raw.capUsd)} is not a positive number up to ${MAX_USD}; cap estimated instead`);
  }
  if (raw.warnFraction !== undefined) {
    const w = raw.warnFraction;
    if (typeof w === 'number' && w >= WARN_RANGE[0] && w <= WARN_RANGE[1]) cfg.warnFraction = w;
    else warn(c, 'bad-config', `config.warnFraction ${show(w)} is not in [${WARN_RANGE.join(', ')}]; ${DEFAULT_CONFIG.warnFraction} used`);
  }
  if (raw.safety !== undefined) {
    const s = raw.safety;
    if (typeof s === 'number' && s >= SAFETY_RANGE[0] && s <= SAFETY_RANGE[1]) cfg.safety = s;
    else warn(c, 'bad-config', `config.safety ${show(s)} is not in [${SAFETY_RANGE.join(', ')}]; ${DEFAULT_CONFIG.safety} used`);
  }
  cfg.priors = normPriors(c, raw.priors);
  for (const k of Object.keys(raw)) if (!['capUsd', 'warnFraction', 'safety', 'priors'].includes(k)) warn(c, 'unknown-config', `config.${k} is not used`);
  return cfg;
}

// A time that may not be missing or in the future: clamped to now, with an issue.
function pastTime(c: Ctx, v: unknown, where: string, missingCode: string): number {
  const ms = parseTime(v);
  if (ms === null) { warn(c, missingCode, `${where} missing or invalid; now used`); return c.nowMs; }
  if (ms > c.nowMs) { warn(c, 'future-time', `${where} ${iso(ms)} is after now; clamped to now`); return c.nowMs; }
  return ms;
}

function normDone(c: Ctx, v: unknown, where: string): boolean {
  if (v === true || v === false || v === undefined || v === null) return v === true;
  if (v === 'true' || v === 'false') { warn(c, 'bad-done', `${where}: done ${show(v)} is a string; read as ${v}`); return v === 'true'; }
  warn(c, 'bad-done', `${where}: done ${show(v)} is not a boolean; read as false (running)`);
  return false;
}

function normSession(c: Ctx, raw: unknown, i: number): (Session & { generatedId: boolean }) | null {
  if (!isObj(raw)) { warn(c, 'bad-session', `sessions[${i}] is not an object; ignored`); return null; }
  const generatedId = !(typeof raw.id === 'string' && raw.id);
  const id = generatedId ? `(missing id #${i})` : (raw.id as string);
  if (generatedId) warn(c, 'no-id', `sessions[${i}] has no id; called ${id}`);
  const where = `session ${id}`;
  let costUsd = 0;
  if (isMoney(raw.costUsd)) costUsd = raw.costUsd;
  else warn(c, 'bad-cost', `${where}: costUsd ${show(raw.costUsd)} is not a cost up to ${MAX_USD}; counted as 0`);
  const startedAtMs = pastTime(c, raw.startedAt, `${where}: startedAt`, 'no-start');
  let lastActiveAtMs = pastTime(c, raw.lastActiveAt, `${where}: lastActiveAt`, 'no-last-active');
  if (lastActiveAtMs < startedAtMs) {
    warn(c, 'active-before-start', `${where}: lastActiveAt is before startedAt; startedAt used`);
    lastActiveAtMs = startedAtMs;
  }
  let recent: Session['recent'] = null;
  if (raw.recent !== undefined && raw.recent !== null) {
    const at = isObj(raw.recent) ? parseTime(raw.recent.at) : null;
    if (isObj(raw.recent) && isMoney(raw.recent.costUsd) && at !== null && at <= c.nowMs && at >= startedAtMs) {
      if (raw.recent.costUsd <= costUsd) recent = { costUsd: raw.recent.costUsd, atMs: at };
      else warn(c, 'recent-above-cost', `${where}: recent reading ${usd(raw.recent.costUsd)} is above the cost ${usd(costUsd)}; lifetime burn used`);
    } else warn(c, 'bad-recent', `${where}: recent reading unusable; lifetime burn used`);
  }
  return {
    id, generatedId, kind: normKind(c, raw.kind, where), phase: typeof raw.phase === 'string' && raw.phase ? raw.phase : null,
    priority: normPriority(c, raw.priority, where), costUsd, startedAtMs, lastActiveAtMs, done: normDone(c, raw.done, where), recent,
  };
}

// Of two readings of one session: a done one is final; else the larger cost, then the later activity, is the newer.
const newer = (a: Session, b: Session) =>
  a.done !== b.done ? a.done : a.costUsd !== b.costUsd ? a.costUsd > b.costUsd : a.lastActiveAtMs > b.lastActiveAtMs;

function normSessions(c: Ctx, raw: unknown): Session[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) { warn(c, 'bad-sessions', 'sessions is not an array; none used'); return []; }
  const byId = new Map<string, Session>();
  const unnamed: Session[] = []; // generated ids are never merged with anything
  raw.forEach((r, i) => {
    const s = normSession(c, r, i);
    if (!s) return;
    const { generatedId, ...session } = s;
    if (generatedId) { unnamed.push(session); return; }
    const prev = byId.get(session.id);
    if (prev) warn(c, 'duplicate-session', `session ${session.id} listed more than once; the done, else costlier, else later reading kept`);
    if (!prev || newer(session, prev)) byId.set(session.id, session);
  });
  return [...byId.values(), ...unnamed];
}

function normEstimate(c: Ctx, raw: Record<string, unknown>, kind: Kind, phase: string | null, priors: Record<string, Prior>, where: string): Range {
  const field = (name: string) => {
    const v = raw[name];
    if (v === undefined || v === null) return undefined;
    if (isMoney(v)) return v;
    warn(c, 'bad-estimate', `${where}: ${name} ${show(v)} is not a cost up to ${MAX_USD}; ignored`);
    return undefined;
  };
  const L = field('estimateLowUsd'), P = field('estimateUsd'), Hi = field('estimateHighUsd');
  if (L === undefined && P === undefined && Hi === undefined) {
    const p = priorFor(kind, phase, priors);
    if (p.low !== null && p.point !== null && p.high !== null) return { low: p.low, point: p.point, high: p.high };
    warn(c, 'no-estimate', `${where}: no estimate and no prior for ${kind}; the build prior used`);
    const b = priorFor('build', null, priors);
    return { low: b.low ?? 0, point: b.point ?? 0, high: b.high ?? 0 };
  }
  const low = L ?? P ?? Hi!, high = Hi ?? P ?? L!;
  const point = P ?? (low + high) / 2;
  const [a, b, d] = [low, point, high].sort((x, y) => x - y);
  if (a !== low || b !== point || d !== high) warn(c, 'estimate-order', `${where}: estimates were not low ≤ point ≤ high; sorted`);
  return { low: a, point: b, high: d };
}

function normQueue(c: Ctx, raw: unknown, priors: Record<string, Prior>): QueueItem[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) { warn(c, 'bad-queue', 'queue is not an array; none used'); return []; }
  const seen = new Set<string>();
  const out: QueueItem[] = [];
  raw.forEach((r, i) => {
    if (!isObj(r) || typeof r.id !== 'string' || !r.id) { warn(c, 'bad-queue-item', `queue[${i}] has no id; ignored`); return; }
    if (seen.has(r.id)) { warn(c, 'duplicate-queue', `queue item ${r.id} listed more than once; the first kept`); return; }
    seen.add(r.id);
    const where = `queue item ${r.id}`;
    const kind = normKind(c, r.kind, where);
    const phase = typeof r.phase === 'string' && r.phase ? r.phase : null;
    out.push({ id: r.id, kind, phase, priority: normPriority(c, r.priority, where), estimate: normEstimate(c, r, kind, phase, priors, where) });
  });
  return out;
}

type Window = {
  type: string; durMs: number; resetsAtMs: number; spendFromMs: number;
  assumed: boolean;      // no usable resetsAt: an internal now + duration stands in, and is never printed
  rolledOver: boolean; status: string | null; isUsingOverage: boolean;
  usable: boolean;       // a valid status for the window the plan is in
};

// The current window: rolls forward when now ≥ resetsAt (the provider clears status and overage at reset); a reset
// more than one window ahead, or none at all, makes the window unusable (a brake, every session counted in full).
function normWindow(c: Ctx, raw: unknown): Window {
  const isW = isObj(raw);
  const w = isW ? raw : {};
  if (!isW) error(c, 'no-window', 'window missing; nothing is admitted until it is known');
  const given = w.type ?? w.rateLimitType;
  let type = 'seven_day';
  if (given === undefined) { if (isW) warn(c, 'no-window-type', 'window.type (or rateLimitType) missing; seven_day assumed'); }
  else if (typeof given === 'string' && Object.hasOwn(WINDOW_HOURS, given)) type = given;
  else warn(c, 'unknown-window-type', `window type ${show(given)} treated as seven_day`);
  if (w.type !== undefined && w.rateLimitType !== undefined && w.type !== w.rateLimitType) warn(c, 'window-type-conflict', `window.type ${show(w.type)} and rateLimitType ${show(w.rateLimitType)} differ; type used`);
  const durMs = WINDOW_HOURS[type] * H;
  const status = (STATUSES as readonly unknown[]).includes(w.status) ? (w.status as string) : null;
  const isUsingOverage = w.isUsingOverage === true;
  const resetsAtMs = parseTime(w.resetsAt);

  if (resetsAtMs === null) {
    if (isW) error(c, 'no-resets-at', 'window.resetsAt missing or invalid; nothing is admitted until it is known');
    return { type, durMs, resetsAtMs: c.nowMs + durMs, spendFromMs: -Infinity, assumed: true, rolledOver: false, status, isUsingOverage, usable: false };
  }
  if (resetsAtMs - durMs > c.nowMs) {
    error(c, 'window-ahead', `window.resetsAt ${iso(resetsAtMs)} is more than one ${type} window after now; every session counted in full and nothing admitted`);
    return { type, durMs, resetsAtMs, spendFromMs: -Infinity, assumed: false, rolledOver: false, status, isUsingOverage, usable: false };
  }
  if (c.nowMs >= resetsAtMs) {
    if (status !== null || isUsingOverage || w.status !== undefined) warn(c, 'stale-status', 'the window rolled over; the snapshot status and overage are from the old window and ignored');
    const next = windowOf(c.nowMs, resetsAtMs, durMs);
    return { type, durMs, resetsAtMs: next, spendFromMs: next - durMs, assumed: false, rolledOver: true, status: 'allowed', isUsingOverage: false, usable: true };
  }
  if (status === null) warn(c, 'bad-status', `window.status ${show(w.status)} is not allowed / allowed_warning / rejected; treated as a brake`);
  return { type, durMs, resetsAtMs, spendFromMs: resetsAtMs - durMs, assumed: false, rolledOver: false, status, isUsingOverage, usable: status !== null };
}

function normHistory(c: Ctx, raw: unknown, win: Window): Reading[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) { warn(c, 'bad-history', 'history is not an array; none used'); return []; }
  const out: Reading[] = [];
  let bad = 0;
  raw.forEach((r) => {
    const at = isObj(r) ? parseTime(r.at) : null;
    if (!isObj(r) || at === null || !isMoney(r.totalCostUsd) || at > c.nowMs) { bad++; return; }
    const ownReset = parseTime(r.resetsAt);
    const status = (STATUSES as readonly unknown[]).includes(r.status) ? (r.status as string) : null;
    out.push({ atMs: at, totalCostUsd: r.totalCostUsd, status, resetsAtMs: windowOf(at, ownReset ?? win.resetsAtMs, win.durMs) });
  });
  if (bad) warn(c, 'bad-history', `${bad} history reading(s) without a valid at (not after now) and totalCostUsd ignored`);
  return out;
}

// --- Composing the plan ----------------------------------------------------------------------------------------

function chooseBrake(win: Window, nowOk: boolean): Brake {
  if (!nowOk || !win.usable) return 'unknown-status';
  if (win.status === 'rejected') return 'rejected';
  if (win.isUsingOverage) return 'overage';
  return 'none';
}

function reserveFor(running: Session[], win: Window, cfg: Config, nowMs: number): SessionReserve[] {
  return running.map((s) => {
    const r = remainingCost(s, nowMs, win.resetsAtMs, cfg.priors, cfg.safety);
    return { id: s.id, kind: s.kind, phase: s.phase, priority: s.priority, spentUsd: s.costUsd, priorUsd: r.priorUsd,
      burnUsdPerHour: r.burnUsdPerHour, remainingHours: r.remainingHours, remaining: r.remaining, basis: r.basis };
  });
}

const byPriority = <T extends { id: string; priority: number }>(a: T, b: T) => b.priority - a.priority || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

// The one rule: in priority order, admit while spend + running point + Σ admitted low ≤ cap high; stop at the first
// misfit. Cap unknown → admit everything. Under a brake → nothing.
function admission(queue: QueueItem[], runningIds: Set<string>, brake: Brake, cap: Cap, headroom: number | null, win: Window, c: Ctx) {
  const admit: Item[] = [];
  const queued: Plan['queued'] = [];
  const resetsAt = win.assumed ? null : iso(win.resetsAtMs);
  let left = headroom ?? Infinity;
  let stopper: string | null = null;
  for (const q of [...queue].sort(byPriority)) {
    const item: Item = { id: q.id, kind: q.kind, priority: q.priority, estimate: q.estimate };
    if (runningIds.has(q.id)) {
      warn(c, 'queue-running', `queue item ${q.id} is already running; not admitted again`);
      queued.push({ ...item, reason: 'already running', nextAdmitAt: null });
    } else if (brake !== 'none') {
      queued.push({ ...item, reason: `brake ${brake}: nothing is admitted until a valid allowed status or the reset`, nextAdmitAt: resetsAt });
    } else if (stopper !== null) {
      queued.push({ ...item, reason: `behind ${stopper} (strict priority order)`, nextAdmitAt: resetsAt });
    } else if (!cap.known || q.estimate.low <= left + EPS) {
      admit.push(item);
      left -= q.estimate.low;
    } else {
      stopper = q.id;
      // ponytail: under the point projection a finish frees nothing (its remaining becomes spend), so a misfit waits
      // for the reset — the orchestrator re-plans each tick, and a session that ends under its estimate frees the
      // difference then; per-session finish distributions would let this predict an earlier time.
      queued.push({ ...item, reason: `clearly over 100% of the cap: even its low estimate ${usd(q.estimate.low)} exceeds the ${usd(Math.max(0, left))} left under the cap's high end`, nextAdmitAt: resetsAt });
    }
  }
  return { admit, queued };
}

type Burn = { burn: number; source: 'history' | 'sessions'; sessionsBurn: number };

// Burn rate: the window-spend slope since the earliest reading of the last 2 hours (≥ 15 minutes old), else the
// sessions' own burns.
// ponytail: a two-point linear slope over 2 hours misses bursts and the fleet winding down — a fit over more readings,
// or per-session projections, would track it better.
function burnRateOf(history: Reading[], spend: number, win: Window, reserves: SessionReserve[], nowMs: number, c: Ctx): Burn {
  const sessionsBurn = sum(reserves.map((s) => s.burnUsdPerHour));
  const r = history
    .filter((h) => h.resetsAtMs === win.resetsAtMs && h.atMs >= nowMs - SLOPE_LOOKBACK_MS && h.atMs <= nowMs - SLOPE_MIN_GAP_MS)
    .sort((a, b) => a.atMs - b.atMs)[0];
  const slope = r ? (spend - r.totalCostUsd) / ((nowMs - r.atMs) / H) : -1;
  if (slope < 0) return { burn: sessionsBurn, source: 'sessions', sessionsBurn };
  const [hi, lo] = slope > sessionsBurn ? [slope, sessionsBurn] : [sessionsBurn, slope];
  if (hi > 0 && hi > BURN_MISMATCH * lo) {
    warn(c, 'burn-mismatch', slope > sessionsBurn
      ? `history burn ${usd(slope)}/h is over ${BURN_MISMATCH}x the running sessions' ${usd(sessionsBurn)}/h: spend outside the listed sessions, or sessions that just finished; reserves may be understated`
      : `the running sessions' burn ${usd(sessionsBurn)}/h is over ${BURN_MISMATCH}x the history burn ${usd(slope)}/h: lifetime averages overstate the current burn, or history readings are missing`);
  }
  return { burn: slope, source: 'history', sessionsBurn };
}

function projectionOf(cap: Cap, spend: number, reserves: SessionReserve[], admit: Item[], burn: Burn, hoursToReset: number, nowMs: number): Plan['projection'] {
  const running = (k: keyof Range) => sum(reserves.map((s) => s.remaining[k]));
  const admitted = (k: keyof Range) => sum(admit.map((a) => a.estimate[k]));
  const worst = spend + running('high') + admitted('high');
  const pointCase = spend + running('point') + admitted('point');
  const raw = cap.known && burn.burn > 0 ? Math.max(0, cap.high! - spend) / burn.burn : null;
  const ttc = raw !== null && Number.isFinite(raw) ? raw : null;
  const risk = !cap.known ? 'unknown' : worst <= cap.low! ? 'none' : pointCase <= cap.high! ? 'possible' : 'likely';
  return {
    burnUsdPerHour: burn.burn, burnSource: burn.source, timeToCapHours: ttc, capHitAt: ttc === null ? null : iso(nowMs + ttc * H),
    capHitBeforeReset: cap.known ? ttc !== null && ttc < hoursToReset : null,
    runningProjectedSpendUsd: spend + running('point'),
    runningFits: cap.known ? spend + running('point') <= cap.high! : null,
    runningFitsWithSafety: cap.known ? spend + running('high') <= cap.low! : null,
    overshoot: { worstCaseSpendUsd: worst, vsCapLowUsd: cap.known ? worst - cap.low! : null, risk },
  };
}

// Fill: what the window would leave unused at reset if everything goes to plan, and which kinds of work still fit.
// ponytail: work that will not finish before the reset still counts fully against this window — splitting each
// session's and item's remaining cost at `resetsAt` would show more room near the reset.
function fillOf(cap: Cap, spend: number, reserves: SessionReserve[], admit: Item[], brake: Brake, hoursToReset: number, priors: Record<string, Prior>): Plan['fill'] {
  const none = { suggestedKinds: [] as string[], recommendAdmitUsd: 0 };
  const unused = cap.known ? cap.point! - spend - sum(reserves.map((s) => s.remaining.point)) - sum(admit.map((a) => a.estimate.point)) : null;
  if (brake !== 'none') return { ...none, expectedUnusedUsd: unused, message: `brake ${brake}: no new work until it clears` };
  if (unused === null) return { ...none, expectedUnusedUsd: null, message: 'cap unknown: everything queued is admitted while status is allowed; nothing to estimate yet' };
  if (unused <= 0) return { ...none, expectedUnusedUsd: unused, message: 'no spare budget: running and admitted work is expected to use the whole cap' };
  const kinds = Object.entries(priors)
    .filter(([key, p]) => !key.startsWith('orchestrator') && p.point !== null && p.typicalHours !== null && p.typicalHours <= hoursToReset && p.point <= unused)
    .sort(([ka, a], [kb, b]) => b.point! - a.point! || (ka < kb ? -1 : 1))
    .map(([key]) => key);
  const short = (priorFor('build', null, priors).typicalHours ?? 0) > hoursToReset;
  const head = `~${usd(unused)} of budget will be unused at reset (in ${cents(hoursToReset)}h); queue more work`;
  const tail = !kinds.length ? ': none fits (every kind is too long or too costly for what is left)'
    : `${short ? ', only short items finish before reset' : ''}: ${kinds.join(', ')}`;
  return { suggestedKinds: kinds, recommendAdmitUsd: unused, expectedUnusedUsd: unused, message: head + tail };
}

// Pause order under rejected/overage: lowest priority, then least progress (spent / point prior); never the orchestrator.
function pauseOf(brake: Brake, running: Session[], cfg: Config, runningFits: boolean | null): Plan['pause'] {
  const stall = brake === 'rejected' || brake === 'overage';
  const progress = (s: Session) => { const p = priorFor(s.kind, s.phase, cfg.priors).point; return p ? s.costUsd / p : 0; };
  const recommend = !stall ? [] : running.filter((s) => s.kind !== 'orchestrator')
    .sort((a, b) => a.priority - b.priority || progress(a) - progress(b) || (a.id < b.id ? -1 : 1)).map((s) => s.id);
  const reason = stall ? `status ${brake === 'rejected' ? 'rejected' : 'using overage'}: running sessions may stall`
    : runningFits === false ? 'running work is projected over the cap at point estimates (informational: nothing to pause until status is rejected or overage)'
      : null;
  return { stallRisk: stall || runningFits === false, reason, rule: PAUSE_RULE, recommend };
}

function summaryOf(p: Omit<Plan, 'summary'>): string {
  const capRange = p.cap.low === p.cap.high ? usd(p.cap.high!) : `${usd(p.cap.low!)}-${usd(p.cap.high!)}`;
  const capText = p.cap.known ? `cap ${capRange} (${p.cap.source})` : 'cap unknown';
  const money = `spend ${usd(p.spend.windowUsd)}, reserve ${usd(p.reserve.totalUsd)}, ${capText}`;
  if (p.brake !== 'none') {
    const until = p.window.resetsAt && !p.window.assumed ? `until ${p.window.resetsAt}` : 'until a usable window is read';
    const r = p.pause.recommend;
    const pause = r.length ? `; pause ${r.slice(0, 3).join(', ')}${r.length > 3 ? ` +${r.length - 3} more` : ''} first` : '';
    return `Brake ${p.brake}: admitting nothing, ${p.queued.length} queued ${until}; ${money}${pause}`;
  }
  const parts = [`Admit ${p.admit.length} of ${p.admit.length + p.queued.length} queued`, money, `overshoot ${p.projection.overshoot.risk}`];
  if (p.projection.capHitBeforeReset && p.projection.capHitAt) parts.push(`cap hit ~${p.projection.capHitAt.slice(11, 16)}Z at current burn`);
  if (p.warning) parts.push('status allowed_warning (calibration only)');
  if (p.fill.recommendAdmitUsd > 0) parts.push(`~${usd(p.fill.recommendAdmitUsd)} unused at reset: queue more work`);
  return parts.join('; ');
}

function rounded(p: Omit<Plan, 'summary'>): Omit<Plan, 'summary'> {
  const pr = p.projection;
  const c = (x: number | null) => (x === null ? null : cents(x));
  return {
    ...p,
    window: { ...p.window, hoursToReset: c(p.window.hoursToReset) },
    cap: { ...p.cap, low: c(p.cap.low), point: c(p.cap.point), high: c(p.cap.high), lowerBoundUsd: cents(p.cap.lowerBoundUsd) },
    spend: { windowUsd: cents(p.spend.windowUsd) },
    reserve: { ...p.reserve, totalUsd: cents(p.reserve.totalUsd), lowUsd: cents(p.reserve.lowUsd), highUsd: cents(p.reserve.highUsd),
      sessions: p.reserve.sessions.map((s) => ({ ...s, spentUsd: cents(s.spentUsd), burnUsdPerHour: cents(s.burnUsdPerHour), remainingHours: cents(s.remainingHours), remaining: centsRange(s.remaining) })) },
    capacity: { headroomUsd: c(p.capacity.headroomUsd), admittedLowUsd: cents(p.capacity.admittedLowUsd), admittedPointUsd: cents(p.capacity.admittedPointUsd), admittedHighUsd: cents(p.capacity.admittedHighUsd) },
    admit: p.admit.map((a) => ({ ...a, estimate: centsRange(a.estimate) })),
    queued: p.queued.map((q) => ({ ...q, estimate: centsRange(q.estimate) })),
    projection: { ...pr, burnUsdPerHour: cents(pr.burnUsdPerHour), timeToCapHours: c(pr.timeToCapHours), runningProjectedSpendUsd: cents(pr.runningProjectedSpendUsd),
      overshoot: { ...pr.overshoot, worstCaseSpendUsd: cents(pr.overshoot.worstCaseSpendUsd), vsCapLowUsd: c(pr.overshoot.vsCapLowUsd) } },
    fill: { ...p.fill, expectedUnusedUsd: c(p.fill.expectedUnusedUsd), recommendAdmitUsd: cents(p.fill.recommendAdmitUsd) },
  };
}

// Last line of defence for "every number is finite": a non-finite number becomes null, with an issue.
function finiteOnly<T>(v: T, path: string, issues: Issue[]): T {
  if (typeof v === 'number' && !Number.isFinite(v)) {
    issues.push({ level: 'error', code: 'non-finite', detail: `${path} was ${v}; reported as null` });
    return null as T;
  }
  if (Array.isArray(v)) return v.map((x, i) => finiteOnly(x, `${path}[${i}]`, issues)) as T;
  if (isObj(v)) return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, finiteOnly(x, `${path}.${k}`, issues)])) as T;
  return v;
}

export function plan(snapshot: unknown): Plan {
  const snap = isObj(snapshot) ? snapshot : {};
  const parsedNow = parseTime(snap.now);
  const c: Ctx = { issues: [], nowMs: parsedNow ?? 0 };
  if (parsedNow === null) error(c, 'bad-now', `now ${show(snap.now)} is not a time in the Date range; nothing is admitted`);

  const cfg = normConfig(c, snap.config);
  const win = normWindow(c, snap.window);
  const sessions = normSessions(c, snap.sessions);
  const queue = normQueue(c, snap.queue, cfg.priors);
  const history = normHistory(c, snap.history, win);
  const nowMs = c.nowMs;

  // ponytail: spend the orchestrator cannot see (a person's own sessions on the same account) is missing, so the
  // window's history readings are a floor on it — a provider-reported window total would replace both.
  const fromSessions = windowSpend(sessions, win.spendFromMs);
  const fromHistory = maxOf(history.filter((h) => h.resetsAtMs === win.resetsAtMs).map((h) => h.totalCostUsd), 0);
  if (fromHistory > fromSessions + 0.005) warn(c, 'history-above-spend', `history shows ${usd(fromHistory)} spent this window, more than the sessions' ${usd(fromSessions)}; the larger used`);
  const spend = Math.max(fromSessions, fromHistory);

  // The snapshot's own status is a reading only for a usable window it was read in (not stale, not invented).
  const statusReading = win.usable && !win.rolledOver ? win.status : null;
  const readings = statusReading ? [...history, { atMs: nowMs, totalCostUsd: spend, status: statusReading, resetsAtMs: win.resetsAtMs }] : history;
  const cap = estimateCap(readings, { capUsd: cfg.capUsd, warnFraction: cfg.warnFraction, currentResetsAtMs: win.resetsAtMs }, (code, detail) => warn(c, code, detail));

  const running = sessions.filter((s) => !s.done);
  const reserves = reserveFor(running, win, cfg, nowMs);
  const reserve = (k: keyof Range) => sum(reserves.map((s) => s.remaining[k]));
  const headroom = cap.known ? cap.high! - spend - reserve('point') : null;
  if (cap.known && headroom! < -EPS) {
    warn(c, 'running-over-cap', `running work is projected to ${usd(spend + reserve('point'))} at point estimates, ${usd(-headroom!)} over the cap's high end ${usd(cap.high!)}`
      + (cap.source === 'calibrated' ? '; spend the orchestrator cannot see makes a calibrated cap come out low (the safe side)' : ''));
  }
  const brake = chooseBrake(win, parsedNow !== null);
  const { admit, queued } = admission(queue, new Set(running.map((s) => s.id)), brake, cap, headroom, win, c);

  const hoursToReset = (win.resetsAtMs - nowMs) / H;
  const projection = projectionOf(cap, spend, reserves, admit, burnRateOf(history, spend, win, reserves, nowMs, c), hoursToReset, nowMs);
  const windowKnown = !win.assumed && win.usable;
  const body: Omit<Plan, 'summary'> = {
    version: 1, now: iso(nowMs)!, brake, warning: win.status === 'allowed_warning' && !win.rolledOver,
    window: { type: win.type, startAt: win.assumed ? null : iso(win.resetsAtMs - win.durMs), resetsAt: win.assumed ? null : iso(win.resetsAtMs), assumed: win.assumed,
      rolledOver: win.rolledOver, status: win.status, isUsingOverage: win.isUsingOverage, hoursToReset: win.assumed ? null : hoursToReset },
    cap,
    spend: { windowUsd: spend },
    reserve: { totalUsd: reserve('point'), lowUsd: reserve('low'), highUsd: reserve('high'), safety: cfg.safety, sessions: reserves },
    capacity: { headroomUsd: headroom, admittedLowUsd: sum(admit.map((a) => a.estimate.low)), admittedPointUsd: sum(admit.map((a) => a.estimate.point)), admittedHighUsd: sum(admit.map((a) => a.estimate.high)) },
    admit, queued, projection,
    fill: fillOf(cap, spend, reserves, admit, brake, hoursToReset, cfg.priors),
    pause: pauseOf(brake, running, cfg, projection.runningFits),
    issues: c.issues,
    // A plan without a usable window writes no status or window, so it can never win a later calibration.
    historyEntry: { at: iso(nowMs)!, totalCostUsd: cents(spend), status: windowKnown ? statusReading : null, resetsAt: windowKnown ? iso(win.resetsAtMs) : null },
  };
  const out = finiteOnly(rounded(body), 'plan', c.issues);
  // Keep `summary` second in the printed JSON, after `version` and `now`.
  const { version, now, ...rest } = out;
  return { version, now, summary: summaryOf(out), ...rest };
}

// --- CLI ---------------------------------------------------------------------------------------------------------

function fail(message: string, issues: Issue[] = [{ level: 'error', code: 'unreadable', detail: message }], stream: NodeJS.WriteStream = process.stdout): never {
  stream.write(JSON.stringify({ error: message, issues }, null, 2) + '\n');
  process.exit(2);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [mode, file] = process.argv.slice(2);
  if (mode !== 'plan' || !file) fail('usage: node scripts/token-budget.ts plan <snapshot.json | ->', [{ level: 'error', code: 'usage', detail: 'expected: plan <file|->' }], process.stderr);
  let snapshot: unknown;
  try {
    snapshot = JSON.parse(readFileSync(file === '-' ? 0 : file, 'utf8'));
  } catch (e) {
    fail(`cannot read the snapshot ${file}: ${(e as Error).message}`);
  }
  let p: Plan;
  try {
    p = plan(snapshot);
  } catch (e) {
    fail(`internal error while planning: ${(e as Error).message}`, [{ level: 'error', code: 'internal', detail: String((e as Error).stack ?? e) }]);
  }
  const bad = p.issues.find((i) => i.code === 'bad-now');
  if (bad) fail(bad.detail, p.issues);
  process.stdout.write(JSON.stringify(p, null, 2) + '\n');
}
