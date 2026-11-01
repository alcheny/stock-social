import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkDisplayName, handleVerdict, hskel, RESERVED, stripTail, HANDLE_RESERVED_DAYS } from './handles.ts';

const DEMO = ['momentum_maya', 'dividend_dan', 'yolo_yuki'];
const ctx = (others: string[] = DEMO) => ({ others, demo: DEMO });

test('hskel: lower case, rn→m, 0→o, 1→l; stripTail drops a trailing run of digits or _', () => {
  assert.equal(hskel('RnOmentum_0l1'), 'momentum_oll');
  assert.equal(stripTail('momentum_maya_1_'), 'momentum_maya');
  assert.equal(stripTail('trader_2024'), 'trader');
  assert.equal(HANDLE_RESERVED_DAYS, 365);
});

test('refused: reserved words, their look-alikes and the product name', () => {
  for (const h of ['stocksocial', 'stock_social', 'admin', 'official', 'verified', 'support', 'snaptrade', 'login', 'review']) {
    assert.equal(handleVerdict(h, ctx()), 'reserved', h);
  }
  for (const h of ['adrnin', 'admin_2024', 'mod_1', '0fficial_desk', 'the_verified_one', 'stock_social1', 'team_1', 'my_official']) {
    assert.equal(handleVerdict(h, ctx()), 'reserved', h);
  }
  assert.ok(RESERVED.every((r) => !/[A-Z]/.test(r)));
});

test('refused: look-alikes of a demo profile, with or without a trailing run', () => {
  for (const h of ['momentum_maya1', 'momentum_maya_', 'rnomentum_maya', 'momentum_rnaya', 'dividend_dan2']) {
    assert.equal(handleVerdict(h, ctx([])), 'lookalike', h);
  }
});

test('refused: look-alike of any other handle or reservation; exact match is taken', () => {
  assert.equal(handleVerdict('ca1m_trader', ctx(['calm_trader'])), 'lookalike');
  assert.equal(handleVerdict('calm_trader', ctx(['calm_trader'])), 'taken');
  assert.equal(handleVerdict('momentum_maya', ctx()), 'taken');
});

test('accepted: ordinary handles, trailing digits that match nothing, provisional handles', () => {
  for (const h of ['trader_2024', 'maya_2024', 'calm_trader', 'dan_2', 'officer_k']) assert.equal(handleVerdict(h, ctx()), 'ok', h);
  // A provisional trader_* needs only taken and reserved: a look-alike of another provisional handle is fine.
  assert.equal(handleVerdict('trader_abcd1234', { others: ['trader_abcdl234'], demo: DEMO, provisional: true }), 'ok');
  assert.equal(handleVerdict('trader_abcd1234', { others: ['trader_abcd1234'], demo: DEMO, provisional: true }), 'taken');
  // The same suffix rule never applies to other users' handles: trader_2024 is free next to trader_2023.
  assert.equal(handleVerdict('trader_2024', ctx(['trader_2023'])), 'ok');
});

test('format: anything normalizeHandle refuses', () => {
  for (const h of ['Bad Handle!', 'ab', 'x'.repeat(21), '', null, 42]) assert.equal(handleVerdict(h, ctx()), 'format', String(h));
  assert.equal(handleVerdict('  Calm_Trader ', ctx([])), 'ok'); // normalized like the form
});

test('checkDisplayName: accepts ordinary names, cleans invisible characters', () => {
  for (const n of ['Maya', 'Ana María', '李雷', 'Sam \u{1F680}\u{1F680}', 'Dave Rified', 'O’Neil', 'Officer K']) {
    const c = checkDisplayName(n);
    assert.ok(c.ok, n);
  }
  assert.deepEqual(checkDisplayName('  Ma​ya‮ '), { ok: true, name: 'Maya' });
  assert.deepEqual(checkDisplayName('Line\nbreak'), { ok: true, name: 'Line break' });
});

test('checkDisplayName: refuses check glyphs, verified/official, product or vendor name, 3+ emoji, 41+ characters, no letter or digit', () => {
  const refused = ['Sam ✓', 'Sam ✔', 'Sam ✅', 'Sam ☑', 'Verified Sam', 'V3r1f1ed', 'v.e.r.i.f.i.e.d', 'Official Desk',
    '0fficial', 'Stock Social Team', 'stocksocial', 'S t o c k S o c i a l', 'snaptrade fan', '\u{1F680}\u{1F680}\u{1F680}',
    'a\u{1F468}‍\u{1F469}‍\u{1F467}\u{1F680}\u{1F525}', 'x'.repeat(41), '!!!', '', '   ', '​​'];
  for (const n of refused) {
    const c = checkDisplayName(n);
    assert.equal(c.ok, false, n);
    if (!c.ok) assert.ok(c.reason.length > 10 && !c.reason.includes(n.trim() || '\u0000'), n);
  }
  assert.ok(checkDisplayName('x'.repeat(40)).ok);
  assert.ok(checkDisplayName('a\u{1F468}‍\u{1F469}‍\u{1F467}\u{1F680}').ok, 'a joined emoji sequence counts once');
});
