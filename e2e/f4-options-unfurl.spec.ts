// F4-5 (cycle 4, C4-10; XR-B N2): the text unfurls of a gated options record carry the options qualifier on all three
// shared pages: the profile (now also the gated count line, after the evidence and before the disclaimer, as the card
// and its alt do), a trade page and a month page. Fixture: the seeded demo trader with options (yolo_yuki,
// scripts/seed.ts), as e2e/options.spec.ts uses. A trader without options keeps descriptions with no qualifier.
import { expect, test } from '@playwright/test';
import postgres from 'postgres';
import { OPTIONS } from '../lib/copy.ts';

const sql = postgres(process.env.DATABASE_URL!, { max: 2, onnotice: () => {} });
const DISCLAIMER = 'Not investment advice. Past performance does not guarantee future results.';
const OCC = /[A-Z]{1,6}\s*\d{6}[CP]\d{8}/;
test.afterAll(async () => { await sql.end({ timeout: 1 }); });
test.use({ viewport: { width: 360, height: 740 } });

const describe = async (page: import('@playwright/test').Page, path: string) => {
  await page.goto(path);
  return (await page.locator('meta[name="description"]').getAttribute('content')) ?? '';
};

test('F4-5: the profile, trade and month meta descriptions of a gated options record all carry the options qualifier; the profile also the count line before the disclaimer', async ({ page }) => {
  const [u] = await sql`select id, excluded_options_short, excluded_options_other, open_options_short from users where handle = 'yolo_yuki'`;
  test.skip(!u, 'the demo data is not seeded (npm run db:seed)');
  const [{ shown, open }] = await sql`select (select count(*)::int from option_trades where user_id = ${u.id}) as shown, (select count(*)::int from open_option_positions where user_id = ${u.id}) as open`;
  const line = OPTIONS.gated(shown + u.excluded_options_short + u.excluded_options_other, open + u.open_options_short);
  const [t] = await sql`select sell_id, to_char(closed_at, 'YYYY-MM') as ym from closed_trades where user_id = ${u.id} order by closed_at desc limit 1`;

  const profile = await describe(page, '/u/yolo_yuki');
  expect(profile).toMatch(/average per (closed )?trade, excluding options/);
  expect(profile).toContain(` · Evidence: `);
  // The count line comes after the evidence and right before the disclaimer (or the open positions' line).
  const at = profile.indexOf(line);
  expect(at, profile).toBeGreaterThan(profile.indexOf('Evidence: '));
  expect(at, profile).toBeLessThan(profile.indexOf(DISCLAIMER));
  expect(profile.endsWith(DISCLAIMER)).toBe(true);

  for (const path of [`/u/yolo_yuki/trade/${encodeURIComponent(t.sell_id)}`, `/u/yolo_yuki/month/${t.ym}`]) {
    const d = await describe(page, path);
    expect(d.toLowerCase(), path).toContain('excluding options');
  }

  // No option figure, term or contract symbol in any of the three.
  for (const path of ['/u/yolo_yuki', `/u/yolo_yuki/trade/${encodeURIComponent(t.sell_id)}`, `/u/yolo_yuki/month/${t.ym}`]) {
    const d = await describe(page, path);
    for (const bad of ['Call option', 'Put option', '123.45', 'Options:']) expect(d, path).not.toContain(bad);
    expect(d, path).not.toMatch(OCC);
  }
});

test('F4-5: a trader without options keeps descriptions with no qualifier and no count line', async ({ page }) => {
  const [m] = await sql`select c.sell_id from closed_trades c join users u on u.id = c.user_id where u.handle = 'momentum_maya' order by c.closed_at desc limit 1`;
  test.skip(!m, 'the demo data is not seeded (npm run db:seed)');
  for (const path of ['/u/momentum_maya', `/u/momentum_maya/trade/${encodeURIComponent(m.sell_id)}`]) {
    const d = await describe(page, path);
    expect(d.toLowerCase(), path).not.toContain('excluding options');
    expect(d, path).not.toContain('option trade');
  }
});
