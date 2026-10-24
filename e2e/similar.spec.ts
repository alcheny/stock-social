// F-2 PR-3b: "Similar trades" on a profile (owner decision O2), against the real app. Below the trader's own trades; 3
// rows of other traders' trades, no performance number on a row; a tap opens that trader's pane as a sheet; without
// JavaScript a row links to that trade's page; signed in, "…" → "Not interested" hides the row. Screenshots in
// docs/features/logs/F-2/screenshots/pr3b/.
import { expect, test, type Page } from '@playwright/test';
import postgres from 'postgres';

const SHOTS = 'docs/features/logs/F-2/screenshots/pr3b';
const DAY = 86_400_000;
const sql = postgres(process.env.DATABASE_URL!, { max: 2, onnotice: () => {} });
test.afterAll(async () => { await sql.end({ timeout: 1 }); });

test.setTimeout(120_000);
const shoot = async (page: Page, name: string) => {
  for (const colorScheme of ['light', 'dark'] as const) { await page.emulateMedia({ colorScheme }); await page.screenshot({ path: `${SHOTS}/${name}-${colorScheme}.png` }); }
  await page.emulateMedia({ colorScheme: 'light' });
};
// 12 traders × 6 closes held 3 days (a mix of gains and losses), dated two days ago (before the pool's hour).
async function fixture() {
  const tag = `r3${Math.random().toString(36).slice(2, 6)}`;
  const ids: number[] = [];
  const at = Date.now() - 2 * DAY;
  for (let t = 0; t < 12; t++) {
    const [u] = await sql`with a as (insert into signup_attempts (method, adult_attested_at) values ('dev', now()) returning id)
      insert into users (handle, display_name, adult_attested_at, signup_attempt_id, created_at) select ${`${tag}_${t}`}, ${`Similar Trader ${t}`}, now(), a.id, now() - interval '60 days' from a returning id`;
    ids.push(u.id as number);
    await sql`insert into closed_trades ${sql(Array.from({ length: 6 }, (_, i) => ({
      user_id: u.id, sell_id: `${tag}-${t}-${i}`, account_id: 'a', symbol: `Q${String.fromCharCode(65 + t)}${i}`,
      opened_at: new Date(at - (t * 6 + i) * 60_000 - 3 * DAY), closed_at: new Date(at - (t * 6 + i) * 60_000),
      return_pct: (i + t) % 3 ? 0.04 + i / 100 : -0.05 - t / 100, holding_days: 3, verified: true,
    })))}`;
  }
  return { tag, ids, remove: () => sql`delete from users where id = any(${ids})` };
}
// The pool is rebuilt in the background (lib/similar.ts#SIMILAR_REFRESH_MS): reload until the fixture's traders are in it.
async function openProfile(page: Page, handle: string, tag: string) {
  await expect(async () => {
    await page.goto(`/u/${handle}`);
    await expect(page.locator('.similar > .suggest-in > ul > li')).toHaveCount(3, { timeout: 500 });
    for (const h of await page.locator('.similar > .suggest-in > ul > li').evaluateAll((ls) => ls.map((l) => l.getAttribute('data-handle')))) expect(h).toContain(tag);
  }).toPass({ timeout: 40_000, intervals: [500, 2_000, 5_000] });
}
async function signIn(page: Page, handle: string) {
  await page.goto('/login/dev');
  await page.getByLabel('Handle').fill(handle);
  await page.getByLabel('I am 18 or older').check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(new RegExp(`/u/${handle}$`));
}

test('signed out: after the trader\'s own trades, 3 other traders\' trades, no performance number; tap opens the sheet; the same for two visitors', async ({ page, browser }) => {
  const f = await fixture();
  try {
    for (const width of [375, 1280]) {
      await page.setViewportSize({ width, height: width === 375 ? 667 : 800 });
      await openProfile(page, `${f.tag}_0`, f.tag);
      const s = page.locator('.similar');
      await expect(s.getByRole('heading', { name: 'Similar trades' })).toBeVisible();
      // After the trader's own trades.
      expect(await page.evaluate(() => !!(document.querySelector('ul.closes')!.compareDocumentPosition(document.querySelector('.similar')!) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
      const rows = s.locator(':scope > .suggest-in > ul > li');
      for (const t of await rows.allInnerTexts()) { expect(t).not.toMatch(/%|[+−-]\d|\$/); expect(t).not.toContain(`${f.tag}_0`); }
      expect(await rows.locator('.sreason').allInnerTexts()).toEqual(['Held 1 to 7 days', 'Held 1 to 7 days', 'Held 1 to 7 days']);
      await expect(s.locator('.more-menu')).toHaveCount(0);
      await s.evaluate((e) => e.scrollIntoView({ block: 'center' }));
      await shoot(page, `signed-out-${width}`);
    }
    await page.setViewportSize({ width: 375, height: 667 });
    const posts: string[] = [];
    page.on('request', (r) => { if (r.method() !== 'GET') posts.push(r.url()); });
    const first = page.locator('.similar .sopen').first();
    await first.click();
    const sheet = page.locator('dialog.pane-sheet[open]');
    await expect(sheet).toBeVisible();
    await expect(sheet.getByText('Not investment advice. Past performance does not guarantee future results.')).toBeAttached();
    await expect(sheet.getByRole('link', { name: 'See full profile →' })).toBeAttached();
    await page.screenshot({ path: `${SHOTS}/sheet-375-light.png` });
    await page.emulateMedia({ colorScheme: 'dark' }); await page.screenshot({ path: `${SHOTS}/sheet-375-dark.png` }); await page.emulateMedia({ colorScheme: 'light' });
    await page.keyboard.press('Escape');
    await expect(sheet).toHaveCount(0);
    await expect(first).toBeFocused();
    expect(posts).toEqual([]);
    // Another visitor gets the same rows.
    const other = await browser.newPage();
    await other.goto(`/u/${f.tag}_0`);
    expect(await other.locator('.similar > .suggest-in > ul > li').evaluateAll((ls) => ls.map((l) => l.getAttribute('data-handle'))))
      .toEqual(await page.locator('.similar > .suggest-in > ul > li').evaluateAll((ls) => ls.map((l) => l.getAttribute('data-handle'))));
    await other.close();
  } finally {
    await f.remove();
  }
});

test('without JavaScript a row links to that trade\'s page', async ({ browser }) => {
  const f = await fixture();
  const ctx = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 375, height: 667 } });
  const page = await ctx.newPage();
  try {
    await openProfile(page, `${f.tag}_0`, f.tag);
    const href = await page.locator('.similar .sopen').first().getAttribute('href');
    expect(href).toMatch(new RegExp(`^/u/${f.tag}_\\d+/trade/${f.tag}-\\d+-\\d+$`));
    await page.locator('.similar').evaluate((e) => e.scrollIntoView({ block: 'center' }));
    await shoot(page, 'no-js-375');
    await page.locator('.similar .sopen').first().click();
    await expect(page).toHaveURL(new RegExp(href!.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&') + '$'));
  } finally {
    await ctx.close();
    await f.remove();
  }
});

test('signed in: "…" → "Not interested" hides the row with Undo; the viewer\'s own record is never a row', async ({ page }) => {
  const f = await fixture();
  try {
    await page.setViewportSize({ width: 375, height: 667 });
    await signIn(page, `${f.tag}_11`);
    await openProfile(page, `${f.tag}_0`, f.tag);
    const rows = page.locator('.similar > .suggest-in > ul > li');
    expect(await rows.evaluateAll((ls) => ls.map((l) => l.getAttribute('data-handle')))).not.toContain(`${f.tag}_11`);
    await expect(page.locator('.similar .more-menu')).toHaveCount(3);
    await page.locator('.similar').evaluate((e) => e.scrollIntoView({ block: 'center' }));
    // Each row rests on itself (the reject tray is off screen until a swipe).
    await expect.poll(() => page.locator('.similar .srow').evaluateAll((es) => es.every((e) => Math.abs(e.scrollLeft - e.clientWidth) < 2))).toBe(true);
    await shoot(page, 'signed-in-375');
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.locator('.similar').evaluate((e) => e.scrollIntoView({ block: 'center' }));
    await shoot(page, 'signed-in-1280');
    await page.setViewportSize({ width: 375, height: 667 });
    const h = await rows.first().getAttribute('data-handle');
    await rows.first().locator('.more-menu summary').click();
    await rows.first().getByRole('button', { name: new RegExp(`Not interested`) }).click();
    await expect(page.getByText('Hidden for 90 days.')).toBeVisible();
    await expect(page.locator(`.similar > .suggest-in > ul > li[data-handle="${h}"]`)).toBeHidden();
    await expect.poll(async () => (await sql`select count(*)::int as n from viewer_exclusions v join users u on u.id = v.trader_id where u.handle = ${h!} and v.reason = 'not_interested'`)[0].n).toBe(1);
    await page.screenshot({ path: `${SHOTS}/signed-in-hidden-375-light.png` });
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(page.locator(`.similar > .suggest-in > ul > li[data-handle="${h}"]`)).toBeVisible();
  } finally {
    await f.remove();
  }
});

// Fix round 1 (D1, owner decision O2): with JavaScript a row opens its own trade (its symbol and close date first, focused,
// with a link to the trade page the no-JS row goes to), the trader's pane below it, loaded on first open (D2), and the
// profile one step further. The profile page itself carries no row trader's pane.
test('fix round 1: a tap opens the row\'s trade, then its trader\'s pane; the profile HTML carries no pane', async ({ page }) => {
  const f = await fixture();
  try {
    await page.setViewportSize({ width: 375, height: 667 });
    await openProfile(page, `${f.tag}_0`, f.tag);
    const html = await (await page.request.get(`/u/${f.tag}_0`)).text();
    expect(html).not.toContain('See full profile →');
    const row = page.locator('.similar .sopen').first();
    const text = await row.locator('.strade').innerText(); // "SYMBOL · closed Mon D, YYYY"
    const href = await row.getAttribute('href');
    await row.click();
    const sheet = page.locator('dialog.pane-sheet[open]');
    await expect(sheet.locator('.sheet-trade h3')).toHaveText(text);
    await expect(sheet.locator('.sheet-trade h3')).toBeFocused();
    await expect(sheet.getByRole('link', { name: 'Trade page →' })).toHaveAttribute('href', href!);
    await expect(sheet.getByRole('link', { name: 'See full profile →' })).toBeAttached();
    const symbol = text.split(' · ')[0];
    await expect(sheet.locator('.pane .rows .line.hl')).toContainText(symbol);
    await page.screenshot({ path: `${SHOTS.replace('pr3b', 'pr3b-fix1')}/sheet-trade-375-light.png` });
    await page.keyboard.press('Escape');
    await expect(row).toBeFocused();
  } finally {
    await f.remove();
  }
});

// Fix round 1 (UX blocker): signed in, hiding all three rows hides the whole section and focus goes to "← Feed".
test('fix round 1: hiding every row hides the section and moves focus to "← Feed"', async ({ page }) => {
  const f = await fixture();
  try {
    await page.setViewportSize({ width: 375, height: 667 });
    await signIn(page, `${f.tag}_11`);
    await openProfile(page, `${f.tag}_0`, f.tag);
    for (let k = 0; k < 3; k++) {
      const row = page.locator('.similar > .suggest-in > ul > li:visible').first();
      await row.locator('.more-menu summary').click();
      await row.getByRole('button', { name: /Not interested/ }).click();
      await expect(page.getByRole('button', { name: 'Undo' }), `hide ${k + 1}`).toBeFocused();
      if (k < 2) await page.keyboard.press('Escape');
    }
    await expect(page.locator('.similar')).toBeHidden();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('link', { name: '← Feed' })).toBeFocused();
    await page.screenshot({ path: `${SHOTS.replace('pr3b', 'pr3b-fix1')}/all-hidden-375-light.png` });
  } finally {
    await f.remove();
  }
});
