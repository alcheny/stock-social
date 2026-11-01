// OPTIONS AC 16, 19–21, 23 and 24 (docs/features/logs/options/plan.md): the one reader. The closed-gate read selects
// counts only; no other file in app/ or lib/ reads an option table; callers never pass the gate argument; the display
// log stores the loader's text; the copy has one expiry format and no countdown or verdict words. (The renders of these
// models are checked as static markup in e2e/options.spec.ts: node's type stripping does not compile JSX.)
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { MARKS, PROMO } from '../scripts/compliance.ts';
import { expiryText, OPTIONS } from './copy.ts';
import { closesOf, hasOptions, openOf, optionDisplayText, optionsLineText, shareLabel, type OptionCounts } from './options-view.ts';

const hasDb = !!process.env.DATABASE_URL;
const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL' }, fn);
before(async () => { if (hasDb) await (await import('./db.ts')).sql.unsafe(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')).simple(); });
after(async () => { if (hasDb) await (await import('./db.ts')).sql.end({ timeout: 1 }); });

const root = new URL('..', import.meta.url).pathname;
function files(dir: string): string[] {
  const out: string[] = [];
  for (const f of readdirSync(join(root, dir))) {
    const p = join(dir, f);
    if (statSync(join(root, p)).isDirectory()) out.push(...files(p));
    else if (/\.(ts|tsx)$/.test(f) && !/\.test\.tsx?$/.test(f)) out.push(p);
  }
  return out;
}

test('AC23: only lib/options-load.ts reads the option tables for display; lib/options-sync.ts is the one allowlisted writer; app/ and lib/ only', () => {
  const READER = 'lib/options-load.ts', WRITER = 'lib/options-sync.ts';
  for (const f of [...files('app'), ...files('lib')]) {
    if (f === READER || f === WRITER) continue;
    const src = readFileSync(join(root, f), 'utf8').replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
    // Any SQL naming an option_ table (comments stripped).
    assert.doesNotMatch(src, /\b(from|join|into|update|table)\s+(option_\w+|open_option_positions)\b/i, `${f} reads an option table`);
  }
  // The allowlisted file reads them only in its named helpers.
  const sync = readFileSync(join(root, WRITER), 'utf8');
  for (const name of ['insertOptionActivities', 'lastOptionActivityAt', 'rebuildOptionTrades', 'exerciseDays', 'rebuildRecord', 'replaceOptionPositions', 'purgeOccPositions']) assert.match(sync, new RegExp(`export async function ${name}\\(`));
  // lib/sync.ts, lib/delete.ts, lib/privacy-purge.ts and lib/display-log.ts only call helpers.
  for (const f of ['lib/sync.ts', 'lib/delete.ts', 'lib/privacy-purge.ts', 'lib/display-log.ts']) assert.doesNotMatch(readFileSync(join(root, f), 'utf8'), /option_(activities|trades)|open_option_positions/, f);
});

test('AC15/AC23: no file outside tests passes the gate argument', () => {
  for (const f of [...files('app'), ...files('lib')]) {
    if (f === 'lib/options-load.ts') continue;
    const src = readFileSync(join(root, f), 'utf8');
    for (const m of src.matchAll(/\b(loadOptionRecord|optionHeadline)\(([^()]*(?:\([^()]*\)[^()]*)*)\)/g)) {
      // One argument only: no top-level comma in the call.
      let depth = 0, comma = false;
      for (const ch of m[2]) { if ('([{'.includes(ch)) depth++; else if (')]}'.includes(ch)) depth--; else if (ch === ',' && depth === 0) comma = true; }
      assert.equal(comma, false, `${f}: ${m[0]}`);
    }
  }
});

test('AC16: the closed-gate read selects counts only (no option return, contract term, underlying or symbol)', () => {
  const src = readFileSync(new URL('./options-load.ts', import.meta.url), 'utf8');
  const counts = src.slice(src.indexOf('// COUNTS-ONLY-BEGIN'), src.indexOf('// COUNTS-ONLY-END'));
  assert.ok(counts.includes('count(*)'));
  assert.doesNotMatch(counts, /return_pct|unrealized_pct|underlying|option_right|option_expiry|opened_at|closed_at|holding_days|occ|strike|share_price|contract_units/);
  // loadOptionRecord returns before any other read when the gate is closed.
  const rec = src.slice(src.indexOf('export async function loadOptionRecord'), src.indexOf('export async function optionHeadline'));
  assert.ok(rec.indexOf("return { gate: 'closed', counts }") < rec.indexOf('loadTrades('));
});

const C = (o: Partial<OptionCounts> = {}): OptionCounts => ({ shown: 0, short: 0, other: 0, openLong: 0, openShort: 0, openOther: 0, unsupported: 0, exerciseShares: 0, ...o });

test('AC24 (model): the "Excluding options" label and the count line follow option closes and exclusions; zero changes nothing', () => {
  assert.equal(shareLabel(C()), false);
  assert.equal(hasOptions(C()), false);
  assert.equal(optionDisplayText({ gate: 'closed', counts: C() }), null);
  assert.equal(shareLabel(C({ other: 1 })), true); // an exclusion alone
  assert.equal(shareLabel(C({ short: 2 })), true);
  assert.equal(shareLabel(C({ openLong: 1 })), false); // open options alone: no closes to separate from the headline
  assert.equal(closesOf(C({ shown: 3, short: 1, other: 2 })), 6);
  assert.equal(openOf(C({ openLong: 1, openShort: 2 })), 3);
  assert.equal(optionDisplayText({ gate: 'closed', counts: C({ shown: 3, short: 1, openLong: 1 }) }),
    "4 option trades and 1 open option imported. Options aren't published yet.");
  // Zero parts are dropped.
  assert.equal(OPTIONS.gated(1, 0), "1 option trade imported. Options aren't published yet.");
  assert.equal(OPTIONS.gated(0, 2), "2 open options imported. Options aren't published yet.");
  const summary = { n: 14, winRate: 5 / 14, avg: -0.22, range: { low: -0.41, high: -0.03 }, bets: 9 };
  assert.equal(optionsLineText(summary), 'Options: 14 trades · 36% wins · -22.0% avg (-41.0% to -3.0%)');
  assert.equal(optionDisplayText({ gate: 'open', counts: C({ shown: 14 }), summary }), 'Options: 14 trades · 36% wins · -22.0% avg (-41.0% to -3.0%)');
  assert.equal(optionsLineText({ ...summary, range: null }), 'Options: 14 trades · 36% wins · -22.0% avg');
});

test('AC19–21: one expiry format; no countdown, direction or verdict words; the new copy passes the promo, marks and banned lists', () => {
  assert.equal(expiryText('2026-12-19'), 'exp Dec 19, 2026');
  assert.equal(expiryText('2026-12-19T00:00:00Z'), 'exp Dec 19, 2026');
  const words: string[] = [];
  const walk = (v: unknown) => {
    if (typeof v === 'string') words.push(v);
    else if (typeof v === 'function') words.push(String((v as (...a: unknown[]) => unknown)(3, '40%', '-1.0%', '(-2.0% to 1.0%)')));
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk(OPTIONS);
  const MARK_RE = new RegExp(`\\b(${MARKS.map((m) => m.replace(/ /g, '[\\s-]?')).join('|')})\\b`, 'i');
  const COUNTDOWN = /\b(expiring|expires? (soon|in)|days? left|left to|countdown|hurry|last chance|bullish|bearish|winner|loser|edge|skill|signal|beat)\b/i;
  for (const s of words) {
    for (const re of PROMO) assert.doesNotMatch(s, re, s);
    assert.doesNotMatch(s, MARK_RE, s);
    assert.doesNotMatch(s, COUNTDOWN, s);
  }
  // One formatter: the only "exp " producer in app/ and lib/ is expiryText.
  for (const f of [...files('app'), ...files('lib')]) {
    if (f === 'lib/copy.ts') continue;
    assert.doesNotMatch(readFileSync(join(root, f), 'utf8'), /[`'"]exp /, `${f} formats an expiry itself`);
  }
});

dbTest('AC16/21 (DB): the loader returns counts only while gated; the display log row includes the gated count line', async () => {
  const { sql } = await import('./db.ts');
  const { createAttempt, createUserForAttempt } = await import('./auth/attempts.ts');
  const { insertOptionActivities, rebuildRecord } = await import('./options-sync.ts');
  const { loadOptionRecord, optionHeadline, loadOptionDisplayText } = await import('./options-load.ts');
  const { writeDisplayLog } = await import('./display-log.ts');
  const tag = `l${Math.random().toString(36).slice(2, 10)}`;
  const u = await createUserForAttempt(await createAttempt({ method: 'dev', attested: true }), { handle: `${tag}u` });
  const row = (id: string, kind: string, oc: string | null, at: string, price: number) => ({
    externalId: `${tag}-${id}`, accountId: `${tag}-a`, kind, openClose: oc, underlying: 'XYZ', underlyingType: 'cs', right: 'PUT', expiry: '2026-10-16',
    strikeMilli: 123_450, multiplier: 100, occTicker: 'XYZ   261016P00123450', units: 1, price, fee: 0, amount: null, currency: 'USD', executedAt: new Date(at), verified: true, raw: {},
  });
  try {
    await sql`insert into closed_trades (user_id, sell_id, account_id, symbol, opened_at, closed_at, return_pct, holding_days, verified)
      values (${u.id}, ${`${tag}-s`}, ${`${tag}-a`}, 'ABC', now() - interval '3 days', now() - interval '1 day', 0.1, 2, true)`;
    await insertOptionActivities(u.id, 'snaptrade', [row('b', 'BUY', 'BUY_TO_OPEN', '2026-10-01T15:00:00Z', 2), row('s', 'SELL', 'SELL_TO_CLOSE', '2026-10-02T15:00:00Z', 3)]);
    await sql.begin((tx) => rebuildRecord(u.id, tx).then(() => undefined));
    // rebuildRecord rebuilt closed_trades from activities (none): put the share close back for the display log.
    await sql`insert into closed_trades (user_id, sell_id, account_id, symbol, opened_at, closed_at, return_pct, holding_days, verified)
      values (${u.id}, ${`${tag}-s`}, ${`${tag}-a`}, 'ABC', now() - interval '3 days', now() - interval '1 day', 0.1, 2, true)`;
    const rec = await loadOptionRecord(u.id);
    assert.deepEqual(rec, { gate: 'closed', counts: { shown: 1, short: 0, other: 0, openLong: 0, openShort: 0, openOther: 0, unsupported: 0, exerciseShares: 0 } });
    const h = (await optionHeadline([u.id])).get(u.id)!;
    assert.equal(h.gate, 'closed');
    const text = await loadOptionDisplayText(u.id);
    assert.equal(text, "1 option trade imported. Options aren't published yet.");
    const now = new Date();
    await writeDisplayLog({ now, ids: [u.id] });
    const [d] = await sql`select options_line, headline from display_log where user_id = ${u.id}`;
    assert.equal(d.options_line, text);
    assert.doesNotMatch(JSON.stringify(d), /123\.45|123450|PUT|Put option|exp /);
  } finally { await sql`delete from users where id = ${u.id}`; }
});
