// F-20 AC7 (docs/features/F-20-design-tokens-and-contrast-test.md): colour literals live in two places only, the TOKENS
// block at the top of app/globals.css and the share-image colour table lib/palette.ts. This scanner fails on any other
// one in the repo's product source (every non-test .ts, .tsx and .css file outside docs/, e2e/ and scripts/): a hex colour,
// a colour function, or a named or system colour used as a colour. Comments are never read. A new colour is a token.
// AC9 (POLICY T3, P6): no externally hosted font or asset is loaded by the app's source.
// ponytail: a lexer heuristic (lib/source-lex.ts for TS, a declaration regex for CSS), not a CSS or TSX parser — swap in a
// real parser if the repo ever gains one with a JS API.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lex } from './source-lex.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SKIP_DIRS = new Set(['node_modules', 'docs', 'e2e', 'scripts', 'test-results', 'playwright-report', 'db', 'team', 'public']);
const ALLOWED_FILES = new Set(['lib/palette.ts']); // the share-image colour table
const TOKENS_START = '/* TOKENS (F-20, DS-1)';
const TOKENS_END = '/* end TOKENS */';

function files(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) files(p, out); } else if (/\.(tsx?|css)$/.test(e.name) && !/\.test\.tsx?$|\.d\.ts$/.test(e.name)) out.push(p);
  }
  return out;
}

// CSS named colours (CSS Color 4) and system colours.
const NAMED = new Set(('aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood ' +
  'cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey ' +
  'darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey ' +
  'darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite ' +
  'gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon ' +
  'lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue ' +
  'lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid ' +
  'mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin ' +
  'navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff ' +
  'peru pink plum powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver ' +
  'skyblue slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow ' +
  'yellowgreen accentcolor accentcolortext activetext buttonborder buttonface buttontext canvas canvastext field fieldtext graytext highlight ' +
  'highlighttext linktext mark marktext selecteditem selecteditemtext visitedtext').split(' '));
const HEX = /#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})(?![\w-])/gi;
const FN = /(?<![\w-])(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/gi;
// A hex preceded by these is a URL fragment or part of an identifier, not a colour (`…}#add`, `/path#abc`, `?a=1#x`).
const NOT_COLOUR_BEFORE = /[\w$}&/?=-]/;
const line = (src: string, at: number) => src.slice(0, at).split('\n').length;

// color-mix() is allowed only over tokens and transparent (the TOKENS block owns every value it mixes).
function badMixes(value: string): string[] {
  const out: string[] = [];
  for (let i = value.indexOf('color-mix('); i >= 0; i = value.indexOf('color-mix(', i + 1)) {
    let d = 0, j = i + 'color-mix'.length;
    for (; j < value.length; j++) { if (value[j] === '(') d++; else if (value[j] === ')' && --d === 0) break; }
    const args = value.slice(i + 'color-mix('.length, j).replace(/var\(--[\w-]+\)/g, '').replace(/\bin srgb\b|\btransparent\b|[\d.]+%|,/g, '').trim();
    if (args) out.push(value.slice(i, j + 1));
  }
  return out;
}

export function cssHits(rel: string, src: string): string[] {
  let text = src.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '));
  if (rel === 'app/globals.css') {
    const s = src.indexOf(TOKENS_START), e = src.indexOf(TOKENS_END);
    if (s >= 0 && e > s) text = text.slice(0, s) + text.slice(s, e).replace(/[^\n]/g, ' ') + text.slice(e);
  }
  const out: string[] = [];
  for (const m of text.matchAll(/([a-z-]+)\s*:\s*([^;{}]+)(?=[;}])/gi)) {
    const at = m.index! + m[0].indexOf(m[2]);
    const value = m[2].replace(/url\([^)]*\)/gi, (u) => ' '.repeat(u.length)).replace(/(["'])(?:(?!\1).)*\1/g, (s) => ' '.repeat(s.length));
    const hit = (what: string) => out.push(`${rel}:${line(src, at)} ${m[1]}: ${what}`);
    for (const h of value.matchAll(HEX)) if (!NOT_COLOUR_BEFORE.test(value[h.index! - 1] ?? '')) hit(h[0]);
    for (const f of value.matchAll(FN)) hit(`${f[0]}…`);
    for (const x of badMixes(value)) hit(x);
    for (const w of value.matchAll(/(?<![\w-])[a-z]+(?![\w(-])/gi)) if (NAMED.has(w[0].toLowerCase())) hit(w[0]);
  }
  return out;
}

// A string literal is used as a colour when it is assigned to a colour property or attribute.
const COLOUR_PROP = /(?:color|background\w*|border\w*|outline\w*|fill|stroke|stop-?color|flood-?color|lighting-?color|themeColor|textDecorationColor|caretColor|accentColor|boxShadow|box-shadow)['"]?\s*[:=]\s*\{?\s*$/i;
const COLOUR_CONTEXT = /(?:^\s*|[:(,=]\s*|\b(?:solid|dashed|dotted|double|inset|\d+px)\s+)$/;

export function tsHits(rel: string, src: string): string[] {
  const out: string[] = [];
  for (const p of lex(src).literals) {
    // `at` is the opening quote for '…' and "…", or the first character after ` or } for a template part.
    const quoted = src[p.at] === '\'' || src[p.at] === '"';
    const before = quoted ? src[p.at] : src[p.at - 1] ?? '';
    const lead = src.slice(Math.max(0, p.at - 60), p.at);
    const where = `${rel}:${line(src, p.at)}`;
    for (const h of p.text.matchAll(HEX)) {
      const i = h.index!;
      const prev = i > 0 ? p.text[i - 1] : before;
      if (i === 0 ? before === '}' : NOT_COLOUR_BEFORE.test(prev)) continue; // `${x}#add`, `/path#frag`
      const whole = p.text.trim() === h[0];
      if (whole && /(?:href|id|hash)\s*[=:]\s*\{?\s*$/i.test(lead)) continue; // a fragment link, not a colour
      if (whole || i === 0 || COLOUR_CONTEXT.test(p.text.slice(0, i))) out.push(`${where} ${h[0]}`);
    }
    for (const f of p.text.matchAll(FN)) out.push(`${where} ${f[0]}…`);
    for (const x of badMixes(p.text)) out.push(`${where} ${x}`);
    if (COLOUR_PROP.test(lead)) for (const w of p.text.matchAll(/(?<![\w-])[a-z]+(?![\w-])/gi)) if (NAMED.has(w[0].toLowerCase())) out.push(`${where} ${w[0]}`);
  }
  return out;
}

export function hits(rel: string, src: string): string[] {
  if (ALLOWED_FILES.has(rel)) return [];
  return rel.endsWith('.css') ? cssHits(rel, src) : tsHits(rel, src);
}

const sources = () => files(ROOT).map((f) => ({ rel: relative(ROOT, f).split('\\').join('/'), src: readFileSync(f, 'utf8') }));

test('F-20 AC7: no colour literal outside the TOKENS block and lib/palette.ts', () => {
  const all = sources();
  assert.ok(all.some((f) => f.rel === 'app/globals.css') && all.some((f) => f.rel === 'app/layout.tsx') && all.some((f) => f.rel === 'proxy.ts'), 'the scan reaches app/, lib/ and root files');
  assert.ok(!all.some((f) => /^(docs|e2e|scripts)\/|\.test\.ts$/.test(f.rel)), 'docs, e2e, scripts and tests are out of scope');
  assert.deepEqual(all.flatMap((f) => hits(f.rel, f.src)), []);
});

test('F-20 AC7: the scanner flags colour literals in TS, TSX and CSS', () => {
  const ts = [
    "const a = '#22c55e';",
    "const b = { color: '#fff' };",
    'const c = <svg><line fill="red" /></svg>;',
    "const d = <p style={{ background: 'rgb(0 0 0)' }} />;",
    "const e = { border: '1px solid #abc' };",
    "const f = `color-mix(in srgb, #000 10%, transparent)`;",
    "const g = { stroke: 'CanvasText' };",
    // Review B3: after `} />` (a JSX attribute expression closing an element) the lexer once read a regex and skipped the rest.
    'const h = <svg><path d={d} /><path fill="#123456" /></svg>;',
    'const i = <svg><path d={d} /><path stroke="tomato" /></svg>;',
  ].join('\n');
  const h = hits('x.tsx', ts);
  for (const n of [1, 2, 3, 4, 5, 6, 7, 8, 9]) assert.ok(h.some((s) => s.startsWith(`x.tsx:${n} `)), `line ${n} flagged: ${h.join(' | ')}`);
  const css = ['.a { color: #fff; }', '.b { background: rgb(0 0 0); }', '.c { border: 1px solid red; }', '.d { color: Canvas; }',
    '.e { background: color-mix(in srgb, white 10%, transparent); }', '.f { fill: hsl(0 0% 0%); }', '.g { box-shadow: 0 0 0 1px #000a; }'].join('\n');
  const c = hits('x.css', css);
  for (const n of [1, 2, 3, 4, 5, 6, 7]) assert.ok(c.some((s) => s.startsWith(`x.css:${n} `)), `css line ${n} flagged: ${c.join(' | ')}`);
});

test('F-20 AC7: the scanner passes fragments, prose, comments, regex literals, tokens and allowed keywords', () => {
  const ts = [
    "redirect(viewUrl(id, `m=added&n=${r.count}#add`));",
    "const x = `${base}#add`;",
    "const l = <a href=\"#add\">Add</a>;",
    "const t = 'Trade #123';",
    "// a comment with #22c55e and red",
    "/* rgb(0 0 0) */ const ok = 1;",
    "const re = /^#[0-9a-f]{3,6}\\b/i;",
    "const s = { color: 'var(--text)', fill: 'currentColor', stroke: 'none', background: 'transparent' };",
    "const w = 'white-space';",
    "const word = 'Red flags are words, not colours';",
    "const h = `#${[1, 2].join('')}`;",
  ].join('\n');
  assert.deepEqual(hits('x.tsx', ts), []);
  const css = ['/* #fff red rgb(0 0 0) */', '.a { white-space: nowrap; color: var(--text); }', '.b { background: url(#timeline-hatch); fill: currentColor; }',
    '#add, #bad { color: inherit; }', '.c { background: color-mix(in srgb, var(--up) 18%, transparent); }', '.d { content: "red"; outline: none; }',
    '.e { border-color: transparent; caret-color: auto; }', '.f:hover { color: var(--muted); }', '#options { scroll-margin-top: 72px; }'].join('\n');
  assert.deepEqual(hits('x.css', css), []);
  assert.deepEqual(hits('app/globals.css', `${TOKENS_START} */\n:root { --bg: #0b0b0f; }\n${TOKENS_END}\n.a { color: var(--bg); }`), []);
  assert.equal(hits('app/globals.css', `${TOKENS_START} */\n:root { --bg: #0b0b0f; }\n${TOKENS_END}\n.a { color: #0b0b0f; }`).length, 1);
  assert.deepEqual(hits('lib/palette.ts', "export const P = { bg: '#0b0b0f' };"), []);
});

// ---- AC9: no externally hosted font or asset (POLICY T3; no third-party transfer, P6) ----
export function externalAssets(rel: string, src: string): string[] {
  const out: string[] = [];
  const flag = (re: RegExp, what: string) => { for (const m of src.matchAll(re)) out.push(`${rel}:${line(src, m.index!)} ${what}`); };
  if (rel.endsWith('.css')) {
    flag(/@import\b/g, '@import');
    flag(/url\(\s*['"]?(?:https?:)?\/\//gi, 'remote url()');
  } else {
    flag(/['"]next\/font\/google['"]/g, 'next/font/google');
    flag(/<link\b[^>]*\bhref=\{?\s*['"`](?:https?:)?\/\//gi, 'remote <link>');
    flag(/<(?:script|img|iframe|video|audio|source)\b[^>]*\bsrc=\{?\s*['"`](?:https?:)?\/\//gi, 'remote src');
    flag(/\bfetch\(\s*['"`]https?:\/\/(?!localhost|127\.0\.0\.1)/gi, 'remote fetch');
    flag(/\bfonts\s*:\s*\[/g, 'a font file for next/og');
  }
  return out;
}
test('F-20 AC9: no source file loads an externally hosted font or asset', () => {
  const all = sources();
  assert.deepEqual(all.flatMap((f) => externalAssets(f.rel, f.src)), []);
  assert.equal(externalAssets('x.css', '@import url("https://fonts.example/x.css");').length, 2);
  assert.equal(externalAssets('x.tsx', "import { Sans } from 'next/font/google';").length, 1);
  assert.equal(externalAssets('x.tsx', '<link rel="stylesheet" href="https://cdn.example/x.css" />').length, 1);
  assert.equal(externalAssets('x.tsx', '<img src="https://cdn.example/x.png" />').length, 1);
  assert.deepEqual(externalAssets('x.tsx', '<a href="https://example.com">x</a>'), []);
});
