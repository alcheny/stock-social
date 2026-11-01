// F-13: the first-visit line, the SW-1 hint and the nav label are verbatim (D27, SW-1); fix #9: the Verified badge's
// title and the footer's Verified sentence are one constant (POLICY F3a). Each string is walked here (not in allCopy()).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MARKS, MINORS, PROMO } from '../scripts/compliance.ts';
import { FIRST_VISIT, FOOTER, NAV, VERIFIED_MEANING, verifiedMeansFooter } from './copy.ts';

const MARK_RE = new RegExp(`\\b(${MARKS.map((m) => m.replace(/ /g, '[\\s-]?')).join('|')})\\b`, 'i');
const MINORS_RE = new RegExp(`\\b(${MINORS.map((m) => m.replace(/ /g, '\\s')).join('|')})\\b`, 'i');
// Committee F3: word boundaries.
const WORDS = /\b(every|all|full record|whole record|signals?|picks?|buy|sell|hold|advice)\b/i;

test('F-13 copy is verbatim', () => {
  assert.equal(FIRST_VISIT.line, 'Closed trades imported read-only from connected broker accounts. Losses included.');
  assert.equal(FIRST_VISIT.hint, 'Swipe ← for profile');
  assert.equal(FIRST_VISIT.how, `${FOOTER.how} →`);
  assert.equal(FIRST_VISIT.how, 'How records are calculated →');
  assert.equal(FIRST_VISIT.dismiss, 'Dismiss this note');
  assert.equal(FIRST_VISIT.demo, 'Demo records are marked Demo.');
  assert.equal(NAV.stocks, 'Trades by stock');
});

test('fix #9: the Verified badge title is the footer\'s F3a definition, one constant', () => {
  assert.equal(VERIFIED_MEANING, 'Imported read-only from the trader’s broker. It doesn’t verify identity or imply endorsement.');
  assert.equal(verifiedMeansFooter(), '“Verified” means imported read-only from the trader’s broker. It doesn’t verify identity or imply endorsement.');
  assert.ok(verifiedMeansFooter().endsWith(VERIFIED_MEANING.slice(1)));
  assert.doesNotMatch(VERIFIED_MEANING, /cannot be edited/i);
});

test('F-13 and fix #9 strings pass PROMO, the marks, the minors and the word list', () => {
  const all = [...Object.values(FIRST_VISIT), ...Object.values(NAV), VERIFIED_MEANING, verifiedMeansFooter()];
  for (const s of all) {
    for (const re of PROMO) assert.doesNotMatch(s, re, s);
    assert.doesNotMatch(s, MARK_RE, s);
    assert.doesNotMatch(s, MINORS_RE, s);
    assert.doesNotMatch(s, WORDS, s);
  }
  // The word check uses word boundaries (F3): "Losses" or "small" never trip "sell" or "all".
  assert.doesNotMatch('Losses included, small', WORDS);
  assert.match('all trades', WORDS);
});
