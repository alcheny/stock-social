// A11Y-FIXES (approval council fixes #13, #14, 2026-11-01): the contrast floor, computed from app/globals.css as the
// browser would resolve it (the last matching rule wins; light = every :root rule, including the
// `prefers-color-scheme: light` ones; dark = the rest), so the design system council's tokens inherit it.
// - #13 text (WCAG 1.4.3): the Verified and Demo badge text ≥ 4.5:1 on the badge's own background over bg and surface;
//   the `:target` row draws no fill that lowers its text below 4.5:1 (text, muted, up, down on bg and surface).
// - #14 control boundaries (WCAG 1.4.11): inputs, `.secondary` buttons and `summary` controls draw their border with
//   `--control`, ≥ 3:1 against bg and surface. Token names and values: the design system council 2026-11-01 (§5.1).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dark, decls, last as lastRule, light, parse, tokenOf, tokensFor as tokensForRules, type Rule } from './css-cascade.ts';
import { contrast } from './colour-math.ts';

const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

// F-20: the cascade walk (lib/css-cascade.ts) and the contrast maths (lib/colour-math.ts) are shared with
// lib/fixes-cycle2-a11y.test.ts, so there is one set of contrast values.
const rules = parse(css);
const scheme = { dark, light } as const;
const tokensFor = (on: (r: Rule) => boolean) => tokensForRules(rules, on);
const last = (sel: string, props: string[], on: (r: Rule) => boolean = dark) => lastRule(rules, sel, props, on);

const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
// A background as painted over `base`: none/transparent, a token, or `color-mix(in srgb, var(--x) N%, transparent)`.
const paint = (value: string | undefined, t: Record<string, string>, base: string) => {
  if (!value || /^(none|transparent)$/.test(value)) return base;
  const mix = value.match(/color-mix\(in srgb,\s*var\(--([a-z-]+)\)\s*([\d.]+)%,\s*transparent\)/);
  if (mix) { const p = Number(mix[2]) / 100, a = rgb(t[mix[1]]), b = rgb(base); return `#${a.map((v, i) => Math.round(v * p + b[i] * (1 - p)).toString(16).padStart(2, '0')).join('')}`; }
  const tok = value.match(/^var\(--([a-z-]+)\)$/);
  assert.ok(tok, `unrecognised background "${value}"`);
  return t[tok![1]];
};

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
  test(`#14 --control is at least 3:1 against bg and surface (${name})`, () => {
    assert.ok(t['control'], '--control is defined');
    for (const base of ['bg', 'surface']) {
      const r = contrast(t['control'], t[base]);
      assert.ok(r >= 3, `${name} --control ${t['control']} on --${base} ${t[base]} is ${r.toFixed(2)}:1`);
    }
  });
}

// Every selector that draws a control's border today ends its cascade on --control.
const CONTROLS = ['input', 'textarea', 'select', '.pane .back', '.share-prompt .actions .secondary', '.trade-share .secondary',
  '.new-trades .secondary', '.rec-chips button', '.auth .button.secondary', '.auth button.secondary',
  '.handle-edit summary.secondary', '.follow.secondary', '.more-menu .secondary', '.people .secondary',
  '.pane-actions .button.secondary', '.more-menu summary', '.switch-pair .switch', '.personalize form > button.secondary',
  '.rt .button.choice', '.rt button.choice', '.rt .button.secondary', '.rt button.secondary', '.rt-form input', '.rt-form select',
  '.rt-note textarea'];
test('#14 inputs, .secondary buttons and summary controls draw their border with --control', () => {
  for (const sel of CONTROLS) {
    const v = last(sel, ['border', 'border-color']);
    assert.ok(v, `${sel} has a border rule`);
    assert.match(v!.value, /var\(--control\)/, `${sel} ends on "${v!.prop}: ${v!.value}"`);
  }
});

// #19 (committee B4): the feed card scrolls inside itself only on a short viewport; at 360×640 it keeps the row's clip.
test('#19 the feed card sets overflow-y: auto only inside @media (max-height: 480px)', () => {
  const auto = rules.filter((r) => r.sels.some((s) => /\.card$/.test(s) && s.includes('.feed')) && decls(r.body).some(([k, v]) => /^overflow(-y)?$/.test(k) && /auto|scroll/.test(v)));
  assert.ok(auto.length > 0, 'a short-viewport rule lets the card scroll');
  for (const r of auto) assert.ok(r.media.length > 0 && r.media.every((m) => /max-height:\s*480px/.test(m)), `overflow on the card outside the short-viewport query: ${r.media.join(' ')}`);
});

// ======== F-20: design tokens and the contrast test (docs/features/F-20-design-tokens-and-contrast-test.md) ========
// One token layer (the TOKENS block at the top of app/globals.css), every text and UI pair at its floor in both schemes,
// gain vs loss (and Flat) apart under colour-vision deficiency, the share-image colour table (lib/palette.ts) under the
// same floors, every outline drawn in --focus at a 2 px offset (DS-27), and dead CSS gone (DS-26).
import { cvd, mix } from './colour-math.ts';
import { block, parse as parseRaw } from './css-cascade.ts';
import { existsSync, readdirSync } from 'node:fs';

const rawCss = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
const TOKENS_START = '/* TOKENS (F-20, DS-1)';
const TOKENS_END = '/* end TOKENS */';

// The floors (AC4, AC5, AC12). Cycle 2 set these (approval council, cycle 2: 4.5:1 text, 3:1 large text, UI parts and the
// focus ring, ΔE00 ≥ 9 under protan, deutan and tritan); they are never lowered to make a pair pass.
// The protected scripts/invariants.test.ts pins FLOORS at or above cycle 2 (owner decision 2026-11-01, item 2.44).
export const FLOORS = { text: 4.5, large: 3, ui: 3, focus: 3, cvd: 9 } as const;
const CYCLE2 = { text: 4.5, large: 3, ui: 3, focus: 3, cvd: 9 } as const; // written separately on purpose

// AC1: every token's resolved value per scheme, after fixes #12, #13 and #26 (value-neutral: these are main's values).
const TOKENS_WANT = {
  light: { bg: '#fafafa', surface: '#ffffff', text: '#111118', muted: '#6b6b78', line: '#e5e5ea', up: '#0b6b70', down: '#b2441b',
    accent: '#6d28d9', 'on-accent': '#ffffff', control: '#7c818b', focus: '#2152d9', verified: '#111118', flat: '#6b6b78', demo: '#6b6b78', warn: '#92400e' },
  dark: { bg: '#0b0b0f', surface: '#16161d', text: '#f4f4f6', muted: '#8b8b98', line: '#262631', up: '#3cc4b4', down: '#ff8a5b',
    accent: '#a78bfa', 'on-accent': '#0b0b0f', control: '#6f7682', focus: '#86a8ff', verified: '#f4f4f6', flat: '#8b8b98', demo: '#8b8b98', warn: '#fbbf24' },
} as const;
// AC2 (veto DK, CS): base, accent and on-accent change only through the V-1 three-version test.
const BASE_WANT = {
  light: { bg: '#fafafa', surface: '#ffffff', text: '#111118', muted: '#6b6b78', line: '#e5e5ea', accent: '#6d28d9', 'on-accent': '#ffffff' },
  dark: { bg: '#0b0b0f', surface: '#16161d', text: '#f4f4f6', muted: '#8b8b98', line: '#262631', accent: '#a78bfa', 'on-accent': '#0b0b0f' },
} as const;

test('F-20 AC12: no floor constant is below the cycle-2 values', () => {
  for (const [k, v] of Object.entries(CYCLE2)) assert.ok(FLOORS[k as keyof typeof FLOORS] >= v, `FLOORS.${k} ${FLOORS[k as keyof typeof FLOORS]} < cycle-2 ${v}`);
  assert.deepEqual(Object.keys(FLOORS).sort(), Object.keys(CYCLE2).sort());
});

test('F-20 AC12: no contrast test compares a ratio or ΔE00 with a literal below 3', () => {
  for (const f of ['a11y-contrast.test.ts', 'fixes-cycle2-a11y.test.ts', 'badge-contrast.test.ts']) {
    const src = readFileSync(new URL(`./${f}`, import.meta.url), 'utf8');
    for (const m of src.matchAll(/\b(?:r|min|ratio|de|contrast\([^)]*\)|cvdMin\([^)]*\))\s*>=?\s*(\d+(?:\.\d+)?)\b/g)) {
      assert.ok(Number(m[1]) >= 3, `${f}: "${m[0]}"`);
    }
  }
});

// QA M2: every inline floor the older contrast tests keep, by file, exactly as written. A floor that is lowered (9 → 3,
// 4.5 → 3), or a new comparison that is not on FLOORS, fails here; a deliberate new inline floor is added to this list.
const INLINE_FLOORS: Record<string, string[]> = {
  'a11y-contrast.test.ts': ['r >= 4.5', 'r >= 4.5', 'contrast(t[bar], t[base]) >= 3', 'r >= 3'],
  'fixes-cycle2-a11y.test.ts': ['r >= 4.5', 'r >= 4.5', 'min >= 9', 'r >= 3'],
  'badge-contrast.test.ts': ['r >= 4.5'],
};
test('F-20 AC12 (QA M2): every ratio or ΔE00 comparison is on FLOORS or is a listed inline floor at its cycle-2 value', () => {
  for (const [f, want] of Object.entries(INLINE_FLOORS)) {
    const src = readFileSync(new URL(`./${f}`, import.meta.url), 'utf8').replace(/^\s*\/\/[^\n]*$/gm, '');
    const got: string[] = [];
    // The first argument of each assert.ok(…), up to its top-level comma.
    for (const m of src.matchAll(/assert\.ok\(/g)) {
      let depth = 0, i = m.index + m[0].length, arg = '';
      for (; i < src.length; i++) {
        const ch = src[i];
        if ('([{'.includes(ch)) depth++;
        else if (')]}'.includes(ch)) { if (depth === 0) break; depth--; }
        else if (ch === ',' && depth === 0) break;
        arg += ch;
      }
      const cmp = arg.replace(/\s+/g, ' ').trim();
      if (!/>=/.test(cmp)) continue;
      if (/\.length\b|indexOf\(|\brings\b|Number\(m\[1\]\)/.test(cmp)) continue; // counts and positions, not floors
      if (/>= (?:FLOORS\.[a-z]+|FLOORS\[[^\]]+\]|floor)$/.test(cmp)) continue;
      if (cmp === 'FLOORS[k as keyof typeof FLOORS] >= v') continue; // the FLOORS ≥ CYCLE2 check itself
      got.push(cmp);
    }
    assert.deepEqual(got, want, `${f}: inline floors changed`);
  }
  // The FLOORS-based comparisons are really there (a check rewritten to a literal would leave the list above).
  const own = readFileSync(new URL('./a11y-contrast.test.ts', import.meta.url), 'utf8');
  assert.ok((own.match(/>= FLOORS\.cvd/g) ?? []).length >= 3, 'the ΔE00 checks compare with FLOORS.cvd');
});

test('F-20 AC1: one TOKENS block opens app/globals.css, and the first :root rules (the regex tests read them) hold every hex token', () => {
  assert.equal(rawCss.split(TOKENS_START).length, 2, 'one TOKENS opening marker');
  assert.equal(rawCss.split(TOKENS_END).length, 2, 'one TOKENS closing marker');
  assert.ok(rawCss.startsWith(TOKENS_START), 'the block is the first thing in the file');
  const tokens = block(rawCss, TOKENS_START, TOKENS_END);
  // The header comment carries no `}` and no `:root`, so lib/badge-contrast.test.ts and lib/f7-trust.test.ts read the block.
  const header = tokens.slice(0, tokens.indexOf('*/'));
  assert.doesNotMatch(header, /\}|:root/);
  const hexes = (body: string) => [...body.matchAll(/--([a-z-]+):\s*#[0-9a-f]{3,8}\b/gi)].map((m) => m[1]).sort();
  const firstDark = rawCss.match(/:root\s*\{([^}]*)\}/)![1];
  const firstLight = rawCss.match(/@media \(prefers-color-scheme: light\)\s*\{\s*:root\s*\{([^}]*)\}/)![1];
  const all = (on: (r: Rule) => boolean) => parse(tokens.replace(/\/\*[\s\S]*?\*\//g, '')).filter((r) => r.sels.includes(':root') && on(r)).flatMap((r) => hexes(r.body));
  assert.deepEqual(hexes(firstDark), [...new Set(all((r) => r.media.length === 0))].sort(), 'dark: the first :root holds every hex token');
  assert.deepEqual(hexes(firstLight), [...new Set(all((r) => r.media.length > 0))].sort(), 'light: the first light :root holds every hex token');
  for (const k of ['bg', 'surface', 'text', 'muted', 'line', 'up', 'down', 'accent', 'on-accent', 'control', 'focus']) {
    assert.ok(hexes(firstDark).includes(k) && hexes(firstLight).includes(k), `--${k} in both first :root rules`);
  }
});

test('F-20 AC7 (QA L1): the TOKENS block holds only :root rules (plain and in the light query), so no rule hides a literal there', () => {
  const inside = parse(block(rawCss, TOKENS_START, TOKENS_END).replace(/\/\*[\s\S]*?\*\//g, ''));
  assert.ok(inside.length >= 2, 'the dark and light :root rules');
  for (const r of inside) {
    assert.deepEqual(r.sels, [':root'], `only :root inside TOKENS: ${r.sels.join(', ')}`);
    for (const m of r.media) assert.match(m, /^@media \(prefers-color-scheme: light\)$/, `only the light query inside TOKENS: ${m}`);
  }
});

test('F-20 AC1, AC7: no :root rule outside TOKENS gives a custom property a colour literal', () => {
  const outside = rawCss.replace(block(rawCss, TOKENS_START, TOKENS_END), '').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const r of parseRaw(outside)) if (r.sels.includes(':root')) for (const [k, v] of decls(r.body)) {
    if (k.startsWith('--')) assert.doesNotMatch(v, /#[0-9a-f]{3,8}\b|\b(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/i, `${k}: ${v} outside TOKENS`);
  }
});

for (const [name, on] of Object.entries(scheme) as [keyof typeof TOKENS_WANT, (r: Rule) => boolean][]) {
  const t = tokensFor(on);
  test(`F-20 AC1: every token resolves to its post-fix value (${name})`, () => {
    for (const [k, v] of Object.entries(TOKENS_WANT[name])) assert.equal(t[k], v, `${name} --${k}`);
  });
  test(`F-20 AC2: base, accent and on-accent are unchanged (${name})`, () => {
    for (const [k, v] of Object.entries(BASE_WANT[name])) assert.equal(t[k], v, `${name} --${k}`);
  });

  // AC4, AC11: every text and UI pair, by name, each at its floor. Text over bg and surface unless a pair names its own
  // ground. Large text is held to the text floor (stricter; every text token passes it). --line is decorative only
  // (dividers, cards, tiles; never a control boundary: #14's list guards that), so it has no pair.
  type Pair = { what: string; fg: string; on: string[] | { mix: string; pct: number }; floor: keyof typeof FLOORS };
  const GROUNDS = ['bg', 'surface'];
  const PAIRS: Pair[] = [
    { what: 'body text', fg: 'text', on: GROUNDS, floor: 'text' },
    { what: 'the disclaimer and labels (--muted)', fg: 'muted', on: GROUNDS, floor: 'text' },
    { what: 'gain text', fg: 'up', on: GROUNDS, floor: 'text' },
    { what: 'loss text', fg: 'down', on: GROUNDS, floor: 'text' },
    { what: 'Flat text', fg: 'flat', on: GROUNDS, floor: 'text' },
    { what: 'the warn notice border and icon (--warn, F-27; held to the text floor)', fg: 'warn', on: GROUNDS, floor: 'text' },
    { what: 'the Verified badge text on its 18% --up tint', fg: 'verified', on: { mix: 'up', pct: 0.18 }, floor: 'text' },
    { what: 'the Demo badge text (on --surface)', fg: 'demo', on: ['surface'], floor: 'text' },
    { what: 'the Public filing badge text (on --surface)', fg: 'text', on: ['surface'], floor: 'text' },
    { what: 'text on the accent button', fg: 'on-accent', on: ['accent'], floor: 'text' },
    { what: 'the selected chip text (--bg on --accent)', fg: 'bg', on: ['accent'], floor: 'text' },
    { what: 'the pressed range tab (--bg on gain)', fg: 'bg', on: ['up'], floor: 'text' },
    { what: 'the pressed range tab (--bg on loss)', fg: 'bg', on: ['down'], floor: 'text' },
    { what: 'the Watch button text (--accent)', fg: 'accent', on: GROUNDS, floor: 'text' },
    { what: 'the pressed Watch button text (--accent on its 15% tint)', fg: 'accent', on: { mix: 'accent', pct: 0.15 }, floor: 'text' },
    { what: 'the selected chip fill (--accent)', fg: 'accent', on: GROUNDS, floor: 'ui' },
    { what: 'control borders (--control)', fg: 'control', on: GROUNDS, floor: 'ui' },
    { what: 'the gain chart line', fg: 'up', on: GROUNDS, floor: 'ui' },
    { what: 'the loss chart line', fg: 'down', on: GROUNDS, floor: 'ui' },
    { what: 'the 0% axis line (--muted)', fg: 'muted', on: GROUNDS, floor: 'ui' },
    { what: 'the focus ring', fg: 'focus', on: GROUNDS, floor: 'focus' },
  ];
  for (const p of PAIRS) {
    test(`F-20 AC4/AC11: ${p.what} is at least ${FLOORS[p.floor]}:1 (${name})`, () => {
      assert.ok(t[p.fg], `--${p.fg} is defined`);
      const on = p.on;
      const grounds = Array.isArray(on) ? on.map((k) => [k, t[k]] as const) : GROUNDS.map((k) => [`${on.mix} ${on.pct * 100}% over ${k}`, mix(t[on.mix], t[k], on.pct)] as const);
      for (const [g, hex] of grounds) {
        assert.ok(hex, `ground ${g}`);
        const r = contrast(t[p.fg], hex);
        assert.ok(r >= FLOORS[p.floor], `${name} --${p.fg} ${t[p.fg]} on ${g} ${hex}: ${r.toFixed(2)}:1`);
      }
    });
  }
  test(`F-20 AC4/AC11: the named badges draw from the tokens the pairs test (${name})`, () => {
    assert.equal(tokenOf(last('.badge.verified', ['color'], on)?.value), 'verified');
    assert.match(last('.badge.verified', ['background'], on)!.value, /color-mix\(in srgb, var\(--up\) 18%, transparent\)/);
    assert.equal(tokenOf(last('.badge.demo', ['color'], on)?.value), 'muted');
    assert.equal(t.demo, t.muted, '--demo is the Demo badge colour today (an alias of --muted)');
    assert.equal(tokenOf(last('.badge.demo', ['background'], on)?.value), 'surface');
    assert.equal(tokenOf(last('.badge.public', ['color'], on)?.value), 'text');
    assert.equal(tokenOf(last('.badge.public', ['background'], on)?.value), 'surface');
  });

  // AC5, AC11: gain, loss and Flat apart under colour-vision deficiency (min ΔE00 over protan, deutan, tritan).
  test(`F-20 AC5: gain vs loss is at least ΔE00 ${FLOORS.cvd} under protan, deutan and tritan (${name})`, () => {
    const v = cvd(t.up, t.down);
    for (const [k, d] of Object.entries(v)) assert.ok(d >= FLOORS.cvd, `${name} up vs down ${k}: ${d.toFixed(1)}`);
  });
  for (const other of ['up', 'down'] as const) {
    // Light Flat vs gain measures protan 2.8 (deutan 7.0, tritan 19.5): a known failure, open for the owner (plan OQ-2).
    // ponytail: light --flat (= --muted) vs --up fails the ΔE00 floor under protan; next step the owner's call on OQ-2
    // (a new --flat value through the fixes list, or a ruling on the floor's scope). The floor is not lowered.
    const todo = name === 'light' && other === 'up' ? 'OQ-2: light Flat vs gain fails the ΔE00 9 floor (owner)' : undefined;
    test(`F-20 AC5/AC11: Flat vs ${other === 'up' ? 'gain' : 'loss'} is at least ΔE00 ${FLOORS.cvd} under protan, deutan and tritan (${name})`, { todo }, () => {
      const v = cvd(t.flat, t[other]);
      const got = Object.entries(v).map(([k, d]) => `${k} ${d.toFixed(1)}`).join(', ');
      if (todo) console.log(`${name} Flat vs ${other}: ${got}`);
      for (const [k, d] of Object.entries(v)) assert.ok(d >= FLOORS.cvd, `${name} flat vs ${other} ${k}: ${d.toFixed(1)} (${got})`);
    });
  }
}

test('F-20 AC3: lib/badge-contrast.test.ts is kept, with its test', () => {
  const f = new URL('./badge-contrast.test.ts', import.meta.url);
  assert.ok(existsSync(f));
  assert.match(readFileSync(f, 'utf8'), /test\('the Demo badge text is at least 4\.5:1 on its own background, light and dark'/);
});

// ---- AC6: the share-image colour table (lib/palette.ts) ----
// The image colours, written out here: the table must equal them. Main's values, except gain and loss, which take the
// page's dark ink (committee decision 2026-11-01, OQ-1, flagged to the owner; main had #22c55e / #f43f5e, deutan 6.3). The
// card's Demo hue (O-2) is the owner's. next/og cannot read CSS variables, so the images read this table, not the tokens.
const IMAGE_TODAY = {
  card: { bg: '#0b0b0f', text: '#f4f4f6', muted: '#a1a1ad', up: '#3cc4b4', down: '#ff8a5b', warn: '#f59e0b', demo: '#38bdf8', base: '#6b6b78', ok: '#22c55e' },
  strip: { text: '#f4f4f6', muted: '#8b8b98', up: '#3cc4b4', down: '#ff8a5b', warn: '#f59e0b', ok: '#22c55e' },
  stripBg: '#0b0b0f',
  home: { bg: '#0b0b0f', text: '#f2f2f5' },
  themeColor: '#0b0b0f',
};
test('F-20 AC6: the image colour table equals the decided image colours, and the images read it', async () => {
  const { IMAGE_PALETTE, THEME_COLOR } = await import('./palette.ts');
  assert.deepEqual(IMAGE_PALETTE, { card: IMAGE_TODAY.card, strip: IMAGE_TODAY.strip, stripBg: IMAGE_TODAY.stripBg, home: IMAGE_TODAY.home });
  assert.match(readFileSync(new URL('../app/home-card/route.tsx', import.meta.url), 'utf8'), /background: IMAGE_PALETTE\.home\.bg, color: IMAGE_PALETTE\.home\.text/);
  assert.equal(THEME_COLOR, IMAGE_TODAY.themeColor);
  const strip = await import('./record-strip.ts');
  assert.equal(strip.IMAGE_COLOURS, IMAGE_PALETTE.strip, 'the strip image reads the table itself');
  assert.equal(strip.IMAGE.bg, IMAGE_PALETTE.stripBg);
  const card = readFileSync(new URL('../app/u/[handle]/record-card-image.tsx', import.meta.url), 'utf8');
  assert.match(card, /const C = IMAGE_PALETTE\.card;/);
  // The status badge ("Verified from broker", "connected") keeps main's green, as the strip's `ok` does: only gain and
  // loss changed (OQ-1).
  assert.match(card, /const TONE = \{ ok: C\.ok,/);
  assert.equal(IMAGE_PALETTE.card.ok, IMAGE_PALETTE.strip.ok);
  assert.match(readFileSync(new URL('../app/layout.tsx', import.meta.url), 'utf8'), /themeColor: THEME_COLOR/);
});

test('F-20 AC6: no image file or image helper keeps an inline hex colour', () => {
  const og: string[] = [];
  const walk = (dir: URL) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const u = new URL(`${e.name}${e.isDirectory() ? '/' : ''}`, dir);
      if (e.isDirectory()) walk(u); else if (/^(opengraph-image|twitter-image)\.tsx$|^route\.tsx$/.test(e.name)) og.push(u.pathname);
    }
  };
  walk(new URL('../app/', import.meta.url));
  assert.ok(og.some((p) => p.endsWith('/u/[handle]/opengraph-image.tsx') || p.endsWith('/u/%5Bhandle%5D/opengraph-image.tsx')), 'found the profile unfurl');
  const files = [...og.map((p) => decodeURIComponent(p)), ...['../lib/record-strip.ts', '../app/record-strip.tsx', '../app/u/[handle]/record-card-image.tsx', '../app/layout.tsx']
    .map((f) => decodeURIComponent(new URL(f, import.meta.url).pathname))];
  for (const f of files) {
    const src = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
    assert.deepEqual([...src.matchAll(/['"`]#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?)\(/gi)].map((m) => m[0]), [], f);
  }
});

test('F-20 AC6 (OQ-1): the images draw gain and loss in the page\'s dark --up / --down, so they pass the page tokens\' floors', async () => {
  const { IMAGE_PALETTE } = await import('./palette.ts');
  const t = tokensFor(scheme.dark);
  for (const part of ['card', 'strip'] as const) {
    assert.equal(IMAGE_PALETTE[part].up, t.up, `${part}.up is the dark --up`);
    assert.equal(IMAGE_PALETTE[part].down, t.down, `${part}.down is the dark --down`);
  }
  assert.equal(IMAGE_PALETTE.card.bg, t.bg, 'the card is drawn on the dark --bg');
  assert.equal(IMAGE_PALETTE.stripBg, t.bg, 'the strip is drawn on the dark --bg');
});

test('F-20 AC6/AC11: the home link preview\'s text is at the text floor on its background', async () => {
  const { IMAGE_PALETTE } = await import('./palette.ts');
  const r = contrast(IMAGE_PALETTE.home.text, IMAGE_PALETTE.home.bg);
  assert.ok(r >= FLOORS.text, `home text on bg: ${r.toFixed(2)}:1`);
});

for (const [part, bgKey] of [['card', 'card.bg'], ['strip', 'stripBg']] as const) {
  test(`F-20 AC6/AC11: share-image ${part} colours are at their floors on the image background`, async () => {
    const { IMAGE_PALETTE } = await import('./palette.ts');
    const bg = part === 'card' ? IMAGE_PALETTE.card.bg : IMAGE_PALETTE.stripBg;
    const colours = Object.entries(IMAGE_PALETTE[part]).filter(([k]) => k !== 'bg');
    assert.ok(colours.length >= 6, bgKey);
    for (const [k, hex] of colours) {
      // The card's `base` is the dashed 0% line: a UI part (3:1). Every other image colour is text.
      const floor = part === 'card' && k === 'base' ? FLOORS.ui : FLOORS.text;
      const r = contrast(hex, bg);
      assert.ok(r >= floor, `${part}.${k} ${hex} on ${bg}: ${r.toFixed(2)}:1 (floor ${floor})`);
    }
  });
  // Main's pair (#22c55e / #f43f5e) measured deutan 6.3; the page's dark ink measures protan 20.1, deutan 30.1, tritan 62.4.
  test(`F-20 AC6/AC11: share-image ${part} gain vs loss is at least ΔE00 ${FLOORS.cvd} under protan, deutan and tritan`, async () => {
      const { IMAGE_PALETTE } = await import('./palette.ts');
      const v = cvd(IMAGE_PALETTE[part].up, IMAGE_PALETTE[part].down);
      const got = Object.entries(v).map(([k, d]) => `${k} ${d.toFixed(1)}`).join(', ');
      console.log(`image ${part} up vs down: ${got}`);
      for (const [k, d] of Object.entries(v)) assert.ok(d >= FLOORS.cvd, `${part} up vs down ${k}: ${d.toFixed(1)} (${got})`);
    });
}

// ---- AC8 (DS-27): every outline is the focus ring: var(--focus) at a 2 px offset ----
// The state outlines kept, by name: the pane's current row (#12 drew it in --focus, 2 px at 2 px offset, weight 600; a
// state, not focus, plan OQ-4) and the selected switch (2 px --text at 1 px: committee R5's fallback, since a box-shadow
// redraw changed corner pixels; owner question OQ-3). Each is allowed exactly its current declarations.
const STATE_OUTLINES: Record<string, (m: string[], decl: [string, string]) => boolean> = {
  '.pane .rows .line.hl': (m, [k, v]) => m.length === 0 && (k === 'outline' ? v === '2px solid var(--focus)' : k === 'outline-offset' ? v === '2px' : k === 'outline-color' && v === 'var(--focus)'),
  '.switch-pair .switch.current': (m, [k, v]) => m.length === 0 && (k === 'outline' ? v === '2px solid var(--text)' : k === 'outline-offset' && v === '1px'),
  // F-9 (#65)'s Report control on a short-screen feed card: the note clips its overflow there, so the --focus ring is drawn
  // inside (−2 px). Only that offset, only inside the short-screen query.
  '.feed .card .user-note .link-button:focus-visible': (m, [k, v]) => m.length === 1 && /max-height:\s*480px/.test(m[0]) && k === 'outline-offset' && v === '-2px',
};
test('F-20 AC8: every outline is none or var(--focus), every outline-offset is 2 px, and only focus selectors draw one', () => {
  const all = parseRaw(rawCss.replace(/\/\*[\s\S]*?\*\//g, ''));
  let rings = 0;
  for (const r of all) for (const [k, v] of decls(r.body)) {
    if (!/^outline(-color|-offset|-style|-width)?$/.test(k)) continue;
    for (const sel of r.sels) {
      const allowed = STATE_OUTLINES[sel]?.(r.media, [k, v]);
      if (allowed) continue;
      if (k === 'outline-offset') { assert.equal(v, '2px', `${sel} { ${k}: ${v} }`); continue; }
      if (/^(none|0)$/.test(v)) continue;
      if (k === 'outline' || k === 'outline-color') assert.match(v, /var\(--focus\)/, `${sel} { ${k}: ${v} }`);
      assert.match(sel, /:focus(-visible|-within)?\b/, `${sel} draws an outline without being a focus selector`);
      rings++;
    }
  }
  assert.ok(rings >= 9, `${rings} focus rings found`);
  // Rings that set no offset of their own sit on the global 2 px (the global rule is the first).
  assert.equal(last(':focus-visible', ['outline-offset'])?.value, '2px');
});
test('F-20 AC8: the attestation checkbox keeps the global ring (no -4 px offset rule), the sheet outlines are the focus ring', () => {
  assert.equal(last('.auth input[type="checkbox"]:focus-visible', ['outline-offset']), undefined);
  for (const sel of ['.pane-sheet .sheet-note:focus', '.pane-sheet .sheet-trade h3:focus', '.rt-card:focus', '.rows.closes li:focus', 'footer.site:focus']) {
    assert.match(last(sel, ['outline'])!.value, /^2px solid var\(--focus\)$/, sel);
    assert.equal(last(sel, ['outline-offset'])?.value, '2px', sel);
  }
  for (const on of [light, dark]) assert.equal(tokenOf(last('.pane .rows .line.hl', ['outline', 'outline-color'], on)?.value), 'focus');
});

// ---- DS-26: dead CSS ----
test('F-20 DS-26: one .sr-only rule (the full one)', () => {
  const sr = parseRaw(rawCss.replace(/\/\*[\s\S]*?\*\//g, '')).filter((r) => r.sels.includes('.sr-only'));
  assert.equal(sr.length, 1, `${sr.length} .sr-only rules`);
  assert.match(sr[0].body, /margin: -1px/);
  assert.match(sr[0].body, /padding: 0/);
});
