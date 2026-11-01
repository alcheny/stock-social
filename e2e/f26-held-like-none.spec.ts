// F-26 (docs/features/F-26-no-empty-note-line.md) against the running app. Own fixture traders only (`f26*` + a random
// tag), removed at the end. Feed-eligible, so the feed lock is held: exclusively while the identity pair runs (other
// workers' feed-eligible fixtures would change `/` between "before" and "after" for reasons unrelated to the hold),
// shared otherwise.
// - Identity: the same viewer (signed out, and signed in as another user) fetches every surface before and after the
//   trade's note goes from none to held; bodies with per-request tokens stripped, and each Cache-Control, are identical.
//   The trade page's <main>, <title>, meta description and og:image URL are compared on their own too.
// - No viewer payload carries the held marker or its rule; nothing public or cached carries the held line.
// - The author sees the held line on their card (/) and on the trade page, whose link lands on the profile row with
//   its edit field, also beyond the first 50 closes; every response that carries the line is private + no-store.
// - F-10 headroom at 320×640, 360×640 and 780×360 for no note, a 280-character note and the author's held card.
import { expect, test, type APIRequestContext, type Browser, type Page } from '@playwright/test';
import postgres from 'postgres';
import { feedLock } from './feed-lock.ts';

const DAY = 86_400_000;
const tag = Math.random().toString(36).slice(2, 7);
const AUTHOR = `f26a${tag}`, LONG = `f26l${tag}`, READER = `f26r${tag}`;
const FILL = Array.from({ length: 16 }, (_, i) => `f26f${tag}${i}`);
const MARK = `f26mark${tag}`;
const HELD_TEXT = `Retest of the base ${MARK}, more at example.com`;
const RULE_WORDS = 'a link or web address';
const LONG_NOTE = 'Bought after the second earnings beat in a row and a raised outlook; sold when the move stalled near the old high. '.repeat(3).slice(0, 280);
const sql = postgres(process.env.DATABASE_URL!, { max: 2, onnotice: () => {} });

test.describe.configure({ mode: 'serial' });
let release: (() => Promise<void>) | null = null;
let target = { id: '', sell: '', symbol: '' };
let deep = { id: '', sell: '' }; // the author's close beyond the first 50

async function makeUser(handle: string, closes: { r: number; hoursAgo: number; note?: string }[], symbol: (i: number) => string) {
  const [u] = await sql`with a as (insert into signup_attempts (method, adult_attested_at) values ('dev', now()) returning id)
    insert into users (handle, display_name, adult_attested_at, signup_attempt_id) select ${handle}, ${handle}, now(), a.id from a returning id, signup_attempt_id`;
  if (closes.length) {
    await sql`insert into closed_trades ${sql(closes.map((c, i) => ({
      user_id: u.id, sell_id: `${handle}-${i}`, account_id: 'a', symbol: symbol(i),
      opened_at: new Date(Date.now() - c.hoursAgo * 3_600_000 - 2 * DAY), closed_at: new Date(Date.now() - c.hoursAgo * 3_600_000),
      return_pct: c.r, holding_days: 2, verified: true, thesis: c.note ?? null, thesis_status: c.note ? 'published' : null,
    })))}`;
    await sql`insert into connections (attempt_id, user_id, state, consent_at, importing_at, last_progress_at, connected_at)
      values (${u.signup_attempt_id}, ${u.id}, 'connected', now(), now(), now(), now() - interval '3 days')`;
  }
  return u.id as number;
}

test.beforeAll(async () => {
  release = await feedLock('shared');
  // The author: the newest and largest close is the target (their card on page 1); 60 older small closes, so one
  // of them sits beyond the profile's first 50.
  await makeUser(AUTHOR, [{ r: 0.97, hoursAgo: 1 }, ...Array.from({ length: 60 }, (_, i) => ({ r: (i % 2 ? 1 : -1) * 0.02, hoursAgo: 30 + i * 3 }))], (i) => (i === 0 ? `FZT${tag.slice(0, 2).toUpperCase()}` : `FZ${i}`));
  await makeUser(LONG, [{ r: -0.96, hoursAgo: 2, note: LONG_NOTE }, ...Array.from({ length: 5 }, (_, i) => ({ r: 0.01, hoursAgo: 40 + i }))], (i) => `FZL${i}`);
  // Fillers with small moves, so the feed has a second page (the paging action) under the exclusive lock.
  for (const h of FILL) await makeUser(h, Array.from({ length: 5 }, (_, i) => ({ r: (i % 2 ? 1 : -1) * 0.003, hoursAgo: 5 + i })), (i) => `FZF${i}`);
  await makeUser(READER, [], () => '');
  const [t] = await sql`select t.id::text as id, t.sell_id, t.symbol from closed_trades t join users u on u.id = t.user_id where u.handle = ${AUTHOR} order by t.closed_at desc limit 1`;
  target = { id: t.id, sell: t.sell_id, symbol: t.symbol };
  const [d] = await sql`select t.id::text as id, t.sell_id from closed_trades t join users u on u.id = t.user_id where u.handle = ${AUTHOR} order by t.closed_at desc, t.id desc offset 55 limit 1`;
  deep = { id: d.id, sell: d.sell_id };
});
test.afterAll(async () => {
  await sql`delete from users where handle in ${sql([AUTHOR, LONG, READER, ...FILL])}`;
  await release?.();
  await sql.end({ timeout: 1 });
});

const hold = (id: string, rule = 'link') => sql`update closed_trades set thesis = ${HELD_TEXT}, thesis_status = 'held', thesis_hold_rule = ${rule},
  thesis_written_at = now(), thesis_edited_at = now() where id = ${id}`;
const unhold = (id: string) => sql`update closed_trades set thesis = null, thesis_status = null, thesis_hold_rule = null,
  thesis_written_at = null, thesis_edited_at = null where id = ${id}`;

async function signIn(page: Page, handle: string) {
  await page.goto('/login/dev');
  await page.getByLabel('Handle').fill(handle);
  await page.getByLabel('I am 18 or older').check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(new RegExp(`/u/${handle}$`));
}

// Per-request tokens: the CSP nonce, the feed cursor (base64url JSON that starts {"d":" and carries the request's asOf)
// and the time-of-request values Next and the page print. Everything else must match byte for byte.
const strip = (s: string) => s
  .replace(/(nonce(?:=|\\?":)\\?")[^"\\]+/g, '$1N').replace(/'nonce-[^']+'/g, "'nonce-N'")
  .replace(/eyJkIjoi[A-Za-z0-9_-]+/g, 'CURSOR')
  // The render clock the chart props carry ("now"), never a note's date (those are compared).
  .replace(/(\\*"now\\*":\\*"\$D)[^"\\]+/g, '$1T');
// React streams a Suspense boundary either inline or, when it resolves after the shell, as a hidden segment plus an $RC
// script moved into place on the client: timing, not content. Each segment is put back where its boundary is.
const resolveStreamed = (s: string) => {
  const seg = new Map<string, string>();
  s = s.replace(/<div hidden id="S:(\d+)">([\s\S]*?)<\/div><script[^>]*>([^<]*?)\$RC\("B:\1","S:\1"\)<\/script>/g, (_m, n: string, body: string, pre: string) => { seg.set(n, body); return pre ? `<script>${pre}</script>` : ''; });
  return s.replace(/<!--\$\?--><template id="B:(\d+)"><\/template>/g, (m, n: string) => (seg.has(n) ? `<!--$-->${seg.get(n)}` : m));
};
// Next streams metadata: its <title> and <meta> tags land in the head or later in the body depending on when
// generateMetadata resolves (timing, not content). They are compared as a sorted set, beside the rest of the page.
const metaApart = (s: string) => {
  const tags: string[] = [];
  const rest = s.replace(/<title>[^<]*<\/title>|<meta [^>]*>/g, (m) => { tags.push(m); return ''; });
  return `${rest}\n--meta--\n${tags.sort().join('\n')}`;
};

// '' when equal, else both sides around the first difference (a readable failure).
function firstDiff(a: string, b: string): string {
  if (a === b) return '';
  let i = 0;
  while (i < a.length && a[i] === b[i]) i++;
  return `at ${i}: after «${a.slice(Math.max(0, i - 80), i + 80)}» before «${b.slice(Math.max(0, i - 80), i + 80)}»`;
}

type Grab = { body: string; cc: string | null; status: number };
async function grab(api: APIRequestContext, path: string, init?: { method?: 'POST'; headers?: Record<string, string>; data?: string }): Promise<Grab> {
  const r = init?.method === 'POST' ? await api.post(path, { headers: init.headers, data: init.data }) : await api.get(path, { maxRedirects: 0 });
  const buf = await r.body();
  const ct = r.headers()['content-type'] ?? '';
  const body = ct.startsWith('image/') ? `${ct}:${buf.toString('base64')}` : ct.startsWith('text/html') ? metaApart(resolveStreamed(strip(buf.toString('utf8')))) : strip(buf.toString('utf8'));
  return { body, cc: r.headers()['cache-control'] ?? null, status: r.status() };
}

function surfaces(ym: string) {
  return [
    '/', `/u/${AUTHOR}`, `/u/${AUTHOR}/pane`, `/u/${AUTHOR}/pane-chart`, `/u/${AUTHOR}/month/${ym}`,
    `/t/${encodeURIComponent(target.symbol)}`, `/u/${AUTHOR}/trade/${encodeURIComponent(target.sell)}`,
    `/u/${AUTHOR}/story`, `/u/${AUTHOR}/opengraph-image`, `/u/${AUTHOR}/trade/${encodeURIComponent(target.sell)}/opengraph-image`,
  ];
}
const ymNow = () => new Date().toISOString().slice(0, 7);

// The paging action, recorded once from the real pager (POST with a Next-Action header), then replayed verbatim.
async function recordPaging(page: Page): Promise<{ headers: Record<string, string>; data: string }> {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto('/');
  const req = page.waitForRequest((r) => r.method() === 'POST' && !!r.headers()['next-action'], { timeout: 30_000 });
  // The pager loads near the end of the list (and on its control): scroll the feed to its end until it asks.
  const asked = (async () => { for (let i = 0; i < 40; i++) { await page.evaluate(() => { const f = document.querySelector('.feed'); (f ?? document.scrollingElement)!.scrollTop = 1e9; window.scrollTo(0, 1e9); }); await page.waitForTimeout(250); } })();
  const r = await req;
  await asked.catch(() => {});
  const h = r.headers();
  const keep = Object.fromEntries(Object.entries(h).filter(([k]) => /^(next-action|next-router-state-tree|content-type|accept)$/i.test(k)));
  return { headers: keep, data: r.postData() ?? '' };
}

test('F-26 identity: for a viewer (signed out, and another signed-in user) every surface is byte-identical before and after the hold, and carries no marker', async ({ browser, playwright, baseURL }) => {
  test.setTimeout(240_000);
  await release?.();
  release = await feedLock('exclusive');
  try {
    const out = await playwright.request.newContext({ baseURL });
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await signIn(page, READER);
    const guest = await browser.newContext();
    const viewers: [string, APIRequestContext, Page][] = [['signed out', out, await guest.newPage()], ['reader', ctx.request, page]];
    for (const [who, api, p] of viewers) {
      await unhold(target.id);
      // The profile's "Similar trades" pool is kept per process and rebuilt in the background once 10 s old
      // (lib/similar.ts): let it catch up with this file's fixtures first, so "before" and "after" read the same pool.
      await grab(api, `/u/${AUTHOR}`);
      await p.waitForTimeout(11_000);
      await grab(api, `/u/${AUTHOR}`);
      await p.waitForTimeout(1_000);
      const paging = await recordPaging(p);
      // Charts are drawn to the minute (lib/chart-series.ts: ranges end now, times floored to the minute), so the pair
      // runs inside one minute: start just after a minute turns. A pair that a slow runner stretches past the minute is
      // run again (up to 3 tries): the clock changed, not the hold.
      const tradeMeta = (b: string) => ({ main: b.match(/<main[\s\S]*<\/main>/)?.[0], title: b.match(/<title>[^<]*<\/title>/)?.[0],
        desc: b.match(/<meta name="description"[^>]*>/)?.[0], og: b.match(/<meta property="og:image"[^>]*>/)?.[0] });
      let ym = '', before = new Map<string, Grab>(), after = new Map<string, Grab>(), inMinute = false;
      for (let attempt = 0; attempt < 3 && !inMinute; attempt++) {
        await unhold(target.id);
        await p.waitForTimeout(60_000 - (Date.now() % 60_000) + 300);
        const started = Date.now();
        ym = ymNow();
        before = new Map(); after = new Map();
        for (const s of surfaces(ym)) before.set(s, await grab(api, s));
        before.set('paging', await grab(api, '/', { method: 'POST', ...paging }));
        await hold(target.id);
        for (const s of surfaces(ym)) after.set(s, await grab(api, s));
        after.set('paging', await grab(api, '/', { method: 'POST', ...paging }));
        inMinute = Math.floor(Date.now() / 60_000) === Math.floor(started / 60_000);
      }
      expect(inMinute, 'the pair ran inside one minute').toBe(true);
      for (const s of [...surfaces(ym), 'paging']) {
        const a = after.get(s)!, b = before.get(s)!;
        expect(a.status, `${who} ${s} status`).toBe(b.status);
        expect(a.cc, `${who} ${s} Cache-Control`).toBe(b.cc);
        expect(firstDiff(a.body, b.body), `${who} ${s} body identical`).toBe('');
        expect(a.body, `${who} ${s}`).not.toContain(MARK);
        expect(a.body, `${who} ${s}`).not.toContain(RULE_WORDS);
        expect(a.body, `${who} ${s}`).not.toContain('Thesis held for review');
        expect(a.body, `${who} ${s}`).not.toMatch(/"thesis_status":"held"|thesis-held|data-own-held/);
      }
      const t = surfaces(ym).find((s) => s.includes('/trade/') && !s.endsWith('opengraph-image'))!;
      const tb = before.get(t)!.body;
      expect(tradeMeta(tb).main, 'the trade page has a <main>').toBeTruthy();
      expect(tradeMeta(after.get(t)!.body)).toEqual(tradeMeta(tb));
      // The paging response is a real page of cards.
      expect(before.get('paging')!.body).toContain('data-trade');
    }
    await ctx.close();
    await guest.close();
    await out.dispose();
  } finally {
    await unhold(target.id);
    await release?.();
    release = await feedLock('shared');
  }
});

test('F-26 author: the held line on their own card and on the trade page (private, no-store); the link lands on the row with its edit field, also beyond the first 50', async ({ page }) => {
  test.setTimeout(120_000);
  await hold(target.id);
  await hold(deep.id, 'reports');
  try {
    await signIn(page, AUTHOR);
    await page.setViewportSize({ width: 360, height: 800 });
    const home = await page.goto('/');
    const cc = home!.headers()['cache-control'] ?? '';
    expect(cc).toContain('private');
    expect(cc).toContain('no-store');
    const card = page.locator(`.row[data-trade="${target.id}"] .card`);
    const line = card.locator('p.thesis-held');
    await expect(line).toHaveText('Thesis held for review. Only you can see it. Held because it has a link or web address. Edit it to publish, or it stays held until reviewed.');
    await expect(line).toHaveClass(/\bmuted\b/);
    await expect(line).not.toHaveClass(/\b(down|up|warn|loss)\b/);
    // The held text itself never reaches the page, even for its author (the profile's edit field is where it is edited).
    expect(await page.content()).not.toContain(MARK);

    // Trade page, close #1 (window 50).
    const tr = await page.goto(`/u/${AUTHOR}/trade/${encodeURIComponent(target.sell)}`);
    expect(tr!.headers()['cache-control'] ?? '').toMatch(/private.*no-store|no-store.*private/);
    await expect(page.locator('.trade-card p.thesis-held')).toContainText('Held because it has a link or web address.');
    const link = page.getByRole('link', { name: 'Edit it on your profile' });
    expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await link.click();
    await expect(page).toHaveURL(new RegExp(`/u/${AUTHOR}\\?closes=50#trade-${target.id}$`));
    await expect(page.locator(`#trade-${target.id} input[name="thesis"]`)).toBeVisible();
    await expect(page.locator(`#trade-${target.id} p.thesis-held`)).toBeVisible();

    // The close beyond the first 50 (row 56): window 100.
    await page.goto(`/u/${AUTHOR}/trade/${encodeURIComponent(deep.sell)}`);
    await expect(page.locator('.trade-card p.thesis-held')).toContainText('Readers reported it');
    await page.getByRole('link', { name: 'Edit it on your profile' }).click();
    await expect(page).toHaveURL(new RegExp(`/u/${AUTHOR}\\?closes=100#trade-${deep.id}$`));
    await expect(page.locator(`#trade-${deep.id} input[name="thesis"]`)).toBeVisible();
    await expect(page.locator(`#trade-${deep.id} input[name="thesis"]`)).toBeInViewport();

    // The profile carries the line for its author: private, no-store too.
    const prof = await page.request.get(`/u/${AUTHOR}`);
    expect(await prof.text()).toContain('Thesis held for review');
    expect(prof.headers()['cache-control'] ?? '').toMatch(/private.*no-store|no-store.*private/);

    // Nothing public or shared carries the line, even when the author asks.
    for (const s of [`/u/${AUTHOR}/pane`, `/u/${AUTHOR}/pane-chart`, `/u/${AUTHOR}/story`, `/u/${AUTHOR}/opengraph-image`, `/u/${AUTHOR}/trade/${encodeURIComponent(target.sell)}/opengraph-image`]) {
      const r = await page.request.get(s);
      const body = (await r.body()).toString('utf8');
      expect(body, s).not.toContain('Thesis held for review');
      expect(body, s).not.toContain(MARK);
    }
    // Month page, stock page: the same for the author as for anyone (no note slot).
    for (const s of [`/u/${AUTHOR}/month/${ymNow()}`, `/t/${encodeURIComponent(target.symbol)}`]) {
      const body = await (await page.request.get(s)).text();
      expect(body, s).not.toContain('Thesis held for review');
    }
  } finally {
    await unhold(target.id);
    await unhold(deep.id);
  }
});

// F-10's fit check (e2e/record-strip.spec.ts): the card's content fits its row with 15% headroom; the disclaimer is in
// the row; no horizontal scroll.
async function fits(page: Page, sel: string, label: string) {
  const card = page.locator(sel).first();
  await card.scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${label} no side scroll`).toBe(true);
  const row = (await card.locator('xpath=..').boundingBox())!;
  const disc = (await card.locator('[data-disclaimer]').boundingBox())!;
  expect(disc.y + disc.height, `${label} disclaimer`).toBeLessThanOrEqual(row.y + row.height + 2);
  const fit = await card.evaluate((c) => {
    const hero = c.querySelector('.hero')!, cs = getComputedStyle(c), hs = getComputedStyle(hero);
    const h = (el: Element) => el.getBoundingClientRect().height;
    const heroNat = [...hero.children].reduce((t, x) => t + h(x), 0) + (parseFloat(hs.rowGap) || 0) * (hero.children.length - 1);
    const blocks = [...c.children].reduce((t, x) => t + (x === hero ? heroNat : h(x)), 0);
    const fixed = (parseFloat(cs.rowGap) || 0) * (c.children.length - 1) + parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    return { need: blocks * 1.15 + fixed, row: c.parentElement!.clientHeight };
  });
  expect(fit.need, `${label} content with 15% headroom`).toBeLessThanOrEqual(fit.row);
}

test('F-26 AC (F-10 headroom): at 320×640, 360×640 and 780×360 a card with no note, one with a 280-character note and the author\'s held card fit', async ({ browser }: { browser: Browser }) => {
  test.setTimeout(120_000);
  await hold(target.id, 'contact details'); // the longest rule explanation
  try {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await signIn(page, AUTHOR);
    for (const [w, h] of [[320, 640], [360, 640], [780, 360]]) {
      await page.setViewportSize({ width: w, height: h });
      await page.goto('/');
      const held = `.row[data-trade="${target.id}"] .card`;
      await expect(page.locator(`${held} p.thesis-held`)).toBeVisible();
      await fits(page, held, `${w}x${h} held`);
      // About 130-150 characters at 13 px: 3-4 lines at 320 px.
      if (w === 320) {
        const p = page.locator(`${held} p.thesis-held`);
        const lines = await p.evaluate((el) => el.getBoundingClientRect().height / (parseFloat(getComputedStyle(el).lineHeight) || 13 * 1.45));
        expect(lines).toBeLessThanOrEqual(4.6);
      }
      await fits(page, `.row[data-handle="${LONG}"] .card`, `${w}x${h} 280-character note`);
      const bare = '.feed > .row > .card:not(:has(.thesis)):not(:has(.thesis-held)):not(:has(.fv-slot))';
      await expect(page.locator(bare).first()).toBeAttached();
      await fits(page, bare, `${w}x${h} no note`);
    }
    await ctx.close();
  } finally {
    await unhold(target.id);
  }
});
