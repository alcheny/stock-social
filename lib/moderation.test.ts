import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HOLD, moderate } from './moderation.ts';

const RULES: { rule: string; held: string[]; published: string[] }[] = [
  { rule: 'guarantee', held: ['Guaranteed 10% a month'], published: ['Waited for a pullback'] },
  { rule: 'risk-free', held: ['risk-free trade', 'Risk free', 'riskfree'], published: ['low risk entry'] },
  { rule: "can't lose", held: ["can't lose", 'cant lose'], published: ['can lose it all'] },
  { rule: '100x', held: ['going 100x'], published: ['1000x', 'a 100 x move'] },
  { rule: 'to the moon', held: ['TO THE MOON'], published: ['moonshot'] },
  {
    rule: 'contact/promo',
    held: ['DM me', 'join my group', 'link in bio', 't.me/abc', 'discord.gg/x', 'WhatsApp'],
    published: ['Admin me on the dashboard'],
  },
  { rule: 'buy now', held: ['buy now', 'Load up on before earnings'], published: ['buy the dip', 'I did buy nowhere'] },
  { rule: 'financial advice', held: ['not financial advice'], published: ['financial planning notes'] },
];

test('every rule holds its positive cases', () => {
  for (const { rule, held } of RULES) for (const t of held) assert.equal(moderate(t), 'held', `${rule}: ${t}`);
});

test('every rule leaves its negative cases published', () => {
  for (const { rule, published } of RULES) for (const t of published) assert.equal(moderate(t), 'published', `${rule}: ${t}`);
});

test('clean and empty text are published', () => {
  assert.equal(moderate('Trimmed after earnings, stop was hit.'), 'published');
  assert.equal(moderate(''), 'published');
});

test('moderate only returns held or published', () => {
  for (const t of ['', 'ok', 'guarantee', 'DM me']) assert.ok(['held', 'published'].includes(moderate(t)));
});

test('multi-rule mixed-case text is held', () => {
  assert.equal(moderate('RISK-FREE, TO THE MOON, DM ME'), 'held');
});

test('repeated calls give the same result (no stateful regexes)', () => {
  assert.ok(HOLD.every((r) => !r.global && !r.sticky));
  for (const { held, published } of RULES) {
    for (const t of [...held, ...published]) {
      const first = moderate(t);
      assert.equal(moderate(t), first);
      for (let i = 0; i < 3; i++) assert.equal(moderate(t), first);
    }
  }
});

test('HOLD list is unchanged (snapshot guard)', () => {
  assert.deepEqual(HOLD.map(String), [
    '/guarantee/i', '/risk[- ]?free/i', "/can'?t lose/i", '/\\b100x\\b/i', '/to the moon/i',
    '/dm me|join my|link in bio|t\\.me\\/|discord\\.gg|whatsapp/i',
    '/\\b(buy|load up on) (now|before)\\b/i', '/financial advice/i',
  ]);
});
