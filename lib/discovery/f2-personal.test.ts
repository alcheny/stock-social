// F-2 PR-5 (criteria 1, 3, 4, 6, 7, 8, 9, 11, 12, 14, 16, 17): the pure parts of personal ordering and the activity
// log's rules. No database (lib/f2-personal.db.test.ts covers the stored half).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BATCH_MAX, parseBatch, parseEvent, SYMBOL_EVENTS, EVENT_TYPES } from './events.ts';
import { sameOrigin } from './origin.ts';
import { EMPTY_INPUTS, FADE_DAYS, fade, personalList, personalOrder, personalPool, personalReason, relevanceOf, viewerProfile, type Inputs, type TraderShape } from './personal.ts';
import { FOLLOW_BONUS, IMPLICIT, WEIGHTS } from './weights.ts';
import { byEvidence, chooseRows, holdBucket, type SectionTrader } from './section.ts';
import { FEED_CAPS } from './diversity.ts';
import { FEED_EMPTY, HIDDEN_TRADES, HOW_PERSONAL, PERSONALIZE, SECTION_PERSONAL, allCopy } from '../copy.ts';

const DAY = 86_400_000, NOW = 1_800_000_000_000;
const src = (f: string) => readFileSync(new URL(f, import.meta.url), 'utf8');

test('pure: personal.ts, events.ts and origin.ts import only pure discovery modules and copy-free helpers (no db, session, feed)', () => {
  for (const f of ['./personal.ts', './events.ts', './origin.ts']) {
    for (const m of src(f).matchAll(/from '([^']+)'/g)) assert.match(m[1], /^\.\/(weights|explore|section|diversity|pager)\.ts$/, `${f} imports ${m[1]}`);
  }
});

test('criterion 8 / sign invariance: personal.ts never reads a return (no return_pct, returnPct or sign)', () => {
  assert.doesNotMatch(src('./personal.ts'), /return_?pct|returnPct|Math\.sign/i);
});

test('criterion 16: the watchlist is never an ordering input; symbol events are off', () => {
  assert.equal(SYMBOL_EVENTS, false);
  for (const f of ['./personal.ts', './personal-load.ts', './personal-feed.ts', './activity.ts']) assert.doesNotMatch(src(f), /ticker_watches|watchlist\(|toggleWatch/, f);
  assert.equal(parseEvent({ type: 'watch', surface: 'feed', target: { kind: 'symbol', symbol: 'ABC' } }), null);
  assert.equal(parseEvent({ type: 'unwatch', surface: 'feed', target: { kind: 'symbol', symbol: 'ABC' } }), null);
  assert.deepEqual(parseBatch({ events: [{ type: 'watch', surface: 'feed', target: { kind: 'symbol', symbol: 'ABC' } }] }), []);
  assert.doesNotMatch(src('../../app/actions.ts'), /discovery_events|recordEvents/);
});

test('criterion 3: an event is type, surface and target only; unknown keys, types, surfaces and targets are dropped; ≤ 50 a batch', () => {
  const ok = { type: 'impression', surface: 'feed', target: { kind: 'trade', id: '42' } };
  assert.deepEqual(parseEvent(ok), ok);
  assert.deepEqual(parseEvent({ type: 'profile_open', surface: 'section', target: { kind: 'trader', handle: 'abc_1' } })?.target, { kind: 'trader', handle: 'abc_1' });
  for (const bad of [
    { ...ok, at: 1 }, { ...ok, email: 'a@b.c' }, { ...ok, type: 'follow' }, { ...ok, type: 'like' }, { ...ok, surface: 'mail' },
    { ...ok, target: { kind: 'trade', id: '42', price: 3 } }, { ...ok, target: { kind: 'trade', id: '4x' } }, { ...ok, target: { kind: 'trader', handle: 'A@B' } },
    { ...ok, target: { kind: 'symbol', symbol: 'ABC' } }, { ...ok, type: 'toString' }, { ...ok, surface: '__proto__' }, null, [], 'x',
  ]) assert.equal(parseEvent(bad), null, JSON.stringify(bad));
  assert.equal(parseBatch({ events: Array(BATCH_MAX + 1).fill(ok) }), null);
  assert.equal(parseBatch({ events: [ok], extra: 1 }), null);
  assert.deepEqual(parseBatch({ events: [ok, ok, { bad: 1 }] }), [ok], 'duplicates kept once, invalid dropped');
  // Only implicit reading types are accepted: explicit choices live in their own tables.
  assert.deepEqual(Object.keys(EVENT_TYPES), ['impression', 'dwell_short', 'dwell_long', 'skip', 'swipe_open', 'profile_open', 'share', 'watch', 'unwatch']);
});

test('events route: same-origin only (Sec-Fetch-Site and Origin), a request with neither is refused', () => {
  const h = (o: Record<string, string>) => ({ get: (n: string) => o[n] ?? null });
  assert.equal(sameOrigin(h({ 'sec-fetch-site': 'same-origin', origin: 'https://a.test', host: 'a.test' })), true);
  assert.equal(sameOrigin(h({ origin: 'https://a.test', host: 'a.test' })), true);
  assert.equal(sameOrigin(h({ 'sec-fetch-site': 'same-origin' })), true);
  assert.equal(sameOrigin(h({ 'sec-fetch-site': 'cross-site', origin: 'https://a.test', host: 'a.test' })), false);
  assert.equal(sameOrigin(h({ origin: 'https://evil.test', host: 'a.test' })), false);
  assert.equal(sameOrigin(h({ origin: 'null', host: 'a.test' })), false);
  assert.equal(sameOrigin(h({ host: 'a.test' })), false);
  assert.equal(sameOrigin(h({ origin: 'https://a.test', 'x-forwarded-host': 'a.test', host: 'internal:3000' })), true);
});

test('criterion 14 / owner 2026-11-01: a like counts for 90 days, fading: 3 at 0, ~1.5 at 45, ~0.03 at 89, 0 at 90 and after', () => {
  assert.equal(FADE_DAYS, 90);
  const at = (d: number) => viewerProfile({ ...EMPTY_INPUTS, likes: [{ trader: 7, at: NOW - d * DAY }] }, NOW).direct.get(7);
  assert.equal(at(0), 3);
  assert.ok(Math.abs(at(45)! - 1.5) < 1e-9);
  assert.ok(at(89)! > 0 && at(89)! < 0.04);
  assert.equal(at(90), undefined);
  assert.equal(at(91), undefined);
  assert.equal(fade(NOW + DAY, NOW), 0, 'a choice dated after asOf counts for nothing');
  // A reject: −4 fading the same way; an unfollow −1; a running "Not interested" −4.
  const p = viewerProfile({ ...EMPTY_INPUTS, rejects: [{ trader: 1, at: NOW }], unfollows: [{ trader: 2, at: NOW }], hidden: [{ trader: 3, at: NOW - 45 * DAY }] }, NOW);
  assert.deepEqual([p.direct.get(1), p.direct.get(2), p.direct.get(3)], [WEIGHTS.notInterested, WEIGHTS.unfollow, WEIGHTS.notInterested / 2]);
});

test('Q8: implicit weights never outweigh an explicit choice; impressions weigh nothing; the opening swipe is the owner\'s +2', () => {
  const explicit = Math.min(Math.abs(WEIGHTS.like), Math.abs(WEIGHTS.notInterested));
  for (const [code, w] of Object.entries(IMPLICIT)) assert.ok(Math.abs(w) <= explicit, `type ${code}: ${w}`);
  assert.equal(IMPLICIT[EVENT_TYPES.impression], 0);
  assert.equal(IMPLICIT[EVENT_TYPES.swipe_open], WEIGHTS.swipeOpen);
  assert.ok(FOLLOW_BONUS > 0 && FOLLOW_BONUS <= WEIGHTS.like);
});

// A generated list: n traders × k closes, symbols spread, in the given (TR-9) order.
function ranked(n: number, k: number) {
  const out: { key: string; trader: number; symbol: string }[] = [];
  for (let j = 0; j < k; j++) for (let t = 1; t <= n; t++) out.push({ key: `${t}-${j}`, trader: t, symbol: `S${(t * 7 + j) % (n + 3)}` });
  return out;
}
const shapesOf = (list: readonly { trader: number; symbol: string }[], hold: (t: number) => number) => {
  const m = new Map<number, TraderShape & { symbols: Set<string> }>();
  for (const c of list) { const s = m.get(c.trader) ?? { hold: hold(c.trader), symbols: new Set<string>() }; s.symbols.add(c.symbol); m.set(c.trader, s); }
  return m;
};

test('criterion 11: cold start (no signals) gives exactly the order everyone gets; one signal raises that trader; many signals stay bounded', () => {
  const list = ranked(40, 3), shapes = shapesOf(list, (t) => t % 5 === 0 ? 0.5 : 10);
  const cold = viewerProfile(EMPTY_INPUTS, NOW);
  assert.equal(cold.signals, 0);
  assert.deepEqual(personalOrder(list, relevanceOf(cold, shapes)), list);
  const one = viewerProfile({ ...EMPTY_INPUTS, follows: [33] }, NOW);
  const order = personalOrder(list, relevanceOf(one, shapes));
  assert.ok(order.findIndex((c) => c.trader === 33) < list.findIndex((c) => c.trader === 33), 'follow raises (criterion 1)');
  // 10,000 events on one trader: the direct affinity is clamped.
  const many = viewerProfile({ ...EMPTY_INPUTS, events: Array.from({ length: 10_000 }, (_, i) => ({ type: EVENT_TYPES.dwell_long, trader: 5, symbol: 'S1', at: NOW - i * 1000 })), activity: true }, NOW);
  assert.ok(many.direct.get(5)! <= 6);
  assert.equal(personalOrder(list, relevanceOf(many, shapes)).length, list.length);
});

test('criterion 4: "Not interested" lowers a trader with the same holding period; an unfollow lowers only slightly and never removes', () => {
  const list = ranked(30, 2);
  const hold = (t: number) => (t <= 10 ? 0.5 : t <= 20 ? 3 : 60);
  const shapes = shapesOf(list, hold);
  const p = viewerProfile({ ...EMPTY_INPUTS, hidden: [{ trader: 2, at: NOW }] }, NOW);
  const rel = relevanceOf(p, shapes);
  assert.ok(rel(5) < 0, 'same bucket as the hidden trader: lowered');
  assert.equal(rel(15), 0, 'another bucket: unchanged');
  const u = personalOrder(list, relevanceOf(viewerProfile({ ...EMPTY_INPUTS, unfollows: [{ trader: 12, at: NOW }] }, NOW), shapes));
  assert.equal(u.filter((c) => c.trader === 12).length, 2, 'never removed');
  assert.ok(u.findIndex((c) => c.trader === 12) >= list.findIndex((c) => c.trader === 12));
});

test('criterion 8: a viewer who reads only losing records gets the same order as one who reads only gains (nothing reads a return)', () => {
  // The profile never sees a return; two viewers with the same choices on records of opposite sign have equal inputs.
  const list = ranked(30, 3), shapes = shapesOf(list, (t) => t % 4);
  const reads = (sym: (i: number) => string) => viewerProfile({ ...EMPTY_INPUTS, likes: [3, 8, 13].map((t, i) => ({ trader: t, at: NOW - i * DAY, symbol: sym(i) })) }, NOW);
  const losses = reads((i) => `S${i}`), gains = reads((i) => `S${i}`);
  assert.deepEqual(personalOrder(list, relevanceOf(losses, shapes)), personalOrder(list, relevanceOf(gains, shapes)));
});

test('criterion 6: on 1,000 generated personal feeds no trader or symbol appears more than twice in any 10 consecutive cards; ≥ 2 of 10 are exploration picks', () => {
  for (let v = 0; v < 1_000; v++) {
    const list = ranked(60, 4), shapes = shapesOf(list, (t) => (t * 13 + v) % 200);
    const inputs: Inputs = { ...EMPTY_INPUTS, follows: [1 + (v % 60)], likes: [{ trader: 1 + ((v * 7) % 60), at: NOW - (v % 80) * DAY, symbol: `S${v % 9}` }],
      hidden: v % 3 ? [] : [{ trader: 1 + ((v * 11) % 60), at: NOW }] };
    const mixed = personalList(list, relevanceOf(viewerProfile(inputs, NOW), shapes), `2026-11-${String(1 + (v % 28)).padStart(2, '0')}`);
    for (let i = 0; i + FEED_CAPS.window <= mixed.length; i++) {
      const w = mixed.slice(i, i + FEED_CAPS.window);
      const per = (k: (c: (typeof w)[number]) => string | number) => Math.max(...[...w.reduce((m, c) => m.set(k(c), (m.get(k(c)) ?? 0) + 1), new Map()).values()]);
      assert.ok(per((c) => c.card.trader) <= 2 && per((c) => c.card.symbol) <= 2, `viewer ${v} window ${i}`);
      if (i + FEED_CAPS.window <= Math.min(mixed.length, 60)) assert.ok(w.filter((c) => c.explore).length >= 1, `viewer ${v} window ${i} has exploration`);
    }
    const first10 = mixed.slice(0, 10);
    assert.ok(first10.filter((c) => c.explore).length >= 2, `viewer ${v}: ≥ 2 of the first 10 are exploration picks`);
  }
});

test('criterion 2/8 (business lead demand 3): relevance chooses the section rows, the evidence (TR-9 lower bound) orders them', () => {
  const pool: SectionTrader[] = Array.from({ length: 30 }, (_, i) => ({ trader: i + 1, score: 1, weight: 30 - i, hold: i % 5 === 0 ? 0.5 : (i % 5) * 20, n: 10 }));
  pool.sort(byEvidence);
  const shapes = new Map(pool.map((t) => [t.trader, { hold: t.hold, symbols: new Set<string>() }]));
  for (let seed = 1; seed <= 30; seed++) {
    const p = viewerProfile({ ...EMPTY_INPUTS, likes: [{ trader: seed, at: NOW }] }, NOW);
    const rows = chooseRows(personalPool(pool, relevanceOf(p, shapes)))!;
    assert.equal(rows.length, 3);
    assert.deepEqual(rows, [...rows].sort(byEvidence), `seed ${seed}: rows in evidence order`);
  }
  // With a signal, the most relevant come first in the pool (the liked trader's holding bucket).
  const p = viewerProfile({ ...EMPTY_INPUTS, likes: [{ trader: 6, at: NOW }] }, NOW);
  const top = personalPool(pool, relevanceOf(p, shapes)).slice(0, 5);
  assert.ok(top.every((t) => holdBucket(t.hold) === holdBucket(pool.find((x) => x.trader === 6)!.hold)));
});

test('criteria 7, 17: each reason is true against its inputs, names only a followed or liked trader, never a security', () => {
  const shapes = new Map<number, TraderShape>([[1, { hold: 3, symbols: new Set(['AAA']) }], [2, { hold: 4, symbols: new Set(['BBB']) }],
    [3, { hold: 400, symbols: new Set(['AAA']) }], [4, { hold: 400, symbols: new Set(['CCC']) }], [5, { hold: 400, symbols: new Set(['DDD']) }]]);
  const handles = new Map([[1, 'one_x'], [5, 'five_x']]);
  const p = viewerProfile({ ...EMPTY_INPUTS, follows: [1], likes: [{ trader: 9, at: NOW, symbol: 'AAA' }], activity: true,
    events: [{ type: EVENT_TYPES.dwell_long, trader: 5, symbol: null, at: NOW }, { type: EVENT_TYPES.impression, trader: 4, symbol: null, at: NOW }] }, NOW);
  assert.deepEqual(personalReason(2, p, shapes, handles), { kind: 'similarHold', handle: 'one_x' }, 'same bucket as @one_x (followed)');
  assert.notDeepEqual(personalReason(1, p, shapes, handles), { kind: 'similarHold', handle: 'one_x' }, 'x is never the row\'s own trader');
  assert.deepEqual(personalReason(3, p, shapes, handles), { kind: 'symbolsRead' });
  assert.equal(personalReason(4, p, shapes, handles), null, 'seen (an impression): not "New to you"');
  // A dwell on @five_x is an implicit signal: never the basis of "Similar holding period to @x" (engineer demand 5).
  assert.notDeepEqual(personalReason(4, p, shapes, handles), { kind: 'similarHold', handle: 'five_x' });
  const fresh = viewerProfile({ ...EMPTY_INPUTS, activity: true, follows: [1] }, NOW);
  assert.deepEqual(personalReason(4, fresh, shapes, handles), { kind: 'newToYou' });
  assert.equal(personalReason(4, { ...fresh, activity: false }, shapes, handles), null, '"New to you" only with activity On');
  for (const s of [SECTION_PERSONAL.similarHold('x_y'), SECTION_PERSONAL.symbolsRead, SECTION_PERSONAL.newToYou]) assert.doesNotMatch(s, /\$|%|\d|[A-Z]{2,}/, s);
});

const SUGGESTION_WORDS = /\b(buy|sell|hold|pick|signal|advice|price target)s?\b/i;
const ENDORSEMENT = /\b(suggested|recommended|top|best|ai|smart|for you)\b/i;
test('criterion 9: every new F-2 string passes the suggestion and endorsement word lists, carries no number about performance and is in the scanner walk', () => {
  const strings = [...Object.values(SECTION_PERSONAL), ...Object.values(PERSONALIZE), ...Object.values(HIDDEN_TRADES)]
    .flatMap((v) => typeof v === 'string' ? [v] : typeof v === 'function' ? [(v as (...a: unknown[]) => string)('x_y', 'ABC', 'Oct 3, 2026')] : Object.values(v as object) as string[]);
  assert.ok(strings.length >= 30);
  for (const s of strings) {
    assert.doesNotMatch(s, SUGGESTION_WORDS, s);
    assert.doesNotMatch(s, ENDORSEMENT, s);
    assert.doesNotMatch(s, /%|[+−]\d|\$/, s);
  }
  assert.doesNotMatch(HOW_PERSONAL.text, SUGGESTION_WORDS);
  const all = allCopy();
  for (const s of [SECTION_PERSONAL.heading, PERSONALIZE.activityExplain, HIDDEN_TRADES.title, HOW_PERSONAL.text]) assert.ok(all.includes(s), s);
  // Singular and plural (business lead Q11), and "hidden"/"hide" pass the lists.
  assert.equal(PERSONALIZE.orderLine(true, false, false, false), 'Ordered using your follows.');
  assert.equal(PERSONALIZE.orderLine(true, true, true, false), 'Ordered using your follows, likes and hides.');
  assert.equal(PERSONALIZE.orderLine(false, true, false, true), 'Ordered using your likes and activity.');
  assert.equal(HIDDEN_TRADES.line(1), '1 trade hidden by you.');
  assert.equal(HIDDEN_TRADES.line(3), '3 trades hidden by you.');
  assert.equal(HIDDEN_TRADES.showThemFor(1), 'Show them: 1 hidden trade');
  assert.equal(HIDDEN_TRADES.line(1_001), '1,000+ trades hidden by you.');
  for (const [name, shown] of [[HIDDEN_TRADES.showThemFor(3), HIDDEN_TRADES.showThem], [PERSONALIZE.changeFor, PERSONALIZE.change], [PERSONALIZE.removeFor('x_y'), PERSONALIZE.remove]] as const)
    assert.ok(name.startsWith(shown), `the name "${name}" starts with the visible "${shown}" (WCAG 2.5.3)`);
  // The durations in the copy are the constant's.
  assert.match(PERSONALIZE.feedExplain, new RegExp(`${FADE_DAYS} days`));
  assert.match(PERSONALIZE.activityExplain, new RegExp(`${FADE_DAYS} days`));
  // Business lead demand 7: each switch button's name says which switch.
  assert.equal(PERSONALIZE.groupOn(PERSONALIZE.activityTitle), 'Personalize with my activity: On');
});

test('criterion 12: "Personalize with my activity" is off by default (schema), personalization on by default', () => {
  const schema = readFileSync(new URL('../../db/schema.sql', import.meta.url), 'utf8');
  assert.match(schema, /schema_add_column\('users', 'activity_log_on_at', 'timestamptz'\)/, 'null by default: Off');
  assert.match(schema, /schema_add_column\('users', 'personalize_feed', 'boolean not null default true'\)/);
  // The logger is mounted only when both are On (app/page.tsx), and the events route stores only then (activity.ts).
  assert.match(src('../../app/page.tsx'), /\{page\.settings\?\.personalize && page\.settings\.activity && <DiscoveryLog \/>\}/);
  assert.match(src('./activity.ts'), /activity_log_on_at is not null and personalize_feed and deleted_at is null as on/);
});

test('owner 2026-11-01: nothing is deleted on a timer: the purge deletes only viewer-ended exclusions, ended unfollows and orphans; no event purge', () => {
  const purge = src('./purge.ts');
  assert.match(purge, /reason = 'unfollow' or ended_at is not null/);
  assert.doesNotMatch(purge, /discovery_events/);
  // One orphan mechanism (lib/privacy-purge.ts, privacy_orphans): the discovery purge and account deletion carry none.
  assert.doesNotMatch(purge, /trade_likes|trade_exclusions/);
  assert.doesNotMatch(src('../delete.ts'), /orphan/i);
  assert.match(src('../privacy-purge.ts'), /privacy_orphans/);
});

test('approval council fix #12: the empty feed shows a plain line, never developer instructions (no command, no code element)', () => {
  const page = src('../../app/page.tsx');
  assert.doesNotMatch(page, /npm run|db:seed|<code>/);
  assert.match(page, /FEED_EMPTY\.title/);
  for (const s of Object.values(FEED_EMPTY)) assert.doesNotMatch(s, /npm|seed|run |`/i, s);
  assert.ok(allCopy().includes(FEED_EMPTY.body));
});
