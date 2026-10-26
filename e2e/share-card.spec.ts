// F-4 · The share card (docs/features/F-4-share-card.md), AC9 and AC10 against the running app: the link unfurl image
// and the Share button's picture render at their sizes for a winning, a losing, an empty and a thousands-of-trades
// record, and the unfurl reads in a 375 px-wide preview. With F4_SHOTS=1 the renders are saved to the F-4 log.
import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

const DAY = 86_400_000;
const SHOTS = process.env.F4_SHOTS === '1';
const DIR = 'docs/features/logs/F-4/screenshots';
const dim = (b: Buffer) => [b.readUInt32BE(16), b.readUInt32BE(20)];
const HANDLES = { winning: 'f4_card_winning', losing: 'f4_card_losing', empty: 'f4_card_empty', heavy: 'f4_card_heavy' } as const;

test.describe.configure({ mode: 'serial' });

// Closed trades only, percent-only columns, verified like a broker import. Every close ends 40+ days ago so these
// records never lead the feed other specs read. Deterministic.
type Row = { symbol: string; opened: number; closed: number; r: number };
function rows(n: number, spanDays: number, mean: number, spread: number, sign: 1 | -1, symbols: number): Row[] {
  let seed = 20261026;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
  const end = Date.now() - 40 * DAY;
  return Array.from({ length: n }, (_, i) => {
    const closed = end - (n - 1 - i) * (spanDays / n) * DAY;
    const hold = 0.5 + rnd() * 3;
    const x = sign * (mean + (rnd() * 2 - 1) * spread); // log return
    return { symbol: `F${i % symbols}`, opened: closed - hold * DAY, closed, r: Math.expm1(x) };
  });
}

test.beforeAll(async () => {
  const { sql } = await import('../lib/db.ts');
  await sql`delete from users where handle in ${sql(Object.values(HANDLES))}`;
  const make = async (handle: string, name: string, trades: Row[]) => {
    const [u] = await sql`
      with a as (insert into signup_attempts (method, adult_attested_at) values ('dev', now()) returning id)
      insert into users (handle, display_name, adult_attested_at, signup_attempt_id) select ${handle}, ${name}, now(), a.id from a returning id`;
    const data = trades.map((t, i) => ({ user_id: u.id, sell_id: `${handle}-${i}`, account_id: 'f4', symbol: t.symbol, opened_at: new Date(t.opened),
      closed_at: new Date(t.closed), return_pct: t.r, holding_days: (t.closed - t.opened) / DAY, verified: true }));
    for (let i = 0; i < data.length; i += 1000) await sql`insert into closed_trades ${sql(data.slice(i, i + 1000))}`;
  };
  await make(HANDLES.winning, 'Winning Fixture', rows(48, 420, 0.012, 0.05, 1, 48));
  await make(HANDLES.losing, 'Losing Fixture', rows(48, 420, 0.012, 0.05, -1, 48));
  await make(HANDLES.empty, 'Empty Fixture', []);
  await make(HANDLES.heavy, 'Heavy Fixture', rows(4200, 1100, 0.002, 0.06, 1, 400));
  if (SHOTS) mkdirSync(DIR, { recursive: true });
});

test.afterAll(async () => {
  const { sql } = await import('../lib/db.ts');
  await sql`delete from users where handle in ${sql(Object.values(HANDLES))}`;
});

test('F-4 card: the unfurl (1200×630) and the Share button picture (1080×1080, story 1080×1920) for winning, losing, empty and heavy records', async ({ request }) => {
  for (const [state, handle] of Object.entries(HANDLES)) {
    for (const [path, w, h] of [['opengraph-image', 1200, 630], ['story?format=square', 1080, 1080], ['story?format=story', 1080, 1920]] as const) {
      const res = await request.get(`/u/${handle}/${path}`);
      expect(res.status(), `${state} ${path}`).toBe(200);
      expect(res.headers()['content-type']).toContain('image/png');
      const body = await res.body();
      expect(dim(body), `${state} ${path}`).toEqual([w, h]);
      if (SHOTS) writeFileSync(`${DIR}/${state}-${path.startsWith('story') ? path.split('=')[1] : 'unfurl'}.png`, body);
    }
  }
  expect((await request.get('/u/f4-no-such-handle/opengraph-image')).status()).toBe(404);
});

test('F-4 card: readable in a 375 px-wide preview, the way a phone shows a link preview', async ({ page, baseURL }) => {
  await page.setViewportSize({ width: 375, height: 700 });
  for (const [state, handle] of Object.entries(HANDLES)) {
    for (const [path, name] of [['opengraph-image', 'unfurl'], ['story?format=square', 'square']] as const) {
      await page.setContent(`<body style="margin:0;padding:16px;background:#fff"><img id="c" style="width:343px;display:block" src="${baseURL}/u/${handle}/${path}"></body>`);
      const img = page.locator('#c');
      await expect.poll(() => img.evaluate((e: HTMLImageElement) => e.complete && e.naturalWidth)).toBeGreaterThan(0);
      const box = (await img.boundingBox())!;
      expect(Math.round(box.width)).toBe(343);
      if (SHOTS) await img.screenshot({ path: `${DIR}/${state}-${name}-375.png` });
    }
  }
});
