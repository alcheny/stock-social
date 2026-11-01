// User-text safety (fix committee 2026-11-01, decision 1): clean on save, match on a skeleton.
// sanitizeUserText is what gets STORED (theses, display names): it removes the characters that can reverse, hide or
// spoof text, so every surface (pages, <title>, share images that can't use <bdi>) is protected. skeleton is for
// MATCHING only (lib/moderation.ts, lib/handles.ts): it is never stored or shown. No confusables library (POLICY H):
// the look-alike map below is hand-written and deliberately small.

// Direction controls: embeddings/overrides (U+202A–202E), isolates (U+2066–2069), LRM/RLM, Arabic letter mark.
export const DIRECTION_CHARS = '\u202A-\u202E\u2066-\u2069\u200E\u200F\u061C';
// Zero-width and invisible format characters. U+200D (zero-width joiner) is deliberately NOT here: it can't reverse
// text and emoji sequences need it.
export const INVISIBLE_CHARS = '\u200B\u200C\u2060-\u2064\uFEFF\u00AD\u180E';
// C0/C1 controls except \n (tab is turned into a space first).
const CONTROL_CHARS = '\u0000-\u0009\u000B-\u001F\u007F-\u009F';
// Fix round 1: every Default_Ignorable_Code_Point (Hangul fillers U+3164/U+FFA0/U+115F/U+1160, the grapheme joiner
// U+034F, Khmer U+17B4/5, tags U+E0000–E007F, U+206A–206F, Mongolian selectors ...) is invisible and goes too, except
// the ones emoji and CJK names need: the zero-width joiner U+200D and the variation selectors U+FE00–FE0F and
// U+E0100–E01EF (the skeleton removes those as well, so they never hide a word from the rules). The braille blank
// U+2800 is not default-ignorable but renders as nothing, so it goes too.
const KEEP_RE = /[\u200D\uFE00-\uFE0F\u{E0100}-\u{E01EF}]/u;
const IGNORABLE_RE = /[\p{Default_Ignorable_Code_Point}\u2800]/gu;
const STRIP_RE = new RegExp(`[${DIRECTION_CHARS}${INVISIBLE_CHARS}${CONTROL_CHARS}]`, 'gu');
const stripInvisible = (s: string) => s.replace(STRIP_RE, '').replace(IGNORABLE_RE, (c) => (KEEP_RE.test(c) ? c : ''));
/** True when sanitizeUserText removes this one character (tab and \n aside: those become a space and stay). */
export const isStripped = (c: string): boolean => c !== '\t' && c !== '\n' && stripInvisible(c) === '';
// The same set as a Postgres regular-expression bracket (db/schema.sql's stored-text cleanup; NUL can't be stored).
// lib/text-safety.test.ts proves it equals isStripped over every code point, and that the schema uses it verbatim.
export const STRIP_CLASS_SQL = String.raw`[\u00AD\u034F\u061C\u115F\u1160\u17B4\u17B5\u180B-\u180F\u200B\u200C\u200E\u200F\u202A-\u202E\u2060-\u206F\u2800\u3164\uFEFF\uFFA0\uFFF0-\uFFF8\U0001BCA0-\U0001BCA3\U0001D173-\U0001D17A\U000E0000-\U000E00FF\U000E01F0-\U000E0FFF\x01-\x08\x0B-\x1F\x7F-\x9F]`;

// Decimal-digit blocks whose zero sits at a known code point, so digit = cp - zero.
const DIGIT_ZEROS = [
  0xff10, // fullwidth
  0x0660, // Arabic-Indic
  0x06f0, // extended Arabic-Indic
  0x1d7ce, 0x1d7d8, 0x1d7e2, 0x1d7ec, 0x1d7f6, // mathematical bold, double-struck, sans-serif, sans bold, monospace
];
const PERCENTS = new Set([0x066a, 0xfe6a, 0xff05]); // Arabic percent, small percent, fullwidth percent

// Look-alike digits and percent signs become plain ASCII, so a spoofed figure turns into a plain one the rules see.
export function neutralizeFigures(s: string): string {
  let out = '';
  for (const ch of s) {
    const cp = ch.codePointAt(0)!;
    if (PERCENTS.has(cp)) { out += '%'; continue; }
    const zero = DIGIT_ZEROS.find((z) => cp >= z && cp <= z + 9);
    out += zero === undefined ? ch : String(cp - zero);
  }
  return out;
}

// Cut at `max` code points (never splits a surrogate pair).
export const cutCodePoints = (s: string, max: number): string => {
  const cps = Array.from(s);
  return cps.length <= max ? s : cps.slice(0, max).join('');
};

export function sanitizeUserText(s: string, max = 280): string {
  let t = String(s ?? '').toWellFormed().replace(/\t/g, ' ').replace(/\r\n?/g, '\n');
  t = stripInvisible(t);
  t = neutralizeFigures(t).normalize('NFC');
  t = t.replace(/[^\S\n]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  return cutCodePoints(t, max).trim();
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
export function skeleton(s: string): string {
  let t = String(s ?? '').toWellFormed().normalize('NFKC')
    .replace(/[\p{Cf}\p{Cc}\p{Default_Ignorable_Code_Point}\u2800]/gu, (c) => (c === '\n' || c === '\t' ? ' ' : ''));
  t = t.normalize('NFD').replace(/\p{Mn}/gu, '').normalize('NFC').replace(/\u3002/g, '.');
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
export function squash(s: string): string {
  let t = s.replace(/[^\p{L}\p{N}\s]/gu, '');
  t = t.replace(/(?<![\p{L}\p{N}])([\p{L}\p{N}])\s+(?=[\p{L}\p{N}](?![\p{L}\p{N}]))/gu, '$1');
  return t;
}
