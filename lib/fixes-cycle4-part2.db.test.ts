// FIXES-CYCLE4-PART2: database cases for F4-4 (the month recap of a trader with option closes), F4-8 (publicShown) and
// F4-16 (the pane rows carry a published note's dates). Every fixture carries a random tag; only its own rows are removed,
// and every assertion is scoped to its own ids (shared test database).
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { DISCLAIMER_LINES } from './record-strip.ts';
import { FIXES_CYCLE4_PART2 as FC4, FIXES_LABELS as FL, OPTIONS } from './copy.ts';

const hasDb = !!process.env.DATABASE_URL;
const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL' }, fn);
const fx = await import('./thesis-fixtures.ts');
const made: number[] = [];
const filers: string[] = [];
before(async () => { if (hasDb) await fx.ready(); });
after(async () => {
  if (!hasDb) return;
  const { sql } = await import('./db.ts');
  if (made.length) await fx.removePeople(made);
  const { deleteFilers } = await import('../e2e/f7-fixture.ts');
  await deleteFilers(sql, filers);
  await sql.end({ timeout: 1 });
});

const ymOf = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;

async function trader(n: number) {
  const { tag, ids } = await fx.people(1, 'fc4p');
  made.push(...ids);
  await fx.trades(ids[0], tag, n);
  const { sql } = await import('./db.ts');
  const [r] = await sql`select max(closed_at) as at from closed_trades where user_id = ${ids[0]}`;
  return { id: ids[0], tag, handle: `${tag}0`, ym: ymOf(r.at as Date) };
}
async function optionClose(user: number, tag: string, k: number, closedAt: Date) {
  const { sql } = await import('./db.ts');
  await sql`insert into option_trades (user_id, close_id, account_id, verified, underlying, option_right, option_expiry, opened_at, closed_at, return_pct, holding_days)
    values (${user}, ${`${tag}-opt-${k}`}, 'acct', false, 'OPX', 'CALL', '2030-01-18', ${new Date(closedAt.getTime() - 86_400_000)}, ${closedAt}, 0.2, 1)`;
}

dbTest('F4-4: a month with option closes: the figures, alt and description say "Excluding options", the gated count line counts the month, inside UTC bounds', async () => {
  const t = await trader(3);
  const [y, m] = t.ym.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1)); // 00:00 UTC on the 1st: inside the month
  await optionClose(t.id, t.tag, 1, first);
  await optionClose(t.id, t.tag, 2, new Date(first.getTime() + 3_600_000));
  await optionClose(t.id, t.tag, 3, new Date(first.getTime() - 1)); // the month before: not counted
  await optionClose(t.id, t.tag, 4, new Date(Date.UTC(y, m, 1))); // 00:00 UTC on the next month's 1st: not counted
  const { loadRecap } = await import('./recap-load.ts');
  const { monthAlt, monthDescription, monthOptionsLine, monthStripInput, recordStripInput } = await import('./recap.ts');
  const { recordStrip } = await import('./record-strip.ts');
  const { monthBand } = await import('./month-card.ts');
  const r = (await loadRecap(t.handle, t.ym))!;
  assert.equal(r.excludingOptions, true);
  assert.equal(r.monthOptionCloses, 2);
  assert.equal(r.optionsGate, 'closed', 'the options gate is closed on this build');
  const month = recordStrip(monthStripInput(r), 'figures');
  assert.equal(month.figures.at(-1)!.text, OPTIONS.shareLabel, 'the month figures end with the legal words');
  const whole = recordStrip(recordStripInput(r), 'image');
  assert.match(monthAlt(r, whole, month), new RegExp(`this month(?: so far)?, [^.]*${OPTIONS.altQualifier}`));
  const desc = monthDescription(r, whole);
  assert.ok(desc.startsWith(`${r.recap.count} closed trade${r.recap.count === 1 ? '' : 's'} this month, ${OPTIONS.altQualifier} · `), desc);
  assert.equal(monthOptionsLine(r), OPTIONS.gated(2, 0));
  assert.ok(desc.includes(OPTIONS.gated(2, 0).replace(/\.$/, '')), 'gate closed: the month count line in the description');
  assert.ok(desc.endsWith('Not investment advice. Past performance does not guarantee future results.'));
  // The month image: the qualifier on its own never-optional line, and the disclaimer still drawn in full.
  const band = monthBand(r, whole, month, null);
  assert.ok(band.fits);
  assert.match(band.lines.find((l) => l.role === 'monthCount')!.text, new RegExp(` · ${OPTIONS.shareLabel}$`), 'on the count line: no extra row');
  assert.deepEqual(band.lines.filter((l) => l.role.startsWith('disclaimer')).map((l) => l.text), [...DISCLAIMER_LINES]);
  // Open gate (the switch is off on this build, so the pure rule): no count sentence.
  assert.equal(monthOptionsLine({ ...r, optionsGate: 'open' }), null);
});

dbTest('F4-4: a trader without options: no qualifier, no options line, the old foot (only the heading changes, for every record)', async () => {
  const t = await trader(2);
  const { loadRecap } = await import('./recap-load.ts');
  const { monthDescription, monthOptionsLine, monthStripInput, recordStripInput } = await import('./recap.ts');
  const { recordStrip } = await import('./record-strip.ts');
  const r = (await loadRecap(t.handle, t.ym))!;
  assert.equal(r.excludingOptions, false);
  assert.equal(r.monthOptionCloses, 0);
  assert.equal(monthOptionsLine(r), null);
  assert.ok(recordStrip(monthStripInput(r), 'figures').figures.every((p) => p.role !== 'options'));
  assert.doesNotMatch(monthDescription(r, recordStrip(recordStripInput(r), 'image')), /excluding options/i);
});

test('F4-4: the copy: the share-trades foot keeps TR-1\'s "none can be hidden"; the heading is never "All trades"', () => {
  for (const k of ['real', 'demo'] as const) {
    assert.match(FC4.monthFootShares[k], /share trades/);
    assert.match(FC4.monthFootShares[k], /none can be hidden\.$/);
    assert.match(FL.monthFoot[k], /none can be hidden\.$/, 'the old foot is unchanged');
  }
  assert.equal(FC4.monthHeading, 'Closed trades this month');
});

dbTest('F4-4: the month page draws the qualifier, the count line, the heading and the share-trades foot', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../app/u/[handle]/month/[ym]/page.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /All trades this month/);
  assert.match(src, /FC4\.monthHeading/);
  assert.match(src, /r\.excludingOptions \? FC4\.monthFootShares : FL\.monthFoot/);
  assert.match(src, /monthOptionsLine\(r\)/);
});

dbTest('F4-8: publicShown: off with no query; on: a visible filer with a feed-ready close, demo flagged; hidden or not yet feed-ready: not shown', async () => {
  const { sql } = await import('./db.ts');
  const { insertFiler } = await import('../e2e/f7-fixture.ts');
  const { publicShown } = await import('./public-gate.ts');
  const on = { PUBLIC_TRADERS: '1', NODE_ENV: 'test' } as const;
  const tag = `fc4p${Math.random().toString(36).slice(2, 7)}`;
  const mk = async (suffix: string, o: { demo?: boolean; hidden?: boolean; feedAfterDaysAgo?: number }) => {
    const handle = `pf_${tag}${suffix}`;
    filers.push(handle);
    return (await insertFiler(sql, { handle, name: 'Fictional Filer', demo: o.demo, hidden: o.hidden, closes: [{ symbol: 'ZZQ', r: 0.05, daysAgo: 40, feedAfterDaysAgo: o.feedAfterDaysAgo }] })).userId;
  };
  const real = await mk('r', { demo: false });
  const demo = await mk('d', { demo: true });
  const hidden = await mk('h', { demo: false, hidden: true });
  const later = await mk('l', { demo: false, feedAfterDaysAgo: -5 }); // feed floor 5 days ahead
  assert.deepEqual(await publicShown(Date.now(), { PUBLIC_TRADERS: '0' }, [real]), { shown: false, demo: false });
  assert.deepEqual(await publicShown(Date.now(), on, [real]), { shown: true, demo: false });
  assert.deepEqual(await publicShown(Date.now(), on, [demo]), { shown: true, demo: true });
  assert.deepEqual(await publicShown(Date.now(), on, [hidden]), { shown: false, demo: false });
  assert.deepEqual(await publicShown(Date.now(), on, [later]), { shown: false, demo: false });
});

test('F4-8: the switch off reads no table (no query issued)', async () => {
  const { publicShown } = await import('./public-gate.ts');
  // With an unreachable database the call would fail and answer "shown"; off, it never asks.
  assert.deepEqual(await publicShown(Date.now(), { PUBLIC_TRADERS: '0' }), { shown: false, demo: false });
});

dbTest('F4-16: the pane rows carry a published note\'s written and edited UTC days (never a time of day); a held note carries none', async () => {
  const { tag, ids } = await fx.people(1, 'fc4p');
  made.push(...ids);
  const closes = await fx.trades(ids[0], tag, 2);
  const { sql } = await import('./db.ts');
  const W = new Date('2026-10-05T14:31:07.123Z'), E = new Date('2026-10-07T01:00:00Z');
  await sql`update closed_trades set thesis = 'A note', thesis_status = 'published', thesis_written_at = ${W}, thesis_edited_at = ${E} where id = ${closes[0].id}`;
  await sql`update closed_trades set thesis = 'A note', thesis_status = 'held', thesis_hold_rule = 'link', thesis_written_at = ${W}, thesis_edited_at = ${E} where id = ${closes[1].id}`;
  const { records } = await import('./feed.ts');
  const rows = await records([ids[0]]);
  const pub = rows.find((r) => r.id === closes[0].id)!, held = rows.find((r) => r.id === closes[1].id)!;
  const day = (d: Date) => Math.floor(d.getTime() / 86_400_000);
  assert.equal(pub.writtenDay, day(W));
  assert.equal(pub.editedDay, day(E));
  assert.equal(held.thesis, null);
  assert.equal(held.writtenDay, undefined);
  assert.equal(held.editedDay, undefined);
  // Orchestrator review: what the public /pane JSON carries (app/u/[handle]/pane/route.ts maps these rows) holds day
  // numbers only: no millisecond time, no time of day.
  const wire = JSON.stringify(rows.map((r) => ({ id: r.id, ...(r.writtenDay != null || r.editedDay != null ? { writtenDay: r.writtenDay, editedDay: r.editedDay } : {}) })));
  assert.doesNotMatch(wire, /\d{13}/);
  assert.doesNotMatch(wire, /writtenAt|editedAt/);
  // Through the wire the days still pack, and the sheet's caption equals the profile row's (built from the stored times).
  const { packPoints, unpackPoints, fromNoteDay } = await import('./paging.ts');
  const { noteDateLine } = await import('./user-note.ts');
  const back = JSON.parse(JSON.stringify(rows)) as Record<string, unknown>[];
  const p = unpackPoints(packPoints(back.map((r) => ({ id: r.id as string, symbol: r.symbol as string, returnPct: r.returnPct as number, holdingDays: r.holdingDays as number,
    closedAt: new Date(r.closedAt as string), thesis: r.thesis as string | null, writtenDay: r.writtenDay as number | undefined, editedDay: r.editedDay as number | undefined }))));
  const pt = p.find((x) => x.id === closes[0].id)!;
  assert.equal(noteDateLine(fromNoteDay(pt.writtenDay), fromNoteDay(pt.editedDay)), noteDateLine(W, E));
  assert.equal(p.find((x) => x.id === closes[1].id)!.writtenDay, undefined);
  // The route maps the day fields under their own keys, never as epoch ms.
  const { readFileSync } = await import('node:fs');
  const route = readFileSync(new URL('../app/u/[handle]/pane/route.ts', import.meta.url), 'utf8');
  // F-23: the route sends no rows; its chart is built from these rows (feedPaneChart → chartPoints, which carries the
  // day numbers under their own keys via noteDaysOf), and the wire keeps them as days.
  assert.match(route, /const chart = feedPaneChart\(rows, now\);/);
  assert.doesNotMatch(route, /writtenAt|editedAt/);
  const { feedPaneChart, unpackChart } = await import('./chart-series.ts');
  const wired = JSON.parse(JSON.stringify(feedPaneChart(rows, new Date())));
  assert.doesNotMatch(JSON.stringify(wired), /\d{13}/);
  const viaChart = unpackChart(wired).ALL.pts.map((x) => x.trade).find((x) => x?.id === closes[0].id)!;
  assert.equal(noteDateLine(fromNoteDay(viaChart.writtenDay), fromNoteDay(viaChart.editedDay)), noteDateLine(W, E));
});
