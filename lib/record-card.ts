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
import { imageTrust, OPTIONS, SHARE_CARD, type RecordState } from './copy.ts';
import { DISCLAIMER } from './share.ts';
import { confidence, headline, isNewRecord, pct, type Confidence, type ConfidenceInput, type Tier } from './trades.ts';
import { evidenceLabel, MIN_BETS, spanBetween, spanText, spanUnit, tierFor, tooWide, trustLine, trustSign, type Span, type SpanUnit } from './confidence.ts';
import { arithmeticRange } from './bets.ts';
import { openSummary, tone, type Tone } from './open-split.ts';
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
// (`bleed`). `noteCut` / `openCut`: how much the chart gives up when a failed import's note line / the open-positions
// row is shown. `lh`: the line height of wrapping text (single-line rows use 1).
export const CARD_LAYOUT = {
  unfurl: { width: 1200, height: 630, padX: 40, padTop: 8, padBottom: 6, gap: 6, lh: 1.0, left: 540, bleed: false, noteCut: 41, openCut: 41, chart: { w: 556, h: 372 },
    font: { brand: 35, label: 35, name: 46, handle: 35, headline: 98, body: 35, line: 53, newRecord: 35, disclaimer: 35, zero: 35 } },
  square: { width: 1080, height: 1080, padX: 56, padTop: 36, padBottom: 28, gap: 4, lh: 1.05, left: 0, bleed: false, noteCut: 0, openCut: 0, chart: { w: 968, h: 364 },
    font: { brand: 32, label: 32, name: 52, handle: 32, headline: 112, body: 32, line: 48, newRecord: 32, disclaimer: 32, zero: 32 } },
  story: { width: 1080, height: 1920, padX: 72, padTop: 250, padBottom: 340, gap: 4, lh: 1.05, left: 0, bleed: true, noteCut: 0, openCut: 0, chart: { w: 1080, h: 580 },
    font: { brand: 34, label: 34, name: 60, handle: 36, headline: 128, body: 32, line: 52, newRecord: 34, disclaimer: 32, zero: 32 } },
} as const;
export type CardLayout = (typeof CARD_LAYOUT)[CardKind];
export const UNFURL_COLUMN_GAP = 24; // between the unfurl's text column and its chart
// Orchestrator review (2026-11-01): a long range ("likely between -24.1% and +104.1%") or a long average ("+250.0%")
// no longer fits the 540 px text column in one line, and a second line would push the open-positions row off the
// 630 px card. Such a card widens its text column by this much and its chart gives up the same width (one row of text
// is worth more than a sliver of chart; the chart then holds about 22% of the preview, 20% with open positions).
// ponytail: in these wide states the preview's chart falls to about 22% (20% with open positions), under the owner's
// "about 24%", and an average of 8+ characters is drawn under the 28 CSS px headline floor — a font with narrower digits
// (a bundled file, which the owner declined on 2026-11-01) would keep both.
export const UNFURL_WIDE_SHIFT = 100;
export const unfurlWide = (headline: string | null, range: string | null) => (headline ?? '').length >= 7 || (range ?? '').length > 31;
// An average of 8 or more characters ("+1088.7%") is drawn smaller so it still sits beside its label on one row.
export const unfurlHeadlineSize = (headline: string | null) => {
  const n = (headline ?? '').length;
  return n >= 8 ? Math.floor((CARD_LAYOUT.unfurl.font.headline * 7) / n) : CARD_LAYOUT.unfurl.font.headline;
};

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
// F-4 (2026-11-01): which line the card draws. 'sum' = the running sum of per-trade returns in close order, for every
// trader today; it ends at count × average, so it always agrees with the headline. 'account' = the account-weighted
// line for a trader who opted in to position size (F-5, blocked): the seam is kept here, and it refuses to draw until
// F-5 supplies the data, so no caller can show it by mistake.
export type CardSeriesKind = 'sum' | 'account';
type SeriesInput = Pick<ConfidenceInput, 'returnPct' | 'closedAt'> & Partial<Pick<ConfidenceInput, 'openedAt' | 'symbol'>>;
const byClose = (a: SeriesInput, b: SeriesInput) =>
  a.closedAt.getTime() - b.closedAt.getTime() || (a.openedAt?.getTime() ?? 0) - (b.openedAt?.getTime() ?? 0) || ((a.symbol ?? '') < (b.symbol ?? '') ? -1 : (a.symbol ?? '') > (b.symbol ?? '') ? 1 : 0);
// Starts at 0% at the first entry (so the first step slopes, never a vertical stroke at the left edge; QA 2026-11-01);
// one step per close, in order (ties broken by entry, then symbol: deterministic).
export function cardSeries(trades: SeriesInput[], max = CARD_CHART_POINTS, kind: CardSeriesKind = 'sum'): CardPoint[] {
  // ponytail: the account-weighted line waits for F-5 (position size, blocked) — draw it from F-5's opt-in data here.
  if (kind === 'account') throw new Error('the account-weighted line is not available before F-5 (position size)');
  if (!trades.length) return [];
  const sorted = [...trades].sort(byClose);
  let sum = 0;
  const start = Math.min(...trades.map((t) => (t.openedAt ?? t.closedAt).getTime()));
  const pts = [{ at: start, value: 0 }, ...sorted.map((t) => ({ at: t.closedAt.getTime(), value: (sum += t.returnPct) }))];
  if (pts.length <= max) return pts;
  return downsampleIndices(pts.map((p) => p.at), pts.map((p) => p.value), max).map((i) => pts[i]);
}

export type CardChart = { d: string; w: number; h: number; zeroY: number; down: boolean; points: number; gutter: number; labelW: number };
// One line in a w×h box, right of the gutter: x by close time, y over a range that always holds 0% and every point
// (never cropped), the 0% baseline at zeroY. down = the record ends below 0% (the line takes the down color, as on the
// profile chart).
export function cardChart(trades: SeriesInput[], box: { w: number; h: number }, g = { labelW: 0, gutter: 4 }): CardChart | null {
  const pts = cardSeries(trades);
  if (pts.length < 2) return null;
  const { w, h } = box;
  const vs = pts.map((p) => p.value);
  let lo = Math.min(0, ...vs), hi = Math.max(0, ...vs);
  if (hi - lo < 1e-9) { lo -= 0.005; hi += 0.005; } // a flat record: 0% in the middle
  // 14 px above and below the line: the 0% label and the line keep clear of the text around the plot (UX test).
  const pad = 14, right = 6;
  const y = (v: number) => pad + ((hi - v) / (hi - lo)) * (h - 2 * pad);
  const t0 = pts[0].at, span = pts[pts.length - 1].at - t0;
  const xs = pts.map((p, i) => g.gutter + (span > 0 ? (p.at - t0) / span : i / (pts.length - 1)) * (w - g.gutter - right));
  return { d: pathD(xs, vs.map(y)), w, h, zeroY: Math.round(y(0) * 10) / 10, down: vs[vs.length - 1] < 0, points: pts.length, gutter: g.gutter, labelW: g.labelW };
}

const since = (first: Date) => `Record since ${first.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })}`;
// "Record since Mar 2024 · 31 months": the first entry (TR-3, the profile's "Record since") and the record's length.
// F-4 (2026-11-01): the card passes the last close as `end` (an idle record doesn't look longer).
export function periodText(first: Date | null, end: Date, unit: SpanUnit = 'months'): string | null {
  return first ? `${since(first)} · ${spanText(spanBetween(first, end), unit)}` : null;
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
// Orchestrator review (2026-11-01): a configured origin without a scheme ("example.com") gets https://; one that is no
// URL at all prints no link (the card handles a null link) instead of failing the image route.
// ponytail: siteUrl's other callers (sign-in links, the sitemap) still fail on a scheme-less origin — normalize the
// scheme in lib/ticker.ts#siteUrl itself and drop the fallback here.
export function cardLink(env: Record<string, string | undefined>, handle: string): string | null {
  const o = siteUrl(env).trim();
  try {
    return `${new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(o) ? o : `https://${o}`).host}/u/${handle}`;
  } catch {
    return null;
  }
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
  open?: number[]; // F-6: unrealized percent of each open position (0.05 = +5%), nothing else
  // OPTIONS (docs/features/logs/options/plan.md D5, AC 24): from lib/options-load.ts only: whether the headline reads
  // "share trade", and the gated count line or the options line. No option figure otherwise.
  options?: { shareLabel: boolean; line: string | null };
};

// F-6 on the card (committee 2026-11-01): the open positions in words, percent only, no symbols, no combined figure and
// no average on the card (the profile carries F-6's average; the card names the lowest and highest instead). Counts
// and tones are F-6's own (lib/open-split.ts), so the card and the profile count alike; the lowest comes first so a
// held loser is never hidden; one position, or all printed alike, reads "at x%".
export type CardOpen = {
  count: number; up: number; down: number; flat: number;
  low: string; high: string; lowTone: Tone; highTone: Tone;
  title: string; shortTitle: string; // "Still open: 3 positions" / "3 open, unrealized"
  split: string; spread: string;
  full: string; // "Still open: 3 positions · 2 up, 1 down · lowest -8.0%, highest +12.1%"
  short: string; // the link preview's form: "3 open, unrealized · 2 up, 1 down · lowest -8.0%, highest +12.1%"
  note: string;
};
export function cardOpen(pcts: number[]): CardOpen | null {
  const sum = openSummary(pcts);
  if (!sum) return null;
  const xs = pcts.filter(Number.isFinite);
  const { up, down, flat } = sum;
  const lo = Math.min(...xs), hi = Math.max(...xs);
  const low = pct(lo), high = pct(hi);
  // One position needs no up/down count: "Still open: 1 position · at -8.0%" (UX test 2026-11-01).
  const split = xs.length === 1 ? '' : `${up} up, ${down} down${flat ? `, ${flat} flat` : ''}`;
  const spread = low === high ? `at ${low}` : `lowest ${low}, highest ${high}`;
  const join = (title: string) => [title, split, spread].filter(Boolean).join(' · ');
  return {
    count: xs.length, up, down, flat, low, high, lowTone: tone(lo), highTone: tone(hi),
    title: SHARE_CARD.openFull(xs.length), shortTitle: SHARE_CARD.openShort(xs.length), split, spread,
    full: join(SHARE_CARD.openFull(xs.length)), short: join(SHARE_CARD.openShort(xs.length)), note: SHARE_CARD.openNote,
  };
}

// The card's statistics (F-4, 2026-10-31): the range is the arithmetic one around the headline (lib/bets.ts); the
// tier is confidence()'s thresholds with the "too wide" check on that same range; the trust line's sign reads it.
// User test 2026-11-01: the profile shows this same evidence (range, tier, "Past results" verdict), so a viewer who
// taps a shared card lands on the same answer. `edge` is the printed range's sign; ranking keeps confidence()'s own
// pace interval (evidenceWeight, lib/trades.ts), which this does not touch.
// The profile's "(low to high)" for that same range; the display log records exactly this text.
export const evidenceRangeText = (e: Pick<Confidence, 'perTrade'>): string | null =>
  e.perTrade ? `(${pct(e.perTrade.low)} to ${pct(e.perTrade.high)})` : null;

// ponytail: the compare page still prints confidence()'s log-based range and tier (the trade and month pages call this
// through lib/record-strip.ts#stripEvidence) — have it call cardEvidence too, or move confidence onto arithmeticRange.
export function cardEvidence(trades: ConfidenceInput[], now: Date): Confidence {
  const c = confidence(trades, now);
  const r = arithmeticRange(trades);
  const perTrade = r && { low: r.low, mid: r.mid, high: r.high };
  const tier: Tier = c.k < MIN_BETS || !r || tooWide({ low: r.mid - r.half, high: r.mid + r.half }) ? 'too-early' : tierFor(c.k, c.spanDays);
  const sign = trustSign({ perTrade });
  const edge = tier === 'too-early' ? null : sign === 'unclear' ? 'unclear' : sign;
  // A record shorter than half a day reads "1 day" on the profile too (orchestrator review): the card's trust line never
  // says "over 0 days", and the profile's evidence line (Math.round of this span) now says the same.
  return { ...c, tier, perTrade, edge, spanDays: c.n ? Math.max(c.spanDays, 0.5) : c.spanDays };
}

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
  headlineTone: Tone | null;
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
  open: CardOpen | null; // F-6: the unrealized part, beside the realized figures
  // OPTIONS: present only when the input carried options (a card without them keeps its exact shape).
  shareLabel?: boolean; // the "Excluding options" pill (fix round 3)
  optionsLine?: string | null; // the count line (gated) or the options line
};

export function recordCard(i: CardInput): CardModel {
  const n = i.trades.length;
  // Round 1, demand 4: one label at every size (the profile card's rule); Demo is its own toned badge everywhere.
  const t = imageTrust('profile', { state: i.state, demo: i.demo, verified: i.verified, empty: n === 0 });
  const fallback = n === 0 && i.state === 'none' ? SHARE_CARD.noBroker : SHARE_CARD.notVerified;
  const label = i.demo ? SHARE_CARD.demoImage : (t.label ?? fallback);
  const badgeTone: CardTone = i.demo ? 'demo' : t.label ? t.tone : 'muted';
  const body = !t.stats ? SHARE_CARD.importingBody : n === 0 ? SHARE_CARD.empty : null;
  const name = !i.name || i.name === i.handle ? `@${i.handle}` : i.name;
  const card: CardModel = {
    kind: i.kind, name, handle: i.handle, label, tone: badgeTone, note: t.note, body,
    headline: null, headlineTone: null, headlineLabel: null, range: null, count: null, countValue: null, countNote: null,
    period: null, periodSince: null, periodLength: null, evidence: null,
    newRecord: false, trust: null, caption: null, link: i.kind === 'unfurl' ? null : i.link, disclaimer: DISCLAIMER, chart: null,
    // F-6: open positions only where the profile lists them (a broker record) and never while an import runs.
    open: i.state !== 'none' && t.stats ? cardOpen(i.open ?? []) : null,
    ...(i.options ? { shareLabel: i.options.shareLabel, optionsLine: t.stats ? i.options.line : null } : {}), // OPTIONS
  };
  // OPTIONS fix round 4 (N1): an options-only record says "No closed share trades yet", as the profile does, and the
  // picture draws its options line under it.
  if (card.body === SHARE_CARD.empty && (i.options?.shareLabel || i.options?.line)) card.body = OPTIONS.noShareCloses;
  if (body !== null) return card;

  const avg = headline(i.trades).avgReturn; // the profile's "avg return / trade", the same number
  const c = cardEvidence(i.trades, i.now);
  const first = new Date(Math.min(...i.trades.map((x) => x.openedAt.getTime())));
  const last = new Date(Math.max(...i.trades.map((x) => x.closedAt.getTime())));
  // Round 1, demand 1, and F-4 2026-11-01: one span (first trade to last close, as the profile's evidence line) and
  // one unit (the trust line's) for both lines.
  const span: Span = spanBetween(first, last);
  const periodLength = spanText(span, spanUnit(c.tier));
  const countValue = counted(n, 'closed trade');
  const L = CARD_LAYOUT[i.kind];
  // The unfurl's chart gives up a row's height to the failed-import note and to the open-positions row (F-4
  // 2026-10-31: about 24% of the preview with every element kept); the square and story keep theirs (30%).
  const range = c.perTrade ? SHARE_CARD.likely(pct(c.perTrade.low), pct(c.perTrade.high)) : null;
  const wide = i.kind === 'unfurl' && unfurlWide(pct(avg), range);
  // OPTIONS: on the unfurl the options line takes the caption's row and wraps once; the chart gives up that row.
  const box = { w: L.chart.w - (wide ? UNFURL_WIDE_SHIFT : 0), h: L.chart.h - (t.note ? L.noteCut : 0) - (card.open ? L.openCut : 0) - (card.optionsLine && i.kind === 'unfurl' ? L.noteCut : 0) };
  return {
    ...card,
    headline: pct(avg),
    headlineTone: tone(avg),
    headlineLabel: card.open ? SHARE_CARD.perClosedTrade : SHARE_CARD.perTrade,
    range,
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
    parts.push(`The ${m.headlineLabel} is ${m.headline}, ${sign}${m.range ? `, ${m.range}` : ''}${m.shareLabel ? `, ${OPTIONS.altQualifier}` /* OPTIONS (legal re-sign) */ : ''}.`);
    if (m.newRecord) parts.push('New record.');
    parts.push(`${m.count}.`, `${m.period}.`, `Chart: ${m.caption}.`, `${m.evidence}.`);
    if (m.trust) parts.push(m.trust);
  }
  if (m.optionsLine) parts.push(m.optionsLine); // OPTIONS
  if (m.open) parts.push(`${SHARE_CARD.openAlt} ${[counted(m.open.count, 'position'), m.open.split, m.open.spread].filter(Boolean).join(', ')}.`);
  if (m.link) parts.push(`${m.link}.`);
  parts.push(m.disclaimer);
  return parts.join(' ');
}

// F-4 (2026-11-01): the text under the link preview matches the card: the average per trade with its range, the
// period and the evidence label (the closed-trade count comes first, from the profile's own wording), and no win rate
// (on its own it can look good while the average is negative). F-6: the open positions follow in F-6's one wording
// for text (`openLine`, lib/copy.ts OPEN.line: the profile and the feed say it the same way); the picture names the
// lowest and highest instead. null when the card shows no closed-trade figures (empty or importing: the profile's own
// words stand alone, F-6 / PR-2b).
export function cardDescription(m: CardModel, openLine: string | null = null): string | null {
  if (m.body !== null) return null;
  return `${m.headline} ${m.headlineLabel}${m.range ? `, ${m.range}` : ''} · ${m.period} · ${m.evidence}${m.open && openLine ? ` · ${openLine}` : ''}`;
}
