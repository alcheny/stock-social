// F-10 / F-12: the one record strip. Every surface that shows a trader's record next to a single trade or month (the feed
// card, the trade and month pages, the trade and month images) builds it here, so the wording never drifts between
// surfaces (approval council 2026-11-01: never a second strip). Plan and committee: docs/features/logs/F-10/.
// Pure, except the bounded per-trader memo the feed uses (feedStrips).
import { cardEvidence, evidenceRangeText } from './record-card.ts';
import { headline, pct, type ConfidenceInput, type Tier } from './trades.ts';
import { imageLabel, RECORD_BODY, RECORD_STRIP, SHARE_CARD, shareCardText, WHOLE_RECORD, type RecordState } from './copy.ts';
import { counted } from './format.ts';
import { DISCLAIMER } from './share.ts';

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
};
export type StripSurface = 'feed' | 'page' | 'figures' | 'image';
export type StripTone = 'up' | 'down' | 'warn' | 'ok' | 'muted' | null;
// sep: what goes before the part when the figures are read as one line.
export type StripPart = { role: 'count' | 'average' | 'early' | 'range' | 'rangeLabel' | 'losses' | 'open'; text: string; tone: StripTone; sep: '' | ' ' | ' · ' };
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
  const note = full && !i.demo && i.state === 'failed' ? RECORD_BODY.failed : null;
  const tooEarly = i.evidence.tier === 'too-early' || !i.evidence.perTrade;
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
    if (full) {
      figures.push({ role: 'losses', text: SHARE_CARD.lossesIncluded, tone: null, sep: ' · ' });
      if (i.open?.length) figures.push({ role: 'open', text: SHARE_CARD.openShort(i.open.length), tone: null, sep: ' · ' });
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
export const IMAGE = { width: 1200, height: 630, bg: '#0b0b0f' } as const;
export const STRIP_BAND = { x: 309, width: 582, top: 24, bottom: 606, recordPx: 35, rangeMinPx: 30, minPx: 26, glyph: 0.6, lineHeight: 1.2 } as const;
export const SQUARE_CROP = { x0: 285, x1: 915 } as const;
export const BRAND_BOX = { x: 24, y: 24, width: 240, height: 40, text: 'Stock Social', size: 26 } as const;
export const IMAGE_COLOURS = { text: '#f4f4f6', muted: '#8b8b98', up: '#22c55e', down: '#f43f5e', warn: '#f59e0b', ok: '#22c55e' } as const;
export type ImageTone = keyof typeof IMAGE_COLOURS;
export type ImageLine = { role: string; text: string; size: number; tone: ImageTone; weight: 400 | 700 | 800; optional?: boolean; y?: number };

// Largest size ≤ max at which the text fits the band's width at 0.6 em per glyph.
export const fitPx = (text: string, max: number, width: number = STRIP_BAND.width) => Math.min(max, Math.floor(width / (Math.max(text.length, 1) * STRIP_BAND.glyph)));
export const lineWidth = (l: Pick<ImageLine, 'text' | 'size'>) => l.text.length * l.size * STRIP_BAND.glyph;

// The disclaimer in three lines at the floor size (one line at 26 px would be 1,000+ px wide).
export const DISCLAIMER_LINES = ['Not investment advice.', 'Past performance does not', 'guarantee future results.'] as const;

const imageTone = (t: StripTone): ImageTone => (t === 'up' || t === 'down' || t === 'warn' || t === 'ok' || t === 'muted' ? t : 'text');

// The strip's lines for an image: label, handle (· New record), the record lines at 35 px, losses (· open), the
// failed note, the disclaimer. `hero` (the trade or month lines) goes between the handle and the record.
export function stripImageLines(s: Strip, o: { handle: string; newRecord: boolean; hero: ImageLine[] }): ImageLine[] {
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
  }
  if (s.note) for (const [k, part] of noteLines(s.note).entries()) L.push({ role: `note${k}`, text: part, size: STRIP_BAND.minPx, tone: 'warn', weight: 400 });
  for (const [k, d] of DISCLAIMER_LINES.entries()) L.push({ role: `disclaimer${k}`, text: d, size: STRIP_BAND.minPx, tone: 'muted', weight: 400 });
  return L;
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
