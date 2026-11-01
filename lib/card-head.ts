// FIXES-CYCLE4-PART2 (F4-15, C4-16): the record card's head row never clips the @handle. The unfurl draws the name,
// the handle and up to three pills (New record, "Excluding options", the trust label) on one row; with a long handle and
// the long Demo label the pills took the room and the handle was cut mid-word. This decides, from measured widths, which
// pills stay on the head row and which move to a second row under it (as the square and story layouts already split
// their head): first all on the head row; else "Excluding options" moves down; else every pill moves down. The handle
// is the card's one unique identity (F-4 user test, docs/features/F-4-share-card.md), so it always shows in full.
//
// Widths come from the advance widths of the one font next/og draws with (Geist Regular, bundled in
// next/dist/compiled/@vercel/og; lib/fixes-cycle4-part2.test.ts re-reads them from the font file, so a font change fails the
// test instead of clipping silently), per 1000 units of the em. A character outside the table counts a full em.
import { CARD_LAYOUT, type CardModel } from './record-card.ts';
import { OPTIONS } from './copy.ts';

export const GEIST_ADVANCE: Readonly<Record<string, number>> = {
  ' ': 250, '!': 213, '"': 346, '#': 478, '$': 629, '%': 802, '&': 620, "'": 178, '(': 274, ')': 274, '*': 430, '+': 558, ',': 201, '-': 419, '.': 201, '/': 480,
  '0': 663, '1': 384, '2': 619, '3': 613, '4': 615, '5': 626, '6': 593, '7': 524, '8': 604, '9': 593, ':': 297, ';': 297, '<': 544, '=': 540, '>': 544, '?': 559,
  '@': 906, A: 668, B: 680, C: 703, D: 694, E: 603, F: 590, G: 700, H: 713, I: 270, J: 597, K: 640, L: 580, M: 877, N: 743, O: 739,
  P: 650, Q: 733, R: 672, S: 640, T: 552, U: 689, V: 667, W: 945, X: 606, Y: 576, Z: 544, '[': 347, '\\': 455, ']': 347, '^': 426, _: 557,
  '`': 248, a: 551, b: 595, c: 546, d: 595, e: 561, f: 395, g: 594, h: 581, i: 244, j: 260, k: 590, l: 267, m: 877, n: 581, o: 573,
  p: 595, q: 595, r: 379, s: 520, t: 392, u: 575, v: 536, w: 819, x: 585, y: 537, z: 537, '{': 389, '|': 264, '}': 389, '~': 523,
  '…': 571, '✓': 600, '·': 201,
};
export const textWidth = (s: string, px: number): number => ([...s].reduce((w, c) => w + (GEIST_ADVANCE[c] ?? 1000), 0) * px) / 1000;

// The drawing's own numbers (app/u/[handle]/record-card-image.tsx): a pill's border and side padding, the gaps.
export const PILL_BORDER = 3, PILL_PAD_X = 16, PILL_GAP = 12, HEAD_GAP = 16, WHO_GAP = 16;
// Headroom on every measured width: kerning, the renderer's rounding and a bolder fallback never make a fit a clip.
export const HEAD_HEADROOM = 1.15;

export type HeadPill = 'newRecord' | 'options' | 'badge';
// `head`: on the head row beside the name (drawing order). `column`: rows of pills drawn at the top of the unfurl's chart
// column, the chart giving up HEAD_PILL_ROW per row, so the card's height never changes (tester round 1: a row under the
// head pushed the text column past 630 px). `second`: a row under the head, only when the trust badge can neither sit
// beside the handle nor fit the chart column (the long Demo image label with a long handle).
export type HeadRows = { head: HeadPill[]; column: HeadPill[][]; second: HeadPill[] };
// A pill's height on the unfurl (35 px text at line height 1, 2 px padding and a 3 px border each side) plus the gap.
// A literal (lib/record-card.ts imports this file, so nothing here reads CARD_LAYOUT at load); a test re-derives it.
export const HEAD_PILL_ROW = 51;

const pillWidth = (text: string, px: number) => textWidth(text, px) + 2 * (PILL_PAD_X + PILL_BORDER);
export const pillText = (p: HeadPill, m: Pick<CardModel, 'label'>) => (p === 'newRecord' ? 'New record' : p === 'options' ? OPTIONS.shareLabel : m.label);

/** The width the @handle needs on the head row: the handle in full, plus (with a display name) the gap and the name's
 *  ellipsis, the least the name can give way to. */
export function whoMinWidth(m: Pick<CardModel, 'kind' | 'name' | 'handle'>): number {
  const f = CARD_LAYOUT[m.kind].font;
  if (m.name === `@${m.handle}`) return textWidth(m.name, f.name);
  return textWidth(`@${m.handle}`, f.handle) + WHO_GAP + textWidth('\u2026', f.name);
}

type HeadInput = Pick<CardModel, 'kind' | 'name' | 'handle' | 'label' | 'newRecord' | 'shareLabel'>;
/** Which pills the unfurl's head row keeps (in drawing order), which go to the chart column (rows at most `colW` wide,
 *  the chart's own width), and which to a row under the head. */
export function unfurlHeadRows(m: HeadInput, colW: number = CARD_LAYOUT.unfurl.chart.w): HeadRows {
  const L = CARD_LAYOUT[m.kind];
  const all: HeadPill[] = [...(m.newRecord ? ['newRecord' as const] : []), ...(m.shareLabel ? ['options' as const] : []), 'badge'];
  const room = L.width - 2 * L.padX;
  const who = whoMinWidth(m) * HEAD_HEADROOM;
  const w = (p: HeadPill) => pillWidth(pillText(p, m), p === 'newRecord' ? L.font.newRecord : L.font.label) * HEAD_HEADROOM;
  const fits = (pills: HeadPill[]) => (pills.length ? who + HEAD_GAP + pills.reduce((a, p) => a + w(p), 0) + PILL_GAP * (pills.length - 1) : who) <= room;
  // Greedy rows of the moved pills within the chart column; null when one pill alone is wider than the column.
  const pack = (pills: HeadPill[]): HeadPill[][] | null => {
    const rows: HeadPill[][] = [];
    let used = 0;
    for (const p of pills) {
      if (w(p) > colW) return null;
      if (rows.length && used + PILL_GAP + w(p) <= colW) { rows[rows.length - 1].push(p); used += PILL_GAP + w(p); }
      else { rows.push([p]); used = w(p); }
    }
    return rows;
  };
  if (fits(all)) return { head: all, column: [], second: [] };
  // UX lead's order in the column too: the trust state first when it moves, then "Excluding options", then New record.
  for (const moved of [['options'], ['options', 'newRecord'], ['badge', 'options', 'newRecord']] as HeadPill[][]) {
    const move = moved.filter((p) => all.includes(p));
    if (!move.length) continue;
    const keep = all.filter((p) => !move.includes(p));
    const rows = pack(move);
    if (rows && fits(keep)) return { head: keep, column: rows, second: [] };
  }
  // UX lead: on the second row the trust state reads first, then "Excluding options", then New record.
  // ponytail: only the long Demo image label with a long handle lands here, and that row (with a wrap) still pushes the
  // unfurl's text column down, clipping its period line (no seeded Demo handle is that long) — fix: a shorter unfurl
  // Demo label, which is the owner's wording.
  const order: HeadPill[] = ['badge', 'options', 'newRecord'];
  return { head: [], column: [], second: order.filter((p) => all.includes(p)) };
}
