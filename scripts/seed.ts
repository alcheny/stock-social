// Demo data so the product can be shown without broker keys. Everything is source='demo' and shows a Demo badge.
// Run: npm run db:seed   (idempotent: re-running inserts nothing new)
import { sql } from '../lib/db.ts';
import { insertActivities, rebuildTrades } from '../lib/sync.ts';
import type { Activity } from '../lib/trades.ts';

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
  await rebuildTrades(u.id);
  console.log(`seeded @${t.handle}`);
}

await sql`update closed_trades set thesis = 'Breakout above the 50-day on volume after earnings beat; stop under the gap.', thesis_status = 'published'
  where id = (select id from closed_trades where symbol = 'NVDA' order by closed_at desc limit 1)`;
await sql.end();
