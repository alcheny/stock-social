// Pure payload for the trade permalink page and card. No sizes or prices exist here, and nothing varies by sign.
import { confidence, evidenceLine, isNewRecord, rangeText, stats, type ConfidenceInput } from './trades.ts';

export type TradeShareInput = {
  symbol: string; returnPct: number; holdingDays: number; closedAt: Date;
  thesis: string | null; thesisStatus: string | null; demo: boolean;
  allTrades: ConfidenceInput[]; // every closed trade of the trader, including this one
};

export function tradeSharePayload(i: TradeShareInput, today: Date) {
  const s = stats(i.allTrades.map((t) => ({ returnPct: t.returnPct, holdingDays: t.holdingDays, closedAt: t.closedAt })));
  const c = confidence(i.allTrades, today);
  return {
    symbol: i.symbol,
    returnPct: i.returnPct,
    holdingDays: i.holdingDays,
    closedAt: i.closedAt.toISOString(),
    thesis: i.thesisStatus === 'published' && i.thesis ? i.thesis : null,
    demo: i.demo,
    record: { trades: s.trades, winRate: s.winRate, avgReturn: s.avgReturn, evidence: evidenceLine(c), range: rangeText(c) },
    newRecord: isNewRecord(i.allTrades, i.allTrades.length, today),
  };
}
