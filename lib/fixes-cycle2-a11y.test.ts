// FIXES-CYCLE2-A11Y (approval council cycle 2 fixes #12, #13, #14, #26 and the range-button target size;
// docs/features/logs/fixes-cycle2-a11y/): the colour and rule floor this fix set owns, computed from app/globals.css as
// the browser resolves it. The cascade walk follows lib/a11y-contrast.test.ts (#55): size media queries are skipped, the
// last matching rule wins, `var()` aliases resolve after the cascade; light = every :root rule (including
// `prefers-color-scheme: light`), dark = the rest. What #55 owns and lib/a11y-contrast.test.ts already asserts (--control
// ≥ 3:1, its control-border list, the badge text, the :target row; #18's nav and reflow) is not repeated here.
// - #26 (WCAG 1.4.1, POLICY A1): gain/loss tokens are the design system's DS-4 values, readable as text (≥ 4.5:1) on bg
//   and surface, and apart under colour-vision deficiency (min ΔE00 ≥ 9 over protan, deutan and tritan), measured with a
//   TypeScript port of docs/direction/design-system-2026-11-01-scripts/a11ylib.py checked against the spec's numbers.
// - #12 (WCAG 1.4.11): --focus ≥ 3:1 on bg and surface; the pane's current-row outline ends on --focus.
// - #13 (WCAG 1.4.11): no later rule (including #55's block, which now sits after ours) draws a control border back in
//   --line; the three fixed bars draw their edge in --control.
// - #14 (WCAG 2.4.11): the bar-room rules; target size: the chart's range buttons are ≥ 44 × 44 px.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dark, decls, last as lastRule, parse, SCHEMES, tokenOf, tokensFor as tokensForRules, type Rule } from './css-cascade.ts';
import { contrast, cvd, cvdMin, de00Lab, mix } from './colour-math.ts';

const raw = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
const css = raw.replace(/\/\*[\s\S]*?\*\//g, '');

// ---- cascade-aware rule walk (lib/css-cascade.ts) and colour maths (lib/colour-math.ts), shared with #55's test (F-20) ----
const rules = parse(css);
const tokensFor = (on: (r: Rule) => boolean) => tokensForRules(rules, on);
const last = (sel: string, props: string[], on: (r: Rule) => boolean = dark) => lastRule(rules, sel, props, on);

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
  test(`AC26.2 the new --up stays ≥ 4.5:1 on its own 18% tint over bg and surface (the Verified tint; light 4.60/4.77) (${name})`, () => {
    // The badge's text colour itself is #55's (lib/a11y-contrast.test.ts); this guards the retuned --up should the badge
    // text ever go back to it.
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

// ---- #13 ----
// The control-border list and --control's floor are #55's (lib/a11y-contrast.test.ts).
for (const [name, on] of Object.entries(SCHEMES)) {
  // `last()` reads exact selector strings in source order, not specificity: guard that no rule after our block (#55's
  // A11Y-FIXES block included) draws a control's border back in --line on any selector (a more specific one would win).
  test(`#13 no rule after the block draws a control border in --line (${name})`, () => {
    const after = parse(raw.slice(raw.indexOf(END)).replace(/\/\*[\s\S]*?\*\//g, ''));
    const control = /(input|textarea|select|button|summary|\.secondary|\.switch|\.back|\.choice)[^\s>+~]*$/;
    for (const r of after) if (on(r)) for (const sel of r.sels) if (control.test(sel))
      for (const [k, v] of decls(r.body)) if (/^border(-color)?$/.test(k)) assert.doesNotMatch(v, /var\(--line\)/, `${sel} sets ${k}: ${v}`);
  });
  test(`#13 (Q4) the three fixed bars draw their edge in --control (${name})`, () => {
    for (const sel of ['.signin-line:not(:empty)', '.hide-bar p', '.nojs-done']) {
      const v = last(sel, ['border', 'border-color'], on);
      assert.ok(v, `${sel} has a border rule`);
      assert.match(v!.value, /var\(--control\)/, `${sel} ends on "${v!.prop}: ${v!.value}"`);
    }
  });
}

// ---- block placement, #14 and target size ----
const START = '/* FIXES-CYCLE2-A11Y (approval council cycle 2 fixes #12 #13 #14 #26 and range-button target size, 2026-11-01) */';
const END = '/* end FIXES-CYCLE2-A11Y */';
const ANCHOR = '.rt-card:focus { outline: 2px solid var(--accent); outline-offset: 2px; }';
test('the FIXES-CYCLE2-A11Y block exists once, right after .rt-card:focus, before #55\'s A11Y-FIXES block it builds on', () => {
  assert.equal(raw.split(START).length, 2, 'one opening marker');
  assert.equal(raw.split(END).length, 2, 'one closing marker');
  const s = raw.indexOf(START), e = raw.indexOf(END), f13 = raw.indexOf('/* A11Y-FIXES (approval council fixes');
  assert.ok(s < e, 'opening before closing');
  assert.ok(raw.indexOf(`${ANCHOR}\n${START}`) >= 0, 'the block starts on the line after .rt-card:focus');
  assert.ok(f13 > e, '#55\'s A11Y-FIXES block follows ours, so the "no later --line border" guard covers it');
});

const block = parse(raw.slice(raw.indexOf(START), raw.indexOf(END)).replace(/\/\*[\s\S]*?\*\//g, ''));
const BAR = ':has(.signin-line:not(:empty), .hide-bar > p, .nojs-done)';
test('#14 while a bar shows, the feed rows reserve its room (94 px, also at ≤ 480 px tall) and the scrollers (page, pane; the card when it scrolls) pad their bottom; nothing on .feed', () => {
  const find = (sel: string, prop: string, media: (m: string[]) => boolean) =>
    block.filter((r) => r.sels.includes(sel) && media(r.media)).flatMap((r) => decls(r.body)).filter(([k]) => k === prop).map(([, v]) => v);
  const none = (m: string[]) => m.length === 0;
  const short = (m: string[]) => m.length === 1 && /max-height:\s*480px/.test(m[0]);
  assert.deepEqual(find(`body${BAR} .feed .row > *`, 'padding-bottom', none), ['94px']);
  assert.deepEqual(find(`body${BAR} .feed .row > *`, 'padding-bottom', short), [], 'no short-viewport override: the 94 px room holds there too');
  assert.deepEqual(find(`html${BAR}`, 'scroll-padding-bottom', none), ['94px']);
  assert.deepEqual(find(`body${BAR} .feed > .row > .pane`, 'scroll-padding-bottom', none), ['94px']);
  assert.deepEqual(find(`body${BAR} .feed > .row > .card`, 'scroll-padding-bottom', short), ['94px']);
  // Padding on the snap container itself would move every snap point (F-13 note).
  for (const r of block) for (const s of r.sels) assert.doesNotMatch(s, /\.feed$/, `no rule on .feed itself: ${s}`);
  // The :empty test relies on the sign-in line rendering no whitespace while closed (app/feed-gestures.tsx).
  const src = readFileSync(new URL('../app/feed-gestures.tsx', import.meta.url), 'utf8');
  assert.match(src, /<p className="signin-line"[^>]*>\n\s*\{askSignIn && /, 'the <p> holds only the conditional');
});

test('Target size: the chart range buttons are at least 44 × 44 px (POLICY A1)', () => {
  const inBlock = block.filter((r) => r.sels.includes('.tabs button') && r.media.length === 0).flatMap((r) => decls(r.body));
  assert.deepEqual(inBlock.filter(([k]) => k === 'min-height').map(([, v]) => v), ['44px']);
  assert.deepEqual(inBlock.filter(([k]) => k === 'min-width').map(([, v]) => v), ['44px']);
});
