// F-31 (docs/features/F-31-readout-limits-and-partial-rows.md; plan docs/features/logs/F-31/plan.md §8): the readout
// states its limits and splits the strict G3 row into trader and filer views. Pure tests, no database: the limits block,
// the strict family (the "of which" rows, the concentration row, the internal G3 row), the address-cap row, the
// self-views row, the tagged-or-external row, the internal-handles parser and G1 row, the beacon's cap mark, and the
// baseline (the output differs from main's only by the new block and rows).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CAP_FLAG_LINE, CAP_NOT_LIVE, F31_INTERNAL_ROW_LABELS, F31_ROW_LABELS, INTERNAL_LINE, INTERNAL_RUNS_LINE, LIMITS_HEADING,
  LIMIT_LINES, SELF_LINE, SPLIT_LINE, TOP_LINE, buildReadout, capFactLine, factsHeading, g1Internal, internalFactLine,
  parseInternalHandles, strictFamily, weekHeader, weekWindow, type ReadoutInput, type RollupRow, type SharerRow,
} from './f15-readout.ts';
import { BASE_NOW, BASE_TEXT, baseInput } from './f31-readout-baseline.test.ts';
import { CAP_RETRY_MS, markCapDay } from '../lib/views.ts';
import { handleBeacon, type BeaconDeps } from '../lib/views-route.ts';

const NOW = BASE_NOW;
const { mondays } = weekWindow(NOW);
const dayOf = (w: number, o = 0) => new Date(mondays[w] + o * 86_400_000).toISOString().slice(0, 10);
const view = (w: number, n: number, o: Partial<RollupRow> = {}): RollupRow =>
  ({ day: dayOf(w), surface: 'profile', ref_class: 'external', via: 'none', self_view: false, n, ...o });
const T = (o: Partial<SharerRow> = {}): SharerRow => ({ card: false, story: false, record: false, sheet: false, copy: false, down: false, ...o });
const only = (rows: RollupRow[], extra: Partial<ReadoutInput> = {}): ReadoutInput =>
  ({ rollup: rows, drops: [], g1: { strict: 0, partial: 0 }, g2: { traders: [], firstDay: null, retentionDays: 120 }, ...extra });
const SET = { state: 'set' as const, ignored: 0 };
const cellsOf = (line: string | undefined) => (line ?? '').slice(1, -1).split('|').map((c) => c.trim());
const rowLine = (md: string, label: string) => md.split('\n').find((l) => l.startsWith(`| ${label} |`));
const g3 = (md: string, label: string) => cellsOf(rowLine(md, label)).slice(2);
const tableCells = (md: string) =>
  md.split('\n').filter((l) => l.startsWith('|') && !/^\|(-+\|)+$/.test(l)).flatMap((l) => l.slice(1, -1).split('|').map((c) => c.trim()));
const STRICT = 'Profile views from external referrers / week (views, not people)';
const [CAP_ROW, TRADER_ROW, FILER_ROW, TOP_ROW, TAGGED_ROW, SELF_ROW] = F31_ROW_LABELS;
const [G1_INTERNAL_ROW, G3_INTERNAL_ROW] = F31_INTERNAL_ROW_LABELS;
const OK = (x: number) => x === 0 || x >= 5;
const exactCell = (c: string) => /^[\d,]+$/.test(c);

// ---- AC3: the limits block ----
test('F-31 AC3: the limits block sentences, fact lines and note lines are pinned', () => {
  assert.equal(LIMITS_HEADING, '## Limits of these counts');
  assert.deepEqual(LIMIT_LINES, [
    "- These are first-party counts from the app's own view beacon. They can be inflated, and they are not verified figures.",
    '- Signed-out views by a trader of their own record, by the owner or by the team can\'t be told apart from anyone else\'s views; only self-views made while signed in are removed (row "self-views removed (signed in)").',
    '- A scripted client can forge a view and its via tag; a forged view that passes the bot filter is counted and leaves no trace in the drops table.',
    '- A tagged link opened with no referrer is outside the strict G3 row, which counts external referrers only; the row "partial: tagged link or external referrer" counts both.',
    '- "Views, not people" applies to every row that counts views: one person can add many views.',
    '- Whether filer views count toward G3, and how any gate is read, is the owner\'s call (MRC2-3); the "of which" rows only show trader and filer views apart.',
  ]);
  assert.equal(factsHeading(mondays[7]), "This week's facts (2026-W43, Oct 19–25, the latest week printed):");
  assert.equal(capFactLine('live'), '- address cap: live (every beacon that week was checked against a trusted client address; the cap is per server instance).');
  assert.equal(capFactLine('untrusted'), '- address cap: not live (some beacons that week had no trusted client address, so the per-address rate cap was skipped for them).');
  assert.equal(capFactLine('none'), '- address cap: not live (not shown live: no address check was recorded that week).');
  assert.equal(CAP_FLAG_LINE, '- While the address cap is not shown live, strict G3 is not readable as a gate; it still prints, and the row "address cap" under it reads "not readable as a gate: address cap not live" for each such week.');
  assert.equal(internalFactLine('unset', 0), '- internal accounts: not removed (READOUT_INTERNAL_HANDLES is unset).');
  assert.equal(internalFactLine('none-valid', 3), '- internal accounts: not removed (READOUT_INTERNAL_HANDLES lists no valid handle).');
  assert.equal(internalFactLine('set', 0, 1), '- internal accounts: removed only in the rows "partial: strict G1 without internal accounts" and "partial: strict G3 without internal accounts\' profiles"; every other row still counts them. The list holds 1 valid handle.');
  assert.equal(internalFactLine('set', 0, 3), internalFactLine('set', 0, 1).replace('1 valid handle.', '3 valid handles.'));
  assert.equal(internalFactLine('set', 1, 2), `${internalFactLine('set', 0, 2)} 1 listed entry was not a valid handle and was ignored.`);
  assert.equal(internalFactLine('set', 2, 2), `${internalFactLine('set', 0, 2)} 2 listed entries were not a valid handle and were ignored.`);
  assert.equal(INTERNAL_RUNS_LINE, "- Changing the internal list between runs can reveal one profile's counts; compare runs only with the same list.");
  assert.equal(SPLIT_LINE, 'The "of which" rows split the strict row by profile: a broker-trader profile or a public-filing profile. They print only in a week whose strict figure is exact, and read "(s)" when either part, or anything that could be worked out from them and the rows below, would be 1 to 4; they have no total and no difference row.');
  assert.equal(TOP_LINE, 'The largest single profile\'s share is one profile\'s strict G3 views over the week\'s strict G3, rounded down to a whole percent; it names no profile, reads "(s)" unless that profile has 5 or more views and nothing from 1 to 4 can be worked out from it, and reads "—" when the strict figure is 0.');
  assert.equal(SELF_LINE, '"self-views removed (signed in)" counts traders\' views of their own profile, trade and month pages made while signed in; they are in no other row. Signed-out self-views can\'t be told apart and stay in the counts.');
  assert.equal(INTERNAL_LINE, 'Internal accounts come from an env list read only on the machine that runs this readout; no handle is printed. The G1 row reads "(s)" when strict G1, or what is left without internal accounts, is 1 to 4; the G3 row reads "(s)" when 1 to 4 views of internal profiles, or 1 to 4 of what is left, would be worked out by subtraction. The G1 row may reveal how many listed accounts have a connected broker.');
});

test('F-31 AC3: the limits block prints above the first G-row on every run, in plain text only', () => {
  const runs = [buildReadout(only([]), NOW), buildReadout(baseInput(), NOW), buildReadout({ ...baseInput(), internal: SET }, NOW),
    buildReadout({ rollup: [], drops: [], g1: { strict: 0, partial: 0 }, g2: { traders: [], firstDay: null, retentionDays: 120 } }, NOW),
    buildReadout({} as ReadoutInput, NOW)];
  for (const md of runs) {
    const at = md.indexOf(`\n${LIMITS_HEADING}\n`), g1 = md.indexOf('\n## G1\n');
    assert.ok(at > 0 && at < g1, 'block before ## G1');
    assert.ok(md.indexOf('\n## ') === at, 'the block is the first section');
    let prev = at;
    for (const l of LIMIT_LINES) { const i = md.indexOf(`\n${l}\n`); assert.ok(i > prev && i < g1, l); prev = i; }
    const facts = md.indexOf(`\n${factsHeading(mondays[7])}\n`);
    assert.ok(facts > prev && facts < g1, 'facts after the sentences');
    assert.doesNotMatch(md, /[─-╿]/, 'no box-drawing');
    assert.doesNotMatch(md, /\u001b/, 'no ANSI escapes');
  }
});

// ---- AC4: address cap ----
const capOf = (trusted: boolean[]) => mondays.flatMap((_, w) => trusted.map((t) => ({ day: dayOf(w, 2), trusted: t })));

test('F-31 AC4: with no cap marks the flag prints beside the strict rows, and the strict rows still print the same', () => {
  const rows = mondays.map((_, w) => view(w, 40 + w));
  const none = buildReadout(only(rows), NOW), live = buildReadout(only(rows, { cap: capOf([true]) }), NOW);
  assert.deepEqual(g3(none, CAP_ROW), mondays.map(() => CAP_NOT_LIVE));
  assert.equal(CAP_NOT_LIVE, 'not readable as a gate: address cap not live');
  assert.ok(none.includes(`\n${CAP_FLAG_LINE}\n`));
  assert.ok(none.includes(`\n${capFactLine('none')}\n`));
  assert.deepEqual(g3(none, STRICT), g3(live, STRICT));
  assert.deepEqual(g3(none, STRICT), mondays.map((_, w) => String(40 + w)));
  assert.equal(cellsOf(rowLine(none, STRICT))[1], '≥ 5,000', 'the threshold stays beside the strict figure');
  assert.equal(cellsOf(rowLine(none, CAP_ROW))[1], '', 'no threshold beside the flag');
  const lines = none.split('\n');
  assert.equal(lines.indexOf(rowLine(none, CAP_ROW)!), lines.indexOf(rowLine(none, STRICT)!) + 1, 'the cap row sits right under the strict row');
});

test('F-31 AC4: all-trusted weeks read live; a week with both kinds, or only untrusted, is not live', () => {
  const rows = [view(7, 50)];
  const live = buildReadout(only(rows, { cap: capOf([true]) }), NOW);
  assert.deepEqual(g3(live, CAP_ROW), mondays.map(() => 'live'));
  assert.ok(live.includes(`\n${capFactLine('live')}\n`));
  assert.ok(!live.includes(CAP_FLAG_LINE));
  const mixed = buildReadout(only(rows, { cap: [...capOf([true]), { day: dayOf(3, 5), trusted: false }] }), NOW);
  assert.deepEqual(g3(mixed, CAP_ROW), mondays.map((_, w) => (w === 3 ? CAP_NOT_LIVE : 'live')));
  assert.ok(mixed.includes(`\n${CAP_FLAG_LINE}\n`), 'the flag prints when any printed week is not live');
  assert.ok(mixed.includes(`\n${capFactLine('live')}\n`), 'the latest week is live');
  const lastMixed = buildReadout(only(rows, { cap: [...capOf([true]), { day: dayOf(7, 6), trusted: false }] }), NOW);
  assert.ok(lastMixed.includes(`\n${capFactLine('untrusted')}\n`));
  const untrusted = buildReadout(only(rows, { cap: capOf([false]) }), NOW);
  assert.deepEqual(g3(untrusted, CAP_ROW), mondays.map(() => CAP_NOT_LIVE));
  assert.ok(untrusted.includes(`\n${capFactLine('untrusted')}\n`));
  const outside = buildReadout(only(rows, { cap: [{ day: '2026-10-28', trusted: false }, ...capOf([true])] }), NOW);
  assert.deepEqual(g3(outside, CAP_ROW), mondays.map(() => 'live'), 'a mark in the running week is not read');
  assert.equal(g3(live, STRICT)[7], '50');
});

test('F-31 AC4: markCapDay makes 1 write for 50 concurrent beacons, backs off 5 minutes after a failure, and writes again on a new UTC day', async () => {
  assert.equal(CAP_RETRY_MS, 300_000);
  const writes: [string, boolean][] = [];
  const slow = (day: string, t: boolean) => { writes.push([day, t]); return new Promise<void>((r) => setTimeout(r, 5)); };
  const t0 = new Date('2001-03-04T10:00:00Z');
  await Promise.all(Array.from({ length: 50 }, () => markCapDay(true, t0, slow)));
  assert.deepEqual(writes, [['2001-03-04', true]]);
  await markCapDay(true, new Date('2001-03-04T23:59:00Z'), slow);
  assert.equal(writes.length, 1, 'a succeeded mark is not written again that day');
  await Promise.all(Array.from({ length: 5 }, () => markCapDay(false, t0, slow)));
  assert.deepEqual(writes.at(-1), ['2001-03-04', false], 'the other kind is its own mark');
  assert.equal(writes.length, 2);
  await markCapDay(true, new Date('2001-03-05T00:00:01Z'), slow);
  assert.deepEqual(writes.at(-1), ['2001-03-05', true], 'a new UTC day writes again');

  let tries = 0;
  const failing = async () => { tries++; throw Object.assign(new Error('down'), { code: '57P01' }); };
  const f0 = new Date('2001-04-01T10:00:00Z');
  const results = await Promise.allSettled(Array.from({ length: 10 }, () => markCapDay(false, f0, failing)));
  assert.equal(tries, 1, 'concurrent calls share the one attempt');
  assert.ok(results.every((r) => r.status === 'rejected'));
  await markCapDay(false, new Date(f0.getTime() + CAP_RETRY_MS - 1000), failing);
  assert.equal(tries, 1, 'no retry inside the backoff');
  await assert.rejects(markCapDay(false, new Date(f0.getTime() + CAP_RETRY_MS), failing));
  assert.equal(tries, 2, 'a retry after the backoff');
  const ok: string[] = [];
  await markCapDay(false, new Date(f0.getTime() + 2 * CAP_RETRY_MS), async (d) => { ok.push(d); });
  assert.deepEqual(ok, ['2001-04-01']);
});

const UA = 'Example/5.0 (X11; Linux x86_64) Generic/1.0';
const hdrs = () => new Headers({ 'user-agent': UA, 'sec-fetch-site': 'same-origin', 'sec-fetch-mode': 'cors', origin: 'http://app.test', host: 'app.test' });
const post = (body: string) => new Request('http://app.test/api/views', { method: 'POST', headers: hdrs(), body });
const BEACON = JSON.stringify({ path: '/u/f31sample', ref: 'external' });
const routeDeps = (o: Partial<BeaconDeps>, views: unknown[], marks: boolean[]): BeaconDeps => ({
  viewer: async () => null,
  recordView: async (k) => { views.push(k); },
  recordDrop: async () => {},
  viewedUserId: async () => 31,
  limited: () => 'ok',
  markCap: async (t) => { marks.push(t); },
  trusted: () => true,
  ...o,
});

test('F-31 AC4: the beacon route marks the cap once per counted beacon, never for a bad body or past the cap, and a failing mark loses no view', async () => {
  const views: unknown[] = [], marks: boolean[] = [];
  assert.equal((await handleBeacon(post('not json'), routeDeps({}, views, marks))).status, 204);
  assert.deepEqual(marks, [], 'a bad body marks nothing');
  assert.equal((await handleBeacon(post(BEACON), routeDeps({ trusted: () => false }, views, marks))).status, 204);
  assert.deepEqual(marks, [false], 'one mark with the injected trust');
  assert.equal(views.length, 1);
  await handleBeacon(post(BEACON), routeDeps({ limited: () => 'over' }, views, marks));
  assert.deepEqual(marks, [false], 'past the cap: no mark');
  assert.equal(views.length, 1);
  const logged: string[] = [];
  const orig = console.error;
  console.error = (...a: unknown[]) => { logged.push(a.map(String).join(' ')); };
  try {
    const tasks: (() => Promise<void>)[] = [];
    const r = await handleBeacon(post(BEACON), routeDeps({ markCap: async () => { throw Object.assign(new Error('203.0.113.9 down'), { code: '57P01' }); }, defer: (t) => { tasks.push(t); } }, views, marks));
    assert.equal(r.status, 204);
    assert.equal(tasks.length, 1, 'the mark is handed to defer, not awaited');
    await Promise.all(tasks.map((t) => t()));
  } finally { console.error = orig; }
  assert.equal(views.length, 2, 'the view is still recorded');
  assert.equal(logged.length, 1);
  assert.ok(!logged[0].includes('203.0.113.9'), 'no address in the log line');
  // Injected deps without markCap stay as before (no database touched).
  const v2: unknown[] = [];
  const plain = routeDeps({}, v2, []);
  delete plain.markCap;
  delete plain.trusted;
  assert.equal((await handleBeacon(post(BEACON), plain)).status, 204);
  assert.equal(v2.length, 1);
});

test('F-31 AC4: a mark that never settles neither delays the response nor stops the view (orchestrator review of #98)', async () => {
  const views: unknown[] = [];
  const r = await handleBeacon(post(BEACON), routeDeps({ markCap: () => new Promise<void>(() => {}) }, views, []));
  assert.equal(r.status, 204);
  assert.equal(views.length, 1, 'the view is recorded while the mark hangs');
});

test('F-31 AC4: markCapDay treats a write unsettled past its timeout as failed, so the memo never sticks and a later mark retries', async () => {
  const t0 = new Date('2003-07-08T10:00:00Z');
  let calls = 0;
  const hung = () => { calls++; return new Promise<void>(() => {}); };
  await assert.rejects(markCapDay(true, t0, hung, 20), /timed out/);
  await markCapDay(true, new Date(t0.getTime() + 1000), hung, 20); // inside the backoff: no second attempt
  assert.equal(calls, 1);
  const ok: string[] = [];
  await markCapDay(true, new Date(t0.getTime() + CAP_RETRY_MS), async (d) => { ok.push(d); }, 20);
  assert.deepEqual(ok, ['2003-07-08'], 'retried after the backoff');
});

// ---- AC1/AC2: the strict family ----
test('F-31 AC2: strictFamily prints the pair only when both parts are 0 or 5+, and never a bound', () => {
  assert.deepEqual(strictFamily({ a: 7, b: 0, c: 9 }, null, false), { trader: '7', filer: '9', withoutInternal: null, top: '(s)' });
  assert.deepEqual(strictFamily({ a: 57, b: 0, c: 3 }, null, false), { trader: '(s)', filer: '(s)', withoutInternal: null, top: '(s)' });
  assert.deepEqual(strictFamily({ a: 0, b: 0, c: 0 }, null, true), { trader: '0', filer: '0', withoutInternal: '0', top: '—' });
  assert.equal(strictFamily({ a: 55, b: 2, c: 0 }, null, true).withoutInternal, '(s)');
  assert.equal(strictFamily({ a: 50, b: 7, c: 0 }, null, true).withoutInternal, '50');
  // The pair has priority: printing both would make a = 3 known.
  const f = strictFamily({ a: 3, b: 6, c: 6 }, null, true);
  assert.deepEqual([f.trader, f.filer, f.withoutInternal], ['9', '6', '(s)']);
});

// AC6: the concentration row.
test('F-31 AC6: the largest profile share: 30 + 10 → 75%; M 4, S − M 3 and S 0 cases', () => {
  assert.equal(strictFamily({ a: 40, b: 0, c: 0 }, 30, false).top, '75%');
  assert.equal(strictFamily({ a: 40, b: 0, c: 0 }, 4, false).top, '(s)');
  assert.equal(strictFamily({ a: 33, b: 0, c: 0 }, 30, false).top, '(s)');
  assert.equal(strictFamily({ a: 0, b: 0, c: 0 }, null, false).top, '—');
  assert.equal(strictFamily({ a: 20, b: 0, c: 0 }, 20, false).top, '100%');
  assert.equal(strictFamily({ a: 30, b: 0, c: 0 }, 31, false).top, '(s)', 'an inconsistent top value');
  assert.equal(strictFamily({ a: 20, b: 0, c: 10 }, 13, false).top, '43%');
  assert.equal(strictFamily({ a: 20, b: 0, c: 10 }, 8, false).top, '(s)', 'c − M = 2 is checked too: the top profile could be a filer');
  const rows = [view(7, 30, { handle: 'zed_trader', user_id: 987654, return_pct: 12.34 } as Partial<RollupRow>), view(7, 10)];
  const md = buildReadout(only(rows, { top: [{ week: dayOf(7), n: 30, user_id: 987654, handle: 'zed_trader' } as { week: string; n: number }] }), NOW);
  assert.equal(g3(md, TOP_ROW)[7], '75%');
  for (const bad of ['zed_trader', '987654', '12.34']) assert.ok(!md.includes(bad), bad);
  assert.equal(g3(md, TOP_ROW)[6], '—', 'S 0 in an empty week');
  const small = buildReadout(only([view(7, 4), view(7, 4), view(7, 2)], { top: [{ week: dayOf(7), n: 4 }] }), NOW);
  assert.equal(g3(small, TOP_ROW)[7], '(s)', 'the largest profile has under 5 views');
});

// Every non-empty subset of {a, b, c} (as atom indices).
const SUBSETS = [[0], [1], [2], [0, 1], [0, 2], [1, 2], [0, 1, 2]];
test('F-31 AC2: exhaustive (S 0, 5..24; every split; internal on/off; every top): identical printed family never pins a count from 1 to 4', () => {
  // group key → quantity name → the values it takes across the group
  const groups = new Map<string, Map<string, Set<number>>>();
  let cases = 0;
  const add = (key: string, q: [string, number][]) => {
    let g = groups.get(key);
    if (!g) groups.set(key, (g = new Map()));
    for (const [name, v] of q) { let s = g.get(name); if (!s) g.set(name, (s = new Set())); s.add(v); }
  };
  for (const S of [0, ...Array.from({ length: 20 }, (_, i) => i + 5)]) {
    for (const internalSet of [false, true]) {
      for (let a = 0; a <= S; a++) for (let b = 0; a + b <= S; b++) {
        if (!internalSet && b > 0) continue; // with no internal list every trader is in a
        const c = S - a - b, atoms = [a, b, c];
        const tops: [number, number | null][] = [[-1, null]];
        for (let x = 0; x < 3; x++) for (let M = 1; M <= atoms[x]; M++) tops.push([x, M]);
        for (const [x, M] of tops) {
          cases++;
          const f = strictFamily({ a, b, c }, M, internalSet);
          const topKey = /%$/.test(f.top) ? `M=${M}` : f.top; // worst case: a printed percent gives M exactly
          const key = [S, internalSet, f.trader, f.filer, f.withoutInternal, topKey].join('|');
          const q: [string, number][] = [];
          for (const U of SUBSETS) {
            const sum = U.reduce((s, i) => s + atoms[i], 0);
            q.push([`U${U.join('')}`, sum], [`R${U.join('')}`, sum - (M !== null && U.includes(x) ? M : 0)]);
          }
          add(key, q);
        }
      }
    }
  }
  assert.ok(cases > 50_000, `${cases} cases`);
  for (const [key, g] of groups) {
    for (const [name, vals] of g) {
      if (vals.size !== 1) continue;
      const [v] = vals;
      assert.ok(!(v >= 1 && v <= 4), `group ${key} pins ${name} = ${v}`);
    }
  }
});

test('F-31 AC2: buildReadout prints exactly strictFamily in exact weeks and "(s)" in every other week', () => {
  // Per week: [a, b, c, top]; week 2's strict figure is 3 (hidden) and week 1's is its complement.
  const plan: [number, number, number, number | null][] = [
    [20, 0, 9, 12], [7, 6, 0, null], [2, 0, 1, null], [0, 0, 0, null], [33, 5, 12, 25], [41, 0, 0, 41], [10, 3, 8, 6], [60, 9, 0, 30],
  ];
  const rows: RollupRow[] = [];
  plan.forEach(([a, b, c], w) => {
    if (a) rows.push(view(w, a));
    if (b) rows.push(view(w, b, { internal: true }));
    if (c) rows.push(view(w, c, { filer: true }));
  });
  const top = plan.flatMap(([, , , t], w) => (t === null ? [] : [{ week: dayOf(w), n: t }]));
  for (const internal of [SET, undefined]) {
    const md = buildReadout(only(rows, { top, internal }), NOW);
    const strict = g3(md, STRICT);
    let exactWeeks = 0;
    plan.forEach(([a, b, c, t], w) => {
      const got = [g3(md, TRADER_ROW)[w], g3(md, FILER_ROW)[w], internal ? g3(md, G3_INTERNAL_ROW)[w] : null, g3(md, TOP_ROW)[w]];
      if (!exactCell(strict[w])) { assert.deepEqual(got, ['(s)', '(s)', internal ? '(s)' : null, '(s)'], `week ${w}`); return; }
      exactWeeks++;
      assert.equal(strict[w], String(a + b + c));
      const f = strictFamily({ a, b, c }, t, !!internal);
      assert.deepEqual(got, [f.trader, f.filer, f.withoutInternal, f.top], `week ${w}`);
    });
    assert.ok(exactWeeks >= 5);
    if (!internal) assert.equal(rowLine(md, G3_INTERNAL_ROW), undefined);
  }
});

test('F-31 AC2: cross-table: a filer 3 inside an exact strict 60, an internal 2, S − M 4 and a self-view 2 are never recoverable', () => {
  const base = mondays.map((_, w) => view(w, 50));
  const md = buildReadout(only([...base.slice(0, 7), view(7, 57), view(7, 3, { filer: true })]), NOW);
  assert.equal(g3(md, STRICT)[7], '60');
  assert.deepEqual([g3(md, TRADER_ROW)[7], g3(md, FILER_ROW)[7]], ['(s)', '(s)']);
  for (const c of tableCells(md)) assert.ok(!['57', '3', '≥ 57', '≥ 3'].includes(c), c);

  const mi = buildReadout(only([...base.slice(0, 7), view(7, 55), view(7, 2, { internal: true })], { internal: SET }), NOW);
  assert.equal(g3(mi, G3_INTERNAL_ROW)[7], '(s)');
  assert.equal(g3(mi, TRADER_ROW)[7], '57');
  for (const c of tableCells(mi)) assert.ok(!['55', '2', '≥ 55'].includes(c), c);

  const mt = buildReadout(only([...base.slice(0, 7), view(7, 20)], { top: [{ week: dayOf(7), n: 16 }] }), NOW);
  assert.equal(g3(mt, TOP_ROW)[7], '(s)', 'S − M = 4');
  const mt2 = buildReadout(only([...base.slice(0, 7), view(7, 20)], { top: [{ week: dayOf(7), n: 15 }] }), NOW);
  assert.equal(g3(mt2, TOP_ROW)[7], '75%');

  const ms = buildReadout(only([...base, view(4, 2, { self_view: true }), view(5, 2, { self_view: true, surface: 'trade' }), view(5, 9, { self_view: true, surface: 'month' }), view(6, 30, { self_view: true, demo: true }), view(6, 30, { self_view: true, surface: 'feed' })]), NOW);
  assert.deepEqual(g3(ms, SELF_ROW), ['0', '0', '0', '0', '<5', '(s)', '0', '0'], 'self-views hide a small week and its complement; Demo and non-record surfaces are out');
  assert.equal(cellsOf(rowLine(ms, SELF_ROW)).length, 10, 'no total column');
  assert.equal(g3(ms, STRICT)[4], '50', 'self-views are in no other row');
});

test('F-31 AC2: tagged link or external referrer is a sum of base cells: a hidden tagged 3 is not recoverable against strict, the profile row or "all"', () => {
  const rows = [...mondays.map((_, w) => view(w, 40)), view(2, 3, { via: 'card', ref_class: 'none' }),
    ...mondays.map((_, w) => view(w, 12, { via: 'inv_t', ref_class: 'none' })), view(1, 30, { via: 'inv_h', ref_class: 'none', demo: true }),
    ...mondays.map((_, w) => view(w, 8, { via: 'nav', ref_class: 'none' })), ...mondays.map((_, w) => view(w, 6, { via: 'story', ref_class: 'internal' }))];
  const md = buildReadout(only(rows), NOW);
  assert.equal(g3(md, TAGGED_ROW)[0], '58', '40 external + 12 invite + 6 story; nav is an in-app code; Demo invite landings stay out');
  assert.equal(g3(md, TAGGED_ROW)[1], '58');
  assert.equal(g3(md, TAGGED_ROW)[2], '≥ 58');
  for (const c of tableCells(md)) assert.ok(!['61', '43', '3', '≥ 61', '69', '≥ 69', '≥ 3'].includes(c), c);
});

test('F-31 AC2: the G3 table has no Total column and no row sums family rows over weeks', () => {
  const md = buildReadout({ ...baseInput(), internal: SET }, NOW);
  const g3s = md.slice(md.indexOf('## G3'), md.indexOf('## G4'));
  const head = cellsOf(g3s.split('\n').find((l) => l.startsWith('| Metric')));
  assert.ok(!head.includes('Total'));
  assert.equal(head.length, 10);
  for (const l of [...F31_ROW_LABELS, G3_INTERNAL_ROW]) assert.equal(cellsOf(rowLine(md, l)).length, 10, l);
  const labels = g3s.split('\n').filter((l) => l.startsWith('| ') && !l.startsWith('| Metric')).map((l) => cellsOf(l)[0]);
  assert.deepEqual(labels.slice(0, 8), [STRICT, CAP_ROW, TRADER_ROW, FILER_ROW, TOP_ROW, G3_INTERNAL_ROW, TAGGED_ROW, 'partial: tagged links, card']);
  assert.equal(labels.at(-1), SELF_ROW);
  for (const l of labels.slice(1)) assert.equal(cellsOf(rowLine(md, l))[1], '', `no threshold beside ${l}`);
});

// ---- AC5: internal handles ----
test('F-31 AC5: parseInternalHandles: unset, invalid and filer entries are counted, never kept', () => {
  assert.deepEqual(parseInternalHandles(undefined), { state: 'unset', handles: [], ignored: 0 });
  assert.deepEqual(parseInternalHandles('   '), { state: 'unset', handles: [], ignored: 0 });
  assert.deepEqual(parseInternalHandles(' @F31_a , f31b,, x , pf_f31c '), { state: 'set', handles: ['f31_a', 'f31b'], ignored: 2 });
  assert.deepEqual(parseInternalHandles('f31b f31b\nF31B'), { state: 'set', handles: ['f31b'], ignored: 0 });
  assert.deepEqual(parseInternalHandles('x, pf_abc, @@ab'), { state: 'none-valid', handles: [], ignored: 3 });
});

test('F-31 AC5: env unset prints "not removed" and no internal rows; set prints both rows and the runs line; none-valid prints neither', () => {
  const traders = [...Array.from({ length: 49 }, () => T()), { ...T(), internal: true }];
  const rows = [...mondays.map((_, w) => view(w, 40)), view(7, 9, { internal: true })];
  const input = (internal?: ReadoutInput['internal']) => ({ ...only(rows), g1: { strict: 50, partial: 0 }, g2: { traders, firstDay: null, retentionDays: 120 }, internal });
  const unset = buildReadout(input(), NOW);
  assert.ok(unset.includes(`\n${internalFactLine('unset', 0)}\n`));
  for (const l of [...F31_INTERNAL_ROW_LABELS, INTERNAL_RUNS_LINE, INTERNAL_LINE]) assert.ok(!unset.includes(l), l);
  const none = buildReadout(input({ state: 'none-valid', ignored: 2 }), NOW);
  assert.ok(none.includes(`\n${internalFactLine('none-valid', 2)}\n`));
  for (const l of [...F31_INTERNAL_ROW_LABELS, INTERNAL_RUNS_LINE, INTERNAL_LINE]) assert.ok(!none.includes(l), l);
  const set = buildReadout(input({ state: 'set', ignored: 1, listed: 1 }), NOW);
  assert.ok(set.includes(`\n${internalFactLine('set', 1, 1)}\n`));
  assert.ok(set.includes(`\n${INTERNAL_RUNS_LINE}\n`));
  assert.ok(set.includes(`\n${INTERNAL_LINE}\n`));
  assert.deepEqual(cellsOf(rowLine(set, G1_INTERNAL_ROW)), [G1_INTERNAL_ROW, '', '49']);
  assert.equal(g3(set, G3_INTERNAL_ROW)[7], '40');
  assert.equal(g3(set, G3_INTERNAL_ROW)[6], '40');
  const lines = set.split('\n');
  assert.equal(lines.indexOf(rowLine(set, G1_INTERNAL_ROW)!), lines.indexOf(rowLine(set, 'partial: traders whose connections are all frozen or failed (none connected)')!) + 1);
});

test('F-31 AC5: the G1 internal row: 50 − 1 prints 49; 7 − 3 and G1 3 print "(s)"', () => {
  assert.equal(g1Internal(50, 1), '49');
  assert.equal(g1Internal(7, 3), '(s)');
  assert.equal(g1Internal(3, 0), '(s)');
  assert.equal(g1Internal(3, 3), '(s)');
  assert.equal(g1Internal(6, 1), '5');
  assert.equal(g1Internal(0, 0), '0');
  assert.equal(g1Internal(8, 8), '0');
  const md = buildReadout({ ...only([]), g1: { strict: 7, partial: 0 }, g2: { traders: [...Array.from({ length: 4 }, () => T()), ...Array.from({ length: 3 }, () => ({ ...T(), internal: true }))], firstDay: null, retentionDays: 120 }, internal: SET }, NOW);
  assert.equal(cellsOf(rowLine(md, G1_INTERNAL_ROW))[2], '(s)');
  const blind = buildReadout({ ...only([]), g1: { strict: 9, partial: 0 }, g2: { traders: [T()], firstDay: null, retentionDays: 120 }, internal: SET }, NOW);
  assert.equal(cellsOf(rowLine(blind, G1_INTERNAL_ROW))[2], '(s)', 'a trader list that does not match G1');
});

// ---- AC8: the baseline ----
test('F-31 AC8: with the env unset and the baseline input, the output is main\'s text plus the new block and rows only', () => {
  const md = buildReadout(baseInput(), BASE_NOW);
  const out = md.split('\n'), base = BASE_TEXT.split('\n');
  const block = out.slice(out.indexOf(LIMITS_HEADING), out.indexOf('## G1'));
  assert.ok(block.length > LIMIT_LINES.length);
  const notes = new Set([SPLIT_LINE, TOP_LINE, SELF_LINE]);
  let j = 0;
  const extra: string[] = [];
  for (const l of out) { if (j < base.length && l === base[j]) j++; else extra.push(l); }
  assert.equal(j, base.length, `main's line ${j} is missing or out of order: ${base[j]}`);
  for (const l of extra) {
    const ok = block.includes(l) || notes.has(l) || F31_ROW_LABELS.some((r) => l.startsWith(`| ${r} |`));
    assert.ok(ok, `unexpected line: ${l}`);
  }
  for (const r of F31_ROW_LABELS) assert.ok(extra.some((l) => l.startsWith(`| ${r} |`)), r);
  for (const n of notes) assert.ok(extra.includes(n), n);
  for (const l of [LIMITS_HEADING, ...LIMIT_LINES, factsHeading(mondays[7]), capFactLine('none'), CAP_FLAG_LINE, internalFactLine('unset', 0)]) assert.ok(extra.includes(l), l);
  for (const l of F31_INTERNAL_ROW_LABELS) assert.ok(!md.includes(l), l);
  // The plan's worked example (§3.6).
  assert.deepEqual(g3(md, TRADER_ROW), ['(s)', '48', '50', '(s)', '54', '56', '58', '60']);
  assert.deepEqual(g3(md, FILER_ROW), ['(s)', '0', '0', '(s)', '0', '0', '0', '0']);
  assert.deepEqual(g3(md, TOP_ROW), mondays.map(() => '(s)'));
  assert.deepEqual(g3(md, TAGGED_ROW), ['≥ 18', '60', '62', '≥ 21', '66', '68', '70', '72']);
  assert.deepEqual(g3(md, SELF_ROW), ['0', '0', '0', '0', '<5', '0', '0', '0']);
  assert.deepEqual(g3(md, CAP_ROW), mondays.map(() => CAP_NOT_LIVE));
  assert.equal(weekHeader(mondays[7]), '2026-W43, Oct 19–25');
});
