// F-11 / D-12 / fix #4 (docs/features/F-11-record-status-line.md; plan docs/features/logs/fixes-labels/plan.md §6 items
// 13 and 14): the record status line on the profile, the pane, the feed card, the trade and month pages, signed out.
// The fixtures are the rows a sync leaves behind (lib/sync.ts writes connections.disconnected_at when the vendor lists
// none of a connection's accounts, and broker_accounts.removed_at for an account no longer listed; both are covered
// against a vendor-shaped broker in lib/sync-removed.test.ts, and the vendor fake's POST /_remove in
// lib/vendor-fake-remove.test.ts). They are this file's own handles; nothing here counts rows it did not create.
import { test, expect, type Locator, type Page } from '@playwright/test';
import postgres from 'postgres';
import { feedLock } from './feed-lock.ts';
import { dateText } from '../lib/date-text.ts';

const DAY = 86_400_000;
const sql = postgres(process.env.DATABASE_URL!, { max: 2, onnotice: () => {} });
// Ten minutes ago: after the fixture's last close (a frozen record gains no closes), still feed-eligible.
const DISCONNECTED = new Date(Math.floor((Date.now() - 10 * 60_000) / 1000) * 1000);
const REMOVED = new Date('2026-10-28T15:00:00Z');
const DISCLAIMER = 'Not investment advice. Past performance does not guarantee future results.';

type Fx = { closes: { r: number; daysAgo: number }[]; accounts: string[]; disconnected?: Date; removed?: string; syncedAgoMs: number | null; consentDaysAgo: number };
// Feed-eligible closes (five or more, within the day, large moves) for the records whose cards are checked.
const recent = (rs: number[]) => rs.map((r, i) => ({ r, daysAgo: 0.02 + i * 0.01 }));
const FIXTURES: Record<string, Fx> = {
  // Every connection disconnected, and stale for 40 days: frozen wins over idle.
  fls_frozen: { closes: recent([0.45, -0.41, 0.38, -0.37, 0.36]), accounts: ['fls-f1'], disconnected: DISCONNECTED, syncedAgoMs: 40 * DAY, consentDaysAgo: 90 },
  // Two real accounts, the second removed at the broker; synced two hours ago.
  fls_two: { closes: recent([0.12, -0.08]).map((c) => ({ ...c, daysAgo: c.daysAgo + 3 })), accounts: ['fls-t1', 'fls-t2'], removed: 'fls-t2', syncedAgoMs: 2 * 3_600_000, consentDaysAgo: 60 },
  // Live and fresh: its feed card says nothing about status.
  fls_live: { closes: recent([0.44, -0.43, 0.42, -0.41, 0.4]), accounts: ['fls-l1'], syncedAgoMs: 3_600_000, consentDaysAgo: 30 },
  // Live, no successful sync for 35 days: the idle fact.
  fls_idle: { closes: recent([-0.46, 0.4, -0.39, 0.38, -0.37]), accounts: ['fls-i1'], syncedAgoMs: 35 * DAY, consentDaysAgo: 120 },
  // QA round 2 (N7): the only account removed, the connection still "connected" with no disconnected_at, synced three
  // hours ago (not feed-eligible). PR #85 review (B1): not frozen; the live line 2 with "updated".
  fls_gone: { closes: recent([0.07, -0.05]).map((c) => ({ ...c, daysAgo: c.daysAgo + 5 })), accounts: ['fls-g1'], removed: 'fls-g1', syncedAgoMs: 3 * 3_600_000, consentDaysAgo: 60 },
};
const HANDLES = Object.keys(FIXTURES);
const ACCOUNTS = Object.values(FIXTURES).flatMap((f) => f.accounts);

test.describe.configure({ mode: 'serial' });

let releaseFeed: (() => Promise<void>) | null = null;
test.beforeAll(async () => {
  releaseFeed = await feedLock('shared');
  await sql`delete from users where handle in ${sql(HANDLES)}`;
  await sql`delete from broker_accounts where account_id in ${sql(ACCOUNTS)}`;
  for (const [handle, f] of Object.entries(FIXTURES)) {
    const [u] = await sql`
      with a as (insert into signup_attempts (method, adult_attested_at) values ('dev', now()) returning id)
      insert into users (handle, display_name, adult_attested_at, signup_attempt_id, last_synced_at)
      select ${handle}, ${handle.replace('fls_', 'FLS ')}, now(), a.id, ${f.syncedAgoMs === null ? null : new Date(Date.now() - f.syncedAgoMs)} from a returning id, signup_attempt_id`;
    await sql`insert into closed_trades ${sql(f.closes.map((c, i) => ({
      user_id: u.id, sell_id: `${handle}-${i}`, account_id: f.accounts[i % f.accounts.length], symbol: `FLS${i}`, opened_at: new Date(Date.now() - (c.daysAgo + 2) * DAY),
      closed_at: new Date(Date.now() - c.daysAgo * DAY), return_pct: c.r, holding_days: 2, verified: true,
    })))}`;
    const accounts = f.accounts.map((id) => ({ id, authorizationId: `${handle}-auth`, institution: 'Fake Brokerage', isPaper: false, initialSyncCompleted: true }));
    await sql`insert into connections (attempt_id, user_id, vendor_authorization_id, institution, state, consent_at, importing_at, connected_at, last_progress_at, disconnected_at, accounts)
      values (${u.signup_attempt_id}, ${u.id}, ${`${handle}-auth`}, 'Fake Brokerage', 'connected', ${new Date(Date.now() - f.consentDaysAgo * DAY)}, now(), now(), now(), ${f.disconnected ?? null}, ${sql.json(accounts)})`;
    await sql`insert into broker_accounts ${sql(f.accounts.map((id) => ({ account_id: id, user_id: u.id, confirmed_at: new Date(), removed_at: id === f.removed ? REMOVED : null })))}`;
    await sql`insert into activities ${sql(f.accounts.map((id) => ({ user_id: u.id, source: 'snaptrade', external_id: `${id}-buy`, account_id: id, symbol: 'FLS0', side: 'BUY',
      units: 1, price: 1, fee: 0, executed_at: new Date(Date.now() - 100 * DAY), raw: sql.json({}) })))}`;
  }
});

test.afterAll(async () => {
  await sql`delete from users where handle in ${sql(HANDLES)}`;
  await sql`delete from broker_accounts where account_id in ${sql(ACCOUNTS)}`;
  await sql.end({ timeout: 1 });
  await releaseFeed?.();
});

test.use({ viewport: { width: 360, height: 740 } });

const now = () => new Date();
// Design system R3: the disconnect date is ‹Mon D, YYYY› on every surface.
const frozenLive = () => `Disconnected ${dateText(DISCONNECTED, now(), { year: 'always' })} · record frozen`;
const frozenStatic = frozenLive;
// Merge with main: dates never break inside and keep their word through a no-wrap .status-glue group (ordinary spaces).
const glue = async (l: Locator, text: string) => {
  const g = l.locator('.status-glue').filter({ hasText: text });
  await expect(g).toHaveCount(1);
  expect(await g.evaluate((el) => getComputedStyle(el).whiteSpace)).toBe('nowrap');
};
const said = async (l: Locator) => (await l.first().textContent())!.replace(/\u00a0/g, ' ').trim();
async function narrow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  await expect(page.locator('footer#site-footer')).toContainText(DISCLAIMER);
}

test('F-11 frozen record: the profile says "Disconnected (date) · record frozen" and never "Connected"; last close only; trades stay listed', async ({ page }) => {
  await page.goto('/u/fls_frozen');
  const block = page.locator('.record-status-block');
  const line1 = block.locator('[data-status="line1"]');
  expect(await said(line1)).toMatch(new RegExp(`^Record since .+ · ${frozenLive()}$`));
  // Words in <time datetime>: the disconnect date carries its UTC day (F-23: what the line prints, no finer).
  const disc = line1.locator(`time[datetime="${DISCONNECTED.toISOString().slice(0, 10)}"]`);
  expect(await disc.textContent()).toBe(dateText(DISCONNECTED, now(), { year: 'always' }));
  await glue(line1, `Disconnected ${dateText(DISCONNECTED, now(), { year: 'always' })}`);
  expect(await said(block.locator('[data-status="line2"]'))).toMatch(/^Last close [A-Z][a-z]{2} \d{1,2}(, \d{4})?$/); // frozen wins: no "updated", no idle
  await expect(page.locator('main')).not.toContainText('Connected:');
  await expect(page.locator('main')).not.toContainText('not updated since');
  await expect(page.locator('main')).not.toContainText(/updated (.* ago|just now)/);
  await expect(page.locator('ul.rows.closes li')).toHaveCount(5); // TR-1: every close stays listed
  await narrow(page);
});

test('F-11 frozen record: the pane (JSON and the feed\'s server-rendered pane) and the feed card carry the frozen line in absolute dates; a live, fresh card shows no status line; an idle card says "Not updated since (date)"', async ({ browser, request }) => {
  test.setTimeout(test.info().timeout + 60_000);
  const json = await (await request.get('/u/fls_frozen/pane?v=2')).json();
  const paneText = (json.status as { text: string }[]).map((s) => s.text).join('');
  expect(paneText).toMatch(new RegExp(`^${frozenStatic()} · Last close [A-Z][a-z]{2} \\d{1,2}, \\d{4}$`));
  expect(paneText).not.toMatch(/Connected:|ago|updated/);
  // Without JavaScript the cards and panes are server-rendered and the next page is a plain link (walked, at most 12).
  const release = await feedLock('shared');
  const ctx = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 360, height: 740 } });
  const page = await ctx.newPage();
  try {
    const seen = new Set<string>();
    let url: string | null = '/';
    for (let i = 0; i < 12 && url && seen.size < 3; i++) {
      await page.goto(url);
      for (const h of ['fls_frozen', 'fls_live', 'fls_idle']) {
        const row = page.locator(`.row[data-handle="${h}"]`).first();
        if (seen.has(h) || !(await row.count())) continue;
        seen.add(h);
        const card = row.locator('article.card');
        if (h === 'fls_frozen') {
          await expect(card.locator('.record-status[data-status="card"]')).toHaveText(frozenStatic());
          await expect(card.locator(`.record-status time[datetime="${DISCONNECTED.toISOString().slice(0, 10)}"]`) /* F-23: the UTC day */).toHaveCount(1);
          // Between the hero and the thesis. F-26: a card with no published note has no note element, so the line is followed
          // by the note slot when there is a note, else by what follows the slot (the open line or the footer).
          expect(await card.locator('.record-status').evaluate((el) => {
            const next = el.nextElementSibling;
            return !!el.previousElementSibling?.classList.contains('hero') && !!next
              && (next.matches('.thesis, figure.user-note, .thesis-held, .fv-slot') || next.matches('[data-open], footer'));
          })).toBe(true);
          // This fixture has no note: nothing stands in the slot.
          await expect(card.locator('.thesis, figure.user-note, .thesis-held')).toHaveCount(0);
          const pane = row.locator('section.pane [data-status="pane"]');
          expect(await said(pane)).toMatch(new RegExp(`^${frozenStatic()} · Last close `));
          await expect(row.locator('section.pane')).not.toContainText('Connected:');
        } else if (h === 'fls_live') {
          await expect(card.locator('.record-status')).toHaveCount(0);
          expect(await said(row.locator('section.pane [data-status="pane"]'))).toMatch(/^Connected: Fake Brokerage \(1 account\) · Last close .+ · updated .+, \d{4}$/);
        } else {
          expect(await said(card.locator('.record-status[data-status="card"]'))).toMatch(/^Not updated since [A-Z][a-z]{2} \d{1,2}, \d{4}$/);
          await expect(card).not.toContainText(/inactive|stale|abandoned/i);
        }
      }
      if (seen.size < 3) url = await page.locator('.feed-more a.button[href*="after="]').getAttribute('href').catch(() => null);
    }
    expect([...seen].sort(), 'fixture cards not in the feed list').toEqual(['fls_frozen', 'fls_idle', 'fls_live']);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  } finally {
    await ctx.close();
    await release();
  }
});

test('F-11 frozen record: the trade and month pages say so first in "Their whole record", never "Connected"; their images render', async ({ page, request }) => {
  const [t] = await sql`select sell_id, closed_at from closed_trades where sell_id = 'fls_frozen-0'`;
  const ym = (t.closed_at as Date).toISOString().slice(0, 7);
  for (const path of [`/u/fls_frozen/trade/${encodeURIComponent(t.sell_id)}`, `/u/fls_frozen/month/${ym}`]) {
    await page.goto(path);
    const box = page.locator('section[aria-labelledby="whole-record"]');
    const line = box.locator('[data-status="record"]');
    // QA round 2 (N8): two rows, like the profile: since and the frozen line, then the last close.
    expect(await said(line)).toMatch(new RegExp(`^Record since .+ · ${frozenLive()}$`));
    expect(await said(box.locator('[data-status="record2"]'))).toMatch(/^Last close .+$/);
    expect(await box.locator('[data-status="record2"]').evaluate((el) => el.previousElementSibling?.getAttribute('data-status'))).toBe('record');
    expect(await line.evaluate((el) => el.previousElementSibling?.id)).toBe('whole-record'); // the first line under the heading
    await expect(page.locator('main')).not.toContainText('Connected:');
    await narrow(page);
    const img = await request.get(`${path}/opengraph-image`);
    expect(img.status(), path).toBe(200);
    expect(img.headers()['content-type']).toBe('image/png');
  }
});

test('F-11 two accounts, one removed: "Account 1 of 2 · (inst)" and "Account 2 of 2 removed (date)" (QA round 2 N8); line 2 "Last close (date) · updated (relative)" in <time datetime>', async ({ page }) => {
  await page.goto('/u/fls_two');
  const block = page.locator('.record-status-block');
  // QA round 1 (finding 6): the Connected count is the live (not removed) accounts.
  expect(await said(block.locator('[data-status="line1"]'))).toMatch(/^Record since .+ · Connected: Fake Brokerage \(1 account\)$/);
  const items = block.getByRole('list', { name: 'Accounts in this record' }).locator('li');
  await expect(items).toHaveText(['Account 1 of 2 · Fake Brokerage', `Account 2 of 2 removed ${dateText(REMOVED, now(), { year: 'always' })}`]);
  await expect(items.nth(1).locator(`time[datetime="${REMOVED.toISOString().slice(0, 10)}"]`) /* F-23: the UTC day */).toHaveCount(1);
  const line2 = block.locator('[data-status="line2"]');
  expect(await said(line2)).toMatch(/^Last close [A-Z][a-z]{2} \d{1,2}(, \d{4})? · updated 2 hours ago \([A-Z][a-z]{2} \d{1,2}(, \d{4})?\)$/);
  // The relative time is a <time> whose datetime is the last successful sync, showing its absolute date beside it
  // (QA round 1, finding 9), also as its title.
  const rel = line2.locator('time').last();
  // QA round 2 (N8): the relative time and its date are joined by no-break spaces (\s matches them).
  await expect(rel).toHaveText(/^2\shours\sago\s\([A-Z][a-z]{2}\s\d{1,2}(,\s\d{4})?\)$/);
  expect(await rel.getAttribute('title')).toMatch(/^[A-Z][a-z]{2} \d{1,2}(, \d{4})?$/);
  const iso = (await rel.getAttribute('datetime'))!;
  // F-23: to the hour (the line prints hours): the sync's UTC hour, 'YYYY-MM-DDTHH:00Z'.
  expect(iso).toMatch(/^\d{4}-\d\d-\d\dT\d\d:00Z$/);
  const lag = Date.now() - 2 * 3_600_000 - Date.parse(iso);
  expect(lag).toBeGreaterThan(-10 * 60_000);
  expect(lag).toBeLessThan(70 * 60_000);
  // Status in words, never by colour alone: the line has no colour class.
  for (const cls of await block.locator('p, li').evaluateAll((els) => els.map((e) => e.className))) expect(cls).not.toMatch(/\b(up|down)\b/);
  await expect(page.locator('ul.rows.closes li')).toHaveCount(2); // the removed account's trade stays listed (TR-1, TR-5)
  await narrow(page);
});

test('QA round 2 (N7, N8), PR #85 review (B1): every account removed, no disconnect: "No account connected since (date)" with the live "updated" on the profile, the pane and the trade page; never "record frozen", "Connected", "(0 accounts)" or "Disconnected"; each date glued to its word', async ({ page, request }) => {
  const gone = `No account connected since ${dateText(REMOVED, now(), { year: 'always' })}`;
  await page.goto('/u/fls_gone');
  const block = page.locator('.record-status-block');
  expect(await said(block.locator('[data-status="line1"]'))).toMatch(new RegExp(`^Record since [A-Z][a-z]{2} \\d{1,2}, \\d{4} · ${gone}$`));
  expect(await said(block.locator('[data-status="line2"]'))).toMatch(/^Last close [A-Z][a-z]{2} \d{1,2}(, \d{4})? · updated 3 hours ago \([A-Z][a-z]{2} \d{1,2}(, \d{4})?\)$/);
  await expect(block.getByRole('list', { name: 'Accounts in this record' }).locator('li')).toHaveText([`Account removed ${dateText(REMOVED, now(), { year: 'always' })}`]);
  for (const t of ['record frozen', 'Connected:', '0 accounts', 'Disconnected']) await expect(page.locator('main')).not.toContainText(t);
  // N8: the word before a date and the date are kept together (one line at 360).
  await glue(block.locator('[data-status="line1"]'), `since ${dateText(REMOVED, now(), { year: 'always' })}`);
  await narrow(page);
  // The pane JSON and the trade page say the same, with "updated" (absolute on the cached pane).
  const json = await (await request.get('/u/fls_gone/pane?v=2')).json();
  const paneText = (json.status as { text: string }[]).map((x) => x.text).join('');
  expect(paneText).toMatch(new RegExp(`^${gone} · Last close .+ · updated [A-Z][a-z]{2} \\d{1,2}, \\d{4}$`));
  expect(paneText).not.toMatch(/record frozen|Disconnected/);
  await page.goto(`/u/fls_gone/trade/${encodeURIComponent('fls_gone-0')}`);
  const box = page.locator('section[aria-labelledby="whole-record"]');
  expect(await said(box.locator('[data-status="record"]'))).toMatch(new RegExp(`^Record since .+ · ${gone}$`));
  expect(await said(box.locator('[data-status="record2"]'))).toMatch(/^Last close .+ · updated 3 hours ago \(.+\)$/);
  await expect(page.locator('main')).not.toContainText('Connected:');
  await expect(page.locator('main')).not.toContainText('record frozen');
  // The frozen record's own Disconnected line keeps "Disconnected" and its date together too.
  await page.goto('/u/fls_frozen');
  await glue(page.locator('.record-status-block [data-status="line1"]'), `Disconnected ${dateText(DISCONNECTED, now(), { year: 'always' })}`);
});
