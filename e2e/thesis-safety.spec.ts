// fix-user-text B (F-9): the thesis note and its Report control against the real app. A trader with one published note
// (made here, tagged, removed at the end); a reader signs in with the dev form. The note shows its attribution and its
// written date; signed out there is no Report control; signed in a Tab walk reaches "Report this note", Enter reports,
// and a polite live region confirms; the page has no horizontal scroll at 360 px and 320 px; the review queue is a 404.
import { expect, test, type Page } from '@playwright/test';

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
  // Its own pool: a worker runs several spec files, and another may already have ended the shared one (lib/db.ts).
  const sql = (await import('postgres')).default(process.env.DATABASE_URL!, { onnotice: () => {} });
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

// Fix round 2 (B): only the author sees a held note's line, which names the reason in plain words (muted, never the loss
// colour); a reader-report hold says readers reported it, with no count. Signed out and as a reader neither line shows.
test('fix round 2: the author sees why a note is held; a reported note names no count; nobody else sees either', async ({ page }) => {
  test.setTimeout(90_000);
  // Its own pool (see the first test).
  const sql = (await import('postgres')).default(process.env.DATABASE_URL!, { onnotice: () => {} });
  const tag = rand();
  const trader = `f9h${tag}`;
  const [u] = await sql`with a as (insert into signup_attempts (method, adult_attested_at) values ('dev', now()) returning id)
    insert into users (handle, display_name, adult_attested_at, signup_attempt_id) select ${trader}, ${trader}, now(), a.id from a returning id`;
  try {
    const [byRule] = await sql`insert into closed_trades (user_id, sell_id, account_id, symbol, opened_at, closed_at, return_pct, holding_days, verified, thesis, thesis_status, thesis_hold_rule)
      values (${u.id}, ${`f9h-a-${tag}`}, 'a', 'HELDA', now() - interval '3 days', now() - interval '1 day', 0.02, 2, true, ${`see example.com ${tag}`}, 'held', 'link') returning id`;
    const [byReports] = await sql`insert into closed_trades (user_id, sell_id, account_id, symbol, opened_at, closed_at, return_pct, holding_days, verified, thesis, thesis_status, thesis_hold_rule)
      values (${u.id}, ${`f9h-b-${tag}`}, 'a', 'HELDB', now() - interval '4 days', now() - interval '2 days', -0.03, 2, true, ${`reported note ${tag}`}, 'held', 'reports') returning id`;
    await page.goto(`/u/${trader}`);
    await expect(page.locator('p.thesis-held')).toHaveCount(0);
    await expect(page.getByText(`see example.com ${tag}`)).toHaveCount(0);

    await signIn(page, trader);
    const a = page.locator(`#trade-${byRule.id} p.thesis-held`);
    await expect(a).toHaveText('Thesis held for review. Only you can see it. Held because it has a link or web address. Edit it to publish, or it stays held until reviewed.');
    const b = page.locator(`#trade-${byReports.id} p.thesis-held`);
    await expect(b).toHaveText('Thesis held for review. Only you can see it. Readers reported it; it stays held until reviewed.');
    for (const l of [a, b]) {
      await expect(l).toHaveClass(/\bmuted\b/);
      await expect(l).not.toHaveClass(/\bdown\b/);
    }
    // Muted, never the loss colour: the line's colour is the muted token, not the loss figure's.
    const colours = await page.evaluate((ids) => {
      const line = document.querySelector(`#trade-${ids[0]} p.thesis-held`)!;
      const loss = document.querySelector(`#trade-${ids[1]} b.down`)!;
      return [getComputedStyle(line).color, getComputedStyle(loss).color];
    }, [byRule.id, byReports.id]);
    expect(colours[0]).not.toBe(colours[1]);
  } finally {
    await sql`delete from users where handle = ${trader}`;
    await sql.end({ timeout: 1 });
  }
});

// Fix round 4 (F-10 AC8 with a note): a feed card with a published note, its date line and (for a reader) the Report
// control keeps F-10's card disclaimer inside the card's row (the row hides what overflows it) at 780×360 and 360×640,
// signed out and signed in as a reader who is not the author. On a short screen the note is one compact line with Report
// beside it (app/globals.css, the UserNote block). The trader is this test's own (verified closes, no demo data, large
// moves so it reaches the feed's first page); it is feed-eligible, so the shared feed lock is held while it exists.
test('fix round 4: a feed card with a note, its date and Report keeps the disclaimer inside its row at 780×360 and 360×640', async ({ page }) => {
  test.setTimeout(120_000);
  const sql = (await import('postgres')).default(process.env.DATABASE_URL!, { max: 2, onnotice: () => {} });
  const { feedLock } = await import('./feed-lock.ts');
  const release = await feedLock('shared');
  const tag = rand();
  const trader = `f9c${tag}`, reader = `f9d${tag}`;
  // About 120 characters, written today, so the caption carries a date line.
  const note = `Bought the retest of the prior base after earnings ${tag}; sold into the gap when volume dried up near the old high.`;
  const [u] = await sql`with a as (insert into signup_attempts (method, adult_attested_at) values ('dev', now()) returning id)
    insert into users (handle, display_name, adult_attested_at, signup_attempt_id) select ${trader}, ${trader}, now(), a.id from a returning id, signup_attempt_id`;
  try {
    const closes = [0.92, -0.88, 0.9, -0.86, 0.94, 0.89];
    await sql`insert into closed_trades ${sql(closes.map((r, i) => ({
      user_id: u.id, sell_id: `f9c-${tag}-${i}`, account_id: 'a', symbol: `NC${i}`,
      opened_at: new Date(Date.now() - (i + 3) * 3_600_000 - 2 * 86_400_000), closed_at: new Date(Date.now() - (i + 1) * 3_600_000),
      return_pct: r, holding_days: 2, verified: true, thesis: note, thesis_status: 'published', thesis_written_at: new Date(),
    })))}`;
    await sql`insert into connections (attempt_id, user_id, state, consent_at, importing_at, last_progress_at, connected_at)
      values (${u.signup_attempt_id}, ${u.id}, 'connected', now(), now(), now(), now() - interval '3 days')`;

    const check = async (who: 'signed out' | 'reader') => {
      for (const [w, h] of [[780, 360], [360, 640]] as const) {
        const at = `${who} ${w}x${h}`;
        await page.setViewportSize({ width: w, height: h });
        await page.goto('/');
        const row = page.locator(`.row[data-handle="${trader}"]`).first();
        await expect(row, at).toHaveCount(1);
        await row.scrollIntoViewIfNeeded();
        const card = row.locator('.card').first();
        await expect(card.locator('figure.user-note bdi'), at).toBeVisible();
        const r = (await row.boundingBox())!;
        const disc = card.locator('[data-disclaimer]');
        await expect(disc, at).toBeVisible();
        const d = (await disc.boundingBox())!;
        // Fully inside the row's box (the row's overflow is hidden, so anything past its bottom is clipped).
        expect(d.y, `${at} disclaimer top`).toBeGreaterThanOrEqual(r.y);
        expect(d.y + d.height, `${at} disclaimer bottom`).toBeLessThanOrEqual(r.y + r.height - 1);
        test.info().annotations.push({ type: 'headroom', description: `${at}: ${Math.round(r.y + r.height - (d.y + d.height))} px below the disclaimer` });
        const report = card.getByRole('button', { name: /^Report this note/ });
        if (who === 'signed out') {
          await expect(report, at).toHaveCount(0);
          continue;
        }
        await expect(report, at).toBeVisible();
        const b = (await report.boundingBox())!;
        // 44 px where it fits (360×640); never under WCAG 2.5.8's 24 px on a short screen.
        expect(b.height, `${at} Report height`).toBeGreaterThanOrEqual(h > 480 ? 44 : 24);
        expect(b.width, `${at} Report width`).toBeGreaterThanOrEqual(24);
        expect(b.y + b.height, `${at} Report inside the row`).toBeLessThanOrEqual(r.y + r.height - 1);
        // Not clipped by the note's own box either: the whole target is on screen and hit-testable at its centre.
        const hit = await report.evaluate((el) => {
          const box = el.getBoundingClientRect();
          return document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2) === el;
        });
        expect(hit, `${at} Report hit-testable`).toBe(true);
      }
    };
    await check('signed out');
    await signIn(page, reader);
    await check('reader');
  } finally {
    await sql`delete from users where handle in (${trader}, ${reader})`;
    await sql.end({ timeout: 1 });
    await release();
  }
});
