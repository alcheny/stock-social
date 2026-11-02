// F-21 · the surfaces (render, no database): the pane line right after the headline, the strip line on trade and month
// pages only, feed cards with exactly one record line (D22) and no exclusions line, the images and the strip's text and
// alt unchanged by construction, and the profile's #excluded section whose reason counts add up to its heading.
// Same module hook as lib/f10-feed-card.test.ts: .tsx through Next's SWC binding, `@/` to the repo root, next/link a <a>.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { createRequire, registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';

const ROOT = new URL('..', import.meta.url);
const require = createRequire(import.meta.url);
const swc = require('next/dist/build/swc') as { loadBindings: () => Promise<unknown>; transformSync: (src: string, o: object) => { code: string } };
await swc.loadBindings();
const LINK = `data:text/javascript,${encodeURIComponent("import { createElement } from 'react'; export default function Link({ href, children, prefetch: _p, ...rest }) { return createElement('a', { href, ...rest }, children); }")}`;
registerHooks({
  resolve(spec, ctx, next) {
    if (spec === 'next/link') return { url: LINK, shortCircuit: true };
    if (spec.startsWith('@/')) return next(new URL(spec.slice(2), ROOT).href, ctx);
    if (/^next\/[a-z-]+$/.test(spec)) return next(`${spec}.js`, ctx); // the feed rows' client parts import next/navigation
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
const { createElement: h } = await import('react');
const app = async <T,>(f: string) => await import(pathToFileURL(new URL(f, ROOT).pathname).href) as T;
const { ProfilePane } = await app<typeof import('../app/pane.tsx')>('app/pane.tsx');
const { RecordStrip } = await app<typeof import('../app/record-strip.tsx')>('app/record-strip.tsx');
const { ExcludedSection } = await app<typeof import('../app/u/[handle]/excluded-section.tsx')>('app/u/[handle]/excluded-section.tsx');
const { feedRowNodes } = await app<typeof import('../app/feed-rows.tsx')>('app/feed-rows.tsx');
const { recordStrip, stripFigures, stripImageLines } = await import('./record-strip.ts');
const { EXCLUSIONS, OPTIONS } = await import('./copy.ts');
const { exclusionTotal } = await import('./exclusions.ts');
const { paneModel } = await import('./pane-model.ts');

const DAY = 86_400_000, now = new Date(Date.UTC(2026, 10, 1)), t0 = Date.UTC(2026, 0, 1);
const trades = Array.from({ length: 12 }, (_, i) => ({ id: String(i + 1), symbol: `R${i}`, returnPct: (i % 3 - 1) / 50 || 0.01, holdingDays: 2,
  closedAt: new Date(t0 + (i * 3 + 2) * DAY), openedAt: new Date(t0 + i * 3 * DAY), thesis: null, verified: true }));
const pane = (o: Record<string, unknown> = {}) => renderToStaticMarkup(h(ProfilePane, { handle: 'f21_pane', name: 'Pane Fixture', trades, now, ...o }));
const order = (html: string, marks: string[]) => marks.map((m) => html.indexOf(m));

test('F-21 pane: the line sits right after the headline stats in both orders, is a real link to #excluded, and is absent at 0 or while importing', () => {
  const line = `<p class="muted small exclusions-line" data-exclusions="true"><a href="/u/f21_pane#excluded" class="tap44">${EXCLUSIONS.line(2)}</a></p>`;
  for (const open of [undefined, [0.05, -0.02]]) {
    const html = pane({ excluded: 2, open, openAsOf: open && now });
    assert.equal(html.split('data-exclusions').length - 1, 1);
    assert.ok(html.includes(`</section>${line}`), html.slice(Math.max(0, html.indexOf('data-exclusions') - 300), html.indexOf('data-exclusions') + 300));
    if (open) {
      // Open-positions order (decision 10): stats, exclusions, open block, then the disclaimer.
      const [stats, ex, grid, f3] = order(html, ['class="stats"', 'data-exclusions', 'class="stats open-stats"', 'Not investment advice']);
      assert.ok(stats < ex && ex < grid && grid < f3, `${stats} ${ex} ${grid} ${f3}`);
    }
  }
  assert.doesNotMatch(pane({ excluded: 0 }), /data-exclusions/);
  assert.doesNotMatch(pane(), /data-exclusions/);
  assert.doesNotMatch(pane({ excluded: 3, state: 'importing' }), /data-exclusions/);
  // The lazy pane renders the route's model; a model without the field (a body cached before F-21) reads as 0.
  const model = paneModel(trades, 'connected', now, [], null, 4);
  assert.equal(model.excluded, 4);
  assert.match(pane({ model }), new RegExp(EXCLUSIONS.line(4)));
  const { excluded: _e, ...old } = model;
  assert.doesNotMatch(pane({ model: old }), /data-exclusions/);
  assert.equal(paneModel(trades, 'importing', now, [], null, 4).excluded, 0);
  assert.ok(Number.isInteger(paneModel(trades, 'connected', now, [], null, 2.7).excluded));
});

test('F-21 strip: the line rides the page surface only, right after the F3 line (which stays right after the figures); never feed, image, figures or importing', () => {
  const f = stripFigures(trades.map((t) => ({ ...t })), now);
  const base = { ...f, state: 'connected' as const, demo: false, verified: true, handle: 'f21_pane' };
  const page = renderToStaticMarkup(h(RecordStrip, { strip: recordStrip(base, 'page'), exclusions: { n: 1, handle: 'f21_pane' } }));
  const [fig, ex, f3] = order(page, ['data-strip', 'data-exclusions', 'data-disclaimer']);
  assert.ok(fig < f3 && f3 < ex, page); // fixes-labels AC8: [data-strip] + [data-disclaimer]
  assert.ok(page.includes(EXCLUSIONS.line(1)));
  for (const s of ['feed', 'figures'] as const) assert.doesNotMatch(renderToStaticMarkup(h(RecordStrip, { strip: recordStrip(base, s), exclusions: { n: 1, handle: 'x' } })), /data-exclusions/);
  assert.doesNotMatch(renderToStaticMarkup(h(RecordStrip, { strip: recordStrip({ ...base, state: 'importing' }, 'page'), exclusions: { n: 1, handle: 'x' } })), /data-exclusions/);
  assert.equal(renderToStaticMarkup(h(RecordStrip, { strip: recordStrip(base, 'page'), exclusions: { n: 0, handle: 'x' } })), renderToStaticMarkup(h(RecordStrip, { strip: recordStrip(base, 'page') })));
  // The strip's figures, text, alt and image lines take no exclusion input at all: identical for every surface.
  for (const s of ['feed', 'image', 'figures', 'page'] as const) {
    const a = recordStrip(base, s), b = recordStrip({ ...base, excluded: 9 } as typeof base, s);
    assert.deepEqual([a.text, a.alt, a.figures], [b.text, b.alt, b.figures], s);
    if (s === 'image') assert.deepEqual(stripImageLines(a, { handle: 'f21_pane', newRecord: false, hero: [] }), stripImageLines(b, { handle: 'f21_pane', newRecord: false, hero: [] }));
    assert.doesNotMatch(`${a.text} ${a.alt}`, /excluded from these figures/);
  }
});

test('F-21 AC (feed cards, D22): each card holds exactly one record line and no exclusions line; the card markup is unchanged; the pane has the line', () => {
  const card = { id: 1, sell_id: 'f21-s1', symbol: 'R1', return_pct: 0.02, holding_days: 2, closed_at: trades[11].closedAt, verified: true, thesis: null, thesis_status: null,
    handle: 'f21_feed', display_name: 'Feed Fixture', user_id: 77, score: 1, explore: false };
  const page = (excluded: number) => ({ cards: [card], offset: 20, asOf: now, next: null, from: 21, to: 21, byUser: new Map([[77, trades]]),
    records: new Map([[77, { state: 'connected' }]]), strips: new Map([[77, stripFigures(trades, now)]]), exclusions: new Map([[77, excluded]]) });
  const render = (n: number) => renderToStaticMarkup(h('div', null, ...feedRowNodes(page(n) as never).map((r) => r.node)));
  const withLine = render(3), without = render(0);
  const cardOf = (html: string) => html.slice(0, html.indexOf('<section class="pane"'));
  assert.ok(cardOf(withLine).length > 100);
  assert.equal(cardOf(withLine).split('data-strip').length - 1, 1, 'one record line on the card');
  assert.doesNotMatch(cardOf(withLine), /data-exclusions|excluded from these figures/);
  assert.equal(cardOf(withLine), cardOf(without), 'the card is byte-identical');
  assert.ok(withLine.slice(withLine.indexOf('<section class="pane"')).includes(EXCLUSIONS.line(3)), 'the pane carries the line');
});

test('F-21: the share card and the trade, month and stock images never read the exclusion sum (source scan)', () => {
  const og: string[] = [];
  const walk = (d: URL) => { for (const f of readdirSync(d)) { const u = new URL(f, d); if (statSync(u).isDirectory()) walk(new URL(`${f}/`, d)); else if (/opengraph-image|record-card-image|share-card|card-image/.test(f)) og.push(u.pathname); } };
  walk(new URL('app/', ROOT));
  assert.ok(og.length >= 4, og.join());
  const READS_SUM = /EXCLUSIONS|exclusionTotal|exclusionReasons|lineCount|exclusions(-load)?\.ts|ExclusionsLine|\.excluded\b/;
  for (const f of og) assert.doesNotMatch(readFileSync(f, 'utf8'), READS_SUM, f);
  for (const f of ['lib/record-strip.ts', 'lib/record-card.ts', 'lib/month-card.ts']) assert.doesNotMatch(readFileSync(new URL(f, ROOT), 'utf8'), READS_SUM, f);
});

test('F-21 line look: muted, underlined, no warning colour, no icon (source scan of the component and its CSS)', () => {
  const src = readFileSync(new URL('app/exclusions-line.tsx', ROOT), 'utf8').replace(/^\/\/.*$/gm, '');
  assert.doesNotMatch(src, /warn|loss|down|<svg|icon|WarnNotice|aria-hidden/i);
  assert.match(src, /className="muted small exclusions-line"/);
  const css = readFileSync(new URL('app/globals.css', ROOT), 'utf8');
  const block = css.slice(css.indexOf('/* ---- F-21'), css.indexOf('/* ---- end F-21 ---- */'));
  assert.ok(block.length > 100);
  assert.doesNotMatch(block, /#[0-9a-f]{3,6}\b|rgb\(|hsl\(|--warn|--loss|--down|--accent/i);
  assert.match(block, /\.exclusions-line a \{ color: var\(--muted\); text-decoration: underline;/);
  // Not optional: no prop, setting or flag turns the line off.
  assert.doesNotMatch(src, /hide|show\w*=|enabled|setting/i);
});

test('F-21 profile #excluded (R1, R4): the heading equals the summed reason counts in both gate states; focus target; held via PROFILE.excludedHeld', () => {
  const opts = { shown: 2, short: 1, other: 1, openLong: 1, openShort: 1, openOther: 1, unsupported: 0, exerciseShares: 1 };
  const c = { excluded_positions: 1, excluded_future_sells: 1, excluded_corporate: 2, excluded_held: 1, excluded_shared: 1, public: null, options: opts };
  for (const gate of ['open', 'closed'] as const) {
    const html = renderToStaticMarkup(h(ExcludedSection, { c: { ...c, gate } }));
    const n = exclusionTotal({ ...c, gate });
    assert.ok(html.startsWith('<section id="excluded" tabindex="-1" aria-labelledby="excluded-h"'), html.slice(0, 120));
    assert.ok(html.includes(`<h2 id="excluded-h" class="small">${EXCLUSIONS.title(n)}</h2>`));
    const sum = [...html.matchAll(/data-n="(\d+)"/g)].reduce((a, m) => a + Number(m[1]), 0);
    assert.equal(sum, n, gate);
    assert.match(html, /data-excluded-held/);
    if (gate === 'closed') {
      assert.ok(html.includes(OPTIONS.gated(4, 3).replace(/'/g, '&#x27;')));
      assert.doesNotMatch(html, /options-short|options-technical|options-open-other|options-summarized/);
    } else {
      assert.doesNotMatch(html, /options-gated/);
      for (const k of ['options-summarized', 'options-short', 'options-technical', 'options-open-other']) assert.match(html, new RegExp(k));
    }
  }
  // Nothing excluded: no section (only a context line about open options, if any).
  const zero = { excluded_positions: 0, excluded_future_sells: 0, excluded_corporate: 0, excluded_held: 0, excluded_shared: 0, public: null };
  assert.equal(renderToStaticMarkup(h(ExcludedSection, { c: { ...zero, options: { ...opts, shown: 0, short: 0, other: 0, exerciseShares: 0, openOther: 0, openShort: 0 }, gate: 'open' } })), '');
  // Open options only: their context line, counted 0, with no heading.
  assert.equal(renderToStaticMarkup(h(ExcludedSection, { c: { ...zero, options: { ...opts, shown: 0, short: 0, other: 0, exerciseShares: 0, openOther: 0 }, gate: 'open' } })),
    `<p class="muted options-short" data-reason="options.short" data-n="0">${OPTIONS.short(0, 1)}</p>`);
  assert.doesNotMatch(renderToStaticMarkup(h(ExcludedSection, { c: { ...zero, options: { ...opts, shown: 0, short: 0, other: 0, exerciseShares: 0 }, gate: 'closed' } })), /id="excluded"/);
  // RowFocus takes #excluded as well as the trade rows.
  assert.match(readFileSync(new URL('app/u/[handle]/row-focus.tsx', ROOT), 'utf8'), /\/\^\(trade-\\d\+\|excluded\)\$\//);
});
