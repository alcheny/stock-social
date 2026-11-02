// C5-42 (approval council cycle 5, chore lane; brief docs/direction/cycle5-2026-11-01.md §6 rank 20): behavioural tests
// beside source-text assertions. Each test calls the real exported functions and names the source-text test it backs;
// the old assertions stay where they are. Pure: no database, no network. Fixture text is fictional.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PROMO } from '../scripts/compliance.ts';
import { statusParts, type StatusConnection, type StatusFacts } from './record-status.ts';
import { HeldNote } from './user-note.ts';
import { heldLine, RULE_EXPLAIN, KEPT_RULE } from './report-copy.ts';
import { moderate, moderateDetail } from './moderation.ts';
import { combined, openSummary, toneClass } from './open-split.ts';
import { botReason } from './views.ts';

const { renderToStaticMarkup } = await import('react-dom/server' as string) as { renderToStaticMarkup: (e: unknown) => string };
const { createElement } = await import('react');

// ---- lib/record-status.ts: the model reads no clock and no setting ----
const NOW = new Date('2026-11-01T12:00:00Z');
const DAY = 86_400_000, HOUR = 3_600_000;
const ago = (ms: number) => new Date(NOW.getTime() - ms);
const conn = (id: number, extra: Partial<StatusConnection> = {}): StatusConnection =>
  ({ id, consentAt: ago(60 * DAY), disconnectedAt: null, institution: 'Fake Brokerage', accounts: [{ id: `a${id}`, isPaper: false, removedAt: null, institution: 'Fake Brokerage' }], ...extra });
const FACTS: StatusFacts[] = [
  { source: 'broker', state: 'connected', firstEntry: new Date('2025-03-04T15:00:00Z'), lastClose: ago(3 * DAY), lastSyncedAt: ago(2 * HOUR), brokers: ['Fake Brokerage'], accounts: 1, connections: [conn(1)] },
  { source: 'broker', state: 'connected', firstEntry: new Date('2025-03-04T15:00:00Z'), lastClose: ago(40 * DAY), lastSyncedAt: ago(45 * DAY), brokers: ['Fake Brokerage'], accounts: 1, connections: [conn(1)] },
  { source: 'broker', state: 'failed', firstEntry: new Date('2025-03-04T15:00:00Z'), lastClose: ago(10 * DAY), lastSyncedAt: ago(9 * DAY), brokers: ['Fake Brokerage'], accounts: 1, connections: [conn(1, { disconnectedAt: ago(9 * DAY) })] },
];
const allParts = () => FACTS.flatMap((f) => (['live', 'static'] as const).map((m) => statusParts(f, NOW, m)));

test('C5-42 backs lib/record-status.test.ts "a failed sync … the model never reads the clock, a schedule or a cron setting": the same facts and now give the same lines under any system clock', (t) => {
  const base = allParts();
  t.mock.timers.enable({ apis: ['Date'], now: Date.UTC(2031, 6, 15, 3, 7) });
  try {
    assert.deepEqual(allParts(), base, 'clock in 2031');
    t.mock.timers.setTime(Date.UTC(2019, 0, 1));
    assert.deepEqual(allParts(), base, 'clock in 2019');
    t.mock.timers.setTime(NOW.getTime() + 13 * DAY);
    assert.deepEqual(allParts(), base, 'clock thirteen days past now');
  } finally {
    t.mock.timers.reset();
  }
  // The injected now still decides: the same facts read a different relative time for a different now.
  assert.notDeepEqual(statusParts(FACTS[0], new Date(NOW.getTime() + 5 * DAY), 'live'), statusParts(FACTS[0], NOW, 'live'));
});

test('C5-42 backs lib/record-status.test.ts "a failed sync … the model never reads the clock, a schedule or a cron setting": cron, schedule and round settings in the environment change nothing', () => {
  const base = allParts();
  const keys = ['CRON_TICK_MS', 'CRON_SCHEDULE', 'SYNC_ROUND_MS', 'ROUND_MS', 'TZ', 'NODE_ENV'];
  const was = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  try {
    for (const [k, v] of [['CRON_TICK_MS', '60000'], ['CRON_SCHEDULE', '*/1 * * * *'], ['SYNC_ROUND_MS', '1'], ['ROUND_MS', '7'], ['NODE_ENV', 'production']]) process.env[k] = v;
    assert.deepEqual(allParts(), base);
  } finally {
    for (const k of keys) { if (was[k] === undefined) delete process.env[k]; else process.env[k] = was[k]; }
  }
});

// ---- lib/user-note.ts#HeldNote ----
test('C5-42 backs lib/report-copy.test.ts "the profile renders the held line muted (never the loss colour) for the author only": HeldNote renders one muted thesis-held paragraph with heldLine(rule)', () => {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  for (const rule of [...Object.keys(RULE_EXPLAIN), 'reports', KEPT_RULE, 'unknown-rule', null, undefined]) {
    const html = renderToStaticMarkup(createElement(HeldNote, { rule }));
    assert.equal(html, `<p class="muted thesis-held" data-own-held="">${esc(heldLine(rule))}</p>`, String(rule));
    assert.doesNotMatch(html, /\b(down|warn|loss)\b/, 'never the loss or warn colour');
    if (rule === 'unknown-rule') assert.ok(!html.includes('unknown-rule'), 'the stored value is never printed');
  }
  // With the trade page's edit link: the same line, then the link on its own 44 px target.
  const withEdit = renderToStaticMarkup(createElement(HeldNote, { rule: 'link', edit: '/u/fictional#t-1' }));
  assert.ok(withEdit.startsWith(`<p class="muted thesis-held" data-own-held="">${esc(heldLine('link'))}</p><p class="held-edit"><a class="tap44" href="/u/fictional#t-1">`));
});

// ---- lib/moderation.ts and the scanner's PROMO list ----
// One fictional note per PROMO pattern, written as a promotion to readers.
const PROMO_NOTES = [
  'Guaranteed returns on this setup, trust me.',
  'This one was risk-free for anyone who joined.',
  'You cannot lose money with this approach.',
  'Follow along and get rich this year.',
  'This plan will beat the market every month.',
  'Honestly this is easy money for everyone.',
  'You should buy this before Friday.',
  'Buy now while it is cheap.',
  'Copy this trade and thank me later.',
  'A proven strategy that anyone can follow.',
  'My pick of the day for all of you.',
  'See every trade I make on my channel.',
  'This record is verified by my broker friend.',
];

test('C5-42 backs lib/moderation-v2.test.ts "lib/moderation.ts imports PROMO rather than spelling its phrases": a note with any PROMO phrase is held, never published', () => {
  for (const [i, re] of PROMO.entries()) assert.ok(PROMO_NOTES.some((n) => re.test(n)), `PROMO[${i}] ${re} has a fictional note`);
  for (const note of PROMO_NOTES) {
    assert.ok(PROMO.some((re) => re.test(note)), `${note} carries a PROMO phrase`);
    assert.equal(moderate(note), 'held', note);
    const d = moderateDetail(note);
    assert.equal(d.status, 'held', note);
    assert.ok(d.rule && Object.hasOwn(RULE_EXPLAIN, d.rule), `${note}: a named rule (${d.rule})`);
  }
  // The control: the same notes without the phrase publish.
  for (const plain of ['Bought on the earnings dip, sold two weeks later.', 'Closed it after the guidance cut; a small loss.']) assert.equal(moderate(plain), 'published', plain);
});

// ---- lib/open-split.ts holds no copy ----
test('C5-42 backs lib/open-split.test.ts "F-6 (AC5, POLICY P3/F1): open copy is percent and counts only, with no advice words; the module holds no copy": every value the module returns is a number, "up", "down" or nothing', () => {
  const strings = new Set<string>();
  const walk = (v: unknown): void => {
    if (typeof v === 'string') strings.add(v);
    else if (v && typeof v === 'object') for (const x of Object.values(v)) walk(x);
    else assert.ok(v === null || v === undefined || typeof v === 'number', `a ${typeof v}`);
  };
  let seed = 7;
  const rnd = () => { seed = (seed * 1_103_515_245 + 12_345) % 2 ** 31; return seed / 2 ** 31; };
  const xs = Array.from({ length: 500 }, () => (rnd() - 0.5) * 3).concat([0, -0, 0.0004, -0.0004, -1, 2.5]);
  for (const x of xs) walk(toneClass(x));
  for (let i = 0; i < 50; i++) {
    const closed = xs.slice(i, i + (i % 7)), open = xs.slice(100 + i, 100 + i + (i % 5));
    walk(openSummary(open));
    walk(combined(closed, open));
  }
  walk(openSummary([]));
  walk(combined([], []));
  assert.deepEqual([...strings].sort(), ['down', 'up']);
});

// ---- lib/views.ts#botReason: generic words, no product list ----
test('C5-42 backs lib/f15-views.test.ts "F-15 bot filter: generic words only, no platform or product name (POLICY T1, T5)": made-up clients are refused by their generic words alone', () => {
  const ua = (s: string) => ({ get: (n: string) => (n === 'user-agent' ? s : n === 'sec-fetch-site' ? 'same-origin' : n === 'origin' ? 'https://app.example' : null) });
  const browser = 'Mozilla/5.0 (X11; Linux x86_64) Zqxwbrowser/1.0';
  assert.equal(botReason(ua(browser), false), null, 'a fictional browser counts');
  for (const name of ['Zqxwbot', 'ZqxwCrawler', 'zqxw-spider', 'ZqxwLinkPreview', 'ZqxwFetcher', 'ZqxwScraper', 'ZqxwUnfurl', 'ZqxwMonitor', 'ZqxwHeadless', 'ZqxwValidator', 'ZqxwArchiver', 'ZqxwScanner', 'ZqxwProbe', 'Zqxw-HttpClient'])
    assert.equal(botReason(ua(`Mozilla/5.0 (compatible; ${name}/2.1)`), false), 'declared_bot', name);
  // Not a browser's shape (a bare library or tool token) is refused without any name list.
  for (const s of ['zqxw/1.0', 'Zqxwtool', '']) assert.equal(botReason(ua(s), false), 'declared_bot', s);
});
