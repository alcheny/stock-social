// FIXES-LABELS (D-09 / D20 on images, plan §3): the share images' vertical budget as data. The trade and stock images
// read their font sizes from here, so lib/image-fit.test.ts checks what is drawn: every line stacked at its line height
// fits the card's inner height with every optional line present, and the F3 line is two lines of 28 px within the
// inner width. (The month card has its own model in lib/month-card.ts, with the same disclaimer lines.)
import { DISCLAIMER } from './share.ts';

export const IMAGE = { width: 1200, height: 630, padding: 64, lineHeight: 1.2, glyph: 0.6 } as const;
export const INNER_W = IMAGE.width - 2 * IMAGE.padding;
export const INNER_H = IMAGE.height - 2 * IMAGE.padding;

// ponytail: widths use a 0.6 em average glyph — measure with the image font's metrics
export const textWidth = (text: string, size: number) => text.length * size * IMAGE.glyph;

// Greedy word wrap at the 0.6 em average glyph: the rows a wrapping text box draws at `size` within `width`.
export function wrapLines(text: string, size: number, width = INNER_W): string[] {
  const rows: string[] = [];
  for (const w of text.split(' ')) {
    const last = rows[rows.length - 1];
    if (last !== undefined && textWidth(`${last} ${w}`, size) <= width) rows[rows.length - 1] = `${last} ${w}`;
    else rows.push(w);
  }
  return rows;
}

// The F3 line: the whole sentence pair (75 chars) is wider than 1072 px at these sizes, so the images draw
// {DISCLAIMER} in a wrapping box and budget its rows (two). The images never clip it to one line.
// DS-19 (design system council): ≥ 35 px. The trade and stock images take 35; the month card takes the largest size
// that fits its 502 px with every optional line (lib/month-card.ts).
// ponytail: the image font may wrap the line at another word than the 0.6 em model — measure with the font's metrics
export const DISCLAIMER_SIZE = 35;
// ponytail: DS-19 asks ≥ 35 px; the month card's line is 29 px (the largest that fits) because 35 overflows its 502 px with the frozen and new-record lines — drop a month-card line or move "Last close" to a state line as DS-19's band does
export const MONTH_DISCLAIMER_SIZE = 29;
export const disclaimerLines = (size: number): string[] => wrapLines(DISCLAIMER, size);
export const DISCLAIMER_LINES: readonly string[] = disclaimerLines(DISCLAIMER_SIZE);

export type LineSpec = { role: string; size: number; lineHeight?: number; fixed?: number };
export const lineHeights = (spec: LineSpec[]) => spec.reduce((h, l) => h + (l.fixed ?? l.size * (l.lineHeight ?? IMAGE.lineHeight)), 0);

const disclaimer = (): LineSpec[] => DISCLAIMER_LINES.map(() => ({ role: 'disclaimer', size: DISCLAIMER_SIZE }));
const RULE: LineSpec = { role: 'rule', size: 0, fixed: 2 + 16 }; // 2 px border, 16 px padding

// Trade image (app/u/[handle]/trade/[sellId]/opengraph-image.tsx). The thesis is the one block that gives way (shrinks
// to 0), so it is not in the budget. The symbol and the return share one row; the row is as tall as the return.
export const TRADE_IMAGE = { header: 36, who: 32, symbol: 96, ret: 136, held: 30, thesis: 34, record: 34, small: 26 } as const;
export function tradeImageLines(o: { stats: boolean; note: boolean; newRecord: boolean; frozen: boolean }): LineSpec[] {
  const t = TRADE_IMAGE;
  return [
    { role: 'header', size: t.header },
    { role: 'who', size: t.who },
    { role: 'hero', size: Math.max(t.ret, t.symbol * IMAGE.lineHeight), lineHeight: 1 },
    { role: 'held', size: t.held },
    RULE,
    ...(o.stats ? [{ role: 'record', size: t.record }] : []),
    ...(o.note ? [{ role: 'note', size: t.small }] : []),
    ...(o.stats && o.newRecord ? [{ role: 'new', size: t.small }] : []),
    ...(o.frozen ? [{ role: 'frozen', size: t.small }] : []),
    ...disclaimer(),
  ];
}

// Stock image (app/t/[symbol]/opengraph-image.tsx).
export const STOCK_IMAGE = { header: 36, symbol: 96, sub: 32, figure: 120, label: 28, evidence: 30 } as const;
export function stockImageLines(): LineSpec[] {
  const s = STOCK_IMAGE;
  return [
    { role: 'header', size: s.header },
    { role: 'symbol', size: s.symbol, lineHeight: 1 },
    { role: 'sub', size: s.sub },
    { role: 'figure', size: s.figure, lineHeight: 1 },
    { role: 'label', size: s.label },
    { role: 'evidence', size: s.evidence },
    ...disclaimer(),
  ];
}
