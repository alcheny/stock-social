// F-7 (plan-round2-engineer.md §4.3 AC 9, 23 surfaces; legal C13, C19): every route under app/u/[handle]/ gates a
// public-record filer, so with the switch off, or a filer hidden or removed, the profile, pane, chart, trade and month
// pages, the share images and the story picture are all 404 (or the "not found" image). Static check of every route
// file, then the lib loaders behind them against the database. Fictional filers only.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ROUTE = /(^|\/)(page\.tsx|route\.tsx?|opengraph-image\.tsx)$/;
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
}
// A file gates when it, or a module it imports (one level), uses the filer gate from lib/public-gate.ts.
function gates(file: string): boolean {
  const s = readFileSync(file, 'utf8');
  if (/filerVisible(Sql)?\(/.test(s)) return true;
  for (const [, spec] of s.matchAll(/from '([^']+)'/g)) {
    const p = spec.startsWith('@/') ? join(root, spec.slice(2)) : spec.startsWith('.') ? resolve(dirname(file), spec) : null;
    if (p && existsSync(p) && /filerVisible(Sql)?\(/.test(readFileSync(p, 'utf8'))) return true;
  }
  return false;
}

test('AC 9: every route file under app/u/[handle]/ gates public-record filers', () => {
  const routes = walk(join(root, 'app/u/[handle]')).filter((f) => ROUTE.test(f));
  assert.ok(routes.length >= 9, `${routes.length} route files`);
  const open = routes.filter((f) => !gates(f)).map((f) => f.slice(root.length + 1));
  assert.deepEqual(open, []);
});

test('AC 30 (C22): the profile declares noindex for a public record', () => {
  assert.match(readFileSync(join(root, 'app/u/[handle]/page.tsx'), 'utf8'), /robots: \{ index: false/);
});

const hasDb = !!process.env.DATABASE_URL;
after(async () => { if (hasDb) await (await import('./db.ts')).sql.end({ timeout: 1 }); });
test('AC 9 / AC 23: the trade and month loaders return nothing for a hidden or removed filer, or with the switch off', { skip: !hasDb && 'no DATABASE_URL' }, async () => {
  const { sql } = await import('./db.ts');
  const { insertFiler, deleteFilers } = await import('../e2e/f7-fixture.ts');
  const { loadTradeShare } = await import('./trade-share-load.ts');
  const { loadRecap } = await import('./recap-load.ts');
  const h = `pf_r${Math.random().toString(36).slice(2, 8)}`;
  await deleteFilers(sql, [h]);
  const old = process.env.PUBLIC_TRADERS;
  try {
    const { filerId } = await insertFiler(sql, { handle: h, name: 'Fictional Filer Route', closes: [{ symbol: 'ZQXR', r: 0.1, daysAgo: 3 }] });
    const [t] = await sql`select sell_id, to_char(closed_at, 'YYYY-MM') as ym from closed_trades where user_id = (select id from users where handle = ${h})`;
    const both = async () => [await loadTradeShare(h, t.sell_id), await loadRecap(h, t.ym)];
    const shown = await both();
    assert.ok(shown.every(Boolean), 'visible with the switch on');
    const trade = shown[0] as unknown as { state: string; newRecord: boolean; filings: { sold: string; bought: string[] } };
    assert.equal(trade.state, 'public_demo');
    assert.equal(trade.newRecord, false);
    assert.match(trade.filings.sold, /^https:\/\/filings\.example\/.*sale/);
    assert.match(trade.filings.bought[0], /^https:\/\/filings\.example\/.*buy/);
    process.env.PUBLIC_TRADERS = '0';
    assert.deepEqual(await both(), [null, null]);
    if (old === undefined) delete process.env.PUBLIC_TRADERS; else process.env.PUBLIC_TRADERS = old;
    await sql`update public_filers set hidden_at = now() where id = ${filerId}`;
    assert.deepEqual(await both(), [null, null]);
    await sql`update public_filers set hidden_at = null, removed_at = now() where id = ${filerId}`;
    assert.deepEqual(await both(), [null, null]);
  } finally {
    if (old === undefined) delete process.env.PUBLIC_TRADERS; else process.env.PUBLIC_TRADERS = old;
    await deleteFilers(sql, [h]);
  }
});
