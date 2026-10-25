// F-4 PR 2: the record card's model. The profile's link-unfurl image and the Share button's image (PR 3) draw only
// what this returns: every string, colour token, size role, the chart's geometry per layout and the alt text. Pure: no
// database, no React. Percentages only (POLICY P3). Owner decisions: docs/features/F-4-share-card.md; plan:
// docs/features/logs/F-4/plan.md PR-2 with both sign-offs and the O1 amendment.
import { confidence, headline, pct, type Confidence, type Direction, type Interval } from './trades.ts';
import { chartSeries } from './chart-series.ts';
import { counted } from './format.ts';
import { profileCardAlt, imageLabel, RECORD_BODY, SHARE_CARD, shareCardText, type RecordState } from './copy.ts';
import { DISCLAIMER } from './share.ts';
import { covered } from './card-glyphs.ts';

// The two share-image canvases of the Share button (moved here from lib/story-image.ts, which re-exports them).
export type ImageFormat = 'story' | 'square';
export const FORMATS = { story: { width: 1080, height: 1920 }, square: { width: 1080, height: 1080 } };
export const parseFormat = (v: string | null | undefined): ImageFormat => (v === 'story' ? 'story' : 'square');

// Layouts: wide is the 1200 × 630 unfurl; tall is the 1080-wide square and story.
export type CardLayout = 'wide' | 'tall';
export const CANVAS_WIDTH: Record<CardLayout, number> = { wide: 1200, tall: 1080 };
// Images only (the app's CSS tokens are separate). Each is ≥ 4.5:1 on bg; up and down are close in contrast so a
// losing record is as prominent as a winning one (U12, C6: tested in lib/record-card.test.ts).
export const PALETTE = { bg: '#0b0b0f', text: '#f4f4f6', muted: '#a1a1ad', up: '#22c55e', down: '#fb7185', warn: '#f59e0b' } as const;
export type CardTone = 'text' | 'muted' | 'up' | 'down' | 'warn';
export const TINT = 0.16; // the chart's area tint, above 0% in up and below in down
// Type scale in source px, and each role's floor in CSS px once the image is shown 375 px wide (plan §3). The tall
// count is 47, not the plan's 46: 46 × 375 / 1080 = 15.97 misses the plan's own 16 px floor.
export const SCALE = {
  wide: { headline: 108, name: 52, count: 52, range: 36, period: 36, trust: 34, small: 32 },
  tall: { headline: 132, name: 52, count: 47, range: 38, period: 38, trust: 36, small: 30 },
} as const;
export const FLOORS = { headline: 32, name: 16, count: 16, range: 10.5, period: 10.5, trust: 10.5, small: 10 } as const;
export const CARD_POINTS = 400; // chart points kept (min/max per slice, lib/downsample.ts), the record's extremes included
const CHART: Record<CardLayout, { width: number; height: number; gutter: number }> = {
  wide: { width: 620, height: 176, gutter: 70 },
  tall: { width: 952, height: 180, gutter: 70 },
};
const PAD = 4; // the line's half-width plus a pixel, so the extremes are never clipped

export type CardTrade = { symbol: string; openedAt: Date; closedAt: Date; returnPct: number; holdingDays: number; verified: boolean };
export type RecordCardInput = {
  trades: CardTrade[]; state: RecordState; demo: boolean;
  frozenEnd: Date | null; // the latest disconnect when every consented connection is disconnected (TR-5), else null
  now: Date; handle: string; displayName: string; host: string;
};
export type ChartGeometry = { width: number; height: number; gutter: number; baseline: number; line: string; area: string; stop: number };
export type CardModel = {
  body: 'record' | 'empty' | 'importing';
  name: string; // the display name, or @handle when the font cannot draw it (never altered or partly drawn)
  handle: string | null; // the "@handle" row; null when the name slot already shows it
  badge: { text: string; tone: CardTone };
  headline: { label: string; value: string; tone: CardTone } | null;
  range: string | null;
  rangeParts: [string, string] | null; // ["likely between", "−0.1% and +2.7%"]: the wide card's two lines (U-2)
  evidence: string | null; // the pill
  trust: { text: string; tone: CardTone } | null; // the owner's trust line, or the incomplete-import line in warn
  count: string | null;
  lossesIncluded: string | null;
  period: string | null;
  periodParts: [string, string] | null; // ["Record since Sep 2026", "· under a month"] (U-2)
  chart: { tone: CardTone; caption: string; zeroLabel: '0%'; points: number; end: number; min: number; max: number; geometry: Record<CardLayout, ChartGeometry> } | null;
  message: { title: string; body: string } | null; // empty and importing bodies
  link: string; // host/u/handle, drawn on the tall layouts only
  disclaimer: typeof DISCLAIMER;
  alt: Record<CardLayout, string>; // the link is read on the tall image only
};

const MINUS = '−';
const signed = (s: string) => s.replace('-', MINUS);

// The headline: the profile's pct() format (1 decimal; a value that rounds to zero reads "0.0%") with U+2212, and its
// colour follows the printed sign, so a "0.0%" is never coloured (UX lead change 3, A1).
export function cardHeadline(x: number): { text: string; tone: CardTone } {
  const text = signed(pct(x));
  return { text, tone: text.startsWith('+') ? 'up' : text.startsWith(MINUS) ? 'down' : 'text' };
}

// Range bounds (U7): a non-zero bound never prints "0.0%": 2, then 3, then 4 decimals, sign kept; past 4 decimals it
// prints its sign with 4 zeros. A loss short of −100% never prints as −100% (up to 5 decimals, then "≈−100.0%", as
// pct() does). U+2212 for minus. Fix round 1 (tester L1): both bounds of a range share the larger decimal count.
const NEAR_TOTAL = -1; // marks a bound printed as "≈−100.0%"
function decimals(x: number): number {
  if (x === 0) return 1;
  for (let d = 1; d <= 5; d++) {
    const v = Number((x * 100).toFixed(d));
    if (x > -1 && v <= -100) continue; // short of a total loss: more digits
    if (v !== 0) return d;
    if (d === 4) return 4; // a tiny bound: its sign and 4 zeros
  }
  return NEAR_TOTAL;
}
function boundAt(x: number, d: number): string {
  if (decimals(x) === NEAR_TOTAL) return `\u2248${MINUS}100.0%`;
  if (x === 0) return `${(0).toFixed(d)}%`;
  return `${x > 0 ? '+' : MINUS}${Math.abs(x * 100).toFixed(d)}%`;
}
export const cardPct = (x: number): string => boundAt(x, Math.max(1, decimals(x)));
export function cardBounds(low: number, high: number): [string, string] {
  const d = Math.max(1, decimals(low), decimals(high));
  return [boundAt(low, d), boundAt(high, d)];
}
function rangeParts(iv: Interval): [string, string] {
  const [low, high] = cardBounds(iv.low, iv.high);
  // Tester L2: an all −100% record would read "≈−100.0% and ≈−100.0%"; one value says it.
  if (low === high) return [SHARE_CARD.rangeOneLead, low.replace('\u2248', '')];
  return [SHARE_CARD.rangeLead, SHARE_CARD.rangeBounds(low, high)];
}

// The trust line's direction comes from the per-trade range printed beside it, so the words never contradict it.
export const cardDirection = (iv: Interval | null): Direction => (!iv ? 'unclear' : iv.low > 0 ? 'positive' : iv.high < 0 ? 'negative' : 'unclear');

// The owner's table, cell by cell. N is closed trades when too early, independent bets otherwise; D = max(1, ⌊days⌋),
// M = ⌊days / 30.44⌋ (moderate needs 90 days, so M ≥ 2), Y = max(1, ⌊days / 365.25⌋) (strong starts at 365 days).
export function trustLine(c: Confidence, closes: number): string {
  const t = SHARE_CARD.trust;
  if (c.tier === 'too-early') return t.tooEarly(closes);
  const dir = cardDirection(c.perTrade);
  if (c.tier === 'thin') return t.thin[dir](c.k, Math.max(1, Math.floor(c.spanDays)));
  if (c.tier === 'moderate') return t.moderate[dir](c.k, Math.floor(c.spanDays / 30.44));
  return t.strong[dir](c.k, Math.max(1, Math.floor(c.spanDays / 365.25))); // fix round 1 (M1): never "over 0 years"
}

export const evidenceLabel = (c: Confidence) => SHARE_CARD.evidence(c.tier === 'too-early' ? 'too early' : c.tier);

// "Record since Mar 2025 · 19 months": whole calendar months in UTC (a month counts once its day and time are reached).
const MONTH = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
export function periodParts(start: Date, end: Date): [string, string] {
  let m = (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + end.getUTCMonth() - start.getUTCMonth();
  const inMonth = (d: Date) => d.getTime() - Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
  if (inMonth(end) < inMonth(start)) m--;
  return [SHARE_CARD.since(MONTH.format(start)), m <= 0 ? SHARE_CARD.underAMonth : SHARE_CARD.months(m)];
}
export const periodText = (start: Date, end: Date): string => periodParts(start, end).join(' ');

function badgeFor(i: RecordCardInput, verified: boolean): { text: string; tone: CardTone } {
  const t = shareCardText({ state: i.state, demo: i.demo, verified, empty: i.trades.length === 0 });
  let label = imageLabel(t.label);
  // "Verified from broker" only for a connected, verified, non-demo record with closes (POLICY F3a).
  if (label === imageLabel(SHARE_CARD.verified) && i.state !== 'connected') label = null;
  if (!label) return i.state === 'none' ? { text: SHARE_CARD.noBroker, tone: 'muted' } : { text: imageLabel(SHARE_CARD.connected)!, tone: 'up' };
  return { text: label, tone: t.tone === 'ok' ? 'up' : t.tone };
}

const r1 = (v: number) => Math.round(v * 10) / 10;
// Fix round 1 (UX lead U-4): the x-axis is the printed period (first entry to now, or to the disconnect), so the line
// never stretches a few weeks of trading across a "19 months" label: 0% at the first entry, the last value held flat
// to the period's end (CH-1 steps only at closes, so a flat stretch means no closes).
function geometry(pts: { at: number; value: number }[], min: number, max: number, layout: CardLayout): ChartGeometry {
  const { width, height, gutter } = CHART[layout];
  const t0 = pts[0].at, t1 = pts[pts.length - 1].at;
  const x = (p: { at: number }, i: number) => r1(gutter + (t1 > t0 ? (p.at - t0) / (t1 - t0) : pts.length > 1 ? i / (pts.length - 1) : 0) * (width - gutter));
  const y = (v: number) => r1(max > min ? PAD + ((max - v) / (max - min)) * (height - 2 * PAD) : height / 2);
  const xy = pts.map((p, i) => `${x(p, i)} ${y(p.value)}`);
  const line = `M${xy.join(' L')}`;
  const baseline = y(0);
  return { width, height, gutter, baseline, line, area: `${line} L${x(pts[pts.length - 1], pts.length - 1)} ${baseline} L${gutter} ${baseline} Z`, stop: baseline / height };
}

// Every string the card draws in this layout, in reading order (the scans and the alt text use the same list).
export function cardStrings(m: CardModel, layout: CardLayout): string[] {
  return [
    m.name, m.handle, m.badge.text, m.headline?.label, m.headline?.value, m.range, m.evidence, m.trust?.text,
    m.chart?.zeroLabel, m.chart?.caption, m.count, m.lossesIncluded, m.period, m.message?.title, m.message?.body,
    layout === 'tall' ? m.link : null, m.disclaimer,
  ].filter((s): s is string => !!s);
}

export function recordCard(i: RecordCardInput): CardModel {
  const n = i.trades.length;
  const verified = n > 0 && i.trades.every((t) => t.verified);
  const nfc = i.displayName.normalize('NFC').trim();
  const nameOk = nfc.length > 0 && covered(nfc);
  const base: Omit<CardModel, 'body'> = {
    name: nameOk ? nfc : `@${i.handle}`, handle: nameOk ? `@${i.handle}` : null, badge: badgeFor(i, verified),
    headline: null, range: null, rangeParts: null, evidence: null, trust: null, count: null, lossesIncluded: null, period: null,
    periodParts: null, chart: null, message: null, link: `${i.host}/u/${i.handle}`, disclaimer: DISCLAIMER, alt: { wide: '', tall: '' },
  };
  let m: CardModel;
  if (i.state === 'importing' && !i.demo) {
    m = { ...base, body: 'importing', message: { title: SHARE_CARD.importingBody, body: SHARE_CARD.importingNote } };
  } else if (n === 0) {
    m = { ...base, body: 'empty', message: { title: SHARE_CARD.empty, body: SHARE_CARD.emptyBody } };
  } else {
    const c = confidence(i.trades, i.now);
    const s = chartSeries(i.trades.map((t, k) => ({ id: String(k), symbol: t.symbol, returnPct: t.returnPct, closedAt: t.closedAt, holdingDays: t.holdingDays, thesis: null, index: k })), 'ALL', i.now, CARD_POINTS - 1);
    const h = cardHeadline(headline(i.trades).avgReturn);
    const start = new Date(Math.min(...i.trades.map((t) => t.openedAt.getTime())));
    const end = new Date(Math.max((i.frozenEnd ?? i.now).getTime(), s.t1));
    const pts = [{ at: start.getTime(), value: 0 }, ...s.pts.slice(1), ...(end.getTime() > s.t1 ? [{ at: end.getTime(), value: s.last }] : [])];
    const period = periodParts(start, i.frozenEnd ?? i.now), range = c.perTrade ? rangeParts(c.perTrade) : null;
    m = {
      ...base, body: 'record',
      headline: { label: SHARE_CARD.headlineLabel, value: h.text, tone: h.tone },
      range: range && range.join(' '), rangeParts: range,
      evidence: evidenceLabel(c),
      trust: i.state === 'failed' && !i.demo ? { text: RECORD_BODY.failed, tone: 'warn' } : { text: trustLine(c, n), tone: 'text' },
      count: counted(n, 'trade'),
      lossesIncluded: SHARE_CARD.lossesIncluded,
      period: period.join(' '), periodParts: period,
      chart: {
        tone: s.last > 0 ? 'up' : s.last < 0 ? 'down' : 'text', caption: SHARE_CARD.caption, zeroLabel: '0%', points: pts.length,
        end: s.last, min: s.min, max: s.max,
        geometry: { wide: geometry(pts, s.min, s.max, 'wide'), tall: geometry(pts, s.min, s.max, 'tall') },
      },
    };
  }
  // U14, fix round 1 (business lead B1, UX lead U-3, tester M2): every word on the card, read once, in the order that
  // loses least if a consumer cuts the alt short. The prefix names no label: the model's own badge follows (never
  // shareCardText's, which can say Verified for a record the badge does not). The handle is in the prefix, so the name
  // is read only when it is a display name; the figure comes before its label; the chart sentence covers "0%".
  const chart = m.chart && `Line from 0% to ${cardHeadline(m.chart.end).text} total, lowest ${cardHeadline(m.chart.min).text}`;
  const body = [
    profileCardAlt(i.handle, shareCardText({ state: 'none', demo: false, verified: false, empty: true })),
    m.handle ? m.name : null, m.badge.text,
    m.headline && `${m.headline.value} ${m.headline.label}`, m.range,
    m.count && `${m.count}, ${m.lossesIncluded}`, m.period,
    m.evidence, m.trust?.text, m.message?.title, m.message?.body,
    chart, m.chart?.caption, m.disclaimer,
  ].filter((s): s is string => !!s).map((s) => s.replace(/\.$/, ''));
  m.alt = { wide: `${body.join('. ')}.`, tall: `${[...body, m.link].join('. ')}.` };
  return m;
}
