// F-15 bot validation (scripts/f15-bot-validation.ts), cycle 4 F4-13 (C4-21): the human group covers generic phone and
// in-app browser agent shapes, not only a desktop one, and every human shape passes the filter's agent test (a human
// shape the filter drops would make the 95% human bar fail on real devices). Pure: no server, no database.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { scanText } from './compliance.ts';
import { BOTS, HUMAN_AGENTS } from './f15-bot-validation.ts';
import { botReason } from '../lib/views.ts';

const headers = (ua: string) => new Headers({ 'user-agent': ua, origin: 'http://app.test', 'sec-fetch-site': 'same-origin', 'sec-fetch-mode': 'cors' });

test('F4-13: the human group is 50 visits across desktop, phone and in-app browser shapes', () => {
  assert.equal(HUMAN_AGENTS.reduce((s, a) => s + a.n, 0), 50);
  const kinds = new Set(HUMAN_AGENTS.map((a) => a.kind));
  for (const k of ['desktop', 'phone', 'in-app']) assert.ok(kinds.has(k as never), k);
  for (const a of HUMAN_AGENTS) assert.ok(a.n > 0, a.kind);
  assert.ok(HUMAN_AGENTS.some((a) => a.kind === 'in-app' && /; wv\)/.test(a.ua)), 'an embedded web view shape');
  for (const a of HUMAN_AGENTS.filter((x) => x.kind !== 'desktop')) assert.ok(a.mobile && /Mobile/.test(a.ua), a.ua);
});

test('F4-13: every human agent shape is counted by the filter; every declared bot agent is still dropped', () => {
  for (const a of HUMAN_AGENTS) assert.equal(botReason(headers(a.ua), false), null, a.ua);
  for (const ua of BOTS) assert.equal(botReason(headers(ua), false), 'declared_bot', ua);
});

test('F4-13: the agent shapes name no app, device maker or service (generic shapes only)', () => {
  // The repo's own mark list (scripts/compliance.ts MARKS) plus device and in-app tokens, so this file names none of them.
  for (const a of HUMAN_AGENTS) {
    assert.deepEqual(scanText('agent.txt', a.ua), [], a.ua);
    assert.doesNotMatch(a.ua, /iphone|ipad|pixel|galaxy|fban|fbav|line\//i, a.ua);
  }
});
