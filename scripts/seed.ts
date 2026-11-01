// Demo data so the product can be shown without broker keys. Everything is source='demo' and shows a Demo badge.
// Run: npm run db:seed   (idempotent: re-running inserts nothing new)
import { sql } from '../lib/db.ts';
import { insertActivities } from '../lib/sync.ts';
import type { Activity } from '../lib/trades.ts';
// OPTIONS (docs/features/logs/options/plan.md D8): one demo trader also has option rows; every record is rebuilt with
// rebuildRecord (rebuildTrades, then the option steps).
import { insertOptionActivities, rebuildRecord, replaceOptionPositions } from '../lib/options-sync.ts';
import type { OptionRow } from '../lib/options.ts';

let seed = 42;
const rand = () => ((seed = (seed * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32);

const traders = [
  { handle: 'momentum_maya', name: 'Maya', edge: 0.012, vol: 0.06, symbols: ['NVDA', 'AMD', 'AVGO', 'TSM', 'MU'] },
  { handle: 'dividend_dan', name: 'Dan', edge: 0.004, vol: 0.02, symbols: ['KO', 'JNJ', 'PG', 'VZ', 'O'] },
  { handle: 'yolo_yuki', name: 'Yuki', edge: -0.01, vol: 0.18, symbols: ['TSLA', 'GME', 'PLTR', 'COIN', 'MSTR'] },
];

const DAY = 86_400_000;
const now = Date.now();

for (const t of traders) {
  // Demo traders attest through a 'dev' attempt like any other row: no users row exists without one.
  let [u] = await sql`update users set display_name = ${t.name} where handle = ${t.handle} returning id`;
  if (!u) {
    [u] = await sql`
      with a as (insert into signup_attempts (method, adult_attested_at) values ('dev', now()) returning id)
      insert into users (handle, display_name, adult_attested_at, signup_attempt_id) select ${t.handle}, ${t.name}, now(), a.id from a returning id`;
  }

  const acts: (Activity & { raw: unknown })[] = [];
  const add = (a: Omit<Activity, 'accountId' | 'verified'>) => acts.push({ ...a, accountId: 'demo-acct', verified: false, raw: { demo: true } });

  for (let i = 0; i < 30; i++) {
    const symbol = t.symbols[i % t.symbols.length];
    const open = now - (60 - i * 2) * DAY - rand() * DAY;
    const close = Math.min(now - 3_600_000, open + (0.2 + rand() * 9) * DAY);
    const entry = 20 + rand() * 400;
    const r = t.edge + (rand() - 0.5) * 2 * t.vol;
    const units = Math.round(1 + rand() * 50);
    add({ externalId: `demo-${t.handle}-${i}-b`, symbol, side: 'BUY', units, price: entry, fee: 0, executedAt: new Date(open) });
    add({ externalId: `demo-${t.handle}-${i}-s`, symbol, side: 'SELL', units, price: entry * (1 + r), fee: 0, executedAt: new Date(close) });
  }
  // One sell with no recorded entry → shows up as "excluded" on the profile.
  add({ externalId: `demo-${t.handle}-orphan`, symbol: 'SPY', side: 'SELL', units: 3, price: 500, fee: 0, executedAt: new Date(now - 59 * DAY) });

  await insertActivities(u.id, 'demo', acts);
  if (t.handle === 'yolo_yuki') await seedOptions(u.id);
  await rebuildRecord(u.id);
  if (t.handle === 'yolo_yuki') await sql.begin((tx) => replaceOptionPositions(tx, u.id, null, new Map([['demo-acct', {
    options: [{ positionKey: 'demo-open', underlying: 'XYZ', right: 'CALL', expiry: day(now + 40 * DAY), unrealizedPct: 0.12 }], short: 0, unsupported: 0 }]])));
  console.log(`seeded @${t.handle}`);
}

// OPTIONS (D8): 3 long option trades (one expiring worthless), 1 short close and 1 long open option, all source='demo'.
// Fictional contracts on the placeholder ticker XYZ; the strike 123.45 is private and never shown (e2e/options.spec.ts).
function day(ms: number) { return new Date(ms).toISOString().slice(0, 10); }
async function seedOptions(userId: number) {
  const past = day(now - 10 * DAY), future = day(now + 40 * DAY);
  const occ = (right: 'CALL' | 'PUT', expiry: string) => `XYZ   ${expiry.slice(2).replace(/-/g, '')}${right[0]}00123450`;
  const row = (id: string, kind: string, oc: string | null, right: 'CALL' | 'PUT', expiry: string, at: number, price: number, units = 1): OptionRow & { raw: unknown } => ({
    externalId: `demo-yolo_yuki-opt-${id}`, accountId: 'demo-acct', kind, openClose: oc, underlying: 'XYZ', underlyingType: 'cs', right, expiry,
    strikeMilli: 123_450, multiplier: 100, occTicker: occ(right, expiry), units, price, fee: 0.65, amount: kind === 'OPTIONEXPIRATION' ? 0 : null,
    currency: 'USD', executedAt: new Date(at), verified: false, raw: { demo: true },
  });
  await insertOptionActivities(userId, 'demo', [
    row('1b', 'BUY', 'BUY_TO_OPEN', 'CALL', past, now - 30 * DAY, 2.1, 2), row('1s', 'SELL', 'SELL_TO_CLOSE', 'CALL', past, now - 25 * DAY, 3.4, 2),
    row('2b', 'BUY', 'BUY_TO_OPEN', 'PUT', past, now - 28 * DAY, 1.8), row('2s', 'SELL', 'SELL_TO_CLOSE', 'PUT', past, now - 20 * DAY, 1.1),
    row('3b', 'BUY', 'BUY_TO_OPEN', 'CALL', day(now - 12 * DAY), now - 22 * DAY, 0.9),
    row('3x', 'OPTIONEXPIRATION', null, 'CALL', day(now - 12 * DAY), now - 12 * DAY, 0),
    { ...row('4s', 'SELL', 'SELL_TO_OPEN', 'PUT', future, now - 18 * DAY, 2.5), strikeMilli: 100_000, occTicker: `XYZ   ${future.slice(2).replace(/-/g, '')}P00100000` },
    { ...row('4b', 'BUY', 'BUY_TO_CLOSE', 'PUT', future, now - 9 * DAY, 1.2), strikeMilli: 100_000, occTicker: `XYZ   ${future.slice(2).replace(/-/g, '')}P00100000` },
    row('5b', 'BUY', 'BUY_TO_OPEN', 'CALL', future, now - 5 * DAY, 1.5),
  ]);
}

await sql`update closed_trades set thesis = 'Breakout above the 50-day on volume after earnings beat; stop under the gap.', thesis_status = 'published'
  where id = (select id from closed_trades where symbol = 'NVDA' order by closed_at desc limit 1)`;
await sql.end();
