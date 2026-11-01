// Pure payload for the trade permalink page and card. No sizes or prices exist here, and nothing varies by sign.
import { confidence, evidenceLine, isNewRecord, pct, rangeText, stats, type ConfidenceInput } from './trades.ts';
import { fitPx, STRIP_BAND, stripFigures, type ImageLine, type Strip, type StripInput, stripTextAfterCount } from './record-strip.ts';
import { wholeRecordPreview, type RecordState } from './copy.ts';
import { DISCLAIMER } from './share.ts';

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
    // F-12: the record strip's figures (the profile's average and cardEvidence), over every closed trade of the trader.
    strip: stripFigures(i.allTrades, today),
  };
}

// What the trade page and image know about the trader once loaded (lib/trade-share-load.ts).
export type TradeView = ReturnType<typeof tradeSharePayload> & {
  handle: string; displayName: string; state: RecordState; verified: boolean;
  open?: number[]; // unrealized percents, read for a connected or failed record only
  excludingOptions?: boolean; // OPTIONS: the trader has option closes or exclusions (lib/options-load.ts#paneView)
};

export const tradeStripInput = (t: TradeView): StripInput => ({
  ...t.strip, state: t.state, demo: t.demo, verified: t.verified, handle: t.handle, open: t.open,
  excludingOptions: t.excludingOptions, // OPTIONS
});

export const closedDay = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const heldFor = (d: number) => (d < 1 ? 'under a day' : `${Math.round(d)} day${Math.round(d) === 1 ? '' : 's'}`);

// The trade image's hero lines, drawn between the handle and the strip: symbol and return, held and closed, and the
// thesis (one line at the floor size, clipped at a word; the first line to give way).
export function tradeHero(t: Pick<TradeView, 'symbol' | 'returnPct' | 'holdingDays' | 'closedAt' | 'thesis'>): ImageLine[] {
  const top = `${t.symbol} ${pct(t.returnPct)}`;
  // ponytail: a symbol over about 27 characters would pass the band's width even at the 26 px floor (the band clips it,
  // no wrap) — split the symbol and the return over two lines if such symbols ever reach closed_trades.
  const L: ImageLine[] = [{ role: 'symbol', text: top, size: Math.max(STRIP_BAND.minPx, fitPx(top, 80)), tone: 'text', weight: 800 }];
  const held = `held ${heldFor(t.holdingDays)}`, closed = `closed ${closedDay(t.closedAt)}`;
  const one = `${held} · ${closed}`;
  if (fitPx(one, 30) >= STRIP_BAND.minPx) L.push({ role: 'held', text: one, size: fitPx(one, 30), tone: 'muted', weight: 400 });
  else for (const [k, s] of [held, closed].entries()) L.push({ role: `held${k}`, text: s, size: Math.max(STRIP_BAND.minPx, fitPx(s, 30)), tone: 'muted', weight: 400 });
  if (t.thesis) L.push({ role: 'thesis', text: `“${clipTo(t.thesis, Math.floor(STRIP_BAND.width / (STRIP_BAND.minPx * STRIP_BAND.glyph)) - 2)}”`, size: STRIP_BAND.minPx, tone: 'text', weight: 400, optional: true });
  return L;
}
// At most `max` chars, cut at a word with an ellipsis when it was longer.
function clipTo(s: string, max: number): string {
  const t = s.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  return `${(cut.includes(' ') ? cut.replace(/\s+\S*$/, '') : cut).replace(/[\s,.;:]+$/, '')}…`;
}

// Image alt (generateMetadata, F-4 pattern): the trade, then the strip's facts in words.
export const tradeAlt = (t: TradeView, strip: Strip) => `Closed trade ${t.symbol} ${pct(t.returnPct)} by @${t.handle} on Stock Social. ${strip.alt}`;

// Link-preview description: the profile's record-state rule (wholeRecordPreview), the strip's figures as its stats,
// and the disclaimer whenever a figure is quoted (POLICY F3).
export function tradeDescription(t: TradeView, strip: Strip): string {
  const base = wholeRecordPreview({ state: t.state, demo: t.demo, verified: t.verified, trades: t.record.trades }, stripTextAfterCount(strip));
  return strip.importing ? base : `${base}. ${DISCLAIMER}`;
}
