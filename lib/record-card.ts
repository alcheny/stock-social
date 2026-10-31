// F-4 · The record card: what the profile link unfurls into (app/u/[handle]/opengraph-image.tsx) and the picture the
// Share button shares (app/u/[handle]/story, square and story sizes). Pure: no DB or React imports; the image routes
// load the rows and draw this model with app/u/[handle]/record-card-image.tsx. Percentages only.
// Owner decisions (docs/features/F-4-share-card.md): the chart, the trade count and the period lead; one headline
// figure (the average per trade) with its range in words; the evidence label and one plain-language trust line; no
// win rate and no per-trade detail; losses included, the Verified/Demo state and the disclaimer on every rendering.
// Committee round 1 (docs/features/logs/F-4/committee-round-1.md): one duration per card, a 10 CSS px floor at 343 px,
// the chart/count/period hierarchy, one trust label at every size, the 0% label in a gutter, no orphans, the printed
// link from the configured origin, and the alt text built from this model.
import { counted } from './format.ts';
import { imageTrust, SHARE_CARD, type RecordState } from './copy.ts';
import { DISCLAIMER } from './share.ts';
import { confidence, equityCurve, headline, isNewRecord, pct, type ConfidenceInput } from './trades.ts';
import { evidenceLabel, spanBetween, spanText, spanUnit, trustLine, type Span, type SpanUnit } from './confidence.ts';
import { downsampleIndices } from './downsample.ts';
import { pathD } from './chart-series.ts';
import { siteUrl } from './ticker.ts';

export type CardKind = 'unfurl' | 'square' | 'story';

// Sizes and type sizes per format. unfurl = the link preview (1200×630); square = the Share button's image
// (lib/story-image.ts FORMATS.square); story = the tall format, with its safe zones top and bottom.
// Round 1: every text is at least 10 CSS px when the image is shown 343 px wide (a 375 px phone with 16 px gutters):
// 35 px on the unfurl, 32 px on the 1080-wide pictures. Reached by deleting, not shrinking: the evidence label shares the
// trust line's row, the unfurl drops the brand word (the link preview names the site), the disclaimer takes two lines.
// `body` is the trust line, the small labels and the 0% label; `line` the count and the period (1.5× body); `headline`
// the one big number. `chart` is the plot box (with the 0% gutter, without the caption); the story's runs edge to edge
// (`bleed`). `noteCut`: how much the chart gives up when a failed import's note line is shown.
export const CARD_LAYOUT = {
  unfurl: { width: 1200, height: 630, padX: 40, padTop: 16, padBottom: 12, gap: 6, left: 540, bleed: false, noteCut: 39, chart: { w: 556, h: 322 },
    font: { brand: 35, label: 35, name: 46, handle: 35, headline: 100, body: 35, line: 53, newRecord: 53, disclaimer: 35, zero: 35 } },
  square: { width: 1080, height: 1080, padX: 56, padTop: 40, padBottom: 32, gap: 8, left: 0, bleed: false, noteCut: 0, chart: { w: 968, h: 364 },
    font: { brand: 32, label: 32, name: 52, handle: 32, headline: 130, body: 32, line: 48, newRecord: 48, disclaimer: 32, zero: 32 } },
  story: { width: 1080, height: 1920, padX: 72, padTop: 250, padBottom: 340, gap: 8, left: 0, bleed: true, noteCut: 30, chart: { w: 1080, h: 580 },
    font: { brand: 34, label: 34, name: 60, handle: 36, headline: 160, body: 32, line: 52, newRecord: 52, disclaimer: 32, zero: 32 } },
} as const;
export type CardLayout = (typeof CARD_LAYOUT)[CardKind];
export const UNFURL_COLUMN_GAP = 24; // between the unfurl's text column and its chart

// CSS px of the smallest text and of the headline when the image is shown `px` wide.
export function readableAt(kind: CardKind, px: number): { smallest: number; headline: number } {
  const L = CARD_LAYOUT[kind];
  const k = px / L.width;
  return { smallest: Math.min(...Object.values(L.font)) * k, headline: L.font.headline * k };
}
// The plot box's share of the card's area.
export const chartArea = (kind: CardKind) => (CARD_LAYOUT[kind].chart.w * CARD_LAYOUT[kind].chart.h) / (CARD_LAYOUT[kind].width * CARD_LAYOUT[kind].height);

// Round 1, demand 6: the 0% label sits in a left gutter the line never enters (label width at the label's size, then
// a gap). A bleeding chart's gutter also holds the page margin, so the label lines up with the text.
export function zeroGutter(kind: CardKind): { labelW: number; gutter: number } {
  const L = CARD_LAYOUT[kind];
  const labelW = Math.ceil(L.font.zero * 1.5);
  return { labelW, gutter: (L.bleed ? L.padX : 0) + labelW + 10 };
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

export type CardChart = { d: string; w: number; h: number; zeroY: number; down: boolean; points: number; gutter: number; labelW: number };
// One line in a w×h box, right of the gutter: x by close time, y over a range that always holds 0% and every point
// (never cropped), the 0% baseline at zeroY. down = the record ends below 0% (the line takes the down color, as on the
// profile chart).
export function cardChart(trades: Pick<ConfidenceInput, 'returnPct' | 'closedAt'>[], box: { w: number; h: number }, g = { labelW: 0, gutter: 4 }): CardChart | null {
  const pts = cardSeries(trades);
  if (pts.length < 2) return null;
  const { w, h } = box;
  const vs = pts.map((p) => p.value);
  let lo = Math.min(0, ...vs), hi = Math.max(0, ...vs);
  if (hi - lo < 1e-9) { lo -= 0.005; hi += 0.005; } // a flat record: 0% in the middle
  const pad = 6, right = 6;
  const y = (v: number) => pad + ((hi - v) / (hi - lo)) * (h - 2 * pad);
  const t0 = pts[0].at, span = pts[pts.length - 1].at - t0;
  const xs = pts.map((p, i) => g.gutter + (span > 0 ? (p.at - t0) / span : i / (pts.length - 1)) * (w - g.gutter - right));
  return { d: pathD(xs, vs.map(y)), w, h, zeroY: Math.round(y(0) * 10) / 10, down: vs[vs.length - 1] < 0, points: pts.length, gutter: g.gutter, labelW: g.labelW };
}

const since = (first: Date) => `Record since ${first.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })}`;
// "Record since Mar 2024 · 31 months": the first entry (TR-3, the profile's "Record since") and the span to now.
export function periodText(first: Date | null, now: Date, unit: SpanUnit = 'months'): string | null {
  return first ? `${since(first)} · ${spanText(spanBetween(first, now), unit)}` : null;
}

// Round 1, demand 7: the trust line never ends on one word (its last two words are joined by a no-break space), a
// word of one or two letters ("A", "on", "48") never ends a line apart from the word after it, and the disclaimer
// breaks after "advice." on purpose.
export const noOrphan = (s: string) => s.replace(/(?<=^|\s)(\S{1,2}) (?=\S)/g, '$1 ').replace(/ (\S+)$/, ' $1');
export function disclaimerLines(d: string): string[] {
  const i = d.indexOf('advice. ');
  return i < 0 ? [d] : [d.slice(0, i + 7), d.slice(i + 8)];
}

// Round 1, demand 8: the profile link printed on the square / story pictures comes from the configured public origin
// (NEXT_PUBLIC_SITE_URL, as sign-in links and the sitemap use), never from the request's Host header: the picture is
// publicly cacheable, so a forged Host must not end up printed on it.
export const cardLink = (env: Record<string, string | undefined>, handle: string) => `${new URL(siteUrl(env)).host}/u/${handle}`;

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

export type CardTone = 'ok' | 'muted' | 'warn' | 'demo';
export type CardModel = {
  kind: CardKind;
  name: string;
  handle: string;
  label: string; // the trust state, never empty, the same at every size: Verified, Demo, or why it is neither
  tone: CardTone;
  note: string | null; // the failed-import line or the importing note
  body: string | null; // "No closed trades yet" / "Import in progress": no figures, no chart
  headline: string | null;
  headlineTone: 'up' | 'down' | 'flat' | null;
  headlineLabel: string | null;
  range: string | null;
  count: string | null; // countValue · countNote
  countValue: string | null;
  countNote: string | null;
  period: string | null; // periodSince · periodLength
  periodSince: string | null;
  periodLength: string | null;
  evidence: string | null;
  newRecord: boolean; // TR-7, drawn as a badge
  trust: string | null;
  caption: string | null;
  link: string | null;
  disclaimer: string;
  chart: CardChart | null;
};

export function recordCard(i: CardInput): CardModel {
  const n = i.trades.length;
  // Round 1, demand 4: one label at every size (the profile card's rule); Demo is its own toned badge everywhere.
  const t = imageTrust('profile', { state: i.state, demo: i.demo, verified: i.verified, empty: n === 0 });
  const fallback = n === 0 && i.state === 'none' ? SHARE_CARD.noBroker : SHARE_CARD.notVerified;
  const label = i.demo ? SHARE_CARD.demoImage : (t.label ?? fallback);
  const tone: CardTone = i.demo ? 'demo' : t.label ? t.tone : 'muted';
  const body = !t.stats ? SHARE_CARD.importingBody : n === 0 ? SHARE_CARD.empty : null;
  const name = !i.name || i.name === i.handle ? `@${i.handle}` : i.name;
  const card: CardModel = {
    kind: i.kind, name, handle: i.handle, label, tone, note: t.note, body,
    headline: null, headlineTone: null, headlineLabel: null, range: null, count: null, countValue: null, countNote: null,
    period: null, periodSince: null, periodLength: null, evidence: null,
    newRecord: false, trust: null, caption: null, link: i.kind === 'unfurl' ? null : i.link, disclaimer: DISCLAIMER, chart: null,
  };
  if (body !== null) return card;

  const avg = headline(i.trades).avgReturn; // the profile's "avg return / trade", the same number
  const shown = Number((avg * 100).toFixed(1));
  const c = confidence(i.trades, i.now);
  const first = new Date(Math.min(...i.trades.map((x) => x.openedAt.getTime())));
  // Round 1, demand 1: one span (first entry to now) and one unit (the trust line's) for both lines.
  const span: Span = spanBetween(first, i.now);
  const periodLength = spanText(span, spanUnit(c.tier));
  const countValue = counted(n, 'closed trade');
  const L = CARD_LAYOUT[i.kind];
  const box = { w: L.chart.w, h: L.chart.h - (t.note ? L.noteCut : 0) };
  return {
    ...card,
    headline: pct(avg),
    headlineTone: shown > 0 ? 'up' : shown < 0 ? 'down' : 'flat',
    headlineLabel: SHARE_CARD.perTrade,
    range: c.perTrade ? SHARE_CARD.likely(pct(c.perTrade.low), pct(c.perTrade.high)) : null,
    count: `${countValue} · ${SHARE_CARD.lossesIncluded}`, countValue, countNote: SHARE_CARD.lossesIncluded,
    period: `${since(first)} · ${periodLength}`, periodSince: since(first), periodLength,
    evidence: evidenceLabel(c),
    newRecord: isNewRecord(i.trades, n, i.now),
    trust: trustLine(c, span),
    caption: SHARE_CARD.chartCaption,
    chart: cardChart(i.trades, box, zeroGutter(i.kind)),
  };
}

// Round 1, demand 9 (POLICY A1, COMPLIANCE §9): the image's alt text is the card in words, from the same model: every
// string the image draws, the sign of the average in words, and "verified" only where the label says it.
export function cardAlt(m: CardModel): string {
  const who = m.name === `@${m.handle}` ? m.name : `${m.name} (@${m.handle})`;
  const parts = [`Trading record card for ${who} on Stock Social.`, `${m.label}.`];
  if (m.note) parts.push(m.note);
  if (m.body) parts.push(`${m.body}.`);
  else {
    const sign = m.headlineTone === 'up' ? 'a gain' : m.headlineTone === 'down' ? 'a loss' : 'about even';
    parts.push(`The ${m.headlineLabel} is ${m.headline}, ${sign}${m.range ? `, ${m.range}` : ''}.`);
    if (m.newRecord) parts.push('New record.');
    parts.push(`${m.count}.`, `${m.period}.`, `Chart: ${m.caption}.`, `${m.evidence}.`);
    if (m.trust) parts.push(m.trust);
  }
  if (m.link) parts.push(`${m.link}.`);
  parts.push(m.disclaimer);
  return parts.join(' ');
}
