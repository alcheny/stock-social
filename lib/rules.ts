import { MIN_TRADES } from './insights.ts';
import { REASONS, REASON_LABEL, type Reason } from './reflections.ts';

export const RULE_KINDS = ['cut_losers', 'hold_winners'] as const;
export type RuleKind = (typeof RULE_KINDS)[number];
export type Rule = { kind: RuleKind; days: number };
export const RULE_LABEL: Record<RuleKind, string> = {
  cut_losers: 'Close losing trades within N days',
  hold_winners: 'Hold winning trades at least N days',
};
export const isRuleKind = (x: unknown): x is RuleKind => typeof x === 'string' && (RULE_KINDS as readonly string[]).includes(x);

export type RuleCheck = { ok: true; kind: RuleKind; days: number | null } | { ok: false; error: string };
const NO: RuleCheck = { ok: false, error: 'Not allowed' };

// days === null means "clear this rule".
export function checkRule(i: { userId: number | null; kind: unknown; days: unknown; clear?: boolean }): RuleCheck {
  if (i.userId === null || !isRuleKind(i.kind)) return NO;
  if (i.clear) return { ok: true, kind: i.kind, days: null };
  const d = i.days;
  const n = typeof d === 'string' ? (/^\d{1,3}$/.test(d) ? Number(d) : NaN) : typeof d === 'number' && Number.isInteger(d) ? d : NaN;
  if (!(n >= 1 && n <= 365)) return NO;
  return { ok: true, kind: i.kind, days: n };
}

export type RuleResult = {
  kind: RuleKind;
  days: number;
  applicable: number;
  followed: number;
  share: number | null;
  enough: boolean;
  takeaway: string | null;
};

export type T = { returnPct: number; holdingDays: number };

// Exactly N days counts as following the rule.
export function followsRule(kind: RuleKind, days: number, t: T): boolean {
  return kind === 'cut_losers' ? t.holdingDays <= days : t.holdingDays >= days;
}
export const applies = (kind: RuleKind, t: T) => (kind === 'cut_losers' ? t.returnPct < 0 : t.returnPct > 0);

export function ruleAdherence(trades: T[], rules: Rule[]): RuleResult[] {
  const byKind = new Map(rules.map((r) => [r.kind, r]));
  return RULE_KINDS.flatMap((kind) => {
    const rule = byKind.get(kind);
    if (!rule) return [];
    const loser = kind === 'cut_losers';
    const app = trades.filter((t) => applies(kind, t));
    const followed = app.filter((t) => followsRule(kind, rule.days, t)).length;
    const enough = app.length >= MIN_TRADES;
    const unit = rule.days === 1 ? 'day' : 'days';
    const takeaway = !enough ? null : loser
      ? `${followed} of ${app.length} losing trades were closed within ${rule.days} ${unit}`
      : `${followed} of ${app.length} winning trades were held at least ${rule.days} ${unit}`;
    return [{ kind, days: rule.days, applicable: app.length, followed, share: enough ? followed / app.length : null, enough, takeaway }];
  });
}

export type Side = { count: number; avgReturn: number | null };
export type RuleOutcome = {
  kind: RuleKind;
  days: number;
  applicable: number;
  followed: Side;
  notFollowed: Side;
  enough: boolean;
  takeaway: string | null;
};

// Signed one-decimal percent; a value that rounds to zero is always "+0.0%".
export function signedPct(n: number): string {
  const r = Math.round(n * 10) / 10;
  return `${r < 0 ? '-' : '+'}${Math.abs(r).toFixed(1)}%`;
}
export const tradesLabel = (n: number) => `${n} ${n === 1 ? 'trade' : 'trades'}`;

const side = (ts: T[]): Side => ({ count: ts.length, avgReturn: ts.length ? ts.reduce((s, t) => s + t.returnPct, 0) / ts.length : null });

export function ruleOutcomes(trades: T[], rules: Rule[]): RuleOutcome[] {
  const byKind = new Map(rules.map((r) => [r.kind, r]));
  return RULE_KINDS.flatMap((kind) => {
    const rule = byKind.get(kind);
    if (!rule) return [];
    const app = trades.filter((t) => applies(kind, t));
    const followed = side(app.filter((t) => followsRule(kind, rule.days, t)));
    const notFollowed = side(app.filter((t) => !followsRule(kind, rule.days, t)));
    const enough = followed.count >= MIN_TRADES && notFollowed.count >= MIN_TRADES;
    const unit = rule.days === 1 ? 'day' : 'days';
    const a = enough ? signedPct(followed.avgReturn!) : '';
    const b = enough ? signedPct(notFollowed.avgReturn!) : '';
    const takeaway = !enough ? null : kind === 'hold_winners'
      ? `Among your ${app.length} winning trades: held ${rule.days}+ ${unit} averaged ${a} (${tradesLabel(followed.count)}); held less averaged ${b} (${tradesLabel(notFollowed.count)}).`
      : `Among your ${app.length} losing trades: closed within ${rule.days} ${unit} averaged ${a} (${tradesLabel(followed.count)}); held longer averaged ${b} (${tradesLabel(notFollowed.count)}).`;
    return [{ kind, days: rule.days, applicable: app.length, followed, notFollowed, enough, takeaway }];
  });
}

export type TimedT = T & { closedAt: Date; sellId: string };
export const TREND_WINDOW = 10;
export type TrendSide = { count: number; followed: number; share: number | null };
export type RuleTrend = {
  kind: RuleKind;
  days: number;
  applicable: number; // every applicable trade, before the 20-trade cap
  latest: TrendSide; // newest up to 10 applicable trades
  earlier: TrendSide; // the next up to 10; older trades are ignored
  enough: boolean;
  direction: 'up' | 'down' | 'same' | null;
  takeaway: string | null;
};

const trendSide = (kind: RuleKind, days: number, ts: TimedT[]): TrendSide => {
  const followed = ts.filter((t) => followsRule(kind, days, t)).length;
  return { count: ts.length, followed, share: ts.length ? followed / ts.length : null };
};

// Newest first; ties on closedAt break by ascending sellId so the order is total.
const newestFirst = (a: TimedT, b: TimedT) =>
  b.closedAt.getTime() - a.closedAt.getTime() || (a.sellId < b.sellId ? -1 : a.sellId > b.sellId ? 1 : 0);

const VERB = { up: 'more often', down: 'less often', same: 'equally often' } as const;

export function ruleTrend(trades: TimedT[], rules: Rule[]): RuleTrend[] {
  const byKind = new Map(rules.map((r) => [r.kind, r]));
  return RULE_KINDS.flatMap((kind) => {
    const rule = byKind.get(kind);
    if (!rule) return [];
    const app = trades.filter((t) => applies(kind, t)).sort(newestFirst);
    const latest = trendSide(kind, rule.days, app.slice(0, TREND_WINDOW));
    const earlier = trendSide(kind, rule.days, app.slice(TREND_WINDOW, 2 * TREND_WINDOW));
    const enough = latest.count >= MIN_TRADES && earlier.count >= MIN_TRADES;
    let direction: RuleTrend['direction'] = null;
    let takeaway: string | null = null;
    if (enough) {
      // Exact fraction comparison, so 'same' means exactly equal shares.
      const l = latest.followed * earlier.count;
      const e = earlier.followed * latest.count;
      direction = l > e ? 'up' : l < e ? 'down' : 'same';
      takeaway = `Followed ${VERB[direction]}: on ${latest.followed} of your latest ${latest.count} applicable trades, versus ${earlier.followed} of the ${earlier.count} before.`;
    }
    return [{ kind, days: rule.days, applicable: app.length, latest, earlier, enough, direction, takeaway }];
  });
}

export type ReasonCell = { reason: Reason; applicable: number; followed: number; share: number | null; enough: boolean };
export type RuleByReason = {
  kind: RuleKind;
  days: number;
  applicable: number; // every trade the rule applies to
  tagged: number; // of those, trades with a known reason
  cells: ReasonCell[]; // enum order, only reasons with applicable trades
  enough: boolean; // at least two cells have enough trades
  takeaway: string | null;
};

export function rulesByReason(
  trades: (T & { sellId: string })[],
  rules: Rule[],
  reasons: Map<string, Reason> | Record<string, Reason>,
): RuleByReason[] {
  const get = (id: string): Reason | undefined => (reasons instanceof Map ? reasons.get(id) : Object.hasOwn(reasons, id) ? reasons[id] : undefined);
  const byKind = new Map(rules.map((r) => [r.kind, r]));
  return RULE_KINDS.flatMap((kind) => {
    const rule = byKind.get(kind);
    if (!rule) return [];
    const app = trades.filter((t) => applies(kind, t));
    const by = new Map<Reason, (T & { sellId: string })[]>();
    for (const t of app) {
      const r = get(t.sellId);
      if (r) by.set(r, [...(by.get(r) ?? []), t]);
    }
    const cells: ReasonCell[] = REASONS.filter((r) => by.has(r)).map((reason) => {
      const ts = by.get(reason)!;
      const followed = ts.filter((t) => followsRule(kind, rule.days, t)).length;
      const enough = ts.length >= MIN_TRADES;
      return { reason, applicable: ts.length, followed, share: enough ? followed / ts.length : null, enough };
    });
    const ok = cells.filter((c) => c.enough);
    let takeaway: string | null = null;
    if (ok.length >= 2) {
      // Highest counts win; the stable sort keeps enum order on ties. The sentence then reads in enum order.
      const pick = [...ok].sort((a, b) => b.applicable - a.applicable).slice(0, 2).sort((a, b) => REASONS.indexOf(a.reason) - REASONS.indexOf(b.reason));
      const part = (c: ReasonCell) => `${c.followed} of ${c.applicable} trades tagged ${REASON_LABEL[c.reason]}`;
      takeaway = `You kept the ${kind === 'cut_losers' ? 'cut-losers' : 'hold-winners'} rule on ${part(pick[0])} and ${part(pick[1])}.`;
    }
    return [{ kind, days: rule.days, applicable: app.length, tagged: cells.reduce((s, c) => s + c.applicable, 0), cells, enough: ok.length >= 2, takeaway }];
  });
}
