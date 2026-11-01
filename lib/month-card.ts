// Pure layout model for the month recap share card (fix round 6, POLICY F3). The image draws exactly these lines, in
// this order, each on one line (no wrapping; ellipsis as a backstop), so the card's height is fixed by the font sizes
// and the disclaimer always fits. The label's size shrinks with its length so the longest month label stays on one line.
// F-12: the month image now draws lib/record-strip.ts's band (monthBand below); monthCard stays as the adapter its tests
// pin, with the record line in the strip's words and no win rate.
import { imageTrust, RECORD_STRIP, SHARE_CARD, type RecordState } from './copy.ts';
import { DISCLAIMER } from './share.ts';
import { pct } from './trades.ts';
import { count, count as fmtCount, counted } from './format.ts';
import { DISCLAIMER_LINES, DISCLAIMER_STEPS, fitDisclaimer, fitPx, layoutBand, recordStrip, STRIP_BAND, stripImageLines, type ImageLine, type Strip, type StripFigures } from './record-strip.ts';
// FIXES-LABELS (D-09, D-24): the F3 line at ≥ 28 px (lib/image-fit.ts); "1 of N months on record".
import { FIXES_LABELS } from './copy.ts';
import { MONTH_DISCLAIMER_SIZE } from './image-fit.ts';

export const MONTH_CARD = { width: 1200, height: 630, padding: 64, lineHeight: 1.2, glyph: 0.6, gap: 16 } as const;
const INNER_W = MONTH_CARD.width - 2 * MONTH_CARD.padding;

// `lines` (FIXES-LABELS): a line drawn as several one-line rows of `size` (the disclaimer); `text` stays the whole text.
export type CardLine = { role: 'who' | 'label' | 'of' | 'month' | 'picks' | 'record' | 'evidence' | 'note' | 'new' | 'disclaimer'; text: string; size: number; muted?: boolean; warn?: boolean; lines?: readonly string[] };
export type MonthCardInput = {
  handle: string; displayName: string; demo: boolean; verified: boolean; state: RecordState;
  months?: number; // FIXES-LABELS (D-24): distinct months on record (lib/recap.ts#monthsOnRecord)
  recap: { label: string; monthSoFar: boolean; count: number; showHeadline: boolean; winRate: number; avgReturn: number; best: { symbol: string; returnPct: number }; worst: { symbol: string; returnPct: number }; figures?: StripFigures };
  record: { trades: number; winRate: number; avgReturn: number; evidence: string; range: string | null; newRecord: boolean; strip?: StripFigures };
  open?: number[];
};

// Largest size (≤ 96) at which the text fits the card's width at an average glyph width of 0.6 em.
export const fitSize = (text: string, max = 96, width = INNER_W) => Math.min(max, Math.floor(width / (Math.max(text.length, 1) * MONTH_CARD.glyph)));

export function monthCard(r: MonthCardInput) {
  const { recap: m, record: w } = r;
  const trust = imageTrust('month', { state: r.state, demo: r.demo, verified: r.verified, empty: false });
  const who = { state: r.state, demo: r.demo, verified: r.verified, handle: r.handle };
  const label = `${m.label}${m.monthSoFar ? ' · month so far' : ''}`;
  // F-12: no win rate (D-24, F3b); the month's figures from the strip when the caller has them.
  const monthFigures = m.figures ? recordStrip({ ...m.figures, ...who }, 'figures').text : '';
  const month = [counted(m.count, 'closed trade'), monthFigures].filter(Boolean).join(' · ');
  const picks = m.count === 1 ? `Only trade: ${m.worst.symbol} ${pct(m.worst.returnPct)}` : `Worst: ${m.worst.symbol} ${pct(m.worst.returnPct)} · Best: ${m.best.symbol} ${pct(m.best.returnPct)}`;
  const top: CardLine[] = [
    { role: 'who', text: `${r.displayName} · @${r.handle}`, size: 32, muted: true },
    { role: 'label', text: label, size: fitSize(label, 64) }, // FIXES-LABELS: 64 (from 96) for the two-line F3 line
    ...(r.months ? [{ role: 'of' as const, text: FIXES_LABELS.monthOf(count(r.months)), size: 26, muted: true }] : []),
    { role: 'month', text: month, size: 36 },
    { role: 'picks', text: picks, size: 36 },
  ];
  const bottom: CardLine[] = [];
  // F-12: the record line is the strip's figures text (count, average with range or Too early, losses included, open).
  // Without the strip's inputs it names the count and "losses included" only, never a bare average (D22).
  const recordText = w.strip ? recordStrip({ ...w.strip, ...who, open: r.open }, 'page').text : `${counted(w.trades, 'closed trade')} · ${SHARE_CARD.lossesIncluded}`;
  if (trust.stats) bottom.push({ role: 'record', text: recordText, size: 36 }); // FIXES-LABELS (D-24): the month line's size
  // The incomplete line takes the evidence line's place, as on the profile card; otherwise the link's words.
  if (trust.note) bottom.push({ role: 'note', text: trust.note, size: 26, warn: trust.tone === 'warn', muted: trust.tone !== 'warn' });
  else bottom.push({ role: 'evidence', text: RECORD_STRIP.link(r.handle), size: 26, muted: true });
  if (trust.stats && w.newRecord) bottom.push({ role: 'new', text: 'New record', size: 26, muted: true });
  return { header: { label: trust.label, tone: trust.tone }, top, bottom, disclaimer: { role: 'disclaimer', text: DISCLAIMER, size: MONTH_DISCLAIMER_SIZE, muted: true, lines: [...DISCLAIMER_LINES] } as CardLine & { lines: string[] } };
}

// ---- F-12: the month image's band ----
// Hero lines between the handle and the strip: the month's label (52 px, down to 40 when space runs short), the month's
// count line, then its figures (average and range, or Too early) at 30 px (down to the 26 px floor). No win rate and no
// best or worst on the image (committee 2026-11-01; both stay on the page).
// FIXES-LABELS (D-24): `months`, "1 of N months on record" under the label (optional: it gives way first). FIXES-LABELS:
// status: `frozen`, a frozen record's line (lib/record-status.ts#imageFrozenText), in the strip after the record.
type MonthBandInput = { handle: string; recap: { label: string; monthSoFar: boolean; count: number }; record: { newRecord: boolean }; months?: number };
function monthHero(r: MonthBandInput, month: Strip, labelPx: number, figPx: number): ImageLine[] {
  const m = r.recap;
  const count = `${counted(m.count, 'closed trade')} this month${m.monthSoFar ? ' so far' : ''}`;
  const L: ImageLine[] = [
    { role: 'month', text: m.label, size: Math.max(STRIP_BAND.minPx, Math.min(labelPx, fitPx(m.label, 52))), tone: 'text', weight: 800 },
    ...(r.months ? [{ role: 'monthOf', text: FIXES_LABELS.monthOf(fmtCount(r.months)), size: STRIP_BAND.minPx, tone: 'muted', weight: 400, optional: true } satisfies ImageLine] : []),
    { role: 'monthCount', text: count, size: Math.max(STRIP_BAND.minPx, fitPx(count, figPx)), tone: 'text', weight: 400 },
  ];
  const get = (role: string) => month.figures.find((p) => p.role === role);
  const early = get('early'), avg = get('average'), range = get('range');
  if (early) L.push({ role: 'monthEarly', text: early.text, size: figPx, tone: 'text', weight: 700 });
  if (avg) L.push({ role: 'monthAverage', text: avg.text, size: Math.max(STRIP_BAND.minPx, fitPx(avg.text, figPx)), tone: avg.tone === 'up' || avg.tone === 'down' ? avg.tone : 'text', weight: 700 });
  if (range) {
    const withDot = `${range.text} · ${RECORD_STRIP.rangeLabel}`, bare = `${range.text} ${RECORD_STRIP.rangeLabel}`;
    const text = fitPx(withDot, figPx) >= STRIP_BAND.minPx ? withDot : bare;
    L.push({ role: 'monthRange', text, size: Math.max(STRIP_BAND.minPx, fitPx(text, figPx)), tone: 'text', weight: 400 });
  }
  return L;
}
export function monthBand(r: MonthBandInput, whole: Strip, month: Strip, frozen?: string | null): ReturnType<typeof layoutBand> {
  // FIXES-LABELS (D-09, F-11): what gives way, in order. Every line at a disclaimer of ≥ 28 px; then without "1 of N
  // months" (a frozen line outranks it); last, F-12's own rule (optional lines drop, the largest disclaimer that fits).
  // ponytail: beside a failed import's two note lines the frozen line gives way on the month image (the page shows it) — move the failed note to the label line to make room
  const steps28 = DISCLAIMER_STEPS.filter((x) => x >= 28);
  const tries = frozen && r.months ? [r, { ...r, months: undefined }] : [r];
  for (const input of tries) for (const px of steps28) { const b = monthBandAt(input, whole, month, frozen, px, true); if (b) return b; }
  return fitDisclaimer((px) => monthBandAt(r, whole, month, frozen, px, false)!);
}
// The F-12 search (figures 30 → 26 px, label 52 → 40 px) at one disclaimer size; `keepAll`: only a layout that drops no
// optional line counts (else null).
function monthBandAt(r: MonthBandInput, whole: Strip, month: Strip, frozen: string | null | undefined, disclaimerPx: number, keepAll: boolean): ReturnType<typeof layoutBand> | null {
  let last: ReturnType<typeof layoutBand> | null = null;
  for (const figPx of [30, 28, STRIP_BAND.minPx]) for (let labelPx = 52; labelPx >= 40; labelPx -= 4) {
    const ls = stripImageLines(whole, { handle: r.handle, newRecord: r.record.newRecord, hero: monthHero(r, month, labelPx, figPx), frozen, disclaimerPx });
    last = layoutBand(ls);
    if (last.fits && (!keepAll || last.lines.length === ls.length)) return last;
  }
  return keepAll ? null : last;
}

// Layout assertion behind the test: the card's stacked height (header, lines, rule, disclaimer) at the given line
// height, against the card's inner height; and every one-line text against the inner width.
export function monthCardFits(c: ReturnType<typeof monthCard>): { height: number; room: number; tooWide: string[] } {
  const lh = (s: number) => s * MONTH_CARD.lineHeight;
  const lines = [...c.top, ...c.bottom, c.disclaimer];
  // FIXES-LABELS: a multi-row line counts each row; each disclaimer row must fit the width too.
  const height = lh(36) + lines.reduce((h, l) => h + lh(l.size) * (l.lines?.length ?? 1), 0) + 2 + MONTH_CARD.gap;
  const tooWide = [
    ...lines.filter((l) => l.role === 'label' && l.text.length * l.size * MONTH_CARD.glyph > INNER_W).map((l) => l.text),
    ...(c.disclaimer.lines ?? []).filter((t) => t.length * c.disclaimer.size * MONTH_CARD.glyph > INNER_W),
  ];
  return { height, room: MONTH_CARD.height - 2 * MONTH_CARD.padding, tooWide };
}
