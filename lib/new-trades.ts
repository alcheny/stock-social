// "New closed trades since your last visit" on the owner's profile. Pure; no sign-dependent logic:
// gains and losses are ordered and worded identically.
export type NewTradeInput = { sellId: string; symbol: string; returnPct: number; closedAt: Date };

export const TRADES_PROMPT_ACTIONS = ['dismissed', 'opened'] as const;
export type TradesPromptAction = (typeof TRADES_PROMPT_ACTIONS)[number];

export function newTradesSince(trades: NewTradeInput[], seenAt: Date | null, cap = 3): { shown: NewTradeInput[]; more: number } {
  if (seenAt === null) return { shown: [], more: 0 }; // first-ever visit: history is never new
  const fresh = trades
    .filter((t) => t.closedAt.getTime() > seenAt.getTime())
    .sort((a, b) => b.closedAt.getTime() - a.closedAt.getTime() || (a.sellId < b.sellId ? -1 : a.sellId > b.sellId ? 1 : 0));
  return { shown: fresh.slice(0, cap), more: Math.max(0, fresh.length - cap) };
}

export const moreText = (n: number): string | null => (n <= 0 ? null : `and ${n} more closed trade${n === 1 ? '' : 's'}`);
