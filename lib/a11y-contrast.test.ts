// A11Y-FIXES (approval council fixes #13, #14, 2026-11-01): the contrast floor, computed from app/globals.css as the
// browser would resolve it (the last matching rule wins; light = every :root rule, including the
// `prefers-color-scheme: light` ones; dark = the rest), so the design system council's tokens inherit it.
// - #13 text (WCAG 1.4.3): the Verified and Demo badge text ≥ 4.5:1 on the badge's own background over bg and surface;
//   the `:target` row draws no fill that lowers its text below 4.5:1 (text, muted, up, down on bg and surface).
// - #14 control boundaries (WCAG 1.4.11): inputs, `.secondary` buttons and `summary` controls draw their border with
//   `--control-line`, ≥ 3:1 against bg and surface.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

type Rule = { sels: string[]; body: string; media: string[] };
function parse(text: string, media: string[] = [], out: Rule[] = []): Rule[] {
  let i = 0;
  while (i < text.length) {
    const open = text.indexOf('{', i);
    if (open < 0) break;
    const prelude = text.slice(i, open).trim();
    let depth = 1, j = open + 1;
    while (j < text.length && depth) { if (text[j] === '{') depth++; else if (text[j] === '}') depth--; j++; }
    const inner = text.slice(open + 1, j - 1);
    if (prelude.startsWith('@')) parse(inner, [...media, prelude], out);
    else out.push({ sels: prelude.split(',').map((s) => s.trim().replace(/\s+/g, ' ')), body: inner, media });
    i = j;
  }
  return out;
}
const rules = parse(css);
const light = (r: Rule) => r.media.every((m) => !/prefers-color-scheme:\s*dark/.test(m) && !/max-|min-/.test(m));
const dark = (r: Rule) => r.media.every((m) => !/prefers-color-scheme:\s*light/.test(m) && !/max-|min-/.test(m));
const scheme = { dark, light } as const;
const decls = (body: string) => [...body.matchAll(/([a-z-]+)\s*:\s*([^;]+)/gi)].map((m) => [m[1].trim(), m[2].trim()] as const);
const hex6 = (h: string) => (h.length === 4 ? `#${[...h.slice(1)].map((c) => c + c).join('')}` : h).toLowerCase();
const tokensFor = (on: (r: Rule) => boolean) => {
  const t: Record<string, string> = {};
  for (const r of rules) if (r.sels.includes(':root') && on(r)) for (const [k, v] of decls(r.body)) if (k.startsWith('--') && /^#[0-9a-f]{3,6}\b/i.test(v)) t[k.slice(2)] = hex6(v.match(/^#[0-9a-f]{3,6}/i)![0]);
  return t;
};
// The value the cascade ends on for `prop` (or any of `props`) on exactly `sel`, among rules outside size media queries.
const last = (sel: string, props: string[], on: (r: Rule) => boolean = dark) => {
  let v: { prop: string; value: string } | undefined;
  for (const r of rules) if (r.sels.includes(sel) && on(r)) for (const [k, val] of decls(r.body)) if (props.includes(k)) v = { prop: k, value: val };
  return v;
};

const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const lum = (hex: string) => {
  const c = rgb(hex).map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const contrast = (a: string, b: string) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
// A background as painted over `base`: none/transparent, a token, or `color-mix(in srgb, var(--x) N%, transparent)`.
const paint = (value: string | undefined, t: Record<string, string>, base: string) => {
  if (!value || /^(none|transparent)$/.test(value)) return base;
  const mix = value.match(/color-mix\(in srgb,\s*var\(--([a-z-]+)\)\s*([\d.]+)%,\s*transparent\)/);
  if (mix) { const p = Number(mix[2]) / 100, a = rgb(t[mix[1]]), b = rgb(base); return `#${a.map((v, i) => Math.round(v * p + b[i] * (1 - p)).toString(16).padStart(2, '0')).join('')}`; }
  const tok = value.match(/^var\(--([a-z-]+)\)$/);
  assert.ok(tok, `unrecognised background "${value}"`);
  return t[tok![1]];
};
const tokenOf = (value: string | undefined) => value?.match(/var\(--([a-z-]+)\)/)?.[1];

for (const [name, on] of Object.entries(scheme)) {
  const t = tokensFor(on);
  test(`#13 badge text is at least 4.5:1 on the badge's background over bg and surface (${name})`, () => {
    for (const sel of ['.badge.verified', '.badge.demo']) {
      const fg = tokenOf(last(sel, ['color'], on)?.value);
      assert.ok(fg && t[fg], `${sel} sets its color from a token`);
      for (const base of ['bg', 'surface']) {
        const bg = paint(last(sel, ['background', 'background-color'], on)?.value, t, t[base]);
        const r = contrast(t[fg!], bg);
        assert.ok(r >= 4.5, `${name} ${sel}: ${t[fg!]} on ${bg} (over ${base}) is ${r.toFixed(2)}:1`);
      }
    }
  });
  test(`#13 a :target row keeps its text at least 4.5:1 (text, muted, up, down on bg and surface) (${name})`, () => {
    const fill = last('.rows li:target', ['background', 'background-color'], on)?.value;
    for (const base of ['bg', 'surface']) {
      const bg = paint(fill, t, t[base]);
      for (const k of ['text', 'muted', 'up', 'down']) {
        const r = contrast(t[k], bg);
        assert.ok(r >= 4.5, `${name} --${k} on the :target row over ${base} (${bg}) is ${r.toFixed(2)}:1`);
      }
      // The mark that replaces the fill is a non-text indicator: at least 3:1.
      const bar = tokenOf(last('.rows li:target', ['box-shadow'], on)?.value);
      if (bar) assert.ok(contrast(t[bar], t[base]) >= 3, `${name} :target bar --${bar} on ${base}`);
    }
  });
  test(`#14 --control-line is at least 3:1 against bg and surface (${name})`, () => {
    assert.ok(t['control-line'], '--control-line is defined');
    for (const base of ['bg', 'surface']) {
      const r = contrast(t['control-line'], t[base]);
      assert.ok(r >= 3, `${name} --control-line ${t['control-line']} on --${base} ${t[base]} is ${r.toFixed(2)}:1`);
    }
  });
}

// Every selector that draws a control's border today ends its cascade on --control-line.
const CONTROLS = ['input', 'textarea', 'select', '.pane .back', '.share-prompt .actions .secondary', '.trade-share .secondary',
  '.badge-embed .secondary', '.new-trades .secondary', '.rec-chips button', '.auth .button.secondary', '.auth button.secondary',
  '.handle-edit summary.secondary', '.follow.secondary', '.more-menu .secondary', '.people .secondary',
  '.pane-actions .button.secondary', '.more-menu summary'];
test('#14 inputs, .secondary buttons and summary controls draw their border with --control-line', () => {
  for (const sel of CONTROLS) {
    const v = last(sel, ['border', 'border-color']);
    assert.ok(v, `${sel} has a border rule`);
    assert.match(v!.value, /var\(--control-line\)/, `${sel} ends on "${v!.prop}: ${v!.value}"`);
  }
});
