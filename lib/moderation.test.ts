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

// ---- F4-18 (cycle 4, C4-19): bare domains on common country-code endings, payment cashtags and solicitation
// paraphrases are held (F-9: "Hold … links and domains"); plain "$" amounts and "my bio" in other senses publish.
// Every name and handle below is fictional.
const F4_18_HELD: [string, string][] = [
  // the five probes
  ['More setups at tradedesk.fr', 'link'],
  ['Tips welcome: $sample_trader on the payment app', 'contact details'],
  ['Check my bio for the link', 'promotion'],
  ['Follow me for more calls', 'promotion'],
  ['I run a trading room, ask me how to get in', 'promotion'],
  // more country-code endings, bare and second-level
  ['see example.ca', 'link'], ['example.com.au/join', 'link'], ['example.co.jp', 'link'], ['setups on example.de', 'link'],
  ['example.nl.', 'link'], ['EXAMPLE.SG', 'link'], ['example.co.in', 'link'], ['example.it/room', 'link'], ['example.com.br', 'link'],
  // payment cashtags
  ['Send tips to $sample_trader', 'contact details'], ['cashtag $SampleTrader', 'contact details'], ['tip jar: $abc', 'contact details'],
  ['$sampletrader for tips', 'contact details'], ['my payment app is $sample99', 'contact details'], ['donations welcome $abcd', 'contact details'],
  // solicitation paraphrases
  ['See my bio.', 'promotion'], ['link is in my bio', 'promotion'], ['details in bio', 'promotion'], ['My bio has the link', 'promotion'],
  ['Follow for more plays', 'promotion'], ['follow us for daily alerts', 'promotion'], ['We host a private trading group', 'promotion'],
  ['Ask me about joining', 'promotion'], ['ask us how to get in', 'promotion'],
];
const F4_18_PUBLISHED: string[] = [
  // plain "$" amounts and tickers
  'Sold for $1,200 after the gap.', 'Risked $500 on this one, stop at $42.', 'A $5 stock that ran to $7.', 'Paid $40 a share, tips from nobody.',
  'Took $XYZ off at support.', 'Sent $2,000 into the account before the open.', 'Donated $500 of shares last year, unrelated.',
  'Pay attention to $XYZ volume.', 'The app crashed at $12.40 so I sold late.', '$XYZ for the dividend, $ABC for growth.',
  // "my bio" in other senses
  'I updated my bio after the drawdown.', 'My bio says I swing trade; this one was a day trade.', 'Rewrote my bio to mention the stop rule.',
  // ordinary text near the new patterns
  'Waited for follow-through for the calls to pay.', 'I follow the trend for entries.', 'Ask me how I sized it next time.',
  'I left a trading group last year.', 'Hard to know how to get in after a gap.', 'Followed the plan for the trade.',
  // tickers with exchange suffixes and abbreviations stay published
  'Bought XYZ.HK and ABC.TW on the dip.', 'BRK.B, U.S. rates, e.g. the 10-K.', 'Sold it. Is it over?', 'The plan.In hindsight early.',
  'ABC.MX ran with the peso.', 'Owned ABC.NZ and DEF.SA for a month.',
];

test('F4-18: country-code domains, payment cashtags and solicitation paraphrases are held with their label', async () => {
  const { moderateDetail } = await import('./moderation.ts');
  for (const [t, label] of F4_18_HELD) assert.deepEqual(moderateDetail(t), { status: 'held', rule: label }, t);
});

test('F4-18: plain "$" amounts, tickers and "my bio" in other senses publish', async () => {
  const { moderateDetail } = await import('./moderation.ts');
  for (const t of F4_18_PUBLISHED) assert.deepEqual(moderateDetail(t), { status: 'published', rule: null }, t);
});

test('F4-18: the new rules are version 4, so the start-up re-check holds version 3 notes on them', async () => {
  const { moderateDetail, MODERATION_VERSION } = await import('./moderation.ts');
  assert.equal(MODERATION_VERSION, 4);
  for (const [t] of F4_18_HELD.slice(0, 5)) {
    assert.equal(moderateDetail(t, { after: 3 }).status, 'held', t);
    assert.deepEqual(moderateDetail(t, { after: 4 }), { status: 'published', rule: null }, t);
  }
});
