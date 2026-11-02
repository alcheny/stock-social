// F-27 (docs/features/F-27-colour-follow-ups.md): the chart baseline on --control, the one warn notice at the four
// failed-import sites, --warn used only by the notice, and no share-image colour change. Render tests on app/ui.tsx,
// app/record-strip.tsx and app/pane.tsx (react-dom/server; the module hook is lib/f10-feed-card.test.ts's: .tsx through
// Next's own SWC binding, `@/` to the repo root, next/link as a plain <a>), source tests on the CSS and the charts, and
// the contrast of the notice's border and words. The running app (computed styles, light and dark, the double tap on
// the icon, F-10 headroom) is e2e/f27-colour-follow-ups.spec.ts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
import { contrast } from './colour-math.ts';
import { dark, light, parse, tokensFor } from './css-cascade.ts';

const ROOT = new URL('..', import.meta.url);
const require = createRequire(import.meta.url);
const swc = require('next/dist/build/swc') as { loadBindings: () => Promise<unknown>; transformSync: (src: string, o: object) => { code: string } };
await swc.loadBindings();
const LINK = `data:text/javascript,${encodeURIComponent("import { createElement } from 'react'; export default function Link({ href, children, prefetch: _p, ...rest }) { return createElement('a', { href, ...rest }, children); }")}`;
registerHooks({
  resolve(spec, ctx, next) {
    if (spec === 'next/link') return { url: LINK, shortCircuit: true };
    // The pane's client parts import Next's subpaths without an extension (fine under the bundler, not under Node).
    if (/^next\/(navigation|cache|headers|server)$/.test(spec)) return next(`${spec}.js`, ctx);
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
const mod = (p: string) => import(pathToFileURL(new URL(p, ROOT).pathname).href);
const { TradeCard } = await mod('app/ui.tsx') as typeof import('../app/ui.tsx');
const { RecordStrip } = await mod('app/record-strip.tsx') as typeof import('../app/record-strip.tsx');
const { ProfilePane } = await mod('app/pane.tsx') as typeof import('../app/pane.tsx');
const { WarnNotice } = await mod('app/warn-notice.tsx') as typeof import('../app/warn-notice.tsx');
const { recordStrip, stripFigures } = await import('./record-strip.ts');
const { RECORD_BODY } = await import('./copy.ts');

const read = (p: string) => readFileSync(new URL(p, ROOT), 'utf8');
const noComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
const now = new Date(Date.UTC(2026, 10, 1));
type Row = import('../app/ui.tsx').TradeRow;
const row: Row = { id: '27', symbol: 'ACME', return_pct: -0.052, holding_days: 3.4, closed_at: new Date(Date.UTC(2026, 9, 30)), verified: true,
  thesis: null, thesis_status: null, handle: 'f27_card', display_name: 'F27 Card', user_id: 1 };
const trades = Array.from({ length: 12 }, (_, i) => ({ symbol: `S${i % 4}`, returnPct: (i % 3 ? 1 : -1) * 0.04, holdingDays: 3, closedAt: new Date(now.getTime() - (i + 1) * 86_400_000), openedAt: new Date(now.getTime() - (i + 4) * 86_400_000) }));
const strip = (surface: 'feed' | 'page', state: 'connected' | 'failed' = 'failed') =>
  recordStrip({ ...stripFigures(trades, now), state, demo: false, verified: true, handle: row.handle }, surface);
const card = (state: 'connected' | 'failed', more: Record<string, unknown> = {}) => renderToStaticMarkup(createElement(TradeCard, { t: row, state, now, ...more }));
const pane = (state: 'connected' | 'failed') => renderToStaticMarkup(createElement(ProfilePane, {
  handle: row.handle, name: 'F27 Card', now, state,
  trades: trades.map((t, i) => ({ ...t, id: String(i + 1), thesis: null, verified: true })),
}));
const page = (state: 'connected' | 'failed') => renderToStaticMarkup(createElement(RecordStrip, { strip: strip('page', state) }));
const notices = (html: string) => html.match(/<p [^>]*class="[^"]*\bwarn-notice\b[^"]*"[^>]*>[\s\S]*?<\/p>/g) ?? [];
const count = (html: string, cls: string) => (html.match(new RegExp(`class="(?:[^"]* )?${cls}(?: [^"]*)?"`, 'g')) ?? []).length;
// The words of a notice: its text with tags removed (the icon carries none).
// Tags stripped until nothing changes (a single pass can leave a tag formed by what it removed); entities decoded last.
const words = (n: string) => {
  let t = n, prev;
  do { prev = t; t = t.replace(/<[^>]*>/g, ''); } while (t !== prev);
  return t.replace(/&#x27;/g, "'").trim();
};

// ---- AC1, AC2: the bar baseline ----
test('F-27 AC1: the bar baseline in Spread and Timeline is drawn in --control; no chart baseline in app/t/[symbol]/ uses --line', () => {
  for (const f of ['app/t/[symbol]/Spread.tsx', 'app/t/[symbol]/Timeline.tsx']) {
    const base = noComments(read(f)).match(/<line [^>]*y1=\{BASE\} [^>]*y2=\{BASE\}[^>]*\/>/g) ?? [];
    assert.equal(base.length, 1, `${f}: one baseline`);
    assert.match(base[0], /stroke="var\(--control\)"/, f);
  }
  // No horizontal chart line (a baseline: y1 equals y2) in the stock page's folder is drawn in --line; separators and
  // borders may keep --line (the decision).
  const dir = new URL('app/t/[symbol]/', ROOT);
  const tsx = require('node:fs').readdirSync(dir).filter((n: string) => n.endsWith('.tsx'));
  assert.ok(tsx.length >= 2);
  for (const n of tsx) for (const l of noComments(readFileSync(new URL(n, dir), 'utf8')).match(/<line [^>]*\/>/g) ?? []) {
    const y1 = l.match(/y1=(\{[^}]*\}|"[^"]*")/)?.[1], y2 = l.match(/y2=(\{[^}]*\}|"[^"]*")/)?.[1];
    if (y1 && y1 === y2) assert.doesNotMatch(l, /var\(--line\)/, `${n}: a baseline in --line: ${l}`);
  }
});

test('F-27 AC2: F-20\'s --control pair (>= 3:1 on bg and surface, both schemes) is unchanged in lib/a11y-contrast.test.ts', () => {
  assert.match(read('lib/a11y-contrast.test.ts'), /\{ what: 'control borders \(--control\)', fg: 'control', on: GROUNDS, floor: 'ui' \}/);
  // And it holds today, measured here too (the baseline sits on --bg or --surface).
  const css = noComments(read('app/globals.css'));
  for (const on of [dark, light]) {
    const t = tokensFor(parse(css), on);
    for (const g of ['bg', 'surface']) assert.ok(contrast(t.control, t[g]) >= 3, `--control on --${g}: ${contrast(t.control, t[g]).toFixed(2)}`);
  }
});

// ---- AC3, AC8: one WarnNotice at each site ----
function assertNotice(html: string, where: string, text: string) {
  const ns = notices(html);
  assert.equal(ns.length, 1, `${where}: exactly one .warn-notice`);
  const n = ns[0];
  // FIXES-CYCLE5 (F5-25, F3-16): a static notice carries no live-region role; the class list and the hook are unchanged.
  assert.match(n, /^<p class="warn-notice record-failed">/, `${where}: one class list, the record-failed hook kept, no live role`);
  assert.match(n, /<svg data-warn-icon="true" aria-hidden="true" focusable="false"/, `${where}: an aria-hidden icon`);
  assert.equal(words(n), text, `${where}: the words unchanged`);
  assert.equal(count(html.replace(n, ''), 'record-failed'), 0, `${where}: no second failed line`);
  for (const [, cls] of n.matchAll(/class="([^"]*)"/g)) for (const bad of ['down', 'warn']) assert.ok(!cls.split(' ').includes(bad), `${where}: ${bad} class in the notice`);
}

test('F-27 AC3, AC8: a failed record\'s feed card (with and without the strip) renders one warn notice with the icon and RECORD_BODY.failed', () => {
  assertNotice(card('failed'), 'card', RECORD_BODY.failed);
  assertNotice(card('failed', { strip: strip('feed') }), 'card with strip', RECORD_BODY.failed);
  assert.equal(notices(card('connected', { strip: strip('feed', 'connected') })).length, 0, 'a whole record has none');
});

test('F-27 AC3, AC8: a failed record\'s pane renders one warn notice with RECORD_BODY.failed', () => {
  assertNotice(pane('failed'), 'pane', RECORD_BODY.failed);
  assert.equal(notices(pane('connected')).length, 0);
});

test('F-27 AC3, AC8: the trade page\'s record strip renders one warn notice with the strip\'s note', () => {
  const s = strip('page');
  assert.equal(s.note, RECORD_BODY.failed);
  assertNotice(page('failed'), 'record strip', s.note!);
  assert.equal(notices(page('connected')).length, 0);
});

test('F-27 AC3: the profile renders the failed line through WarnNotice (its retry link inside, for the author only)', () => {
  const s = noComments(read('app/u/[handle]/page.tsx'));
  const m = s.match(/\{state === 'failed' && \(\s*(<WarnNotice[\s\S]*?<\/WarnNotice>)\s*\)\}/);
  assert.ok(m, 'the profile\'s failed line is a WarnNotice');
  assert.match(m[1], /^<WarnNotice>/); // FIXES-CYCLE5 (F5-25, F3-16): a static record note, no live role
  assert.match(m[1], /\{RECORD_BODY\.failed\}/);
  assert.match(m[1], /\{isMe && <>[\s\S]*<Link [^>]*href="\/connect"[^>]*>\{RECORD_BODY\.retry\}<\/Link>[\s\S]*<\/>\}\s*<\/WarnNotice>$/);
  // The retry link renders inside the words span.
  const html = renderToStaticMarkup(createElement(WarnNotice, { role: 'alert', children: ['Words.', ' ', createElement('a', { href: '/connect', className: 'button secondary' }, 'Retry')] }));
  assert.match(html, /<span>Words\. <a href="\/connect" class="button secondary">Retry<\/a><\/span><\/p>$/);
});

const tsxUnder = (dir: string): string[] => require('node:fs').readdirSync(new URL(dir, ROOT), { withFileTypes: true }).flatMap((d: import('node:fs').Dirent) =>
  d.isDirectory() ? tsxUnder(`${dir}${d.name}/`) : d.name.endsWith('.tsx') ? [`${dir}${d.name}`] : []);

test('F-27 AC3: every failed-import site uses WarnNotice; no hand-made failed line anywhere in app/', () => {
  // FIXES-CYCLE5 (F5-25, F3-16): each static site uses WarnNotice with no live role; a live use still renders its role.
  for (const f of ['app/ui.tsx', 'app/pane.tsx', 'app/record-strip.tsx', 'app/u/[handle]/page.tsx']) {
    assert.match(noComments(read(f)), /<WarnNotice>/, `${f} uses WarnNotice`);
    assert.doesNotMatch(noComments(read(f)), /<WarnNotice role=/, `${f}: a static notice has no live role`);
  }
  assert.match(renderToStaticMarkup(createElement(WarnNotice, { role: 'status', children: 'Words.' })), /^<p role="status" class="warn-notice record-failed">/);
  for (const f of tsxUnder('app/')) {
    if (f === 'app/warn-notice.tsx') continue;
    assert.doesNotMatch(noComments(read(f)), /className="[^"]*\brecord-failed\b[^"]*"/, `${f}: no hand-made failed line`);
  }
  assert.doesNotMatch(noComments(read('app/warn-notice.tsx')), /style=/, 'the notice has no inline style');
});

test('F-27 AC3: the notice\'s CSS: --warn border on --surface, words in --text, the icon in --warn and ignoring pointer events; the old .warn rule and ::before glyph are gone', () => {
  const css = noComments(read('app/globals.css'));
  const rule = (sel: string) => [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)].filter((r) => r[1].split(',').map((x) => x.trim()).includes(sel)).map((r) => r[2]).join(';');
  const box = rule('.warn-notice');
  assert.match(box, /border: 1px solid var\(--warn\)/);
  assert.match(box, /background: var\(--surface\)/);
  assert.match(box, /color: var\(--text\)/);
  assert.match(box, /padding: 8px 12px/);
  const icon = rule('.warn-notice [data-warn-icon]');
  assert.match(icon, /pointer-events: none/);
  assert.match(icon, /stroke: var\(--warn\)/);
  assert.doesNotMatch(css, /(^|[\s,}])\.warn\s*\{/, 'no .warn rule');
  assert.doesNotMatch(css, /::?before[^{]*\{[^}]*\\26A0/i, 'no warning glyph pseudo-element');
  assert.doesNotMatch(css, /\.record-failed[^{]*::?before/, 'no ::before on .record-failed');
});

// ---- AC5: --warn only inside .warn-notice ----
test('F-27 AC5: var(--warn) appears only in .warn-notice rules in app/globals.css, and in no .tsx inline style', () => {
  const css = noComments(read('app/globals.css'));
  for (const r of css.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    if (!/var\(--warn\)/.test(r[2])) continue;
    for (const sel of r[1].split(',').map((x) => x.trim())) assert.match(sel, /^\.warn-notice(?![\w-])/, `var(--warn) in ${sel}`);
  }
  // The token's definition is not a use; nothing else names it.
  assert.equal((css.match(/--warn:/g) ?? []).length, 2, 'defined once per scheme in TOKENS');
  for (const f of tsxUnder('app/')) assert.doesNotMatch(read(f), /var\(--warn\)/, f);
});

// ---- AC6: F-9's held-note line stays neutral ----
test('F-27 AC6: the author\'s held-note line never carries the down class or a warn notice', () => {
  for (const rule of ['link', 'contact details', 'reports', null]) {
    const html = card('connected', { ownHeld: { rule } });
    const held = html.match(/<p class="([^"]*\bthesis-held\b[^"]*)"[^>]*>[\s\S]*?<\/p>/);
    assert.ok(held, 'the held line renders');
    const cls = held[1].split(' ');
    for (const bad of ['down', 'warn', 'warn-notice']) assert.ok(!cls.includes(bad), `${bad} on the held line`);
    assert.doesNotMatch(held[0], /data-warn-icon|warn-notice/);
  }
  const css = noComments(read('app/globals.css'));
  for (const r of css.matchAll(/([^{}]+)\{([^}]*)\}/g)) if (/thesis-held/.test(r[1])) assert.doesNotMatch(r[2], /var\(--(warn|down)\)/, r[1]);
});

// ---- AC7: F-20's colour-blind floor covers gain, loss and Flat only, with no exemption list ----
test('F-27 AC7: F-20\'s colour-vision test compares gain, loss and Flat only, and has no exemption list', () => {
  const s = read('lib/a11y-contrast.test.ts');
  const cvdTests = [...s.matchAll(/test\(`([^`]*under protan, deutan and tritan[^`]*)`/g)].map((m) => m[1]);
  assert.ok(cvdTests.length >= 3, 'the ΔE00 tests exist');
  for (const t of cvdTests) assert.doesNotMatch(t, /warn/i, t);
  assert.doesNotMatch(s, /cvd\([^)]*warn/i, 'warn is never measured under a deficiency');
  assert.doesNotMatch(noComments(s), /\bexempt(ion)?s?\b\s*[:=]/i, 'no exemption list');
});

// ---- AC9: the notice's contrast ----
test('F-27 AC9: the warn border is >= 3:1 on --surface and the notice text >= 4.5:1, in both schemes', () => {
  const css = noComments(read('app/globals.css'));
  for (const [name, on] of [['dark', dark], ['light', light]] as const) {
    const t = tokensFor(parse(css), on);
    assert.ok(contrast(t.warn, t.surface) >= 3, `${name} --warn on --surface ${contrast(t.warn, t.surface).toFixed(2)}`);
    assert.ok(contrast(t.text, t.surface) >= 4.5, `${name} --text on --surface ${contrast(t.text, t.surface).toFixed(2)}`);
  }
});

// ---- AC11 (unit half): the box's height cost is bounded ----
test('F-27 AC11: the box adds about 18 px (8 px padding top and bottom, a 1 px border each side) and no margin beyond the line\'s', () => {
  const css = noComments(read('app/globals.css'));
  const box = [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)].find((r) => r[1].trim() === '.warn-notice')![2];
  assert.match(box, /padding: 8px 12px/);
  assert.match(box, /border: 1px solid/);
  assert.match(box, /margin: 8px 0/);
});

// ---- AC12: no share-image colour value changes ----
test('F-27 AC12: no share-image colour changes: F-20\'s image-table pin is still in place and the image warn tone is unchanged', () => {
  // Gain and loss on images are F-20 OQ-1's (owner); F-20's own pin covers them, so this file does not copy them.
  assert.match(read('lib/a11y-contrast.test.ts'), /share-image/);
  const p = read('lib/palette.ts');
  for (const k of ['card', 'strip']) {
    const line = p.split('\n').find((l) => l.trimStart().startsWith(`${k}: {`))!;
    assert.match(line, /warn: '#f59e0b'/, `${k}: the image warn tone is unchanged`);
  }
});
