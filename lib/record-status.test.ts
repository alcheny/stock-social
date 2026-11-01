// F-11 / D-12 / fix #4 (docs/features/logs/fixes-labels/plan.md §1, §6 items 9, 10, 12): the one status-line model.
// Pure: `now` is injected, nothing reads a clock, a schedule or a cache.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MARKS, MINORS, PROMO } from '../scripts/compliance.ts';
import { accountLabels, frozenAt, idleSince, IDLE_DAYS, segments, statusParts, type StatusConnection, type StatusFacts, type Part } from './record-status.ts';
import { connectedLine, STATUS_LINE } from './copy.ts';
import { dateText, relativeText } from './date-text.ts';

const NOW = new Date('2026-11-01T12:00:00Z');
const DAY = 86_400_000, HOUR = 3_600_000;
const ago = (ms: number) => new Date(NOW.getTime() - ms);
const acct = (id: string, extra: Partial<StatusConnection['accounts'][number]> = {}) => ({ id, isPaper: false, removedAt: null, institution: 'Fake Brokerage', ...extra });
const conn = (id: number, accounts: StatusConnection['accounts'], extra: Partial<StatusConnection> = {}): StatusConnection =>
  ({ id, consentAt: ago(60 * DAY), disconnectedAt: null, institution: 'Fake Brokerage', accounts, ...extra });
const facts = (extra: Partial<StatusFacts> = {}): StatusFacts => ({
  source: 'broker', state: 'connected', firstEntry: new Date('2025-03-04T15:00:00Z'), lastClose: ago(3 * DAY), lastSyncedAt: ago(2 * HOUR),
  brokers: ['Fake Brokerage'], accounts: 1, connections: [conn(1, [acct('a1')])], ...extra,
});
const text = (ps: Part[]) => ps.map((p) => p.text).join(' · ');
const all = (l: ReturnType<typeof statusParts>) => [l.line1, l.line2, l.accounts, l.card].map(text).join(' | ');

test('dateText: "Mon D" in now\'s UTC year, the year otherwise and always for images; UTC edges; same text as asOfDay', async () => {
  const { asOfDay } = await import('./copy.ts');
  assert.equal(dateText(new Date('2026-05-30T10:00:00Z'), NOW), 'May 30');
  assert.equal(dateText(new Date('2020-05-30T10:00:00Z'), NOW), 'May 30, 2020');
  assert.equal(dateText(new Date('2026-05-30T10:00:00Z'), NOW, { year: 'always' }), 'May 30, 2026');
  assert.equal(dateText(new Date('2025-12-31T23:30:00Z'), NOW), 'Dec 31, 2025');
  assert.equal(dateText(new Date('2026-01-01T00:30:00Z'), NOW), 'Jan 1');
  for (const d of ['2026-05-30T10:00:00Z', '2020-05-30T10:00:00Z', '2025-12-31T23:30:00Z']) assert.equal(dateText(new Date(d), NOW), asOfDay(new Date(d), NOW));
});

test('relativeText boundaries; a future time is never "in N"', () => {
  assert.equal(relativeText(ago(59 * 60_000), NOW), 'less than an hour ago');
  assert.equal(relativeText(new Date(NOW.getTime() + HOUR), NOW), 'less than an hour ago');
  assert.equal(relativeText(ago(HOUR), NOW), '1 hour ago');
  assert.equal(relativeText(ago(23 * HOUR), NOW), '23 hours ago');
  assert.equal(relativeText(ago(DAY), NOW), 'yesterday');
  assert.equal(relativeText(ago(2 * DAY), NOW), '2 days ago');
  assert.equal(relativeText(ago(29 * DAY), NOW), '29 days ago');
  assert.equal(relativeText(ago(30 * DAY), NOW), '4 weeks ago');
  assert.equal(relativeText(ago(84 * DAY), NOW), '12 weeks ago');
  assert.equal(relativeText(ago(91 * DAY), NOW), '3 months ago');
});

test('live, no connection disconnected: line1 is today\'s connectedLine call exactly; line2 "Last close ‹date› · updated ‹relative›"', () => {
  const f = facts({ brokers: ['Fake Brokerage'], accounts: 3 });
  const l = statusParts(f, NOW, 'live');
  assert.equal(l.show, true);
  assert.equal(text(l.line1), `Record since Mar 4, 2025 · ${connectedLine(['Fake Brokerage'], 3)}`);
  assert.equal(text(l.line1), 'Record since Mar 4, 2025 · Connected: Fake Brokerage (3 accounts)');
  assert.equal(text(l.line2), `Last close ${dateText(ago(3 * DAY), NOW)} · updated 2 hours ago`);
  // Under a minute: "updated just now" (design system R3).
  assert.equal(text(statusParts(facts({ lastSyncedAt: ago(30_000) }), NOW, 'live').line2).split(' · ')[1], 'updated just now');
  assert.equal(l.frozen, null);
  assert.equal(l.idle, false);
  assert.deepEqual(l.card, []); // the feed card shows nothing for a live, fresh record
  assert.deepEqual(l.accounts, []); // one account: no "Account 1 of 1"
});

test('frozen (every connection disconnected): "Disconnected ‹date› · record frozen", line2 = last close only; frozen wins over idle even 40 days stale', () => {
  const d1 = ago(40 * DAY), d2 = ago(35 * DAY);
  const f = facts({ lastSyncedAt: ago(41 * DAY), connections: [conn(1, [acct('a1')], { disconnectedAt: d1 }), conn(2, [acct('a2')], { disconnectedAt: d2 })] });
  assert.deepEqual(frozenAt(f.connections), d2);
  assert.equal(idleSince(f, NOW), null);
  for (const mode of ['live', 'static'] as const) {
    const l = statusParts(f, NOW, mode);
    const s = all(l);
    assert.equal(l.show, true);
    assert.deepEqual(l.frozen, d2);
    assert.equal(l.idle, false);
    assert.match(text(l.line1), new RegExp(`Disconnected ${dateText(d2, NOW, { year: 'always' })} · record frozen$`)); // ‹Mon D, YYYY›
    assert.equal(text(l.line2), STATUS_LINE.lastClose(dateText(f.lastClose!, NOW, { year: mode === 'static' ? 'always' : 'auto' })));
    assert.doesNotMatch(s, /Connected:/);
    assert.doesNotMatch(s, /updated/);
    assert.doesNotMatch(s, /not updated since/i);
    assert.equal(text(l.card), text([l.line1[1]])); // the feed card shows the frozen part
  }
});

test('partial: two connections, one disconnected → live-only connectedLine plus "‹inst› disconnected ‹date›"', () => {
  const d = ago(5 * DAY);
  const f = facts({ accounts: 2, connections: [conn(1, [acct('a1')]), conn(2, [acct('a2')], { disconnectedAt: d })] });
  const l = statusParts(f, NOW, 'live');
  assert.equal(l.frozen, null);
  assert.equal(text(l.line1), `Record since Mar 4, 2025 · Connected: Fake Brokerage (1 account) · Fake Brokerage disconnected ${dateText(d, NOW, { year: 'always' })}`);
  assert.match(text(l.line2), /updated/); // still synced through the live connection
  assert.deepEqual(l.card, []);
});

test('idle (no successful sync for 30 days): line2 "Last close ‹date› · not updated since ‹Mon D, YYYY›", a fact with no verdict; the feed card shows it', () => {
  const ref = ago(31 * DAY);
  const f = facts({ lastSyncedAt: ref });
  const l = statusParts(f, NOW, 'live');
  assert.equal(l.idle, true);
  // QA round 2 (N8): one date form per line, so the last close carries the year beside the idle date.
  assert.equal(text(l.line2), `Last close ${dateText(f.lastClose!, NOW, { year: 'always' })} · not updated since ${dateText(ref, NOW, { year: 'always' })}`);
  assert.doesNotMatch(all(l), /\b(inactive|stale|abandoned|dead|quit|stopped|warning|unreliable)\b/i);
  assert.equal(text(statusParts(f, NOW, 'static').card), `Not updated since ${dateText(ref, NOW, { year: 'always' })}`);
});

test('idleSince: per record, from last_synced_at or else the earliest live consent; 30 days exactly is idle; 29 d 23 h is not', () => {
  assert.equal(IDLE_DAYS, 30);
  const c = (consentDaysAgo: number) => [conn(1, [acct('a1')], { consentAt: ago(consentDaysAgo * DAY) })];
  assert.equal(idleSince(facts({ lastSyncedAt: null, connections: c(2) }), NOW), null); // right after connecting: not idle
  assert.deepEqual(idleSince(facts({ lastSyncedAt: null, connections: c(31) }), NOW), ago(31 * DAY));
  assert.equal(idleSince(facts({ lastSyncedAt: ago(30 * DAY - HOUR) }), NOW), null);
  assert.deepEqual(idleSince(facts({ lastSyncedAt: ago(30 * DAY) }), NOW), ago(30 * DAY));
  // The record's last sync, not a connection's: a fresh sync makes the record not idle whatever the consent dates.
  assert.equal(idleSince(facts({ lastSyncedAt: ago(DAY), connections: [conn(1, [acct('a')], { consentAt: ago(400 * DAY) }), conn(2, [acct('b')], { consentAt: ago(90 * DAY) })] }), NOW), null);
  // The earliest live consent; a disconnected connection's consent is not a live one.
  assert.deepEqual(idleSince(facts({ lastSyncedAt: null, connections: [conn(1, [acct('a')], { consentAt: ago(90 * DAY), disconnectedAt: ago(80 * DAY) }), conn(2, [acct('b')], { consentAt: ago(40 * DAY) })] }), NOW), ago(40 * DAY));
});

test('a failed sync (last_synced_at unchanged) leaves line2 unchanged; the model never reads the clock, a schedule or a cron setting', () => {
  const f = facts();
  const before = statusParts(f, NOW, 'live');
  const afterFailed = statusParts({ ...f }, NOW, 'live'); // a failed sync writes nothing: the same facts
  assert.deepEqual(afterFailed.line2, before.line2);
  const src = readFileSync(new URL('./record-status.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /Date\.now\(|new Date\(\)|cron|schedule|ROUND_MS|process\.env/i);
});

test('accountLabels: real accounts of consented connections in link order; paper accounts never numbered; none for a single account', () => {
  const two = [conn(1, [acct('a1'), acct('p1', { isPaper: true })]), conn(2, [acct('a2'), acct('a1')])];
  assert.deepEqual([...accountLabels(two)], [['a1', 'Account 1 of 2'], ['a2', 'Account 2 of 2']]);
  assert.equal(accountLabels([conn(1, [acct('a1'), acct('p1', { isPaper: true })])]).size, 0);
});

test('two accounts, one removed: "Account 1 of 2 · ‹inst›", "Account 2 of 2 removed ‹Mon D, YYYY›" (QA round 2 N8); a lone removed account says "Account removed ‹Mon D, YYYY›"', () => {
  const r = ago(4 * DAY);
  const l = statusParts(facts({ accounts: 2, connections: [conn(1, [acct('a1'), acct('a2', { removedAt: r })])] }), NOW, 'live');
  assert.deepEqual(l.accounts.map((p) => p.text), ['Account 1 of 2 · Fake Brokerage', `Account 2 of 2 removed ${dateText(r, NOW, { year: 'always' })}`]);
  const one = statusParts(facts({ connections: [conn(1, [acct('a1', { removedAt: r }), acct('p', { isPaper: true })])] }), NOW, 'live');
  assert.deepEqual(one.accounts.map((p) => p.text), [`Account removed ${dateText(r, NOW, { year: 'always' })}`]);
});

test('demo: "Record since ‹date› · Demo data", no line2, no accounts; importing, failed, filing and none: no line', () => {
  const d = statusParts(facts({ source: 'demo', connections: [] }), NOW, 'live');
  assert.equal(d.show, true);
  assert.equal(text(d.line1), 'Record since Mar 4, 2025 · Demo data');
  assert.deepEqual([d.line2, d.accounts, d.card], [[], [], []]);
  for (const st of ['importing', 'failed'] as const) assert.equal(statusParts(facts({ state: st }), NOW, 'live').show, false, st);
  for (const source of ['filing', 'none'] as const) assert.equal(statusParts(facts({ source }), NOW, 'live').show, false, source);
  assert.equal(statusParts(facts({ firstEntry: null, lastClose: null }), NOW, 'live').show, false); // no closes: no line, as today
});

test('static mode (images, cached renders): no relative time, no "ago", every date carries its year', () => {
  const cases = [facts(), facts({ lastSyncedAt: ago(31 * DAY) }), facts({ connections: [conn(1, [acct('a')], { disconnectedAt: ago(DAY) })] }),
    facts({ accounts: 2, connections: [conn(1, [acct('a1'), acct('a2', { removedAt: ago(DAY) })])] })];
  for (const f of cases) {
    const l = statusParts(f, NOW, 'static');
    for (const p of [...l.line1, ...l.line2, ...l.accounts, ...l.card]) {
      assert.equal(p.time?.rel, undefined, p.text);
      assert.doesNotMatch(p.text, /\bago\b|yesterday|less than/, p.text);
      if (p.time) assert.match(p.time.abs, /, \d{4}$/, p.text);
    }
  }
});

test('segments: every dated part renders its date in a time segment with an ISO datetime; a relative time carries its absolute date (title) and instant (datetime)', () => {
  const l = statusParts(facts(), NOW, 'live');
  const segs = segments(l.line2);
  const times = segs.filter((s) => s.iso);
  assert.equal(times.length, 2);
  for (const p of l.line2) {
    const shown = p.time!.rel ?? p.time!.abs;
    assert.ok(times.some((s) => s.text === shown && s.iso === p.time!.iso && (p.time!.rel ? s.title === p.time!.abs : s.title === undefined)), shown);
  }
  assert.equal(segs.map((s) => s.text).join(''), text(l.line2)); // the words read the same as the model
  assert.ok(times.some((s) => s.text === '2 hours ago' && s.title === 'Nov 1'));
  assert.deepEqual(segments([]), []);
});

test('every status string passes PROMO, the banned list and the marks list, and says nothing about completeness', () => {
  const BANNED = [/\bendorse[sd]?\b/i, /\brecommend(ed|s|ation)?\b/i, /\bguarantee[sd]?\b/i, /\bsecure\b/i, /\bsafe\b/i];
  const MARK_RE = new RegExp(`\\b(${MARKS.map((m) => m.replace(/ /g, '[\\s-]?')).join('|')})\\b`, 'i');
  const MINORS_RE = new RegExp(`\\b(${MINORS.map((m) => m.replace(/ /g, '\\s')).join('|')})\\b`, 'i');
  const COMPLETE = [/\b(every|complete|whole record|full record)\b/i, /\ball (trades|stocks|others)\b/i];
  const strings = Object.values(STATUS_LINE).map((v) => (typeof v === 'function' ? (v as (...a: unknown[]) => string)('x', 'y') : v));
  const rendered = [facts(), facts({ lastSyncedAt: ago(40 * DAY) }), facts({ connections: [conn(1, [acct('a')], { disconnectedAt: ago(DAY) })] }),
    facts({ accounts: 2, connections: [conn(1, [acct('a1')]), conn(2, [acct('a2', { removedAt: ago(DAY) })], { disconnectedAt: ago(DAY) })] })]
    .flatMap((f) => (['live', 'static'] as const).map((m) => all(statusParts(f, NOW, m))));
  for (const s of [...strings, ...rendered]) {
    for (const re of [...PROMO, ...BANNED, ...COMPLETE]) assert.doesNotMatch(s, re, s);
    assert.doesNotMatch(s, MARK_RE, s);
    assert.doesNotMatch(s, MINORS_RE, s);
  }
});

test('feed card and pane segments: the card only for a frozen or idle record; the pane is line 1 without "Record since" then line 2; both static', async () => {
  const { cardSegments, paneSegments } = await import('./record-status.ts');
  const join = (s?: { text: string }[]) => s?.map((x) => x.text).join('');
  assert.equal(cardSegments(facts(), NOW), undefined);
  assert.equal(cardSegments(undefined, NOW), undefined);
  assert.equal(join(cardSegments(facts({ connections: [conn(1, [acct('a')], { disconnectedAt: ago(DAY) })] }), NOW)), `Disconnected ${dateText(ago(DAY), NOW, { year: 'always' })} · record frozen`);
  assert.equal(join(cardSegments(facts({ lastSyncedAt: ago(40 * DAY) }), NOW)), `Not updated since ${dateText(ago(40 * DAY), NOW, { year: 'always' })}`);
  const pane = join(paneSegments(facts(), NOW))!;
  assert.equal(pane, `Connected: Fake Brokerage (1 account) · Last close ${dateText(ago(3 * DAY), NOW, { year: 'always' })} · updated ${dateText(ago(2 * HOUR), NOW, { year: 'always' })}`);
  assert.doesNotMatch(pane, /Record since|ago/);
  assert.equal(join(paneSegments(facts({ source: 'demo', connections: [] }), NOW)), 'Demo data');
  assert.equal(paneSegments(facts({ state: 'importing' }), NOW), undefined);
});

test('trade and month pages: line 1 then line 2, live; their images: the frozen line only, with the year, never relative', async () => {
  const { recordSegments, imageFrozenText } = await import('./record-status.ts');
  const join = (s?: { text: string }[]) => s?.map((x) => x.text).join('');
  assert.equal(join(recordSegments(facts(), NOW)), `Record since Mar 4, 2025 · Connected: Fake Brokerage (1 account) · Last close ${dateText(ago(3 * DAY), NOW)} · updated 2 hours ago`);
  const d = new Date('2026-10-20T09:00:00Z');
  const frozen = facts({ connections: [conn(1, [acct('a')], { disconnectedAt: d })] });
  assert.match(join(recordSegments(frozen, NOW))!, /^Record since Mar 4, 2025 · Disconnected Oct 20, 2026 · record frozen · Last close /);
  assert.doesNotMatch(join(recordSegments(frozen, NOW))!, /Connected:|updated/);
  assert.equal(recordSegments(facts({ state: 'failed' }), NOW), undefined);
  assert.equal(recordSegments(null, NOW), undefined);
  assert.equal(imageFrozenText(frozen, NOW), 'Disconnected Oct 20, 2026 · record frozen');
  assert.equal(imageFrozenText(facts(), NOW), null);
  assert.equal(imageFrozenText(facts({ lastSyncedAt: ago(40 * DAY) }), NOW), null); // idle is not drawn on images
});
