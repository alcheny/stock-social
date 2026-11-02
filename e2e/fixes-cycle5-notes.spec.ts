// FIXES-CYCLE5 (F5-2, F5-24; committee round 3 items 1-3, 8, 9) at 360 px, against the running app. Own fixture traders
// only (`fc5n` + a random tag), removed at the end; feed-eligible, so the feed lock is held shared.
// - The note field: visible label "Your note", named "Your note on <SYM>", three lines tall, "‹n› of 280" from the server.
// - A rebuild between loading the page and pressing Save (the row gets a new id, its trade_key stays): the note is saved,
//   shows after a reload, and the typed text stays in the field after Save.
// - A paste past 280 characters: 280 stored, "Your paste was cut to 280 characters." shown and in the polite region.
// - A trade that left the record: the alert is focused, the read-only box holds the typed text (and, with storage
//   blocked, the alert shows alone, without the sentence that points at the box); without JavaScript the URL ends
//   #note-changed and the alert is inside the 360 × 640 viewport.
// - After a rebuild, "Edit it on your profile" on a held note lands with the note field focused.
// A "rebuild" here is what lib/sync.ts#rebuildTrades does to a row: deleted and inserted again (a new id) with the same
// sell_id, so the same generated trade_key.
import { expect, test, type Page } from '@playwright/test';
import postgres from 'postgres';
import { feedLock } from './feed-lock.ts';

const DAY = 86_400_000;
const tag = Math.random().toString(36).slice(2, 7);
const AUTHOR = `fc5n${tag}`;
const SYM = (i: number) => `FCN${tag.slice(0, 2).toUpperCase()}${i}`;
const sql = postgres(process.env.DATABASE_URL!, { max: 2, onnotice: () => {} });
const NOTE_CHANGED = 'Your note was not saved because this trade changed.';
const NOTE_UNSAVED = 'Your unsaved note is below. Copy it before you leave this page.';

test.describe.configure({ mode: 'serial' });
let release: (() => Promise<void>) | null = null;
let userId = 0;

test.beforeAll(async () => {
  release = await feedLock('shared');
  const [u] = await sql`with a as (insert into signup_attempts (method, adult_attested_at) values ('dev', now()) returning id)
    insert into users (handle, display_name, adult_attested_at, signup_attempt_id) select ${AUTHOR}, ${AUTHOR}, now(), a.id from a returning id, signup_attempt_id`;
  userId = u.id;
  await sql`insert into closed_trades ${sql(Array.from({ length: 8 }, (_, i) => ({
    user_id: u.id, sell_id: `${AUTHOR}-${i}`, account_id: 'a', symbol: SYM(i),
    opened_at: new Date(Date.now() - (i + 1) * 3_600_000 - 2 * DAY), closed_at: new Date(Date.now() - (i + 1) * 3_600_000),
    return_pct: (i % 2 ? 1 : -1) * 0.01 * (i + 1), holding_days: 2, verified: true,
    thesis: i === 0 ? 'Bought the base retest.' : null, thesis_status: i === 0 ? 'published' : null,
  })))}`;
  await sql`insert into connections (attempt_id, user_id, state, consent_at, importing_at, last_progress_at, connected_at)
    values (${u.signup_attempt_id}, ${u.id}, 'connected', now(), now(), now(), now() - interval '3 days')`;
});
test.afterAll(async () => {
  await sql`delete from users where handle = ${AUTHOR}`;
  await release?.();
  await sql.end({ timeout: 1 });
});

async function signIn(page: Page) {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto('/login/dev');
  await page.getByLabel('Handle').fill(AUTHOR);
  await page.getByLabel('I am 18 or older').check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(new RegExp(`/u/${AUTHOR}$`));
}
// The row of one close, found by its symbol link (rows are re-rendered with new ids after a rebuild).
const row = (page: Page, i: number) => page.locator('ul.rows.closes > li').filter({ has: page.getByRole('link', { name: SYM(i), exact: true }) });
const field = (page: Page, i: number) => row(page, i).getByRole('textbox', { name: `Your note on ${SYM(i)}`, exact: true });
// What rebuildTrades does to one row: a new id, the same sell_id (so the same trade_key), thesis carried over.
async function rebuild(i: number) {
  await sql.begin(async (tx) => {
    const [r] = await tx`delete from closed_trades where user_id = ${userId} and sell_id = ${`${AUTHOR}-${i}`} returning *`;
    const { id: _id, trade_key: _k, ...rest } = r;
    await tx`insert into closed_trades ${tx(rest)}`;
  });
}
const stored = async (i: number) => (await sql`select thesis from closed_trades where user_id = ${userId} and sell_id = ${`${AUTHOR}-${i}`}`)[0]?.thesis ?? null;

test('F5-24: the field has the visible label, its symbol in the name, three lines, and the server count', async ({ page }) => {
  await signIn(page);
  const f = field(page, 0);
  await expect(f).toHaveCount(1);
  await expect(page.getByRole('textbox', { name: `Your note on ${SYM(0)}`, exact: true })).toHaveCount(1);
  await expect(f).toHaveJSProperty('tagName', 'TEXTAREA');
  await expect(row(page, 0).locator('label.note-label')).toHaveText('Your note');
  await expect(row(page, 0).locator('label.note-label')).toBeVisible();
  const lines = await f.evaluate((el) => { const cs = getComputedStyle(el); return (el.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)) / parseFloat(cs.lineHeight === 'normal' ? String(parseFloat(cs.fontSize) * 1.2) : cs.lineHeight); });
  expect(lines).toBeGreaterThanOrEqual(2.9);
  await expect(row(page, 0).locator('.note-count')).toHaveText(`${'Bought the base retest.'.length} of 280`);
  await expect(f).toHaveAttribute('aria-describedby', /^count-[0-9a-f]{64}$/);
  // At 360 px nothing in the row runs past the screen.
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
});

test('F5-2: a rebuild between loading the page and Save: the note is saved, shows after a reload, and stays in the field', async ({ page }) => {
  await signIn(page);
  const text = 'Sold into the gap; the move had stalled at the old high.';
  await field(page, 1).fill(text);
  await expect(row(page, 1).locator('.note-count')).toHaveText(`${text.length} of 280`);
  await rebuild(1);
  await row(page, 1).getByRole('button', { name: 'Save' }).click();
  await expect.poll(() => stored(1)).toBe(text);
  await expect(field(page, 1)).toHaveValue(text);
  await expect(page.locator('#note-changed')).toHaveCount(0);
  await page.reload();
  await expect(row(page, 1).locator('blockquote')).toContainText(text);
  await expect(field(page, 1)).toHaveValue(text);
});

test('F5-24: a paste past the limit stores 280 characters and says so in the polite region', async ({ page }) => {
  await signIn(page);
  const f = field(page, 2);
  await f.focus();
  const long = 'Range breakout on rising volume with a stop under the base. '.repeat(6).slice(0, 300);
  // A real paste: the paste event first (what the browser's clipboard sends), then the text inserted under maxLength.
  await f.evaluate((el, t) => { const dt = new DataTransfer(); dt.setData('text/plain', t); el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); }, long);
  await page.keyboard.insertText(long);
  await expect(f).toHaveValue(long.slice(0, 280));
  const say = row(page, 2).locator('[data-note-say]');
  await expect(say).toHaveAttribute('aria-live', 'polite');
  await expect(say).toHaveText('Your paste was cut to 280 characters.');
  await expect(say).toBeVisible();
  await expect(row(page, 2).locator('.note-count')).toHaveText('280 of 280');
  await row(page, 2).getByRole('button', { name: 'Save' }).click();
  await expect.poll(() => stored(2)).toBe(long.slice(0, 280).trim());
  // The next input clears the cut line; 20 left is spoken on the way back up.
  await field(page, 2).fill(long.slice(0, 259));
  await expect(say).toHaveText('');
  await field(page, 2).press('x');
  await expect(say).toHaveText('20 characters left');
});

test('F5-2: a trade that left the record: the alert is focused and the read-only box holds the typed text', async ({ page }) => {
  await signIn(page);
  const text = 'Typed while the trade left the record.';
  await field(page, 3).fill(text);
  await sql`delete from closed_trades where user_id = ${userId} and sell_id = ${`${AUTHOR}-3`}`;
  await row(page, 3).getByRole('button', { name: 'Save' }).click();
  await expect(page).toHaveURL(/\?note=changed&n=[0-9a-f]{64}&closes=50#note-changed$/);
  const alert = page.locator('#note-changed');
  await expect(alert).toHaveAttribute('role', 'alert');
  await expect(alert).toBeFocused();
  await expect(alert.locator('p').first()).toHaveText(NOTE_CHANGED);
  await expect(alert.getByText(NOTE_UNSAVED)).toBeVisible();
  const box = alert.getByRole('textbox', { name: 'Your unsaved note', exact: true });
  await expect(box).toHaveValue(text);
  await expect(box).toHaveAttribute('readonly', '');
  expect(page.url()).not.toContain(encodeURIComponent(text.split(' ')[0]));
  // Shown once: a reload clears the stash, and the alert stands alone.
  await page.reload();
  await expect(page.locator('#note-changed').getByRole('textbox')).toHaveCount(0);
  await expect(page.locator('#note-changed').getByText(NOTE_UNSAVED)).toHaveCount(0);
});

test('F5-2: with storage blocked the alert shows alone, focused, without the sentence about the box', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => { throw new DOMException('blocked', 'SecurityError'); };
    Storage.prototype.getItem = () => { throw new DOMException('blocked', 'SecurityError'); };
  });
  await signIn(page);
  await field(page, 4).fill('Typed with storage blocked.');
  await sql`delete from closed_trades where user_id = ${userId} and sell_id = ${`${AUTHOR}-4`}`;
  await row(page, 4).getByRole('button', { name: 'Save' }).click();
  await expect(page).toHaveURL(/#note-changed$/);
  const alert = page.locator('#note-changed');
  await expect(alert).toBeFocused();
  await expect(alert).toHaveText(NOTE_CHANGED);
  await expect(alert.getByRole('textbox')).toHaveCount(0);
});

test('F5-2: without JavaScript the URL ends #note-changed and the alert is inside the 360 x 640 viewport', async ({ browser, page }) => {
  await signIn(page);
  const state = await page.context().storageState();
  const ctx = await browser.newContext({ javaScriptEnabled: false, storageState: state, viewport: { width: 360, height: 640 } });
  try {
    const p = await ctx.newPage();
    await p.goto(`/u/${AUTHOR}`);
    await field(p, 5).fill('Typed with no JavaScript.');
    await sql`delete from closed_trades where user_id = ${userId} and sell_id = ${`${AUTHOR}-5`}`;
    await row(p, 5).getByRole('button', { name: 'Save' }).click();
    await expect(p).toHaveURL(/#note-changed$/);
    await expect(p.locator('#note-changed')).toHaveText(NOTE_CHANGED);
    await expect(p.locator('#note-changed')).toBeInViewport();
  } finally { await ctx.close(); }
});

test('F5-24: after a rebuild, "Edit it on your profile" on a held note lands with the note field focused', async ({ page }) => {
  await sql`update closed_trades set thesis = 'More at example.com', thesis_status = 'held', thesis_hold_rule = 'link', thesis_written_at = now()
    where user_id = ${userId} and sell_id = ${`${AUTHOR}-6`}`;
  await signIn(page);
  await page.goto(`/u/${AUTHOR}/trade/${encodeURIComponent(`${AUTHOR}-6`)}`);
  await rebuild(6); // the trade page was rendered for the old row; its link names the trade key, which the rebuild keeps
  await page.getByRole('link', { name: 'Edit it on your profile' }).click();
  await expect(page).toHaveURL(/\?closes=50#note-[0-9a-f]{64}$/);
  await expect(field(page, 6)).toBeFocused();
  await expect(field(page, 6)).toBeInViewport();
  await expect(field(page, 6)).toHaveAttribute('aria-describedby', /^count-[0-9a-f]{64} held-\d+$/); // the count and the held reason (code review 2)
});
