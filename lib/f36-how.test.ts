// F-36 AC7 / AC8 (plan Round 2 changes, R2-8, R2-9): /how states the return formula once, in plain text, with one
// fictional worked example and a dated "Changes to the math" note kept as history; a fee-bearing trade's card shows its
// percent and no fee. Renders app/how/page.tsx and app/ui.tsx with react-dom/server. Node strips types from .ts but not
// JSX from .tsx, so this file registers a small module hook for the test process only (as lib/f10-feed-card.test.ts):
// .tsx goes through Next's own SWC binding, `@/` resolves to the repo root and next/link is a plain <a>.
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
const page = await import(pathToFileURL(new URL('app/how/page.tsx', ROOT).pathname).href) as typeof import('../app/how/page.tsx');
const { TradeCard } = await import(pathToFileURL(new URL('app/ui.tsx', ROOT).pathname).href) as typeof import('../app/ui.tsx');
const { HOW, F36_RECALC_DATE, howDate } = await import('./copy.ts');
const { matchTrades } = await import('./trades.ts');

const html = renderToStaticMarkup(createElement(page.default));
// The rendered text of an HTML fragment (test-only). Tags are removed until none is left, and entities are decoded in one
// pass, so an `&amp;` is never decoded twice (code scanning: incomplete sanitization, double unescaping).
const ENTITY: Record<string, string> = { '&#x27;': '’', '&#39;': '’', '&quot;': '"', '&amp;': '&' };
const text = (h: string) => {
  let out = h, prev;
  do { prev = out; out = out.replace(/<[^<>]*>/g, ' '); } while (out !== prev);
  return out.replace(/&#x27;|&#39;|&quot;|&amp;/g, (e) => ENTITY[e]).replace(/\s+/g, ' ').trim();
};
const FORMULA = 'Return = (sale proceeds − purchase cost − purchase fees − sale fees) ÷ (purchase cost + purchase fees), using the fees the broker reported. Nothing is weighted by size.';
const EXAMPLE = 'A fictional example: paid 100 plus a fee of 10, sold for 165 with no fee on the sale. (165 − 100 − 10) ÷ (100 + 10) = 55 ÷ 110 = +50%.';

test('F-36 AC7: /how renders the formula and the worked example as text in the math list', () => {
  const math = html.slice(html.indexOf(`<h2>${HOW.mathTitle}</h2>`), html.indexOf('data-disclaimer'));
  assert.ok(math.length > 0);
  const items = [...math.matchAll(/<li>([^<]*)<\/li>/g)].map((m) => text(m[1]));
  assert.ok(items.includes(FORMULA), 'formula item');
  assert.ok(items.includes(EXAMPLE), 'example item');
  assert.equal(items.filter((l) => l.startsWith('Return =')).length, 1, 'the formula is stated once');
  assert.doesNotMatch(math, /<img|<svg|<math|<canvas|nowrap/);
  // The old wording described the return in words without the denominator: it is gone.
  assert.doesNotMatch(html, /percent change between the matched buys and the sell/);
});

test('F-36 AC7: the dated note: "Changes to the math" at the end of the page, a <time> from the constant, kept as history', () => {
  assert.equal(F36_RECALC_DATE, '2026-11-02');
  assert.equal(howDate(F36_RECALC_DATE), 'November 2, 2026');
  const at = html.indexOf('<h2 id="changes">');
  assert.ok(at > html.indexOf('id="public-filings"'), 'the section comes after the public-filings section');
  assert.equal(text(html.slice(at, html.indexOf('</h2>', at))), 'Changes to the math');
  const tail = html.slice(at);
  assert.match(tail, /<time dateTime="2026-11-02">November 2, 2026<\/time>/);
  assert.ok(tail.includes(`November 2, 2026</time>: ${HOW.recalcNote}</li>`));
  assert.equal(HOW.recalcNote, 'returns of trades with a purchase fee were recalculated to divide by the purchase cost plus that fee. Before, they divided by the purchase cost alone, so both gains and losses looked bigger.');
});

test('F-36 AC7: the date renders in UTC whatever the process time zone', () => {
  const tz = process.env.TZ;
  try {
    for (const z of ['Pacific/Honolulu', 'Pacific/Kiritimati', 'UTC']) {
      process.env.TZ = z;
      assert.equal(howDate('2026-11-02'), 'November 2, 2026', z);
    }
  } finally {
    if (tz === undefined) delete process.env.TZ; else process.env.TZ = tz;
  }
});

test('F-36: /how headings go h1 then h2 only, and the Disclaimer stays right after the math list', () => {
  const levels = [...html.matchAll(/<h([1-6])/g)].map((m) => +m[1]);
  assert.equal(levels[0], 1);
  assert.deepEqual([...new Set(levels.slice(1))], [2]);
  const mathEnd = html.indexOf('</ul>', html.indexOf(`<h2>${HOW.mathTitle}</h2>`));
  assert.match(html.slice(mathEnd + 5), /^<p[^>]*data-disclaimer/);
});

test('F-36 AC8: a fee-bearing trade renders its percent and no fee (render test)', () => {
  const m = matchTrades([
    { externalId: 'f36-b', accountId: 'acc', symbol: 'FAKE', side: 'BUY', units: 2, price: 5, fee: 10, executedAt: new Date('2026-01-02T15:00:00Z'), verified: true },
    { externalId: 'f36-s', accountId: 'acc', symbol: 'FAKE', side: 'SELL', units: 2, price: 15, fee: 7, executedAt: new Date('2026-01-06T15:00:00Z'), verified: true },
  ]);
  const t = m.trades[0];
  const row = { id: '1', symbol: t.symbol, return_pct: t.returnPct, holding_days: t.holdingDays, closed_at: t.closedAt, verified: true,
    thesis: null, thesis_status: null, handle: 'card_one', display_name: 'Card One', user_id: 1 };
  const card = renderToStaticMarkup(createElement(TradeCard, { t: row, state: 'connected' }));
  assert.equal(t.returnPct, 0.15); // (30 − 10 − 10 − 7) ÷ (10 + 10)
  assert.match(text(card), /\+15\.0%/);
  assert.doesNotMatch(card, /\bfees?\b/i);
  assert.doesNotMatch(text(card), /(^|[^\d.])(10|7|17)(?![\d.%])/); // no fee figure (10, 7 or their sum)
});
