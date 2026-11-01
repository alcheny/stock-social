// F-19 · Number format and tone, first slice (docs/features/F-19-number-format-and-ranges.md, committee record
// docs/features/logs/F-19/committee-2026-11-01.md): one home for pct(), tone() and winPct(); Flat for a printed zero;
// pct() monotonic so a range printed through it keeps its order; today's output unchanged byte for byte.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import * as format from './format.ts';
import * as trades from './trades.ts';
import * as openSplit from './open-split.ts';
import { stripTypeScriptTypes } from 'node:module';
import { cardEvidence, evidenceRangeText } from './record-card.ts';

const { pct, tone, toneWord, winPct, F19_SWEEP_SITES } = format;
const ROOT = join(import.meta.dirname, '..');

// Seeded values (mulberry32), so a failure reproduces. Spread over [-1, 100] with extra density near 0 and -100%.
function seeded(n: number, seed = 19): number[] {
  let a = seed;
  const rnd = () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const u = rnd();
    out.push(i % 4 === 0 ? -1 + rnd() ** 6 * 0.01 : i % 4 === 1 ? (rnd() - 0.5) * 0.002 : i % 4 === 2 ? -1 + u * 101 : (u - 0.5) * 2);
  }
  return out;
}
// Rounding boundaries random values would miss.
const BOUNDARIES = [0, -0, 0.0005, -0.0005, 0.00049999, -0.00049999, 0.00005, -0.00005, 0.005, -0.005, 0.0004, -0.0004,
  1e-12, -1e-12, -0.995, -0.9995, -0.99995, -0.99996, -0.999995, -0.9999995, -0.99999999, -1, -1.5, 9.995, 10, 61.226, 99.9995];
const VALUES = [...BOUNDARIES, ...seeded(10_000)];
const DIGITS = [0, 1, 2];

// "≈-100.0%" is a loss strictly short of -100%, below every other near -100% output: it parses just above -100.
const JUST_ABOVE_TOTAL_LOSS = -100 + 1e-9;
const parse = (s: string): number => (s.startsWith('≈') ? JUST_ABOVE_TOTAL_LOSS : Number(s.replace('%', '')));
const signOf = (s: string): '+' | '-' | null => (s.startsWith('+') ? '+' : /^≈?-/.test(s) ? '-' : null);

test('F-19 one home: the old names are the same functions as lib/format.ts', () => {
  assert.equal(trades.pct, format.pct);
  assert.equal(openSplit.tone, format.tone);
});

// app/open-rows.tsx is JSX, which node:test can't import: its toneClass definition is read from the source, its types
// stripped, and run against lib/format.ts#tone, which the file must import.
const OPEN_ROWS = readFileSync(join(ROOT, 'app', 'open-rows.tsx'), 'utf8');
const toneClassSource = OPEN_ROWS.match(/^export const toneClass = (.*);$/m)?.[1];
const toneClass = new Function('tone', `return ${stripTypeScriptTypes(`(${toneClassSource})`)}`)(tone) as (x: number) => string | undefined;

test('F-19 one home: toneClass delegates to tone() (equal outputs over fixtures)', () => {
  assert.ok(toneClassSource, 'app/open-rows.tsx defines toneClass on one line');
  assert.match(OPEN_ROWS, /^import \{[^}]*\btone\b[^}]*\} from '@\/lib\/format\.ts';$/m);
  for (const x of [...BOUNDARIES, NaN, Infinity, -Infinity, ...seeded(500, 7)]) {
    const t = tone(x);
    assert.equal(toneClass(x), t === 'flat' ? undefined : t, `toneClass(${x})`);
  }
});

// A definition, not a use: `function pct(`, `const tone = (` / `= function` / `= async`. Locals such as
// `const pct = unrealizedPct(p)` and `tone:` properties are uses of other values and must not trip it.
const DEFINITION = /\bfunction\s+(pct|tone|winPct)\s*[(<]|\b(const|let|var)\s+(pct|tone|winPct)\b[^=]*(=>[^=]*)*=\s*(\(|function\b|async\b|[a-zA-Z_$][\w$]*\s*=>)/;
function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...sourceFiles(p));
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

test('F-19 grep: the definition pattern catches a second implementation and nothing else', () => {
  for (const planted of ['export function tone(x: number) {', 'function pct(x, d) {', 'export const winPct = (w: number, n: number) => 1;',
    'const tone = function (x) {', 'let pct = x => x;', 'export const pct: (x: number) => string = (x) => "";'])
    assert.match(planted, DEFINITION, planted);
  for (const ok of ['const pct = unrealizedPct(p);', "tone: 'ok' | 'muted' | 'warn';", 'const toneColor = (t: Tone) => t;',
    'export const toneClass = (x: number) => { const t = tone(x); };', 'const pct = c.share * 100;', 'pct(x, 0)', "{ tone: tone(x) }"])
    assert.doesNotMatch(ok, DEFINITION, ok);
});

test('F-19 grep: pct, tone and winPct are defined only in lib/format.ts', () => {
  const offenders: string[] = [];
  for (const dir of ['lib', 'app', 'scripts']) {
    for (const f of sourceFiles(join(ROOT, dir))) {
      if (f === join(ROOT, 'lib', 'format.ts')) continue;
      readFileSync(f, 'utf8').split('\n').forEach((line, i) => { if (DEFINITION.test(line)) offenders.push(`${f.slice(ROOT.length + 1)}:${i + 1}: ${line.trim()}`); });
    }
  }
  assert.deepEqual(offenders, []);
  assert.match(OPEN_ROWS, /export const toneClass = [^\n]*\btone\(/);
});

test('F-19 ponytail list: every call site left for the sweep rework still exists', () => {
  assert.ok(F19_SWEEP_SITES.length > 0);
  for (const f of F19_SWEEP_SITES) assert.ok(existsSync(join(ROOT, f)), f);
});

test('F-19 Flat: tone(0) and a printed zero are flat, never the loss colour, never "Gain"', () => {
  assert.equal(tone(0), 'flat');
  assert.equal(tone(-0), 'flat');
  assert.equal(tone(-0.0004), 'flat'); // prints "0.0%"
  assert.equal(pct(-0.0004), '0.0%');
  assert.equal(tone(NaN), 'flat');
  assert.equal(toneWord('flat'), 'Flat');
  assert.equal(toneWord('up'), 'Gain');
  assert.equal(toneWord('down'), 'Loss');
  for (const x of VALUES) for (const d of DIGITS) if (Number(pct(x, d).replace(/[≈%]/g, '')) === 0) {
    assert.equal(tone(x, d), 'flat', `pct(${x}, ${d}) = ${pct(x, d)}`);
    assert.notEqual(toneWord(tone(x, d)), 'Gain');
  }
});

test('F-19 sign: every printed number keeps its sign character, and tone matches it at digits 0, 1, 2', () => {
  for (const x of [...VALUES, NaN, Infinity, -Infinity]) for (const d of DIGITS) {
    const s = pct(x, d), t = tone(x, d), sign = signOf(s);
    assert.equal(t, sign === '+' ? 'up' : sign === '-' ? 'down' : 'flat', `pct(${x}, ${d}) = ${s}, tone ${t}`);
    if (sign === null && Number.isFinite(x)) assert.match(s, /^0(\.0+)?%$/, `unsigned only when it prints zero: ${s}`);
    if (s.includes('≈')) assert.ok(s.startsWith('≈-100'), s);
  }
});

test('F-19 property: pct() is monotonic, so a range printed through it keeps lo <= avg <= hi', () => {
  for (const d of DIGITS) {
    const xs = VALUES.filter(Number.isFinite).toSorted((a, b) => a - b);
    for (let i = 1; i < xs.length; i++)
      assert.ok(parse(pct(xs[i - 1], d)) <= parse(pct(xs[i], d)), `pct(${xs[i - 1]}, ${d}) = ${pct(xs[i - 1], d)} > pct(${xs[i]}, ${d}) = ${pct(xs[i], d)}`);
  }
  // Any lo <= avg <= hi triple prints in order.
  const xs = seeded(3000, 23);
  for (let i = 0; i + 2 < xs.length; i += 3) {
    const [lo, avg, hi] = xs.slice(i, i + 3).toSorted((a, b) => a - b);
    assert.ok(parse(pct(lo)) <= parse(pct(avg)) && parse(pct(avg)) <= parse(pct(hi)), `${pct(lo)} ${pct(avg)} ${pct(hi)}`);
  }
});

test('F-19 unchanged: today\'s ASCII output is pinned byte for byte (images and display log keep the hyphen)', () => {
  const pins: [number, number, string][] = [
    [-0.125, 1, '-12.5%'], [0.123, 1, '+12.3%'], [0, 1, '0.0%'], [-0.0004, 1, '0.0%'], [0.0005, 1, '+0.1%'],
    [61.226, 1, '+6122.6%'], [61.226, 0, '+6123%'], [-1, 1, '-100.0%'], [-1.5, 1, '-150.0%'],
    [-0.99996, 0, '-99.996%'], [-0.99996, 1, '-99.996%'], [-0.99996, 2, '-99.996%'],
    [-0.9999999, 0, '≈-100%'], [-0.9999999, 1, '-99.99999%'], [-0.9999999, 2, '-99.99999%'],
    [-0.99999999, 1, '≈-100.0%'], [-0.99999999, 2, '-99.999999%'], [-0.9995, 1, '-99.95%'], [-0.0005, 2, '-0.05%'],
  ];
  for (const [x, d, want] of pins) assert.equal(pct(x, d), want, `pct(${x}, ${d})`);
  // Six trades averaging -99.996% print today's form; the design system's "≈−100.0%" lands with the sweep rework.
  const six = Array(6).fill(-0.99996);
  assert.equal(pct(six.reduce((a, b) => a + b, 0) / six.length), '-99.996%');
  assert.equal(trades.pct(-0.125), '-12.5%');
  // No U+2212 reaches the display log's range text or the card's range on a losing record.
  const DAY = 86_400_000, t0 = Date.UTC(2026, 0, 1);
  const losing = Array.from({ length: 12 }, (_, i) => ({ symbol: `S${i}`, openedAt: new Date(t0 + i * 10 * DAY), closedAt: new Date(t0 + (i * 10 + 5) * DAY), returnPct: i % 3 ? -0.08 : 0.02, holdingDays: 5 }));
  const text = evidenceRangeText(cardEvidence(losing, new Date(t0 + 200 * DAY)));
  assert.ok(text && text.includes('-'), String(text));
  assert.ok(!text.includes('−'), text);
});

test('F-19 winPct: whole percent from counts, never 100% with a loss, never 0% with a win', () => {
  assert.equal(winPct(99, 100), '99%');
  assert.equal(winPct(199, 200), '99%');
  assert.equal(winPct(999, 1000), '99%');
  assert.equal(winPct(1, 200), '1%');
  assert.equal(winPct(1, 1000), '1%');
  assert.equal(winPct(0, 5), '0%');
  assert.equal(winPct(5, 5), '100%');
  assert.equal(winPct(1, 2), '50%');
  assert.equal(winPct(2, 3), '67%');
  assert.equal(winPct(0, 0), null);
  for (let n = 1; n <= 300; n++) for (let w = 0; w <= n; w++) {
    const s = winPct(w, n)!;
    if (w < n) assert.notEqual(s, '100%', `${w}/${n}`);
    if (w > 0) assert.notEqual(s, '0%', `${w}/${n}`);
    assert.ok(Math.abs(Number(s.slice(0, -1)) - (w / n) * 100) < 1, `${w}/${n} = ${s}`);
  }
});
