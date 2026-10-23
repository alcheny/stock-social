// F-1 PR-2b carried item (committee, POLICY A1): the Demo badge text is at least 4.5:1 against the badge's own background
// in both color schemes, computed from the tokens in app/globals.css (dark is the default; light under the media query).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
const hex6 = (h: string) => (h.length === 4 ? `#${[...h.slice(1)].map((c) => c + c).join('')}` : h).toLowerCase();
const tokens = (block: string) => Object.fromEntries([...block.matchAll(/--([a-z-]+):\s*(#[0-9a-f]{6}\b|#[0-9a-f]{3}\b)/gi)].map((m) => [m[1], hex6(m[2])]));
const dark = tokens(css.match(/:root\s*\{([^}]*)\}/)![1]);
const light = { ...dark, ...tokens(css.match(/@media \(prefers-color-scheme: light\)\s*\{\s*:root\s*\{([^}]*)\}/)![1]) };
const lum = (hex: string) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const contrast = (a: string, b: string) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const rule = (sel: string) => css.match(new RegExp(`${sel.replace(/\./g, '\\.')}\\s*\\{([^}]*)\\}`))![1];
const prop = (body: string, name: string) => body.match(new RegExp(`(?:^|;|\\s)${name}:\\s*var\\(--([a-z-]+)\\)`))?.[1];

test('the Demo badge text is at least 4.5:1 on its own background, light and dark', () => {
  const body = rule('.badge.demo');
  const fg = prop(body, 'color'), bg = prop(body, 'background');
  assert.ok(fg && bg, 'the Demo badge sets color and background from tokens');
  for (const [name, t] of [['dark', dark], ['light', light]] as const) {
    const r = contrast(t[fg!], t[bg!]);
    assert.ok(r >= 4.5, `${name}: ${t[fg!]} on ${t[bg!]} is ${r.toFixed(2)}:1`);
  }
});
