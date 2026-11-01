// Pure payload for the trade permalink page and card. No sizes or prices exist here, and nothing varies by sign.
import { confidence, evidenceLine, isNewRecord, pct, rangeText, stats, type ConfidenceInput } from './trades.ts';
import { fitPx, layoutBand, STRIP_BAND, stripFigures, stripImageLines, type ImageLine, type Strip, type StripInput, stripTextAfterCount } from './record-strip.ts';
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
  filings?: { sold: string; bought: string[] } | null; // F-7: a public record's filing links
};

export const tradeStripInput = (t: TradeView): StripInput => ({
  ...t.strip, state: t.state, demo: t.demo, verified: t.verified, handle: t.handle, open: t.open,
  excludingOptions: t.excludingOptions, // OPTIONS
});

export const closedDay = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const heldFor = (d: number) => (d < 1 ? 'under a day' : `${Math.round(d)} day${Math.round(d) === 1 ? '' : 's'}`);

// The trade image's hero lines, drawn between the handle and the strip: symbol and return, held and closed, and the
// thesis (one line at the floor size, clipped at a word; the first line to give way). `symbolPx` and `heldPx` are the
// largest sizes tried for the symbol row and the held line (tradeBand lowers them until the band fits).
// The symbol row is 800-weight capitals and digits, wider than the band's 0.6 em average: it is sized at HERO_GLYPH em per
// glyph, so the return figure is never cut at the band's edge. When the row cannot fit at the floor size, the symbol and
// the return go on two lines, and the return keeps its own line whole.
export const HERO_GLYPH = 0.72;
const fitHeavy = (text: string, max: number) => Math.min(max, Math.floor(STRIP_BAND.width / (Math.max(text.length, 1) * HERO_GLYPH)));
const HERO_MAX_CHARS = Math.floor(STRIP_BAND.width / (STRIP_BAND.minPx * HERO_GLYPH));
export function tradeHero(t: Pick<TradeView, 'symbol' | 'returnPct' | 'holdingDays' | 'closedAt' | 'thesis'>, o: { symbolPx?: number; heldPx?: number } = {}): ImageLine[] {
  const symbolPx = o.symbolPx ?? 80, heldPx = o.heldPx ?? 30;
  const ret = pct(t.returnPct), top = `${t.symbol} ${ret}`;
  const L: ImageLine[] = [];
  if (fitHeavy(top, symbolPx) >= STRIP_BAND.minPx) L.push({ role: 'symbol', text: top, size: fitHeavy(top, symbolPx), tone: 'text', weight: 800 });
  else {
    // ponytail: a symbol over HERO_MAX_CHARS (31) characters is cut with an ellipsis on its own line (the return stays
    // whole below it) — wrap the symbol over two lines if such symbols ever reach closed_trades.
    const sym = t.symbol.length > HERO_MAX_CHARS ? `${t.symbol.slice(0, HERO_MAX_CHARS - 1)}…` : t.symbol;
    L.push({ role: 'symbol', text: sym, size: Math.max(STRIP_BAND.minPx, fitHeavy(sym, symbolPx)), tone: 'text', weight: 800 });
    L.push({ role: 'return', text: ret, size: Math.max(STRIP_BAND.minPx, fitHeavy(ret, symbolPx)), tone: 'text', weight: 800 });
  }
  const held = `held ${heldFor(t.holdingDays)}`, closed = `closed ${closedDay(t.closedAt)}`;
  const one = `${held} · ${closed}`;
  if (fitPx(one, heldPx) >= STRIP_BAND.minPx) L.push({ role: 'held', text: one, size: fitPx(one, heldPx), tone: 'muted', weight: 400 });
  else for (const [k, s] of [held, closed].entries()) L.push({ role: `held${k}`, text: s, size: Math.max(STRIP_BAND.minPx, fitPx(s, heldPx)), tone: 'muted', weight: 400 });
  if (t.thesis) L.push({ role: 'thesis', text: `“${clipTo(t.thesis, Math.floor(STRIP_BAND.width / (STRIP_BAND.minPx * STRIP_BAND.glyph)) - 2)}”`, size: STRIP_BAND.minPx, tone: 'text', weight: 400, optional: true });
  return L;
}

// The trade image's band (cycle-2 fix #9): the strip's lines around tradeHero, laid out by layoutBand. When they do not
// fit, the symbol row shrinks first (80 px down to 40), then the held line (30 px down to the 26 px floor), as monthBand
// does; the optional thesis gives way inside layoutBand before any of that matters. Returns the last try if none fits.
export function tradeBand(t: Pick<TradeView, 'symbol' | 'returnPct' | 'holdingDays' | 'closedAt' | 'thesis' | 'handle' | 'newRecord'>, strip: Strip): ReturnType<typeof layoutBand> {
  let last: ReturnType<typeof layoutBand> | null = null;
  for (const heldPx of [30, 28, STRIP_BAND.minPx]) for (let symbolPx = 80; symbolPx >= 40; symbolPx -= 8) {
    last = layoutBand(stripImageLines(strip, { handle: t.handle, newRecord: t.newRecord, hero: tradeHero(t, { symbolPx, heldPx }) }));
    if (last.fits && !last.tooWide.length) return last;
  }
  return last!;
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
