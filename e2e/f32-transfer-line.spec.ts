// F-32 Part A (council cycle 5, C5-1): sells a vendor transfer row excludes (users.excluded_transfer) are named on the
// signed-out profile at 360 px by PROFILE.excludedTransfer, in muted text that is a real link (descriptive name, 44 px
// target) to the /how sentence rendering the same TRANSFER_REASON, in light and dark, reflowing at 320 px, and only
// while there are any. No transfer units, date or account reaches the page or its payload. The count itself is derived by
// the rebuild (lib/f32-transfers.db.test.ts); here the trader is seeded by SQL (as e2e/f24-excluded-held.spec.ts) with
// its own handle, deleted before and after; with one close it is not feed-eligible, so it takes no feed lock.
import { test, expect, type Page } from '@playwright/test';
import postgres from 'postgres';
import { HOW, PROFILE, TRANSFER_REASON } from '../lib/copy.ts';

const DAY = 86_400_000;
const HANDLE = 'f32_xfer';
// The stored transfer row's distinctive fields: none may appear on any public surface (P3, count only).
const UNITS = '37.125', ACCOUNT = 'F32-ACCT', DATE = '2024-03-14';
const sql = postgres(process.env.DATABASE_URL!, { max: 2, onnotice: () => {} });

test.describe.configure({ mode: 'serial' });
test.use({ viewport: { width: 360, height: 800 } });

test.beforeAll(async () => {
  await sql`delete from users where handle = ${HANDLE}`;
  const [u] = await sql`
    with a as (insert into signup_attempts (method, adult_attested_at) values ('dev', now()) returning id)
    insert into users (handle, display_name, adult_attested_at, signup_attempt_id) select ${HANDLE}, 'F32 Transfer', now(), a.id from a returning id, signup_attempt_id`;
  await sql`insert into connections (attempt_id, user_id, state, consent_at, importing_at, connected_at, last_progress_at)
    values (${u.signup_attempt_id}, ${u.id}, 'connected', now() - interval '60 days', now() - interval '60 days', now() - interval '60 days', now())`;
  const at = (d: number) => new Date(Date.now() - d * DAY);
  const act = (id: string, side: 'BUY' | 'SELL', price: number, executed: Date) => ({
    user_id: u.id, source: 'snaptrade', external_id: `${HANDLE}-${id}`, account_id: ACCOUNT, symbol: 'F32X', side, units: 10, price, fee: 0,
    executed_at: executed, raw: sql.json({ type: side }),
  });
  await sql`insert into activities ${sql([act('b', 'BUY', 100, at(30)), act('s', 'SELL', 104, at(20))])}`;
  await sql`insert into corporate_actions ${sql([{ user_id: u.id, source: 'snaptrade', external_id: `${HANDLE}-t`, account_id: ACCOUNT, symbol: 'F32Y', kind: 'unpriceable',
    detail: sql.json({ reason: 'unknown', units: Number(UNITS) }), executed_at: new Date(`${DATE}T00:00:00Z`), raw: sql.json({ id: `${HANDLE}-t`, type: 'TRANSFER', units: Number(UNITS), trade_date: DATE }) }])}`;
  await sql`insert into closed_trades ${sql([{ user_id: u.id, sell_id: `${HANDLE}-s`, account_id: ACCOUNT, symbol: 'F32X', opened_at: at(30), closed_at: at(20),
    return_pct: 0.04, holding_days: 10, verified: true }])}`;
  await sql`update users set excluded_transfer = 2 where id = ${u.id}`;
});

test.afterAll(async () => {
  await sql`delete from users where handle = ${HANDLE}`;
  await sql.end({ timeout: 1 });
});

// WCAG relative luminance contrast of two computed `rgb(...)` colours.
const contrast = (a: string, b: string) => {
  const lum = (c: string) => {
    const [r, g, bl] = (c.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number).map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
const colours = (page: Page) => page.evaluate(() => {
  const a = document.querySelector('[data-excluded-transfer] a')!;
  const probe = document.createElement('span');
  probe.style.color = 'var(--muted)';
  document.body.appendChild(probe);
  const muted = getComputedStyle(probe).color;
  probe.remove();
  let el: Element | null = a, bg = 'rgba(0, 0, 0, 0)';
  while (el && /rgba\(0, 0, 0, 0\)|transparent/.test(bg)) { bg = getComputedStyle(el).backgroundColor; el = el.parentElement; }
  return { link: getComputedStyle(a).color, muted, bg };
});

for (const scheme of ['light', 'dark'] as const) {
  test(`F-32 Part A (${scheme}): excluded_transfer = 2 → one muted link with PROFILE.excludedTransfer(2), a descriptive name, 44 px, AA contrast`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto(`/u/${HANDLE}`);
    const line = page.locator('[data-excluded-transfer]');
    await expect(line).toHaveCount(1);
    await expect(line).toHaveText(`${PROFILE.excludedTransfer(2)} ${PROFILE.excludedTransferLink}`);
    const link = line.getByRole('link', { name: `${PROFILE.excludedTransfer(2)} ${PROFILE.excludedTransferLink}` });
    await expect(link).toHaveAttribute('href', '/how#transfers');
    expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await expect(line.locator('svg, img, [role=alert], [role=img]')).toHaveCount(0);
    expect(await link.evaluate((a) => getComputedStyle(a).textDecorationLine)).toContain('underline'); // not colour alone
    const c = await colours(page);
    expect(c.link).toBe(c.muted);
    expect(contrast(c.link, c.bg)).toBeGreaterThanOrEqual(4.5);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  });
}

test('F-32 Part A: at 320 px the line reflows (no horizontal scroll) and keeps its 44 px target', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto(`/u/${HANDLE}`);
  const link = page.locator('[data-excluded-transfer] a');
  expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});

test('F-32 Part A: following the link lands on the /how sentence rendering the same TRANSFER_REASON', async ({ page }) => {
  await page.goto(`/u/${HANDLE}`);
  await page.locator('[data-excluded-transfer] a').click();
  await expect(page).toHaveURL(/\/how#transfers$/);
  const item = page.locator('#transfers');
  // F-22 (UX lead user test): the item ends with a link to the transfers-out item.
  await expect(item).toHaveText(`${HOW.transfer} ${HOW.transferOutPointer}`);
  await expect(item.getByRole('link', { name: HOW.transferOutPointer })).toHaveAttribute('href', '#transfers-out');
  await expect(item).toContainText(TRANSFER_REASON);
  await expect(item).toContainText('not a judgment of the trader');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
});

test('F-32 Part A (P3): no transfer units, date or account in the profile HTML or any response it loads', async ({ page }) => {
  const bodies: string[] = [];
  page.on('response', async (r) => { if (/text|json|javascript|x-component/.test(r.headers()['content-type'] ?? '')) bodies.push(await r.text().catch(() => '')); });
  await page.goto(`/u/${HANDLE}`);
  await page.waitForLoadState('networkidle');
  bodies.push(await page.content());
  for (const b of bodies) for (const s of [UNITS, ACCOUNT, DATE, 'Mar 14, 2024']) expect(b.includes(s), s).toBe(false);
});

test('F-32 Part A (T10): corporate 1, transfer 2, held 1 → three lines in that order, and only the transfer line is a link', async ({ page }) => {
  await sql`update users set excluded_corporate = 1, excluded_transfer = 2, excluded_held = 1 where handle = ${HANDLE}`;
  try {
    await page.goto(`/u/${HANDLE}`);
    const lines = [PROFILE.excludedCorporate(1), PROFILE.excludedTransfer(2), PROFILE.excludedHeld(1)];
    const texts = await page.locator('p.muted').allTextContents();
    const at = lines.map((l) => texts.findIndex((t) => t.startsWith(l)));
    expect(at.every((i) => i >= 0)).toBe(true);
    expect([...at].sort((x, y) => x - y)).toEqual(at);
    for (const [l, linked] of [[lines[0], 0], [lines[1], 1], [lines[2], 0]] as const) {
      await expect(page.locator('p.muted', { hasText: l }).locator('a')).toHaveCount(linked);
    }
  } finally {
    await sql`update users set excluded_corporate = 0, excluded_transfer = 2, excluded_held = 0 where handle = ${HANDLE}`;
  }
});

test('F-32 Part A: excluded_transfer = 0 → the line is gone', async ({ page }) => {
  await sql`update users set excluded_transfer = 0 where handle = ${HANDLE}`;
  await page.goto(`/u/${HANDLE}`);
  await expect(page.locator('h1')).toBeVisible();
  await expect(page.locator('[data-excluded-transfer]')).toHaveCount(0);
  expect(await page.content()).not.toContain(TRANSFER_REASON);
});
