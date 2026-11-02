// F-10 / F-12: the one record strip. Every surface that shows a trader's record next to a single trade or month (the feed
// card, the trade and month pages, the trade and month images) builds it here, so the wording never drifts between
// surfaces (approval council 2026-11-01: never a second strip). Plan and committee: docs/features/logs/F-10/.
// Pure, except the bounded per-trader memo the feed uses (feedStrips).
import { cardEvidence, evidenceRangeText } from './record-card.ts';
import { headline, pct, type ConfidenceInput, type Tier } from './trades.ts';
import { zeroWidth } from './confidence.ts'; // F-33
import { imageLabel, isPublicRecord, PUBLIC, RECORD_BODY, RECORD_STRIP, SHARE_CARD, shareCardText, WHOLE_RECORD, type RecordState } from './copy.ts';
import { OPTIONS } from './copy.ts'; // OPTIONS
import { counted } from './format.ts';
import { DISCLAIMER } from './share.ts';
import { IMAGE_PALETTE } from './palette.ts';
import { DISCLAIMER_SIZE } from './image-fit.ts'; // FIXES-LABELS (D-09, DS-19)

export { RECORD_STRIP };


// ---- evidence: the only source ----
// Exactly the profile's call (app/u/[handle]/page.tsx: cardEvidence, then evidenceRangeText), so the strip's range and
// tier are the profile's for the same record (F-10 AC3).
export type StripEvidence = { n: number; k: number; tier: Tier; perTrade: { low: number; mid: number; high: number } | null };
export function stripEvidence(trades: ConfidenceInput[], now: Date): StripEvidence {
  const c = cardEvidence(trades, now);
  return { n: c.n, k: c.k, tier: c.tier, perTrade: c.perTrade };
}
// The figures a strip needs from a record: the average per trade (headline(), the profile's stats().avgReturn) and the
// evidence.
export type StripFigures = { avg: number; evidence: StripEvidence };
export const stripFigures = (trades: ConfidenceInput[], now: Date): StripFigures => ({ avg: trades.length ? headline(trades).avgReturn : 0, evidence: stripEvidence(trades, now) });

// ---- the feed's memo (committee round 3, engineer R3-1) ----
// One trader's figures per (row count, newest row id): a rebuild renumbers every row and a new close adds one, so the
// same key is the same rows. cardEvidence ignores `now` (confidence() reserves it), so the rows alone decide.
type FeedRow = ConfidenceInput & { id: string | number };
const memo = new Map<string, StripFigures>();
const MEMO_MAX = 20_000;
export function feedStrips(byUser: Map<number, FeedRow[]>, now: Date): Map<number, StripFigures> {
  const out = new Map<number, StripFigures>();
  for (const [userId, rows] of byUser) {
    let max = -Infinity;
    for (const r of rows) max = Math.max(max, Number(r.id));
    const key = `${userId}|${rows.length}|${max}`;
    let f = memo.get(key);
    if (!f) {
      f = stripFigures(rows, now);
      if (memo.size >= MEMO_MAX) memo.delete(memo.keys().next().value!);
      memo.set(key, f);
    }
    out.set(userId, f);
  }
  return out;
}
export const forgetFeedStrips = () => memo.clear();

// ---- the strip ----
export type StripInput = StripFigures & {
  state: RecordState; demo: boolean; verified: boolean; handle: string;
  open?: number[]; // unrealized percent per open position (F-6): only the count is shown
  // OPTIONS (docs/features/logs/options/plan.md D5, AC 24; legal round 3 demand 5): the trader has option closes or
  // exclusions (lib/options-load.ts#paneView's label, gated per trader). The strip's average leaves options out, so it
  // says so; no option figure is ever passed in or shown.
  excludingOptions?: boolean;
  // FIXES-CYCLE4-PART2 (F4-4, C4-9): the month's own figures ('figures' surface) of a trader with option closes end with
  // the same qualifier, so the month makes no claim over closes it leaves out (POLICY F3a).
  monthExcludingOptions?: boolean;
};
export type StripSurface = 'feed' | 'page' | 'figures' | 'image';
export type StripTone = 'up' | 'down' | 'warn' | 'ok' | 'muted' | null;
// sep: what goes before the part when the figures are read as one line.
export type StripPart = { role: 'count' | 'average' | 'early' | 'range' | 'rangeLabel' | 'losses' | 'open' | /* OPTIONS */ 'options'; text: string; tone: StripTone; sep: '' | ' ' | ' · ' };
export type Strip = {
  surface: StripSurface;
  label: { text: string; tone: StripTone } | null; // trust state (pages and images; the feed card has its badge)
  note: string | null; // the failed-import line
  importing: string | null; // while an import runs: this line instead of any figure
  figures: StripPart[];
  link: { text: string; href: string } | null;
  disclaimer: string | null;
  text: string; // the figures as one line
  alt: string; // the same facts in words, for image alt text and link previews
  tooEarly: boolean;
};

// Tone by the printed sign ("0.0%" is neither), so colour never disagrees with the text.
const toneOf = (x: number): StripTone => { const p = pct(x); return p.startsWith('+') ? 'up' : p.startsWith('-') || (p.startsWith('≈') && x < 0) ? 'down' : null; };
const words = (low: number, high: number) => `${RECORD_STRIP.rangeLabel} ${pct(low)} to ${pct(high)}`;

export function recordStrip(i: StripInput, surface: StripSurface): Strip {
  const full = surface === 'page' || surface === 'image';
  const t = shareCardText({ state: i.state, demo: i.demo, verified: i.verified, empty: i.evidence.n === 0 });
  const label = full && t.label ? { text: imageLabel(t.label)!, tone: (t.tone === 'warn' ? 'warn' : t.tone === 'ok' ? 'ok' : 'muted') as StripTone } : null;
  const importing = !i.demo && i.state === 'importing';
  const note = full && !i.demo && i.state === 'failed' ? RECORD_BODY.failed : surface === 'image' && isPublicRecord(i.state) ? PUBLIC.imageLine : null; // F-7: images carry the not-joined line
  // F-33 (OD 2.32): a zero-width range is too early as well, whichever path built the evidence.
  const tooEarly = i.evidence.tier === 'too-early' || !i.evidence.perTrade || zeroWidth(i.evidence.perTrade);
  const figures: StripPart[] = [];
  const altParts: string[] = [];
  if (!importing) {
    if (surface !== 'figures') {
      const count = counted(i.evidence.n, 'closed trade');
      figures.push({ role: 'count', text: count, tone: null, sep: '' });
      altParts.push(count);
    }
    const first = figures.length ? ' · ' : '';
    if (tooEarly) {
      figures.push({ role: 'early', text: RECORD_STRIP.early, tone: null, sep: first });
      altParts.push(RECORD_STRIP.early.toLowerCase());
    } else {
      const range = evidenceRangeText(i.evidence)!;
      figures.push({ role: 'average', text: `${pct(i.avg)} ${SHARE_CARD.perTrade}`, tone: toneOf(i.avg), sep: first });
      figures.push({ role: 'range', text: range, tone: null, sep: ' ' });
      // Every surface labels the range, the feed card too (user test 2026-11-01: a bare range under a big return reads as
      // the trader's lowest and highest trade).
      figures.push({ role: 'rangeLabel', text: RECORD_STRIP.rangeLabel, tone: null, sep: ' · ' });
      altParts.push(`${SHARE_CARD.perTrade} ${pct(i.avg)}, ${words(i.evidence.perTrade!.low, i.evidence.perTrade!.high)}`);
    }
    // OPTIONS (legal re-sign): the alt text says exactly "excluding options" right after the figures it qualifies.
    if (i.excludingOptions && surface !== 'figures') altParts.push(OPTIONS.altQualifier);
    if (full) {
      figures.push({ role: 'losses', text: SHARE_CARD.lossesIncluded, tone: null, sep: ' · ' });
      if (i.open?.length) figures.push({ role: 'open', text: SHARE_CARD.openShort(i.open.length), tone: null, sep: ' · ' });
    }
    // OPTIONS: the qualifier closes the record's figures (not the month's own figures: the record strip below them says it).
    if (i.excludingOptions && surface !== 'figures') figures.push({ role: 'options', text: OPTIONS.shareLabel, tone: null, sep: ' · ' });
    // FIXES-CYCLE4-PART2 (F4-4): the month's figures (legal-re-signed words, unchanged), Too early months too.
    if (i.monthExcludingOptions && surface === 'figures') {
      figures.push({ role: 'options', text: OPTIONS.shareLabel, tone: null, sep: ' · ' });
      altParts.push(OPTIONS.altQualifier);
    }
  }
  const text = figures.map((p) => p.sep + p.text).join('');
  const alt = [
    label?.text,
    note,
    importing ? `${SHARE_CARD.importingBody}. ${SHARE_CARD.importingNote.replace(/\.$/, '')}` : null,
    altParts.length ? altParts.join(', ') : null,
    !importing && full ? 'Losses included' : null,
    !importing && full && i.open?.length ? `${counted(i.open.length, 'open position')}, unrealized` : null,
    full ? DISCLAIMER.replace(/\.$/, '') : null,
  ].filter(Boolean).map((s) => `${s!.replace(/\.$/, '')}.`).join(' ');
  return {
    surface, label, note,
    importing: importing && surface !== 'feed' ? WHOLE_RECORD.importing : null,
    figures,
    link: full ? { text: RECORD_STRIP.link(i.handle), href: `/u/${i.handle}` } : null,
    disclaimer: full ? DISCLAIMER : null,
    text, alt, tooEarly,
  };
}

// ---- images: the anti-crop band (F-12, committee 2026-11-01) ----
// A 1200×630 image cropped to 1:1 keeps x 285–915; cropped to 1.91:1 it keeps y 1–629. Everything but the brand box is
// drawn inside the band, so a crop never cuts the strip, "losses included" or the disclaimer.
export const IMAGE = { width: 1200, height: 630, bg: IMAGE_PALETTE.stripBg } as const;
export const STRIP_BAND = { x: 309, width: 582, top: 24, bottom: 606, recordPx: 35, rangeMinPx: 30, minPx: 26, glyph: 0.6, lineHeight: 1.2 } as const;
export const SQUARE_CROP = { x0: 285, x1: 915 } as const;
export const BRAND_BOX = { x: 24, y: 24, width: 240, height: 40, text: 'Stock Social', size: 26 } as const;
export const IMAGE_COLOURS = IMAGE_PALETTE.strip; // F-20: the share-image colour table (lib/palette.ts)
export type ImageTone = keyof typeof IMAGE_COLOURS;
export type ImageLine = { role: string; text: string; size: number; tone: ImageTone; weight: 400 | 700 | 800; optional?: boolean; y?: number };

// Largest size ≤ max at which the text fits the band's width at 0.6 em per glyph.
export const fitPx = (text: string, max: number, width: number = STRIP_BAND.width) => Math.min(max, Math.floor(width / (Math.max(text.length, 1) * STRIP_BAND.glyph)));
export const lineWidth = (l: Pick<ImageLine, 'text' | 'size'>) => l.text.length * l.size * STRIP_BAND.glyph;

// The disclaimer in three lines at the floor size (one line at 26 px would be 1,000+ px wide).
export const DISCLAIMER_LINES = ['Not investment advice.', 'Past performance does not', 'guarantee future results.'] as const;
// FIXES-LABELS (D-09, DS-19: the F3 line ≥ 35 px on images): the band draws DISCLAIMER_LINES at lib/image-fit.ts's size, not
// the floor; its longest line (25 glyphs) is 525 px wide at 35 px, inside the 582 px band. Where the band's lines do not fit
// with it (a failed import's two note lines), the size steps down (DISCLAIMER_STEPS) before anything else gives way, and
// never below the floor the F-12 band was signed with.
// stripImageLines' default, DISCLAIMER_BAND_PX, is the largest size at which every trade image of the F-12 model fits once
// its thesis gives way (lib/f12-strip.test.ts); lib/trade-share.ts#tradeBand and lib/month-card.ts#monthBand try the
// larger steps first.
// ponytail: a failed import's month image fits at 27 px because of its two note lines — move the failed note to the label line to keep ≥ 28 px
export const DISCLAIMER_PX: number = DISCLAIMER_SIZE;
export const DISCLAIMER_BAND_PX = 30;
export const DISCLAIMER_STEPS: readonly number[] = [DISCLAIMER_PX, 32, DISCLAIMER_BAND_PX, 28, 27, STRIP_BAND.minPx];
export const disclaimerImageLines = (px: number = DISCLAIMER_PX): ImageLine[] =>
  DISCLAIMER_LINES.map((d, k) => ({ role: `disclaimer${k}`, text: d, size: px, tone: 'muted', weight: 400 }));
// The first layout, largest disclaimer first, that fits the band (else the floor's).
export function fitDisclaimer(build: (px: number) => ReturnType<typeof layoutBand>): ReturnType<typeof layoutBand> {
  let last: ReturnType<typeof layoutBand> | null = null;
  for (const px of DISCLAIMER_STEPS) { last = build(px); if (last.fits) return last; }
  return last!;
}

const imageTone = (t: StripTone): ImageTone => (t === 'up' || t === 'down' || t === 'warn' || t === 'ok' || t === 'muted' ? t : 'text');

// The strip's lines for an image: label, handle (· New record), the record lines at 35 px, losses (· open), the
// failed note, the disclaimer. `hero` (the trade or month lines) goes between the handle and the record.
// `frozen` (FIXES-LABELS: status, F-11): a frozen record's line ("Disconnected ‹Mon D, YYYY› · record frozen", absolute,
// never relative), after the record's figures.
export function stripImageLines(s: Strip, o: { handle: string; newRecord: boolean; hero: ImageLine[]; frozen?: string | null; disclaimerPx?: number }): ImageLine[] {
  const L: ImageLine[] = [];
  if (s.label) L.push({ role: 'label', text: s.label.text, size: 28, tone: imageTone(s.label.tone), weight: 700 });
  L.push(...o.hero);
  // Which figures are the trader's record (user test 2026-11-01: a month's own average stacked on the record's read as two
  // answers): the record's name, as on the page, right above them.
  // "New record" stays on the profile and the record card (design system council #48 §2.4), not on these images.
  void o.newRecord;
  L.push({ role: 'handle', text: RECORD_STRIP.link(o.handle), size: 28, tone: 'muted', weight: 400 });
  if (s.importing) {
    L.push({ role: 'importing', text: SHARE_CARD.importingBody, size: STRIP_BAND.recordPx, tone: 'text', weight: 700 });
    for (const [k, part] of noteLines(SHARE_CARD.importingNote).entries()) L.push({ role: `importingNote${k}`, text: part, size: STRIP_BAND.minPx, tone: 'muted', weight: 400 });
  } else {
    const get = (r: StripPart['role']) => s.figures.find((p) => p.role === r);
    const count = get('count'), avg = get('average'), range = get('range'), early = get('early');
    if (count) L.push({ role: 'count', text: count.text, size: STRIP_BAND.recordPx, tone: 'text', weight: 700 });
    if (early) L.push({ role: 'early', text: early.text, size: STRIP_BAND.recordPx, tone: 'text', weight: 700 });
    if (avg) L.push({ role: 'average', text: avg.text, size: STRIP_BAND.recordPx, tone: imageTone(avg.tone), weight: 700 });
    if (range) {
      // The profile's "(low to high) · 95% range" when it fits at ≥ 30 px; else without the "· " (committee round 3).
      const withDot = `${range.text} · ${RECORD_STRIP.rangeLabel}`, bare = `${range.text} ${RECORD_STRIP.rangeLabel}`;
      const text = fitPx(withDot, STRIP_BAND.recordPx) >= STRIP_BAND.rangeMinPx ? withDot : bare;
      // ponytail: a return of five digits before the point would push the bare line under 30 px — fitPx keeps it on
      // one line down to the 26 px floor; split the range over two lines if records ever reach that.
      L.push({ role: 'range', text, size: Math.max(STRIP_BAND.minPx, fitPx(text, STRIP_BAND.recordPx)), tone: 'text', weight: 400 });
    }
    const tail = s.figures.filter((p) => p.role === 'losses' || p.role === 'open').map((p) => p.text).join(' · ');
    if (tail) L.push({ role: 'losses', text: tail, size: Math.max(STRIP_BAND.minPx, fitPx(tail, 30)), tone: 'muted', weight: 400 });
    // OPTIONS: "Excluding options" on its own line under the record's figures, inside the band; when that line would not
    // fit the band (a failed import's note and open positions), it joins the count line instead ("12 closed trades ·
    // Excluding options", drawn smaller to fit the width). Never dropped.
    const options = get('options');
    if (options) {
      const own: ImageLine = { role: 'options', text: options.text, size: Math.max(STRIP_BAND.minPx, fitPx(options.text, 30)), tone: 'muted', weight: 400 };
      const rest: ImageLine[] = [];
      if (s.note) for (const [k, part] of noteLines(s.note).entries()) rest.push({ role: `note${k}`, text: part, size: STRIP_BAND.minPx, tone: 'warn', weight: 400 });
      // Merge with OPTIONS: the probe uses the disclaimer size this call draws (FIXES-LABELS D-09), not the floor.
      rest.push(...disclaimerImageLines(o.disclaimerPx ?? DISCLAIMER_BAND_PX));
      const k = L.findIndex((l) => l.role === 'count');
      if (layoutBand([...L, own, ...rest]).fits || k < 0) L.push(own);
      else { const text = `${L[k].text} · ${options.text}`; L[k] = { ...L[k], text, size: Math.max(STRIP_BAND.minPx, fitPx(text, STRIP_BAND.recordPx)) }; }
    }
  }
  // FIXES-LABELS: status. Beside a failed import's two note lines the band may have no room for it: there (only) it is
  // optional, and the page keeps the full status line.
  // At the floor size "Disconnected ‹Mon D, YYYY› · record frozen" is wider than the band (cycle-2 #9's width rule): it
  // then goes on two lines, split at its " · " (the second line role `frozen1`).
  if (o.frozen) for (const [k, part] of frozenLines(o.frozen).entries()) L.push({ role: k ? `frozen${k}` : 'frozen', text: part, size: STRIP_BAND.minPx, tone: 'muted', weight: 400, ...(s.note ? { optional: true } : {}) });
  // F-7: a public record's not-joined line is muted; a failed import's note is warn (FIXES-LABELS).
  if (s.note) for (const [k, part] of noteLines(s.note).entries()) L.push({ role: `note${k}`, text: part, size: STRIP_BAND.minPx, tone: s.note === PUBLIC.imageLine ? 'muted' : 'warn', weight: 400 });
  L.push(...disclaimerImageLines(o.disclaimerPx ?? DISCLAIMER_BAND_PX)); // FIXES-LABELS (D-09): ≥ 28 px; callers step it
  return L;
}

// FIXES-LABELS: status. The frozen line whole when it fits the band at the floor size, else split at its last " · ".
export function frozenLines(text: string): string[] {
  if (fitPx(text, STRIP_BAND.minPx) >= STRIP_BAND.minPx) return [text];
  const cut = text.lastIndexOf(' · ');
  return cut < 0 ? [text] : [text.slice(0, cut), text.slice(cut + 3)];
}

// The failed-import line in at most two band-wide lines at the floor size, split at a word.
function noteLines(s: string): string[] {
  const max = Math.floor(STRIP_BAND.width / (STRIP_BAND.minPx * STRIP_BAND.glyph));
  if (s.length <= max) return [s];
  const cut = s.lastIndexOf(' ', max);
  return [s.slice(0, cut), s.slice(cut + 1)];
}

// Stacks the lines top-down inside the band: optional lines (a thesis) give way first, then the gaps shrink from 14 px
// to 4 px. Returns the lines with their y, and whether everything fits (height and width).
export function layoutBand(lines: ImageLine[]): { lines: ImageLine[]; fits: boolean; tooWide: string[] } {
  const room = STRIP_BAND.bottom - STRIP_BAND.top;
  const h = (ls: ImageLine[], gap: number) => ls.reduce((a, l) => a + l.size * STRIP_BAND.lineHeight, 0) + gap * Math.max(ls.length - 1, 0);
  let ls = lines;
  while (h(ls, 4) > room && ls.some((l) => l.optional)) { const k = ls.findLastIndex((l) => l.optional); ls = ls.filter((_, j) => j !== k); }
  let gap = 14;
  while (gap > 4 && h(ls, gap) > room) gap--;
  let y = STRIP_BAND.top;
  const placed = ls.map((l) => { const p = { ...l, y }; y += l.size * STRIP_BAND.lineHeight + gap; return p; });
  return { lines: placed, fits: h(ls, gap) <= room, tooWide: ls.filter((l) => lineWidth(l) > STRIP_BAND.width).map((l) => l.text) };
}

// The figures as one line without the count, for a sentence that already leads with it (wholeRecordPreview's
// recordCountText): "+0.9% average per trade (…) · 95% range · losses included".
export function stripTextAfterCount(s: Strip): string {
  const rest = s.figures.filter((p) => p.role !== 'count');
  return rest.map((p, k) => (k === 0 ? '' : p.sep) + p.text).join('');
}
