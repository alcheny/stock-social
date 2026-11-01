// F-4 · The share card (docs/features/F-4-share-card.md), AC9 and AC10 against the running app: the link unfurl image
// and the Share button's picture render at their sizes for every record state, the unfurl and the square read in a
// 343 px-wide preview (a 375 px phone with 16 px gutters), and the printed link ignores the request's Host header
// (committee round 1, demand 8). With F4_SHOTS=1 the renders are saved to the F-4 log.
import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

const DAY = 86_400_000;
const SHOTS = process.env.F4_SHOTS === '1';
const DIR = 'docs/features/logs/F-4/screenshots';
const dim = (b: Buffer) => [b.readUInt32BE(16), b.readUInt32BE(20)];

test.describe.configure({ mode: 'serial' });

// Closed trades only, percent-only columns. Every close ends 40+ days ago (except where the state needs a young record)
// so these records never lead the feed other specs read. Deterministic.
type Row = { symbol: string; opened: number; closed: number; r: number };
function rows(n: number, spanDays: number, mean: number, spread: number, sign: 1 | -1, symbols: number, endDaysAgo = 40): Row[] {
  let seed = 20261026;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
  const end = Date.now() - endDaysAgo * DAY;
  return Array.from({ length: n }, (_, i) => {
    const closed = end - (n - 1 - i) * (spanDays / Math.max(n, 1)) * DAY;
    const hold = 0.5 + rnd() * 3;
    const x = sign * (mean + (rnd() * 2 - 1) * spread); // log return
    return { symbol: `F${i % symbols}`, opened: closed - hold * DAY, closed, r: Math.expm1(x) };
  });
}
type Fixture = { name: string; trades: Row[]; verified?: boolean; demo?: boolean; connection?: 'connected' | 'importing' | 'failed'; open?: number[] };
const FIXTURES: Record<string, Fixture> = {
  winning: { name: 'Winning Fixture', trades: rows(48, 420, 0.012, 0.05, 1, 48) },
  losing: { name: 'Losing Fixture', trades: rows(48, 420, 0.012, 0.05, -1, 48) },
  empty: { name: 'Empty Fixture', trades: [] },
  heavy: { name: 'Heavy Fixture', trades: rows(4200, 1100, 0.002, 0.06, 1, 400) },
  three: { name: 'Three Trades', trades: rows(3, 20, 0.02, 0.03, 1, 3, 2) },
  wide: { name: 'Wide Range', trades: rows(12, 120, 0.02, 0.45, 1, 12) },
  demo: { name: 'Demo Fixture', trades: rows(30, 60, 0.008, 0.06, 1, 30, 1), demo: true },
  unverified: { name: 'Unverified Fixture', trades: rows(20, 200, 0.01, 0.04, 1, 20), verified: false },
  failed: { name: 'Failed Import', trades: rows(40, 300, 0.01, 0.05, 1, 40), connection: 'failed' },
  importing: { name: 'Importing Fixture', trades: rows(10, 100, 0.01, 0.05, 1, 10), connection: 'importing' },
  connected: { name: 'Connected Empty', trades: [], connection: 'connected' },
  longname: { name: 'A Forty Character Display Name For Tests', trades: rows(48, 420, 0.012, 0.05, 1, 48) },
  months: { name: 'Many Months', trades: rows(40, 3400, 0.01, 0.05, 1, 40) },
  one: { name: 'One Trade', trades: rows(1, 1, 0.05, 0, 1, 1, 3) },
  // F-4 rework (2026-11-01): the trust rows not rendered before, and F-6's open positions on the card.
  under5: { name: 'Under Five Bets', trades: rows(4, 30, 0.02, 0.03, 1, 4) },
  modneg: { name: 'Moderate Negative', trades: rows(60, 200, 0.03, 0.03, -1, 60) },
  strongpos: { name: 'Strong Positive', trades: rows(150, 500, 0.02, 0.03, 1, 150) },
  open_mixed: { name: 'Open Mixed', trades: rows(48, 420, 0.012, 0.05, 1, 48), connection: 'connected', open: [0.121, 0.034, -0.08] },
  open_losing: { name: 'Open Losing', trades: rows(48, 420, 0.012, 0.05, 1, 48), connection: 'connected', open: [-0.08, -0.215, -0.031] },
  open_only: { name: 'Open Only', trades: [], connection: 'connected', open: [0.121, 0.034, -0.08] },
  open_under5: { name: 'Open Under Five', trades: rows(3, 20, 0.02, 0.03, 1, 3, 2), connection: 'connected', open: [0.05, -0.02] },
  open_flat: { name: 'Open One Flat', trades: rows(48, 420, 0.012, 0.05, 1, 48), connection: 'connected', open: [0.0004] },
  // QA 2026-11-01: wide headlines never run into their label.
  twodig: { name: 'Two Digit Average', trades: rows(12, 120, 0.2, 0.05, 1, 12) },
  bigpos: { name: 'Big Average', trades: rows(6, 60, 2.5, 0.1, 1, 6) },
  open_tight: { name: 'A Thirty Character Display Nam', trades: rows(8, 20, 0.01, 0.05, 1, 8, 2), connection: 'failed',
    open: [-1, 2.5, -0.991, 1.234, 0.5, -0.25, 0.75, -0.6, 1.01, -0.333, 0.12, 9.99] },
};
const handle = (k: string) => `f4_card_${k}`;
const HANDLES = Object.keys(FIXTURES).map(handle);

test.beforeAll(async () => {
  const { sql } = await import('../lib/db.ts');
  await sql`delete from users where handle in ${sql(HANDLES)}`;
  for (const [k, f] of Object.entries(FIXTURES)) {
    const [u] = await sql`
      with a as (insert into signup_attempts (method, adult_attested_at) values ('dev', now()) returning id)
      insert into users (handle, display_name, adult_attested_at, signup_attempt_id) select ${handle(k)}, ${f.name}, now(), a.id from a returning id, signup_attempt_id`;
    const data = f.trades.map((t, i) => ({ user_id: u.id, sell_id: `${handle(k)}-${i}`, account_id: 'f4', symbol: t.symbol, opened_at: new Date(t.opened),
      closed_at: new Date(t.closed), return_pct: t.r, holding_days: (t.closed - t.opened) / DAY, verified: !f.demo && f.verified !== false }));
    for (let i = 0; i < data.length; i += 1000) await sql`insert into closed_trades ${sql(data.slice(i, i + 1000))}`;
    if (f.demo) await sql`insert into activities (user_id, source, external_id, account_id, symbol, side, units, price, executed_at, raw)
      values (${u.id}, 'demo', ${`${handle(k)}-demo`}, 'demo-acct', 'F0', 'BUY', 1, 10, now() - interval '61 days', '{}')`;
    if (f.connection) await sql`insert into connections (attempt_id, user_id, state, consent_at, importing_at, last_progress_at)
      values (${u.signup_attempt_id}, ${u.id}, ${f.connection}, now(), now(), now())`;
    if (f.open?.length) await sql`insert into open_positions ${sql(f.open.map((x, i) => ({ user_id: u.id, account_id: 'f4', symbol: `O${i}`, unrealized_pct: x })))}`;
  }
  if (SHOTS) mkdirSync(DIR, { recursive: true });
});

test.afterAll(async () => {
  const { sql } = await import('../lib/db.ts');
  await sql`delete from users where handle in ${sql(HANDLES)}`;
});

test('F-4 card: the unfurl (1200×630) and the Share button picture (1080×1080, story 1080×1920) for every record state', async ({ request }) => {
  for (const k of Object.keys(FIXTURES)) {
    for (const [path, w, h] of [['opengraph-image', 1200, 630], ['story?format=square', 1080, 1080], ['story?format=story', 1080, 1920]] as const) {
      const res = await request.get(`/u/${handle(k)}/${path}`);
      expect(res.status(), `${k} ${path}`).toBe(200);
      expect(res.headers()['content-type']).toContain('image/png');
      const body = await res.body();
      expect(dim(body), `${k} ${path}`).toEqual([w, h]);
      if (SHOTS) writeFileSync(`${DIR}/${k}-${path.startsWith('story') ? path.split('=')[1] : 'unfurl'}.png`, body);
    }
  }
  expect((await request.get('/u/f4-no-such-handle/opengraph-image')).status()).toBe(404);
});

test('F-4 card: readable in a phone preview (343 px wide in a 375 px viewport)', async ({ page, baseURL }) => {
  await page.setViewportSize({ width: 375, height: 700 });
  for (const k of Object.keys(FIXTURES)) {
    for (const [path, name] of [['opengraph-image', 'unfurl'], ['story?format=square', 'square']] as const) {
      await page.setContent(`<body style="margin:0;padding:16px;background:#fff"><img id="c" style="width:343px;display:block" src="${baseURL}/u/${handle(k)}/${path}"></body>`);
      const img = page.locator('#c');
      await expect.poll(() => img.evaluate((e: HTMLImageElement) => e.complete && e.naturalWidth)).toBeGreaterThan(0);
      const box = (await img.boundingBox())!;
      expect(Math.round(box.width)).toBe(343);
      if (SHOTS) await img.screenshot({ path: `${DIR}/${k}-${name}-375.png` });
    }
  }
});

test('F-4 card (round 1, demand 8): a forged Host header never reaches the printed link', async ({ request }) => {
  for (const format of ['square', 'story']) {
    const plain = await (await request.get(`/u/${handle('winning')}/story?format=${format}`)).body();
    const forged = await request.get(`/u/${handle('winning')}/story?format=${format}`, { headers: { Host: 'evil.example' } });
    expect(forged.status()).toBe(200);
    // The same picture byte for byte: the host the request named is not printed on it.
    expect(Buffer.compare(await forged.body(), plain), format).toBe(0);
  }
});

// F-4 rework (2026-11-01) and F-6 on the card, against the running app: the text under the link preview drops the
// win rate and matches the card; open positions appear in words; the demo record reads the same length on the profile
// and the card (first trade to last close).
test('F-4 rework: the link-preview text matches the card, with open positions, and never a win rate', async ({ page }) => {
  const description = async (h: string) => {
    await page.goto(`/u/${h}`);
    return (await page.locator('meta[name="description"]').getAttribute('content')) ?? '';
  };
  const win = await description(handle('winning'));
  expect(win).not.toMatch(/win rate/i);
  // POLICY F3: a preview text quoting a figure carries the disclaimer (text-only previews show no image).
  expect(win.endsWith('Not investment advice. Past performance does not guarantee future results.')).toBe(true);
  // The profile this link lands on prints the card's range (user test 2026-11-01: one answer, not two).
  const cardRange = win.match(/likely between ([+-]\d+\.\d%) and ([+-]\d+\.\d%)/)!;
  await expect(page.locator('.range').first()).toHaveText(`(${cardRange[1]} to ${cardRange[2]}) · 95% range`);
  expect(win).toMatch(/[+-]\d+\.\d% average per trade, likely between [+-]\d+\.\d% and [+-]\d+\.\d% · Record since \w{3} \d{4} · \d+ \w+ · Evidence: \w+/);
  const mixed = await description(handle('open_mixed'));
  expect(mixed).toContain('average per closed trade');
  // F-6's one wording for open positions in text, after the closed-trade figures, then the disclaimer.
  expect(mixed).toMatch(/Evidence: \w+ · 3 open positions · 2\sup, 1\sdown · \+2\.5% avg unrealized\. Not investment advice\./); // \s: F-6's no-break spaces
  expect(mixed).not.toMatch(/\bO\d\b/); // no symbol
  // No closes: the empty-record line alone (F-6 / PR-2b); the picture still shows the open positions.
  expect(await description(handle('open_only'))).not.toMatch(/%/);
  // The demo record: the profile's evidence line and the card (its words under the preview) give the same days.
  const demo = await description('momentum_maya');
  const cardDays = demo.match(/ · (\d+) days · Evidence/)?.[1];
  const profileDays = (await page.getByText(/Evidence: \w+ \(\d+ bets?, \d+ days?\)/).first().textContent())?.match(/, (\d+) days?\)/)?.[1];
  expect(cardDays).toBeTruthy();
  expect(cardDays).toBe(profileDays);
});
