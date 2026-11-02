// F-34 · One open-positions line on every surface (docs/features/F-34-one-open-positions-line.md, plan
// docs/features/logs/F-34/plan.md §8). One producer (lib/copy.ts#openLine, facts from lib/open-split.ts#openFacts) makes
// the line; every surface prints it byte for byte: `text` on the profile, pane and the square/story card; `withAsOf` on
// the trade and month pages, the feed card and the three link-preview descriptions; `alt` in the three image alts; the
// image form (lib/copy.ts#imageRows) on the unfurl, trade and month images. Renders app/*.tsx with react-dom/server
// through Next's SWC binding (the lib/f10-feed-card.test.ts hook).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { createRequire, registerHooks } from 'node:module';
import { join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { lex } from './source-lex.ts';

const ROOT = new URL('..', import.meta.url);
const require = createRequire(import.meta.url);
const swc = require('next/dist/build/swc') as { loadBindings: () => Promise<unknown>; transformSync: (src: string, o: object) => { code: string } };
await swc.loadBindings();
const LINK = `data:text/javascript,${encodeURIComponent("import { createElement } from 'react'; export default function Link({ href, children, prefetch: _p, ...rest }) { return createElement('a', { href, ...rest }, children); }")}`;
registerHooks({
  resolve(spec, ctx, next) {
    if (spec === 'next/link') return { url: LINK, shortCircuit: true };
    if (spec.startsWith('@/')) return next(new URL(spec.slice(2), ROOT).href, ctx);
    if (/^next\/(server|navigation|headers|cache)$/.test(spec)) return next(`${spec}.js`, ctx); // the pane's server-action imports
    if (ctx.parentURL?.startsWith('data:')) return next(spec, { ...ctx, parentURL: import.meta.url });
    return next(spec, ctx);
  },
  load(url, ctx, next) {
    if (!url.endsWith('.tsx')) return next(url, ctx);
    const file = new URL(url);
    const { code } = swc.transformSync(readFileSync(file, 'utf8'), {
      filename: file.pathname, jsc: { parser: { syntax: 'typescript', tsx: true }, transform: { react: { runtime: 'automatic' } }, target: 'es2022' }, module: { type: 'es6' },
    });
    return { format: 'module', source: code, shortCircuit: true };
  },
});
const { renderToStaticMarkup } = await import('react-dom/server' as string) as { renderToStaticMarkup: (e: unknown) => string };
const { createElement } = await import('react');
const app = (f: string) => pathToFileURL(new URL(f, ROOT).pathname).href;
const { TradeCard } = await import(app('app/ui.tsx')) as typeof import('../app/ui.tsx');
const { OpenGrid, ChartNote } = await import(app('app/open-rows.tsx')) as typeof import('../app/open-rows.tsx');
const { ProfilePane } = await import(app('app/pane.tsx')) as typeof import('../app/pane.tsx');
const { RecordStrip } = await import(app('app/record-strip.tsx')) as typeof import('../app/record-strip.tsx');
const { RecordCardImage } = await import(app('app/u/[handle]/record-card-image.tsx')) as typeof import('../app/u/[handle]/record-card-image.tsx');
const copy = await import('./copy.ts');
const { openLine, imageRows, imageText, imageTextDateFirst, OPEN_LINE, SHARE_CARD, OPEN, allCopy } = copy;
const { openFacts, openSummary, packRows } = await import('./open-split.ts');
const { recordStrip, stripFigures, STRIP_BAND, IMAGE_COLOURS } = await import('./record-strip.ts');
const { recordCard, cardAlt, cardDescription, CARD_LAYOUT } = await import('./record-card.ts');
const { tradeSharePayload, tradeStripInput, tradeBand, tradeAlt, tradeDescription } = await import('./trade-share.ts');
const { monthRecap, wholeRecord, recordStripInput, monthStripInput, monthAlt, monthDescription } = await import('./recap.ts');
const { monthBand } = await import('./month-card.ts');
const { paneModel, PANE_LINES } = await import('./pane-model.ts');
const { IMAGE_PALETTE } = await import('./palette.ts');
const { DISCLAIMER } = await import('./share.ts');
type ConfidenceInput = import('./trades.ts').ConfidenceInput;

const NB = ' ';
const NOW = new Date('2026-10-20T12:00:00Z');
const AS_OF = new Date('2026-09-30T15:00:00Z');
const FIX = [-0.15, 0.04, 0.012]; // the AC fixture: a -15% open loser
const DAY = 86_400_000, t0 = Date.UTC(2025, 0, 1);
const trades: (ConfidenceInput & { sellId: string })[] = [
  ...Array.from({ length: 40 }, (_, i) => ({ sellId: `s${i}`, symbol: `Q${i}`, openedAt: new Date(t0 + i * 3 * DAY), closedAt: new Date(t0 + (i * 3 + 2) * DAY), returnPct: i % 2 ? 0.013 : 0.005, holdingDays: 2 })),
  ...Array.from({ length: 8 }, (_, i) => ({ sellId: `t${i}`, symbol: `R${i}`, openedAt: new Date(Date.UTC(2026, 8, 2 + i)), closedAt: new Date(Date.UTC(2026, 8, 10 + i)), returnPct: -0.05, holdingDays: 8 })),
];
const line = openLine(openFacts(FIX), AS_OF)!;

// ---- small HTML helpers (renderToStaticMarkup output) ----
const decode = (s: string) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x27;/g, "'");
const strip = (html: string) => decode(html.replace(/<[^>]*>/g, ''));
// The inner HTML of every element carrying `attr` (balanced on its own tag name).
function elements(html: string, attr: string): string[] {
  const out: string[] = [];
  const re = new RegExp(`<([a-z0-9]+)\\b[^>]*\\s${attr}(?:=("[^"]*"|[^\\s>]*))?[\\s>/]`, 'g');
  for (const m of html.matchAll(re)) {
    const tag = m[1], start = html.indexOf('>', m.index!) + 1;
    let depth = 1, i = start;
    const open = new RegExp(`<${tag}\\b|</${tag}>`, 'g');
    open.lastIndex = start;
    for (let x; (x = open.exec(html));) { depth += x[0].startsWith('</') ? -1 : 1; if (!depth) { i = x.index; break; } }
    out.push(html.slice(start, i));
  }
  return out;
}
const texts = (html: string, attr: string) => elements(html, attr).map(strip);

// ---- §2a: the exact wording ----
const STATES: [string, number[], string][] = [
  ['mixed', FIX, `Still open: 3 positions · 2${NB}up, 1${NB}down · lowest -15.0%${NB}down, highest +4.0%${NB}up`],
  ['all losing', [-0.08, -0.215, -0.031], `Still open: 3 positions · 0${NB}up, 3${NB}down · lowest -21.5%${NB}down, highest -3.1%${NB}down`],
  ['all winning', [0.02, 0.15, 0.4], `Still open: 3 positions · 3${NB}up, 0${NB}down · lowest +2.0%${NB}up, highest +40.0%${NB}up`],
  ['one position', [-0.08], `Still open: 1 position · at -8.0%${NB}down`],
  ['one, flat', [0.0004], `Still open: 1 position · at 0.0%${NB}flat`],
  ['all flat', [0.0004, -0.0003], `Still open: 2 positions · 0${NB}up, 0${NB}down, 2${NB}flat · at 0.0%${NB}flat`],
  ['printed alike', [0.05, 0.0501], `Still open: 2 positions · 2${NB}up, 0${NB}down · at +5.0%${NB}up`],
  ['near -100%', [-0.99999999], `Still open: 1 position · at ≈-100.0%${NB}down`],
  ['12 positions', [-0.15, 0.04, 0.02, 0.01, -0.01, -0.01, -0.01, -0.01, -0.01, -0.01, -0.01, 0], `Still open: 12 positions · 3${NB}up, 8${NB}down, 1${NB}flat · lowest -15.0%${NB}down, highest +4.0%${NB}up`],
];
const BIG = Array.from({ length: 1204 }, (_, i) => (i % 3 ? 0.02 : -0.03));

test('F-34 §2a: openLine prints F-4\'s card line, lowest first, a word after every value, for every state', () => {
  for (const [name, pcts, text] of STATES) assert.equal(openLine(openFacts(pcts), AS_OF)!.text, text, name);
  assert.match(openLine(openFacts(BIG), AS_OF)!.text, /^Still open: 1,204 positions · 802 up, 402 down · lowest -3\.0% down, highest \+2\.0% up$/);
});

test('F-34 §2a: withAsOf, alt (commas, no "·", no parentheses) and the image form, with the year', () => {
  assert.equal(line.asOf, 'unrealized as of Sep 30, 2026');
  assert.equal(line.withAsOf, `${line.text}, unrealized as of Sep 30, 2026`);
  assert.equal(line.alt, 'Still open: 3 positions, 2 up, 1 down, lowest -15.0% down, highest +4.0% up, unrealized as of Sep 30, 2026.');
  assert.deepEqual(line.image, { title: 'Still open: 3', asOf: 'as of Sep 30, 2026' });
  for (const [, pcts] of STATES) assert.doesNotMatch(openLine(openFacts(pcts), AS_OF)!.alt, /[·() ]/);
  // The year always, in the current year too.
  assert.equal(openLine(openFacts(FIX), new Date('2026-10-19T00:00:00Z'))!.asOf, 'unrealized as of Oct 19, 2026');
});

test('F-34 §1: text is its parts joined with their separators, value and word joined by U+00A0; tones by the printed value', () => {
  for (const [name, pcts] of [...STATES, ['1,204', BIG] as [string, number[]]]) {
    const l = openLine(openFacts(pcts), AS_OF)!;
    const joined = l.parts.map((p) => p.sep + (p.value === null ? p.label : `${p.label} ${p.value}${NB}${p.word}`)).join('');
    assert.equal(l.text, joined, name);
    for (const p of l.parts) if (p.value !== null) assert.equal(p.word, p.tone && OPEN_LINE[p.tone], `${name}: word of ${p.value}`);
  }
  const [low, high] = line.parts.filter((p) => p.value !== null);
  assert.deepEqual([low.role, low.value, low.tone, high.role, high.value, high.tone], ['low', '-15.0%', 'down', 'high', '+4.0%', 'up']);
  assert.equal(openLine(openFacts([0.0004]), AS_OF)!.parts.at(-1)!.tone, 'flat');
});

test('F-34 §1: a null fact or a null date gives no line (never an undated value)', () => {
  assert.equal(openLine(null, AS_OF), null);
  assert.equal(openLine(openFacts(FIX), null), null);
  assert.equal(openFacts([]), null);
  assert.equal(openFacts([Number.NaN]), null);
  assert.deepEqual(openFacts(FIX), { n: 3, up: 2, down: 1, flat: 0, low: -0.15, high: 0.04 });
});

test('F-34 BL6: no openLine output says "all positions", "every", "holdings" or "portfolio", or names an amount or advice', () => {
  for (const [name, pcts] of [...STATES, ['1,204', BIG] as [string, number[]]]) {
    const l = openLine(openFacts(pcts), AS_OF)!;
    for (const s of [l.text, l.withAsOf, l.alt, l.image.title, l.image.asOf, imageText(l), ...(imageRows(l, 26, STRIP_BAND.width) ?? [])]) {
      assert.doesNotMatch(s, /all positions|\bevery\b|holdings|portfolio/i, name);
      assert.doesNotMatch(s, /\$|\bbuy\b|\bsell\b|\bshould\b|\brecommend/i, name);
    }
  }
});

// ---- §2b: the image rows (BL-R2-1) ----
const factsIn = (joined: string, l: ReturnType<typeof openLine> & object, pcts: number[]) => {
  const f = openFacts(pcts)!;
  const words = (s: string) => s.replace(/ /g, ' ');
  const j = words(joined);
  assert.ok(j.includes(`Still open: ${f.n.toLocaleString('en-US')}`), `count in ${j}`);
  if (f.n > 1) {
    assert.ok(j.includes(`${f.up.toLocaleString('en-US')} up`) && j.includes(`${f.down.toLocaleString('en-US')} down`), `split in ${j}`);
    if (f.flat) assert.ok(j.includes(`${f.flat} flat`), `flat in ${j}`);
  }
  for (const p of l.parts.filter((x) => x.value !== null)) assert.ok(j.includes(`${p.label} ${p.value} ${p.word}`), `${p.label} in ${j}`);
  assert.match(j, /as of [A-Z][a-z]{2} \d{1,2}, \d{4}\b/);
};
const tokens = (s: string) => s.replace(/ · |, /g, '|');

test('F-34 §2b test A: the image rows carry every fact (count, split with words, low/high or at with words, the year) at 26–35 px', () => {
  for (const [name, pcts] of [...STATES, ['1,204', BIG] as [string, number[]]]) {
    const l = openLine(openFacts(pcts), AS_OF)!;
    for (const size of [26, 28, 30, 35]) for (const width of [STRIP_BAND.width, CARD_LAYOUT.unfurl.width - 2 * CARD_LAYOUT.unfurl.padX]) {
      const rows = imageRows(l, size, width);
      if (!rows) { assert.ok(size > 30 && width === STRIP_BAND.width, `${name} fits at ${size} px in ${width}`); continue; }
      for (const r of rows) assert.ok(r.length * size * STRIP_BAND.glyph <= width, `${name} ${size}: "${r}" inside ${width}`);
      factsIn(rows.join(' / '), l, pcts);
    }
  }
});

test('F-34 §2b test B: the joined rows are imageText or imageTextDateFirst exactly, and map back to withAsOf', () => {
  for (const [name, pcts] of [...STATES, ['1,204', BIG] as [string, number[]]]) {
    const l = openLine(openFacts(pcts), AS_OF)!;
    assert.equal(imageText(l).replace(l.image.title, l.parts[0].label).replace(` · ${l.image.asOf}`, `, ${l.asOf}`), l.withAsOf, name);
    assert.ok(imageTextDateFirst(l).startsWith(`${l.image.title} · ${l.image.asOf}`), name);
    for (const size of [26, 28, 30, 35]) for (const width of [STRIP_BAND.width, 1120]) {
      const rows = imageRows(l, size, width);
      if (!rows) continue;
      const got = tokens(rows.join('|'));
      assert.ok(got === tokens(imageText(l)) || got === tokens(imageTextDateFirst(l)), `${name} ${size}/${width}: ${rows.join(' / ')}`);
      // A row never breaks inside a part, and a value never breaks from its word.
      for (const r of rows) assert.ok(!/%$/.test(r) && !/\d\.\d$/.test(r), `${name}: a row ends on a value without its word: ${r}`);
    }
  }
  // The typical 3-position unfurl takes 2 rows at 35 px (BL3); the strip band takes 3 rows at 26 px, 4 at 30 px.
  assert.deepEqual(imageRows(line, 35, 1120), [`Still open: 3 · 2${NB}up, 1${NB}down · lowest -15.0%${NB}down`, `highest +4.0%${NB}up · as of Sep 30, 2026`]);
  assert.deepEqual(imageRows(line, 26, STRIP_BAND.width), [`Still open: 3 · 2${NB}up, 1${NB}down`, `lowest -15.0%${NB}down, highest +4.0%${NB}up`, 'as of Sep 30, 2026']);
  assert.deepEqual(imageRows(line, 30, STRIP_BAND.width), [`Still open: 3 · 2${NB}up, 1${NB}down`, `lowest -15.0%${NB}down`, `highest +4.0%${NB}up`, 'as of Sep 30, 2026']);
});

test('F-34 §2b: packRows is greedy, never breaks an item and returns null when one item is wider than the row', () => {
  assert.deepEqual(packRows([{ sep: '', text: 'aaaa' }, { sep: ' · ', text: 'bb' }, { sep: ', ', text: 'cc' }], 10, 6 * 9, 0.6), ['aaaa · bb', 'cc']);
  assert.equal(packRows([{ sep: '', text: 'a'.repeat(20) }], 10, 60, 0.6), null);
});

// ---- render equality (replaces the OD 2.25 guard) ----
const model = (kind: 'unfurl' | 'square' | 'story') => recordCard({ kind, handle: 'f34_fixture', name: 'F34 Fixture', trades, state: 'connected', demo: false, verified: true, now: NOW, link: kind === 'unfurl' ? null : 'example.test/u/f34_fixture', open: FIX, openAsOf: AS_OF });
const tradeView = () => {
  const pick = trades[trades.length - 1];
  const p = tradeSharePayload({ symbol: pick.symbol, returnPct: pick.returnPct, holdingDays: pick.holdingDays, closedAt: pick.closedAt, thesis: null, thesisStatus: null, demo: false, allTrades: trades }, NOW);
  return { ...p, handle: 'f34_fixture', displayName: 'F34 Fixture', state: 'connected' as const, verified: true, open: FIX, openAsOf: AS_OF };
};
const recapView = () => {
  const recap = monthRecap(trades, '2026-09', NOW)!;
  return { handle: 'f34_fixture', displayName: 'F34 Fixture', demo: false, verified: true, state: 'connected' as const, recap, record: wholeRecord(trades, NOW), open: FIX, openAsOf: AS_OF, months: 3 };
};

test('F-34 AC1: text is byte-identical on the profile OpenGrid, the pane (JSON round-tripped model) and the square and story card', () => {
  const grid = renderToStaticMarkup(createElement(OpenGrid, { o: openSummary(FIX)!, asOf: AS_OF, line }));
  assert.deepEqual(texts(grid, 'data-open-line'), [line.text]);
  const m = JSON.parse(JSON.stringify(paneModel(trades.map((t) => ({ ...t, id: t.sellId, thesis: null, verified: true })), 'connected', NOW, FIX, AS_OF)));
  assert.deepEqual(m.openLine, { text: line.text, parts: line.parts, withAsOf: line.withAsOf });
  const pane = renderToStaticMarkup(createElement(ProfilePane, { handle: 'f34_fixture', name: 'F34 Fixture', model: m, now: NOW, state: 'connected' }));
  assert.deepEqual(texts(pane, 'data-open-line'), [line.text]);
  for (const kind of ['square', 'story'] as const) {
    const c = model(kind);
    assert.equal(c.open!.line.text, line.text);
    const html = renderToStaticMarkup(createElement(RecordCardImage, { m: c, disclaimer: DISCLAIMER }));
    assert.equal(texts(html, 'data-open-text').join(''), line.text, kind);
    assert.deepEqual(texts(html, 'data-open-asof'), [line.asOf], kind);
  }
});

test('F-34 AC1: withAsOf is byte-identical on the trade and month page strips, the feed card and the three descriptions', () => {
  const t = tradeView(), r = recapView();
  const tradeStrip = recordStrip(tradeStripInput(t), 'page'), monthStrip = recordStrip(recordStripInput(r), 'page');
  for (const s of [tradeStrip, monthStrip]) {
    assert.equal(s.open!.withAsOf, line.withAsOf);
    assert.deepEqual(texts(renderToStaticMarkup(createElement(RecordStrip, { strip: s })), 'data-open-line'), [line.withAsOf]);
  }
  const row = { id: '1', symbol: 'ACME', return_pct: -0.052, holding_days: 3.4, closed_at: new Date(Date.UTC(2026, 9, 18)), verified: true, thesis: null, thesis_status: null, handle: 'f34_fixture', display_name: 'F34 Fixture', user_id: 1 };
  const card = renderToStaticMarkup(createElement(TradeCard, { t: row, state: 'connected', open: FIX, openAsOf: AS_OF, now: NOW }));
  assert.deepEqual(texts(card, 'data-open'), [line.withAsOf]);
  assert.doesNotMatch(card, /Also open/);
  const unfurl = model('unfurl');
  assert.ok(cardDescription(unfurl, unfurl.open!.line.withAsOf)!.endsWith(` · ${line.withAsOf}`));
  assert.ok(tradeDescription(t, recordStrip(tradeStripInput(t), 'image')).includes(line.withAsOf));
  assert.ok(monthDescription(r, recordStrip(recordStripInput(r), 'image')).includes(line.withAsOf));
});

test('F-34 AC1: the alt form is byte-identical in cardAlt, tradeAlt and monthAlt (EN2: commas, no "·", no parentheses)', () => {
  const t = tradeView(), r = recapView();
  const whole = recordStrip(recordStripInput(r), 'image');
  for (const kind of ['unfurl', 'square', 'story'] as const) assert.ok(cardAlt(model(kind)).includes(line.alt), kind);
  const ta = tradeAlt(t, recordStrip(tradeStripInput(t), 'image')), ma = monthAlt(r, whole, recordStrip(monthStripInput(r), 'figures'));
  for (const a of [ta, ma]) {
    assert.ok(a.includes(line.alt), a);
    assert.doesNotMatch(a.slice(a.indexOf('Still open')), /[·()]/);
  }
});

test('F-34 AC1: the image form on the unfurl, trade and month images is imageRows of the same line', () => {
  const u = model('unfurl');
  const rows = imageRows(u.open!.line, CARD_LAYOUT.unfurl.font.body, CARD_LAYOUT.unfurl.width - 2 * CARD_LAYOUT.unfurl.padX)!;
  assert.deepEqual(u.open!.rows, rows);
  assert.deepEqual(texts(renderToStaticMarkup(createElement(RecordCardImage, { m: u, disclaimer: DISCLAIMER })), 'data-open-row'), rows);
  const t = tradeView(), r = recapView();
  const tb = tradeBand(t, recordStrip(tradeStripInput(t), 'image'));
  const mb = monthBand(r, recordStrip(recordStripInput(r), 'image'), recordStrip(monthStripInput(r), 'figures'));
  for (const [name, b] of [['trade', tb], ['month', mb]] as const) {
    assert.ok(b.fits && !b.tooWide.length, name);
    const open = b.lines.filter((l) => l.role.startsWith('open'));
    assert.deepEqual(open.map((l) => l.text), imageRows(line, open[0].size, STRIP_BAND.width), name);
    assert.ok(open.every((l) => l.block === 'open'), name);
    assert.deepEqual(open.map((l) => l.spans!.map((s) => s.text).join('')), open.map((l) => l.text), `${name}: the spans spell the row`);
  }
});

test('F-34 AC2/AC4: every image row set and alt with a value carries the as-of date with its year (current and prior year)', () => {
  for (const asOf of [AS_OF, new Date('2025-12-30T10:00:00Z')]) {
    const l = openLine(openFacts(FIX), asOf)!;
    for (const size of [26, 28, 30, 35]) assert.match(imageRows(l, size, 1120)!.join(' '), /as of [A-Z][a-z]{2} \d{1,2}, \d{4}/);
    assert.match(l.alt, /as of [A-Z][a-z]{2} \d{1,2}, \d{4}/);
    const t = { ...tradeView(), openAsOf: asOf }, r = { ...recapView(), openAsOf: asOf };
    const tb = tradeBand(t, recordStrip(tradeStripInput(t), 'image')).lines.filter((x) => x.role.startsWith('open')).map((x) => x.text).join(' ');
    const mb = monthBand(r, recordStrip(recordStripInput(r), 'image'), recordStrip(monthStripInput(r), 'figures')).lines.filter((x) => x.role.startsWith('open')).map((x) => x.text).join(' ');
    for (const s of [tb, mb, tradeAlt(t, recordStrip(tradeStripInput(t), 'image')), cardAlt(recordCard({ kind: 'unfurl', handle: 'f34_fixture', name: null, trades, state: 'connected', demo: false, verified: true, now: NOW, link: null, open: FIX, openAsOf: asOf }))]) {
      assert.match(s, new RegExp(`as of [A-Z][a-z]{2} \\d{1,2}, ${asOf.getUTCFullYear()}`), s);
    }
  }
});

test('F-34 AC6: the down value on images takes the F-20 image colour table (strip and card), never a literal', () => {
  const t = tradeView();
  const spans = tradeBand(t, recordStrip(tradeStripInput(t), 'image')).lines.flatMap((l) => l.spans ?? []);
  const down = spans.find((s) => s.text.includes('-15.0%'))!;
  assert.equal(down.tone, 'down');
  assert.equal(IMAGE_COLOURS[down.tone], IMAGE_PALETTE.strip.down);
  assert.equal(spans.find((s) => s.text.includes('+4.0%'))!.tone, 'up');
  for (const kind of ['unfurl', 'square', 'story'] as const) {
    const html = renderToStaticMarkup(createElement(RecordCardImage, { m: model(kind), disclaimer: DISCLAIMER }));
    const vals = [...html.matchAll(/<span[^>]*data-open-value="(up|down|flat)"[^>]*style="([^"]*)"[^>]*>([^<]*)</g), ...html.matchAll(/<span[^>]*style="([^"]*)"[^>]*data-open-value="(up|down|flat)"[^>]*>([^<]*)</g)];
    const downVal = html.match(/<span[^>]*data-open-value="down"[^>]*>/g);
    assert.ok(downVal?.length, `${kind}: a down value`);
    for (const tag of downVal!) assert.match(tag, new RegExp(`color:${IMAGE_PALETTE.card.down}`, 'i'), kind);
    assert.ok(vals.length >= 2, kind);
  }
});

test('F-34 §7: the pane lines are in one fixed order, and an absent slot renders nothing', () => {
  assert.deepEqual([...PANE_LINES], ['exclusions', 'open', 'options']);
  const m = JSON.parse(JSON.stringify(paneModel(trades.map((t) => ({ ...t, id: t.sellId, thesis: null, verified: true })), 'connected', NOW, FIX, AS_OF)));
  const html = renderToStaticMarkup(createElement(ProfilePane, { handle: 'f34_fixture', name: 'F34 Fixture', model: m, now: NOW, state: 'connected' }));
  assert.deepEqual([...html.matchAll(/data-pane-line="([a-z]+)"/g)].map((x) => x[1]), ['open']);
  const none = JSON.parse(JSON.stringify(paneModel(trades.map((t) => ({ ...t, id: t.sellId, thesis: null, verified: true })), 'connected', NOW, [], null)));
  assert.equal(none.openLine, null);
  assert.doesNotMatch(renderToStaticMarkup(createElement(ProfilePane, { handle: 'f34_fixture', name: 'F34 Fixture', model: none, now: NOW, state: 'connected' })), /data-pane-line|data-open/);
});

test('F-34 BL6: the chart note drops its open-figure tail', () => {
  assert.equal(strip(renderToStaticMarkup(createElement(ChartNote, { o: openSummary(FIX)! }))), 'Chart: closed trades only. Not plotted: open positions.');
  assert.equal(OPEN_LINE.chartNoteTail, 'open positions.');
});

test('F-34 EN6: openCopy lists the openLine outputs, and the retired keys are gone', () => {
  const all = allCopy();
  for (const [, pcts] of STATES) { const l = openLine(openFacts(pcts), AS_OF)!; for (const s of [l.text, l.withAsOf, l.alt]) assert.ok(all.includes(s), s); }
  for (const k of ['openShort', 'openNote', 'openAlt']) assert.ok(!(k in SHARE_CARD), k);
  for (const k of ['feedLabel', 'feedCounts', 'feedTail']) assert.ok(!(k in OPEN), k);
  assert.equal(copy.RECORD_BODY.failedShort, 'This record may be incomplete.');
  assert.ok(copy.RECORD_BODY.failed.endsWith(copy.RECORD_BODY.failedShort.replace(/^This/, 'this')));
});

// ---- the single-producer source scan (string literals and JSX text, never comments) ----
const SRC_ROOT = fileURLToPath(ROOT);
function sources(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) sources(p, out);
    else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$|\.d\.ts$/.test(e.name)) out.push(p);
  }
  return out;
}
const FILES = [...sources(join(SRC_ROOT, 'app')), ...sources(join(SRC_ROOT, 'lib'))].map((p) => ({ path: relative(SRC_ROOT, p), src: readFileSync(p, 'utf8') }));
// Code with comments blanked: string literals plus JSX text and identifiers (lib/source-lex.ts keeps literals apart).
const scan = (src: string) => { const l = lex(src); return { literals: l.literals.map((x) => x.text), code: l.code }; };

test('F-34 AC8: one producer: "Still open", "as of", "open, unrealized" and "avg unrealized" appear only in lib/copy.ts (literals, not comments)', () => {
  const hits: string[] = [];
  for (const f of FILES) {
    if (f.path === 'lib/copy.ts') continue;
    const { literals, code } = scan(f.src);
    const jsxText = code.replace(/\{[^{}]*\}/g, ' ');
    for (const s of [...literals, jsxText]) for (const w of ['Still open', 'as of', 'open, unrealized', 'avg unrealized']) if (s.includes(w)) hits.push(`${f.path}: ${w}`);
  }
  assert.deepEqual(hits, []);
});

test('F-34 AC8: openFull is read only by openLine, OPEN.line only under app/t/**, packRows only by imageRows; the image paths call imageRows', () => {
  const uses = (re: RegExp) => FILES.filter((f) => re.test(scan(f.src).code)).map((f) => f.path).sort();
  assert.deepEqual(uses(/\bopenFull\b/), ['lib/copy.ts']);
  const copySrc = scan(readFileSync(new URL('./copy.ts', import.meta.url), 'utf8')).code;
  const block = copySrc.slice(copySrc.indexOf('export function openLine('), copySrc.indexOf('// end openLine'));
  assert.ok(block.length > 100 && /openFull\(/.test(block), 'openFull is read inside the openLine block');
  assert.equal([...copySrc.matchAll(/openFull\(/g)].length, [...block.matchAll(/openFull\(/g)].length, 'openFull read only inside the openLine block');
  assert.deepEqual(uses(/\bOPEN\.line\(/).filter((p) => !p.startsWith('app/t/') && p !== 'lib/copy.ts'), []);
  assert.deepEqual(uses(/\bpackRows\(/), ['lib/copy.ts', 'lib/open-split.ts']);
  assert.ok(/packRows\(/.test(block), 'imageRows calls packRows');
  for (const p of ['lib/record-card.ts', 'lib/record-strip.ts']) assert.ok(uses(/\bimageRows\(/).includes(p), `${p} calls imageRows`);
});
