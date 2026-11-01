import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cutCodePoints, isStripped, leet, neutralizeFigures, sanitizeUserText, skeleton, squash, squashSpans } from './text-safety.ts';

// Every character decision 1 says is removed from stored text.
const STRIPPED: number[] = [
  ...range(0x202a, 0x202e), ...range(0x2066, 0x2069), 0x200e, 0x200f, 0x061c,
  // Fix round 5: U+200C (non-joiner) is kept in stored text (Persian, Indic).
  0x200b, ...range(0x2060, 0x2064), 0xfeff, 0x00ad, 0x180e,
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
  const family = '\u{1F468}\u200D\u{1F469}\u200D\u{1F467}';
  assert.equal(sanitizeUserText(`Long ${family}`), `Long ${family}`);
});

test('sanitizeUserText: look-alike digits and percent signs become ASCII', () => {
  assert.equal(sanitizeUserText('４０％'), '40%'); // fullwidth
  // Fix round 5 (item 1): native Arabic-Indic and Persian digits and the Arabic percent sign are stored as typed (the
  // skeleton reads them as figures); the small percent sign is a look-alike and still becomes '%'.
  assert.equal(sanitizeUserText('٤٠٪'), '٤٠٪');
  assert.equal(sanitizeUserText('۴۰﹪'), '۴۰%');
  assert.equal(skeleton('٤٠٪ ۴۰﹪'), '40% 40%');
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
    'I made \u202E%05\u202C this year', 'e\u200B́ café', '４０％ gain', ' x '.repeat(200),
    'Line one\n\n\n\nline two\t\tend', '\u{1F468}\u200D\u{1F469} ok', 'a'.repeat(279) + '\u{1F600}\u{1F600}',
    'trailing space cut ' + 'y'.repeat(270),
  ];
  // Pseudo-random strings mixing every class of character the function touches.
  const pool = ['a', 'Z', ' ', '\n', '\t', '\u202E', '\u200B', '\u200D', '５', '٥', '%', '٪', 'e', '́', '\u{1F600}', '\u0007'];
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
  assert.equal(skeleton('G\u200Bu\u200Dar\u202Eantee'), 'guarantee');
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
  for (const c of ['\u200D', '︎', '️', '\u{E0100}', '\u{E01EF}']) {
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

// ---- Fix round 5 (item 1): store faithfully, normalise only for matching ----

const ENGLAND = '\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}';
const SCOTLAND = '\u{1F3F4}\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}';
const WALES = '\u{1F3F4}\u{E0067}\u{E0062}\u{E0077}\u{E006C}\u{E0073}\u{E007F}';

test('fix round 5: the non-joiner survives in Persian and Indic text and names; the skeleton removes it', async () => {
  const { checkDisplayName } = await import('./handles.ts');
  for (const t of ['می\u200Cخواهم', 'क्\u200Cष', 'ابراهیم\u200Cزاده']) {
    assert.ok(t.includes('\u200C'));
    assert.equal(sanitizeUserText(t), t);
    assert.ok(!skeleton(t).includes('\u200C'));
  }
  assert.deepEqual(checkDisplayName('ابراهیم\u200Cزاده'), { ok: true, name: 'ابراهیم\u200Cزاده' });
  assert.equal(isStripped('\u200C'), false);
});

test('fix round 5: subdivision flag tag sequences survive; a stray tag still goes, also after a cut', () => {
  for (const f of [ENGLAND, SCOTLAND, WALES]) {
    assert.equal(sanitizeUserText(`Long the pound ${f}`), `Long the pound ${f}`);
    assert.equal(skeleton(`a${f}b`), 'a b'); // the flag is an emoji (a space); its tags go
  }
  assert.equal(sanitizeUserText('exam\u{E0041}ple'), 'example'); // a tag outside a sequence
  assert.equal(sanitizeUserText('\u{1F3F4}\u{E0067}\u{E0062} no cancel'), '\u{1F3F4} no cancel'); // no cancel tag: not a sequence
  assert.equal(sanitizeUserText('\u{E0067}\u{E0062}\u{E007F}x'), 'x'); // no black flag
  // A cut inside the sequence leaves no stray tag, and cleaning again changes nothing.
  const cut = sanitizeUserText(`ab ${ENGLAND}`, 6);
  assert.equal(cut, 'ab \u{1F3F4}');
  assert.equal(sanitizeUserText(cut, 6), cut);
});

test('fix round 5: fullwidth and mathematical figures still become ASCII in stored text (D-02); native digits stay', () => {
  assert.equal(sanitizeUserText('I made ４０％'), 'I made 40%');
  assert.equal(sanitizeUserText('\u{1D7D2}\u{1D7CE}%'), '40%');
  assert.equal(sanitizeUserText('سود ۳۰٪ در ماه'), 'سود ۳۰٪ در ماه');
  assert.equal(skeleton('سود ۳۰٪'), 'سود 30%');
});

test('fix round 5: the script examples are unchanged by cleaning and still matched by moderation', async () => {
  const { moderateDetail } = await import('./moderation.ts');
  for (const t of ['می\u200Cخواهم بخرم', `Sold the pound ${ENGLAND}`]) {
    assert.equal(sanitizeUserText(t), t);
    assert.equal(moderateDetail(t).status, 'published');
  }
  // A claim in Persian digits is stored as typed and still held; a link split by a non-joiner is still a link.
  for (const t of ['۳۰٪ a month, easy', 'my account is up ٤٠٪', 'exam\u200Cple.com', `${ENGLAND} copy my trades`]) {
    assert.equal(sanitizeUserText(t), t);
    assert.equal(moderateDetail(sanitizeUserText(t)).status, 'held', t);
  }
});

test('fix round 5: emoji and symbols separate words in the matching forms; dashes read as "-"; spaced domains keep dots', () => {
  assert.equal(skeleton('dm🔥me'), 'dm me');
  assert.equal(skeleton('stop\u2010loss \u22125%'), 'stop-loss -5%');
  assert.equal(squash('join🔥my🔥group'), 'join my group');
  assert.equal(squash('e x a m p l e . c o m'), 'example.com');
  assert.equal(squash('g.u.a.r.a.n.t.e.e.d'), 'guaranteed');
  assert.equal(squash("didn't join; my plan"), 'didnt join; my plan');
});

test('fix round 6: the Latin script g (U+0261) reads as g', () => {
  assert.equal(skeleton('\u0261et rich'), 'get rich');
  assert.equal(skeleton('\u0261uarantee\u0261'), 'guaranteeg');
  assert.equal(sanitizeUserText('\u0261et'), '\u0261et'); // matching only: stored as typed
});

test('fix round 6: squashSpans joins only runs of single characters and reports where each joined run sits', () => {
  const a = squashSpans('t o t h e m o o n');
  assert.equal(a.text, 'tothemoon');
  assert.deepEqual(a.joined, [[0, 9]]);
  const b = squashSpans('j o i n m y group');
  assert.equal(b.text, 'joinmy group');
  assert.deepEqual(b.joined, [[0, 6]]);
  // ordinary words are never joined: no joined run, and the text is squash's
  for (const t of ['cover if i edit', 'Decided it was time to sell after the second miss.', "didn't join; my plan", 'buy a dip']) {
    assert.deepEqual(squashSpans(t).joined, [], t);
    assert.equal(squashSpans(t).text, squash(t), t);
  }
  // the text always equals squash's, line by line
  const c = squashSpans('d m m e\nsee e x a m p l e . c o m now');
  assert.equal(c.text, squash('d m m e\nsee e x a m p l e . c o m now'));
  assert.deepEqual(c.joined.map(([s, e]) => c.text.slice(s, e)), ['dmme', 'example.com']);
});

test('fix round 5: the stray-tag cleanup is the same in Postgres', { skip: !process.env.DATABASE_URL && 'no DATABASE_URL' }, async () => {
  const { STRAY_TAG_SQL } = await import('./text-safety.ts');
  const { sql } = await import('./db.ts');
  try {
    for (const t of [`a ${ENGLAND} b`, 'exam\u{E0041}ple', `x\u{E0067}${WALES}\u{E007F}`, '\u{1F3F4}\u{E0067} y']) {
      const [{ out }] = await sql`select regexp_replace(${t}::text, ${STRAY_TAG_SQL}, ${'\\1'}, 'g') as out`;
      assert.equal(out, sanitizeUserText(t), JSON.stringify(t));
    }
  } finally { await sql.end({ timeout: 1 }); }
});
