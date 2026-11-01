import { test } from 'node:test';
import assert from 'node:assert/strict';
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
