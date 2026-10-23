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
  // Committee fix (item 7): the history and accounts lines are one line; the count line follows it.
  assert.deepEqual(CONSENT.lines(3, 1).slice(0, 2), ['Full trade history your broker provides, from every account under this login', '3 accounts found (1 simulated, not imported)']);
  assert.equal(CONSENT.lines(2, 0)[1], '2 accounts found');
  assert.equal(CONSENT.lines(1, 0)[1], '1 account found');
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

test('committee fix (item 7): consent has no lead line, one scope line, and a deadline with no clock time or time zone', () => {
  assert.equal('linked' in CONSENT, false);
  const lines = CONSENT.lines(2, 0);
  assert.equal(lines.length, 5);
  assert.equal(lines.filter((l) => /trade history|every account/i.test(l)).length, 1);
  assert.equal(CONSENT.deadline, 'Decide within 24 hours, or this link is removed automatically.');
  assert.doesNotMatch(CONSENT.deadline, /UTC|GMT|AM|PM|\d:\d/);
  assert.equal(TRUST_NOTICE.profileLink, 'Your profile');
});

test('committee fix (item 8): the importing line shows only while no trades are listed', async () => {
  const { recordBodyCopy } = await import('./copy.ts');
  assert.equal(recordBodyCopy('importing', 0), RECORD_BODY.importing);
  for (const n of [1, 5]) for (const s of ['importing', 'connected', 'failed', 'none'] as const) assert.equal(recordBodyCopy(s, n), null, `${s} ${n}`);
  assert.equal(recordBodyCopy('connected', 0), RECORD_BODY.connected);
  assert.equal(recordBodyCopy('none', 0), RECORD_BODY.none);
});

test('reviewer fix (TR-3): the trade and month pages and their previews follow the profile record-state rule', async () => {
  const { wholeRecordView, wholeRecordPreview, WHOLE_RECORD } = await import('./copy.ts');
  // Importing: no whole-record stats, the importing line; failed: the stats with the incomplete line.
  assert.deepEqual(wholeRecordView({ state: 'importing', demo: false }), { stats: false, line: WHOLE_RECORD.importing, tone: 'muted' });
  assert.deepEqual(wholeRecordView({ state: 'failed', demo: false }), { stats: true, line: RECORD_BODY.failed, tone: 'warn' });
  for (const st of ['connected', 'none'] as const) assert.deepEqual(wholeRecordView({ state: st, demo: false }), { stats: true, line: null, tone: null });
  for (const st of ['importing', 'connected', 'failed', 'none'] as const) {
    assert.deepEqual(wholeRecordView({ state: st, demo: true }), { stats: true, line: null, tone: null });
    // The images use the same rule.
    assert.equal(imageTrust('trade', { state: st, demo: false, verified: true, empty: false }).stats, wholeRecordView({ state: st, demo: false }).stats);
  }
  const p = (state: 'importing' | 'connected' | 'failed' | 'none', demo = false) => wholeRecordPreview({ state, demo, verified: !demo, trades: 4 }, '50% win rate · +1.0% avg return');
  assert.equal(p('importing'), '4 closed trades so far · Import in progress. Stats appear when the import finishes.');
  assert.doesNotMatch(p('importing'), /win rate|avg return|verified/i);
  assert.equal(p('failed'), `${RECORD_BODY.failed} 4 closed trades · 50% win rate · +1.0% avg return`);
  assert.equal(p('connected'), '4 verified trades · 50% win rate · +1.0% avg return');
  assert.equal(p('importing', true), '4 demo trades · 50% win rate · +1.0% avg return');
});

test('reviewer fix (POLICY F3a, A1): the profile card alt text follows the record state, Verified only for a whole verified record', async () => {
  const { profileCardAlt } = await import('./copy.ts');
  const alt = (state: 'importing' | 'connected' | 'failed' | 'none', o: { demo?: boolean; verified?: boolean; empty?: boolean } = {}) =>
    profileCardAlt('maya', shareCardText({ state, demo: o.demo ?? false, verified: o.verified ?? true, empty: o.empty ?? false }));
  assert.equal(alt('connected'), 'Trading record card for @maya on Stock Social: Verified from broker');
  assert.equal(alt('importing'), 'Trading record card for @maya on Stock Social: Importing record');
  assert.equal(alt('failed'), 'Trading record card for @maya on Stock Social: Import did not finish');
  assert.equal(alt('connected', { empty: true }), 'Trading record card for @maya on Stock Social: Broker connected');
  assert.equal(alt('none', { verified: false }), 'Trading record card for @maya on Stock Social');
  for (const st of ['importing', 'connected', 'failed', 'none'] as const) {
    assert.equal(alt(st, { demo: true, verified: false }), 'Trading record card for @maya on Stock Social: Demo data');
    assert.ok(!alt(st, { demo: true, verified: false }).includes('✓'));
  }
  for (const st of ['importing', 'failed'] as const) assert.doesNotMatch(alt(st), /verified/i);
});

test('PR-2b copy (S3, S5, S6, S7a): the UX lead\'s strings, in the banned-list walk', async () => {
  const { PORTAL, profileDescription, connectedLine } = await import('./copy.ts');
  assert.equal(PORTAL.title, 'Connect your brokerage');
  assert.equal(PORTAL.opening, 'Opening…');
  assert.equal(PORTAL.slow, 'Taking longer than usual.');
  assert.equal(PORTAL.newPage, 'Open in a new page instead');
  assert.equal(PORTAL.close, 'Close');
  assert.equal(RESULT.continueNewPage, 'Continue in a new page');
  assert.equal(RESULT.notNow, 'Not now');
  // S6 expired: a short heading, the rest as body text.
  assert.equal(RESULT.expiredPrefix, 'The time to decide ran out.');
  assert.equal(RESULT.declined, 'Import not started. Nothing is connected.');
  assert.equal(RECORD_BODY.stillSending, 'Your broker is still sending history. You can leave; the import continues.');
  assert.equal(RECORD_BODY.finished, 'Import finished.');
  // Fix round 2 (business lead 2): the activity rows are "activities", never "trades" (one noun per count).
  assert.equal(RECORD_BODY.imported(0), '0 activities imported');
  assert.equal(RECORD_BODY.imported(1), '1 activity imported');
  const all = allCopy();
  for (const s of [PORTAL.title, PORTAL.opening, PORTAL.slow, PORTAL.newPage, RESULT.continueNewPage, RECORD_BODY.stillSending, RECORD_BODY.imported('x' as never)]) assert.ok(all.includes(s), s); // the walk calls functions with 'x'
  // "Connected:" names the institution the vendor returned, never the placeholder "broker".
  assert.equal(connectedLine(['Fake Brokerage'], 1), 'Connected: Fake Brokerage (1 account)');
  assert.equal(connectedLine(['A Bank', 'B Bank'], 3), 'Connected: A Bank, B Bank (3 accounts)');
  assert.equal(connectedLine([], 2), 'Connected: your broker (2 accounts)');
  assert.equal(connectedLine(['', '  '], 1), 'Connected: your broker (1 account)');
  // The profile unfurl: no stats line when there are no closes (no "0 closed trades · % win rate").
  const d = (state: 'importing' | 'connected' | 'failed' | 'none', trades: number, demo = false) =>
    profileDescription({ state, demo, verified: trades > 0 && !demo, trades, stats: '60% win rate · +1.0% avg return · Evidence: too early' });
  assert.equal(d('connected', 0), RECORD_BODY.connected);
  assert.equal(d('none', 0), RECORD_BODY.none);
  assert.equal(d('failed', 0), `${RECORD_BODY.failed} ${SHARE_CARD.empty}.`);
  assert.equal(d('importing', 0), RECORD_BODY.banner(0, false));
  assert.equal(d('importing', 4), RECORD_BODY.banner(4, false));
  assert.equal(d('importing', 4), 'Importing this record · 4 closed trades so far'); // fix round 2: the preview is public, never "your"
  for (const st of ['connected', 'none', 'failed'] as const) assert.doesNotMatch(d(st, 0), /win rate|avg return|% |\b0 (closed|verified) trades/, st);
  assert.doesNotMatch(d('importing', 0), /win rate|avg return/);
  assert.equal(d('connected', 5), '5 verified trades · 60% win rate · +1.0% avg return · Evidence: too early');
  assert.equal(d('failed', 5), `${RECORD_BODY.failed} 5 closed trades · 60% win rate · +1.0% avg return · Evidence: too early`);
  assert.equal(d('none', 30, true), '30 demo trades · 60% win rate · +1.0% avg return · Evidence: too early');
});

test('fix round 2 (business lead 2, 3; UX lead 1; engineer Lows): one noun per count, "your" only for the owner, the portal\'s quiet line, the explained fallback, the signed-out and rate-limit lines', async () => {
  const { PORTAL, profileDescription } = await import('./copy.ts');
  // One noun per count: "trades" counts closed trades only; no S5 activity string says "trade".
  for (const n of [0, 1, 2, 60]) assert.doesNotMatch(RECORD_BODY.imported(n), /trade/i, String(n));
  assert.equal(RECORD_BODY.imported(60), '60 activities imported');
  for (const owner of [true, false]) for (const n of [0, 1, 30]) assert.match(RECORD_BODY.banner(n, owner), new RegExp(`· ${n} closed trades? so far$`));
  // "your" only for the owner; the visitor line and the link preview read "this record".
  assert.equal(RECORD_BODY.banner(0, true), 'Importing your record · 0 closed trades so far');
  assert.equal(RECORD_BODY.banner(0, false), 'Importing this record · 0 closed trades so far');
  for (const trades of [0, 1, 7]) {
    const d = profileDescription({ state: 'importing', demo: false, verified: false, trades, stats: 'x' });
    assert.doesNotMatch(d, /\byour\b/i, d);
    assert.match(d, /^Importing this record/);
  }
  assert.equal(PORTAL.blank, 'Page blank? Open it in a new page.');
  assert.equal(PORTAL.popupBlocked, "Your browser blocked the embedded window; continuing on the vendor's page.");
  assert.equal(RECORD_BODY.signedOut, 'Signed out in another tab.');
  assert.equal(RECORD_BODY.signInAgain, 'Sign in again');
  assert.equal(PORTAL.tooMany, 'Too many tries. Wait a few minutes, then try again.');
  const all = allCopy();
  for (const s of [PORTAL.blank, PORTAL.popupBlocked, PORTAL.continue, PORTAL.tooMany, RECORD_BODY.signedOut, RECORD_BODY.signInAgain]) assert.ok(all.includes(s), s);
});
