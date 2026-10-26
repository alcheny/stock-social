// F-4 · The record card: what the profile link unfurls into (app/u/[handle]/opengraph-image.tsx) and the picture the
// Share button shares (app/u/[handle]/story, square and story sizes). Pure: no DB or React imports; the image routes
// load the rows and draw this model with app/u/[handle]/record-card-image.tsx. Percentages only.
// Owner decisions (docs/features/F-4-share-card.md): the chart, the trade count and the period lead; one headline
// figure (the average per trade) with its range in words; the evidence label and one plain-language trust line; no
// win rate and no per-trade detail; losses included, the Verified/Demo state and the disclaimer on every rendering.
import { counted } from './format.ts';
import { imageTrust, SHARE_CARD, type RecordState } from './copy.ts';
import { DISCLAIMER } from './share.ts';
import { confidence, equityCurve, headline, isNewRecord, pct, type ConfidenceInput } from './trades.ts';
import { evidenceLabel, trustLine } from './confidence.ts';
import { downsampleIndices } from './downsample.ts';
import { pathD } from './chart-series.ts';

export type CardKind = 'unfurl' | 'square' | 'story';

// Sizes and type sizes per format. unfurl = the link preview (1200×630, the size every link preview expects); square =
// the Share button's image (lib/story-image.ts FORMATS.square); story = the tall format, with its safe zones top and
// bottom. Every text size is chosen so a 375 px-wide preview still reads (readableAt, tested).
// Budgets were measured on the renders (docs/features/logs/F-4/screenshots): the unfurl's disclaimer fits one line at
// 31 px, and every block fits its height with the longest trust line on two lines and the failed-import note shown.
// `gap` separates the blocks; `left` is the unfurl's text column beside the chart.
export const CARD_LAYOUT = {
  unfurl: { width: 1200, height: 630, padX: 48, padTop: 30, padBottom: 26, gap: 10, left: 572, chart: { w: 500, h: 205 },
    font: { brand: 34, label: 34, name: 44, handle: 32, headline: 100, sub: 32, line: 32, trust: 32, disclaimer: 31 } },
  square: { width: 1080, height: 1080, padX: 64, padTop: 56, padBottom: 48, gap: 20, left: 0, chart: { w: 952, h: 220 },
    font: { brand: 34, label: 34, name: 56, handle: 36, headline: 130, sub: 36, line: 36, trust: 36, disclaimer: 30 } },
  story: { width: 1080, height: 1920, padX: 72, padTop: 250, padBottom: 340, gap: 32, left: 0, chart: { w: 936, h: 320 },
    font: { brand: 36, label: 36, name: 64, handle: 40, headline: 190, sub: 40, line: 40, trust: 40, disclaimer: 32 } },
} as const;
export type CardLayout = (typeof CARD_LAYOUT)[CardKind];
export const UNFURL_COLUMN_GAP = 32; // between the unfurl's text column and its chart

// CSS px of the smallest text and of the headline when the image is shown `px` wide.
export function readableAt(kind: CardKind, px: number): { smallest: number; headline: number } {
  const L = CARD_LAYOUT[kind];
  const k = px / L.width;
  return { smallest: Math.min(...Object.values(L.font)) * k, headline: L.font.headline * k };
}

// The card's line keeps at most this many points (min/max per time slice, lib/downsample.ts: the first and last
// point and the record's low and high survive), about 2 per 4.5 px of the widest chart.
export const CARD_CHART_POINTS = 240;

export type CardPoint = { at: number; value: number };
// The CH-1 series (equityCurve: compounded, equal weight, one step per close), starting at 0% at the first close.
export function cardSeries(trades: Pick<ConfidenceInput, 'returnPct' | 'closedAt'>[], max = CARD_CHART_POINTS): CardPoint[] {
  const curve = equityCurve(trades);
  if (!curve.length) return [];
  const pts = [{ at: curve[0].trade.closedAt.getTime(), value: 0 }, ...curve.map((p) => ({ at: p.trade.closedAt.getTime(), value: p.cumulative }))];
  if (pts.length <= max) return pts;
  return downsampleIndices(pts.map((p) => p.at), pts.map((p) => p.value), max).map((i) => pts[i]);
}

export type CardChart = { d: string; w: number; h: number; zeroY: number; down: boolean; points: number };
// One line in a w×h box: x by close time, y over a range that always holds 0% and every point (never cropped), the
// 0% baseline at zeroY. down = the record ends below 0% (the line takes the down color, as on the profile chart).
export function cardChart(trades: Pick<ConfidenceInput, 'returnPct' | 'closedAt'>[], box: { w: number; h: number }): CardChart | null {
  const pts = cardSeries(trades);
  if (pts.length < 2) return null;
  const { w, h } = box;
  const vs = pts.map((p) => p.value);
  let lo = Math.min(0, ...vs), hi = Math.max(0, ...vs);
  if (hi - lo < 1e-9) { lo -= 0.005; hi += 0.005; } // a flat record: 0% in the middle
  const pad = 6, padX = 4;
  const y = (v: number) => pad + ((hi - v) / (hi - lo)) * (h - 2 * pad);
  const t0 = pts[0].at, span = pts[pts.length - 1].at - t0;
  const xs = pts.map((p, i) => padX + (span > 0 ? (p.at - t0) / span : i / (pts.length - 1)) * (w - 2 * padX));
  return { d: pathD(xs, vs.map(y)), w, h, zeroY: Math.round(y(0) * 10) / 10, down: vs[vs.length - 1] < 0, points: pts.length };
}

// "Record since Mar 2024 · 31 months": the first entry (TR-3, the profile's "Record since") and the whole calendar
// months from it to now (UTC). Under a full month reads "under 1 month".
export function periodText(first: Date | null, now: Date): string | null {
  if (!first) return null;
  let m = (now.getUTCFullYear() - first.getUTCFullYear()) * 12 + now.getUTCMonth() - first.getUTCMonth();
  if (now.getUTCDate() < first.getUTCDate()) m--;
  const since = first.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
  return `Record since ${since} · ${m < 1 ? 'under 1 month' : counted(m, 'month')}`;
}

export type CardInput = {
  kind: CardKind;
  handle: string;
  name: string | null;
  trades: ConfidenceInput[];
  state: RecordState; // the aggregate record state (lib/connections.ts#publicRecord)
  demo: boolean;
  verified: boolean; // every closed trade from the broker (POLICY F3a)
  now: Date;
  link: string | null; // the profile link printed on the square / story pictures (they travel without an unfurl)
};

export type CardModel = {
  kind: CardKind;
  name: string;
  handle: string;
  label: string; // the trust state, never empty: Verified, Demo, or why it is neither
  tone: 'ok' | 'muted' | 'warn';
  note: string | null; // the failed-import line or the importing note
  body: string | null; // "No closed trades yet" / "Import in progress": no figures, no chart
  headline: string | null;
  headlineTone: 'up' | 'down' | 'flat' | null;
  headlineLabel: string | null;
  range: string | null;
  count: string | null;
  period: string | null;
  evidence: string | null;
  newRecord: boolean;
  trust: string | null;
  caption: string | null;
  link: string | null;
  disclaimer: string;
  chart: CardChart | null;
};

export function recordCard(i: CardInput): CardModel {
  const n = i.trades.length;
  const t = imageTrust(i.kind === 'unfurl' ? 'profile' : 'story', { state: i.state, demo: i.demo, verified: i.verified, empty: n === 0 });
  const fallback = n === 0 && i.state === 'none' ? SHARE_CARD.noBroker : SHARE_CARD.notVerified;
  const label = i.demo ? (i.kind === 'unfurl' ? SHARE_CARD.demo : SHARE_CARD.demoImage) : (t.label ?? fallback);
  const tone = t.label || i.demo ? t.tone : 'muted';
  const body = !t.stats ? SHARE_CARD.importingBody : n === 0 ? SHARE_CARD.empty : null;
  const name = !i.name || i.name === i.handle ? `@${i.handle}` : i.name;
  const card: CardModel = {
    kind: i.kind, name, handle: i.handle, label, tone, note: t.note, body,
    headline: null, headlineTone: null, headlineLabel: null, range: null, count: null, period: null, evidence: null,
    newRecord: false, trust: null, caption: null, link: i.kind === 'unfurl' ? null : i.link, disclaimer: DISCLAIMER, chart: null,
  };
  if (body !== null) return card;

  const avg = headline(i.trades).avgReturn; // the profile's "avg return / trade", the same number
  const shown = Number((avg * 100).toFixed(1));
  const c = confidence(i.trades, i.now);
  const first = new Date(Math.min(...i.trades.map((x) => x.openedAt.getTime())));
  return {
    ...card,
    headline: pct(avg),
    headlineTone: shown > 0 ? 'up' : shown < 0 ? 'down' : 'flat',
    headlineLabel: SHARE_CARD.perTrade,
    range: c.perTrade ? SHARE_CARD.likely(pct(c.perTrade.low), pct(c.perTrade.high)) : null,
    count: `${counted(n, 'closed trade')} · ${SHARE_CARD.lossesIncluded}`,
    period: periodText(first, i.now),
    evidence: evidenceLabel(c),
    newRecord: isNewRecord(i.trades, n, i.now),
    trust: trustLine(c),
    caption: SHARE_CARD.chartCaption,
    chart: cardChart(i.trades, CARD_LAYOUT[i.kind].chart),
  };
}
