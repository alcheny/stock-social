// Fix round 2 (B): the author's held line names the reason in plain words; a reader-report hold names no count.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { heldLine, RULE_EXPLAIN } from './report-copy.ts';
import { REPORT_RULE } from './reports.ts';
import { HOLD_V2, LONG_WORDS } from './moderation.ts';

test('held line: a moderation label names its plain explanation', () => {
  assert.equal(heldLine('link'), 'Thesis held for review. Only you can see it. Held because it has a link or web address. Edit it to publish, or it stays held until reviewed.');
  assert.equal(heldLine('return claim'), 'Thesis held for review. Only you can see it. Held because it has a return claim beyond this trade. Edit it to publish, or it stays held until reviewed.');
  for (const r of [...HOLD_V2, ...LONG_WORDS]) assert.ok(heldLine(r.label).includes(`Held because it has ${RULE_EXPLAIN[r.label]}.`), r.label);
  for (const l of Object.keys(RULE_EXPLAIN)) assert.ok(heldLine(l).startsWith('Thesis held for review.'), l);
});

test('held line: a reader-report hold says readers reported it, with no count', () => {
  assert.equal(REPORT_RULE, 'reports');
  assert.equal(heldLine(REPORT_RULE), 'Thesis held for review. Only you can see it. Readers reported it; it stays held until reviewed.');
  assert.doesNotMatch(heldLine(REPORT_RULE), /\d/);
});

test('held line: a missing or unknown label names no reason and never prints the stored value', () => {
  const plain = 'Thesis held for review. Only you can see it. Edit it to publish, or it stays held until reviewed.';
  for (const r of [null, undefined, '', 'toString', '__proto__', 'Buy now at example.com']) assert.equal(heldLine(r), plain, String(r));
});

test('the profile renders the held line muted (never the loss colour) for the author only', () => {
  const src = readFileSync(new URL('../app/u/[handle]/page.tsx', import.meta.url), 'utf8');
  // F-26: through the one held-line markup, HeldNote (lib/user-note.ts: <p class="muted thesis-held">{heldLine(rule)}</p>).
  assert.match(src, /\{isMe && t\.thesis_status === 'held' && !!t\.thesis && <HeldNote rule=\{t\.thesis_hold_rule\} \/>\}/);
  const note = readFileSync(new URL('./user-note.ts', import.meta.url), 'utf8');
  assert.match(note, /h\('p', \{ className: 'muted thesis-held', 'data-own-held': '' \}, heldLine\(rule\)\)/);
  assert.doesNotMatch(src, /Matched rule/);
});
