// F-27 (docs/features/F-27-colour-follow-ups.md) against the running app. Own fixture traders only (`f27*` + a random
// tag), removed at the end; feed-eligible, so the feed lock is held shared.
// - AC1: the stock page's bar baselines are drawn in --control (computed stroke), light and dark.
// - AC3/AC4: a failed record's feed card, pane, profile and trade page each show one warn notice (aria-hidden icon that
//   ignores pointer events, --warn border, words in --text); every element drawn in --warn on those surfaces sits in a
//   .warn-notice holding the icon and visible words; light and dark.
// - AC10: a double tap that lands on the icon still likes the card (signed in).
// - AC11: at 320×640, 360×640 and 780×360 a failed record's card keeps F-10's 15% headroom and its disclaimer in the row.
import { expect, test, type Browser, type Locator, type Page } from '@playwright/test';
import postgres from 'postgres';
import { feedLock } from './feed-lock.ts';

const DAY = 86_400_000;
const tag = Math.random().toString(36).slice(2, 7);
const FAILED = `f27x${tag}`, VIEWER = `f27v${tag}`;
const SYMBOL = `FZ${tag.slice(0, 3).toUpperCase()}`;
const WORDS = 'The import did not finish, so this record may be incomplete.';
const sql = postgres(process.env.DATABASE_URL!, { max: 2, onnotice: () => {} });

test.describe.configure({ mode: 'serial' });
let release: (() => Promise<void>) | null = null;
let top = { id: '', sell: '' };

async function makeUser(handle: string, closes: number, state: 'failed' | null) {
  const [u] = await sql`with a as (insert into signup_attempts (method, adult_attested_at) values ('dev', now()) returning id)
    insert into users (handle, display_name, adult_attested_at, signup_attempt_id) select ${handle}, ${handle}, now(), a.id from a returning id, signup_attempt_id`;
  if (closes) {
    // The newest and largest close leads the card; the rest share one symbol so the stock page draws both charts.
    await sql`insert into closed_trades ${sql(Array.from({ length: closes }, (_, i) => ({
      user_id: u.id, sell_id: `${handle}-${i}`, account_id: 'a', symbol: SYMBOL,
      opened_at: new Date(Date.now() - (i * 20 + 3) * 3_600_000 - 2 * DAY), closed_at: new Date(Date.now() - (i * 20 + 3) * 3_600_000),
      return_pct: i === 0 ? 0.93 : (i % 2 ? 1 : -1) * 0.03 * (1 + (i % 4)), holding_days: 2, verified: true,
    })))}`;
  }
  if (state) await sql`insert into connections (attempt_id, user_id, state, consent_at, importing_at, last_progress_at, failed_at)
    values (${u.signup_attempt_id}, ${u.id}, ${state}, now() - interval '2 days', now() - interval '2 days', now() - interval '1 day', now() - interval '1 day')`;
  return u.id as number;
}

test.beforeAll(async () => {
  release = await feedLock('shared');
  await makeUser(FAILED, 12, 'failed');
  await makeUser(VIEWER, 0, null);
  const [t] = await sql`select t.id::text as id, t.sell_id from closed_trades t join users u on u.id = t.user_id where u.handle = ${FAILED} order by t.closed_at desc limit 1`;
  top = { id: t.id, sell: t.sell_id };
});
test.afterAll(async () => {
  await sql`delete from users where handle in ${sql([FAILED, VIEWER])}`;
  await release?.();
  await sql.end({ timeout: 1 });
});

async function signIn(page: Page, handle: string) {
  await page.goto('/login/dev');
  await page.getByLabel('Handle').fill(handle);
  await page.getByLabel('I am 18 or older').check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(new RegExp(`/u/${handle}$`));
}
// A token's computed colour (rgb()), read through a probe element.
const token = (page: Page, name: string) => page.evaluate((n) => {
  const p = document.createElement('i');
  p.style.color = `var(--${n})`;
  document.body.append(p);
  const c = getComputedStyle(p).color;
  p.remove();
  return c;
}, name);
const card = (page: Page) => page.locator(`.row[data-trade="${top.id}"] article.card`);
const pane = (page: Page) => page.locator(`.row[data-trade="${top.id}"] section.pane`);

// One warn notice in `scope`: the icon aria-hidden and ignoring pointer events, the border in --warn, the words in --text.
async function oneNotice(page: Page, scope: Locator, where: string) {
  const n = scope.locator('.warn-notice');
  await expect(n, `${where}: one notice`).toHaveCount(1);
  await expect(n.locator('span').first(), `${where}: words`).toHaveText(new RegExp(`^${WORDS.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
  const [warn, text] = [await token(page, 'warn'), await token(page, 'text')];
  const s = await n.evaluate((el) => {
    const cs = getComputedStyle(el), icon = el.querySelector('[data-warn-icon]')!, words = el.querySelector(':scope > span')!;
    return {
      border: [cs.borderTopColor, cs.borderRightColor, cs.borderBottomColor, cs.borderLeftColor], words: getComputedStyle(words).color,
      hidden: icon.getAttribute('aria-hidden'), pe: getComputedStyle(icon).pointerEvents, cls: el.className,
      before: getComputedStyle(el, '::before').content,
    };
  });
  expect(s.border, `${where}: border`).toEqual([warn, warn, warn, warn]);
  expect(s.words, `${where}: words colour`).toBe(text);
  expect(s.hidden, `${where}: icon hidden`).toBe('true');
  expect(s.pe, `${where}: icon pointer-events`).toBe('none');
  expect(s.cls.split(' ').sort(), `${where}: classes`).toEqual(['record-failed', 'warn-notice']);
  expect(['none', 'normal'], `${where}: no ::before glyph`).toContain(s.before);
}

// AC4: every element whose computed colour, border, outline, background, fill or stroke is --warn sits inside a
// .warn-notice that holds [data-warn-icon] and visible words. Returns how many elements were drawn in --warn.
async function scan(page: Page, root: string, where: string) {
  const warn = await token(page, 'warn');
  const out = await page.evaluate(({ root, warn }) => {
    const props = ['color', 'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color', 'outline-color', 'background-color', 'fill', 'stroke'];
    const bad: string[] = [];
    let drawn = 0;
    for (const el of document.querySelectorAll(`${root}, ${root} *`)) {
      const cs = getComputedStyle(el);
      const hits = props.filter((p) => {
        const v = cs.getPropertyValue(p);
        if (v !== warn) return false;
        // A border or outline in --warn draws only with a width and a style.
        const side = /^(border-\w+|outline)-color$/.exec(p)?.[1];
        return !side || (parseFloat(cs.getPropertyValue(`${side}-width`)) > 0 && cs.getPropertyValue(`${side}-style`) !== 'none');
      });
      if (!hits.length) continue;
      drawn++;
      const box = el.closest('.warn-notice');
      const words = box?.querySelector(':scope > span');
      const ok = box && box.querySelector('[data-warn-icon]') && words && (words.textContent ?? '').trim().length > 0 && (words as HTMLElement).offsetHeight > 0;
      if (!ok) bad.push(`${el.tagName.toLowerCase()}.${(el.getAttribute('class') ?? '').replace(/ /g, '.')} ${hits.join(',')}`);
    }
    return { bad, drawn };
  }, { root, warn });
  expect(out.bad, `${where}: drawn in --warn outside a full notice`).toEqual([]);
  expect(out.drawn, `${where}: the notice draws in --warn`).toBeGreaterThan(0);
}

test('F-27 AC1: the stock page\'s bar baselines are drawn in --control in light and dark', async ({ page }) => {
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme });
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto(`/t/${SYMBOL}`);
    const control = await token(page, 'control');
    const strokes = await page.evaluate(() => [...document.querySelectorAll('svg line')]
      .filter((l) => l.getAttribute('y1') === l.getAttribute('y2') && Number(l.getAttribute('x2')) - Number(l.getAttribute('x1')) > 200)
      .map((l) => getComputedStyle(l).stroke));
    expect(strokes.length, `${colorScheme}: Spread and Timeline baselines`).toBe(2);
    for (const s of strokes) expect(s, colorScheme).toBe(control);
    expect(await token(page, 'line'), 'the baseline is not --line').not.toBe(control);
  }
});

test('F-27 AC3, AC4: a failed record\'s card, pane, profile and trade page each show one full warn notice; nothing else is drawn in --warn (light and dark)', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 360, height: 740 });
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme });
    await page.goto('/');
    await card(page).scrollIntoViewIfNeeded();
    await oneNotice(page, card(page), `${colorScheme} card`);
    await scan(page, `.row[data-trade="${top.id}"] article.card`, `${colorScheme} card`);
    await expect(pane(page)).toBeAttached();
    await oneNotice(page, pane(page), `${colorScheme} pane`);
    // The pane may sit off screen beside the card; its notice must still be laid out (visible words).
    await pane(page).scrollIntoViewIfNeeded();
    await scan(page, `.row[data-trade="${top.id}"] section.pane`, `${colorScheme} pane`);
    await page.goto(`/u/${FAILED}`);
    await oneNotice(page, page.locator('main'), `${colorScheme} profile`);
    await scan(page, 'body', `${colorScheme} profile`);
    await page.goto(`/u/${FAILED}/trade/${encodeURIComponent(top.sell)}`);
    await oneNotice(page, page.locator('main'), `${colorScheme} trade page`);
    await scan(page, 'body', `${colorScheme} trade page`);
  }
});

test('F-27 AC10: a double tap on the warn icon of a failed record\'s card likes it (signed in)', async ({ browser }: { browser: Browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 800 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  try {
    await signIn(page, VIEWER);
    await page.goto('/');
    const icon = card(page).locator('[data-warn-icon]');
    await icon.evaluate((e) => e.closest('.row')!.scrollIntoView({ block: 'start' }));
    await expect.poll(async () => { const y = (await icon.boundingBox())?.y; await page.waitForTimeout(100); return y === (await icon.boundingBox())?.y; }).toBe(true);
    const b = (await icon.boundingBox())!;
    const x = Math.round(b.x + b.width / 2), y = Math.round(b.y + b.height / 2);
    // The tap lands on the icon's centre; the icon ignores it, so the hit is the notice (inside the card).
    expect(await page.evaluate(([px, py]) => { const el = document.elementFromPoint(px, py); return !!el && !el.closest('svg') && !!el.closest('.warn-notice'); }, [x, y])).toBe(true);
    const cdp = await ctx.newCDPSession(page);
    const tap = async () => {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    };
    await tap(); await page.waitForTimeout(90); await tap();
    await expect.poll(async () => (await sql`select count(*)::int as n from trade_likes l join users u on u.id = l.viewer_id where u.handle = ${VIEWER}`)[0].n).toBe(1);
  } finally {
    await sql`delete from trade_likes where viewer_id = (select id from users where handle = ${VIEWER})`;
    await ctx.close();
  }
});

// F-10's fit check (e2e/record-strip.spec.ts, e2e/f26-held-like-none.spec.ts): the card's content fits its row with 15%
// headroom; the disclaimer is in the row; no horizontal scroll.
test('F-27 AC11: at 320×640, 360×640 and 780×360 a failed record\'s card keeps F-10\'s headroom and its disclaimer', async ({ page }) => {
  for (const [w, h] of [[320, 640], [360, 640], [780, 360]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto('/');
    const c = card(page);
    await c.scrollIntoViewIfNeeded();
    await expect(c.locator('.warn-notice')).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${w}x${h} no side scroll`).toBe(true);
    const row = (await c.locator('xpath=..').boundingBox())!;
    const disc = (await c.locator('[data-disclaimer]').boundingBox())!;
    expect(disc.y + disc.height, `${w}x${h} disclaimer`).toBeLessThanOrEqual(row.y + row.height + 2);
    const fit = await c.evaluate((el) => {
      const hero = el.querySelector('.hero')!, cs = getComputedStyle(el), hs = getComputedStyle(hero);
      const hh = (x: Element) => x.getBoundingClientRect().height;
      const heroNat = [...hero.children].reduce((t, x) => t + hh(x), 0) + (parseFloat(hs.rowGap) || 0) * (hero.children.length - 1);
      const blocks = [...el.children].reduce((t, x) => t + (x === hero ? heroNat : hh(x)), 0);
      const fixed = (parseFloat(cs.rowGap) || 0) * (el.children.length - 1) + parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
      return { need: blocks * 1.15 + fixed, row: el.parentElement!.clientHeight };
    });
    expect(fit.need, `${w}x${h} content with 15% headroom`).toBeLessThanOrEqual(fit.row);
  }
});

test('F-27 AC3 (author): the author\'s own profile shows the one notice as an alert, the retry button inside its words at 44 px (light and dark)', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await signIn(page, FAILED);
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme });
    await page.goto(`/u/${FAILED}`);
    await oneNotice(page, page.locator('main'), `${colorScheme} author profile`);
    const n = page.locator('.warn-notice');
    await expect(n).toHaveAttribute('role', 'alert');
    const retry = n.locator(':scope > span a.button');
    await expect(retry).toHaveAttribute('href', '/connect');
    expect((await retry.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await scan(page, 'body', `${colorScheme} author profile`);
  }
});
