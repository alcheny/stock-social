import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cutCodePoints, leet, neutralizeFigures, sanitizeUserText, skeleton, squash } from './text-safety.ts';

// Every character decision 1 says is removed from stored text.
const STRIPPED: number[] = [
  ...range(0x202a, 0x202e), ...range(0x2066, 0x2069), 0x200e, 0x200f, 0x061c,
  0x200b, 0x200c, ...range(0x2060, 0x2064), 0xfeff, 0x00ad, 0x180e,
  ...range(0x00, 0x08), ...range(0x0b, 0x0c), ...range(0x0e, 0x1f), 0x7f, ...range(0x80, 0x9f),
]; // tab becomes a space, CR a line break (tested below)
function range(a: number, b: number) { const o: number[] = []; for (let i = a; i <= b; i++) o.push(i); return o; }

test('sanitizeUserText: no stripped character survives, wherever it sits', () => {
  for (const cp of STRIPPED) {
    const c = String.fromCodePoint(cp);
    const out = sanitizeUserText(`${c}sold${c} half${c} at the open${c}`);
    assert.ok(!out.includes(c), `U+${cp.toString(16)} survived`);
    assert.equal(out, 'sold half at the open', `U+${cp.toString(16)}`);
  }
});

test('sanitizeUserText: the zero-width joiner is kept (emoji sequences need it)', () => {
  const family = '\u{1F468}‍\u{1F469}‍\u{1F467}';
  assert.equal(sanitizeUserText(`Long ${family}`), `Long ${family}`);
});

test('sanitizeUserText: look-alike digits and percent signs become ASCII', () => {
  assert.equal(sanitizeUserText('４０％'), '40%'); // fullwidth
  assert.equal(sanitizeUserText('٤٠٪'), '40%'); // Arabic-Indic + Arabic percent
  assert.equal(sanitizeUserText('۴۰﹪'), '40%'); // extended Arabic-Indic + small percent
  assert.equal(sanitizeUserText('\u{1D7D2}\u{1D7CE}%'), '40%'); // mathematical bold
  assert.equal(sanitizeUserText('\u{1D7FA}\u{1D7F6}%'), '40%'); // mathematical monospace
  assert.equal(neutralizeFigures('abc 12'), 'abc 12');
});

test('sanitizeUserText: newlines kept, tabs and runs of spaces collapsed, trimmed', () => {
  assert.equal(sanitizeUserText('  a\t\tb  \r\n\r\n\r\n\r\nc  '), 'a b\n\nc');
  assert.equal(sanitizeUserText('a\rb'), 'a\nb');
  assert.equal(sanitizeUserText(''), '');
});

test('sanitizeUserText: at most max code points, never a split surrogate', () => {
  const emoji = '\u{1F600}';
  const out = sanitizeUserText(emoji.repeat(300));
  assert.equal(Array.from(out).length, 280);
  assert.ok(out.isWellFormed());
  assert.equal(Array.from(sanitizeUserText('x'.repeat(50) + emoji.repeat(5), 52)).length, 52);
  assert.ok(sanitizeUserText('ab' + emoji, 3).isWellFormed());
  assert.equal(cutCodePoints(emoji.repeat(3), 2), emoji.repeat(2));
  assert.ok(sanitizeUserText('a\uD800b').isWellFormed()); // a lone surrogate never reaches storage
});

test('sanitizeUserText: idempotent (sanitising twice changes nothing)', () => {
  const samples = [
    'I made ‮%05‬ this year', 'e​́ café', '４０％ gain', ' x '.repeat(200),
    'Line one\n\n\n\nline two\t\tend', '\u{1F468}‍\u{1F469} ok', 'a'.repeat(279) + '\u{1F600}\u{1F600}',
    'trailing space cut ' + 'y'.repeat(270),
  ];
  // Pseudo-random strings mixing every class of character the function touches.
  const pool = ['a', 'Z', ' ', '\n', '\t', '‮', '​', '‍', '５', '٥', '%', '٪', 'e', '́', '\u{1F600}', '\u0007'];
  let seed = 7;
  for (let n = 0; n < 300; n++) {
    let s = '';
    for (let i = 0; i < 1 + (n % 40); i++) { seed = (seed * 1103515245 + 12345) % 2 ** 31; s += pool[seed % pool.length]; }
    samples.push(s);
  }
  for (const s of samples) {
    const once = sanitizeUserText(s, 30);
    assert.equal(sanitizeUserText(once, 30), once, JSON.stringify(s));
    const def = sanitizeUserText(s);
    assert.equal(sanitizeUserText(def), def, JSON.stringify(s));
  }
});

test('skeleton: NFKC, every format character gone (joiner too), lower case, Cyrillic and Greek look-alikes mapped', () => {
  assert.equal(skeleton('G​u‍ar‮antee'), 'guarantee');
  assert.equal(skeleton('сору trading'), 'copy trading'); // Cyrillic s, o, r, u
  assert.equal(skeleton('ορα'), 'opa'); // Greek omicron, rho, alpha
  assert.equal(skeleton('ＴＯＰ'), 'top'); // fullwidth letters fold
  assert.equal(skeleton('٤٠٪'), '40%');
  assert.equal(skeleton('  A \n  B  '), 'a b');
});

test('leet: rewrites only tokens holding a letter and not starting with $; two forms for 1', () => {
  const [i, l] = leet('v3r1f13d 12% $XY7 5-day');
  assert.equal(i, 'verified 12% $XY7 s-day');
  assert.equal(l, 'verlfled 12% $XY7 s-day');
});

test('squash: punctuation inside a word goes, single-character runs join, whole words never glue', () => {
  assert.equal(squash('v.e.r-i_fied'), 'verified');
  assert.equal(squash('s t o c k s o c i a l'), 'stocksocial');
  assert.equal(squash('cover if i edit'), 'cover if i edit');
});

// Fix round 1: every default-ignorable character goes (the joiner and the variation selectors stay in stored text),
// plus the braille blank; the skeleton removes all of them, drops combining marks and reads 。 as a dot.
const EXTRA_INVISIBLE = [0x034f, 0x3164, 0xffa0, 0x115f, 0x1160, 0x17b4, 0x17b5, 0x2800, ...range(0x206a, 0x206f),
  0x180b, 0x180c, 0x180d, 0x180f, 0xe0001, 0xe0020, 0xe0041, 0xe007f, 0xfff0, 0x1bca0, 0x1d173];

test('sanitizeUserText and skeleton: Hangul fillers, the grapheme joiner, braille blank, tags and the rest are removed', () => {
  for (const cp of EXTRA_INVISIBLE) {
    const c = String.fromCodePoint(cp);
    assert.equal(sanitizeUserText(`exam${c}ple${c}.com`), 'example.com', `U+${cp.toString(16)}`);
    assert.equal(skeleton(`Exam${c}ple`), 'example', `U+${cp.toString(16)}`);
  }
  // Kept in stored text: the joiner, emoji presentation and CJK variation selectors. Gone in the skeleton.
  for (const c of ['‍', '︎', '️', '\u{E0100}', '\u{E01EF}']) {
    assert.equal(sanitizeUserText(`a${c}b`), `a${c}b`, JSON.stringify(c));
    assert.equal(skeleton(`a${c}b`), 'ab', JSON.stringify(c));
  }
  assert.equal(sanitizeUserText('❤️ ok'), '❤️ ok');
});

test('skeleton: combining marks dropped, ideographic full stop reads as a dot', () => {
  assert.equal(skeleton('vérified'), 'verified');
  assert.equal(skeleton('vérified'), 'verified');
  assert.equal(skeleton('example。com'), 'example.com');
  assert.equal(skeleton('Ana María'), 'ana maria');
});

test('the Postgres cleanup class equals the stored-text strip set, code point by code point, and the schema uses it', async () => {
  const { isStripped, STRIP_CLASS_SQL } = await import('./text-safety.ts');
  const js = new RegExp(STRIP_CLASS_SQL.replace(/\\U([0-9A-F]{8})/g, (_, h: string) => `\\u{${h.replace(/^0+/, '')}}`), 'u');
  const diff: string[] = [];
  for (let cp = 1; cp <= 0x10ffff; cp++) {
    if (cp >= 0xd800 && cp <= 0xdfff) continue;
    const c = String.fromCodePoint(cp);
    if (isStripped(c) !== js.test(c)) diff.push(cp.toString(16));
  }
  assert.deepEqual(diff.slice(0, 20), []);
  const schema = readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8');
  const uses = schema.split(STRIP_CLASS_SQL).length - 1;
  assert.ok(uses >= 6, `schema.sql uses STRIP_CLASS_SQL verbatim (${uses})`);
});
