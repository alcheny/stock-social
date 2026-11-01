// F-10 AC1 / AC9 (plan §3, §7): the feed card's record strip is real text in the card's hero, after the return, never
// aria-hidden, and it replaces the "held … · closed …" line; without a strip (other callers) the card is unchanged.
// Renders app/ui.tsx with react-dom/server. Node strips types from .ts but not JSX from .tsx, so this file registers a
// small module hook for the test process only: .tsx goes through Next's own SWC binding, `@/` resolves to the repo root
// and next/link is a plain <a> (the router plays no part in the markup under test).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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

const { renderToStaticMarkup } = await import('react-dom/server' as string) as { renderToStaticMarkup: (e: unknown) => string }; // no @types/react-dom here
const { createElement } = await import('react');
const { TradeCard } = await import(pathToFileURL(new URL('app/ui.tsx', ROOT).pathname).href) as typeof import('../app/ui.tsx');
const { recordStrip, stripFigures } = await import('./record-strip.ts');
type ConfidenceInput = import('./trades.ts').ConfidenceInput;

const DAY = 86_400_000;
const t0 = Date.UTC(2026, 0, 1);
const now = new Date(Date.UTC(2026, 10, 1));
const rec = (k: number, f: (i: number) => number): ConfidenceInput[] => Array.from({ length: k }, (_, i) => ({
  symbol: `R${i}`, openedAt: new Date(t0 + i * 3 * DAY), closedAt: new Date(t0 + (i * 3 + 2) * DAY), returnPct: f(i), holdingDays: 2,
}));
const row = { id: '1', symbol: 'ACME', return_pct: -0.052, holding_days: 3.4, closed_at: new Date(Date.UTC(2026, 9, 30)), verified: true,
  thesis: null, thesis_status: null, handle: 'strip_card', display_name: 'Strip Card', user_id: 1 };
const stripOf = (trades: ConfidenceInput[]) => recordStrip({ ...stripFigures(trades, now), state: 'connected', demo: false, verified: true, handle: row.handle }, 'feed');
const render = (strip?: ReturnType<typeof stripOf>) => renderToStaticMarkup(createElement(TradeCard, { t: row, state: 'connected', strip }));
const figures = (p: string) => text(p.replace(/<span class="badge [^"]*"[^>]*>[^<]*<\/span> /, ''));
const text = (html: string) => html.replace(/<[^>]+>/g, '').replace(/&#x27;/g, "'").replace(/&amp;/g, '&');

test('F-10 AC1/AC9: a card given a strip shows it as real text in the hero, after the return, with no "held … · closed" line', () => {
  const strip = stripOf(rec(40, (i) => 0.009 + (i % 2 ? 0.004 : -0.004)));
  const html = render(strip);
  const hero = html.match(/<div class="hero">([\s\S]*?)<\/div><p class="thesis">/)?.[1] ?? '';
  assert.match(hero, /<p class="record-strip" data-strip(="[^"]*")?>/);
  // Reading order: symbol, return, then the strip; the thesis follows the hero.
  assert.ok(hero.indexOf('ACME') < hero.indexOf('-5.2%') && hero.indexOf('-5.2%') < hero.indexOf('data-strip'), hero);
  const p = hero.slice(hero.indexOf('<p class="record-strip"'));
  assert.doesNotMatch(p.slice(0, p.indexOf('>')), /aria-hidden/);
  assert.match(figures(p), /^40 closed trades · \+0\.9% average per trade \([+-]\d+\.\d% to [+-]\d+\.\d%\) · 95% range$/);
  assert.equal(figures(p), strip.text);
  assert.doesNotMatch(html, /held \S+ · closed/);
  assert.doesNotMatch(text(html), /held /);
});

test('F-10 AC2: a short record\'s card says "Too early to tell" in bold, with the count and no percent in the strip', () => {
  const html = render(stripOf(rec(3, () => 0.2)));
  const p = html.slice(html.indexOf('<p class="record-strip"'), html.indexOf('</p>', html.indexOf('<p class="record-strip"')));
  assert.equal(figures(p), '3 closed trades · Too early to tell');
  assert.match(p, /<b data-role="early">Too early to tell<\/b>/);
  assert.doesNotMatch(text(p), /%/);
});

test('DS-22 (PR #48): with a strip, the trust badge leads the record line in .hero and leaves the header (never inside .who)', () => {
  const html = render(stripOf(rec(40, (i) => 0.009 + (i % 2 ? 0.004 : -0.004))));
  const header = html.match(/<header>([\s\S]*?)<\/header>/)?.[1] ?? '';
  assert.doesNotMatch(header, /class="badge/);
  const p = html.slice(html.indexOf('<p class="record-strip"'), html.indexOf('</p>', html.indexOf('<p class="record-strip"')));
  assert.match(p, /^<p class="record-strip" data-strip(="[^"]*")?><span class="badge verified"[^>]*>✓ Verified<\/span> <span><span data-role="count">/);
  // Demo records keep the .badge.demo class; a failed import shows no badge and no stray space.
  const demo = renderToStaticMarkup(createElement(TradeCard, { t: { ...row, verified: false }, state: 'connected', strip: stripOf(rec(3, () => 0.1)) }));
  assert.match(demo, /<p class="record-strip" data-strip(="[^"]*")?><span class="badge demo"/);
  const failed = renderToStaticMarkup(createElement(TradeCard, { t: row, state: 'failed', strip: stripOf(rec(3, () => 0.1)) }));
  assert.match(failed, /<p class="record-strip" data-strip(="[^"]*")?><span><span data-role="count">/);
  assert.doesNotMatch(failed, /class="badge/);
});

test('F-10: a card without a strip (other callers) keeps its "held … · closed …" line and has no strip', () => {
  const html = render();
  assert.match(text(html), /held 3\.4d · closed Oct 30/);
  assert.doesNotMatch(html, /data-strip|record-strip/);
  assert.match(html.match(/<header>([\s\S]*?)<\/header>/)?.[1] ?? '', /class="badge verified"/);
});
