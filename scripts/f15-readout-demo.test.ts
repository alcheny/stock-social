// F-15 readout, cycle 4 F4-12 (C4-20): invite links point at Demo profiles (F-15 decision 2026-11-01, "Invite codes are
// counted on views only"), so invite views on Demo profiles reach the invite row and a "partial: invite landings on Demo
// profiles" row, under the same small-cell suppression; every other row (G3 strict, the other partials, the surface ×
// via table, counted views) keeps Demo profiles out. Pure tests, no database.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEMO_INVITE_LINE, buildReadout, weekWindow, type ReadoutInput, type RollupRow } from './f15-readout.ts';

const NOW = new Date('2026-11-01T12:00:00Z');
const { mondays } = weekWindow(NOW);
const dayOf = (w: number) => new Date(mondays[w]).toISOString().slice(0, 10);
const view = (w: number, n: number, o: Partial<RollupRow> = {}): RollupRow =>
  ({ day: dayOf(w), surface: 'profile', ref_class: 'external', via: 'none', self_view: false, n, ...o });
const only = (rows: RollupRow[]): ReadoutInput => ({ rollup: rows, drops: [], g1: { strict: 0, partial: 0 }, g2: { traders: [], firstDay: null, retentionDays: 120 } });
const cellsOf = (line: string | undefined) => (line ?? '').slice(1, -1).split('|').map((c) => c.trim());
const row = (md: string, label: string) => md.split('\n').find((l) => l.startsWith(`| ${label}`));
const g3 = (md: string, label: string) => cellsOf(row(md, label)).slice(2);
const STRICT = 'Profile views from external referrers / week';
const INVITE = 'partial: invite links (inv_*)';
const DEMO_INVITE = 'partial: invite landings on Demo profiles';

test('F4-12: a Demo-target inv_t view reaches the invite row and the Demo landings row, not G3 strict, the table or counted views', () => {
  const md = buildReadout(only([view(2, 9, { via: 'inv_t', demo: true }), view(2, 7)]), NOW);
  assert.equal(g3(md, INVITE)[2], '9');
  assert.equal(g3(md, DEMO_INVITE)[2], '9');
  assert.equal(g3(md, STRICT)[2], '7', 'the Demo view is external on the profile surface, yet not in strict G3');
  assert.equal(g3(md, 'partial: tagged links, card')[2], '0');
  assert.equal(row(md, 'profile | inv_t'), undefined, 'no Demo row in the surface × via table');
  assert.equal(cellsOf(row(md, 'all | all')).slice(2)[2], '7');
  assert.equal(cellsOf(row(md, 'counted views')).slice(1)[2], '7');
});

test('F4-12: a Demo-target view without an invite code is counted nowhere', () => {
  const md = buildReadout(only([view(1, 30, { via: 'card', demo: true }), view(1, 30, { demo: true, surface: 'trade' })]), NOW);
  for (const label of [STRICT, INVITE, DEMO_INVITE, 'partial: tagged links, card', 'partial: trade surface, external referrer']) assert.equal(g3(md, label)[1], '0', label);
  assert.equal(cellsOf(row(md, 'all | all')).slice(2)[1], '0');
});

test('F4-12: the Demo landings sit under the same suppression: 20 trader invites + 3 Demo invites never print 23 or 3', () => {
  const rows = [...mondays.map((_, w) => view(w, 20, { via: 'inv_t', ref_class: 'none' })), view(5, 3, { via: 'inv_t', demo: true })];
  const md = buildReadout(only(rows), NOW);
  assert.equal(g3(md, INVITE)[5], '≥ 20');
  assert.equal(g3(md, DEMO_INVITE)[5], '<5');
  assert.equal(cellsOf(row(md, 'profile | inv_t')).slice(2)[5], '20');
  const cells = md.split('\n').filter((l) => l.startsWith('|')).flatMap(cellsOf);
  assert.ok(!cells.includes('23') && !cells.includes('≥ 23') && !cells.includes('3'));
  // A Demo landing row with one small week also hides its next-smallest week, so the total can't give it away.
  const md2 = buildReadout(only([view(0, 2, { via: 'inv_h', demo: true }), view(1, 8, { via: 'inv_h', demo: true }), view(2, 9, { via: 'inv_h', demo: true })]), NOW);
  assert.deepEqual(g3(md2, DEMO_INVITE).slice(0, 3), ['<5', '(s)', '9']);
});

test('F4-12: one line names the rule; the header no longer says Demo profiles are excluded everywhere', () => {
  const md = buildReadout(only([]), NOW);
  assert.ok(md.includes(DEMO_INVITE_LINE));
  assert.match(DEMO_INVITE_LINE, /Demo profiles/);
  assert.match(DEMO_INVITE_LINE, /same/);
  assert.ok(!md.includes('Demo profiles and self-views are excluded. '), 'the header keeps the invite exception');
  assert.match(md, /Self-views are excluded everywhere; Demo profiles are excluded except in the two invite rows/);
});
