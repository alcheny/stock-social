// F-20 (design tokens and the contrast test; docs/features/F-20-design-tokens-and-contrast-test.md): the browser side of
// lib/a11y-contrast.test.ts's token checks.
// - The computed-style snapshot: on the feed, a feed row's pane, a profile and the signed-in switch pages, signed out and signed in, light and dark,
//   every element's computed colours (text, background, borders, outline, shadow, SVG fill and stroke) are grouped by the
//   element's signature (tag, classes and the state attributes styles key on, with two ancestors). The groups are
//   compared with e2e/fixtures/f20-style-baseline.json, captured from main before the token layer (06edbdf, which
//   already carries fixes #12, #13 and #26). Every colour a signature shows now must be one it showed then: the token
//   layer is value-neutral. A signature the baseline never saw (another file's fixture, a new feature) is skipped; the
//   check is "no colour changed", not "nothing was added". `F20_BASELINE=write` rewrites the file (a deliberate colour
//   change, which only the owner approves: base and accent through V-1, image colours through O-2).
// - The one stated focus change (DS-27): every sampled control, focused from the keyboard, draws its ring in --focus at a
//   2 px offset.
// The fixture trader is this file's own (verified closes, a gain and a loss, so the Verified badge and both tones
// render) and is removed afterwards; seeded traders are read, never touched. The trader is feed-eligible, so the file
// holds the feed lock shared (e2e/feed-lock.ts).
import { expect, test, type Page } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import postgres from 'postgres';
import { feedLock } from './feed-lock.ts';

const sql = postgres(process.env.DATABASE_URL!, { max: 2, onnotice: () => {} });
const BASELINE = new URL('./fixtures/f20-style-baseline.json', import.meta.url);
const WRITE = process.env.F20_BASELINE === 'write';
const SCHEMES = ['light', 'dark'] as const;
// --focus as computed colours (lib/a11y-contrast.test.ts pins the token values themselves).
const FOCUS = { light: 'rgb(33, 82, 217)', dark: 'rgb(134, 168, 255)' } as const;

const handle = `f20t${Math.random().toString(36).slice(2, 10)}`;
const viewer = `f20v${Math.random().toString(36).slice(2, 10)}`;
let release: () => Promise<void> = async () => {};
let traderId = 0;

test.beforeAll(async () => {
  release = await feedLock('shared');
  const [u] = await sql`with a as (insert into signup_attempts (method, adult_attested_at) values ('dev', now()) returning id)
    insert into users (handle, display_name, adult_attested_at, signup_attempt_id) select ${handle}, 'Token Check', now(), a.id from a returning id`;
  traderId = u.id;
  const R = [0.142, -0.061, 0.033];
  await sql`insert into closed_trades ${sql(R.map((r, i) => ({ user_id: u.id, sell_id: `${handle}-${i}`, account_id: 'f20-acct',
    symbol: ['FTA', 'FTB', 'FTC'][i], opened_at: new Date(Date.now() - (i + 4) * 86_400_000), closed_at: new Date(Date.now() - (i + 1) * 3_600_000),
    return_pct: r, holding_days: i + 3, verified: true, thesis: 'Exit level reached.', thesis_status: 'published' })))}`;
});
test.afterAll(async () => {
  const ids = (await sql`select id, signup_attempt_id as a from users where handle = any(${[handle, viewer]})`) as unknown as { id: number; a: number | null }[];
  const attempts = ids.map((r) => r.a).filter((a): a is number => a != null);
  await sql.begin(async (tx) => {
    await tx`delete from users where id = any(${ids.map((r) => r.id)})`;
    if (!attempts.length) return;
    for (const t of ['login_links', 'funnel_events', 'connections']) await tx`delete from ${tx(t)} where attempt_id = any(${attempts})`;
    await tx`delete from signup_attempts where id = any(${attempts})`;
  });
  await release();
  await sql.end({ timeout: 1 });
});

type Snapshot = Record<string, string[]>;
// Every element's computed colours, grouped by signature; each group holds the distinct colour tuples it showed.
async function snapshot(page: Page, prefix: string): Promise<Snapshot> {
  return page.evaluate((prefix) => {
    const PROPS = ['color', 'background-color', 'background-image', 'border-top-color', 'border-right-color', 'border-bottom-color',
      'border-left-color', 'outline-color', 'outline-style', 'outline-width', 'outline-offset', 'box-shadow', 'fill', 'stroke',
      'text-decoration-color', 'caret-color', 'accent-color'];
    const ATTRS = ['aria-pressed', 'aria-current', 'aria-selected', 'data-part', 'data-tone', 'type', 'open'];
    const sig = (el: Element) => {
      const cls = [...el.classList].sort().map((c) => `.${c}`).join('');
      const att = ATTRS.filter((a) => el.hasAttribute(a)).map((a) => `[${a}=${el.getAttribute(a)}]`).join('');
      return `${el.tagName.toLowerCase()}${cls}${att}`;
    };
    const out: Record<string, Set<string>> = {};
    for (const el of document.querySelectorAll('body *')) {
      if (['SCRIPT', 'STYLE', 'TEMPLATE', 'NOSCRIPT', 'LINK', 'META'].includes(el.tagName)) continue;
      const chain = [el.parentElement?.parentElement, el.parentElement, el].filter((e): e is Element => !!e).map(sig).join(' > ');
      const cs = getComputedStyle(el);
      const tuple = PROPS.map((p) => `${p}:${cs.getPropertyValue(p)}`).join(';');
      (out[`${prefix} ${chain}`] ??= new Set()).add(tuple);
    }
    return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, [...v].sort()]));
  }, prefix);
}

async function signIn(page: Page) {
  await page.goto('/login/dev');
  await page.getByLabel('Handle').fill(viewer);
  await page.getByLabel('I am 18 or older').check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(new RegExp(`/u/${viewer}$`));
}

// The three sampled surfaces: the feed, the first row's pane (opened with →), and the fixture trader's profile.
async function surfaces(page: Page, who: string): Promise<Snapshot> {
  await page.setViewportSize({ width: 360, height: 740 });
  const all: Snapshot = {};
  await page.goto('/');
  await expect(page.locator('.feed .card').first()).toBeVisible();
  Object.assign(all, await snapshot(page, `${who} feed |`));
  const row = page.locator('.feed > .row').first();
  await expect.poll(async () => { await page.keyboard.press('ArrowRight'); return row.evaluate((el) => el.scrollLeft); }).toBeGreaterThan(200);
  await expect(row.locator('.pane .rows li').first()).toBeVisible();
  Object.assign(all, await snapshot(page, `${who} pane |`));
  await page.goto(`/u/${handle}`);
  await expect(page.locator('.badge.verified').first()).toBeVisible();
  Object.assign(all, await snapshot(page, `${who} profile |`));
  return all;
}

test('F-20 computed-style snapshot: feed, pane and profile show no colour change from the pre-token baseline, light and dark', async ({ browser }) => {
  test.setTimeout(180_000);
  const now: Record<string, Snapshot> = {};
  for (const scheme of SCHEMES) {
    const ctx = await browser.newContext({ colorScheme: scheme });
    const page = await ctx.newPage();
    now[scheme] = await surfaces(page, 'out');
    await signIn(page);
    Object.assign(now[scheme], await surfaces(page, 'in'));
    // The signed-in switch pages: .switch-pair's selected cue (DS-27 keeps outlines for focus only).
    for (const path of ['/me/personalize', '/settings']) {
      await page.goto(path);
      await expect(page.locator('main')).toBeVisible();
      Object.assign(now[scheme], await snapshot(page, `in ${path} |`));
    }
    await ctx.close();
  }
  // Stored compactly: each distinct colour tuple once, each signature as indexes into that list.
  if (WRITE) {
    const tuples = [...new Set(SCHEMES.flatMap((s) => Object.values(now[s]).flat()))].sort();
    const at = new Map(tuples.map((t, i) => [t, i]));
    const index = (s: Snapshot) => Object.fromEntries(Object.keys(s).sort().map((k) => [k, s[k].map((t) => at.get(t)!)]));
    writeFileSync(BASELINE, `${JSON.stringify({ tuples, light: index(now.light), dark: index(now.dark) }, null, 0)}\n`);
    return;
  }
  const stored = JSON.parse(readFileSync(BASELINE, 'utf8')) as { tuples: string[] } & Record<(typeof SCHEMES)[number], Record<string, number[]>>;
  const base = Object.fromEntries(SCHEMES.map((s) => [s, Object.fromEntries(Object.entries(stored[s]).map(([k, v]) => [k, v.map((i) => stored.tuples[i])]))])) as Record<string, Snapshot>;
  let compared = 0;
  const changed: string[] = [];
  for (const scheme of SCHEMES) {
    for (const [key, tuples] of Object.entries(now[scheme])) {
      const was = base[scheme][key];
      if (!was) continue;
      compared++;
      for (const t of tuples) if (!was.includes(t)) changed.push(`${scheme} ${key}\n  now: ${t}\n  was: ${was.join('\n       ')}`);
    }
  }
  // The comparison covers the sampled surfaces, not a handful of elements.
  expect(compared, 'signatures compared with the baseline').toBeGreaterThan(150);
  expect(changed, changed.slice(0, 5).join('\n')).toEqual([]);
});

test('F-20 DS-27: sampled controls draw their keyboard focus ring in --focus at a 2 px offset, light and dark', async ({ browser }) => {
  for (const scheme of SCHEMES) {
    const ctx = await browser.newContext({ colorScheme: scheme });
    const page = await ctx.newPage();
    await page.setViewportSize({ width: 360, height: 740 });
    const ring = async (sel: string) => {
      const el = page.locator(sel).first();
      await el.focus();
      return el.evaluate((e) => { const s = getComputedStyle(e); return { color: s.outlineColor, offset: s.outlineOffset, style: s.outlineStyle, focus: e.matches(':focus-visible') }; });
    };
    // Profile: a link, the chart's keyboard target, a range button and the site footer's link.
    await page.goto(`/u/${handle}`);
    await expect(page.locator('.badge.verified').first()).toBeVisible();
    await page.keyboard.press('Tab'); // keyboard modality, so programmatic focus matches :focus-visible
    for (const sel of ['nav.top a', '.chart-stack', '.tabs button', 'footer.site nav.legal a']) {
      const r = await ring(sel);
      expect(r.focus, `${scheme} ${sel} is :focus-visible`).toBe(true);
      expect(r, `${scheme} ${sel}`).toMatchObject({ color: FOCUS[scheme], offset: '2px', style: 'solid' });
    }
    // Sign-in form: the age checkbox (−4 px before DS-27) and the handle input.
    await page.goto('/login/dev');
    await page.keyboard.press('Tab');
    for (const sel of ['input[type="checkbox"]', '#handle']) {
      const r = await ring(sel);
      expect(r, `${scheme} ${sel}`).toMatchObject({ color: FOCUS[scheme], offset: '2px', style: 'solid' });
    }
    await ctx.close();
  }
});
