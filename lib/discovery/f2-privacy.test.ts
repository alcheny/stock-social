// F-2 PR-5 (owner 2026-11-01 "The Privacy Policy says exactly this"; business lead demand 6; H4): once the Privacy
// Policy page has its text, it states every PREFERENCE_DATA fact. While the page is the marked placeholder this is a
// named, visible todo, never a silent pass; removing the placeholder with a fact missing fails.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PREFERENCE_DATA } from '../copy.ts';

const page = readFileSync(new URL('../../app/privacy/page.tsx', import.meta.url), 'utf8');
const placeholder = /LEGAL_PLACEHOLDER\.placeholder/.test(page);

test('H4: the Privacy Policy states how F-2 preference data is stored and used', { todo: placeholder ? 'H4: Privacy Policy text (owner)' : false }, () => {
  assert.equal(PREFERENCE_DATA.length, 4);
  for (const fact of PREFERENCE_DATA) assert.ok(page.includes('PREFERENCE_DATA') || page.includes(fact), `the policy states: ${fact}`);
  assert.ok(!placeholder, 'the policy page has its text');
});
