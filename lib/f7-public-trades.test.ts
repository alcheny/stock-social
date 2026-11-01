// F-7 public-record traders: lots, matching and the rebuild (docs/features/logs/F-7/plan.md; ACs 1-3, 29 and the
// Round 4/5 additions: indirect excluded, feed floor keyed to the latest filing). Fictional filers and symbols only.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { filerDisplayName, filerHandles, matchPublic, type PubRow } from './public-trades.ts';
import { sanitizeUserText } from './text-safety.ts';
import { handleVerdict } from './handles.ts';
import { PUBLIC_FEED_DELAY_DAYS, PLACEHOLDER_ATTESTED_AT } from './public-gate.ts';

const DAY = 86_400_000;
let n = 0;
type R = Partial<PubRow> & { code: string; units: number; day: number };
function row(o: R): PubRow {
  const filing = o.filing_id ?? `f${++n}`;
  const acquired = o.acquired ?? ['P', 'A', 'M'].includes(o.code);
  return {
    external_id: o.external_id ?? `${filing}:0`, filing_id: filing, amends: o.amends ?? null, filing_url: o.filing_url ?? `https://filings.example.test/${filing}`,
    symbol: o.symbol ?? 'QZXA', code: o.code, side: o.code === 'P' && acquired ? 'BUY' : o.code === 'S' && !acquired ? 'SELL' : null,
    units: o.units, price: o.price ?? null, held_after: o.held_after ?? null, indirect: o.indirect ?? false, derivative: o.derivative ?? false,
    acquired, executed_at: new Date(Date.UTC(2026, 0, 1) + o.day * DAY), filed_at: o.filed_at ?? new Date(Date.UTC(2026, 0, 3) + o.day * DAY),
  };
}
const pct = (rows: PubRow[]) => matchPublic(rows).trades.map((t) => Math.round(t.returnPct * 10000) / 100);

test('AC 1: open-market buy at 10, sale at 12 is +20%; two lots at 10 and 14 sold at 13 is +8.33%; losses stay negative', () => {
  assert.deepEqual(pct([row({ code: 'P', units: 10, held_after: 10, price: 10, day: 0 }), row({ code: 'S', units: 10, held_after: 0, price: 12, day: 5 })]), [20]);
  assert.deepEqual(pct([row({ code: 'P', units: 10, held_after: 10, price: 10, day: 0 }), row({ code: 'P', units: 10, held_after: 20, price: 14, day: 1 }), row({ code: 'S', units: 20, held_after: 0, price: 13, day: 5 })]), [8.33]);
  const losing = pct([row({ code: 'P', units: 5, held_after: 5, price: 20, day: 0 }), row({ code: 'S', units: 5, held_after: 0, price: 15, day: 2 }), row({ code: 'P', units: 5, held_after: 5, price: 10, day: 3 }), row({ code: 'S', units: 5, held_after: 0, price: 9, day: 4 })]);
  assert.deepEqual(losing, [-25, -10]);
  const t = matchPublic([row({ code: 'P', units: 10, held_after: 10, price: 10, day: 0 }), row({ code: 'S', units: 10, held_after: 0, price: 12, day: 5 })]).trades[0];
  assert.equal(t.holdingDays, 5);
  assert.match(t.sellId, /^pub:/);
});

test('AC 2: never guessed - grants, earlier holdings and partly unknown lots exclude the sale as no_price; gifts and other dispositions are counted', () => {
  let m = matchPublic([row({ code: 'A', units: 10, held_after: 10, day: 0 }), row({ code: 'S', units: 10, held_after: 0, price: 12, day: 3 })]);
  assert.equal(m.trades.length, 0); assert.equal(m.excluded.no_price, 1);
  // The first report says 50 were held after a 10-share purchase: 40 are from before the reports, cost unknown.
  m = matchPublic([row({ code: 'P', units: 10, price: 10, day: 0, held_after: 50 }), row({ code: 'S', units: 10, price: 12, day: 3, held_after: 40 })]);
  assert.equal(m.trades.length, 0); assert.equal(m.excluded.no_price, 1);
  // A sale that partly consumes an unknown-cost lot is excluded whole.
  m = matchPublic([row({ code: 'A', units: 5, held_after: 5, day: 0 }), row({ code: 'P', units: 10, held_after: 15, price: 10, day: 1 }), row({ code: 'S', units: 8, held_after: 7, price: 12, day: 3 })]);
  assert.equal(m.trades.length, 0); assert.equal(m.excluded.no_price, 1);
  // A sale with no recorded entry at all is excluded, never estimated.
  m = matchPublic([row({ code: 'S', units: 8, held_after: 0, price: 12, day: 3 })]);
  assert.equal(m.trades.length, 0); assert.equal(m.excluded.no_price, 1);
  // Gift and tax-withholding dispositions consume lots FIFO and are counted; the later sale of the rest is priced.
  m = matchPublic([row({ code: 'P', units: 30, held_after: 30, price: 10, day: 0 }), row({ code: 'G', units: 5, held_after: 25, day: 1, acquired: false }), row({ code: 'F', units: 5, held_after: 20, day: 2, acquired: false }), row({ code: 'S', units: 20, held_after: 0, price: 11, day: 3 })]);
  assert.equal(m.excluded.gift, 1); assert.equal(m.excluded.other, 1);
  assert.equal(m.trades.length, 1); assert.ok(Math.abs(m.trades[0].returnPct - 0.1) < 1e-9);
});

test('AC 2: derivative and indirect rows are excluded by their own reason and never matched', () => {
  const m = matchPublic([
    row({ code: 'M', units: 10, price: 0, day: 0, derivative: true }),
    row({ code: 'P', units: 10, price: 10, day: 0, indirect: true }), row({ code: 'S', units: 10, price: 15, day: 2, indirect: true }),
  ]);
  assert.equal(m.trades.length, 0);
  assert.equal(m.excluded.derivative, 1);
  assert.equal(m.excluded.indirect, 2);
  assert.deepEqual(m.openSymbols, []);
});

test('AC 2: a held-after mismatch excludes that sale and every later sale in the queue as unreconciled', () => {
  const m = matchPublic([
    row({ code: 'P', units: 10, price: 10, day: 0, held_after: 10 }),
    row({ code: 'S', units: 5, price: 12, day: 1, held_after: 5 }),
    row({ code: 'S', units: 2, price: 12, day: 2, held_after: 1 }), // 3 expected
    row({ code: 'S', units: 1, price: 12, day: 3, held_after: 0 }),
    row({ code: 'P', units: 4, price: 10, day: 0, symbol: 'QZXB', held_after: 4 }), row({ code: 'S', units: 4, price: 11, day: 3, symbol: 'QZXB', held_after: 0 }),
  ]);
  assert.equal(m.trades.length, 2); // the first QZXA sale and the QZXB sale
  assert.equal(m.excluded.unreconciled, 2);
});

test('fix round 3: holdings not reported as a share count are unknown - the sales are excluded and counted, never guessed', () => {
  // First seen with no share count (holdings reported as a value): what was held before is unknown.
  let m = matchPublic([row({ code: 'P', units: 100, price: 10, day: 0, held_after: null }), row({ code: 'S', units: 100, price: 12, day: 3, held_after: 0 })]);
  assert.equal(m.trades.length, 0); assert.deepEqual(m.excluded, { unreconciled: 1 });
  // With the share count (5,100 after a 100 purchase) the 5,000 earlier shares have no known cost.
  m = matchPublic([row({ code: 'P', units: 100, price: 10, day: 0, held_after: 5100 }), row({ code: 'S', units: 100, price: 12, day: 3, held_after: 5000 })]);
  assert.equal(m.trades.length, 0); assert.deepEqual(m.excluded, { no_price: 1 });
  // A later row with no share count: from there on reconciliation can't be checked, so that sale and later ones are excluded.
  m = matchPublic([row({ code: 'P', units: 10, price: 10, day: 0, held_after: 10 }), row({ code: 'S', units: 4, price: 12, day: 1, held_after: 6 }),
    row({ code: 'S', units: 3, price: 12, day: 2, held_after: null }), row({ code: 'S', units: 3, price: 12, day: 3, held_after: 0 })]);
  assert.equal(m.trades.length, 1); assert.deepEqual(m.excluded, { unreconciled: 2 });
});

test('open positions: symbols with an open-market lot still held, no percent', () => {
  const m = matchPublic([row({ code: 'P', units: 10, held_after: 10, price: 10, day: 0 }), row({ code: 'S', units: 4, held_after: 6, price: 12, day: 1 }), row({ code: 'A', units: 3, held_after: 3, day: 0, symbol: 'QZXB' }), row({ code: 'P', units: 1, held_after: 1, price: 3, day: 0, symbol: 'QZXC' })]);
  assert.deepEqual(m.openSymbols, ['QZXA', 'QZXC']);
});

test('AC 3: an amendment replaces the amended filing\'s rows and the percent changes; a double amendment resolves by filed time', () => {
  const buy = row({ code: 'P', units: 10, held_after: 10, price: 10, day: 0, filing_id: 'b1' });
  const sell = row({ code: 'S', units: 10, held_after: 0, price: 12, day: 5 });
  const fix = row({ code: 'P', units: 10, held_after: 10, price: 8, day: 0, filing_id: 'b2', amends: 'b1', filed_at: new Date(Date.UTC(2026, 1, 1)) });
  assert.deepEqual(pct([buy, sell, fix]), [50]);
  const later = row({ code: 'P', units: 10, held_after: 10, price: 6, day: 0, filing_id: 'b3', amends: 'b1', filed_at: new Date(Date.UTC(2026, 1, 9)) });
  assert.deepEqual(pct([buy, sell, later, fix]), [100]);
  // An amendment of the amendment wins too.
  const third = row({ code: 'P', units: 10, held_after: 10, price: 12, day: 0, filing_id: 'b4', amends: 'b3', filed_at: new Date(Date.UTC(2026, 1, 20)) });
  assert.deepEqual(pct([buy, sell, later, fix, third]), [0]);
});

test('feed floor: the latest effective filed time among the filings behind the trade plus 30 days; an amended opening purchase moves it', () => {
  assert.equal(PUBLIC_FEED_DELAY_DAYS, 30);
  const buy = row({ code: 'P', units: 10, held_after: 10, price: 10, day: 0, filing_id: 'o1', filed_at: new Date('2026-01-02T00:00:00Z') });
  const sell = row({ code: 'S', units: 10, held_after: 0, price: 12, day: 5, filed_at: new Date('2026-01-08T00:00:00Z') });
  assert.equal(matchPublic([buy, sell]).trades[0].feedAfter.toISOString(), '2026-02-07T00:00:00.000Z');
  const amended = row({ code: 'P', units: 10, held_after: 10, price: 10, day: 0, filing_id: 'o2', amends: 'o1', filed_at: new Date('2026-01-20T00:00:00Z') });
  const t = matchPublic([buy, sell, amended]).trades[0];
  assert.equal(t.feedAfter.toISOString(), '2026-02-19T00:00:00.000Z');
  assert.equal(t.filingUrl, sell.filing_url);
});

test('review: a priced sale the FIFO matcher drops on its own epsilon is still counted, never lost', () => {
  const m = matchPublic([row({ code: 'P', units: 1000000.0005, held_after: 1000000.0005, price: 10, day: 0 }), row({ code: 'S', units: 1000000, held_after: 0.0005, price: 12, day: 1 }),
    row({ code: 'P', units: 100, held_after: 100.0005, price: 10, day: 2 }), row({ code: 'S', units: 100.0005, held_after: 0, price: 11, day: 3 })]);
  assert.equal(m.trades.length + Object.values(m.excluded).reduce((a, b) => a + b, 0), 2);
});

test('review: "Bought" links come from the effective direct open-market purchases that opened the trade only', async () => {
  const { openingFilings } = await import('./public-trades.ts');
  const orig = row({ code: 'P', units: 10, price: 10, day: 0, filing_id: 'q1', filing_url: 'https://x.test/q1' });
  const fix = row({ code: 'P', units: 10, price: 9, day: 0, filing_id: 'q2', amends: 'q1', filing_url: 'https://x.test/q2', filed_at: new Date(Date.UTC(2026, 1, 1)) });
  const indirect = row({ code: 'P', units: 5, price: 10, day: 0, indirect: true, filing_url: 'https://x.test/ind' });
  const other = row({ code: 'P', units: 5, price: 10, day: 0, symbol: 'QZXB', filing_url: 'https://x.test/other' });
  const later = row({ code: 'P', units: 5, price: 10, day: 1, filing_url: 'https://x.test/later' });
  assert.deepEqual(openingFilings([orig, fix, indirect, other, later], 'QZXA', orig.executed_at), ['https://x.test/q2']);
  assert.deepEqual(openingFilings([orig, indirect], 'QZXA', orig.executed_at), ['https://x.test/q1']);
});

// --- DB: the rebuild and the filer's users row (AC 29) ---
const hasDb = !!process.env.DATABASE_URL;
const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL', timeout: 120_000 }, fn);
const mine: number[] = [];
before(async () => { if (hasDb) await (await import('./privacy-test-schema.ts')).applySchemaForTests(); });
after(async () => {
  if (!hasDb) return;
  const { sql } = await import('./db.ts');
  if (mine.length) {
    await sql`delete from users where public_filer_id in ${sql(mine)}`;
    await sql`delete from public_filers where id in ${sql(mine)}`;
  }
  await sql.end({ timeout: 1 });
});

async function filer(rows: PubRow[]) {
  const { sql } = await import('./db.ts');
  const [f] = await sql`insert into public_filers (source, filer_key, demo) values ('insider_reports', ${`t-${Math.random().toString(36).slice(2)}`}, true) returning id`;
  mine.push(f.id);
  const tag = Math.random().toString(36).slice(2, 8);
  if (rows.length) await sql`insert into public_transactions ${sql(rows.map((r) => ({ ...r, filer_id: f.id, filing_id: `${tag}${r.filing_id}`, external_id: `${tag}${r.external_id}`, amends: r.amends && `${tag}${r.amends}` })))}`;
  return f.id as number;
}

dbTest('AC 29: no users row until a priced close; then a marked row with the placeholder attestation, never verified rows', async () => {
  const { sql } = await import('./db.ts');
  const { rebuildPublicTrades } = await import('./public-trades.ts');
  const id = await filer([row({ code: 'P', units: 10, held_after: 10, price: 10, day: 0 })]);
  const long = 'Morgan Fictional-Placeholder Example Name The Third';
  assert.equal((await sql.begin((tx) => rebuildPublicTrades(id, tx, long))).userId, null);
  assert.equal((await sql`select count(*)::int as n from users where public_filer_id = ${id}`)[0].n, 0);
  const [pf0] = await sql`select open_symbols from public_filers where id = ${id}`;
  assert.deepEqual(pf0.open_symbols, ['QZXA']);

  const tag = Math.random().toString(36).slice(2, 8);
  await sql`insert into public_transactions ${sql({ ...row({ code: 'S', units: 9, held_after: 0, price: 12, day: 3 }), filer_id: id, filing_id: `${tag}s`, external_id: `${tag}s:0` })}`;
  await sql`insert into public_transactions ${sql({ ...row({ code: 'G', units: 1, held_after: 9, day: 1, acquired: false }), filer_id: id, filing_id: `${tag}g`, external_id: `${tag}g:0` })}`;
  const out = await sql.begin((tx) => rebuildPublicTrades(id, tx, long));
  assert.ok(out.userId);
  const [u] = await sql`select u.handle, u.display_name, u.adult_attested_at, u.snaptrade_user_id, u.public_filer_id, a.method, a.completed_at, a.user_id, a.adult_attested_at as attempt_at
    from users u join signup_attempts a on a.id = u.signup_attempt_id where u.id = ${out.userId}`;
  assert.match(u.handle, /^pf_[a-z0-9_]+$/);
  assert.ok(u.handle.length <= 20);
  // F4-7 (C4-11): the stored name is the cleaned form users get (lib/text-safety.ts#sanitizeUserText, 40 code points);
  // for this plain name that is still its first 40 characters.
  assert.equal(u.display_name, sanitizeUserText(long, 40));
  assert.equal(u.display_name, long.slice(0, 40));
  assert.equal(u.adult_attested_at.getTime(), PLACEHOLDER_ATTESTED_AT.getTime());
  assert.equal(u.attempt_at.getTime(), 0);
  assert.equal(u.snaptrade_user_id, null);
  assert.equal(u.public_filer_id, id);
  assert.equal(u.method, 'dev'); assert.equal(u.completed_at, null); assert.equal(u.user_id, null);
  await assert.rejects(sql`update users set snaptrade_user_id = ${`x${tag}`} where id = ${out.userId}`, /users_public_filer_no_broker/);

  const trades = await sql`select * from closed_trades where user_id = ${out.userId}`;
  assert.equal(trades.length, 1);
  assert.equal(trades[0].verified, false);
  assert.equal(trades[0].sell_id, `pub:${tag}s:0`);
  assert.match(trades[0].filing_url, /^https:\/\/filings\.example\.test\/f\d+$/);
  assert.ok(trades[0].feed_after instanceof Date);
  assert.ok(Math.abs(trades[0].return_pct - 0.2) < 1e-9);
  const [pf] = await sql`select excluded, open_symbols from public_filers where id = ${id}`;
  assert.deepEqual(pf.excluded, { gift: 1 });
  assert.deepEqual(pf.open_symbols, []);
  // AC 4: percent only - the derived row carries no quantity, price or amount.
  for (const k of Object.keys(trades[0])) assert.ok(!/unit|price|amount|qty|quantit|held/.test(k), k);
  // A second rebuild keeps the same users row and handle (identity by filer, not by name).
  const again = await sql.begin((tx) => rebuildPublicTrades(id, tx, 'Another Fictional Name'));
  assert.equal(again.userId, out.userId);
  assert.equal((await sql`select handle from users where id = ${out.userId}`)[0].handle, u.handle);
});

dbTest('a removed filer is never rebuilt and never gets a users row', async () => {
  const { sql } = await import('./db.ts');
  const { rebuildPublicTrades } = await import('./public-trades.ts');
  const id = await filer([row({ code: 'P', units: 10, price: 10, day: 0 }), row({ code: 'S', units: 10, price: 12, day: 3 })]);
  await sql`update public_filers set removed_at = now() where id = ${id}`;
  assert.equal((await sql.begin((tx) => rebuildPublicTrades(id, tx, 'Removed Fictional'))).userId, null);
  assert.equal((await sql`select count(*)::int as n from users where public_filer_id = ${id}`)[0].n, 0);
});

// F4-7 (C4-11): filer names and handles pass the same identity rules as users. Fictional probe names only.
const PRODUCT = ['Stock', 'Social'].join(' ');
const PROBES = {
  rlo: 'Avery \u202Eelpmaxe\u202C Placeholder', zeroWidth: 'Quinn\u200B\u200B\u200BFictional', check: 'Riley Example \u2714',
  verified: 'Verified Capital Group', leet: 'Ver1fied Holdings', product: `${PRODUCT} Holdings Partners`,
};
const handleOk = (h: string) => {
  assert.match(h, /^pf_[a-z0-9_]+$/, h); assert.ok(h.length <= 20, h); assert.ok(!h.endsWith('_'), h);
  assert.equal(handleVerdict(h, { others: [], demo: [] }), 'ok', h);
};

test('F4-7: filer handles drop reserved words, never end in "_", and fall back to pf_filer_<id36>', () => {
  for (const name of Object.values(PROBES)) { const hs = filerHandles(name, 4242); assert.ok(hs.length >= 1); hs.forEach(handleOk); }
  // The three probes from the review: no "verified" handle, no trailing "_" from the product name.
  assert.equal(filerHandles(PROBES.verified, 7)[0], 'pf_capital_group');
  assert.ok(!filerHandles(PROBES.product, 7).some((h) => /stock_?social/.test(h)));
  assert.ok(!filerHandles(PROBES.leet, 7).some((h) => /ver1fied/.test(h)));
  // Nothing usable left: the numbered fallback.
  assert.deepEqual(filerHandles('Verified Official', 1295), ['pf_filer', 'pf_filer_zz']);
  assert.deepEqual(filerHandles('\u200B\u200B', 36).at(-1), 'pf_filer_10');
  // An ordinary name keeps the old shape (existing handles stay stable).
  assert.deepEqual(filerHandles('Morgan Fictional-Placeholder', 35), ['pf_morgan_fictio', 'pf_morgan_fi_z', 'pf_filer_z']);
});

test('F4-7: filer display names are cleaned like users\' names; a refused name falls back to the handle', () => {
  const h = 'pf_example';
  assert.equal(filerDisplayName(PROBES.rlo, h), 'Avery elpmaxe Placeholder');
  assert.equal(filerDisplayName(PROBES.zeroWidth, h), 'QuinnFictional');
  for (const k of ['check', 'verified', 'leet', 'product'] as const) assert.equal(filerDisplayName(PROBES[k], h), h, k);
  assert.equal(filerDisplayName('  Casey   Example  ', h), 'Casey Example');
  assert.equal(filerDisplayName('x'.repeat(60), h), 'x'.repeat(40));
  for (const name of Object.values(PROBES)) assert.ok(!/[\u200B-\u200F\u202A-\u202E\u2066-\u2069]/.test(filerDisplayName(name, h)));
});

dbTest('F4-7: a filer named "Verified ..." gets a clean handle and the handle as its name', async () => {
  const { sql } = await import('./db.ts');
  const { rebuildPublicTrades } = await import('./public-trades.ts');
  const id = await filer([row({ code: 'P', units: 10, held_after: 10, price: 10, day: 0 }), row({ code: 'S', units: 10, held_after: 0, price: 11, day: 2 })]);
  const out = await sql.begin((tx) => rebuildPublicTrades(id, tx, PROBES.verified));
  assert.ok(out.userId);
  const [u] = await sql`select handle, display_name from users where id = ${out.userId}`;
  handleOk(u.handle);
  assert.ok(!/verified/.test(u.handle));
  assert.equal(u.display_name, u.handle);
});

test('fixes cycle 4, independent review 1: rows 9 and 10 of one filing keep filing order through the matcher (+50%, not -25%)', () => {
  const f = 'fone';
  const rows = [
    row({ code: 'P', units: 100, held_after: 100, price: 10, day: 0, filing_id: f, external_id: `${f}:9` }),
    row({ code: 'P', units: 100, held_after: 200, price: 20, day: 0, filing_id: f, external_id: `${f}:10` }),
    row({ code: 'S', units: 100, held_after: 100, price: 15, day: 5 }),
  ];
  assert.deepEqual(pct(rows), [50]);
});
