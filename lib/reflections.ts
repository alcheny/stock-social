import { MIN_TRADES } from './insights.ts';
import { pct } from './trades.ts';

// Enum order is also the tie-break order for takeaway comparisons.
export const REASONS = ['planned', 'catalyst', 'tip', 'impulse', 'other'] as const;
export type Reason = (typeof REASONS)[number];
export const REASON_LABEL: Record<Reason, string> = {
  planned: 'Planned setup', catalyst: 'News/catalyst', tip: 'Tip from others', impulse: 'Impulse', other: 'Other',
};

export const isReason = (x: unknown): x is Reason => typeof x === 'string' && (REASONS as readonly string[]).includes(x);

export type ReasonGroup = {
  reason: Reason; n: number; enough: boolean; winRate: number | null; avgReturn: number | null; takeaway: string | null;
};

// Groups tagged trades by reason, in enum order, only reasons with n > 0.
// Tags whose sell_id has no matching trade are ignored here (the rows are kept in the DB, never deleted).
export function reflectionInsights(
  trades: { sellId: string; returnPct: number }[],
  reasons: Map<string, Reason> | Record<string, Reason>,
): ReasonGroup[] {
  const get = (id: string): Reason | undefined => (reasons instanceof Map ? reasons.get(id) : Object.hasOwn(reasons, id) ? reasons[id] : undefined);
  const by = new Map<Reason, number[]>();
  for (const t of trades) {
    const r = get(t.sellId);
    if (r) by.set(r, [...(by.get(r) ?? []), t.returnPct]);
  }
  const groups: ReasonGroup[] = REASONS.filter((r) => by.has(r)).map((reason) => {
    const xs = by.get(reason)!;
    const enough = xs.length >= MIN_TRADES;
    return {
      reason, n: xs.length, enough,
      winRate: enough ? xs.filter((x) => x > 0).length / xs.length : null,
      avgReturn: enough ? xs.reduce((a, b) => a + b, 0) / xs.length : null,
      takeaway: null,
    };
  });
  const ok = groups.filter((g) => g.enough);
  for (const g of ok) {
    // Highest n wins; `ok` is in enum order, so a strict > keeps the earlier reason on ties.
    let other: ReasonGroup | null = null;
    for (const o of ok) if (o !== g && (!other || o.n > other.n)) other = o;
    if (other) g.takeaway = `Trades tagged ${REASON_LABEL[g.reason]} averaged ${pct(g.avgReturn!)} vs ${pct(other.avgReturn!)} for ${REASON_LABEL[other.reason]}`;
  }
  return groups;
}

export type ReflectionCheck = { ok: true; reason: Reason | null; sellId: string } | { ok: false; error: string };

// Pure gate for the server action. One generic error for every rejection, so nothing leaks about other users' trades.
export function checkReflection(i: { userId: number | null; reason: unknown; sellId: unknown; owned: boolean }): ReflectionCheck {
  const no = { ok: false, error: 'Not allowed' } as const;
  if (i.userId === null || typeof i.sellId !== 'string' || !i.sellId || !i.owned) return no;
  if (i.reason === '' || i.reason === 'clear') return { ok: true, reason: null, sellId: i.sellId };
  if (!isReason(i.reason)) return no;
  return { ok: true, reason: i.reason, sellId: i.sellId };
}
