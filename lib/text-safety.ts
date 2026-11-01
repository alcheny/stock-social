// User-text safety (fix committee 2026-11-01, decision 1): clean on save, match on a skeleton.
// sanitizeUserText is what gets STORED (theses, display names): it removes the characters that can reverse, hide or
// spoof text, so every surface (pages, <title>, share images that can't use <bdi>) is protected. skeleton is for
// MATCHING only (lib/moderation.ts, lib/handles.ts): it is never stored or shown. No confusables library (POLICY H):
// the look-alike map below is hand-written and deliberately small.

// Direction controls: embeddings/overrides (U+202A–202E), isolates (U+2066–2069), LRM/RLM, Arabic letter mark.
export const DIRECTION_CHARS = '\u202A-\u202E\u2066-\u2069\u200E\u200F\u061C';
// Zero-width and invisible format characters. U+200D (zero-width joiner) is deliberately NOT here: it can't reverse
// text and emoji sequences need it. Fix round 5 (item 1): nor is U+200C (zero-width non-joiner): Persian and Indic
// spelling needs it inside words; it can't reverse text, and the skeleton removes it before matching.
export const INVISIBLE_CHARS = '\u200B\u2060-\u2064\uFEFF\u00AD\u180E';
// C0/C1 controls except \n (tab is turned into a space first).
const CONTROL_CHARS = '\u0000-\u0009\u000B-\u001F\u007F-\u009F';
// Fix round 1: every Default_Ignorable_Code_Point (Hangul fillers U+3164/U+FFA0/U+115F/U+1160, the grapheme joiner
// U+034F, Khmer U+17B4/5, tags U+E0000–E007F, U+206A–206F, Mongolian selectors ...) is invisible and goes too, except
// the ones emoji and CJK names need: the zero-width joiner U+200D and the variation selectors U+FE00–FE0F and
// U+E0100–E01EF (the skeleton removes those as well, so they never hide a word from the rules). The braille blank
// U+2800 is not default-ignorable but renders as nothing, so it goes too.
// Fix round 5 (item 1): stored text is kept as typed, only matching normalises. The non-joiner U+200C stays, and so do
// the tag characters U+E0020–E007F when they spell an emoji tag sequence (the black flag U+1F3F4, tags, then the cancel
// tag U+E007F: the subdivision flags); a tag anywhere else is invisible and goes (STRAY_TAG below).
const KEEP_RE = /[\u200C\u200D\uFE00-\uFE0F\u{E0020}-\u{E007F}\u{E0100}-\u{E01EF}]/u;
const IGNORABLE_RE = /[\p{Default_Ignorable_Code_Point}\u2800]/gu;
const STRIP_RE = new RegExp(`[${DIRECTION_CHARS}${INVISIBLE_CHARS}${CONTROL_CHARS}]`, 'gu');
const stripInvisible = (s: string) => s.replace(STRIP_RE, '').replace(IGNORABLE_RE, (c) => (KEEP_RE.test(c) ? c : ''));
// A whole tag sequence is kept (group 1); a tag outside one is replaced by the empty group. The same pattern and
// replacement run in Postgres (STRAY_TAG_SQL with '\1': an unmatched group is empty there too).
const STRAY_TAG = /(\u{1F3F4}[\u{E0020}-\u{E007E}]+\u{E007F})|[\u{E0020}-\u{E007F}]/gu;
export const STRAY_TAG_SQL = String.raw`(\U0001F3F4[\U000E0020-\U000E007E]+\U000E007F)|[\U000E0020-\U000E007F]`;
const stripStrayTags = (s: string) => s.replace(STRAY_TAG, '$1');
/**
 * True when sanitizeUserText removes this one character wherever it stands (tab and \n aside: those become a space and
 * stay). The tag characters U+E0020–E007F are not in this set: they go only outside a tag sequence (STRAY_TAG_SQL).
 */
export const isStripped = (c: string): boolean => c !== '\t' && c !== '\n' && stripInvisible(c) === '';
// The same set as a Postgres regular-expression bracket (db/schema.sql's stored-text cleanup; NUL can't be stored).
// lib/text-safety.test.ts proves it equals isStripped over every code point, and that the schema uses it verbatim.
export const STRIP_CLASS_SQL = String.raw`[\u00AD\u034F\u061C\u115F\u1160\u17B4\u17B5\u180B-\u180F\u200B\u200E\u200F\u202A-\u202E\u2060-\u206F\u2800\u3164\uFEFF\uFFA0\uFFF0-\uFFF8\U0001BCA0-\U0001BCA3\U0001D173-\U0001D17A\U000E0000-\U000E001F\U000E0080-\U000E00FF\U000E01F0-\U000E0FFF\x01-\x08\x0B-\x1F\x7F-\x9F]`;

// Decimal-digit blocks whose zero sits at a known code point, so digit = cp - zero.
// Fix round 5 (item 1): two sets. LOOKALIKE_ZEROS are the digits that imitate ASCII ones (fullwidth, mathematical): a
// figure typed in them is a spoof (D-02), so stored text gets the plain digit. Arabic-Indic and extended Arabic-Indic
// digits are how Arabic and Persian are written: stored as typed, read as digits by the skeleton only.
const LOOKALIKE_ZEROS = [
  0xff10, // fullwidth
  0x1d7ce, 0x1d7d8, 0x1d7e2, 0x1d7ec, 0x1d7f6, // mathematical bold, double-struck, sans-serif, sans bold, monospace
];
const NATIVE_ZEROS = [0x0660, 0x06f0]; // Arabic-Indic, extended Arabic-Indic (Persian, Urdu)
const LOOKALIKE_PERCENTS = new Set([0xfe6a, 0xff05]); // small percent, fullwidth percent
const NATIVE_PERCENTS = new Set([0x066a]); // Arabic percent sign

function mapFigures(s: string, zeros: number[], percents: Set<number>): string {
  let out = '';
  for (const ch of s) {
    const cp = ch.codePointAt(0)!;
    if (percents.has(cp)) { out += '%'; continue; }
    const zero = zeros.find((z) => cp >= z && cp <= z + 9);
    out += zero === undefined ? ch : String(cp - zero);
  }
  return out;
}
// Matching: every listed digit and percent sign becomes plain ASCII, so a figure in any of them is read as a figure.
const ALL_ZEROS = [...LOOKALIKE_ZEROS, ...NATIVE_ZEROS];
const ALL_PERCENTS = new Set([...LOOKALIKE_PERCENTS, ...NATIVE_PERCENTS]);
export const neutralizeFigures = (s: string): string => mapFigures(s, ALL_ZEROS, ALL_PERCENTS);
// Storage: only the look-alikes become ASCII (a spoofed figure turns into a plain one every viewer reads the same).
export const neutralizeLookalikeFigures = (s: string): string => mapFigures(s, LOOKALIKE_ZEROS, LOOKALIKE_PERCENTS);

// Cut at `max` code points (never splits a surrogate pair).
export const cutCodePoints = (s: string, max: number): string => {
  const cps = Array.from(s);
  return cps.length <= max ? s : cps.slice(0, max).join('');
};

export function sanitizeUserText(s: string, max = 280): string {
  let t = String(s ?? '').toWellFormed().replace(/\t/g, ' ').replace(/\r\n?/g, '\n');
  t = stripStrayTags(stripInvisible(t));
  t = neutralizeLookalikeFigures(t).normalize('NFC');
  t = t.replace(/[^\S\n]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  // A cut inside a tag sequence leaves its tags stray: they go, so cleaning twice changes nothing.
  return stripStrayTags(cutCodePoints(t, max)).trim();
}

// Hand-written Cyrillic and Greek look-alikes (lower case; skeleton lower-cases first).
const LOOKALIKE: Record<string, string> = {
  а: 'a', в: 'b', е: 'e', ё: 'e', к: 'k', м: 'm', н: 'h', о: 'o', п: 'n', р: 'p', с: 'c', т: 't', у: 'y', х: 'x',
  ѕ: 's', і: 'i', ї: 'i', ј: 'j', ԁ: 'd', ԛ: 'q', ԝ: 'w', һ: 'h', ӏ: 'l', ь: 'b',
  α: 'a', β: 'b', ε: 'e', η: 'n', ι: 'i', κ: 'k', ν: 'v', ο: 'o', ρ: 'p', τ: 't', υ: 'u', χ: 'x', γ: 'y', ω: 'w', ς: 'c',
};
const LOOKALIKE_RE = new RegExp(`[${Object.keys(LOOKALIKE).join('')}]`, 'gu');

// Matching form: NFKC, every format character (\p{Cf}, the joiner included) and control removed, look-alike figures
// neutralised, lower case, Cyrillic/Greek look-alikes mapped to Latin, spaces collapsed.
// Fix round 1: every default-ignorable character (variation selectors included) and the braille blank go as well,
// combining marks are dropped ("vérified" matches "verified"), and the ideographic full stop reads as a dot.
// Fix round 5 (item 2): an emoji is a space, never nothing ("dm🔥me" reads "dm me"), and the hyphens and dashes
// U+2010–2015 and the minus sign U+2212 read as "-" ("stop‐loss" with U+2010 is "stop-loss"). The non-joiner, tags and
// every digit block (Arabic-Indic included) are normalised here, never in stored text.
export function skeleton(s: string): string {
  let t = String(s ?? '').toWellFormed().normalize('NFKC').replace(/\p{Extended_Pictographic}/gu, ' ')
    .replace(/[\p{Cf}\p{Cc}\p{Default_Ignorable_Code_Point}\u2800]/gu, (c) => (c === '\n' || c === '\t' ? ' ' : ''));
  t = t.normalize('NFD').replace(/\p{Mn}/gu, '').normalize('NFC').replace(/\u3002/g, '.').replace(/[\u2010-\u2015\u2212]/g, '-');
  t = neutralizeFigures(t).toLowerCase().replace(LOOKALIKE_RE, (c) => LOOKALIKE[c]);
  return t.replace(/\s+/g, ' ').trim();
}

// Leet forms for matching long word lists only (lib/moderation.ts): applied per token, and only to tokens that hold a
// letter and don't start with $ (so numbers like "12%" and $tickers are never rewritten). Two forms, since 1 reads
// as i or l.
const LEET_BASE: Record<string, string> = { '0': 'o', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's', '!': 'i', '|': 'l' };
export function leet(s: string): [string, string] {
  const form = (one: string) => s.replace(/\S+/g, (tok) =>
    !/\p{L}/u.test(tok) || tok.startsWith('$') ? tok : tok.replace(/[013457@$!|]/g, (c) => (c === '1' ? one : LEET_BASE[c])));
  return [form('i'), form('l')];
}

// Squash: punctuation inside a word goes ("v.e.r-i_fied" → "verified") and runs of single characters separated by
// spaces join ("s t o c k" → "stock"). Whole words are never glued together, so "cover if i edit" stays apart.
// Fix round 5 (item 2): emoji and symbols (\p{Extended_Pictographic}, \p{S}) become a space, so they separate words
// instead of hiding the space ("join🔥my🔥group" → "join my group"); a spaced-out run keeps its dots ("e x a m p l e .
// c o m" → "example.com"); a word loses the dots, dashes, underscores and apostrophes at its ends ("D.M." → "DM") but
// keeps other punctuation there, so a clause break is never squashed away ("didn't join; my plan" stays apart).
const SINGLE = /^\.*[\p{L}\p{N}]?\.*$/u;
const word = (t: string) => t.replace(/(?<=[\p{L}\p{N}])[^\p{L}\p{N}]+(?=[\p{L}\p{N}])/gu, '').replace(/^[.\-_'\u2019]+|[.\-_'\u2019]+$/g, '');
function squashLine(line: string): string {
  const toks = line.replace(/[\p{Extended_Pictographic}\p{S}]/gu, ' ').split(/\s+/).filter(Boolean);
  const out: string[] = [];
  for (let i = 0; i < toks.length;) {
    let j = i;
    while (j < toks.length && SINGLE.test(toks[j])) j++;
    if (j - i >= 2) { out.push(toks.slice(i, j).join('').replace(/^\.+|\.+$/g, '')); i = j; continue; }
    out.push(word(toks[i]));
    i = Math.max(i + 1, j);
  }
  return out.filter(Boolean).join(' ');
}
export function squash(s: string): string {
  return s.split('\n').map(squashLine).join('\n');
}
