// F-36: the audit hook's anchor is the shipped `returnPct:` line of lib/trades.ts, exactly once, and the rewrite computes
// both figures (scripts/f36-audit-hook.ts). Without this the audit could stop matching after an edit to that line.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ANCHOR, instrument } from './f36-audit-hook.ts';

test('F-36 audit hook: the anchor occurs exactly once in lib/trades.ts; a missing or doubled anchor throws', () => {
  const src = readFileSync(new URL('../lib/trades.ts', import.meta.url), 'utf8');
  assert.equal(src.split(ANCHOR).length, 2);
  const out = instrument(src, 'log');
  assert.ok(out.includes('returnPct: __f36(a.units * a.price - cost - entryFees - exitFee, cost, entryFees, a),'));
  assert.match(out, /return now;/);
  assert.match(instrument(src, 'legacy'), /return legacy;/);
  assert.throws(() => instrument('no anchor here', 'log'), /occurs 0 times/);
  assert.throws(() => instrument(`${ANCHOR}\n${ANCHOR}`, 'log'), /occurs 2 times/);
});
