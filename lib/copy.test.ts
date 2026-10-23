import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MARKS, MINORS, PROMO } from '../scripts/compliance.ts';
import { allCopy, imageTrust, recordCountText, RECORD_BODY, SHARE_CARD, shareCardText, CONSENT, HOW, LEGAL_PLACEHOLDER, RESULT, SETTINGS, SIGNIN, TRUST_NOTICE, VENDOR_SECURITY_URL } from './copy.ts';

const MARK_RE = new RegExp(`\\b(${MARKS.map((m) => m.replace(/ /g, '[\\s-]?')).join('|')})\\b`, 'i');
const MINORS_RE = new RegExp(`\\b(${MINORS.map((m) => m.replace(/ /g, '\\s')).join('|')})\\b`, 'i');
// F-1 acceptance: no "endorsed", "recommended", "guaranteed", "secure" as a bare promise, anywhere in the fixed strings.
const BANNED = [/\bendorse[sd]?\b/i, /\brecommend(ed|s|ation)?\b/i, /\bguarantee[sd]?\b/i, /\bsecure\b/i, /\baudit(ed)? (of|your|the) (record|trade)/i, /\bsafe\b/i];

test('every F-1 string passes the banned-claims list, the marks list and the promo list', () => {
  const all = allCopy();
  assert.ok(all.length > 60);
  for (const s of all) {
    for (const re of PROMO) assert.doesNotMatch(s, re, s);
    for (const re of BANNED) assert.doesNotMatch(s, re, s);
    assert.doesNotMatch(s, MARK_RE, s);
    assert.doesNotMatch(s, MINORS_RE, s);
  }
});

test('S1 and S2 copy is the UX lead\'s, verbatim', () => {
  assert.equal(SIGNIN.title, 'Publish your trades');
  assert.equal(SIGNIN.sub, 'Read-only. We can never place trades or move money.');
  assert.equal(SIGNIN.attestError, 'Confirm you are 18 or older to continue.');
  assert.equal(SIGNIN.linkSent, 'Check your email. The link works for 15 minutes.');
  assert.equal(SIGNIN.linkExpired, 'That link has expired. Send a new one?');
  assert.equal(TRUST_NOTICE.title, 'Before you connect');
  assert.equal(TRUST_NOTICE.lines.length, 4);
  assert.equal(TRUST_NOTICE.lines[0], 'Read-only. Stock Social can never place trades or move money.');
  assert.equal(TRUST_NOTICE.primary, 'Connect brokerage (read-only)');
  assert.match(TRUST_NOTICE.lines[2], /reports an independent audit of its security controls/);
  assert.match(VENDOR_SECURITY_URL, /^https:\/\//);
  assert.match(LEGAL_PLACEHOLDER.placeholder, /^Placeholder: the owner supplies the final text before launch\./);
});

test('PR-2a copy: the trust notice stays the vendor\'s own report of an audit of its controls; consent names the depth; results and settings are as written; /how says what Verified means and what is excluded', () => {
  assert.equal(TRUST_NOTICE.lines[2], 'SnapTrade reports an independent audit of its security controls.');
  assert.doesNotMatch(TRUST_NOTICE.lines.join(' '), /audit(ed)? (of )?(the |your |any )?(record|trade|app)/i);
  assert.deepEqual(CONSENT.lines(3, 1).slice(0, 3), ['Full trade history your broker provides', 'Every account under this login', '3 accounts found (1 simulated, not imported)']);
  assert.equal(CONSENT.lines(2, 0)[2], '2 accounts found');
  assert.equal(CONSENT.lines(1, 0)[2], '1 account found');
  // S7b and stale say what happened once pages were read; S7a (no link) still says nothing was saved.
  assert.equal(RESULT.failed, 'Your brokerage stopped the connection before the import finished.');
  assert.equal(RESULT.stale, 'Your brokerage stopped sending history before the import finished.');
  assert.doesNotMatch(`${RESULT.failed} ${RESULT.stale}`, /Nothing was saved|record is unchanged/);
  assert.equal(RESULT.notFound, 'Connection not found.');
  assert.equal(CONSENT.primary, 'Import my record');
  assert.equal(CONSENT.secondary, "Don't import");
  assert.equal(RESULT.declined, 'Import not started. Nothing is connected.');
  assert.equal(RESULT.none, 'No real brokerage account found.');
  assert.equal(RESULT.abandoned, 'Connection not completed. Nothing was saved.');
  assert.equal(SETTINGS.confirm, 'This cannot be undone.');
  assert.match(HOW.verified, /imported read-only from the trader.s broker/);
  assert.doesNotMatch(HOW.verified, /\bevery trade\b|\bany broker\b|\bcomplete\b/i);
  for (const word of ['Options', 'short sales', 'Transfers in', 'no recorded entry', 'not connected', 'paper']) assert.match(HOW.excluded.join(' '), new RegExp(word));
  assert.match(HOW.math.join(' '), /first in, first out/);
  assert.match(HOW.math.join(' '), /Only percentages/);
});

test('share card text per state (fix round 3): mirrors the profile; "Demo data" only for a demo profile; "Broker connected" only for a finished import with no closes; a failed import says so; a running import shows no stats', () => {
  const card = (state: 'importing' | 'connected' | 'failed' | 'none', o: { demo?: boolean; verified?: boolean; empty?: boolean } = {}) =>
    shareCardText({ state, demo: o.demo ?? false, verified: o.verified ?? !(o.empty ?? true), empty: o.empty ?? true });
  // A real trader with nothing consented (no link, pending, declined or expired all read `none`): no label, never Demo.
  assert.deepEqual(card('none'), { label: null, tone: 'muted', body: 'No closed trades yet', note: null });
  // Demo is only for source='demo' profiles, with or without trades.
  assert.deepEqual(card('none', { demo: true, empty: false, verified: false }), { label: 'Demo data', tone: 'muted', body: null, note: null });
  assert.equal(card('none', { demo: true }).label, 'Demo data');
  // Importing: no stats, no Verified, no "Broker connected", whether or not some trades already arrived.
  for (const empty of [true, false]) {
    const c = card('importing', { empty, verified: !empty });
    assert.deepEqual(c, { label: 'Importing record', tone: 'muted', body: 'Import in progress', note: 'Stats appear when the import finishes.' });
  }
  // Failed: the profile's wording, never "Broker connected" or Verified.
  assert.deepEqual(card('failed'), { label: 'Import did not finish', tone: 'warn', body: 'No closed trades yet', note: RECORD_BODY.failed });
  assert.deepEqual(card('failed', { empty: false }), { label: 'Import did not finish', tone: 'warn', body: null, note: RECORD_BODY.failed });
  // Fix round 4: a failed record never carries the Verified label, even when every trade is verified.
  assert.deepEqual(card('failed', { empty: false, verified: true }), { label: 'Import did not finish', tone: 'warn', body: null, note: RECORD_BODY.failed });
  // Connected: Verified with closes, "Broker connected" with none.
  assert.deepEqual(card('connected', { empty: false }), { label: '✓ Verified from broker', tone: 'ok', body: null, note: null });
  assert.deepEqual(card('connected'), { label: '✓ Broker connected', tone: 'ok', body: 'No closed trades yet', note: null });
  // "Broker connected" appears for no other state; "Demo data" for no non-demo profile.
  for (const st of ['importing', 'failed', 'none'] as const) for (const empty of [true, false]) {
    assert.notEqual(card(st, { empty }).label, SHARE_CARD.connected, st);
    assert.notEqual(card(st, { empty }).label, SHARE_CARD.demo, st);
  }
  assert.match(RECORD_BODY.failed, /did not finish/);
});

test('fix round 6 (TR-3, POLICY F3): the trade, month and story images follow the profile card per record state; no check-mark glyph', () => {
  const states = ['importing', 'connected', 'failed', 'none'] as const;
  for (const kind of ['trade', 'month', 'story'] as const) {
    const img = (state: typeof states[number], o: { demo?: boolean; verified?: boolean } = {}) => imageTrust(kind, { state, demo: o.demo ?? false, verified: o.verified ?? true, empty: false });
    // Failed: never Verified or "Imported read-only", the warning label and the incomplete line, stats still shown.
    assert.deepEqual(img('failed'), { label: 'Import did not finish', tone: 'warn', stats: true, note: RECORD_BODY.failed }, kind);
    // Importing: no whole-record stats line, never Verified.
    assert.deepEqual(img('importing'), { label: 'Importing record', tone: 'muted', stats: false, note: 'Stats appear when the import finishes.' }, kind);
    // A whole verified record: the verified wording without the check mark (the story keeps its own words).
    assert.deepEqual(img('connected'), { label: kind === 'story' ? 'Imported read-only from the broker' : 'Verified from broker', tone: 'ok', stats: true, note: null }, kind);
    // Demo: Demo data in every state, stats shown, no incomplete line.
    for (const st of states) assert.deepEqual(img(st, { demo: true, verified: false }), { label: 'Demo data', tone: 'muted', stats: true, note: null }, `${kind} ${st}`);
    for (const st of states) for (const demo of [true, false]) {
      const t = img(st, { demo, verified: !demo });
      assert.ok(!(t.label ?? '').includes('\u2713'), `${kind} ${st}`);
      if (st === 'failed' || st === 'importing' || demo) assert.doesNotMatch(t.label ?? '', /verified|imported read-only/i, `${kind} ${st} demo=${demo}`);
    }
  }
  // The profile card's label also loses the glyph; its other fields are shareCardText's.
  assert.equal(imageTrust('profile', { state: 'connected', demo: false, verified: true, empty: true }).label, 'Broker connected');
});

test('fix round 6: a link preview counts trades as verified only for a whole record from the broker', () => {
  const c = (state: 'importing' | 'connected' | 'failed' | 'none', o: { demo?: boolean; verified?: boolean; trades?: number } = {}) =>
    recordCountText({ state, demo: o.demo ?? false, verified: o.verified ?? true, trades: o.trades ?? 5 });
  assert.equal(c('connected'), '5 verified trades');
  assert.equal(c('connected', { trades: 1 }), '1 verified trade');
  assert.equal(c('failed'), '5 closed trades');
  assert.equal(c('importing'), '5 closed trades');
  for (const st of ['importing', 'connected', 'failed', 'none'] as const) assert.equal(c(st, { demo: true, verified: false, trades: 30 }), '30 demo trades');
  assert.equal(c('connected', { verified: false }), '5 closed trades');
  assert.equal(c('connected', { trades: 0 }), '0 closed trades');
});
