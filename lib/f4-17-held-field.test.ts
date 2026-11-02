// F4-17 (docs/direction/cycle4-2026-11-01.md, C4-18; WCAG 1.3.1): on the author's own profile, the held line under a held
// thesis has the id `held-<trade id>`, and that row's thesis input names it in aria-describedby and is aria-invalid
// while held, so the field's description is the line's text, heldLine(rule). The e2e twin: e2e/f4-17-held-field.spec.ts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { HeldNote } from './user-note.ts';
import { heldLine } from './report-copy.ts';

const page = readFileSync(new URL('../app/u/[handle]/page.tsx', import.meta.url), 'utf8');

test('F4-17: HeldNote carries the id it is given, and its text is heldLine(rule)', () => {
  for (const rule of ['link', 'reports', null]) {
    const html = renderToStaticMarkup(createElement(HeldNote, { rule, id: 'held-42' }));
    const m = /^<p id="held-42" class="muted thesis-held" data-own-held="">([^<]*)<\/p>$/.exec(html);
    assert.ok(m, html);
    assert.equal(m[1].replace(/&#x27;/g, "'"), heldLine(rule));
  }
  // Without an id (the trade page's call) the markup is unchanged.
  assert.doesNotMatch(renderToStaticMarkup(createElement(HeldNote, { rule: 'link' })), /\sid=/);
});

test('F4-17: the profile row passes held-<trade id> to the line and names it on the thesis input while held', () => {
  assert.match(page, /<HeldNote rule=\{t\.thesis_hold_rule\} id=\{`held-\$\{t\.id\}`\} \/>/);
  const input = page.split('\n').find((l) => l.includes('name="thesis"'))!;
  assert.ok(input, 'the thesis input');
  // The same condition as the line (held, non-empty), the same id, and aria-invalid only then.
  assert.match(input, /t\.thesis_status === 'held' && !!t\.thesis \? \{ 'aria-describedby': `held-\$\{t\.id\}`, 'aria-invalid': true \} : \{\}/);
});
