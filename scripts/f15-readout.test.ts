// F-15 readout (scripts/f15-readout.ts): pure tests, no database. Acceptance criteria A8 (no printed cell under 5),
// A9 (readout text) and A10 (writes outside the repo; no handle or return in the output).
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  G2_TEXT, G3_LABEL, G3_OWNER_LINE, G4_TEXT, DELETION_LINE, RECONCILE_LINE, buildReadout, parseOutArg, resolveOut, suppress, weekWindow,
  type ReadoutInput, type RollupRow,
} from './f15-readout.ts';

const NOW = new Date('2026-11-01T12:00:00Z'); // a Sunday in 2026-W44: printed weeks 2026-W36 .. 2026-W43
const { mondays } = weekWindow(NOW);
const dayOf = (week: number, offset = 0) => new Date(mondays[week] + offset * 86_400_000).toISOString().slice(0, 10);
const view = (week: number, n: number, o: Partial<RollupRow> = {}): RollupRow =>
  ({ day: dayOf(week), surface: 'profile', ref_class: 'external', via: 'none', self_view: false, n, ...o });

// Cells 1..4 everywhere, plus rows where exactly one week is small.
function fixture(): ReadoutInput {
  const rollup: RollupRow[] = [];
  for (let w = 0; w < 8; w++) rollup.push(view(w, w === 3 ? 2 : 40 + w)); // strict G3: one small week
  rollup.push(view(0, 1, { via: 'inv_t', ref_class: 'none' }), view(1, 3, { via: 'inv_h', ref_class: 'none' }));
  rollup.push(view(2, 4, { surface: 'trade', via: 'trade' }), view(5, 4, { surface: 'month', via: 'month' }));
  for (let w = 0; w < 8; w++) rollup.push(view(w, w === 6 ? 1 : 12, { via: 'card', ref_class: 'none' })); // one small cell in a kept row
  for (let w = 0; w < 8; w++) rollup.push(view(w, 9, { surface: 'feed', ref_class: 'internal' }));
  rollup.push(view(4, 2, { surface: 'login', via: 'nav', ref_class: 'internal' }), view(4, 3, { self_view: true }));
  return {
    rollup,
    drops: [
      { day: dayOf(0), surface: 'profile', reason: 'declared_bot', n: 30 },
      { day: dayOf(0, 2), surface: 'other', reason: 'declared_bot', n: 25 },
      { day: dayOf(1), surface: 'feed', reason: 'rate', n: 1 },
      { day: dayOf(1), surface: 'feed', reason: 'automation', n: 20 },
      { day: dayOf(2), surface: 'feed', reason: 'no_fetch_metadata', n: 4 },
    ],
    g1: { strict: 3, partial: 1 },
  };
}

const tableCells = (md: string) =>
  md.split('\n').filter((l) => l.startsWith('|') && !/^\|(-+\|)+$/.test(l)).flatMap((l) => l.slice(1, -1).split('|').map((c) => c.trim()));
const rowOf = (md: string, label: string) => md.split('\n').find((l) => l.startsWith(`| ${label} |`));

test('no printed count cell is 1-4; small cells read "<5"', () => {
  const md = buildReadout(fixture(), NOW);
  for (const c of tableCells(md)) assert.doesNotMatch(c, /^(≥ )?[1-4]$/, `cell "${c}"`);
  assert.match(md, /<5/);
  assert.ok(md.includes('| Traders with a connected broker | ≥ 50 | <5 |')); // G1 strict 3
  assert.match(md, /\| partial: traders whose connections [^|]+\| {2}\| <5 \|/); // G1 partial 1
});

test('exactly one small cell in a row also hides the next-smallest, and the row total is "≥ n"', () => {
  const md = buildReadout(fixture(), NOW);
  const strict = md.split('\n').find((l) => l.startsWith('| Profile views from external referrers / week'))!;
  const cells = strict.slice(1, -1).split('|').map((c) => c.trim()).slice(2);
  assert.equal(cells.filter((c) => c === '<5').length, 1);
  assert.equal(cells.filter((c) => c === '(s)').length, 1);
  assert.equal(cells[3], '<5');
  assert.equal(cells[0], '(s)'); // 40 is the next-smallest in the row
  const card = rowOf(md, 'profile | card')!;
  assert.match(card, /\| ≥ [\d,]+ \|$/);
  assert.doesNotMatch(card, /\| 96 \|$/);
});

test('suppress: one small cell per row/column gets a complement; clean rows stay exact', () => {
  assert.deepEqual(suppress([[10, 3, 7, 20]], false), [[false, true, true, false]]);
  assert.deepEqual(suppress([[10, 20]], false), [[false, false]]);
  assert.deepEqual(suppress([[0, 3, 0]], false), [[false, true, false]]); // zeros print "0"; nothing to pair with
  const h = suppress([[10, 3], [8, 9]], true);
  assert.equal(h.flat().filter(Boolean).length >= 3, true); // row and column complements
});

test('small surface × via rows roll into "other"; totals only when nothing in the row is hidden', () => {
  const md = buildReadout(fixture(), NOW);
  assert.ok(rowOf(md, 'other | other'));
  assert.equal(rowOf(md, 'profile | inv_t'), undefined);
  assert.equal(rowOf(md, 'trade | trade'), undefined);
  const clean = buildReadout({ rollup: mondays.map((_, w) => view(w, 9, { surface: 'feed', ref_class: 'internal' })), drops: [], g1: { strict: 0, partial: 0 } }, NOW);
  assert.match(rowOf(clean, 'feed | none')!, /\| 72 \|$/); // 8 × 9, nothing hidden: exact total
  assert.match(rowOf(clean, 'all | all')!, /\| 72 \|$/);
});

test('the four DESIGN §3.5 metric and threshold lines are printed verbatim', () => {
  const md = buildReadout(fixture(), NOW);
  for (const line of [
    'Traders with a connected broker | ≥ 50',
    'Of those, share their card at least once | ≥ 60%',
    'Profile views from external referrers / week (views, not people) | ≥ 5,000',
    'Viewer D7 return | ≥ 15%',
  ]) assert.ok(md.includes(line), line);
  assert.ok(md.includes('Profile views from external referrers / week'));
  assert.ok(md.includes('≥ 5,000'));
});

test('G2, G3 and G4 strings; G4 has no signed-in count', () => {
  const md = buildReadout(fixture(), NOW);
  assert.equal(G2_TEXT, 'after the share_action slice');
  assert.equal(G4_TEXT, "strict G4 can't be read in this slice; signed-out D7 return is not measured");
  assert.ok(md.includes(`| ${G2_TEXT} |`));
  assert.ok(md.includes(`| ${G4_TEXT} |`));
  assert.ok(md.includes(G3_LABEL));
  assert.ok(md.includes(G3_OWNER_LINE));
  assert.equal(G3_OWNER_LINE, "Signed-out owner views can't be told from other views.");
  assert.doesNotMatch(md, /signed-in/i);
  const g3 = md.slice(md.indexOf('## G3'), md.indexOf('## G4'));
  assert.ok(g3.indexOf('Profile views from external referrers / week') < g3.indexOf('partial:'), 'strict row first');
  for (const p of ['card', 'story', 'trade/month share', 'invite links (inv_*)', 'nav/profile CTA', 'trade surface', 'month surface']) {
    assert.ok(g3.includes(p), p);
  }
  assert.match(md, /partial: traders whose connections/);
});

test('no handle, @, user id or return in the output, even when inputs carry them', () => {
  const input = fixture();
  const leaky = { handle: 'zed_trader', display_name: 'Zed Q Person', user_id: 987654, return_pct: 12.34, avg: '7.77%' };
  input.rollup = input.rollup.map((r) => ({ ...r, ...leaky }) as RollupRow);
  input.rollup.push(view(0, 50, { surface: '@zed_trader' }), view(0, 50, { via: '@zed_trader' }), view(1, 50, { via: 'zed_trader' }));
  input.drops.push({ day: dayOf(0), surface: 'zed_trader', reason: 'zed_trader', n: 50 });
  (input.g1 as Record<string, unknown>).handle = 'zed_trader';
  const md = buildReadout(input, NOW);
  for (const bad of ['zed_trader', 'Zed Q Person', '987654', '12.34', '7.77', '@', 'return_pct']) assert.ok(!md.includes(bad), bad);
  assert.doesNotMatch(md, /[+-]?\d+\.\d+% (return|gain|loss)/i);
});

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('resolveOut refuses the repo root, a subfolder and a symlink into the repo', () => {
  assert.throws(() => resolveOut(repo, repo), /outside/);
  assert.throws(() => resolveOut(path.join(repo, 'scripts'), repo), /outside/);
  assert.throws(() => resolveOut(path.join(repo, 'not-yet', 'deeper'), repo), /outside/);
  assert.throws(() => resolveOut(path.join(repo, '..foo'), repo), /outside/);
  const tmp = mkdtempSync(path.join(os.tmpdir(), 'f15-readout-'));
  try {
    const link = path.join(tmp, 'into-repo');
    symlinkSync(repo, link);
    assert.throws(() => resolveOut(link, repo), /outside/);
    assert.throws(() => resolveOut(path.join(link, 'new-dir'), repo), /outside/);
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});

test('resolveOut accepts a tmp dir and a sibling sharing the repo name prefix', () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), 'f15-readout-'));
  try {
    assert.equal(resolveOut(tmp, repo), realpathSync(tmp));
    assert.equal(resolveOut(path.join(tmp, 'new', 'dir'), repo), path.join(realpathSync(tmp), 'new', 'dir'));
    const fakeRoot = path.join(tmp, 'repo');
    mkdirSync(fakeRoot);
    const sibling = path.join(tmp, 'repo2');
    mkdirSync(sibling);
    assert.equal(resolveOut(sibling, fakeRoot), realpathSync(sibling));
    assert.throws(() => resolveOut(fakeRoot, fakeRoot), /outside/);
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});

test('a missing --out throws', () => {
  assert.throws(() => resolveOut(undefined, repo), /--out/);
  assert.throws(() => resolveOut('', repo), /--out/);
  assert.throws(() => parseOutArg([]), /--out/);
  assert.throws(() => parseOutArg(['--out']), /--out/);
  assert.throws(() => parseOutArg(['--out', '--other']), /--out/);
  assert.equal(parseOutArg(['--out', '/x']), '/x');
  assert.equal(parseOutArg(['--out=/y']), '/y');
});

const cellsOf = (line: string | undefined) => (line ?? '').slice(1, -1).split('|').map((c) => c.trim());
const g3Row = (md: string, label: string) => cellsOf(md.split('\n').find((l) => l.startsWith(`| ${label}`))).slice(2);
const tableRow = (md: string, label: string) => cellsOf(rowOf(md, label)).slice(2);
const only = (rows: RollupRow[]): ReadoutInput => ({ rollup: rows, drops: [], g1: { strict: 0, partial: 0 } });

test('cross-table: G3 invite minus the surface × via table cannot recover a hidden 3 (20 + 3)', () => {
  const rows = [...mondays.map((_, w) => view(w, 20, { via: 'inv_t', ref_class: 'none' })), view(5, 3, { surface: 'feed', via: 'inv_t', ref_class: 'none' })];
  const md = buildReadout(only(rows), NOW);
  const invite = g3Row(md, 'partial: invite links (inv_*)');
  assert.equal(tableRow(md, 'profile | inv_t')[5], '20');
  assert.equal(rowOf(md, 'feed | inv_t'), undefined); // rolled into other
  assert.equal(tableRow(md, 'other | other')[5], '<5');
  assert.equal(invite[5], '≥ 20'); // never 23
  assert.ok(!md.includes('| 23 |') && !md.includes('≥ 23'));
  assert.equal(invite[4], '20');
  assert.equal(tableRow(md, 'all | all')[5], '≥ 20');
});

test('cross-table: strict G3 vs the profile row, and counted views vs the drop share, hide a small cell', () => {
  const rows = [...mondays.map((_, w) => view(w, 40)), view(2, 2, { ref_class: 'internal' })];
  const input = only(rows);
  input.drops = mondays.map((_, w) => ({ day: dayOf(w), surface: 'profile', reason: 'declared_bot', n: 10 }));
  const md = buildReadout(input, NOW);
  assert.equal(g3Row(md, 'Profile views from external referrers / week')[2], '40');
  const profile = tableRow(md, 'profile | none');
  assert.equal(profile[2], '≥ 40'); // never 42, which would give 42 - 40 = 2
  const counted = cellsOf(rowOf(md, 'counted views')).slice(1);
  assert.equal(counted[2], '≥ 40');
  assert.equal(cellsOf(rowOf(md, 'drop share')).slice(1)[2], 'n/a (small cells)');
  assert.match(cellsOf(rowOf(md, 'drop share')).slice(1)[0], /^20\.0% dropped$/); // 10 / (10 + 40), all exact
  for (const c of tableCells(md)) assert.ok(c !== '42' && c !== '≥ 42' && c !== '322', c);
});

test('one line reconciles the three weekly totals', () => {
  const md = buildReadout(fixture(), NOW);
  assert.ok(md.includes(RECONCILE_LINE));
  for (const part of ['external referrers only', 'every referrer class', 'exclude self-views and demo profiles', 'drop counts include demo profiles']) {
    assert.ok(RECONCILE_LINE.includes(part), part);
  }
});

test('week headers carry the ISO week and its UTC dates', () => {
  const md = buildReadout(fixture(), NOW);
  assert.ok(md.includes('| 2026-W43, Oct 19–25 |'));
  assert.ok(md.includes('| 2026-W40, Sep 28–Oct 4 |'));
  assert.ok(md.includes('| 2026-W36, Aug 31–Sep 6 |'));
  assert.ok(!md.includes('W44'), 'the current week is not printed');
  assert.ok(!md.includes('partial)'));
  assert.ok(md.includes(DELETION_LINE));
  assert.match(DELETION_LINE, /removes that trader's rows/);
});

// Every (table, row, week) cell of a readout, keyed by its header text.
function cellMap(md: string): Map<string, string> {
  const m = new Map<string, string>();
  let head: string[] = [], section = '';
  for (const line of md.split('\n')) {
    if (line.startsWith('## ')) section = line;
    if (!line.startsWith('|') || /^\|(-+\|)+$/.test(line)) { if (!line.startsWith('|')) head = []; continue; }
    const cells = cellsOf(line);
    if (!head.length) { head = cells; continue; }
    const label = cells.slice(0, cells.length - head.filter((h) => /^\d{4}-W\d{2}/.test(h)).length - (head.at(-1) === 'Total' ? 1 : 0)).join(' / ');
    head.forEach((h, i) => { if (/^\d{4}-W\d{2}/.test(h)) m.set(`${section} | ${label} | ${h}`, cells[i]); });
  }
  return m;
}

test('two runs (mid-week, then the next week) print the same value for every week both show', () => {
  const mon = Date.parse('2026-11-02T00:00:00Z'); // 2026-W45
  const d = (offset: number) => new Date(mon + offset * 86_400_000).toISOString().slice(0, 10);
  const rows: RollupRow[] = [
    ...Array.from({ length: 4 }, (_, i) => ({ day: d(i * 7 - 21), surface: 'profile', ref_class: 'external', via: 'inv_t', self_view: false, n: 30 })),
    { day: d(2), surface: 'profile', ref_class: 'none', via: 'inv_t', self_view: false, n: 20 }, // by Wednesday
    { day: d(4), surface: 'profile', ref_class: 'none', via: 'inv_t', self_view: false, n: 1 }, // one more on Friday
  ];
  const wed = new Date(mon + 2 * 86_400_000 + 12 * 3_600_000), fri = new Date(mon + 4 * 86_400_000 + 12 * 3_600_000);
  const nextMon = new Date(mon + 7 * 86_400_000 + 3_600_000), nextWed = new Date(mon + 9 * 86_400_000);
  const upTo = (t: Date) => only(rows.filter((r) => Date.parse(`${r.day}T00:00:00Z`) <= t.getTime()));
  const a = buildReadout(upTo(wed), wed), b = buildReadout(upTo(fri), fri), c = buildReadout(upTo(nextMon), nextMon), e = buildReadout(upTo(nextWed), nextWed);
  assert.ok(!a.includes('W45') && !b.includes('W45'), 'the running week is not printed');
  assert.equal(a, b.replace(/Generated \S+/, `Generated ${wed.toISOString().slice(0, 10)}`)); // same week: identical counts
  assert.ok(c.includes('2026-W45, Nov 2–8'));
  const ma = cellMap(a), mc = cellMap(c), me = cellMap(e);
  let shared = 0;
  for (const [k, v] of ma) if (mc.has(k)) { shared++; assert.equal(mc.get(k), v, k); }
  for (const [k, v] of mc) if (me.has(k)) assert.equal(me.get(k), v, k);
  assert.ok(shared > 20, `compared ${shared} cells`);
  assert.ok(!a.includes('| 20 |') && !a.includes('≥ 20'));
});
