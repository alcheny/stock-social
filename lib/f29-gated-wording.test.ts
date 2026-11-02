// F-29 (docs/features/F-29-gated-options-wording.md; plan docs/features/logs/F-29/plan.md): gated options wording that
// is true for every record. Unit and source checks; the render, position and real-app checks are in
// e2e/f29-gated-wording.spec.ts. No database rows.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { allCopy, F29, OPTIONS } from './copy.ts';
import { gateCacheControl, gateKey, OPTION_PUBLIC_COLUMNS, withGate } from './gate-key.ts';
import { OPTION_PUBLIC_COLUMNS as GATE_COLUMNS, optionsPublic } from './options-gate.ts';
import { PUBLIC_FIELDS, type Field } from './privacy-fields.ts';
import { cardOptionsLine, paneView, type OptionCounts } from './options-view.ts';
import { cardAlt, recordCard } from './record-card.ts';
import { recordStrip, stripFigures } from './record-strip.ts';

const ROOT = new URL('..', import.meta.url);
const read = (p: string) => readFileSync(new URL(p, ROOT), 'utf8');
const SIGNED = 'Option results are not shown on any record at present. Where option trades or open options were imported, the record shows how many, and its headline figures exclude options.';
const OPEN_FIELDS: Field[] = [...PUBLIC_FIELDS, { words: 'option results', columns: [...OPTION_PUBLIC_COLUMNS] }];
const C = (o: Partial<OptionCounts> = {}): OptionCounts => ({ shown: 0, short: 0, other: 0, openLong: 0, openShort: 0, openOther: 0, unsupported: 0, exerciseShares: 0, ...o });

// ---- AC 8: the signed words, exactly.
test('AC8: F29.howInterim is the legal committee\'s signed interim sentence, word for word', () => {
  assert.equal(F29.howInterim, SIGNED);
  assert.doesNotMatch(F29.howInterim, /consented/i);
});

// ---- AC 1: /how renders the paragraph from the gate.
test('AC1: /how renders HowOptionsParagraph from optionsPublic(), and no longer prints OPTIONS.how directly; OPTIONS.how is unchanged', () => {
  const page = read('app/how/page.tsx');
  assert.match(page, /<HowOptionsParagraph open=\{optionsPublic\(\)\} \/>/);
  assert.doesNotMatch(page, /\{OPTIONS\.how\}/);
  const comp = read('app/how/options-paragraph.tsx');
  assert.match(comp, /data-options-how=\{open \? 'open' : 'interim'\}/);
  assert.match(comp, /open \? OPTIONS\.how : F29\.howInterim/);
  assert.match(OPTIONS.how, /consented/); // the legal sentence for the open gate stays byte for byte (fix-4 pin)
  assert.equal(optionsPublic(), false, 'the gate is closed today');
});

// ---- AC 5: no "not asked" or "declined" in any copy.
test('AC5: no copy string (F29 included) says "not asked" or "declined"', () => {
  const all = allCopy();
  assert.ok(all.includes(F29.howInterim), 'F29 is walked by the copy checks');
  for (const s of all) assert.doesNotMatch(s, /\bnot asked\b|\bdeclined\b/i, s);
});

// ---- AC 6: the gate key.
test('AC6: gateKey follows the column check: o0 closed, o1 open, and optionsPublic agrees for both field sets', () => {
  assert.deepEqual([...OPTION_PUBLIC_COLUMNS], [...GATE_COLUMNS], 'one list, re-exported');
  assert.equal(gateKey(), 'o0');
  assert.equal(gateKey(PUBLIC_FIELDS), 'o0');
  assert.equal(gateKey(OPEN_FIELDS), 'o1');
  for (const f of [PUBLIC_FIELDS, OPEN_FIELDS]) assert.equal(optionsPublic(f), gateKey(f) === 'o1');
});

test('AC6: withGate URLs differ across gate states for the pane, the story and all three opengraph-image URLs', () => {
  const urls = ['/u/h_x/pane?v=2', '/u/h_x/story?format=square', '/u/h_x/opengraph-image', '/u/h_x/month/2026-10/opengraph-image', '/u/h_x/trade/s%3A1/opengraph-image'];
  for (const u of urls) {
    const closed = withGate(u), open = withGate(u, OPEN_FIELDS);
    assert.notEqual(closed, open, u);
    assert.equal(closed, `${u}${u.includes('?') ? '&' : '?'}g=o0`);
    assert.equal(open, `${u}${u.includes('?') ? '&' : '?'}g=o1`);
  }
});

test('AC6: gateCacheControl keeps the cacheable header only for the current key; anything else is no-store', () => {
  const X = 'public, max-age=60';
  assert.equal(gateCacheControl('o0', X), X);
  assert.equal(gateCacheControl('o0', X, OPEN_FIELDS), 'no-store');
  assert.equal(gateCacheControl('o1', X, OPEN_FIELDS), X);
  assert.equal(gateCacheControl('o1', X), 'no-store');
  assert.equal(gateCacheControl(null, X), 'no-store');
  assert.equal(gateCacheControl('zz', X), 'no-store');
});

test('AC6: every URL-keyed public cache reference goes through withGate, and the routes check the key after the 404s', () => {
  assert.match(read('app/lazy-pane.tsx'), /withGate\(`\/u\/\$\{encodeURIComponent\(handle\)\}\/pane\?v=\$\{PAYLOAD_V\}`\)/);
  for (const f of ['app/u/[handle]/share-card.tsx', 'app/u/[handle]/share-prompt.tsx']) {
    const s = read(f);
    assert.match(s, /withGate\(`\/u\/\$\{handle\}\/story\?format=square`\)/, f);
    assert.doesNotMatch(s, /image=\{`\/u\/\$\{handle\}\/story/, f);
  }
  // Code review N1: the share prompt's preview of the unfurl image carries the key too.
  assert.match(read('app/u/[handle]/share-prompt.tsx'), /src=\{withGate\(`\/u\/\$\{handle\}\/opengraph-image`\)\}/);
  assert.match(read('app/u/[handle]/page.tsx'), /url: withGate\(`\/u\/\$\{user\.handle\}\/opengraph-image`\)/);
  assert.match(read('app/u/[handle]/month/[ym]/page.tsx'), /url: withGate\(`\/u\/\$\{r\.handle\}\/month\/\$\{r\.recap\.ym\}\/opengraph-image`\)/);
  assert.match(read('app/u/[handle]/trade/[sellId]/page.tsx'), /const url = withGate\(`\/u\/\$\{t\.handle\}\/trade\/\$\{encodeURIComponent\(sellId\)\}\/opengraph-image`\)/);
  for (const f of ['app/u/[handle]/pane/route.ts', 'app/u/[handle]/story/route.tsx']) {
    const s = read(f);
    const at = s.indexOf("isFilerHandle(handle) ? 'no-store' : gateCacheControl(");
    assert.ok(at > 0, f);
    const last404 = Math.max(s.lastIndexOf('status: 404'), s.lastIndexOf('return no()'));
    assert.ok(last404 > 0 && last404 < at, `${f}: the key check comes after every 404`);
  }
  // F-23's pins stay (lib/pane-model.test.ts:70-71).
  assert.match(read('app/u/[handle]/pane/route.ts'), /NextResponse\.json\(\{ v: PAYLOAD_V, state, model, chart, status,/);
});

const walk = (dir: URL, out: string[] = []) => {
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e.startsWith('.')) continue;
    const u = new URL(`${e}${statSync(new URL(e, dir)).isDirectory() ? '/' : ''}`, dir);
    if (u.pathname.endsWith('/')) walk(u, out); else if (/\.(ts|tsx)$/.test(e)) out.push(u.pathname);
  }
  return out;
};
test('AC6 (E1): no client file imports the options gate, the consent versions or node:crypto; gate-key imports only privacy-fields', () => {
  const files = [...walk(new URL('app/', ROOT)), ...walk(new URL('lib/', ROOT))];
  let clients = 0;
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    if (!/^\s*(\/\/[^\n]*\n\s*)*['"]use client['"]/.test(src)) continue;
    clients++;
    for (const m of src.matchAll(/from\s+['"]([^'"]+)['"]/g)) assert.doesNotMatch(m[1], /options-gate\.ts$|consent-versions\.ts$|^node:crypto$/, `${f} imports ${m[1]}`);
  }
  assert.ok(clients >= 3, 'found the client files');
  const imports = [...read('lib/gate-key.ts').matchAll(/(?:from|import)\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);
  assert.deepEqual(imports, ['./privacy-fields.ts']);
  assert.doesNotMatch(read('lib/privacy-fields.ts'), /^import /m);
});

test('AC6 (E6): /how reads no request state and sets no revalidate or dynamic export, so its body follows the deployed gate (QA L4: the build serves it no-store, via the root layout)', () => {
  const page = read('app/how/page.tsx');
  assert.doesNotMatch(page, /export const (revalidate|dynamic)\b/);
  assert.doesNotMatch(page, /\b(cookies|headers|searchParams|connection)\b/);
});

// ---- AC 2: one count line per card, from the closed-gate pane view only.
test('AC2: cardOptionsLine is the gated count text with the gate closed, and nothing once open, at zero counts or without a view', () => {
  const closed = paneView({ gate: 'closed', counts: C({ shown: 3, short: 1, openLong: 1 }) });
  assert.equal(cardOptionsLine(closed), OPTIONS.gated(4, 1));
  const open = paneView({ gate: 'open', counts: C({ shown: 2 }), summary: { n: 2, winRate: 0.5, avg: 0.01, range: null, bets: 2 } });
  assert.ok(open.line, 'the open view has an options line');
  assert.equal(cardOptionsLine(open), undefined);
  // Code review B1: an open record with short options only (no summary) gets a non-figures line; the card still has none.
  const shortOnly = paneView({ gate: 'open', counts: C({ short: 3, openShort: 1 }), summary: null });
  assert.ok(shortOnly.line, 'the open short-only view has a line');
  assert.equal(cardOptionsLine(shortOnly), undefined);
  assert.equal(cardOptionsLine(paneView({ gate: 'closed', counts: C() })), undefined);
  assert.equal(cardOptionsLine(undefined), undefined);
});

test('AC2: the card count line has its own class, and no pane or options-gated rule reaches it; feed-rows sets it through cardOptionsLine', () => {
  const css = read('app/globals.css');
  assert.match(css, /\.card-options-count \{ margin: 4px 0 0; \}/);
  for (const rule of css.match(/[^{}]+\{[^}]*\}/g) ?? []) {
    const sel = rule.slice(0, rule.indexOf('{'));
    if (sel.includes('card-options-count')) assert.doesNotMatch(sel, /\.pane|options-gated/, sel);
  }
  const ui = read('app/ui.tsx');
  assert.match(ui, /<p className="muted small card-options-count" data-options="card-count">\{optionsLine\}<\/p>/);
  assert.match(read('app/feed-rows.tsx'), /optionsLine=\{cardOptionsLine\(page\.options\?\.get\(t\.user_id\)\)\}/);
});

test('AC2 (D5 fallback): in the pane the qualifier sits directly before the headline figures, the count line after them', () => {
  const pane = read('app/pane.tsx');
  const figs = pane.slice(pane.indexOf('const figures = <>'), pane.indexOf('</>;', pane.indexOf('const figures = <>')));
  const at = (s: string) => figs.indexOf(s);
  assert.ok(at('<ShareTradesLabel') > 0, 'the label is in the figures block');
  assert.ok(at('<section className="stats"') > at('<ShareTradesLabel'), 'directly before the headline stats');
  assert.doesNotMatch(figs.slice(at('<ShareTradesLabel') + 1, at('<section className="stats"')), /<[A-Z]|<(p|div|section)\b/, 'nothing between them');
  assert.ok(at('<CombinedLine') > at('<OpenGrid') && at('<OpenGrid') > at('<section className="stats"'));
  assert.ok(at('<PaneOptions') > at('<CombinedLine'), 'the count line after the figures');
  assert.equal(figs.split('<ShareTradesLabel').length, 2, 'one label in the pane');
  assert.match(figs, /ponytail: cycle 5's pane line order \(F-21's exclusions line, then F-34's open line, then the options qualifier\)/);
  assert.doesNotMatch(read('app/globals.css'), /\.pane [^{]*\+ \.share-label/, 'no F-29 spacing rule for a moved label');
});

// ---- AC 3: share images, alt, F4-4 keep their qualifier (re-asserted, old tests untouched).
test('AC3: the month figures with monthExcludingOptions still end in the qualifier, and the card alt still carries "excluding options"', () => {
  const DAY = 86_400_000, now = new Date('2026-11-01T12:00:00Z');
  const trades = Array.from({ length: 8 }, (_, i) => ({ symbol: `S${i}`, openedAt: new Date(now.getTime() - (40 - i) * DAY), closedAt: new Date(now.getTime() - (30 - i) * DAY), returnPct: i % 2 ? 0.05 : -0.02, holdingDays: 10 }));
  const month = recordStrip({ ...stripFigures(trades, now), state: 'connected', demo: false, verified: true, handle: 'h_x', monthExcludingOptions: true }, 'figures');
  assert.equal(month.figures.at(-1)!.text, OPTIONS.shareLabel);
  const alt = cardAlt(recordCard({ kind: 'unfurl', handle: 'h_x', name: null, trades, state: 'connected', demo: false, verified: true, now, link: null, options: { shareLabel: true, line: OPTIONS.gated(2, 0) } }));
  assert.ok(alt.includes(OPTIONS.altQualifier), alt);
});

// ---- AC 7: the sign-off is recorded with the words.
test('AC7: the legal sign-off file quotes the signed words and the cycle-5 ballots, and no placement re-sign is pending', () => {
  const p = 'docs/features/logs/F-29/legal-signoff.md';
  assert.ok(existsSync(new URL(p, ROOT)), p);
  const s = read(p);
  assert.ok(s.includes(F29.howInterim), 'the words, verbatim');
  assert.match(s, /docs\/ideas\/approval-2026-11-01-cycle5\.md/);
  const norm = (x: string) => x.replace(/\s+/g, ' ');
  assert.ok(norm(read('docs/features/F-29-gated-options-wording.md')).includes(F29.howInterim), 'the feature file quotes the same words');
  const lines = s.split('\n').map((l) => l.trim());
  const signed = new Set(lines.filter((l) => l.startsWith('Signed:')).map((l) => l.slice('Signed:'.length).trim()));
  for (const l of lines.filter((x) => x.startsWith('Pending re-sign:'))) {
    assert.ok(signed.has(l.slice('Pending re-sign:'.length).trim()), `unsigned: ${l}`);
  }
});
