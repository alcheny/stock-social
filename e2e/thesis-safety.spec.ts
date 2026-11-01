// fix-user-text B (F-9): the thesis note and its Report control against the real app. A trader with one published note
// (made here, tagged, removed at the end); a reader signs in with the dev form. The note shows its attribution and its
// written date; signed out there is no Report control; signed in a Tab walk reaches "Report this note", Enter reports,
// and a polite live region confirms; the page has no horizontal scroll at 360 px and 320 px; the review queue is a 404.
import { expect, test, type Page } from '@playwright/test';

const db = async () => (await import('../lib/db.ts')).sql;
const rand = () => Math.random().toString(36).slice(2, 8);
async function signIn(page: Page, handle: string) {
  await page.goto('/login/dev');
  await page.getByLabel('Handle').fill(handle);
  await page.getByLabel('I am 18 or older').check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(new RegExp(`/u/${handle}$`));
}
const noSideScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
async function tabTo(page: Page, name: RegExp, max = 80): Promise<boolean> {
  for (let i = 0; i < max; i++) {
    await page.keyboard.press('Tab');
    const label = await page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? '');
    if (name.test(label)) return true;
  }
  return false;
}

test('F-9: a published note shows its author and date; Report is keyboard reachable, confirms politely, and is absent signed out; 360/320 px reflow; review queue 404', async ({ page, request }) => {
  test.setTimeout(120_000);
  const sql = await db();
  const tag = rand();
  const trader = `f9t${tag}`, reader = `f9r${tag}`;
  const sell = `f9-sell-${tag}`;
  const note = `Bought the retest of the base ${tag}, stop under the low.`;
  const [u] = await sql`with a as (insert into signup_attempts (method, adult_attested_at) values ('dev', now()) returning id)
    insert into users (handle, display_name, adult_attested_at, signup_attempt_id) select ${trader}, ${trader}, now(), a.id from a returning id`;
  try {
    const [t] = await sql`insert into closed_trades (user_id, sell_id, account_id, symbol, opened_at, closed_at, return_pct, holding_days, verified, thesis, thesis_status, thesis_written_at)
      values (${u.id}, ${sell}, 'a', 'NOTE', now() - interval '3 days', now() - interval '1 day', 0.042, 2, true, ${note}, 'published', now()) returning id`;

    // Signed out: the note with attribution and date, no Report control.
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto(`/u/${trader}`);
    const fig = page.locator(`#trade-${t.id} figure.user-note`);
    await expect(fig.locator('bdi')).toHaveText(note);
    await expect(fig.locator('figcaption')).toContainText(`Note by @${trader} · Written`);
    await expect(fig.locator('figcaption')).toContainText('after the trade closed');
    await expect(page.getByRole('button', { name: /Report this note/ })).toHaveCount(0);
    expect(await noSideScroll(page)).toBe(true);
    await page.goto(`/u/${trader}/trade/${sell}`);
    await expect(page.locator('figure.user-note bdi')).toHaveText(note);
    await expect(page.getByRole('button', { name: /Report this note/ })).toHaveCount(0);

    // Signed in as another reader: a Tab walk reaches Report, Enter reports, the polite live region confirms.
    await signIn(page, reader);
    await page.goto(`/u/${trader}`);
    const report = page.locator(`#trade-${t.id}`).getByRole('button', { name: 'Report this note on NOTE' });
    await expect(report).toBeVisible();
    expect((await report.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    const live = page.locator(`#trade-${t.id} .report-note [aria-live="polite"]`);
    await expect(live).toHaveCount(1); // in the tree before it speaks
    await expect(live).toHaveText('');
    await page.locator('body').click({ position: { x: 1, y: 1 } });
    expect(await tabTo(page, /^Report this note/)).toBe(true);
    await page.keyboard.press('Enter');
    await expect(live).toHaveText('Reported. Thank you.');
    await expect(report).toBeFocused(); // focus stays on the control
    await expect.poll(async () => (await sql`select count(*)::int as n from thesis_reports where trader_id = ${u.id} and sell_id = ${sell}`)[0].n).toBe(1);
    // One report changes nothing: the note is still public.
    await page.reload();
    await expect(page.locator(`#trade-${t.id} figure.user-note bdi`)).toHaveText(note);
    // A second report of the same note is refused: one per reader per note.
    await page.locator(`#trade-${t.id}`).getByRole('button', { name: 'Report this note on NOTE' }).press('Enter');
    await expect(page.locator(`#trade-${t.id} .report-note [aria-live="polite"]`)).toHaveText('You already reported this note.');
    expect(await noSideScroll(page)).toBe(true);
    await page.setViewportSize({ width: 320, height: 800 });
    expect(await noSideScroll(page)).toBe(true);

    // The trade page carries the same control; the author never sees it on their own note.
    await page.goto(`/u/${trader}/trade/${sell}`);
    await expect(page.getByRole('button', { name: 'Report this note on NOTE' })).toBeVisible();
    expect(await noSideScroll(page)).toBe(true);

    // The review queue is off by default.
    expect((await request.get('/review/theses')).status()).toBe(404);
  } finally {
    await sql`delete from users where handle in (${trader}, ${reader})`;
    await sql.end({ timeout: 1 });
  }
});
