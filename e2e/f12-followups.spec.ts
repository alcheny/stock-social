// Cycle-2 fix #20, image part (docs/ideas/approval-2026-11-01-cycle2.md): the trade and month share images answer 404 for
// a missing record, as the profile card does (share-card.spec.ts), instead of a 200 picture saying "not found" that a
// link preview would show. A real seeded trade and month still render as PNG. Reads the seeded demo trader only.
import { test, expect } from '@playwright/test';

test('cycle-2 #20: trade and month images are 404 for a missing record and a PNG for a real one', async ({ request }) => {
  const { sql } = await import('../lib/db.ts');
  const [t] = await sql`select ct.sell_id, to_char(ct.closed_at at time zone 'UTC', 'YYYY-MM') as ym
    from closed_trades ct join users u on u.id = ct.user_id and u.deleted_at is null
    where u.handle = 'momentum_maya' order by ct.closed_at desc, ct.id desc limit 1`;
  expect(t, 'the seeded demo trader has a closed trade (npm run db:seed)').toBeTruthy();
  const sell = encodeURIComponent(t.sell_id as string);
  // A month the demo trader has no trade in (2000-01 is the earliest month a recap URL accepts).
  const [{ n }] = await sql`select count(*)::int as n from closed_trades ct join users u on u.id = ct.user_id
    where u.handle = 'momentum_maya' and ct.closed_at >= '2000-01-01' and ct.closed_at < '2000-02-01'`;
  expect(n).toBe(0);

  for (const [label, url] of [
    ['trade', `/u/momentum_maya/trade/${sell}/opengraph-image`],
    ['month', `/u/momentum_maya/month/${t.ym}/opengraph-image`],
  ] as const) {
    const r = await request.get(url);
    expect(r.status(), label).toBe(200);
    expect(r.headers()['content-type'], label).toContain('image/png');
  }

  for (const [label, url] of [
    ['trade: unknown handle', `/u/f12-no-such-handle/trade/${sell}/opengraph-image`],
    ['trade: unknown sellId', '/u/momentum_maya/trade/f12-no-such-sell/opengraph-image'],
    ['month: unknown handle', `/u/f12-no-such-handle/month/${t.ym}/opengraph-image`],
    ['month: invalid month', '/u/momentum_maya/month/2026-13/opengraph-image'],
    ['month: not a month', '/u/momentum_maya/month/latest/opengraph-image'],
    ['month: before 2000', '/u/momentum_maya/month/1999-12/opengraph-image'],
    ['month: in the future', '/u/momentum_maya/month/2999-01/opengraph-image'],
    ['month: no trades that month', '/u/momentum_maya/month/2000-01/opengraph-image'],
  ] as const) {
    const r = await request.get(url);
    expect(r.status(), label).toBe(404);
    expect(r.headers()['content-type'] ?? '', `${label}: no picture`).not.toContain('image/png');
  }
});
