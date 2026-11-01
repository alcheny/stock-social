// A cascade-aware walk over app/globals.css (F-20: moved verbatim from lib/fixes-cycle2-a11y.test.ts, where #55's
// lib/a11y-contrast.test.ts had a copy, so both contrast tests resolve tokens the same way). The browser's rules, as the
// tests use them: size media queries are skipped, the last matching rule wins, `var()` aliases resolve after the cascade;
// light = every :root rule (including `prefers-color-scheme: light`), dark = the rest.
// ponytail: a lexer for this repo's CSS, not a CSS parser (no @layer, no specificity: `last` reads exact selector strings
// in source order) — swap in a real parser if the repo ever gains one.
export type Rule = { sels: string[]; body: string; media: string[] };
// Selector lists split on top-level commas only (`body:has(a, b) .x` is one selector).
export function splitSel(prelude: string): string[] {
  const out: string[] = [];
  let depth = 0, cur = '';
  for (const ch of prelude) {
    if (ch === '(') depth++; else if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { out.push(cur); cur = ''; } else cur += ch;
  }
  return [...out, cur].map((s) => s.trim().replace(/\s+/g, ' '));
}
export function parse(text: string, media: string[] = [], out: Rule[] = []): Rule[] {
  let i = 0;
  while (i < text.length) {
    const open = text.indexOf('{', i);
    if (open < 0) break;
    const prelude = text.slice(i, open).trim();
    let depth = 1, j = open + 1;
    while (j < text.length && depth) { if (text[j] === '{') depth++; else if (text[j] === '}') depth--; j++; }
    const inner = text.slice(open + 1, j - 1);
    if (prelude.startsWith('@')) parse(inner, [...media, prelude], out);
    else out.push({ sels: splitSel(prelude), body: inner, media });
    i = j;
  }
  return out;
}
export const stripComments = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '');
export const size = (m: string) => /max-|min-/.test(m);
export const light = (r: Rule) => r.media.every((m) => !/prefers-color-scheme:\s*dark/.test(m) && !size(m));
export const dark = (r: Rule) => r.media.every((m) => !/prefers-color-scheme:\s*light/.test(m) && !size(m));
export const SCHEMES = { light, dark } as const;
export const decls = (body: string) => [...body.matchAll(/([a-z-]+)\s*:\s*([^;]+)/gi)].map((m) => [m[1].trim(), m[2].trim()] as const);
export const hex6 = (h: string) => (h.length === 4 ? `#${[...h.slice(1)].map((c) => c + c).join('')}` : h).toLowerCase();
// Hex tokens, and tokens that name another (`--verified: var(--text)`), resolved after the cascade.
export function tokensFor(rules: Rule[], on: (r: Rule) => boolean): Record<string, string> {
  const rawT: Record<string, string> = {};
  for (const r of rules) if (r.sels.includes(':root') && on(r)) for (const [k, v] of decls(r.body)) if (k.startsWith('--')) rawT[k.slice(2)] = v;
  const resolve = (k: string, seen = 0): string | undefined => {
    const v = rawT[k];
    if (!v || seen > 8) return undefined;
    const hex = v.match(/^#[0-9a-f]{3,6}\b/i), ref = v.match(/^var\(--([a-z0-9-]+)\)$/i);
    return hex ? hex6(hex[0]) : ref ? resolve(ref[1], seen + 1) : undefined;
  };
  const t: Record<string, string> = {};
  for (const k of Object.keys(rawT)) { const v = resolve(k); if (v) t[k] = v; }
  return t;
}
// The value the cascade ends on for any of `props` on exactly `sel`, among rules outside size media queries.
export function last(rules: Rule[], sel: string, props: string[], on: (r: Rule) => boolean = dark) {
  let v: { prop: string; value: string } | undefined;
  for (const r of rules) if (r.sels.includes(sel) && on(r)) for (const [k, val] of decls(r.body)) if (props.includes(k)) v = { prop: k, value: val };
  return v;
}
export const tokenOf = (value: string | undefined) => value?.match(/var\(--([a-z-]+)\)/)?.[1];
// The text between a block's opening and closing marker comments (both included), or '' when either is missing.
export function block(text: string, start: string, end: string): string {
  const s = text.indexOf(start), e = text.indexOf(end, s < 0 ? 0 : s);
  return s < 0 || e < 0 ? '' : text.slice(s, e + end.length);
}
