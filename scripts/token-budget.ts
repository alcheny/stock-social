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
export type Brake = 'none' | 'rejected' | 'overage' | 'unknown-status' | 'bad-window';
export type AdmitAt = 'low' | 'point';
export type CapEnd = 'low' | 'point' | 'high';

// Expected total cost and duration of a whole session, calibrated on 2026-11-01's runs (table in the spec).
// ponytail: priors come from one day's runs — refit them from finished sessions' costs as more runs complete.
export const DEFAULT_PRIORS: Readonly<Record<string, Prior>> = {
  build: { low: 20, point: 40, high: 70, typicalHours: 1.75, tailHours: 0.25, floorUsd: 4 },
  'build:small': { low: 5, point: 9, high: 15, typicalHours: 0.5, tailHours: 0.1, floorUsd: 2 },
  council: { low: 30, point: 45, high: 65, typicalHours: 1.25, tailHours: 0.25, floorUsd: 4 },
  review: { low: 1, point: 3, high: 5, typicalHours: 0.25, tailHours: 0.05, floorUsd: 1 },
  // The orchestrator runs until reset: no prior, and no tail (its remaining hours are the hours to reset).
  orchestrator: { low: null, point: null, high: null, typicalHours: null, tailHours: 0, floorUsd: 2 },
};

// No rate, pacing or concurrency knob, by design (the spec's "never limits rate").
// admitCapEnd: the end of the cap the admission rules compare against. 'high' is the owner's rule (admit when unsure);
// 'point' or 'low' trade utilisation for fewer windows that end rejected with sessions stalled.
export const DEFAULT_CONFIG: { readonly warnFraction: number; readonly safety: number; readonly admitAt: AdmitAt; readonly admitCapEnd: CapEnd } = { warnFraction: 0.75, safety: 1.5, admitAt: 'low', admitCapEnd: 'high' };
// How far ahead the orchestrator's own reserve looks (config.orchestratorLookaheadHours): it runs for the whole window,
// but reserving its burn for every hour to a reset days away would block all work. A horizon, not a rate limit.
// ponytail: the orchestrator's reserve stops at 24h even when the reset is days away — re-planning every tick keeps
// renewing it; a reserve scaled to the work it still has to drive would replace the fixed horizon.
export const DEFAULT_ORCHESTRATOR_LOOKAHEAD_HOURS = 24;

// Input bounds: anything outside is invalid (reported) so every figure in the plan stays finite.
const MAX_USD = 1e12;
const MAX_HOURS = 1e4;
const MAX_TIME_MS = 8.64e15;         // the Date range
const SAFETY_RANGE = [1, 100] as const;
const WARN_RANGE = [0.01, 0.99] as const;
const EPS = 1e-9;                    // money comparisons: 0.1 + 0.2 fits under 0.3
// resetsAt values this close name the same window: min(15 minutes, window length / 20). Windows of one type are at
// least one length apart, so this never merges two of them.
// ponytail: the provider's resetsAt jitter is only known from observation (seconds to minutes); a provider window id
// would make this exact.
const windowTolerance = (durMs: number) => Math.min(15 * MIN, durMs / 20);
const STATUS_FRESH_MS = 60_000;      // a status reading older than this is paired with the spend when it was read

const RECENT_MIN_AGE_MS = 5 * MIN;   // a `recent` reading younger than this is too noisy to give a burn
const MIN_ACTIVE_HOURS = 0.25;       // lifetime burn is averaged over at least 15 minutes
const LIFETIME_MIN_AGE_H = 10 / 60;  // a lifetime-average burn is projected only from this age …
const RECENT_MIN_SESSION_AGE_H = 5 / 60; // … a recent-reading burn from this age (or once spent ≥ the low prior)
const SLOPE_LOOKBACK_MS = 2 * H;     // history readings used for the window-spend slope
const SLOPE_MIN_GAP_MS = 15 * MIN;
const BURN_MISMATCH = 3;             // history slope vs the sessions' burns: report a gap above this factor
const MISMATCH_QUIET_MS = 15 * MIN;  // … unless a session started or finished this recently (the slope lags then)
const BRACKET_WIDE = 1.25;           // calibrated cap high / low above this is reported
// ponytail: evidence up to 10% above a calibrated high (spend seen in its window, or a later window's allowed
// readings) raises the high instead of dropping the cap — readings are planner estimates and warnFraction is
// inferred, so a small excess is more likely noise than a changed cap; a provider-reported cap would end the guess.
const CAP_RAISE_TOLERANCE = 1.1;
// ponytail: a resetsAt more than 30 days old is taken as garbage (e.g. 0) rather than rolled onto a grid that far
// back — the provider's windows are hours or days long, so a real reading is never that stale.
const RESETS_AT_MAX_AGE_MS = 30 * 24 * H;

// --- Plan shape ------------------------------------------------------------------------------------------------

export type SessionReserve = {
  id: string; kind: Kind; phase: string | null; priority: number; paused: boolean; spentUsd: number; priorUsd: Range | null;
  burnUsdPerHour: number; projectedBurnUsdPerHour: number; remainingHours: number; remaining: Range; inWindow: Range; carriesOverUsd: number; basis: 'prior' | 'burn' | 'floor';
};
export type Item = { id: string; kind: Kind; phase: string | null; priority: number; estimate: Range; inWindow: Range };
export type ReasonCode = 'brake' | 'over-cap' | 'over-next-window' | 'behind' | 'already-running';
export type ReadingRef = { at: string | null; spendUsd: number; status: string; resetsAt: string | null };
export type Cap = {
  low: number | null; point: number | null; high: number | null; source: 'config' | 'calibrated' | 'unknown'; known: boolean;
  // The reading that set the high end, plus each reading that set a value.
  calibratedFrom?: ReadingRef & { warning?: ReadingRef; rejected?: ReadingRef; allowedLow?: ReadingRef };
  lowerBoundUsd: number;
};
export type FillSuggestion = { kind: Kind; phase: string | null; inWindowUsd: number; carriesOverUsd: number; count: number };
export type Plan = {
  version: 1; now: string; summary: string; brake: Brake; warning: boolean;
  window: { type: string; startAt: string | null; resetsAt: string | null; assumed: boolean; rolledOver: boolean; status: string | null; statusAssumed: 'allowed' | null; isUsingOverage: boolean; hoursToReset: number | null };
  cap: Cap;
  spend: { windowUsd: number };
  reserve: { totalUsd: number; lowUsd: number; highUsd: number; carriesOverUsd: number; safety: number; sessions: SessionReserve[] };
  capacity: { headroomUsd: number | null; nextWindowHeadroomUsd: number | null; admitAt: AdmitAt; admitCapEnd: CapEnd; admittedLowUsd: number; admittedPointUsd: number; admittedHighUsd: number };
  resume: { ids: string[]; next: string | null; fitting: string[]; all: string[]; rule: string };
  admit: Item[];
  queued: (Item & { reason: string; reasonCode: ReasonCode; nextAdmitAt: string | null })[];
  projection: {
    burnUsdPerHour: number; burnSource: 'sessions'; historyBurnUsdPerHour: number | null; timeToCapHours: number | null; capHitAt: string | null;
    capHitBeforeReset: boolean | null; runningProjectedSpendUsd: number; runningFits: boolean | null; runningFitsWithSafety: boolean | null;
    overshoot: { worstCaseSpendUsd: number; vsCapLowUsd: number | null; risk: 'none' | 'possible' | 'likely' | 'unknown'; note: string | null; nextWindowCarryUsd: number; nextWindowFits: boolean | null };
  };
  fill: { expectedUnusedUsd: number | null; recommendAdmitUsd: number | null; suggestions: FillSuggestion[]; suggestedKinds: string[]; blockedBy: string | null; message: string };
  pause: { stallRisk: boolean; reason: string | null; rule: string; needed: boolean; next: string | null; recommend: string[] };
  issues: Issue[];
  historyEntry: { at: string; totalCostUsd: number; status: string | null; resetsAt: string | null; type: string; windowKnown: boolean };
};

// --- Small pure helpers ----------------------------------------------------------------------------------------

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isMoney = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= MAX_USD;
const isHours = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= MAX_HOURS;
const own = <T>(table: Readonly<Record<string, T>>, key: string): T | undefined => (Object.hasOwn(table, key) ? table[key] : undefined);
const cents = (x: number) => Math.round(x * 100) / 100;
const centsRange = (r: Range): Range => ({ low: cents(r.low), point: cents(r.point), high: cents(r.high) });
const scale = (r: Range, f: number): Range => ({ low: r.low * f, point: r.point * f, high: r.high * f });
const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
const maxOf = (xs: number[], start: number) => xs.reduce((m, x) => (x > m ? x : m), start);
const usd = (x: number) => `$${cents(x).toFixed(2)}`;
const seconds = (ms: number) => Math.round(ms / 1000) * 1000;
const NUMERIC = /^\s*-?\d+(\.\d+)?(e[+-]?\d+)?\s*$/i;

// ISO time rounded to whole seconds, or null outside the Date range.
export function iso(ms: number): string | null {
  return Number.isFinite(ms) && Math.abs(ms) <= MAX_TIME_MS ? new Date(seconds(ms)).toISOString() : null;
}

// ISO string, unix seconds or unix milliseconds (also as digit strings) → ms, or null (also outside the Date range).
export function parseTime(v: unknown): number | null {
  if (typeof v === 'string' && /^\s*-?\d+(\.\d+)?\s*$/.test(v)) v = Number(v);
  let ms: number | null = null;
  if (typeof v === 'number' && Number.isFinite(v)) ms = Math.abs(v) < 1e11 ? v * 1000 : v;
  else if (typeof v === 'string') { const p = Date.parse(v); ms = Number.isFinite(p) ? p : null; }
  return ms !== null && Math.abs(ms) <= MAX_TIME_MS ? ms : null;
}

// Money: a number in [0, 1e12]; a numeric string is accepted (the caller reports it); anything else is bad.
type MoneyRead = { kind: 'missing' } | { kind: 'ok' | 'string'; value: number } | { kind: 'bad' };
function readMoney(v: unknown): MoneyRead {
  if (v === undefined || v === null) return { kind: 'missing' };
  if (isMoney(v)) return { kind: 'ok', value: v };
  if (typeof v === 'string' && NUMERIC.test(v) && isMoney(Number(v))) return { kind: 'string', value: Number(v) };
  return { kind: 'bad' };
}

// The `resetsAt` of the window that contains `atMs`, on the grid of fixed-length windows through `anchorResetsMs`.
// ponytail: an entry without its own `resetsAt` is placed on this window's grid, assuming back-to-back fixed-length
// windows — the orchestrator appending each plan's `historyEntry` (which carries `resetsAt` and `type`) avoids it.
function windowOf(atMs: number, anchorResetsMs: number, durMs: number): number {
  return anchorResetsMs + durMs * (Math.floor((atMs - anchorResetsMs) / durMs) + 1);
}

// --- Spend, remaining cost and cap: the exported building blocks --------------------------------------------------

export type SpendSession = { costUsd: number; startedAtMs: number; lastActiveAtMs: number; pausedHours?: number; paused?: boolean; windowStartCostUsd?: number | null };

// Hours the session has actually worked. While paused, the running pause lies after lastActiveAt: the active span
// (startedAt to lastActiveAt), or the time since start less the paused hours, whichever is less. Not paused, an
// ended pause lies inside the span (span − pausedHours), unless it is longer than the span: then the session was
// just resumed with no event since, and the pause lies after lastActiveAt as while paused.
// ponytail: paused time is known only when the orchestrator passes pausedHours; without it, a resumed session's pause
// counts as active time — and a short pause just resumed is assumed inside the span until the next event (the safe
// side: a higher burn). The provider's per-session active time would replace all of it.
const activeHours = (s: SpendSession, nowMs: number) => {
  const span = s.lastActiveAtMs - s.startedAtMs, paused = (s.pausedHours ?? 0) * H;
  return Math.max(0, !s.paused && paused <= span ? span - paused : Math.min(span, nowMs - s.startedAtMs - paused)) / H;
};

// Window spend: a session that started inside the window counts in full; one that started before counts what it
// spent since the window start (costUsd − windowStartCostUsd) when that is known, else pro rata over active hours.
// Where its paused hours fell is unknown: `pauses: 'before'` puts them before the window start (the most spend in this
// window: the safe side for admission), 'after' inside it (the least: the safe side for cap evidence).
export function windowSpend(sessions: SpendSession[], windowStartMs: number, nowMs?: number, pauses: 'before' | 'after' = 'before'): number {
  return sum(sessions.map((s) => {
    if (s.startedAtMs >= windowStartMs) return s.costUsd;
    if (s.lastActiveAtMs <= windowStartMs) return 0; // first: a windowStartCostUsd left from an older window is moot
    if (s.windowStartCostUsd != null) return Math.min(s.costUsd, Math.max(0, s.costUsd - s.windowStartCostUsd));
    // ponytail: pro rata assumes an even burn over the active hours, and puts the paused hours at one end (before
    // the window start for admission, inside it for cap evidence) because where they fell is unknown —
    // windowStartCostUsd from the orchestrator gives the exact split.
    const active = activeHours(s, nowMs ?? s.lastActiveAtMs);
    const span = (s.lastActiveAtMs - s.startedAtMs) / H;
    // The paused hours that lie inside the active span (a pause still running lies after lastActiveAt).
    const pausedInSpan = span - active;
    const inside = (s.lastActiveAtMs - windowStartMs) / H - (pauses === 'after' ? pausedInSpan : 0);
    return active <= 0 ? (pauses === 'after' ? 0 : s.costUsd) : s.costUsd * Math.min(1, Math.max(0, inside) / active);
  }));
}

// recent.pausedHours: the session's pausedHours when the reading was taken (optional).
// recent.pausedDefaulted: pausedHours was missing and taken as 0.
export type RunningSession = SpendSession & { kind: string; phase?: string | null; recent?: { costUsd: number; atMs: number; pausedHours?: number; pausedDefaulted?: boolean } | null };
export type Remaining = { priorUsd: Range | null; burnUsdPerHour: number; projectedBurnUsdPerHour: number; remainingHours: number; remaining: Range; basis: 'prior' | 'burn' | 'floor' };

export function priorFor(kind: string, phase: string | null | undefined, priors: Readonly<Record<string, Prior>> = DEFAULT_PRIORS): Prior {
  return (phase ? own(priors, `${kind}:${phase}`) : undefined) ?? own(priors, kind) ?? own(priors, 'build') ?? DEFAULT_PRIORS.build;
}

// Working hours since the `recent` reading, or null when it cannot give a burn (under 5 minutes, or above the cost).
// With recent.pausedHours the pauses since the reading are taken out; without it, a paused session's interval ends
// at lastActiveAt.
function recentHours(s: RunningSession, nowMs: number): number | null {
  const r = s.recent;
  if (!r || r.costUsd > s.costUsd) return null;
  const plain = s.paused ? s.lastActiveAtMs - r.atMs : nowMs - r.atMs;
  let ms = r.pausedHours != null ? nowMs - r.atMs - Math.max(0, (s.pausedHours ?? 0) - r.pausedHours) * H : plain;
  // A defaulted recent.pausedHours takes every pause out only while that leaves 5 minutes of work; else the plain
  // interval (never the lifetime burn just because of the default).
  if (r.pausedDefaulted && ms < RECENT_MIN_AGE_MS) ms = plain;
  return ms >= RECENT_MIN_AGE_MS ? ms / H : null;
}
const recentUsable = (s: RunningSession, nowMs: number) => recentHours(s, nowMs) !== null;

function burnRate(s: RunningSession, nowMs: number): number {
  const rh = recentHours(s, nowMs);
  if (rh !== null) return (s.costUsd - s.recent!.costUsd) / rh;
  // ponytail: without a recent reading the burn is the lifetime average, which lags a session that just sped up or
  // went idle (and understates the orchestrator while it drives many sessions) — pass `recent` for every session.
  return s.costUsd / Math.max(MIN_ACTIVE_HOURS, activeHours(s, nowMs));
}

// Remaining cost of a running session, three times (low/point/high prior): max(prior − spent, burn × hours, floor).
// The high figure is widened by `safety`. Never 0: the floor is positive.
export function remainingCost(s: RunningSession, nowMs: number, resetsAtMs: number,
  priors: Readonly<Record<string, Prior>> = DEFAULT_PRIORS, safety: number = DEFAULT_CONFIG.safety,
  orchestratorLookaheadHours: number = DEFAULT_ORCHESTRATOR_LOOKAHEAD_HOURS): Remaining {
  const p = priorFor(s.kind, s.phase, priors);
  const burn = burnRate(s, nowMs);
  // Age is active age: idle and paused time does not move a session through its typical hours.
  const ageHours = activeHours(s, nowMs);
  const toReset = Math.max(0, (resetsAtMs - nowMs) / H);
  // The orchestrator runs until reset (looking ahead at most the lookahead); a session past its typical hours is
  // expected to need half as long again as its overrun so far (at least the tail); the reserve splits it at the reset.
  // ponytail: "half the overrun again" is a rule of thumb from one day of fix rounds — finished sessions' overruns
  // would calibrate it.
  const hours = p.typicalHours === null ? Math.min(toReset, orchestratorLookaheadHours)
    : ageHours <= p.typicalHours ? Math.max(p.typicalHours - ageHours, p.tailHours)
      : Math.max(p.tailHours, 0.5 * (ageHours - p.typicalHours));
  // ponytail: in its first minutes (10 for a lifetime average, 5 with a recent reading) a session below its low prior
  // is reserved at its prior, because a few minutes' average extrapolates startup bursts — a per-kind early-burn
  // profile would replace this.
  const burnCounts = p.low === null || s.costUsd >= p.low || ageHours >= (recentUsable(s, nowMs) ? RECENT_MIN_SESSION_AGE_H : LIFETIME_MIN_AGE_H);
  const byBurn = burnCounts ? burn * hours : 0;
  const one = (prior: number | null) => Math.max(prior === null ? 0 : prior - s.costUsd, byBurn, p.floorUsd);
  const pointPrior = p.point === null ? -Infinity : p.point - s.costUsd;
  const basis = pointPrior >= byBurn && pointPrior >= p.floorUsd ? 'prior' : byBurn >= p.floorUsd ? 'burn' : 'floor';
  const priorUsd = p.low === null || p.point === null || p.high === null ? null : { low: p.low, point: p.point, high: p.high };
  // The projection uses the session's observed burn; one too young for its burn to count is projected at no less
  // than its prior's average rate.
  // ponytail: a session's projected rate jumps from its prior's average to its observed burn at 10 minutes of age (5
  // with a recent reading) — a per-kind early-burn profile would make it continuous.
  const projectedBurnUsdPerHour = burnCounts || p.point === null || !p.typicalHours ? burn : Math.max(burn, p.point / p.typicalHours);
  return { priorUsd, burnUsdPerHour: burn, projectedBurnUsdPerHour, remainingHours: hours, remaining: { low: one(p.low), point: one(p.point), high: one(p.high) * safety }, basis };
}

// The part of a cost spread evenly over `hours` that falls before the reset (no clipping without a known reset).
// ponytail: the remaining cost is assumed to be spent evenly over the remaining hours — a per-kind cost profile over
// a session's life (fix rounds come late) would split it more accurately at the reset.
function inWindowPart(r: Range, hours: number | null, hoursToReset: number | null): Range {
  return hoursToReset === null || hours === null || hours <= 0 || hours <= hoursToReset ? r : scale(r, Math.max(0, hoursToReset) / hours);
}

// `own` marks the snapshot's own status reading: it ranks after every history reading at the same time.
export type Reading = { atMs: number; totalCostUsd: number; status: string | null; resetsAtMs: number; own?: boolean };
type CapOptions = { capUsd?: number | null; warnFraction: number; currentResetsAtMs: number };

const ref = (r: Reading): ReadingRef => ({ at: iso(r.atMs), spendUsd: cents(r.totalCostUsd), status: r.status ?? '', resetsAt: iso(r.resetsAtMs) });
const describe = (r: Reading) => `${r.status === 'rejected' ? 'a rejected' : 'the first allowed_warning'} reading at ${usd(r.totalCostUsd)} (${iso(r.atMs)})`;

// The cap as low/point/high: from config, else calibrated from the most recent window with a warning or rejected
// reading (a rejection in a newer window than the warning calibrates alone), checked against this window's readings.
// ponytail: the provider reports no percentage used, so the cap is inferred from the spend at which status first
// turned allowed_warning (and spend the orchestrator cannot see, like a person's own sessions, makes it low) — a
// percent-used or remaining-tokens figure from the provider would replace this estimate.
export function estimateCap(readings: Reading[], o: CapOptions, onIssue: (code: string, detail: string) => void = () => {}): Cap {
  // Readings at the same time: the snapshot's own last, the rest ordered allowed, allowed_warning, rejected, then by
  // spend, so input order never matters.
  const severity = (st: string | null) => (st === 'rejected' ? 3 : st === 'allowed_warning' ? 2 : st === 'allowed' ? 1 : 0);
  const sorted = readings.map((r) => ({ ...r })).sort((a, b) => a.atMs - b.atMs || Number(!!a.own) - Number(!!b.own)
    || severity(a.status) - severity(b.status) || a.totalCostUsd - b.totalCostUsd || a.resetsAtMs - b.resetsAtMs);
  const wf = o.warnFraction;
  const cur = o.currentResetsAtMs;
  let lowerBoundUsd = sorted.reduce((m, r) => (r.status === 'allowed' && r.resetsAtMs === cur ? Math.max(m, r.totalCostUsd / wf) : m), 0);
  if (o.capUsd != null) return { low: o.capUsd, point: o.capUsd, high: o.capUsd, source: 'config', known: true, lowerBoundUsd };
  const unknown: Cap = { low: null, point: null, high: null, source: 'unknown', known: false, lowerBoundUsd };

  const latestWindow = (status: string) => sorted.reduce((m, r) => (r.status === status && r.resetsAtMs > m ? r.resetsAtMs : m), -Infinity);
  const firstIn = (status: string, win: number) => sorted.find((r) => r.status === status && r.resetsAtMs === win);
  const allowedBefore = (x: Reading) => sorted.filter((r) => r.status === 'allowed' && r.resetsAtMs === x.resetsAtMs && r.atMs < x.atMs).pop();
  // A rejection followed in its window by a non-rejected reading at the same spend or more has cleared (the provider's
  // window rolls), so it no longer caps anything.
  // "Followed" is by sorted position, so the snapshot's own reading follows a history reading at the same second.
  const clearedRejections = sorted.filter((r, i) => r.status === 'rejected' && sorted.some((x, j) => x.resetsAtMs === r.resetsAtMs && j > i
    && (x.status === 'allowed' || x.status === 'allowed_warning') && x.totalCostUsd >= r.totalCostUsd - EPS));
  if (clearedRejections.length) {
    onIssue('rejection-cleared', `${clearedRejections.length} rejected reading(s) followed by allowed spend at or above them no longer cap the window`);
    for (const r of clearedRejections) r.status = null;
  }
  const wWin = latestWindow('allowed_warning'), rWin = latestWindow('rejected');
  const warning = rWin > wWin ? undefined : firstIn('allowed_warning', wWin);   // a newer rejection calibrates alone
  const rejected = wWin > rWin ? undefined : firstIn('rejected', rWin);         // an older window's rejection is stale
  if (!warning && !rejected) return unknown;

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
  // A rejection in the warning's window far below the high end the warning implies: warnFraction looks wrong.
  // ponytail: "far below" is 10% under the implied high, a guess at reading noise — the provider stating its warning
  // threshold would replace the check.
  if (warning && rejected && rejected.resetsAtMs === warning.resetsAtMs && rejected.totalCostUsd < 0.9 * (warning.totalCostUsd / wf) - EPS) {
    onIssue('warn-fraction-suspect', `the rejection at ${usd(rejected.totalCostUsd)} came well below the ${usd(warning.totalCostUsd / wf)} that the warning at ${usd(warning.totalCostUsd)} implies with warnFraction ${wf}; the implied fraction is about ${(warning.totalCostUsd / rejected.totalCostUsd).toFixed(2)} (set config.warnFraction)`);
  }
  let top = rejected && (!warning || rejected.totalCostUsd <= warning.totalCostUsd / wf) ? rejected : warning!;
  let rejectedUsed = rejected;
  const sourceWindow = (warning ?? rejected)!.resetsAtMs;
  // The highest spend a window saw without a rejection proves the cap is at least that much.
  const seenIn = (win: number) => sorted.filter((r) => r.resetsAtMs === win && (r.status === 'allowed' || r.status === 'allowed_warning'))
    .reduce<Reading | null>((m, r) => (!m || r.totalCostUsd > m.totalCostUsd ? r : m), null);

  // calHigh: the calibrated high before any raise. Every bound on the cap is measured against 10% above it, so
  // raises never compound and the order of windows never matters.
  let calHigh = high;
  // In the calibration's own window, spend more than 10% above calHigh disproves it, unless a later rejection there
  // (at or above that spend) caps it instead; a disproved calibration stays dropped in later windows.
  const srcSeen = seenIn(sourceWindow);
  if (srcSeen && srcSeen.totalCostUsd > CAP_RAISE_TOLERANCE * calHigh + EPS) {
    const at = sorted.indexOf(srcSeen);
    const later = sorted.find((r, i) => r.status === 'rejected' && r.resetsAtMs === sourceWindow && i > at && r.totalCostUsd >= srcSeen.totalCostUsd - EPS);
    if (!later) {
      onIssue('cap-disproved', `${usd(srcSeen.totalCostUsd)} was spent ${sourceWindow === cur ? 'this window' : 'in the window it was calibrated in'} without a rejection (${iso(srcSeen.atMs)}), more than 10% above the high end ${usd(high)} that ${describe(top)} gave; the cap is unknown until a new warning`);
      return { ...unknown, lowerBoundUsd: Math.max(lowerBoundUsd, srcSeen.totalCostUsd) };
    }
    const before = allowedBefore(later);
    high = calHigh = later.totalCostUsd;
    low = Math.min(high, Math.max(srcSeen.totalCostUsd, before ? before.totalCostUsd / wf : later.totalCostUsd));
    top = later;
    rejectedUsed = later;
    allowedLow = before;
  }

  // The bounds: the spend S seen in the calibration's window, and each later window held (this one included) with
  // its largest allowed A / warnFraction. (Later windows hold no warning or rejection, or one of them would be the
  // source, so their highest non-rejected spend is an allowed A ≤ A / warnFraction.)
  const laterWindows = [...new Set(sorted.filter((r) => r.resetsAtMs > sourceWindow && r.resetsAtMs <= cur).map((r) => r.resetsAtMs))].sort((a, b) => a - b);
  const bounds: { usd: number; where: string; later: boolean }[] = srcSeen
    ? [{ usd: srcSeen.totalCostUsd, where: `${usd(srcSeen.totalCostUsd)} spent ${sourceWindow === cur ? 'this window' : 'in the window it was calibrated in'} without a rejection`, later: false }] : [];
  for (const w of laterWindows) {
    const lb = sorted.reduce((m, r) => (r.status === 'allowed' && r.resetsAtMs === w ? Math.max(m, r.totalCostUsd / wf) : m), 0);
    if (lb > 0) bounds.push({ usd: lb, where: `${w === cur ? "this window's" : `the window to ${iso(w)}'s`} allowed readings (above ${usd(lb)})`, later: true });
  }
  const largest = bounds.reduce<(typeof bounds)[number] | null>((m, x) => (!m || x.usd > m.usd ? x : m), null);
  if (largest && largest.usd > CAP_RAISE_TOLERANCE * calHigh + EPS) {
    onIssue('cap-stale', `the cap calibrated in an older window (high ${usd(calHigh)}) is disproved by ${largest.where}, more than 10% above it; treated as unknown until a new warning`);
    return unknown;
  }
  // Within 10%: high goes to the largest bound (low and point stay a bracket); a rejection in the calibration's
  // window only ever lowers it.
  const raisedBy = largest && largest.usd > high + EPS ? largest : null;
  const topBefore = top;
  if (raisedBy) high = raisedBy.usd;
  const lowestRejection = sorted.filter((r) => r.status === 'rejected' && r.resetsAtMs === sourceWindow)
    .reduce<Reading | null>((m, r) => (!m || r.totalCostUsd < m.totalCostUsd ? r : m), null);
  if (lowestRejection && lowestRejection.totalCostUsd < high - EPS) {
    high = lowestRejection.totalCostUsd;
    top = rejectedUsed = lowestRejection;
  }
  // Reported only when the raise stands (a rejection may have put high back below the bound).
  if (raisedBy && high >= raisedBy.usd - EPS) {
    onIssue('cap-raised-high', `${raisedBy.where} put the cap up to 10% above the high end ${usd(calHigh)} that ${describe(topBefore)} gave; high raised to ${usd(raisedBy.usd)}`);
  }
  // Bounds at or below calHigh raise low (a later window's with an issue).
  const inside = (later: boolean) => maxOf(bounds.filter((x) => x.later === later && x.usd <= calHigh + EPS).map((x) => x.usd), 0);
  low = Math.max(low, inside(false));
  if (inside(true) > low + EPS) {
    onIssue('cap-raised', `allowed readings in later windows prove the cap is above ${usd(inside(true))}; the low end of the older calibration (${usd(low)}) is raised`);
    low = inside(true);
  }
  low = Math.min(low, high);
  // No separate current-window seen check: if cur is the source, the check above ran; otherwise cur holds only allowed
  // readings, so lowerBoundUsd ≥ seen and the later-window check and cap-raised cover it.
  const highBy = describe(top);
  if (lowerBoundUsd > high + EPS) {
    if (rejectedUsed && top === rejectedUsed) {
      onIssue('lower-bound-clamped', `allowed readings suggest the cap is above ${usd(lowerBoundUsd)}, but ${highBy} sets its high end at ${usd(high)}; lowerBoundUsd clamped`);
      lowerBoundUsd = high;
    } else {
      onIssue('lower-bound-above-cap', `allowed readings this window suggest the cap is above ${usd(lowerBoundUsd)}, more than the high end ${usd(high)} that ${highBy} gave (is warnFraction right?)`);
    }
  }
  if (low > 0 && high / low > BRACKET_WIDE) onIssue('cap-bracket-wide', `the calibrated cap is only known to lie between ${usd(low)} and ${usd(high)}; more frequent history readings narrow it`);
  return {
    low, point: (low + high) / 2, high, source: 'calibrated', known: true, lowerBoundUsd,
    calibratedFrom: { ...ref(top), ...(warning ? { warning: ref(warning) } : {}), ...(rejectedUsed ? { rejected: ref(rejectedUsed) } : {}), ...(allowedLow ? { allowedLow: ref(allowedLow) } : {}) },
  };
}

// --- Normalising the snapshot ----------------------------------------------------------------------------------

type Ctx = { issues: Issue[]; nowMs: number };
const warn = (c: Ctx, code: string, detail: string) => c.issues.push({ level: 'warn', code, detail });
const error = (c: Ctx, code: string, detail: string) => c.issues.push({ level: 'error', code, detail });
// A value for an issue text; never throws (BigInt and circular values are named by type).
function show(v: unknown): string {
  if (typeof v === 'number' && !Number.isFinite(v)) return String(v);
  try { return JSON.stringify(v) ?? 'missing'; } catch { return `a ${typeof v} value`; }
}

type Config = { capUsd: number | null; warnFraction: number; safety: number; admitAt: AdmitAt; admitCapEnd: CapEnd; orchestratorLookaheadHours: number; priors: Record<string, Prior> };
// startKnown / lastActiveKnown: the time was given and valid (not defaulted or clamped to now).
type Session = RunningSession & { id: string; kind: Kind; phase: string | null; priority: number; done: boolean; paused: boolean; startKnown: boolean; lastActiveKnown: boolean };
type QueueItem = { id: string; kind: Kind; phase: string | null; priority: number; estimate: Range };

// A money field: reported when it was a string (accepted) or invalid (error, counted as 0 / ignored).
function money(c: Ctx, v: unknown, where: string, code: string): number | undefined {
  const m = readMoney(v);
  if (m.kind === 'missing') return undefined;
  if (m.kind === 'bad') { error(c, code, `${where} ${show(v)} is not an amount in [0, ${MAX_USD}]`); return undefined; }
  if (m.kind === 'string') warn(c, 'string-number', `${where} ${show(v)} is a string; read as ${m.value}`);
  return m.value;
}

// `kind` may carry its phase ("build:small"); an unknown kind is treated as build.
function normKindPhase(c: Ctx, rawKind: unknown, rawPhase: unknown, where: string): { kind: Kind; phase: string | null } {
  let phase = typeof rawPhase === 'string' && rawPhase ? rawPhase : null;
  let k = rawKind;
  if (typeof k === 'string' && k.includes(':')) {
    const [head, ...rest] = k.split(':');
    const tail = rest.join(':');
    if (phase !== null && tail && phase !== tail) warn(c, 'kind-phase-conflict', `${where}: kind ${show(rawKind)} and phase ${show(rawPhase)} differ; phase used`);
    phase = phase ?? (tail || null);
    k = head;
  }
  if ((KINDS as readonly unknown[]).includes(k)) return { kind: k as Kind, phase };
  warn(c, 'unknown-kind', `${where}: kind ${show(rawKind)} treated as build`);
  return { kind: 'build', phase };
}

function normPriority(c: Ctx, v: unknown, where: string): number {
  if (v === undefined || v === null) return 0;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  warn(c, 'bad-priority', `${where}: priority ${show(v)} treated as 0`);
  return 0;
}

// A boolean flag; "true"/"false" strings are accepted with an issue, anything else gives `otherwise` (and an issue).
function normFlag(c: Ctx, v: unknown, where: string, code: string, otherwise: boolean, level: 'warn' | 'error' = 'warn'): boolean {
  if (v === true || v === false) return v;
  if (v === undefined || v === null) return false;
  if (v === 'true' || v === 'false') { warn(c, code, `${where} ${show(v)} is a string; read as ${v}`); return v === 'true'; }
  c.issues.push({ level, code, detail: `${where} ${show(v)} is not a boolean; read as ${otherwise}` });
  return otherwise;
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
  const cfg: Config = { capUsd: null, warnFraction: DEFAULT_CONFIG.warnFraction, safety: DEFAULT_CONFIG.safety, admitAt: DEFAULT_CONFIG.admitAt, admitCapEnd: DEFAULT_CONFIG.admitCapEnd,
    orchestratorLookaheadHours: DEFAULT_ORCHESTRATOR_LOOKAHEAD_HOURS, priors: { ...DEFAULT_PRIORS } };
  if (raw === undefined || raw === null) return cfg;
  if (!isObj(raw)) { warn(c, 'bad-config', 'config is not an object; defaults used'); return cfg; }
  if (raw.capUsd !== undefined && raw.capUsd !== null) {
    const m = readMoney(raw.capUsd);
    if (m.kind !== 'bad' && m.kind !== 'missing' && m.value > 0) {
      cfg.capUsd = m.value;
      if (m.kind === 'string') warn(c, 'string-number', `config.capUsd ${show(raw.capUsd)} is a string; read as ${m.value}`);
    } else error(c, 'bad-config', `config.capUsd ${show(raw.capUsd)} is not a positive amount up to ${MAX_USD}; cap estimated instead`);
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
  if (raw.admitAt !== undefined) {
    if (raw.admitAt === 'low' || raw.admitAt === 'point') cfg.admitAt = raw.admitAt;
    else warn(c, 'bad-config', `config.admitAt ${show(raw.admitAt)} is not "low" or "point"; "low" used`);
  }
  if (raw.admitCapEnd !== undefined) {
    if (raw.admitCapEnd === 'low' || raw.admitCapEnd === 'point' || raw.admitCapEnd === 'high') cfg.admitCapEnd = raw.admitCapEnd;
    else warn(c, 'bad-config', `config.admitCapEnd ${show(raw.admitCapEnd)} is not "low", "point" or "high"; "high" used`);
  }
  if (raw.orchestratorLookaheadHours !== undefined) {
    const h = raw.orchestratorLookaheadHours;
    if (isHours(h) && h > 0) cfg.orchestratorLookaheadHours = h;
    else warn(c, 'bad-config', `config.orchestratorLookaheadHours ${show(h)} is not a number of hours in (0, ${MAX_HOURS}]; ${DEFAULT_ORCHESTRATOR_LOOKAHEAD_HOURS} used`);
  }
  cfg.priors = normPriors(c, raw.priors);
  for (const k of Object.keys(raw)) if (!['capUsd', 'warnFraction', 'safety', 'admitAt', 'admitCapEnd', 'orchestratorLookaheadHours', 'priors'].includes(k)) warn(c, 'unknown-config', `config.${k} is not used`);
  return cfg;
}

// A time that may not be missing or in the future: clamped to now, with an issue (`known` false then).
function pastTime(c: Ctx, v: unknown, where: string, missingCode: string): { ms: number; known: boolean } {
  const ms = parseTime(v);
  if (ms === null) { warn(c, missingCode, `${where} missing or invalid; now used`); return { ms: c.nowMs, known: false }; }
  if (ms > c.nowMs) { warn(c, 'future-time', `${where} ${iso(ms)} is after now; clamped to now`); return { ms: c.nowMs, known: false }; }
  return { ms, known: true };
}

function normSession(c: Ctx, raw: unknown, i: number): (Session & { generatedId: boolean }) | null {
  if (!isObj(raw)) { warn(c, 'bad-session', `sessions[${i}] is not an object; ignored`); return null; }
  const generatedId = !(typeof raw.id === 'string' && raw.id);
  const id = generatedId ? `(missing id #${i})` : (raw.id as string);
  if (generatedId) warn(c, 'no-id', `sessions[${i}] has no id; called ${id}`);
  const where = `session ${id}`;
  const cost = money(c, raw.costUsd, `${where}: costUsd`, 'bad-cost');
  if (cost === undefined && (raw.costUsd === undefined || raw.costUsd === null)) warn(c, 'bad-cost', `${where}: costUsd missing; counted as 0`);
  const costUsd = cost ?? 0;
  const start = pastTime(c, raw.startedAt, `${where}: startedAt`, 'no-start');
  const last = pastTime(c, raw.lastActiveAt, `${where}: lastActiveAt`, 'no-last-active');
  const startedAtMs = start.ms;
  let lastActiveAtMs = last.ms;
  if (lastActiveAtMs < startedAtMs) {
    warn(c, 'active-before-start', `${where}: lastActiveAt is before startedAt; startedAt used`);
    lastActiveAtMs = startedAtMs;
  }
  let recent: Session['recent'] = null;
  if (raw.recent !== undefined && raw.recent !== null) {
    const at = isObj(raw.recent) ? parseTime(raw.recent.at) : null;
    const rc = isObj(raw.recent) ? money(c, raw.recent.costUsd, `${where}: recent.costUsd`, 'bad-recent') : undefined;
    if (rc !== undefined && at !== null && at <= c.nowMs && at >= startedAtMs) {
      if (rc <= costUsd) recent = { costUsd: rc, atMs: at };
      else warn(c, 'recent-above-cost', `${where}: recent reading ${usd(rc)} is above the cost ${usd(costUsd)}; lifetime burn used`);
    } else if (rc !== undefined || !isObj(raw.recent) || raw.recent.costUsd === undefined || raw.recent.costUsd === null) {
      warn(c, 'bad-recent', `${where}: recent reading unusable (needs costUsd and an at between startedAt and now); lifetime burn used`);
    }
  }
  const { kind, phase } = normKindPhase(c, raw.kind, raw.phase, where);
  let pausedHours = 0;
  if (raw.pausedHours !== undefined && raw.pausedHours !== null) {
    const since = (c.nowMs - startedAtMs) / H;
    if (!isHours(raw.pausedHours)) warn(c, 'bad-paused-hours', `${where}: pausedHours ${show(raw.pausedHours)} is not a number of hours; 0 used`);
    else if (raw.pausedHours > since + EPS) {
      warn(c, 'paused-hours-above-span', `${where}: pausedHours ${raw.pausedHours} is more than the ${cents(since)}h since it started; clamped`);
      pausedHours = since;
    } else pausedHours = raw.pausedHours;
  }
  if (recent && isObj(raw.recent) && raw.recent.pausedHours !== undefined && raw.recent.pausedHours !== null) {
    const rp = raw.recent.pausedHours;
    if (isHours(rp) && rp <= pausedHours + EPS) recent.pausedHours = rp;
    else warn(c, 'bad-recent', `${where}: recent.pausedHours ${show(rp)} is not hours up to the session's pausedHours; ignored`);
  }
  if (recent && recent.pausedHours === undefined && pausedHours > 0) {
    // Unknown when the pauses fell: all of them are taken out of the interval (a shorter interval, a higher burn).
    // ponytail: a reading taken after the resume is penalised too (often ignored as too short) — passing
    // recent.pausedHours with every reading removes the guess.
    warn(c, 'recent-no-paused-hours', `${where}: recent has no pausedHours while the session has paused ${pausedHours}h; all of it is taken out of the recent interval while 5 minutes of work remain, else the plain interval is used`);
    recent.pausedHours = 0;
    recent.pausedDefaulted = true;
  }
  let windowStartCostUsd: number | null = money(c, raw.windowStartCostUsd, `${where}: windowStartCostUsd`, 'bad-window-start-cost') ?? null;
  if (windowStartCostUsd !== null && windowStartCostUsd > costUsd + EPS) {
    warn(c, 'window-start-above-cost', `${where}: windowStartCostUsd ${usd(windowStartCostUsd)} is above the cost ${usd(costUsd)}; nothing counted in this window`);
    windowStartCostUsd = costUsd;
  }
  return {
    id, generatedId, kind, phase, priority: normPriority(c, raw.priority, where), costUsd, startedAtMs, lastActiveAtMs,
    done: normFlag(c, raw.done, `${where}: done`, 'bad-done', false), paused: normFlag(c, raw.paused, `${where}: paused`, 'bad-paused', false), recent, pausedHours,
    windowStartCostUsd, startKnown: start.known, lastActiveKnown: last.known && lastActiveAtMs === last.ms,
  };
}

// Of two readings of one session: a done one is final; else the larger cost, then the later activity, is the newer;
// fully tied, a paused one, then the higher priority, then the smaller JSON text wins, so input order never matters.
const newer = (a: Session, b: Session) =>
  a.done !== b.done ? a.done : a.costUsd !== b.costUsd ? a.costUsd > b.costUsd : a.lastActiveAtMs !== b.lastActiveAtMs ? a.lastActiveAtMs > b.lastActiveAtMs
    : a.paused !== b.paused ? a.paused : a.priority !== b.priority ? a.priority > b.priority : JSON.stringify(a) < JSON.stringify(b);

// Missing, null or empty sessions is an error (no brake): every reserve would be $0 and the orchestrator always lists
// itself, so the snapshot is almost certainly incomplete.
function normSessions(c: Ctx, raw: unknown): Session[] {
  if (raw === undefined || raw === null || (Array.isArray(raw) && raw.length === 0)) {
    error(c, 'no-sessions', `sessions is ${raw === undefined ? 'missing' : raw === null ? 'null' : 'empty'}: no running work is reserved (the orchestrator lists itself, so a snapshot without sessions is incomplete)`);
    return [];
  }
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
  const field = (name: string) => money(c, raw[name], `${where}: ${name}`, 'bad-estimate');
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
  if (raw === undefined || raw === null) { warn(c, 'no-queue', `queue is ${raw === undefined ? 'missing' : 'null'}; nothing to admit (pass [] for an empty queue)`); return []; }
  if (!Array.isArray(raw)) { warn(c, 'bad-queue', 'queue is not an array; none used'); return []; }
  const seen = new Set<string>();
  const out: QueueItem[] = [];
  raw.forEach((r, i) => {
    if (!isObj(r) || typeof r.id !== 'string' || !r.id) { warn(c, 'bad-queue-item', `queue[${i}] has no id; ignored`); return; }
    if (seen.has(r.id)) { warn(c, 'duplicate-queue', `queue item ${r.id} listed more than once; the first kept`); return; }
    seen.add(r.id);
    const where = `queue item ${r.id}`;
    const { kind, phase } = normKindPhase(c, r.kind, r.phase, where);
    out.push({ id: r.id, kind, phase, priority: normPriority(c, r.priority, where), estimate: normEstimate(c, r, kind, phase, priors, where) });
  });
  return out;
}

type Window = {
  type: string; durMs: number; resetsAtMs: number; spendFromMs: number;
  readAtMs: number;      // when the status was read (window.at), else now
  assumed: boolean;      // no usable resetsAt: an internal now + duration stands in, and is never printed
  bad: boolean;          // no usable resetsAt, or one more than a window ahead: brake 'bad-window'
  rolledOver: boolean; status: string | null; isUsingOverage: boolean;
};

// A status: one of the three, compared case-insensitively (a case difference is reported); anything else is null.
function normStatus(v: unknown): { status: string | null; recased: boolean } {
  if ((STATUSES as readonly unknown[]).includes(v)) return { status: v as string, recased: false };
  const lower = typeof v === 'string' ? v.trim().toLowerCase() : null;
  return lower !== null && (STATUSES as readonly string[]).includes(lower) ? { status: lower, recased: true } : { status: null, recased: false };
}

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
  const { status, recased } = normStatus(w.status);
  if (recased) warn(c, 'status-case', `window.status ${show(w.status)} read as ${status}`);
  const parsed = parseTime(w.resetsAt);
  let resetsAtMs = parsed === null ? null : seconds(parsed);
  if (resetsAtMs !== null && (resetsAtMs <= 0 || resetsAtMs < c.nowMs - RESETS_AT_MAX_AGE_MS)) {
    error(c, 'resets-at-implausible', `window.resetsAt ${iso(resetsAtMs)} is at or before 1970 or more than 30 days before now; treated as missing, nothing is admitted until it is known`);
    resetsAtMs = null;
  }
  const rolledOver = resetsAtMs !== null && resetsAtMs - durMs <= c.nowMs && c.nowMs >= resetsAtMs;
  // Fail safe: an unreadable overage flag counts as overage (a brake), unless the window rolled over (no effect then).
  const overage = normFlag(c, w.isUsingOverage, 'window.isUsingOverage', 'bad-overage', true, rolledOver ? 'warn' : 'error');
  // window.at: when this rate_limit_info was read; missing → now.
  let readAtMs = c.nowMs;
  if (w.at !== undefined && w.at !== null) {
    const at = parseTime(w.at);
    if (at === null || at > c.nowMs) warn(c, 'bad-window-at', `window.at ${show(w.at)} is not a time at or before now; now used`);
    else if (resetsAtMs !== null && at < resetsAtMs - durMs - windowTolerance(durMs)) warn(c, 'bad-window-at', `window.at ${iso(at)} is before the window it names starts; now used`);
    else readAtMs = at;
  }
  const base = { type, durMs, rolledOver: false, status, isUsingOverage: overage, readAtMs };

  if (resetsAtMs === null) {
    if (isW && parsed === null) error(c, 'no-resets-at', 'window.resetsAt missing or invalid; nothing is admitted until it is known');
    return { ...base, resetsAtMs: c.nowMs + durMs, spendFromMs: -Infinity, assumed: true, bad: true };
  }
  if (resetsAtMs - durMs > c.nowMs + windowTolerance(durMs)) {
    error(c, 'window-ahead', `window.resetsAt ${iso(resetsAtMs)} is more than one ${type} window after now; every session counted in full and nothing admitted`);
    return { ...base, resetsAtMs, spendFromMs: -Infinity, assumed: false, bad: true };
  }
  if (rolledOver) {
    if (status !== null || w.isUsingOverage === true || w.isUsingOverage === 'true' || w.status !== undefined) warn(c, 'stale-status', 'the window rolled over; the snapshot status and overage are from the old window and ignored');
    const next = windowOf(c.nowMs, resetsAtMs, durMs);
    return { ...base, resetsAtMs: next, spendFromMs: next - durMs, assumed: false, bad: false, rolledOver: true, status: 'allowed', isUsingOverage: false };
  }
  if (status === null) error(c, 'bad-status', `window.status ${show(w.status)} is not allowed / allowed_warning / rejected; treated as a brake`);
  return { ...base, resetsAtMs, spendFromMs: resetsAtMs - durMs, assumed: false, bad: false };
}

// History readings of this window type with a usable window. An entry's own resetsAt is used as is when it is
// consistent with its `at` and names this window or an earlier one that does not overlap it; without one, its
// window is inferred on this window's grid.
// Also returns the earliest own resetsAt the history holds for the current window (within the window-id tolerance of it), which the
// plan's historyEntry repeats so that every entry of one window carries one value.
function normHistory(c: Ctx, raw: unknown, win: Window): { readings: Reading[]; currentResetsAtMs: number | null } {
  if (raw === undefined || raw === null) return { readings: [], currentResetsAtMs: null };
  if (!Array.isArray(raw)) { warn(c, 'bad-history', 'history is not an array; none used'); return { readings: [], currentResetsAtMs: null }; }
  const pending: (Reading & { hasOwnReset: boolean })[] = [];
  let currentResetsAtMs: number | null = null;
  let bad = 0, badMoney = 0, strings = 0, noWindow = 0, otherType = 0, otherWindow = 0, quirks = 0;
  for (const r of raw) {
    if (!isObj(r)) { bad++; continue; }
    if (r.windowKnown !== undefined && r.windowKnown !== true && r.windowKnown !== false) quirks++;
    if (r.windowKnown === false || r.windowKnown === 'false' || (Object.hasOwn(r, 'resetsAt') && r.resetsAt === null)) {
      // Reported only while recent: older ones are left over from an earlier blind start (prune them).
      const at = parseTime(r.at);
      if (at !== null && at >= c.nowMs - win.durMs) noWindow++;
      continue;
    }
    if (r.type !== undefined && r.type !== win.type) { otherType++; continue; }
    const at = parseTime(r.at);
    const m = readMoney(r.totalCostUsd);
    if (at === null || at > c.nowMs || (m.kind !== 'ok' && m.kind !== 'string')) { m.kind === 'bad' ? badMoney++ : bad++; continue; }
    if (m.kind === 'string') strings++;
    let resetsAtMs: number;
    if (r.resetsAt !== undefined) {
      const ownParsed = parseTime(r.resetsAt);
      if (ownParsed === null) { bad++; continue; } // an unparseable resetsAt
      const ownReset = seconds(ownParsed);
      const tol = windowTolerance(win.durMs);
      // does not fit a window of this type around `at` (within the tolerance: an entry written in the last seconds
      // before a jittered reset keeps its window)
      if (!(ownReset - win.durMs - tol <= at && at < ownReset + tol)) { otherType++; continue; }
      resetsAtMs = ownReset; // raw: grouped and snapped below
    } else resetsAtMs = windowOf(at, win.resetsAtMs, win.durMs);
    const { status, recased } = normStatus(r.status);
    if (recased) quirks++;
    pending.push({ atMs: at, totalCostUsd: m.value, status, resetsAtMs, hasOwnReset: r.resetsAt !== undefined });
  }
  // Own resetsAt values that chain within the tolerance of each other (jitter) name one window (single linkage over
  // the sorted raw values); the group is that window of this window's grid when any member lies within the tolerance
  // of the grid (a whole number of windows away), else the earliest member.
  const tol = windowTolerance(win.durMs);
  const gridOf = (v: number) => win.resetsAtMs - win.durMs * Math.round((win.resetsAtMs - v) / win.durMs);
  const groups: number[][] = [];
  let prev = -Infinity;
  for (const v of [...new Set(pending.filter((x) => x.hasOwnReset).map((x) => x.resetsAtMs))].sort((a, b) => a - b)) {
    if (v - prev > tol) groups.push([]);
    groups[groups.length - 1].push(v);
    prev = v;
  }
  const canon = new Map<number, number>();
  for (const g of groups) {
    const near = g.map((v) => ({ v, d: Math.abs(v - gridOf(v)) })).filter((x) => x.d <= tol).sort((a, b) => a.d - b.d || a.v - b.v)[0];
    const name = near ? gridOf(near.v) : g[0];
    for (const v of g) canon.set(v, name);
    if (name === win.resetsAtMs) currentResetsAtMs = g[0];
  }
  const out: Reading[] = [];
  const seen = new Set<string>();
  for (const { hasOwnReset, ...x } of pending) {
    const resetsAtMs = hasOwnReset ? canon.get(x.resetsAtMs)! : x.resetsAtMs;
    const gap = resetsAtMs - win.resetsAtMs;
    if (hasOwnReset && (gap > 0 || (gap < 0 && -gap < win.durMs - tol))) { otherWindow++; continue; } // a newer window, or one overlapping this one
    // Identical entries (a stale status written again each tick) count once.
    const key = `${x.atMs}|${x.totalCostUsd}|${x.status}|${resetsAtMs}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ ...x, resetsAtMs });
  }
  if (bad || badMoney) c.issues.push({ level: badMoney ? 'error' : 'warn', code: 'bad-history', detail: `${bad + badMoney} history reading(s) without a valid at (not after now), totalCostUsd or resetsAt ignored` });
  if (strings) warn(c, 'string-number', `${strings} history totalCostUsd value(s) given as strings; read as numbers`);
  if (quirks) warn(c, 'history-quirk', `${quirks} history reading(s) with a windowKnown that is not a boolean or a status in another case; read leniently`);
  if (noWindow) warn(c, 'history-no-window', `${noWindow} history reading(s) written without a usable window ignored`);
  if (otherType) warn(c, 'history-other-type', `${otherType} history reading(s) of another window type than ${win.type} (or with a resetsAt that does not fit one) ignored`);
  if (otherWindow) warn(c, 'history-other-window', `${otherWindow} history reading(s) of a newer window, or one overlapping this one, ignored`);
  return { readings: out, currentResetsAtMs };
}

// --- Composing the plan ----------------------------------------------------------------------------------------

// A real rejected or overage status wins over a bad window, so its pause list is still built.
function chooseBrake(win: Window, nowOk: boolean): Brake {
  if (!nowOk) return 'unknown-status';
  if (win.status === 'rejected') return 'rejected';
  if (win.isUsingOverage) return 'overage';
  if (win.bad) return 'bad-window';
  if (win.status === null) return 'unknown-status';
  return 'none';
}

function reserveFor(running: Session[], win: Window, cfg: Config, nowMs: number, hoursToReset: number | null): SessionReserve[] {
  return running.map((s) => {
    const r = remainingCost(s, nowMs, win.resetsAtMs, cfg.priors, cfg.safety, cfg.orchestratorLookaheadHours);
    const inWindow = inWindowPart(r.remaining, r.remainingHours, hoursToReset);
    let carriesOverUsd = r.remaining.point - inWindow.point;
    // The orchestrator keeps running after the reset: what it will burn there, up to its lookahead (and at most one
    // window), counts against the next window.
    if (s.kind === 'orchestrator' && hoursToReset !== null) {
      carriesOverUsd += r.burnUsdPerHour * Math.max(0, Math.min(cfg.orchestratorLookaheadHours, win.durMs / H) - hoursToReset);
    }
    return { id: s.id, kind: s.kind, phase: s.phase, priority: s.priority, paused: s.paused, spentUsd: s.costUsd, priorUsd: r.priorUsd,
      burnUsdPerHour: r.burnUsdPerHour, projectedBurnUsdPerHour: r.projectedBurnUsdPerHour, remainingHours: r.remainingHours, remaining: r.remaining, inWindow,
      carriesOverUsd, basis: r.basis };
  });
}

const byPriority = <T extends { id: string; priority: number }>(a: T, b: T) => b.priority - a.priority || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

// What an item carries past the reset, at the end admission charges.
const carryOf = (item: Item, at: AdmitAt) => item.estimate[at] - item.inWindow[at];

// The one rule, twice: in priority order, admit while
//   this window:  spend + running in-window point + Σ admitted in-window low (or point, config.admitAt) ≤ cap high
//   next window:  running carry-over (point) + Σ admitted carry-over (same end) ≤ cap high
// and stop at the first item that fails either. Cap unknown → admit everything. Under a brake → nothing.
function admission(queue: Item[], runningIds: Set<string>, brake: Brake, cap: Cap, headroom: number | null, nextHeadroom: number | null, admitAt: AdmitAt, win: Window, c: Ctx,
  bootstrap = false, end: CapEnd = 'high') {
  const admit: Item[] = [];
  const queued: Plan['queued'] = [];
  // Under a status or window that cannot be read, re-plan every tick; under rejected/overage, the reset is the latest.
  const waitUntil = brake === 'unknown-status' || brake === 'bad-window' || win.bad ? null : iso(win.resetsAtMs);
  let left = headroom ?? Infinity;
  let nextLeft = nextHeadroom ?? Infinity;
  let stopper: string | null = null;
  for (const item of [...queue].sort(byPriority)) {
    const need = item.inWindow[admitAt];
    const carry = carryOf(item, admitAt);
    const est = admitAt === 'low' ? 'low estimate' : 'point estimate';
    if (runningIds.has(item.id)) {
      warn(c, 'queue-running', `queue item ${item.id} is already running; not admitted again`);
      queued.push({ ...item, reason: 'already running', reasonCode: 'already-running', nextAdmitAt: null });
    } else if (brake !== 'none' && bootstrap && !admit.length) {
      // Cold start: with no window, nothing running and no history there is no reading to plan from; one session
      // gets one.
      // ponytail: the bootstrap item is admitted without any cap check — a cap carried in config, or a reading from
      // the orchestrator's own session, avoids the blind start.
      warn(c, 'bootstrap', `no window, no running session and no history: ${item.id} is admitted alone to obtain a rate-limit reading`);
      admit.push(item);
    } else if (brake !== 'none') {
      const reason = bootstrap && admit.length ? `brake ${brake}: bootstrap: one item admitted to obtain a reading; the rest wait until it clears` : `brake ${brake}: nothing is admitted until it clears`;
      queued.push({ ...item, reason, reasonCode: 'brake', nextAdmitAt: waitUntil });
    } else if (stopper !== null) {
      queued.push({ ...item, reason: `behind ${stopper} (strict priority order)`, reasonCode: 'behind', nextAdmitAt: waitUntil });
    } else if (!cap.known || (need <= left + EPS && (carry <= EPS || carry <= nextLeft + EPS))) {
      admit.push(item);
      left -= need;
      nextLeft -= carry;
    } else if (need <= left + EPS) {
      stopper = item.id;
      queued.push({ ...item, reasonCode: 'over-next-window', nextAdmitAt: waitUntil,
        reason: `over 100% of the next window: the ${usd(carry)} of its ${est} that runs past the reset exceeds the ${usd(Math.max(0, nextLeft))} the next window has left after running work's carry-over` });
    } else {
      stopper = item.id;
      // ponytail: under the point projection a finish frees nothing (its remaining becomes spend), so a misfit waits
      // for the reset — the orchestrator re-plans each tick, and a session that ends under its estimate frees the
      // difference then; per-session finish distributions would let this predict an earlier time.
      const reason = left < 0
        ? `clearly over 100% of the cap: running work already exceeds the cap's ${end} end by ${usd(-left)}, so nothing fits before the reset`
        : `clearly over 100% of the cap: even its ${est} ${usd(need)} exceeds the ${usd(left)} left under the cap's ${end} end`;
      queued.push({ ...item, reason, reasonCode: 'over-cap', nextAdmitAt: waitUntil });
    }
  }
  return { admit, queued, stopper };
}

// The window-spend slope since the earliest reading of the last 2 hours (≥ 15 minutes old), for information only.
function historySlope(history: Reading[], spend: number, win: Window, nowMs: number): number | null {
  const r = history
    .filter((h) => h.resetsAtMs === win.resetsAtMs && h.atMs >= nowMs - SLOPE_LOOKBACK_MS && h.atMs <= nowMs - SLOPE_MIN_GAP_MS)
    .sort((a, b) => a.atMs - b.atMs || a.totalCostUsd - b.totalCostUsd)[0];
  const slope = r ? (spend - r.totalCostUsd) / ((nowMs - r.atMs) / H) : -1;
  return slope >= 0 ? slope : null;
}

function projectionOf(cap: Cap, spend: number, reserves: SessionReserve[], admit: Item[], burn: number, historyBurn: number | null,
  hoursToReset: number | null, nowMs: number, cfg: Config): Plan['projection'] {
  const running = (k: keyof Range) => sum(reserves.map((s) => s.inWindow[k]));
  const admitted = (k: keyof Range) => sum(admit.map((a) => a.inWindow[k]));
  const worst = spend + running('high') + admitted('high') * cfg.safety;
  const pointCase = spend + running('point') + admitted('point');
  const nextWindowCarryUsd = sum(reserves.map((s) => s.carriesOverUsd)) + sum(admit.map((a) => carryOf(a, 'point')));
  const raw = cap.known && burn > 0 ? Math.max(0, cap.high! - spend) / burn : null;
  const ttc = raw !== null && Number.isFinite(raw) ? raw : null;
  const risk = !cap.known ? 'unknown' : worst <= cap.low! + EPS ? 'none' : pointCase <= cap.high! + EPS ? 'possible' : 'likely';
  const notes: string[] = [];
  if (risk === 'likely' && cfg.admitAt === 'low' && admit.length) notes.push(`admitted at low estimates (config.admitAt "low"): at point estimates running and admitted work comes to ${usd(pointCase)}, ${usd(pointCase - cap.high!)} over the cap's high end; set config.admitAt to "point" to admit at point`);
  if (cap.known && nextWindowCarryUsd > cap.high! + EPS) notes.push(`next window: running and admitted work carries ${usd(nextWindowCarryUsd)} past the reset at point estimates, over the cap's high end ${usd(cap.high!)}${cfg.admitAt === 'low' && admit.length ? ' (admitted at low estimates)' : ''}`);
  const note = notes.length ? notes.join('; ') : null;
  return {
    burnUsdPerHour: burn, burnSource: 'sessions', historyBurnUsdPerHour: historyBurn,
    timeToCapHours: ttc, capHitAt: ttc === null ? null : iso(nowMs + ttc * H),
    capHitBeforeReset: cap.known ? ttc !== null && hoursToReset !== null && ttc < hoursToReset : null,
    runningProjectedSpendUsd: spend + running('point'),
    runningFits: cap.known ? spend + running('point') <= cap.high! + EPS : null,
    runningFitsWithSafety: cap.known ? spend + running('high') <= cap.low! + EPS : null,
    overshoot: { worstCaseSpendUsd: worst, vsCapLowUsd: cap.known ? worst - cap.low! : null, risk, note,
      nextWindowCarryUsd, nextWindowFits: cap.known ? nextWindowCarryUsd <= cap.high! + EPS : null },
  };
}

// Fill: what the window would leave unused at reset if everything goes to plan, and how many items of one kind
// that buys: limited by this window (each item's part before the reset) and by the next (its part after).
function fillOf(cap: Cap, spend: number, reserves: SessionReserve[], admit: Item[], brake: Brake, hoursToReset: number | null,
  priors: Record<string, Prior>, stopper: Item | null, headroom: number | null, bootstrap = false, queueEmpty = false, end: CapEnd = 'high'): Plan['fill'] {
  const none = { suggestions: [] as FillSuggestion[], suggestedKinds: [] as string[], blockedBy: null as string | null };
  if (bootstrap && queueEmpty) {
    // Cold start with nothing queued: one cheap item is what gets a reading.
    const review = priorFor('review', null, priors);
    return { suggestions: [{ kind: 'review', phase: null, inWindowUsd: review.point ?? 0, carriesOverUsd: 0, count: 1 }], suggestedKinds: ['review'], blockedBy: null,
      expectedUnusedUsd: null, recommendAdmitUsd: null, message: 'queue one item to obtain a rate-limit reading (cold start: no window, nothing running, no history)' };
  }
  const unused = cap.known ? cap.point! - spend - sum(reserves.map((s) => s.inWindow.point)) - sum(admit.map((a) => a.inWindow.point)) : null;
  if (brake !== 'none') {
    return { ...none, expectedUnusedUsd: unused, recommendAdmitUsd: 0,
      message: bootstrap && admit.length ? `brake ${brake}: bootstrap: one item admitted to obtain a reading; no more new work until it clears` : `brake ${brake}: no new work until it clears` };
  }
  if (unused === null) return { ...none, expectedUnusedUsd: null, recommendAdmitUsd: null, message: 'cap unknown: everything queued is admitted while status is allowed or allowed_warning; nothing to estimate yet' };
  if (stopper) {
    return { ...none, blockedBy: stopper.id, expectedUnusedUsd: unused, recommendAdmitUsd: 0,
      message: headroom !== null && headroom < -EPS
        ? `running work alone is over the cap's ${end} end; nothing queued fits before the reset (queue blocked at ${stopper.id})`
        : `queue blocked behind ${stopper.id} (priority ${stopper.priority}): new work only starts above its priority, or after splitting or lowering ${stopper.id}` };
  }
  if (unused <= EPS) return { ...none, expectedUnusedUsd: unused, recommendAdmitUsd: 0, message: 'no spare budget: running and admitted work is expected to use the whole cap' };
  const nextLeft = cap[end]! - sum(reserves.map((s) => s.carriesOverUsd)) - sum(admit.map((a) => carryOf(a, 'point')));
  const suggestions = Object.entries(priors)
    .filter(([key, p]) => !key.startsWith('orchestrator') && p.point !== null)
    .map(([key, p]) => {
      const [kind, ...rest] = key.split(':');
      const inWindowUsd = inWindowPart({ low: p.point!, point: p.point!, high: p.point! }, p.typicalHours, hoursToReset).point;
      const carry = p.point! - inWindowUsd;
      const byNow = inWindowUsd > 0 ? Math.floor(unused / inWindowUsd + EPS) : 0;
      const byNext = carry > EPS ? Math.floor(nextLeft / carry + EPS) : byNow;
      return { key, long: carry > EPS, s: { kind: kind as Kind, phase: rest.join(':') || null, inWindowUsd, carriesOverUsd: Math.max(0, carry), count: Math.min(byNow, byNext) } };
    })
    .filter((x) => x.s.count >= 1)
    .sort((a, b) => b.s.inWindowUsd - a.s.inWindowUsd || (a.key < b.key ? -1 : 1));
  const head = `~${usd(unused)} of budget will be unused at reset${hoursToReset === null ? '' : ` (in ${cents(hoursToReset)}h)`}; queue more work`;
  const long = suggestions.some((x) => x.long) ? '; items longer than the time to reset carry over, so only their part before the reset counts (short items finish)' : '';
  const list = suggestions.map((x) => `${x.key} ×${x.s.count} (${usd(x.s.inWindowUsd)} each${x.s.carriesOverUsd > EPS ? `; each carries ~${usd(x.s.carriesOverUsd)} past reset` : ''})`).join(', ');
  return {
    ...none, suggestions: suggestions.map((x) => ({ ...x.s, inWindowUsd: cents(x.s.inWindowUsd), carriesOverUsd: cents(x.s.carriesOverUsd) })), suggestedKinds: suggestions.map((x) => x.key),
    expectedUnusedUsd: unused, recommendAdmitUsd: suggestions.length ? unused : 0,
    message: suggestions.length ? `${head}${long}: any one of: ${list}; or any mix within ~${usd(unused)}` : `~${usd(unused)} of budget will be unused at reset, but none fits (every kind costs more than this window or the next has left)`,
  };
}

const progress = (s: Session, cfg: Config) => { const p = priorFor(s.kind, s.phase, cfg.priors).point; return p ? s.costUsd / p : 0; };

// Pause order under rejected/overage: lowest priority, then least progress (spent / point prior); never the
// orchestrator, never an already-paused session. With no brake, paused sessions are resumed one per tick: highest
// priority, then most progress (so nearly done work finishes); the next is the first that fits, both windows, with
// the work actually running. With nothing but the orchestrator running, the first is always resumed.
function pauseOf(brake: Brake, win: Window, running: Session[], reserves: SessionReserve[], spend: number, cap: Cap, cfg: Config,
  runningFits: boolean | null): { pause: Plan['pause']; resume: Plan['resume'] } {
  const stall = brake === 'rejected' || brake === 'overage';
  const recommend = !stall ? [] : running.filter((s) => s.kind !== 'orchestrator' && !s.paused)
    .sort((a, b) => a.priority - b.priority || progress(a, cfg) - progress(b, cfg) || (a.id < b.id ? -1 : 1)).map((s) => s.id);
  const ids = brake !== 'none' ? [] : running.filter((s) => s.paused && s.kind !== 'orchestrator')
    .sort((a, b) => b.priority - a.priority || progress(b, cfg) - progress(a, cfg) || (a.id < b.id ? -1 : 1)).map((s) => s.id);
  const active = reserves.filter((r) => !r.paused);
  const nothingRunning = !active.some((r) => r.kind !== 'orchestrator');
  const now = spend + sum(active.map((r) => r.inWindow.point));
  const next = sum(active.map((r) => r.carriesOverUsd));
  const fitsWith = (id: string, nowUsd: number, nextUsd: number) => {
    const r = reserves.find((x) => x.id === id)!;
    const capEnd = cap[cfg.admitCapEnd]!;
    return nowUsd + r.inWindow.point <= capEnd + EPS && (r.carriesOverUsd <= EPS || nextUsd + r.carriesOverUsd <= capEnd + EPS);
  };
  const fitting = !cap.known || nothingRunning ? ids : ids.filter((id) => fitsWith(id, now, next));
  const resumeNext = fitting[0] ?? null;
  // The paused sessions that fit together, greedily in order (with nothing else running, the first always).
  const all: string[] = [];
  let nowAll = now, nextAll = next;
  for (const id of fitting) {
    if (cap.known && !(nothingRunning && !all.length) && !fitsWith(id, nowAll, nextAll)) continue;
    const r = reserves.find((x) => x.id === id)!;
    all.push(id);
    nowAll += r.inWindow.point;
    nextAll += r.carriesOverUsd;
  }
  const until = win.status === 'rejected' && win.isUsingOverage ? 'status allowed or allowed_warning and isUsingOverage false'
    : brake === 'rejected' ? 'status allowed or allowed_warning' : 'isUsingOverage false';
  const rule = stall ? `pause the listed sessions in order, one per tick, until the brake is none (${until}); the orchestrator is never paused`
    : 'nothing to pause; the orchestrator is never paused';
  const reason = stall ? `status ${brake === 'rejected' ? 'rejected' : 'using overage'}: running sessions may stall`
    : runningFits === false ? 'running work is projected over the cap at point estimates (informational: nothing to pause until status is rejected or overage)'
      : null;
  return {
    pause: { stallRisk: stall || runningFits === false, reason, rule, needed: recommend.length > 0, next: recommend[0] ?? null, recommend },
    resume: { ids, next: resumeNext, fitting, all,
      rule: ids.length ? 'resume resume.all now (or next one per tick if you prefer): all is the paused sessions that fit together, next the first that fits alone, under the cap in both windows with the work actually running (with the cap unknown or nothing but the orchestrator running, the first always); resuming while running work is over the cap changes nothing in the plan, since paused reserves are already charged' : 'nothing to resume' },
  };
}

const firstThree = (ids: string[]) => `${ids.slice(0, 3).join(', ')}${ids.length > 3 ? ` +${ids.length - 3} more` : ''}`;
// "~HH:MMZ", with the date when it is not today (UTC).
const clock = (at: string, now: string) => `~${at.slice(0, 10) === now.slice(0, 10) ? '' : `${at.slice(0, 10)} `}${at.slice(11, 16)}Z`;

function summaryOf(p: Omit<Plan, 'summary'>, runningOverUsd: number | null): string {
  const capRange = p.cap.low === p.cap.high ? usd(p.cap.high!) : `${usd(p.cap.low!)}-${usd(p.cap.high!)}`;
  const capText = p.cap.known ? `cap ${capRange} (${p.cap.source})` : 'cap unknown';
  const money = `spend ${usd(p.spend.windowUsd)}, reserve ${usd(p.reserve.totalUsd)}, ${capText}`;
  if (p.brake !== 'none') {
    const until = (p.brake === 'rejected' || p.brake === 'overage') && p.window.resetsAt && p.historyEntry.windowKnown
      ? `until it clears or the reset ${clock(p.window.resetsAt, p.now)}` : 're-plan each tick until it clears';
    const r = p.pause.recommend;
    const then = r.slice(1);
    const pause = r.length ? `; pause ${r[0]} now${then.length ? ` (then ${then.slice(0, 2).join(', ')}${then.length > 2 ? ` +${then.length - 2} more` : ''})` : ''}` : '';
    const what = p.admit.length ? `bootstrap: admitting ${p.admit[0].id} alone to obtain a rate-limit reading` : 'admitting nothing';
    const ask = !p.admit.length && p.fill.suggestions.length && p.fill.recommendAdmitUsd === null ? '; queue one item to obtain a rate-limit reading' : '';
    return `Brake ${p.brake}: ${what}, ${p.queued.length} queued, ${until}; ${money}${pause}${ask}`;
  }
  const ids = p.admit.map((a) => a.id);
  const parts = [`Admit ${ids.length} of ${ids.length + p.queued.length} queued${ids.length ? ` (${firstThree(ids)})` : ''}`];
  if (p.resume.all.length) parts.push(`resume ${firstThree(p.resume.all)} now`);
  else if (p.resume.ids.length) parts.push(`holding ${p.resume.ids.length} paused`);
  parts.push(money, `overshoot ${p.projection.overshoot.risk}`);
  if (runningOverUsd !== null) parts.push(`running work over cap by ${usd(runningOverUsd)}`);
  if (p.projection.overshoot.nextWindowFits === false) parts.push('next window over cap');
  const unused = p.fill.recommendAdmitUsd ?? 0;
  const reached = p.cap.known && p.spend.windowUsd >= p.cap.high! - EPS;
  const hit = p.projection.capHitAt;
  // fill decides whether to queue more; the straight-line cap-hit time is information only.
  const hitText = !reached && p.projection.capHitBeforeReset && hit ? `cap hit ${clock(hit, p.now)} at current burn` : null;
  const queueMore = unused > 0 && !p.fill.blockedBy && !reached;
  if (reached) parts.push('cap reached');
  else if (hitText && !queueMore) parts.push(hitText);
  if (p.warning) parts.push('status allowed_warning (calibration only)');
  if (p.fill.blockedBy) parts.push(`blocked behind ${p.fill.blockedBy}`);
  else if (queueMore) parts.push(`~${usd(unused)} unused: queue more work${hitText ? ` (${hitText}, information only)` : ''}`);
  return parts.join('; ');
}

function rounded(p: Omit<Plan, 'summary'>): Omit<Plan, 'summary'> {
  const pr = p.projection;
  const c = (x: number | null) => (x === null ? null : cents(x));
  const item = <T extends Item>(a: T): T => ({ ...a, estimate: centsRange(a.estimate), inWindow: centsRange(a.inWindow) });
  return {
    ...p,
    window: { ...p.window, hoursToReset: c(p.window.hoursToReset) },
    cap: { ...p.cap, low: c(p.cap.low), point: c(p.cap.point), high: c(p.cap.high), lowerBoundUsd: cents(p.cap.lowerBoundUsd) },
    spend: { windowUsd: cents(p.spend.windowUsd) },
    reserve: { ...p.reserve, totalUsd: cents(p.reserve.totalUsd), lowUsd: cents(p.reserve.lowUsd), highUsd: cents(p.reserve.highUsd), carriesOverUsd: cents(p.reserve.carriesOverUsd),
      sessions: p.reserve.sessions.map((s) => ({ ...s, spentUsd: cents(s.spentUsd), burnUsdPerHour: cents(s.burnUsdPerHour), projectedBurnUsdPerHour: cents(s.projectedBurnUsdPerHour), remainingHours: cents(s.remainingHours),
        remaining: centsRange(s.remaining), inWindow: centsRange(s.inWindow), carriesOverUsd: cents(s.carriesOverUsd) })) },
    capacity: { ...p.capacity, headroomUsd: c(p.capacity.headroomUsd), nextWindowHeadroomUsd: c(p.capacity.nextWindowHeadroomUsd), admittedLowUsd: cents(p.capacity.admittedLowUsd), admittedPointUsd: cents(p.capacity.admittedPointUsd), admittedHighUsd: cents(p.capacity.admittedHighUsd) },
    admit: p.admit.map(item),
    queued: p.queued.map(item),
    projection: { ...pr, burnUsdPerHour: cents(pr.burnUsdPerHour), historyBurnUsdPerHour: c(pr.historyBurnUsdPerHour), timeToCapHours: c(pr.timeToCapHours), runningProjectedSpendUsd: cents(pr.runningProjectedSpendUsd),
      overshoot: { ...pr.overshoot, worstCaseSpendUsd: cents(pr.overshoot.worstCaseSpendUsd), vsCapLowUsd: c(pr.overshoot.vsCapLowUsd), nextWindowCarryUsd: cents(pr.overshoot.nextWindowCarryUsd) } },
    fill: { ...p.fill, expectedUnusedUsd: c(p.fill.expectedUnusedUsd), recommendAdmitUsd: c(p.fill.recommendAdmitUsd) },
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
  if (parsedNow === null) error(c, 'bad-now', snap.now === undefined || snap.now === null ? 'now is missing; nothing is admitted'
    : `now ${show(snap.now)} is not a time in the Date range; nothing is admitted`);

  const cfg = normConfig(c, snap.config);
  const win = normWindow(c, snap.window);
  const sessions = normSessions(c, snap.sessions);
  if (sessions.length && !sessions.some((s) => s.kind === 'orchestrator')) {
    warn(c, 'no-orchestrator', 'no session of kind orchestrator is listed; the orchestrator lists itself so its own spend and reserve count');
  }
  const { readings: history, currentResetsAtMs } = normHistory(c, snap.history, win);
  const nowMs = c.nowMs;
  const hoursToReset = win.assumed ? null : (win.resetsAtMs - nowMs) / H;
  const queue: Item[] = normQueue(c, snap.queue, cfg.priors).map((q) => ({
    ...q, inWindow: inWindowPart(q.estimate, priorFor(q.kind, q.phase, cfg.priors).typicalHours, hoursToReset),
  }));

  // ponytail: spend the orchestrator cannot see (a person's own sessions on the same account) is missing, so the
  // window's history readings are a floor on it — a provider-reported window total would replace both.
  // A windowStartCostUsd names the window the snapshot reported; after a rollover it is the old window's.
  const spendSessions = win.rolledOver ? sessions.map((s) => ({ ...s, windowStartCostUsd: null })) : sessions;
  // The window starts one length before its canonical reset: the earlier of the reported one and the earliest held for
  // it. A start up to the tolerance after now (an accepted jittered reset) counts from the tolerance before it, the
  // earliest the window can have started.
  let spendFromMs = win.spendFromMs;
  if (!win.bad && !win.rolledOver) {
    spendFromMs = Math.min(win.resetsAtMs, currentResetsAtMs ?? Infinity) - win.durMs;
    if (spendFromMs > nowMs) spendFromMs -= windowTolerance(win.durMs);
  }
  const fromSessions = windowSpend(spendSessions, spendFromMs, c.nowMs);
  const fromHistory = maxOf(history.filter((h) => h.resetsAtMs === win.resetsAtMs).map((h) => h.totalCostUsd), 0);
  if (fromHistory > fromSessions + 0.005) warn(c, 'history-above-spend', `history shows ${usd(fromHistory)} spent this window, more than the sessions' ${usd(fromSessions)}; the larger used`);
  const spend = Math.max(fromSessions, fromHistory);
  // Cap evidence (the snapshot's own reading, and the historyEntry that becomes a later reading) uses the spend the
  // sessions prove, with paused hours placed inside the window: an overstated reading would raise the calibrated cap
  // or disprove a right one. The two differ only for a session that spans the window start with paused hours and
  // no windowStartCostUsd.
  const provenSpend = Math.max(windowSpend(spendSessions, spendFromMs, c.nowMs, 'after'), fromHistory);

  // The snapshot's own status is a reading only for a usable window it was read in (not stale, not invented).
  const statusReading = !win.bad && !win.rolledOver ? win.status : null;
  // A status read more than a minute ago is paired with the spend at that time: this window's latest history entry
  // at or before it (at one time, the lower spend), else the proven spend of the sessions as they were then
  // (started by then, each cost pro-rated over its span to min(lastActiveAt, at)).
  // ponytail: the pro rata spreads each session's cost evenly over its span (pauses ignored) — appending every plan's
  // historyEntry gives a real entry to pair with.
  const stale = win.readAtMs < nowMs - STATUS_FRESH_MS;
  const heldThen = stale ? history.filter((h) => h.resetsAtMs === win.resetsAtMs && h.atMs <= win.readAtMs)
    .sort((a, b) => b.atMs - a.atMs || a.totalCostUsd - b.totalCostUsd)[0] : undefined;
  const at = win.readAtMs;
  const asThen = () => spendSessions.filter((s) => s.startedAtMs <= at).map((s) => {
    const end = Math.min(s.lastActiveAtMs, at);
    const share = s.lastActiveAtMs > s.startedAtMs ? (end - s.startedAtMs) / (s.lastActiveAtMs - s.startedAtMs) : 1;
    return { ...s, costUsd: s.costUsd * share, lastActiveAtMs: end, pausedHours: 0, paused: false };
  });
  // The entry's resetsAt repeats the earliest value held for this window while that is after the entry's time;
  // a stale reading's time is moved up to the window start (it may lie up to the tolerance before it), so every
  // entry is self-consistent.
  // A stale status is written once; once history holds it, later ticks write a spend-only entry (status null, now,
  // the proven spend) so history keeps a spend for every tick to pair later stale readings with.
  const staleRead = stale && !!statusReading;
  const heldAlready = staleRead && history.some((h) => h.atMs === Math.max(at, win.resetsAtMs - win.durMs) && h.status === statusReading && h.resetsAtMs === win.resetsAtMs);
  const staleEntry = staleRead && !heldAlready;
  const entryResetsAt = (t: number) => (currentResetsAtMs !== null && currentResetsAtMs > t ? currentResetsAtMs : win.resetsAtMs);
  const entryAt = staleEntry ? Math.max(at, entryResetsAt(at) - win.durMs) : nowMs;
  const readingSpend = !stale ? provenSpend : heldThen ? heldThen.totalCostUsd : windowSpend(asThen(), spendFromMs, at, 'after');
  const readings = statusReading ? [...history, { atMs: stale ? win.readAtMs : nowMs, totalCostUsd: readingSpend, status: statusReading, resetsAtMs: win.resetsAtMs, own: true }] : history;
  const cap = estimateCap(readings, { capUsd: cfg.capUsd, warnFraction: cfg.warnFraction, currentResetsAtMs: win.resetsAtMs }, (code, detail) => warn(c, code, detail));

  const running = sessions.filter((s) => !s.done);
  const reserves = reserveFor(running, win, cfg, nowMs, hoursToReset);
  const reserve = (k: keyof Range) => sum(reserves.map((s) => s.inWindow[k]));
  // Admission, resume and the next-window test compare against config.admitCapEnd (default high: the owner's rule).
  const capEnd = cap.known ? cap[cfg.admitCapEnd]! : null;
  const headroom = capEnd !== null ? capEnd - spend - reserve('point') : null;
  if (cap.known && headroom! < -EPS) {
    warn(c, 'running-over-cap', `running work is projected to ${usd(spend + reserve('point'))} at point estimates, ${usd(-headroom!)} over the cap's ${cfg.admitCapEnd} end ${usd(capEnd!)}`
      + (cap.source === 'calibrated' ? '; spend the orchestrator cannot see makes a calibrated cap come out low (the safe side)' : ''));
  }
  const nextHeadroom = capEnd !== null ? capEnd - sum(reserves.map((s) => s.carriesOverUsd)) : null;
  const brake = chooseBrake(win, parsedNow !== null);
  // Cold start: no window at all, no child session running (the orchestrator does not count) and no history entry
  // that holds a reading (entries written without a window, or without a status, do not).
  const reading = (h: unknown) => isObj(h) && h.windowKnown !== false && h.windowKnown !== 'false' && h.status != null && !(Object.hasOwn(h, 'resetsAt') && h.resetsAt === null);
  const bootstrap = brake === 'bad-window' && win.assumed && !running.some((s) => s.kind !== 'orchestrator')
    && !(Array.isArray(snap.history) && snap.history.some(reading));
  if (bootstrap) {
    for (const i of c.issues) i.detail = i.detail.replace('nothing is admitted until it is known', 'only one bootstrap item is admitted until it is known');
  }
  const { admit, queued, stopper } = admission(queue, new Set(running.map((s) => s.id)), brake, cap, headroom, nextHeadroom, cfg.admitAt, win, c, bootstrap, cfg.admitCapEnd);

  // The projected burn is the running (not paused) sessions' own; the history slope is reported beside it.
  const burn = sum(reserves.filter((s) => !s.paused).map((s) => s.projectedBurnUsdPerHour));
  const historyBurn = historySlope(history, provenSpend, win, nowMs);
  if (historyBurn !== null) {
    const [hi, lo] = historyBurn > burn ? [historyBurn, burn] : [burn, historyBurn];
    // Only times that were given count: a missing one defaults to now and would look like a fresh start or finish.
    const churn = sessions.some((s) => (s.startKnown && s.startedAtMs >= nowMs - MISMATCH_QUIET_MS) || (s.done && s.lastActiveKnown && s.lastActiveAtMs >= nowMs - MISMATCH_QUIET_MS));
    if (hi > 0 && hi > BURN_MISMATCH * lo && !churn) {
      warn(c, 'burn-mismatch', `history burn ${usd(historyBurn)}/h and the running sessions' projected ${usd(burn)}/h differ by over ${BURN_MISMATCH}x (information only: the projection uses the sessions' burn, paused sessions excluded; `
        + (historyBurn > burn ? 'sessions that just finished, or spend outside the listed sessions)' : 'lifetime averages overstate the current burn, or history readings are missing)'));
    }
  }
  const projection = projectionOf(cap, spend, reserves, admit, burn, historyBurn, hoursToReset, nowMs, cfg);
  const { pause, resume } = pauseOf(brake, win, running, reserves, spend, cap, cfg, projection.runningFits);
  const sumAdmit = (k: keyof Range) => sum(admit.map((a) => a.inWindow[k]));
  const body: Omit<Plan, 'summary'> = {
    version: 1, now: iso(nowMs)!, brake, warning: win.status === 'allowed_warning' && !win.bad && !win.rolledOver,
    window: { type: win.type, startAt: win.assumed ? null : iso(win.resetsAtMs - win.durMs), resetsAt: win.assumed ? null : iso(win.resetsAtMs), assumed: win.assumed,
      rolledOver: win.rolledOver, status: win.rolledOver ? null : win.status, statusAssumed: win.rolledOver ? 'allowed' : null, isUsingOverage: win.isUsingOverage, hoursToReset },
    cap,
    spend: { windowUsd: spend },
    reserve: { totalUsd: reserve('point'), lowUsd: reserve('low'), highUsd: reserve('high'), carriesOverUsd: sum(reserves.map((s) => s.carriesOverUsd)), safety: cfg.safety, sessions: reserves },
    capacity: { headroomUsd: headroom, nextWindowHeadroomUsd: nextHeadroom, admitAt: cfg.admitAt, admitCapEnd: cfg.admitCapEnd, admittedLowUsd: sumAdmit('low'), admittedPointUsd: sumAdmit('point'), admittedHighUsd: sumAdmit('high') },
    resume, admit, queued, projection,
    fill: fillOf(cap, spend, reserves, admit, brake, hoursToReset, cfg.priors, queue.find((q) => q.id === stopper) ?? null, headroom, bootstrap, queue.length === 0, cfg.admitCapEnd),
    pause,
    issues: c.issues,
    // A plan without a usable window writes no status or window, so it can never count or calibrate later. The
    // resetsAt repeats the earliest value held for this window while that is still after now (so the entry stays
    // self-consistent: at < resetsAt); otherwise the snapshot's own value, which the tolerance groups with it.
    // A stale status is written at the time it was read, with the spend it was paired with (repeats are identical
    // and count once).
    historyEntry: { at: iso(entryAt)!, totalCostUsd: cents(staleEntry ? readingSpend : provenSpend), status: win.bad || heldAlready ? null : statusReading, resetsAt: win.bad ? null : iso(entryResetsAt(entryAt)), type: win.type, windowKnown: !win.bad },
  };
  const out = finiteOnly(rounded(body), 'plan', c.issues);
  // Keep `summary` second in the printed JSON, after `version` and `now`.
  const { version, now, ...rest } = out;
  return { version, now, summary: summaryOf(out, cap.known && headroom! < -EPS ? -headroom! : null), ...rest };
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
    fail(`internal error while planning: ${(e as Error).message}`, [{ level: 'error', code: 'internal', detail: (e as Error).message }]);
  }
  const bad = p.issues.find((i) => i.code === 'bad-now');
  if (bad) fail(bad.detail, p.issues);
  process.stdout.write(JSON.stringify(p, null, 2) + '\n');
}
