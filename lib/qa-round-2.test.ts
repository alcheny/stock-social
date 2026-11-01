// Fixes-labels QA round 2 (docs/features/logs/fixes-labels/qa-round-2.md, final fix round): the pure models and the
// source contracts behind N1, N3, N4, N6-N12 and B1/B2. The DOM checks (first screen at 360 and 320) are in
// e2e/fixes-labels.spec.ts; the database checks for N2 and N5 are in lib/sync-removed-again.test.ts and
// lib/idle-count.test.ts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cardSegments, glued, imageFrozenText, idleSince, NBSP, paneSegments, recordFrozen, recordRows, segments, statusParts, type StatusConnection, type StatusFacts, type Part } from './record-status.ts';
import { statusForOrNull } from './record-status-load.ts';
import { baselineKind, baselineLines } from './ticker.ts';
import { FIXES_LABELS as FL, STATUS_LINE as S } from './copy.ts';
import { dateText } from './date-text.ts';
import type { Confidence } from './trades.ts';

const NOW = new Date('2026-11-01T12:00:00Z');
const DAY = 86_400_000, HOUR = 3_600_000;
const ago = (ms: number) => new Date(NOW.getTime() - ms);
const src = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const acct = (id: string, removedAt: Date | null = null) => ({ id, isPaper: false, removedAt, institution: 'Fake Brokerage' });
const conn = (id: number, accounts: StatusConnection['accounts'], disconnectedAt: Date | null = null): StatusConnection =>
  ({ id, consentAt: ago(400 * DAY), disconnectedAt, institution: 'Fake Brokerage', accounts });
const facts = (extra: Partial<StatusFacts> = {}): StatusFacts => ({
  source: 'broker', state: 'connected', firstEntry: new Date('2026-01-05T15:00:00Z'), lastClose: ago(3 * DAY), lastSyncedAt: ago(3 * HOUR),
  brokers: ['Fake Brokerage'], accounts: 1, connections: [conn(1, [acct('a1')])], ...extra,
});
const text = (ps: Part[]) => ps.map((p) => p.text).join(' · ');
const join = (s?: { text: string }[]) => s?.map((x) => x.text).join('') ?? '';

test('N7: every live account removed → frozen at the latest removal, "No account connected since ‹date› · record frozen", on every surface; never Connected (0 accounts), "updated" or Disconnected', () => {
  const r1 = ago(10 * DAY), r2 = ago(4 * DAY);
  const cases: [string, StatusFacts, Date][] = [
    ['the only account removed', facts({ connections: [conn(1, [acct('a1', r1)])] }), r1],
    ['removed and idle', facts({ lastSyncedAt: ago(60 * DAY), connections: [conn(1, [acct('a1', ago(50 * DAY))])] }), ago(50 * DAY)],
    ['two connections, all accounts removed', facts({ accounts: 2, connections: [conn(1, [acct('a1', r1)]), conn(2, [acct('b1', r2)])] }), r2],
    ['one connection disconnected, the other\'s accounts removed', facts({ accounts: 2, connections: [conn(1, [acct('a1')], ago(20 * DAY)), conn(2, [acct('b1', r2)])] }), r2],
  ];
  for (const [label, f, at] of cases) {
    assert.deepEqual(recordFrozen(f.connections), { at, kind: 'removed' }, label);
    assert.equal(idleSince(f, NOW), null, label);
    const words = S.allRemoved(dateText(at, NOW, { year: 'always' }));
    for (const mode of ['live', 'static'] as const) {
      const l = statusParts(f, NOW, mode);
      assert.equal(l.frozen?.getTime(), at.getTime(), label);
      assert.equal(l.idle, false, label);
      assert.equal(l.line1[1].text, words, `${label} ${mode}`);
      assert.equal(text(l.line2), `Last close ${dateText(f.lastClose!, NOW, { year: mode === 'static' ? 'always' : 'auto' })}`, `${label} ${mode}: frozen wins, last close only`);
      assert.equal(text(l.card), words, label);
      const all = [l.line1, l.line2, l.card].map(text).join(' | ');
      assert.doesNotMatch(all, /Connected:|\(0 accounts?\)|updated|not updated since|Disconnected/, `${label} ${mode}: ${all}`);
    }
    // The same words on the pane, the feed card, the trade and month rows and the images.
    assert.match(join(paneSegments(f, NOW)), new RegExp(`^${words} · Last close `), label);
    assert.equal(join(cardSegments(f, NOW)), words, label);
    assert.equal(text(recordRows(f, NOW)![0]), `Record since Jan 5, 2026 · ${words}`, label);
    assert.equal(imageFrozenText(f, NOW), words, label);
  }
  // All connections disconnected keeps the Disconnected words; an account left keeps the live line.
  const d = ago(2 * DAY);
  assert.deepEqual(recordFrozen([conn(1, [acct('a1', r1)], d)]), { at: d, kind: 'disconnected' });
  assert.equal(imageFrozenText(facts({ connections: [conn(1, [acct('a1')], d)] }), NOW), S.frozen(dateText(d, NOW, { year: 'always' })));
  assert.equal(recordFrozen([conn(1, [acct('a1', r1), acct('a2')])]), null);
  assert.equal(statusParts(facts({ accounts: 2, connections: [conn(1, [acct('a1', r1), acct('a2')])] }), NOW, 'live').line1[1].text, 'Connected: Fake Brokerage (1 account)');
  // A live connection that lists no real account (only a simulated one, or none) is not frozen by removal.
  assert.equal(recordFrozen([conn(1, [])]), null);
  assert.equal(recordFrozen([conn(1, [{ ...acct('p1', r1), isPaper: true }])]), null);
});

test('N8: one date form per line: the year on every date of a line when any needs it, on none otherwise; static always has it', () => {
  // This year's close and sync: no year on line 2 (line 1 has the record date, with its year).
  const live = statusParts(facts(), NOW, 'live');
  assert.equal(text(live.line1), 'Record since Jan 5, 2026 · Connected: Fake Brokerage (1 account)');
  assert.equal(text(live.line2), `Last close ${dateText(ago(3 * DAY), NOW)} · updated 3 hours ago`);
  assert.equal(live.line2[1].time!.abs, 'Nov 1');
  // A close last year: the sync's date on that line carries the year too.
  const old = statusParts(facts({ lastClose: new Date('2025-12-20T15:00:00Z') }), NOW, 'live');
  assert.equal(old.line2[0].text, 'Last close Dec 20, 2025');
  assert.equal(old.line2[1].time!.abs, 'Nov 1, 2026');
  // Idle: the idle date is a record date (with the year), so the last close carries it as well.
  const idle = statusParts(facts({ lastSyncedAt: ago(40 * DAY), lastClose: ago(45 * DAY) }), NOW, 'live');
  assert.equal(text(idle.line2), `Last close ${dateText(ago(45 * DAY), NOW, { year: 'always' })} · not updated since ${dateText(ago(40 * DAY), NOW, { year: 'always' })}`);
  // Every line: either every date has a year or none does.
  const fixtures = [facts(), facts({ lastClose: new Date('2025-12-20T15:00:00Z') }), facts({ lastSyncedAt: ago(40 * DAY) }),
    facts({ accounts: 2, connections: [conn(1, [acct('a1')]), conn(2, [acct('b1')], ago(DAY))] })];
  for (const f of fixtures) {
    for (const mode of ['live', 'static'] as const) {
      const l = statusParts(f, NOW, mode);
      for (const line of [l.line1, l.line2]) {
        const abs = line.filter((p) => p.time).map((p) => /, \d{4}$/.test(p.time!.abs));
        assert.ok(abs.every((x) => x === abs[0]), `${mode}: ${text(line)}`);
        if (mode === 'static') assert.ok(abs.every(Boolean), text(line));
      }
    }
  }
});

test('N8: "Account 2 of 2 removed ‹date›" (no second "Account"); the trade and month status in two rows; each date glued to its word with no-break spaces', () => {
  const r = ago(4 * DAY);
  const l = statusParts(facts({ accounts: 2, connections: [conn(1, [acct('a1'), acct('a2', r)])] }), NOW, 'live');
  assert.deepEqual(l.accounts.map((p) => p.text), ['Account 1 of 2 · Fake Brokerage', `Account 2 of 2 removed ${dateText(r, NOW, { year: 'always' })}`]);
  assert.equal(S.removedNumbered('Account 2 of 2', 'Oct 28, 2026'), 'Account 2 of 2 removed Oct 28, 2026');
  // Two rows, like the profile's line 1 and line 2.
  const rows = recordRows(facts(), NOW)!;
  assert.equal(rows.length, 2);
  assert.equal(text(rows[0]), 'Record since Jan 5, 2026 · Connected: Fake Brokerage (1 account)');
  assert.match(text(rows[1]), /^Last close .+ · updated 3 hours ago$/);
  assert.equal(recordRows(facts({ source: 'demo', connections: [] }), NOW)!.length, 1);
  assert.equal(recordRows(facts({ state: 'importing' }), NOW), undefined);
  // Glued: the date keeps its word ("Disconnected Oct 30, 2026", "removed Oct 28, 2026", "updated 3 hours ago").
  const frozen = statusParts(facts({ connections: [conn(1, [acct('a1')], new Date('2026-10-30T09:00:00Z'))] }), NOW, 'live');
  const g = glued(segments(frozen.line1));
  assert.equal(g.map((s) => s.text).join(''), `Record since${NBSP}Jan${NBSP}5,${NBSP}2026 · Disconnected${NBSP}Oct${NBSP}30,${NBSP}2026 · record frozen`);
  const up = glued(segments(statusParts(facts(), NOW, 'live').line2));
  assert.ok(up.some((s) => s.text === `updated${NBSP}` ), up.map((s) => s.text).join('|'));
  assert.ok(up.some((s) => s.iso && s.text === `3${NBSP}hours${NBSP}ago` && s.title === 'Nov' + NBSP + '1'));
  const acc = glued(segments([l.accounts[1]]));
  assert.equal(acc.map((s) => s.text).join(''), `Account 2 of 2 removed${NBSP}${dateText(r, NOW, { year: 'always' }).replace(/ /g, NBSP)}`);
  // A text segment not followed by a date is left alone; the renderer uses glued() and keeps timeText for relative times.
  assert.deepEqual(glued([{ text: 'a b ' }, { text: 'c' }]), [{ text: 'a b ' }, { text: 'c' }]);
  const tsx = src('app/status-line.tsx');
  assert.match(tsx, /glued\(segments\)/);
  assert.match(tsx, /s\.title \? timeText\(s\)/);
  for (const p of ['app/u/[handle]/trade/[sellId]/page.tsx', 'app/u/[handle]/month/[ym]/page.tsx']) assert.match(src(p), /recordRows\(/, p);
});

test('N3: the pane, trade-share, recap and profile reads go through statusForOrNull: null on error, the log a count and the error class only', async () => {
  const calls: unknown[][] = [];
  const orig = console.error;
  console.error = (...a: unknown[]) => { calls.push(a); };
  try {
    const secret = Object.assign(new Error('password authentication failed for user trader@example.com at db.internal'), { code: '28P01' });
    assert.equal(await statusForOrNull(42, 'connected', async () => { throw secret; }), null);
    assert.equal(await statusForOrNull(42, 'connected', () => { throw new TypeError('sync'); }), null);
  } finally { console.error = orig; }
  assert.equal(calls.length, 2);
  const line = calls[0].map(String).join(' ');
  assert.match(line, /"traders":1/);
  assert.match(line, /28P01/);
  assert.doesNotMatch(line, /example\.com|db\.internal|\b42\b/);
  const f = facts();
  assert.equal(await statusForOrNull(1, 'connected', async () => f), f);
  for (const p of ['app/u/[handle]/pane/route.ts', 'lib/trade-share-load.ts', 'lib/recap-load.ts', 'app/u/[handle]/page.tsx']) {
    assert.match(src(p), /import \{ statusForOrNull as statusFor \} from '[^']*record-status-load\.ts'/, p);
  }
});

test('N6: the baseline\'s kind on a mixed stock is decided by the side it prints (self ?? summary)', () => {
  const conf = (perTrade: boolean) => ({ perTrade: perTrade ? { low: -0.01, mid: 0.01, high: 0.03 } : null }) as unknown as Confidence;
  const mixed = { demoOnly: false, conf: conf(true) };
  assert.equal(baselineKind(mixed, { n: 40 }, { conf: conf(false) }), 'too_few_trades');
  assert.equal(baselineKind({ demoOnly: false, conf: conf(false) }, { n: 40 }, { conf: conf(true) }), 'shown');
  assert.equal(baselineKind(mixed, { n: 40 }, null), 'shown');
  assert.equal(baselineKind(mixed, { n: 40 }), 'shown');
  assert.equal(baselineKind(mixed, { n: 0 }, { conf: conf(false) }), 'empty');
  assert.equal(baselineKind({ demoOnly: true, conf: conf(true) }, { n: 4 }, { conf: conf(false) }), 'demo_only');
  assert.match(src('app/t/[symbol]/Baseline.tsx'), /baselineKind\(summary, others, self\)/);
});

test('N10: the baseline names its range "95% range of the average per trade (a to b)"', () => {
  const c = { perTrade: { low: -0.034, mid: 0, high: 0.033 }, tier: 'thin', k: 6 } as unknown as Confidence;
  const l = baselineLines('NVDA', { n: 6, traders: 1, conf: c }, { n: 84, conf: c });
  assert.match(l.this, /^6 closed trades in NVDA by 1 trader: 95% range of the average per trade \(.+ to .+\)\.$/);
  assert.match(l.others, /^84 closed trades in other stocks recorded here: 95% range of the average per trade \(.+ to .+\)\.$/);
  assert.doesNotMatch(`${l.this} ${l.others}`, /average per trade, 95% range/);
});

test('N1: the root description also covers records built from public filings; never "verified" or a completeness claim', () => {
  const d = src('app/layout.tsx').match(/description: '([^']+)'/)?.[1] ?? '';
  assert.match(d, /read-only from brokers/);
  assert.match(d, /public filings/);
  assert.match(d, /Demo/);
  assert.doesNotMatch(d, /verified|every|all |any |complete/i);
});

test('N9: the Demo sentence once per page: no section note on /t/[symbol] (badges stay), one per compare column only when the explainer does not say it, one Demo badge per trade-page box', () => {
  for (const f of ['Baseline', 'Timeline', 'HoldTime', 'Theses', 'Concentration', 'Spread']) {
    const s = src(`app/t/[symbol]/${f}.tsx`);
    assert.doesNotMatch(s, /FL\.demoNote/, f);
    assert.match(s, /<Badge verified=\{false\} \/>/, `${f} keeps its badge`);
  }
  const page = src('app/t/[symbol]/page.tsx');
  assert.equal((page.match(/FL\.demoNote/g) ?? []).length, 0);
  assert.equal((page.match(/FL\.demoPage/g) ?? []).length, 1);
  assert.doesNotMatch(FL.tickerExplainer.demo, /not from a real broker/i);
  assert.match(FL.demoPage, /not from a real broker/);
  const cmp = src('app/t/compare/page.tsx');
  assert.match(cmp, /note && s\.demoOnly && <p role="note" className="muted">\{FL\.demoNote\}<\/p>/);
  assert.equal((cmp.match(/note=\{compareKind\(compare\) !== 'demo'\}/g) ?? []).length, 2);
  const trade = src('app/u/[handle]/trade/[sellId]/page.tsx');
  assert.doesNotMatch(trade, /className="badge demo"/);
  assert.match(trade, /<RowBadge kind=\{paneTrust/);
});

test('N12: the profile\'s trade rows print dateText (the year rule), not a numeric date; the chart\'s scrub date is untouched', () => {
  const p = src('app/u/[handle]/page.tsx');
  assert.match(p, /<span className="muted">\{dateText\(t\.closed_at, now\)\}<\/span>/);
  assert.doesNotMatch(p, /t\.closed_at\.toLocaleDateString\('en-US'\)/);
});

test('N4, N11, B1, B2: no-:has fallback classes, the pane\'s F3 spacing, the F3 line before F-7\'s line in the pane and before the evidence on the profile, the profile h1 on a phone', () => {
  const css = src('app/globals.css');
  assert.match(css, /html\.bar-hide \.feed \.row > \.card, html\.bar-signin \.feed \.row > \.card \{ padding-bottom: 96px; \}/);
  assert.match(src('app/feed-hides.tsx'), /classList\.toggle\('bar-hide', !!bar\)/);
  assert.match(src('app/feed-gestures.tsx'), /classList\.toggle\('bar-signin', askSignIn\)/);
  assert.match(css, /\.pane \[data-disclaimer\] \{ margin: 8px 0 12px; \}/);
  assert.match(css, /\.profile-page h1 \{ font-size: 1\.25rem;/);
  const pane = src('app/pane.tsx');
  assert.match(pane, /\{chartBlock\}\{f3\}\{publicLine\}\{summary\}/);
  assert.match(pane, /\{figures\}\{f3\}\{chartBlock\}\{publicLine\}/);
  const prof = src('app/u/[handle]/page.tsx');
  assert.ok(prof.indexOf('<Disclaimer />') < prof.indexOf('<div className="evidence">'));
  assert.ok(prof.indexOf('{both && <CombinedLine c={both} />}') < prof.indexOf('<Disclaimer />'));
});
