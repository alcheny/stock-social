// F-10 follow-ups (approval cycle 2, "Fixes to build now" #15, #16, #18, #23): the pure focus rules (lib/feed-focus.ts),
// the hero figure's length cap and the card date's year rule, rendered through app/ui.tsx as lib/f10-feed-card.test.ts
// does (Next's SWC binding for .tsx, `@/` from the repo root, next/link as a plain <a>), and the stylesheet's rules.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
import { closesSignInBar, focusAfterKey, paneInert, restsOnCard, retEms, RET_EM_PER_CHAR } from './feed-focus.ts';
import { pct } from './trades.ts';

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
const { renderToStaticMarkup } = await import('react-dom/server' as string) as { renderToStaticMarkup: (e: unknown) => string };
const { createElement } = await import('react');
const { TradeCard, closedDay } = await import(pathToFileURL(new URL('app/ui.tsx', ROOT).pathname).href) as typeof import('../app/ui.tsx');

const row = { id: '1', symbol: 'ACME', return_pct: 0.052, holding_days: 3.4, closed_at: new Date(Date.UTC(2026, 9, 30)), verified: true,
  thesis: null, thesis_status: null, handle: 'f10f_card', display_name: 'F10F Card', user_id: 1 };
const card = (t: Partial<typeof row>, now: Date) => renderToStaticMarkup(createElement(TradeCard, { t: { ...row, ...t }, state: 'connected', now }));
const css = readFileSync(new URL('app/globals.css', ROOT), 'utf8');
const block = css.slice(css.indexOf('/* F-10 follow-ups'));

test('#23: a close in the current UTC year shows month and day; any other year adds the year', () => {
  const now = new Date(Date.UTC(2026, 10, 1, 12));
  assert.equal(closedDay(new Date(Date.UTC(2026, 4, 30, 15)), now), 'May 30');
  assert.equal(closedDay(new Date(Date.UTC(2020, 4, 30, 15)), now), 'May 30, 2020');
  assert.equal(closedDay(new Date(Date.UTC(2025, 11, 31, 12)), now), 'Dec 31, 2025');
});

test('#23: the year is decided in UTC at both ends of New Year, never in the server\'s zone', () => {
  // 23:30 UTC on Dec 31 is still last year in UTC (already Jan 1 east of UTC); 00:30 UTC on Jan 1 is this year.
  const jan1 = new Date(Date.UTC(2027, 0, 1, 0, 30));
  assert.equal(closedDay(new Date(Date.UTC(2026, 11, 31, 23, 30)), jan1), 'Dec 31, 2026');
  assert.equal(closedDay(new Date(Date.UTC(2027, 0, 1, 0, 10)), jan1), 'Jan 1');
  // "now" late on Dec 31 UTC: a Jan 1 close of that year has no year; the same day a year earlier has one.
  const dec31 = new Date(Date.UTC(2026, 11, 31, 23, 59));
  assert.equal(closedDay(new Date(Date.UTC(2026, 0, 1, 0, 0)), dec31), 'Jan 1');
  assert.equal(closedDay(new Date(Date.UTC(2025, 11, 31, 23, 59)), dec31), 'Dec 31, 2025');
});

test('#23: the card\'s "held · closed" line (no strip) carries the year for a close in another year only', () => {
  const now = new Date(Date.UTC(2026, 10, 1));
  assert.match(card({}, now), /held 3\.4d · closed Oct 30</);
  assert.match(card({ closed_at: new Date(Date.UTC(2020, 4, 30)) }, now), /held 3\.4d · closed May 30, 2020</);
});

test('#18: the hero figure carries its length cap (--ret-em) from the printed return', () => {
  const now = new Date(Date.UTC(2026, 10, 1));
  for (const r of [0.052, 123.456, -0.99999999, -0.0412]) {
    const shown = pct(r), html = card({ return_pct: r }, now);
    const m = html.match(/<div class="ret (up|down)" style="--ret-em:([\d.]+)">([^<]+)<\/div>/);
    assert.ok(m, html);
    assert.equal(m[3], shown);
    assert.equal(Number(m[2]), retEms(shown));
  }
  assert.equal(pct(123.456), '+12345.6%');
  assert.equal(pct(-0.99999999), '≈-100.0%');
});

test('#18: the cap leaves ≥ 15% of the hero width spare for the longest returns at 320 and 360 px, and leaves short ones at the clamp() size', () => {
  // Measured in Chromium: at most 0.68 em per character in DejaVu Sans (the e2e font), 0.61 em in Inter. Both keep ≥ 15% of the hero's width spare, for every length up to "+123456.7%".
  for (const em of [0.61, 0.68]) {
    for (const s of ['+61.0%', '+100.0%', '+12345.6%', '≈-100.0%', '-99.9876%', '+123456.7%']) {
      for (const vw of [320, 360, 414]) {
        const hero = vw - 40; // .feed .row > * pads max(20px, …) each side below 600 px
        const size = Math.min(Math.max(64, 0.22 * vw), 120, hero / retEms(s));
        assert.ok([...s].length * em * size <= hero * 0.85 + 0.5, `${s} at ${vw} (${em} em): ${([...s].length * em * size).toFixed(1)} of ${hero}`);
      }
    }
  }
  // A 5-character figure ("+5.2%") stays within 5% of the clamp() size at 320 and 360, and keeps it at 414.
  for (const vw of [320, 360]) assert.ok((vw - 40) / retEms('+5.2%') >= 0.95 * 0.22 * vw, String(vw));
  assert.ok((414 - 40) / retEms('+5.2%') >= 0.22 * 414);
  assert.equal(RET_EM_PER_CHAR, 0.82);
  assert.match(block, /\.card \.hero \{ container-type: inline-size; \}/);
  assert.match(block, /\.hero \.ret \{ font-size: min\(clamp\(64px, 22vw, 120px\), calc\(100cqi \/ var\(--ret-em, 3\)\)\); \}/);
  // The short-height size (#54's @media (max-height: 480px)) is capped the same way, after it, with higher specificity.
  assert.ok(css.indexOf('.feed .card .ret { font-size: 56px; }') < css.indexOf('.feed .card .hero .ret { font-size: min(48px, calc(100cqi / var(--ret-em, 3))); }'));
});

test('#18: a long name or a 20-character handle wraps in the card header: .who may shrink and break anywhere, the card never outgrows its row', () => {
  assert.match(block, /\.feed \.row > \.card \{ min-width: 0; \}/);
  assert.match(block, /\.card header \.who \{ min-width: 0; overflow-wrap: anywhere; \}/);
  assert.match(block, /\.card header > :not\(\.who\) \{ flex: none; \}/);
  const html = card({ handle: 'f10f_twenty_chars_x', display_name: 'A Very Long Display Name That Goes On And On' }, new Date(Date.UTC(2026, 10, 1)));
  assert.match(html, /<header><a href="\/u\/f10f_twenty_chars_x" class="who"><strong><bdi>A Very Long Display Name That Goes On And On<\/bdi><\/strong> <span class="muted">@f10f_twenty_chars_x<\/span><\/a>/);
});

test('#16: a resting row\'s pane is inert unless it holds focus; a row on its pane never is', () => {
  assert.equal(restsOnCard(0, 360), true);
  assert.equal(restsOnCard(179, 360), true);
  assert.equal(restsOnCard(180, 360), false);
  assert.equal(paneInert({ scrollLeft: 0, clientWidth: 360, holdsFocus: false }), true);
  assert.equal(paneInert({ scrollLeft: 1, clientWidth: 360, holdsFocus: false }), true); // a snap a pixel short
  assert.equal(paneInert({ scrollLeft: 0, clientWidth: 360, holdsFocus: true }), false);
  assert.equal(paneInert({ scrollLeft: 360, clientWidth: 360, holdsFocus: false }), false);
});

test('#16: → moves focus into the pane, ← and Back bring it back to the card from the pane or from nowhere, and leave it elsewhere alone', () => {
  assert.equal(focusAfterKey('ArrowRight', 'card'), 'pane');
  assert.equal(focusAfterKey('ArrowRight', 'none'), 'pane');
  assert.equal(focusAfterKey('ArrowRight', 'pane'), null); // already there (a menu, the chart): stays put
  for (const k of ['ArrowLeft', 'back'] as const) {
    assert.equal(focusAfterKey(k, 'pane'), 'card');
    assert.equal(focusAfterKey(k, 'none'), 'card');
    assert.equal(focusAfterKey(k, 'card'), null);
    assert.equal(focusAfterKey(k, 'other'), null);
  }
});

test('#15: the sign-in line closes on Escape and on any focus outside it, never on focus inside it or other keys', () => {
  assert.equal(closesSignInBar({ type: 'keydown', key: 'Escape' }), true);
  assert.equal(closesSignInBar({ type: 'keydown', key: 'Tab' }), false);
  assert.equal(closesSignInBar({ type: 'keydown', key: 'Enter' }), false);
  assert.equal(closesSignInBar({ type: 'focusin', insideBar: false }), true);
  assert.equal(closesSignInBar({ type: 'focusin', insideBar: true }), false);
});

test('#15/#16: the client code applies these rules (no inert in server markup)', () => {
  const keys = readFileSync(new URL('app/feed-keys.tsx', ROOT), 'utf8'), gestures = readFileSync(new URL('app/feed-gestures.tsx', ROOT), 'utf8');
  assert.match(keys, /paneInert\(/);
  assert.match(keys, /focusAfterKey\(/);
  assert.match(gestures, /closesSignInBar\(\{ type: 'keydown'/);
  assert.match(gestures, /closesSignInBar\(\{ type: 'focusin'/);
  assert.doesNotMatch(readFileSync(new URL('app/pane.tsx', ROOT), 'utf8'), /\binert\b/);
  assert.doesNotMatch(card({}, new Date()), /\binert\b/);
});
