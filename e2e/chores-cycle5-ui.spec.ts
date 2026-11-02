// Chores cycle 5, UI slice, end to end at 360 px against `npm run start` with ALLOW_DEV_AUTH=1 and the seeded demo data
// (docs/ideas/approval-2026-11-01-cycle5.md → Routed, chore lane): C5-39 no arrow in any link or button name, C5-38 the
// pressed range tab in forced colours, C5-36 (narrowed) the two Settings lines, C5-37 (narrowed) one "Legal" landmark.
// The static guards are in lib/chores-cycle5-ui.test.ts. Fixture accounts are this file's own, by handle; fictional
// data only (POLICY P2).
import { expect, test, type Page } from '@playwright/test';
import postgres from 'postgres';

test.use({ viewport: { width: 360, height: 740 } });
const sql = postgres(process.env.DATABASE_URL!, { max: 2, onnotice: () => {} });
const DISCLAIMER = 'Not investment advice. Past performance does not guarantee future results.';
const NOTES = "Other subscribers' private notes about you are deleted and you are removed from their saved views.";
const tag = `c5u${Date.now().toString(36).slice(-6)}`;
let seq = 0;
const created: string[] = [];

async function signIn(page: Page, existing?: string) {
  const h = existing ?? `${tag}_${++seq}`;
  if (!existing) created.push(h);
  await page.goto('/login/dev');
  await page.getByLabel('Handle').fill(h);
  await page.getByLabel('I am 18 or older').check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(new RegExp(`/u/${h}$`));
  return h;
}

// Link and button names as the accessibility tree computes them (Playwright's aria snapshot: aria-hidden is left out).
async function arrowNames(page: Page): Promise<string[]> {
  const snap = await page.locator('body').ariaSnapshot();
  return snap.split('\n').map((l) => /^\s*- (link|button)\s+("(?:[^"\\]|\\.)*"|\/.*\/)/.exec(l)).filter((m): m is RegExpExecArray => !!m)
    .map((m) => `${m[1]} ${m[2]}`).filter((n) => /[←→]/.test(n));
}

test.afterAll(async () => {
  if (created.length) await sql`delete from users where handle = any(${created})`;
  await sql.end({ timeout: 1 });
});

test('C5-39: no link or button name on the main pages carries a "←" or "→" glyph; the drawn text keeps its arrows', async ({ page }) => {
  const [d] = await sql`select id from users where handle = 'momentum_maya'`;
  const [t] = await sql`select sell_id, symbol, to_char(closed_at at time zone 'UTC', 'YYYY-MM') ym from closed_trades where user_id = ${d.id} order by closed_at desc limit 1`;
  const signedOut = ['/', '/u/momentum_maya', `/u/momentum_maya/trade/${encodeURIComponent(t.sell_id)}`, `/u/momentum_maya/month/${t.ym}`,
    `/t/${encodeURIComponent(t.symbol)}`, '/t', '/how', '/tools'];
  const seen: Record<string, string[]> = {};
  for (const url of signedOut) {
    await page.goto(url);
    seen[url] = await arrowNames(page);
  }
  await signIn(page);
  for (const url of ['/settings', '/account', '/me/following', '/me/hidden', '/me/likes', '/me/personalize', '/me/record']) {
    await page.goto(url);
    seen[url] = await arrowNames(page);
  }
  expect(Object.entries(seen).filter(([, n]) => n.length)).toEqual([]);
  // The arrows are still drawn: visible text unchanged, the name is the words alone.
  await page.goto('/u/momentum_maya');
  const back = page.getByRole('link', { name: 'Feed', exact: true }).last();
  await expect(back).toHaveText('← Feed');
  await expect(back).toHaveAccessibleName('Feed');
  await page.goto('/t');
  await expect(page.getByRole('link', { name: 'Feed', exact: true })).toHaveText('← Feed');
});

test('C5-38: with forced colours emulated, the pressed range tab has a 2 px border the others lack, and keeps its size', async ({ page }) => {
  await page.emulateMedia({ forcedColors: 'active' });
  await page.goto('/u/momentum_maya');
  const tabs = page.locator('.tabs button');
  await expect(tabs.first()).toBeVisible();
  const read = () => tabs.evaluateAll((els) => els.map((b) => {
    const s = getComputedStyle(b), r = b.getBoundingClientRect();
    return { pressed: b.getAttribute('aria-pressed'), width: s.borderTopWidth, style: s.borderTopStyle, h: Math.round(r.height), pad: s.paddingTop };
  }));
  const forced = await read();
  const on = forced.filter((b) => b.pressed === 'true'), off = forced.filter((b) => b.pressed !== 'true');
  expect(on).toHaveLength(1);
  expect(off.length).toBeGreaterThan(0);
  expect(on[0]).toMatchObject({ width: '2px', style: 'solid', pad: '4px' });
  for (const b of off) expect(b.width === '0px' || b.style === 'none').toBe(true);
  for (const b of off) expect(b.h).toBe(on[0].h);
  // Another range pressed moves the border with it.
  const i = await tabs.evaluateAll((els) => els.findIndex((b) => b.getAttribute('aria-pressed') !== 'true' && !(b as HTMLButtonElement).disabled));
  if (i >= 0) {
    const other = tabs.nth(i);
    await other.click();
    await expect(other).toHaveAttribute('aria-pressed', 'true');
    expect(await other.evaluate((b) => getComputedStyle(b).borderTopWidth)).toBe('2px');
  }
  // Without forced colours the tab is as before: the solid fill, no border.
  await page.emulateMedia({ forcedColors: 'none' });
  expect(await page.locator('.tabs button[aria-pressed="true"]').evaluate((b) => getComputedStyle(b).borderTopWidth)).toBe('0px');
});

test('C5-36 (narrowed): Settings says "Record tools" once, as its link', async ({ page }) => {
  await signIn(page);
  await page.goto('/settings');
  await expect(page.locator('main').getByText('Record tools', { exact: true })).toHaveCount(1);
  await expect(page.getByRole('heading', { name: 'Record tools' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Record tools', exact: true })).toHaveAttribute('href', '/tools');
  await expect(page.getByRole('link', { name: 'Account', exact: true }).first()).toBeVisible();
});

test('C5-36 (narrowed): the delete screen\'s notes line reads without "if you publish" where it applies', async ({ page }) => {
  await signIn(page, 'momentum_maya'); // the seeded demo trader has a public record, so the line applies
  await page.goto('/settings');
  await expect(page.getByText(NOTES, { exact: true })).toBeVisible();
  await expect(page.locator('main')).not.toContainText(/if you publish/i);
});

test('C5-37 (narrowed): /account and /tools carry one "Legal" landmark (the footer\'s); /account keeps the sentence and links, muted', async ({ page }) => {
  await page.goto('/tools');
  await expect(page.getByRole('navigation', { name: 'Legal' })).toHaveCount(1);
  await expect(page.locator('main .rt-disclaimer').first()).toContainText(DISCLAIMER);
  await signIn(page);
  await page.goto('/account');
  await expect(page.getByRole('navigation', { name: 'Legal' })).toHaveCount(1);
  await expect(page.locator('footer.site').getByRole('navigation', { name: 'Legal' })).toHaveCount(1);
  const d = page.locator('main .rt-disclaimer');
  await expect(d).toHaveCount(1);
  await expect(d).toContainText(DISCLAIMER);
  await expect(d).toHaveAttribute('data-variant', 'muted');
  await expect(d.locator('b')).toHaveCount(0);
  for (const name of ['Terms', 'Privacy', 'How records are calculated']) await expect(d.getByRole('link', { name })).toBeVisible();
  const [text, muted] = await d.evaluate((el) => {
    const probe = document.body.appendChild(document.createElement('p'));
    probe.className = 'muted';
    const c = getComputedStyle(probe).color;
    probe.remove();
    return [getComputedStyle(el).color, c];
  });
  expect(text).toBe(muted);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
});
