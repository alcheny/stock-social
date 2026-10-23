// F-2 PR-3: the suggestions section in the feed, against the real app (needs `npm run db:seed`). The same rows for every
// viewer; no performance number on a row; a row opens the trader's pane as a sheet; signed in, Follow and "…" → "Not
// interested" on rows, and the reject swipe on rows only (feed cards keep SW-1). Screenshots in
// docs/features/logs/F-2/screenshots/pr3/.
import { expect, test, type Browser, type Page } from '@playwright/test';
import postgres from 'postgres';
import { feedLock } from './feed-lock.ts';

const SHOTS = 'docs/features/logs/F-2/screenshots/pr3';
const DAY = 86_400_000;
const HOLDS = [0.5, 3, 14, 60, 300];
const sql = postgres(process.env.DATABASE_URL!, { max: 2, onnotice: () => {} });
test.afterAll(async () => { await sql.end({ timeout: 1 }); });

const shoot = async (page: Page, name: string) => {
  for (const colorScheme of ['light', 'dark'] as const) { await page.emulateMedia({ colorScheme }); await page.screenshot({ path: `${SHOTS}/${name}-${colorScheme}.png` }); }
  await page.emulateMedia({ colorScheme: 'light' });
};
// 40 traders × 5 fresh closes with varied holding periods, accounts 60 days old; one with a 36-character name and a
// 20-character handle (the pane header check).
async function fixture() {
  const tag = `s3${Math.random().toString(36).slice(2, 6)}`;
  const ids: number[] = [];
  const at = Date.now() - 600_000;
  for (let t = 0; t < 40; t++) {
    const handle = t === 0 ? `${tag}_long_handle_xx`.slice(0, 20) : `${tag}_${t}`;
    const name = t === 0 ? 'Section Trader With A Very Long Name' : `Section Trader ${t}`;
    const [u] = await sql`with a as (insert into signup_attempts (method, adult_attested_at) values ('dev', now()) returning id)
      insert into users (handle, display_name, adult_attested_at, signup_attempt_id, created_at) select ${handle}, ${name}, now(), a.id, now() - interval '60 days' from a returning id`;
    ids.push(u.id as number);
    await sql`insert into closed_trades ${sql(Array.from({ length: 5 }, (_, i) => ({
      user_id: u.id, sell_id: `${tag}-${t}-${i}`, account_id: 'a', symbol: `Z${String.fromCharCode(65 + (t % 26))}${String.fromCharCode(65 + ((t * 5 + i) % 26))}${i}`,
      opened_at: new Date(at - (t * 5 + i) * 20_000 - HOLDS[t % 5] * DAY), closed_at: new Date(at - (t * 5 + i) * 20_000),
      return_pct: (i + t) % 3 ? 0.2 + ((t * 7 + i) % 10) / 40 : -0.2 - ((t + i) % 5) / 40, holding_days: HOLDS[t % 5], verified: true,
    })))}`;
  }
  return { tag, ids, remove: () => sql`delete from users where id = any(${ids})` };
}
async function signIn(page: Page, handle: string) {
  await page.goto('/login/dev');
  await page.getByLabel('Handle').fill(handle);
  await page.getByLabel('I am 18 or older').check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(new RegExp(`/u/${handle}$`));
}
const section = (page: Page) => page.locator('.feed > .suggest').first();
const rowsBefore = (page: Page) => page.locator('main.feed').evaluate((feed) => { const kids = [...feed.children]; const i = kids.findIndex((k) => k.matches('.suggest')); return kids.slice(0, i).filter((k) => k.matches('.row')).length; });
// A touch swipe on the element: real touch events through the browser's input pipeline (native scrolling and snapping).
async function swipe(page: Page, el: ReturnType<Page['locator']>, dx: number) {
  const b = (await el.boundingBox())!;
  const y = Math.round(b.y + b.height / 2), x0 = Math.round(dx < 0 ? b.x + b.width - 10 : b.x + 10);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y }] });
  const steps = Math.max(2, Math.round(Math.abs(dx) / 10));
  for (let i = 1; i <= steps; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + (dx * i) / steps, y }] }); await page.waitForTimeout(16); }
  await page.waitForTimeout(120); // held still before lifting: no fling (a quick flick carries further, natively)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
}
const exclusions = async (handle: string) => (await sql`select count(*)::int as n from viewer_exclusions x join users u on u.id = x.viewer_id where u.handle = ${handle} and x.until > now()`)[0].n as number;
async function touchPage(browser: Browser) {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 800 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  return { ctx, page: await ctx.newPage() };
}

test('F-2 PR-3: the demo-only feed renders no section', async ({ page }) => {
  const release = await feedLock('exclusive');
  try {
    await page.goto('/');
    const handles = new Set(await page.locator('.feed > .row').evaluateAll((rs) => rs.map((r) => r.getAttribute('data-handle'))));
    expect([...handles].sort()).toEqual(['dividend_dan', 'momentum_maya', 'yolo_yuki']);
    await expect(page.locator('.feed .suggest')).toHaveCount(0);
  } finally {
    await release();
  }
});

test('F-2 PR-3: signed out, the section sits at position 6 with 3 rows, a true heading and no performance number; a row opens the pane as a sheet (Esc and Back close it, focus returns); the opening swipe opens it too; no write; no-JS rows are profile links', async ({ page, browser }) => {
  test.setTimeout(180_000);
  const release = await feedLock('exclusive');
  const fx = await fixture();
  try {
    await page.setViewportSize({ width: 375, height: 800 });
    const posts: string[] = [];
    page.on('request', (r) => { if (r.method() !== 'GET') posts.push(r.url()); });
    await page.goto('/');
    await expect(page.locator('.feed .pane .chart-hit').first()).toBeAttached(); // hydrated
    const s = section(page);
    await expect(s).toHaveCount(1);
    expect(await rowsBefore(page)).toBe(5);
    await expect(s.getByRole('heading', { level: 2 })).toHaveText('More records');
    const rows = s.locator('.suggest-in > ul > li');
    await expect(rows).toHaveCount(3);
    const text = await rows.allInnerTexts();
    for (const t of text) { expect(t).not.toMatch(/%|[+−-]\d|\$/); expect(t).toMatch(/Typical holding period: |Closed a trade this week|New here this month/); }
    await expect(s.locator('.follow, .more-menu')).toHaveCount(0); // nothing signed out
    await expect(page.locator('.feed .card .more-menu')).toHaveCount(0); // "…" never on a feed card
    // None of the section's traders has a card among the 10 around it.
    const near = await page.locator('.feed > .row').evaluateAll((rs) => rs.slice(0, 10).map((r) => r.getAttribute('data-handle')));
    for (const h of await rows.evaluateAll((ls) => ls.map((l) => l.getAttribute('data-handle')))) expect(near).not.toContain(h);
    await s.scrollIntoViewIfNeeded();
    await s.evaluate((el) => el.scrollIntoView());
    await shoot(page, 'section-signed-out-375');
    // A row tap opens the pane as a sheet: the record, the disclaimer line, "See full profile →".
    const first = rows.first();
    const handle = (await first.getAttribute('data-handle'))!;
    const link = first.locator('a.sopen');
    await expect(link).toHaveAttribute('href', `/u/${handle}`);
    await link.click();
    const sheet = first.locator('dialog.pane-sheet');
    await expect(sheet).toHaveAttribute('open', '');
    await expect(sheet.locator('.pane .stats')).toBeVisible();
    await expect(sheet.getByRole('link', { name: 'See full profile →' })).toHaveAttribute('href', `/u/${handle}`);
    await expect(sheet.locator('.pane-actions')).toHaveCount(0);
    await expect(sheet.getByText('Not investment advice. Past performance does not guarantee future results.')).toBeVisible(); // F3: the sheet covers the footer
    await shoot(page, 'sheet-from-row-375');
    await page.keyboard.press('Escape');
    await expect(sheet).not.toHaveAttribute('open', '');
    await expect(link).toBeFocused();
    await page.keyboard.press('Enter'); // keyboard opens it too
    await expect(sheet).toHaveAttribute('open', '');
    await sheet.getByRole('button', { name: '← Back' }).click();
    await expect(sheet).not.toHaveAttribute('open', '');
    expect(page.url()).toMatch(/\/$/);
    expect(posts).toEqual([]); // signed out: no write (and no page fetch yet)
    await page.setViewportSize({ width: 1280, height: 800 });
    await s.evaluate((el) => el.scrollIntoView());
    await shoot(page, 'section-signed-out-1280');
    await link.click();
    await shoot(page, 'sheet-from-row-1280');
    await page.keyboard.press('Escape');

    // Touch: the opening swipe on a row opens the sheet; no reject tray signed out.
    const t = await touchPage(browser);
    await t.page.goto('/');
    const ts = section(t.page);
    await ts.evaluate((el) => el.scrollIntoView());
    await expect(ts.locator('.ssentinel').first()).toBeAttached();
    await expect(ts.locator('.stray')).toHaveCount(0);
    await swipe(t.page, ts.locator('.srow').first(), -300);
    await expect(ts.locator('dialog.pane-sheet').first()).toHaveAttribute('open', '');
    await expect.poll(() => ts.locator('.srow').first().evaluate((el) => el.scrollLeft)).toBe(0); // back at rest underneath
    await t.ctx.close();

    // Without JavaScript: the same rows, each a link to the trader's profile.
    const ctx = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 375, height: 800 } });
    const nojs = await ctx.newPage();
    await nojs.goto('/');
    const ns = section(nojs);
    await expect(ns.locator('.suggest-in > ul > li')).toHaveCount(3);
    expect(await ns.locator('.suggest-in > ul > li').evaluateAll((ls) => ls.map((l) => l.getAttribute('data-handle')))).toEqual(await rows.evaluateAll((ls) => ls.map((l) => l.getAttribute('data-handle'))));
    await ns.evaluate((el) => el.scrollIntoView());
    await nojs.screenshot({ path: `${SHOTS}/nojs-section-375-light.png` });
    await ns.locator('a.sopen').first().click();
    await expect(nojs).toHaveURL(new RegExp(`/u/${handle}$`));
    await ctx.close();
  } finally {
    await fx.remove();
    await release();
  }
});

test('F-2 PR-3: signed in, rows carry Follow and "…"; "Not interested" on a row collapses it and the trader\'s cards, "Hidden for 90 days." with Undo; Undo restores; the hidden trader is left out of page 2; the pane header keeps a long handle whole', async ({ page }) => {
  test.setTimeout(180_000);
  const release = await feedLock('exclusive');
  const fx = await fixture();
  const me = `s3v${Math.random().toString(36).slice(2, 7)}`;
  try {
    await page.setViewportSize({ width: 375, height: 800 });
    await signIn(page, me);
    await page.goto('/');
    await expect(page.locator('.feed .pane .chart-hit').first()).toBeAttached();
    const s = section(page);
    const rows = s.locator('.suggest-in > ul > li');
    await expect(rows).toHaveCount(3);
    await expect(rows.locator('.sactions button.follow')).toHaveCount(3);
    await expect(rows.locator('.sactions .more-menu summary')).toHaveCount(3);
    for (const b of await rows.locator('.sactions button.follow, .sactions .more-menu summary, a.sopen').all()) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await s.evaluate((el) => el.scrollIntoView());
    await shoot(page, 'section-signed-in-375');
    const row = rows.nth(1);
    const x = (await row.getAttribute('data-handle'))!;
    await row.locator('.sactions .more-menu summary').click();
    const item = row.getByRole('button', { name: `Not interested in @${x}` });
    const box = (await item.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(375);
    await shoot(page, 'row-menu-375');
    const visibleCards = () => page.locator(`.feed > .row[data-handle="${x}"]`).evaluateAll((rs) => rs.filter((r) => (r as HTMLElement).offsetParent).length);
    await item.click();
    await expect(row).toBeHidden();
    expect(await visibleCards()).toBe(0);
    const bar = page.locator('.hide-bar');
    await expect(bar).toContainText('Hidden for 90 days.');
    await expect(bar.getByRole('button', { name: 'Undo' })).toBeFocused();
    await expect.poll(() => exclusions(me)).toBe(1);
    expect(await s.evaluate((el) => Math.round(el.getBoundingClientRect().top))).toBe(0); // the reader stays on the section
    await shoot(page, 'row-hidden-undo-375');
    await bar.getByRole('button', { name: 'Undo' }).click();
    await expect(row).toBeVisible();
    await expect.poll(() => exclusions(me)).toBe(0);
    await expect(row.locator('.sactions .more-menu summary')).toBeFocused();
    // Hide again and let it stand: page 2 leaves the trader out.
    await row.locator('.sactions .more-menu summary').click();
    await row.getByRole('button', { name: `Not interested in @${x}` }).click();
    await expect.poll(() => exclusions(me)).toBe(1);
    await page.locator('.feed > .row').nth(24).evaluate((el) => el.scrollIntoView());
    await expect.poll(() => page.locator('.feed > .row').count(), { timeout: 15_000 }).toBeGreaterThan(30);
    const all = await page.locator('.feed > .row').evaluateAll((rs) => rs.slice(30).map((r) => r.getAttribute('data-handle')));
    expect(all).not.toContain(x);
    await expect(page.locator('.feed > .suggest')).toHaveCount(2); // page 2's own section
    // The pane header at 320 and 375: a 36-character name gives way; the 20-character handle stays whole.
    const longHandle = (await sql`select handle from users where id = ${fx.ids[0]}`)[0].handle as string;
    await expect(page.locator(`.feed > .row[data-handle="${longHandle}"]`).first()).toBeAttached(); // its fresh closes rank on page 1
    for (const w of [375, 320]) {
      await page.setViewportSize({ width: w, height: 800 });
      const who = page.locator(`.feed > .row[data-handle="${longHandle}"] .pane header .who`).first();
      const [full, shown, right] = await who.locator('.muted').evaluate((el) => [el.scrollWidth, el.clientWidth, el.getBoundingClientRect().right - el.closest('.row')!.scrollLeft]);
      expect(shown).toBeGreaterThanOrEqual(full);
      expect(right).toBeLessThanOrEqual(2 * w); // inside the pane (the second half of the row)
      // Section rows fit the screen at this width.
      for (const r of await s.locator('.srow-wrap').evaluateAll((ws) => ws.map((x) => x.getBoundingClientRect().right))) expect(r).toBeLessThanOrEqual(w);
    }
  } finally {
    await sql`delete from users where handle = ${me}`;
    await fx.remove();
    await release();
  }
});

test('F-2 PR-3: the reject swipe on a section row writes exactly one exclusion, collapses the row and offers Undo; an opening swipe opens the sheet; right after a sheet closes the same swipe never rejects; a horizontal swipe on a feed card still opens its pane and writes nothing', async ({ browser }) => {
  test.setTimeout(180_000);
  const release = await feedLock('exclusive');
  const fx = await fixture();
  const me = `s3w${Math.random().toString(36).slice(2, 7)}`;
  const { ctx, page } = await touchPage(browser);
  try {
    await signIn(page, me);
    await page.goto('/');
    await expect(page.locator('.feed .pane .chart-hit').first()).toBeAttached();
    // A feed card: the horizontal swipe opens the pane (SW-1), never an exclusion.
    const card = page.locator('.feed > .row').first();
    await swipe(page, card.locator('.card'), -300);
    await expect.poll(() => card.evaluate((el) => el.scrollLeft)).toBeGreaterThan(300);
    expect(await exclusions(me)).toBe(0);
    await swipe(page, card.locator('.pane'), 300);
    await expect.poll(() => card.evaluate((el) => el.scrollLeft)).toBe(0);
    const s = section(page);
    await s.evaluate((el) => el.scrollIntoView());
    const row = s.locator('.suggest-in > ul > li').first();
    const srow = row.locator('.srow');
    await expect(row.locator('.stray')).toBeAttached();
    const rest = await srow.evaluate((el) => el.scrollLeft);
    expect(rest).toBeGreaterThan(100); // resting on the row, the tray off to the left
    // Right after the sheet closes, a reject swipe on the row beneath snaps back and writes nothing.
    await row.locator('a.sopen').tap();
    await expect(row.locator('dialog.pane-sheet')).toHaveAttribute('open', '');
    await page.keyboard.press('Escape');
    await swipe(page, srow, Math.round(rest * 0.9));
    await expect.poll(() => srow.evaluate((el) => el.scrollLeft)).toBe(rest);
    await page.waitForTimeout(300);
    expect(await exclusions(me)).toBe(0);
    await expect(row).toBeVisible();
    // At rest, later: the reject swipe commits.
    await page.waitForTimeout(500);
    await swipe(page, srow, Math.round(rest * 0.9));
    await expect(row).toBeHidden();
    await expect.poll(() => exclusions(me)).toBe(1);
    await expect(page.locator('.hide-bar')).toContainText('Hidden for 90 days.');
    await shoot(page, 'reject-swipe-undo-375');
    await page.locator('.hide-bar').getByRole('button', { name: 'Undo' }).tap();
    await expect(row).toBeVisible();
    await expect.poll(() => exclusions(me)).toBe(0);
    await expect.poll(() => srow.evaluate((el) => el.scrollLeft)).toBe(rest);
    // A short swipe (under half the row) snaps back.
    await swipe(page, srow, Math.round(rest * 0.3));
    await expect.poll(() => srow.evaluate((el) => el.scrollLeft)).toBe(rest);
    await page.waitForTimeout(300);
    expect(await exclusions(me)).toBe(0);
    // The opening swipe opens the sheet.
    await swipe(page, srow, -Math.round(rest * 0.9));
    await expect(row.locator('dialog.pane-sheet')).toHaveAttribute('open', '');
    await shoot(page, 'sheet-from-swipe-375');
  } finally {
    await ctx.close();
    await sql`delete from users where handle = ${me}`;
    await fx.remove();
    await release();
  }
});

test('F-2 PR-3: without JavaScript, "Not interested" on a row lands on the trader\'s profile with a line that links to the list where it can be undone', async ({ browser }) => {
  const release = await feedLock('exclusive');
  const fx = await fixture();
  const me = `s3n${Math.random().toString(36).slice(2, 7)}`;
  const ctx = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 375, height: 800 } });
  const page = await ctx.newPage();
  try {
    await signIn(page, me);
    await page.goto('/');
    const row = section(page).locator('.suggest-in > ul > li').first();
    const x = (await row.getAttribute('data-handle'))!;
    await row.locator('.sactions .more-menu summary').click();
    await row.getByRole('button', { name: `Not interested in @${x}` }).click();
    await expect(page).toHaveURL(new RegExp(`/u/${x}\\?done=hidden`));
    const line = page.locator('.profile-follow p[role="status"]');
    await expect(line).toContainText(`@${x} is hidden from your feed for 90 days.`);
    await expect(line.getByRole('link', { name: 'Following and hidden traders' })).toHaveAttribute('href', '/me/following');
    await page.screenshot({ path: `${SHOTS}/nojs-hidden-line-375-light.png` });
    expect(await exclusions(me)).toBe(1);
  } finally {
    await ctx.close();
    await sql`delete from users where handle = ${me}`;
    await fx.remove();
    await release();
  }
});

test('F-2 PR-3 heavy use: 30-card pages from 50 heavy traders (4,700 closes each), each with a section of heavy records, weigh under 500 KB raw', async ({ request }) => {
  test.setTimeout(300_000);
  const { gzipSync } = await import('node:zlib');
  const release = await feedLock('exclusive');
  const tag = `s3h${Math.random().toString(36).slice(2, 6)}`;
  const ids: number[] = [];
  try {
    for (let h = 0; h < 50; h++) {
      const [u] = await sql`with a as (insert into signup_attempts (method, adult_attested_at) values ('dev', now()) returning id)
        insert into users (handle, display_name, adult_attested_at, signup_attempt_id, created_at) select ${`${tag}_${h}`}, ${`Heavy Section Trader ${h}`}, now(), a.id, now() - interval '400 days' from a returning id`;
      ids.push(u.id as number);
      // 5 fresh closes, then 4,695 older ones over the past year; holding periods spread over the five buckets by trader.
      await sql`insert into closed_trades (user_id, sell_id, account_id, symbol, opened_at, closed_at, return_pct, holding_days, verified)
        select ${u.id}, ${`${tag}-${h}-`} || g, 'a', 'H' || chr(65 + ${h} % 26) || chr(65 + (g % 26)) || (g % 7),
          c - make_interval(secs => ${HOLDS[h % 5] * 86_400}), c, case when g % 3 = 0 then -0.2 - (g % 5) / 40.0 else 0.25 + (g % 10) / 40.0 end, ${HOLDS[h % 5]}, true
        from generate_series(0, 4699) g, lateral (select case when g < 5 then now() - make_interval(secs => 60 + g * 120 + ${h} * 7)
          else now() - make_interval(secs => 86400 * 3 + g * 6700) end as c) t`;
    }
    let url = '/';
    for (let p = 1; p <= 3; p++) {
      const res = await request.get(url);
      expect(res.status()).toBe(200);
      const html = await res.text();
      const bytes = Buffer.byteLength(html), zipped = gzipSync(html).length;
      const rows = [...html.matchAll(/<li data-handle="([a-z0-9_]+)"/g)].map((m) => m[1]);
      console.log(`# section page ${p}: ${(bytes / 1024).toFixed(0)} KB raw, ${(zipped / 1024).toFixed(0)} KB gzipped; section rows ${rows.join(', ')}`);
      expect(html).toContain('class="suggest"');
      expect(rows).toHaveLength(3);
      expect(rows.every((r) => r.startsWith(`${tag}_`))).toBe(true);
      expect(bytes).toBeLessThan(500_000);
      const next = html.match(/href="\/\?after=([A-Za-z0-9_-]+)"/);
      if (!next) break;
      url = `/?after=${next[1]}`;
    }
  } finally {
    await sql`delete from users where id = any(${ids})`;
    await release();
  }
});
