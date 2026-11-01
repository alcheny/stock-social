// F-25 (docs/features/F-25-one-link-rule-for-trade-rows.md): the one trade URL builder, the TRADE_LINK copy, the source
// rules (no other trade URL template, the legacy lookup only in the page body and the image route, one footer constant)
// and the feed card's footer, rendered outside Next as lib/f10-feed-card.test.ts does.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { createRequire, registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
import { MARKS, MINORS, PROMO } from '../scripts/compliance.ts';
import { tradePageHref, TRADE_KEY_RE } from './trade-href.ts';
import { PUBLIC, RECORD_LINK, RECORD_LINK_ARROW, TRADE_LINK, signWord } from './copy.ts';
import { pct } from './format.ts';
import { tone } from './format.ts';
import { NOT_A_FIELD as FIELD_LABELS } from './privacy-fields.ts';

const ROOT = new URL('..', import.meta.url);
const read = (f: string) => readFileSync(new URL(f, ROOT), 'utf8');
const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
const KEY = 'c'.repeat(64);

test('F-25 tradePageHref: /u/<handle>/trade/<trade_key>, and nothing but a 64-hex key goes in', () => {
  assert.equal(tradePageHref({ handle: 'momentum_maya', tradeKey: KEY }), `/u/momentum_maya/trade/${KEY}`);
  for (const bad of ['', 'sell-1', 'C'.repeat(64), 'c'.repeat(63), `${KEY}0`, 'a/b', '../x']) assert.throws(() => tradePageHref({ handle: 'h', tradeKey: bad }), bad);
  assert.ok(TRADE_KEY_RE.test(KEY));
});

test('F-25 TRADE_LINK: names carry the symbol, the sign word matching tone(), the printed % and the destination', () => {
  for (const [r, w] of [[0.052, 'Gain'], [-0.081, 'Loss'], [0.0004, 'Flat'], [-0.0004, 'Flat']] as const) {
    assert.equal(signWord(r), w);
    assert.equal({ up: 'Gain', down: 'Loss', flat: 'Flat' }[tone(r)], w);
    assert.equal(TRADE_LINK.name('TSLA', r), `TSLA ${w} ${pct(r)}, open trade page`);
    assert.equal(TRADE_LINK.card + TRADE_LINK.cardName('TSLA', r), `This trade: TSLA ${w} ${pct(r)}`);
  }
  assert.equal(TRADE_LINK.suffix('TSLA'), ', open TSLA trade page');
});

test('F-25 TRADE_LINK and the footer strings contain no advice, promotion, completeness, mark or minors words', () => {
  const MARK_RE = new RegExp(`\\b(${MARKS.map((m) => m.replace(/ /g, '[\\s-]?')).join('|')})\\b`, 'i');
  const MINORS_RE = new RegExp(`\\b(${MINORS.map((m) => m.replace(/ /g, '\\s')).join('|')})\\b`, 'i');
  const WORDS = [/\b(buy|sell|hold|pick|signal|advice|price target|recommend\w*|guarantee\w*|endorse\w*|copy|follow)s?\b/i, /\bevery trade\b/i, /\bany broker\b/i, /\bcomplete\b/i, /\ball (of )?(their|your) trades\b/i];
  const strings = [TRADE_LINK.card, TRADE_LINK.name('ZQXA', -0.05), TRADE_LINK.suffix('ZQXA'), TRADE_LINK.cardName('ZQXA', 0.05), RECORD_LINK, RECORD_LINK_ARROW];
  for (const s of strings) {
    for (const re of [...PROMO, ...WORDS, MARK_RE, MINORS_RE]) assert.doesNotMatch(s, re, s);
  }
});

test('F-25: the profile footer text is one lib/copy.ts constant, used by the card and by PUBLIC.cardFooter', () => {
  assert.equal(PUBLIC.cardFooter, RECORD_LINK_ARROW);
  assert.ok(RECORD_LINK_ARROW.startsWith(RECORD_LINK));
  const ui = read('app/ui.tsx');
  assert.match(ui, /\{RECORD_LINK\}/);
  assert.doesNotMatch(ui, /wins and losses/, 'no inline copy of the footer text in the card');
  assert.match(read('lib/copy.ts'), /cardFooter: RECORD_LINK_ARROW/);
});

// Every .ts/.tsx file under app/ and lib/ (tests excluded).
function sources(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(new URL(dir, ROOT))) {
    const p = `${dir}/${n}`;
    if (statSync(new URL(p, ROOT)).isDirectory()) sources(p, out);
    else if (/\.tsx?$/.test(n) && !/\.(test|spec)\.tsx?$/.test(n)) out.push(p);
  }
  return out;
}

test('F-25: every trade-page URL in app/ and lib/ comes from tradePageHref (no /trade/${ template elsewhere)', () => {
  const files = [...sources('app'), ...sources('lib')];
  assert.ok(files.length > 100);
  for (const f of files) {
    if (f === 'lib/trade-href.ts') continue;
    assert.doesNotMatch(code(read(f)), /\/trade\/\$\{/, f);
    assert.doesNotMatch(code(read(f)), /\/trade\/['"]\s*\+/, f);
  }
  assert.match(read('lib/trade-href.ts'), /`\/u\/\$\{handle\}\/trade\/\$\{tradeKey\}`/);
  // The trade page's canonical, share path and image URL are built by it too.
  const page = code(read('app/u/[handle]/trade/[sellId]/page.tsx'));
  assert.match(page, /const href = tradePageHref\(\{ handle: t\.handle, tradeKey: t\.tradeKey! \}\);\s*const url = `\$\{href\}\/opengraph-image`;/);
  assert.match(page, /canonical: href/);
});

test('F-25: the legacy lookup and its 308 live in the page body and the image route; never in proxy.ts or generateMetadata', () => {
  const page = code(read('app/u/[handle]/trade/[sellId]/page.tsx'));
  const meta = page.slice(page.indexOf('export async function generateMetadata'), page.indexOf('export default async function TradePage'));
  const body = page.slice(page.indexOf('export default async function TradePage'));
  assert.ok(meta.length > 0 && body.length > 0);
  assert.doesNotMatch(meta, /legacy|permanentRedirect|redirect\(|loadTradeShare\(/i);
  assert.match(body, /if \(!t\) \{ await legacyRedirect\(params, searchParams\); notFound\(\); \}/);
  const legacy = page.slice(page.indexOf('async function legacyRedirect'), page.indexOf('const held'));
  assert.match(legacy, /legacyTradeKey\(handle, id\)/);
  assert.match(legacy, /permanentRedirect\(tradePageHref\(\{ handle, tradeKey: key \}\) \+ \(qs\.size \? `\?\$\{qs\}` : ''\)\)/);
  const img = code(read('app/u/[handle]/trade/[sellId]/opengraph-image.tsx'));
  assert.match(img, /legacyTradeKey\(handle, id\)/);
  assert.match(img, /permanentRedirect\(`\$\{tradePageHref\(\{ handle, tradeKey: legacy \}\)\}\/opengraph-image`\)/);
  assert.ok(img.indexOf('permanentRedirect(') < img.indexOf('if (!t) notFound();'), 'the redirect comes before the 404');
  for (const f of ['proxy.ts', 'middleware.ts']) if (existsSync(new URL(f, ROOT))) assert.doesNotMatch(read(f), /trade|sha256|createHash|legacy/i, f);
  // A loading.tsx above the page would stream it, turning the 308 into a 200 with a meta refresh (permanentRedirect docs).
  for (const d of ['app', 'app/u', 'app/u/[handle]', 'app/u/[handle]/trade', 'app/u/[handle]/trade/[sellId]']) assert.ok(!existsSync(new URL(`${d}/loading.tsx`, ROOT)), `${d}/loading.tsx`);
  assert.doesNotMatch(read('next.config.ts'), /cacheComponents|\bppr\b/);
});

test('F-25: privacy inventory labels trade_key as shown in trade-page URLs; sell_id stays never shown', () => {
  assert.equal(FIELD_LABELS['closed_trades.trade_key'], 'key (hash of sell_id; shown in trade-page URLs)');
  assert.match(FIELD_LABELS['closed_trades.sell_id'], /never shown/);
});

test('F-25: views, share actions and the reflection action match the trade_key; no client code reads a sell id', () => {
  assert.match(read('lib/views.ts'), /c\.trade_key = \$\{t\.detail\}/);
  assert.match(read('lib/share-actions.ts'), /trade_key = \$\{detail\}/);
  const rec = read('app/me/record/page.tsx');
  assert.match(rec, /<input type="hidden" name="tradeKey" value=\{t\.tradeKey\} \/>/);
  assert.doesNotMatch(rec, /name="sellId"|key=\{t\.sellId\}/);
  assert.match(read('app/actions.ts'), /ownSellIdForKey\(user\?\.id, form\.get\('tradeKey'\)\)/);
  for (const f of ['app/feed-rows.tsx', 'app/ui.tsx', 'app/pane.tsx', 'app/t/[symbol]/Theses.tsx', 'app/u/[handle]/new-trades-prompt.tsx', 'app/u/[handle]/similar-section.tsx', 'app/review/theses/page.tsx', 'app/u/[handle]/month/[ym]/page.tsx'])
    assert.doesNotMatch(code(read(f)).replace(/\[sellId\]/g, ''), /sell_?[iI]d/, f); // the route folder's name is not a use
  assert.match(read('app/feed-rows.tsx'), /no `data-\*` attribute, client prop or payload carries the close's vendor id; trade\n\s*\/\/ hrefs carry the `trade_key`/);
});

test('F-25 CSS: footer links at 0.875rem, 44 px hit boxes, one line from 360 px and stacked below; Shape C 44 x 44', () => {
  const css = read('app/globals.css');
  const block = css.slice(css.indexOf('/* ---- F-25 one link rule'), css.indexOf('/* end F-25 */'));
  assert.match(block, /\.card \.f25-card-links \{[^}]*font-size: 0\.875rem;/);
  assert.match(block, /\.card \.f25-card-links \{[^}]*column-gap: 16px;[^}]*row-gap: 36px;/); // 28 px pulled-in box + 8 px apart
  assert.match(block, /\.card \.f25-card-link \{[^}]*margin-block: -14px;/);
  assert.match(block, /\.card \.f25-card-link \{[^}]*min-height: 44px;/);
  assert.match(block, /@media \(max-width: 359\.98px\) \{ \.card \.f25-card-links \{ flex-direction: column;/);
  assert.match(block, /\.f25-row \{ position: relative; \}/); // sr-only spans stay inside the row (no page widening)
  assert.match(block, /\.rows \.line \.f25-fig \{[^}]*min-width: 44px; min-height: 44px;/);
});

// ---- Render tests (TradeCard and ProfilePane outside Next) ----
const require = createRequire(import.meta.url);
const swc = require('next/dist/build/swc') as { loadBindings: () => Promise<unknown>; transformSync: (src: string, o: object) => { code: string } };
await swc.loadBindings();
const LINK = `data:text/javascript,${encodeURIComponent("import { createElement } from 'react'; export default function Link({ href, children, prefetch: _p, ...rest }) { return createElement('a', { href, ...rest }, children); }")}`;
registerHooks({
  resolve(spec, ctx, next) {
    if (spec === 'next/link') return { url: LINK, shortCircuit: true };
    if (/^next\/(navigation|cache|headers|server)$/.test(spec)) return next(`${spec}.js`, ctx); // the pane's action modules (not called)
    if (spec.startsWith('@/')) return next(new URL(spec.slice(2), ROOT).href, ctx);
    if (ctx.parentURL?.startsWith('data:')) return next(spec, { ...ctx, parentURL: import.meta.url });
    return next(spec, ctx);
  },
  load(url, ctx, next) {
    if (!url.endsWith('.tsx')) return next(url, ctx);
    const file = new URL(url);
    const { code: out } = swc.transformSync(readFileSync(file, 'utf8'), {
      filename: file.pathname, jsc: { parser: { syntax: 'typescript', tsx: true }, transform: { react: { runtime: 'automatic' } }, target: 'es2022' }, module: { type: 'es6' },
    });
    return { format: 'module', source: out, shortCircuit: true };
  },
});
const { renderToStaticMarkup } = await import('react-dom/server' as string) as { renderToStaticMarkup: (e: unknown) => string };
const { createElement } = await import('react');
const { TradeCard, Badge } = await import(pathToFileURL(new URL('app/ui.tsx', ROOT).pathname).href) as typeof import('../app/ui.tsx');

const row = { id: '1', symbol: 'ACME', return_pct: -0.052, holding_days: 3.4, closed_at: new Date(Date.UTC(2026, 9, 30)), verified: true,
  thesis: null, thesis_status: null, handle: 'link_card', display_name: 'Link Card', user_id: 1, trade_key: KEY };
const strip = (s: string) => s.replace(/<[^>]*>/g, '');

test('F-25 TradeCard: .ret holds no link; the footer has "This trade" then the record link; name and symbol links stay', () => {
  const html = renderToStaticMarkup(createElement(TradeCard, { t: row, state: 'connected' }));
  const ret = html.match(/<div class="ret[^"]*"[^>]*>([\s\S]*?)<\/div>/)?.[1] ?? '';
  assert.equal(strip(ret), '-5.2%');
  assert.doesNotMatch(ret, /<a /);
  assert.match(html, /<a href="\/u\/link_card" class="who"/);
  assert.match(html, /<div class="symbol"><a href="\/t\/ACME">ACME<\/a><\/div>/);
  const footer = html.match(/<footer[^>]*>([\s\S]*?)<\/footer>/)?.[1] ?? '';
  const links = [...footer.matchAll(/<a href="([^"]+)" class="f25-card-link">([\s\S]*?)<\/a>/g)];
  assert.equal(links.length, 2);
  assert.equal(links[0][1], `/u/link_card/trade/${KEY}`);
  assert.equal(links[1][1], '/u/link_card');
  // Visible text, the hidden name part and the hidden arrow: the visible words are a prefix of the accessible name (2.5.3).
  assert.match(links[0][2], /^This trade<span class="sr-only">: ACME Loss -5\.2%<\/span> <span aria-hidden="true">→<\/span>$/);
  assert.match(links[1][2], /^Record, wins and losses<span class="sr-only">: @link_card<\/span> <span aria-hidden="true">→<\/span>$/);
  // Nothing that holds a link is a link.
  assert.doesNotMatch(html, /<a [^>]*>(?:(?!<\/a>)[\s\S])*<a /);
});

test('F-25 TradeCard: without a trade_key (other callers) only the record link renders, never a guessed trade URL', () => {
  const { trade_key: _k, ...bare } = row;
  const html = renderToStaticMarkup(createElement(TradeCard, { t: bare, state: 'connected' }));
  assert.doesNotMatch(html, /\/trade\//);
  assert.match(html, /Record, wins and losses/);
});

test('F-25 Badge: the Verified check glyph is aria-hidden, the word is read', () => {
  const html = renderToStaticMarkup(createElement(Badge, { verified: true }));
  assert.match(html, /<span aria-hidden="true">✓ <\/span>Verified<\/span>$/);
});

test('F-25 ProfilePane: each last-5 row is one link to its trade page; aria-current sits on the highlighted row\'s <a>', async () => {
  const { ProfilePane } = await import(pathToFileURL(new URL('app/pane.tsx', ROOT).pathname).href) as typeof import('../app/pane.tsx');
  const k = (i: number) => String(i).repeat(64).slice(0, 64).replace(/[^0-9a-f]/g, 'a');
  const trades = Array.from({ length: 7 }, (_, i) => ({ id: String(100 + i), symbol: `S${i}`, returnPct: i % 2 ? -0.03 : 0.04, holdingDays: 2, closedAt: new Date(Date.UTC(2026, 9, 20 - i)), thesis: null, verified: true,
    openedAt: new Date(Date.UTC(2026, 9, 18 - i)), ...(i < 5 ? { tradeKey: k(i) } : {}) }));
  const html = renderToStaticMarkup(createElement(ProfilePane, { handle: 'pane_links', name: 'Pane Links', trades, now: new Date(Date.UTC(2026, 10, 1)), highlight: '101', back: false }));
  const list = html.slice(html.indexOf('<ul class="rows">'), html.indexOf('</ul>', html.indexOf('<ul class="rows">')));
  const items = [...list.matchAll(/<li>([\s\S]*?)<\/li>/g)].map((m) => m[1]);
  assert.equal(items.length, 5);
  items.forEach((li, i) => {
    const as = [...li.matchAll(/<a [^>]*>/g)];
    assert.equal(as.length, 1, li);
    assert.match(as[0][0], new RegExp(`href="/u/pane_links/trade/${k(i)}"`));
    assert.doesNotMatch(as[0][0], /aria-label/);
    if (i === 1) assert.match(as[0][0], /aria-current="true"/); else assert.doesNotMatch(as[0][0], /aria-current/);
    assert.match(li, new RegExp(`<span class="sr-only">${i % 2 ? 'Loss' : 'Gain'} </span>`));
    assert.match(li, new RegExp(`<span class="sr-only">, open S${i} trade page</span>`));
  });
  assert.doesNotMatch(list, /<li[^>]*aria-current/);
});
