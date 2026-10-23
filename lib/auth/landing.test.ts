// Committee fix (item 7): after sign-in an empty profile is skipped for the trust notice; a record lands on the profile.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { landingPath } from './landing.ts';

test('landing after sign-in: nothing consented and no closed trades → the trust notice; anything else → the profile', () => {
  assert.equal(landingPath('trader_ab', { state: 'none', closes: 0 }), '/connect');
  assert.equal(landingPath('trader_ab', { state: 'none', closes: 3 }), '/u/trader_ab'); // demo or pre-F-1 trades
  for (const state of ['importing', 'connected', 'failed'] as const) {
    assert.equal(landingPath('trader_ab', { state, closes: 0 }), '/u/trader_ab', state);
    assert.equal(landingPath('trader_ab', { state, closes: 2 }), '/u/trader_ab', state);
  }
});
