// FIXES-CYCLE2-A11Y (approval council cycle 2 fixes #12, #13, #14, #18, #26; docs/features/logs/fixes-cycle2-a11y/):
// the colour and rule floor, computed from app/globals.css as the browser resolves it. The cascade walk follows
// F-13's lib/a11y-contrast.test.ts: size media queries are skipped, the last matching rule wins, `var()` aliases resolve
// after the cascade; light = every :root rule (including `prefers-color-scheme: light`), dark = the rest.
// - #26 (WCAG 1.4.1, POLICY A1): gain/loss tokens are the design system's DS-4 values, readable as text (≥ 4.5:1) on bg
//   and surface, and apart under colour-vision deficiency (min ΔE00 ≥ 9 over protan, deutan and tritan), measured with a
//   TypeScript port of docs/direction/design-system-2026-11-01-scripts/a11ylib.py checked against the spec's numbers.
// - #12 (WCAG 1.4.11): --focus ≥ 3:1 on bg and surface; the pane's current-row outline ends on --focus.
// - #13 (WCAG 1.4.11): --control ≥ 3:1; every control border selector ends on --control; the three bars too.
// - #14, #18: the block's bar-room and nav rules exist where the committee put them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const raw = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
const css = raw.replace(/\/\*[\s\S]*?\*\//g, '');

// ---- cascade-aware rule walk ----
type Rule = { sels: string[]; body: string; media: string[] };
// Selector lists split on top-level commas only (`body:has(a, b) .x` is one selector).
function splitSel(prelude: string): string[] {
  const out: string[] = [];
  let depth = 0, cur = '';
  for (const ch of prelude) {
    if (ch === '(') depth++; else if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { out.push(cur); cur = ''; } else cur += ch;
  }
  return [...out, cur].map((s) => s.trim().replace(/\s+/g, ' '));
}
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
    else out.push({ sels: splitSel(prelude), body: inner, media });
    i = j;
  }
  return out;
}
const rules = parse(css);
const size = (m: string) => /max-|min-/.test(m);
const light = (r: Rule) => r.media.every((m) => !/prefers-color-scheme:\s*dark/.test(m) && !size(m));
const dark = (r: Rule) => r.media.every((m) => !/prefers-color-scheme:\s*light/.test(m) && !size(m));
const SCHEMES = { light, dark } as const;
const decls = (body: string) => [...body.matchAll(/([a-z-]+)\s*:\s*([^;]+)/gi)].map((m) => [m[1].trim(), m[2].trim()] as const);
const hex6 = (h: string) => (h.length === 4 ? `#${[...h.slice(1)].map((c) => c + c).join('')}` : h).toLowerCase();
function tokensFor(on: (r: Rule) => boolean): Record<string, string> {
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
function last(sel: string, props: string[], on: (r: Rule) => boolean = dark) {
  let v: { prop: string; value: string } | undefined;
  for (const r of rules) if (r.sels.includes(sel) && on(r)) for (const [k, val] of decls(r.body)) if (props.includes(k)) v = { prop: k, value: val };
  return v;
}
const tokenOf = (value: string | undefined) => value?.match(/var\(--([a-z-]+)\)/)?.[1];

// ---- colour maths: a port of a11ylib.py (WCAG 2.x; 2009 dichromat matrices on linear sRGB, quantised; CIEDE2000) ----
type RGB = [number, number, number];
const hx = (h: string): RGB => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as RGB;
const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const unlin = (c: number) => { c = Math.min(1, Math.max(0, c)); return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055; };
const lumRGB = (v: RGB) => { const [r, g, b] = v.map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const contrast = (a: string, b: string) => { const x = lumRGB(hx(a)), y = lumRGB(hx(b)); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
// CSS color-mix(in srgb, fg p, bg) over an opaque bg (sRGB-encoded mix, as browsers do).
const mix = (fg: string, bg: string, p: number) => { const f = hx(fg), b = hx(bg); return `#${f.map((x, i) => Math.round((p * x + (1 - p) * b[i]) * 255).toString(16).padStart(2, '0')).join('')}`; };
const M = {
  protan: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deutan: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]],
  tritan: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.303900]],
} as const;
type Kind = keyof typeof M;
const KINDS = Object.keys(M) as Kind[];
const QUANTISE = true; // as a11ylib.py: the spec's numbers round the simulated colour to 8-bit sRGB
function sim(h: string, kind: Kind): RGB {
  const v = hx(h).map(lin);
  const o = M[kind].map((row) => unlin(row[0] * v[0] + row[1] * v[1] + row[2] * v[2]));
  return (QUANTISE ? o.map((c) => Math.round(c * 255) / 255) : o) as RGB;
}
function lab(v: RGB): RGB {
  const [r, g, b] = v.map(lin);
  const X = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047;
  const Y = 0.2126729 * r + 0.7151522 * g + 0.0721750 * b;
  const Z = (0.0193339 * r + 0.1191920 * g + 0.9503041 * b) / 1.08883;
  const f = (t: number) => (t > (6 / 29) ** 3 ? Math.cbrt(t) : t / (3 * (6 / 29) ** 2) + 4 / 29);
  const fx = f(X), fy = f(Y), fz = f(Z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
const rad = (d: number) => (d * Math.PI) / 180, deg = (r: number) => (r * 180) / Math.PI;
function de00Lab([L1, a1, b1]: RGB, [L2, a2, b2]: RGB): number {
  const C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2), Cb = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)));
  const a1p = (1 + G) * a1, a2p = (1 + G) * a2;
  const C1p = Math.hypot(a1p, b1), C2p = Math.hypot(a2p, b2);
  const h1p = ((deg(Math.atan2(b1, a1p)) % 360) + 360) % 360, h2p = ((deg(Math.atan2(b2, a2p)) % 360) + 360) % 360;
  const dLp = L2 - L1, dCp = C2p - C1p;
  let dhp: number;
  if (C1p * C2p === 0) dhp = 0;
  else if (Math.abs(h2p - h1p) <= 180) dhp = h2p - h1p;
  else if (h2p - h1p > 180) dhp = h2p - h1p - 360;
  else dhp = h2p - h1p + 360;
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(rad(dhp / 2));
  const Lbp = (L1 + L2) / 2, Cbp = (C1p + C2p) / 2;
  let hbp: number;
  if (C1p * C2p === 0) hbp = h1p + h2p;
  else if (Math.abs(h1p - h2p) <= 180) hbp = (h1p + h2p) / 2;
  else if (h1p + h2p < 360) hbp = (h1p + h2p + 360) / 2;
  else hbp = (h1p + h2p - 360) / 2;
  const T = 1 - 0.17 * Math.cos(rad(hbp - 30)) + 0.24 * Math.cos(rad(2 * hbp)) + 0.32 * Math.cos(rad(3 * hbp + 6)) - 0.20 * Math.cos(rad(4 * hbp - 63));
  const dth = 30 * Math.exp(-(((hbp - 275) / 25) ** 2));
  const Rc = 2 * Math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7));
  const Sl = 1 + (0.015 * (Lbp - 50) ** 2) / Math.sqrt(20 + (Lbp - 50) ** 2), Sc = 1 + 0.045 * Cbp, Sh = 1 + 0.015 * Cbp * T;
  const Rt = -Math.sin(rad(2 * dth)) * Rc;
  return Math.sqrt((dLp / Sl) ** 2 + (dCp / Sc) ** 2 + (dHp / Sh) ** 2 + Rt * (dCp / Sc) * (dHp / Sh));
}
const cvd = (a: string, b: string) => Object.fromEntries(KINDS.map((k) => [k, de00Lab(lab(sim(a, k)), lab(sim(b, k)))])) as Record<Kind, number>;
const cvdMin = (a: string, b: string) => Math.min(...Object.values(cvd(a, b)));

test('colour maths port: a11ylib.py self-checks (21:1, CIEDE2000 published test pairs 1 and 7)', () => {
  assert.ok(Math.abs(contrast('#ffffff', '#000000') - 21) < 1e-9);
  assert.ok(Math.abs(de00Lab([50, 2.6772, -79.7751], [50, 0, -82.7485]) - 2.0425) < 1e-4);
  assert.ok(Math.abs(de00Lab([50, 0, 0], [50, -1, 2]) - 2.3669) < 1e-4);
});

test('colour maths port: fidelity to the spec (tokens.py): old gain/loss deutan 2.8 light, 6.3 dark; new minimum 27.8 light, 20.1 dark (±0.2)', () => {
  const near = (v: number, want: number, what: string) => assert.ok(Math.abs(v - want) <= 0.2, `${what}: ${v.toFixed(2)}, spec ${want}`);
  near(cvd('#15803d', '#be123c').deutan, 2.8, 'old light deutan');
  near(cvd('#22c55e', '#f43f5e').deutan, 6.3, 'old dark deutan');
  near(cvdMin('#0b6b70', '#b2441b'), 27.8, 'new light min');
  near(cvdMin('#3cc4b4', '#ff8a5b'), 20.1, 'new dark min');
  // Every kind as tokens.py prints it (quantised): light protan 27.8, deutan 36.1, tritan 55.1; dark 20.1, 30.1, 62.4.
  const l = cvd('#0b6b70', '#b2441b'), d = cvd('#3cc4b4', '#ff8a5b');
  for (const [v, want, what] of [[l.protan, 27.8, 'light protan'], [l.deutan, 36.1, 'light deutan'], [l.tritan, 55.1, 'light tritan'],
    [d.protan, 20.1, 'dark protan'], [d.deutan, 30.1, 'dark deutan'], [d.tritan, 62.4, 'dark tritan']] as const) near(v, want, what);
});

// ---- #26 ----
const WANT = {
  light: { up: '#0b6b70', down: '#b2441b', bg: '#fafafa', surface: '#ffffff', text: '#111118', muted: '#6b6b78', line: '#e5e5ea', accent: '#6d28d9', 'on-accent': '#ffffff' },
  dark: { up: '#3cc4b4', down: '#ff8a5b', bg: '#0b0b0f', surface: '#16161d', text: '#f4f4f6', muted: '#8b8b98', line: '#262631', accent: '#a78bfa', 'on-accent': '#0b0b0f' },
} as const;
// [up on bg, up on surface, down on bg, down on surface], to 2 decimals (plan AC26.2; tokens.py).
const TEXT = { light: ['6.00', '6.27', '5.39', '5.62'], dark: ['9.12', '8.36', '8.46', '7.75'] } as const;
const FOCUS = { light: ['6.15', '6.42'], dark: ['8.47', '7.76'] } as const;
const CONTROL = { light: ['3.75', '3.91'], dark: ['4.29', '3.93'] } as const;

for (const [name, on] of Object.entries(SCHEMES) as [keyof typeof SCHEMES, (r: Rule) => boolean][]) {
  const t = tokensFor(on);
  test(`AC26.1 gain/loss tokens are the DS-4 values and the base tokens are unchanged (${name})`, () => {
    for (const [k, v] of Object.entries(WANT[name])) assert.equal(t[k], v, `${name} --${k}`);
  });
  test(`AC26.2 gain and loss read as text (≥ 4.5:1) on bg and surface, and --bg on the chart's --c fill (${name})`, () => {
    const got = [contrast(t.up, t.bg), contrast(t.up, t.surface), contrast(t.down, t.bg), contrast(t.down, t.surface)];
    for (const r of got) assert.ok(r >= 4.5, `${name}: ${r.toFixed(2)}:1`);
    assert.deepEqual(got.map((r) => r.toFixed(2)), [...TEXT[name]]);
    // The pressed chart tab draws --bg text on --c (--up, or --down on a loss chart): the same pairs as on bg.
    assert.equal(last('.tabs button[aria-pressed="true"]', ['color'], on)?.value, 'var(--bg)');
    assert.equal(last('.tabs button[aria-pressed="true"]', ['background'], on)?.value, 'var(--c)');
    assert.equal(last('.chart', ['--c'], on)?.value, 'var(--up)');
    assert.equal(last('.chart.loss', ['--c'], on)?.value, 'var(--down)');
  });
  test(`AC26.2 the Verified badge text is ≥ 4.5:1 on its own tint over bg and surface (${name})`, () => {
    const fg = tokenOf(last('.badge.verified', ['color'], on)?.value);
    assert.ok(fg && t[fg], '.badge.verified sets its color from a token');
    const fill = last('.badge.verified', ['background', 'background-color'], on)?.value ?? '';
    const m = fill.match(/color-mix\(in srgb,\s*var\(--([a-z-]+)\)\s*([\d.]+)%,\s*transparent\)/);
    assert.ok(m, `the Verified tint is a color-mix of a token: "${fill}"`);
    for (const base of ['bg', 'surface']) {
      const tint = mix(t[m![1]], t[base], Number(m![2]) / 100);
      const r = contrast(t[fg!], tint);
      assert.ok(r >= 4.5, `${name} Verified --${fg} on ${tint} (over ${base}) is ${r.toFixed(2)}:1`);
    }
    // If the badge text ever goes back to --up, it still has to clear the floor on its tint (light 4.60/4.77).
    for (const base of ['bg', 'surface']) {
      const r = contrast(t.up, mix(t.up, t[base], 0.18));
      assert.ok(r >= 4.5, `${name} --up on its 18% tint over ${base} is ${r.toFixed(2)}:1`);
    }
  });
  test(`AC26.3 gain vs loss stays apart under colour-vision deficiency: min ΔE00 ≥ 9 (${name})`, () => {
    const v = cvd(t.up, t.down), min = Math.min(...Object.values(v));
    assert.ok(min >= 9, `${name}: ${JSON.stringify(v)}`);
    assert.equal(min.toFixed(1), name === 'light' ? '27.8' : '20.1');
  });
  test(`AC12.1 --focus is ≥ 3:1 on bg and surface (${name})`, () => {
    assert.ok(t.focus, '--focus is defined');
    const got = [contrast(t.focus, t.bg), contrast(t.focus, t.surface)];
    for (const r of got) assert.ok(r >= 3, `${name} --focus ${r.toFixed(2)}:1`);
    assert.deepEqual(got.map((r) => r.toFixed(2)), [...FOCUS[name]]);
  });
  test(`#13 --control is ≥ 3:1 on bg and surface (${name})`, () => {
    assert.ok(t.control, '--control is defined');
    const got = [contrast(t.control, t.bg), contrast(t.control, t.surface)];
    for (const r of got) assert.ok(r >= 3, `${name} --control ${r.toFixed(2)}:1`);
    assert.deepEqual(got.map((r) => r.toFixed(2)), [...CONTROL[name]]);
  });
  test(`AC12.1 the pane's current row is outlined in --focus, 2 px at a 2 px offset, weight 600 (${name})`, () => {
    const sel = '.pane .rows .line.hl';
    const o = last(sel, ['outline', 'outline-color'], on);
    assert.ok(o, `${sel} draws an outline`);
    assert.equal(tokenOf(o!.value), 'focus', `${sel} ends on "${o!.prop}: ${o!.value}"`);
    assert.match(last(sel, ['outline'], on)!.value, /^2px solid\b/);
    assert.equal(last(sel, ['outline-offset'], on)?.value, '2px');
    assert.equal(last(sel, ['font-weight'], on)?.value, '600');
  });
}

// ---- #13 control boundaries (unconditional; the F-13 twin list) ----
const CONTROLS = ['input', 'textarea', 'select', '.pane .back', '.share-prompt .actions .secondary', '.trade-share .secondary',
  '.badge-embed .secondary', '.new-trades .secondary', '.rec-chips button', '.auth .button.secondary', '.auth button.secondary',
  '.handle-edit summary.secondary', '.follow.secondary', '.more-menu .secondary', '.people .secondary',
  '.pane-actions .button.secondary', '.more-menu summary', '.switch-pair .switch', '.personalize form > button.secondary',
  '.rt .button.choice', '.rt button.choice', '.rt .button.secondary', '.rt button.secondary', '.rt-form input', '.rt-form select',
  '.rt-note textarea'];
for (const [name, on] of Object.entries(SCHEMES)) {
  test(`#13 every control border selector ends its cascade on --control (${name})`, () => {
    for (const sel of CONTROLS) {
      const v = last(sel, ['border', 'border-color'], on);
      assert.ok(v, `${sel} has a border rule`);
      assert.match(v!.value, /var\(--control\)/, `${sel} ends on "${v!.prop}: ${v!.value}"`);
    }
  });
  test(`#13 (Q4) the three fixed bars draw their edge in --control (${name})`, () => {
    for (const sel of ['.signin-line:not(:empty)', '.hide-bar p', '.nojs-done']) {
      const v = last(sel, ['border', 'border-color'], on);
      assert.ok(v, `${sel} has a border rule`);
      assert.match(v!.value, /var\(--control\)/, `${sel} ends on "${v!.prop}: ${v!.value}"`);
    }
  });
}

// ---- block placement and the #14 / #18 rules ----
const START = '/* FIXES-CYCLE2-A11Y (approval council cycle 2 fixes #12 #13 #14 #18 #26, 2026-11-01) */';
const END = '/* end FIXES-CYCLE2-A11Y */';
const ANCHOR = '.rt-card:focus { outline: 2px solid var(--accent); outline-offset: 2px; }';
test('the FIXES-CYCLE2-A11Y block exists once, right after .rt-card:focus (not at the end of the file), and names its F-13 twin', () => {
  assert.equal(raw.split(START).length, 2, 'one opening marker');
  assert.equal(raw.split(END).length, 2, 'one closing marker');
  const s = raw.indexOf(START), e = raw.indexOf(END);
  assert.ok(s < e, 'opening before closing');
  assert.ok(raw.indexOf(`${ANCHOR}\n${START}`) >= 0, 'the block starts on the line after .rt-card:focus');
  assert.ok(raw.slice(e + END.length).trim().length > 0, 'the block is not at the end of the file (F-13 appends there)');
  assert.match(raw.slice(s, e), /F-13/, 'the block names F-13 as its twin');
});

const block = parse(raw.slice(raw.indexOf(START), raw.indexOf(END)).replace(/\/\*[\s\S]*?\*\//g, ''));
const BAR = ':has(.signin-line:not(:empty), .hide-bar > p, .nojs-done)';
test('#14 while a bar shows, the feed rows reserve its room (94 px; 90 px at ≤ 480 px tall) and the scrollers (page, pane; the card when it scrolls) pad their bottom; nothing on .feed', () => {
  const find = (sel: string, prop: string, media: (m: string[]) => boolean) =>
    block.filter((r) => r.sels.includes(sel) && media(r.media)).flatMap((r) => decls(r.body)).filter(([k]) => k === prop).map(([, v]) => v);
  const none = (m: string[]) => m.length === 0;
  const short = (m: string[]) => m.length === 1 && /max-height:\s*480px/.test(m[0]);
  assert.deepEqual(find(`body${BAR} .feed .row > *`, 'padding-bottom', none), ['94px']);
  assert.deepEqual(find(`body${BAR} .feed .row > *`, 'padding-bottom', short), ['90px']);
  assert.deepEqual(find(`html${BAR}`, 'scroll-padding-bottom', none), ['94px']);
  assert.deepEqual(find(`body${BAR} .feed > .row > .pane`, 'scroll-padding-bottom', none), ['94px']);
  assert.deepEqual(find(`body${BAR} .feed > .row > .card`, 'scroll-padding-bottom', short), ['90px']);
  // Padding on the snap container itself would move every snap point (F-13 note).
  for (const r of block) for (const s of r.sels) assert.doesNotMatch(s, /\.feed$/, `no rule on .feed itself: ${s}`);
  // The :empty test relies on the sign-in line rendering no whitespace while closed (app/feed-gestures.tsx).
  const src = readFileSync(new URL('../app/feed-gestures.tsx', import.meta.url), 'utf8');
  assert.match(src, /<p className="signin-line" role="status">\n\s*\{askSignIn && /, 'the <p> holds only the conditional');
  assert.match(raw.slice(raw.indexOf(START), raw.indexOf(END)), /:not\(:empty\)` relies on React emitting no whitespace/);
});

test('#18 under 420 px the handle link is capped at 18vw and the nav pads 10 px top and bottom', () => {
  const narrow = block.filter((r) => r.media.length === 1 && /max-width:\s*420px/.test(r.media[0]));
  const val = (sel: string, prop: string) => narrow.filter((r) => r.sels.includes(sel)).flatMap((r) => decls(r.body)).filter(([k]) => k === prop).map(([, v]) => v).at(-1);
  assert.equal(val('nav.top .me', 'max-width'), '18vw');
  assert.equal(val('body > nav.top', 'padding-block'), '10px');
  // The twin reflow lines (F-13): long names wrap and the badge never shrinks.
  const plain = (sel: string, prop: string) => last(sel, [prop], () => true)?.value;
  assert.equal(plain('h1', 'overflow-wrap'), 'anywhere');
  assert.equal(plain('.card header .who', 'min-width'), '0');
  assert.equal(plain('.card header .badge', 'flex-shrink'), '0');
});
