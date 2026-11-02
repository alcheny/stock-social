// F-22 (owner OD 2.28): transfers out of an account (users.excluded_transferred_out) and shown sells partly from shares
// that arrived by transfer (users.sells_partly_transferred) are named on the signed-out profile at 360 px, each in muted
// text that is a real, underlined link (descriptive name, 44 px) to its /how item, in light and dark, reflowing at 320 px,
// after the transfer line and only while there are any. No transfer units, date or account reaches the page. The counts
// are derived by the rebuild (lib/f22-transfers.db.test.ts); here the trader is seeded by SQL with its own handle,
// deleted before and after (as e2e/f32-transfer-line.spec.ts).
import { test, expect, type Page } from '@playwright/test';
import postgres from 'postgres';
import { HOW, PROFILE } from '../lib/copy.ts';

const DAY = 86_400_000;
const HANDLE = 'f22_xfer';
const UNITS = '37.125', ACCOUNT = 'F22-ACCT', DATE = '2024-03-14';
const sql = postgres(process.env.DATABASE_URL!, { max: 2, onnotice: () => {} });

test.describe.configure({ mode: 'serial' });
test.use({ viewport: { width: 360, height: 800 } });

test.beforeAll(async () => {
  await sql`delete from users where handle = ${HANDLE}`;
  const [u] = await sql`
    with a as (insert into signup_attempts (method, adult_attested_at) values ('dev', now()) returning id)
    insert into users (handle, display_name, adult_attested_at, signup_attempt_id) select ${HANDLE}, 'F22 Transfer', now(), a.id from a returning id, signup_attempt_id`;
  await sql`insert into connections (attempt_id, user_id, state, consent_at, importing_at, connected_at, last_progress_at)
    values (${u.signup_attempt_id}, ${u.id}, 'connected', now() - interval '60 days', now() - interval '60 days', now() - interval '60 days', now())`;
  const at = (d: number) => new Date(Date.now() - d * DAY);
  const act = (id: string, side: 'BUY' | 'SELL', price: number, executed: Date) => ({
    user_id: u.id, source: 'snaptrade', external_id: `${HANDLE}-${id}`, account_id: ACCOUNT, symbol: 'F22X', side, units: 10, price, fee: 0,
    executed_at: executed, raw: sql.json({ type: side }),
  });
  await sql`insert into activities ${sql([act('b', 'BUY', 100, at(30)), act('s', 'SELL', 104, at(20))])}`;
  await sql`insert into corporate_actions ${sql([{ user_id: u.id, source: 'snaptrade', external_id: `${HANDLE}-t`, account_id: ACCOUNT, symbol: 'F22Y', kind: 'unpriceable',
    detail: sql.json({ reason: 'unknown', units: -Number(UNITS) }), executed_at: new Date(`${DATE}T00:00:00Z`), raw: sql.json({ id: `${HANDLE}-t`, type: 'EXTERNAL_ASSET_TRANSFER_OUT', units: -Number(UNITS), trade_date: DATE }) }])}`;
  await sql`insert into closed_trades ${sql([{ user_id: u.id, sell_id: `${HANDLE}-s`, account_id: ACCOUNT, symbol: 'F22X', opened_at: at(30), closed_at: at(20),
    return_pct: 0.04, holding_days: 10, verified: true }])}`;
  await sql`update users set excluded_transfer = 1, excluded_transferred_out = 3, sells_partly_transferred = 1 where id = ${u.id}`;
});

test.afterAll(async () => {
  await sql`delete from users where handle = ${HANDLE}`;
  await sql.end({ timeout: 1 });
});

const contrast = (a: string, b: string) => {
  const lum = (c: string) => {
    const [r, g, bl] = (c.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number).map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
const colours = (page: Page, sel: string) => page.evaluate((sel) => {
  const a = document.querySelector(`${sel} a`)!;
  const probe = document.createElement('span');
  probe.style.color = 'var(--muted)';
  document.body.appendChild(probe);
  const muted = getComputedStyle(probe).color;
  probe.remove();
  let el: Element | null = a, bg = 'rgba(0, 0, 0, 0)';
  while (el && /rgba\(0, 0, 0, 0\)|transparent/.test(bg)) { bg = getComputedStyle(el).backgroundColor; el = el.parentElement; }
  return { link: getComputedStyle(a).color, muted, bg, underline: getComputedStyle(a).textDecorationLine };
}, sel);

const LINES = [
  { sel: '[data-excluded-transferred-out]', text: PROFILE.excludedTransferredOut(3), suffix: PROFILE.excludedTransferredOutLink, href: '/how#transfers-out' },
  { sel: '[data-sells-partly-transferred]', text: PROFILE.sellsPartlyTransferred(1), suffix: PROFILE.excludedTransferLink, href: '/how#transfers' },
];

for (const scheme of ['light', 'dark'] as const) {
  test(`F-22 (${scheme}): the transfers-out and partly-transferred lines are muted, underlined real links with descriptive names, 44 px, AA contrast`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto(`/u/${HANDLE}`);
    for (const l of LINES) {
      const line = page.locator(l.sel);
      await expect(line).toHaveCount(1);
      const link = line.getByRole('link', { name: `${l.text} ${l.suffix}`, exact: true });
      await expect(link).toHaveAttribute('href', l.href);
      expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      await expect(line.locator('svg, img, [role=alert], [role=img]')).toHaveCount(0);
      const c = await colours(page, l.sel);
      expect(c.link).toBe(c.muted);
      expect(c.underline).toContain('underline');
      expect(contrast(c.link, c.bg)).toBeGreaterThanOrEqual(4.5);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  });
}

test('F-22: the lines follow the transfer line, in order; at 320 px they reflow with no horizontal scroll', async ({ page }) => {
  await page.goto(`/u/${HANDLE}`);
  const order = await page.evaluate(() => ['[data-excluded-transfer]', '[data-excluded-transferred-out]', '[data-sells-partly-transferred]']
    .map((s) => Array.from(document.querySelectorAll('p.muted')).indexOf(document.querySelector(s)!)));
  expect(order.every((i) => i >= 0)).toBe(true);
  expect([...order].sort((a, b) => a - b)).toEqual(order);
  await page.setViewportSize({ width: 320, height: 800 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});

test('F-22: the transfers-out link lands on /how#transfers-out, which names FIFO as the record\'s own matching method', async ({ page }) => {
  await page.goto(`/u/${HANDLE}`);
  await page.locator('[data-excluded-transferred-out] a').click();
  await expect(page).toHaveURL(/\/how#transfers-out$/);
  await expect(page.locator('#transfers-out')).toHaveText(HOW.transferOut);
  await expect(page.locator('#transfers-out')).toContainText('not the broker');
});

test('F-22 (P3): no transfer units, date or account in the profile HTML or any response it loads', async ({ page }) => {
  const bodies: string[] = [];
  page.on('response', async (r) => { if (/text|json|javascript|x-component/.test(r.headers()['content-type'] ?? '')) bodies.push(await r.text().catch(() => '')); });
  await page.goto(`/u/${HANDLE}`);
  await page.waitForLoadState('networkidle');
  bodies.push(await page.content());
  for (const b of bodies) for (const s of [UNITS, ACCOUNT, DATE, 'Mar 14, 2024']) expect(b.includes(s), s).toBe(false);
});

test('F-22: both counts 0 → both lines are gone', async ({ page }) => {
  await sql`update users set excluded_transferred_out = 0, sells_partly_transferred = 0 where handle = ${HANDLE}`;
  await page.goto(`/u/${HANDLE}`);
  await expect(page.locator('h1')).toBeVisible();
  await expect(page.locator('[data-excluded-transferred-out], [data-sells-partly-transferred]')).toHaveCount(0);
});
