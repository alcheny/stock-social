// F-29 (docs/features/F-29-gated-options-wording.md; plan docs/features/logs/F-29/plan.md, test table):
//   1. Mounted (static markup from e2e/f29-render.ts with app/globals.css, light and dark): the /how paragraph in both gate
//      states, the pane's one qualifier directly before its figures (D5 fallback, QA M1), and the D5 stop (the disclaimer
//      stays in view with open positions, the label and the count line) at 360x740 and 320x740.
//   2. The real app against the seed (yolo_yuki, the demo trader with options): /how's interim words, the feed card's and
//      the pane's one qualifier and count line in place, the reading order, the D6 first-screen stop, the gate-keyed
//      cache headers, and no "not asked" or "declined" anywhere.
import { expect, test, type Locator, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { F29, OPTIONS } from '../lib/copy.ts';

const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
type Rendered = { gates: { closed: boolean; open: boolean }; howClosed: string; howOpen: string; pane: string; paneOpenPositions: string; paneGateOpen: string; paneNoOptions: string };
let R: Rendered;
test.beforeAll(() => {
  R = JSON.parse(execFileSync(process.execPath, [new URL('./f29-render.ts', import.meta.url).pathname], { encoding: 'utf8', timeout: 60_000 }));
});

async function mount(page: Page, markup: string, scheme: 'light' | 'dark' = 'light') {
  await page.emulateMedia({ colorScheme: scheme });
  await page.setContent(`<!doctype html><html><head><meta name="viewport" content="width=device-width"><style>${css}</style></head><body><main class="page">${markup}</main></body></html>`);
}
const noHScroll = async (page: Page) => expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
const inView = async (page: Page, l: Locator, what: string) => {
  const b = (await l.boundingBox())!, vh = page.viewportSize()!.height;
  expect(b, what).not.toBeNull();
  expect(b.y, `${what}: top in view`).toBeGreaterThanOrEqual(0);
  expect(b.y + b.height, `${what}: bottom in view`).toBeLessThanOrEqual(vh);
};

// The pane's one qualifier, checked in the DOM: the count of "Excluding options" without the chart caption, its place
// directly before the headline figures (D5 fallback, QA M1: as on the profile), its gap, tone and size, and one count line.
async function paneQualifier(pane: Locator) {
  return pane.evaluate((p) => {
    const c = p.cloneNode(true) as HTMLElement;
    c.querySelectorAll('figcaption').forEach((f) => f.remove());
    const count = (c.textContent!.match(/Excluding options/g) ?? []).length;
    const label = p.querySelector('.share-label') as HTMLElement | null;
    if (!label) return { count, label: false } as const;
    const headline = [...p.querySelectorAll('section.stats')].find((s) => /win rate/.test(s.textContent!)) as HTMLElement;
    const nextOk = label.nextElementSibling === headline;
    const gap = headline.getBoundingClientRect().top - label.getBoundingClientRect().bottom;
    const cs = getComputedStyle(label), body = getComputedStyle(document.body);
    const probe = document.createElement('span');
    probe.style.color = 'var(--muted)';
    document.body.append(probe);
    const muted = getComputedStyle(probe).color;
    probe.remove();
    return {
      count, label: true, nextOk, gap,
      wrapped: !!label.closest('figcaption, footer, [aria-hidden="true"], [title]'),
      muted: cs.color === muted, smaller: parseFloat(cs.fontSize) < parseFloat(body.fontSize), warn: /warn/.test(label.className),
      gated: p.querySelectorAll('.options-gated').length,
    } as const;
  });
}

// ---- 1. Mounted.
test('D5 stop: disclaimer in view, pane with open positions (360x740 and 320x740; F-21/F-34 lines pending)', async ({ page }) => {
  for (const [w, hh] of [[360, 740], [320, 740]]) {
    await page.setViewportSize({ width: w, height: hh });
    for (const scheme of ['light', 'dark'] as const) {
      await mount(page, R.paneOpenPositions, scheme);
      const pane = page.locator('section.pane');
      await expect(pane.locator('.open-stats')).toHaveCount(1);
      await expect(pane.locator('.open-combined')).toHaveCount(1);
      await expect(pane.locator('.share-label')).toHaveText(OPTIONS.shareLabel);
      await expect(pane.locator('.options-gated')).toHaveCount(1);
      // AC 10 (feature: "in view at 360 px and reflows at 320 px"): at 360 the headline and the F3 line are inside the
      // viewport when the pane opens (the D5 stop); at 320 the pane reflows: no horizontal scroll, nothing clipped.
      // (At 320x740 this fictional pane's F3 line sits below the fold with the label in either place, 800 px measured at
      // build, so the label's place does not cause it.)
      if (w === 360) {
        await inView(page, pane.locator('section.stats').first(), `${w} ${scheme} headline`);
        await inView(page, pane.locator('.disclaimer'), `${w} ${scheme} disclaimer`);
      } else await inView(page, pane.locator('section.stats').first(), `${w} ${scheme} headline`);
      await noHScroll(page);
      // Every line wraps (nothing clipped).
      expect(await pane.evaluate((p) => [...p.querySelectorAll('p, small, b')].filter((e) => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflow !== 'visible').length)).toBe(0);
    }
  }
});

test('AC1 and AC9: the /how paragraph says the signed interim words with the gate closed and the legal sentence open; one process renders both, and the bodies differ', async ({ page }) => {
  expect(R.gates).toEqual({ closed: false, open: true });
  await mount(page, R.howClosed);
  await expect(page.locator('p[data-options-how="interim"]')).toHaveText(F29.howInterim);
  expect(R.howClosed).not.toMatch(/consented/i);
  await mount(page, R.howOpen);
  await expect(page.locator('p[data-options-how="open"]')).toHaveText(OPTIONS.how);
  expect(R.howOpen).not.toBe(R.howClosed);
  // The pane of one record differs across the flip (count line or options line, and the foot note).
  expect(R.paneGateOpen).not.toBe(R.pane);
  const text = (m: string) => m.replace(/&#x27;/g, "'");
  expect(text(R.pane)).toContain(OPTIONS.gated(4, 1));
  expect(text(R.paneGateOpen)).not.toContain(OPTIONS.gated(4, 1));
  expect(R.paneGateOpen).toContain('Options: 3 trades');
});

for (const scheme of ['light', 'dark'] as const) {
  test(`AC2 (${scheme}): one qualifier per pane, directly before the headline figures (with and without open positions), muted and small, never in a caption, foot or title`, async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    for (const markup of [R.pane, R.paneOpenPositions]) {
      await mount(page, markup, scheme);
      const q = await paneQualifier(page.locator('section.pane'));
      expect(q).toMatchObject({ count: 1, label: true, nextOk: true, wrapped: false, muted: true, smaller: true, warn: false, gated: 1 });
      if (q.label) expect(q.gap).toBeLessThanOrEqual(17);
    }
    // Without options: no qualifier, no count line.
    await mount(page, R.paneNoOptions, scheme);
    await expect(page.locator('.share-label, .options-gated, .card-options-count')).toHaveCount(0);
  });
}

// ---- 2. The real app.
async function feedPageWith(page: Page, handle: string): Promise<string | null> {
  let url: string | null = '/';
  for (let i = 0; i < 40 && url; i++) {
    const html = await (await page.request.get(url)).text();
    if (html.includes(`data-handle="${handle}"`)) return url;
    url = /href="(\/\?after=[A-Za-z0-9_-]+)"/.exec(html)?.[1]?.replace(/&amp;/g, '&') ?? null;
  }
  return null;
}
async function yukiRow(page: Page) {
  const at = await feedPageWith(page, 'yolo_yuki');
  test.skip(!at, 'yolo_yuki has no feed card (the demo data is not seeded)');
  await page.goto(at!);
  const row = page.locator('.feed > .row[data-handle="yolo_yuki"]').first();
  await row.evaluate((el) => el.scrollIntoView());
  return row;
}

test('AC8 and AC1: /how carries the signed interim words verbatim while the gate is closed, and never "consented"', async ({ page }) => {
  await page.goto('/how');
  await expect(page.locator('#options + p')).toHaveText(F29.howInterim);
  expect(await page.content()).not.toMatch(/consented/i);
});

test('AC2: on the feed, the card has one qualifier in its strip after the average and one count line under the strip; the pane has one qualifier directly before its figures', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 740 }, javaScriptEnabled: false });
  const page = await ctx.newPage();
  try {
    const row = await yukiRow(page);
    const card = row.locator('article.card');
    const c = await card.evaluate((el) => {
      const qualifiers = [...el.querySelectorAll('*')].filter((n) => n.children.length === 0 && /Excluding options/.test(n.textContent!));
      const strip = el.querySelector('[data-strip]')!;
      const q = strip.querySelector('[data-role="options"]');
      const lead = strip.querySelector('[data-role="average"], [data-role="early"]');
      const line = el.querySelectorAll('.card-options-count');
      return {
        count: (el.textContent!.match(/Excluding options/g) ?? []).length,
        isStrip: qualifiers.length === 1 && qualifiers[0] === q,
        after: !!lead && !!q && !!(lead.compareDocumentPosition(q) & Node.DOCUMENT_POSITION_FOLLOWING),
        lines: line.length, prevIsStrip: line[0]?.previousElementSibling === strip,
        foreign: el.querySelectorAll('.options-gated, .pane-options').length,
        text: line[0]?.textContent ?? '',
      };
    });
    expect(c).toMatchObject({ count: 1, isStrip: true, after: true, lines: 1, prevIsStrip: true, foreign: 0 });
    expect(c.text).toMatch(/^\d+ option trades?( and \d+ open options?)? imported\. Option results aren't shown on this record\.$/);
    const q = await paneQualifier(row.locator('section.pane'));
    expect(q).toMatchObject({ count: 1, label: true, nextOk: true, wrapped: false, muted: true, smaller: true, warn: false, gated: 1 });
    if (q.label) expect(q.gap).toBeLessThanOrEqual(17);
    // The profile: the qualifier sits directly before the headline stats.
    await page.goto('/u/yolo_yuki');
    expect(await page.locator('main .share-label').evaluate((l) => {
      const n = l.nextElementSibling!;
      return n.matches('section.stats') && /win rate/.test(n.textContent!);
    })).toBe(true);
  } finally {
    await ctx.close();
  }
});

test('AC4: the qualifier is announced with the headline figures on the profile, in the pane and in the card strip', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 740 }, javaScriptEnabled: false });
  const page = await ctx.newPage();
  const lines = (s: string) => s.split('\n').map((l) => l.trim()).filter(Boolean);
  try {
    await page.goto('/u/yolo_yuki');
    const main = lines(await page.locator('main').ariaSnapshot());
    const at = main.findIndex((l) => l.includes(OPTIONS.shareLabel));
    expect(at, main.join('\n')).toBeGreaterThanOrEqual(0);
    // The very next entry is the headline stats (win rate, then the average).
    expect(main[at + 1], main.join('\n')).toMatch(/win rate.*avg return/);
    const row = await yukiRow(page);
    // The pane: the qualifier, then at once the headline stats (D5 fallback, as on the profile).
    const ps = lines(await row.locator('section.pane').ariaSnapshot());
    const q = ps.findIndex((l) => l.includes(OPTIONS.shareLabel) && !/figure|caption/.test(l));
    expect(q, ps.join('\n')).toBeGreaterThan(0);
    expect(ps[q + 1], ps.join('\n')).toMatch(/win rate.*avg return/);
    // The card: in the strip's reading order the qualifier follows the average.
    const strip = (await row.locator('article.card [data-strip]').ariaSnapshot());
    expect(strip.indexOf(OPTIONS.shareLabel)).toBeGreaterThan(strip.search(/[+\-\u2212\u2248]?\d+\.\d%|Too early/i));
  } finally {
    await ctx.close();
  }
});

test('D5 fallback (QA M1): in the real feed pane, with its chart, the qualifier sits directly before the headline tiles and is in view whenever any tile is (360x740 and 320x740)', async ({ browser }) => {
  for (const [w, hh] of [[360, 740], [320, 740]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: hh } });
    const page = await ctx.newPage();
    try {
      const row = await yukiRow(page);
      // Swipe to the pane: the row scrolls sideways to it, top of the row at the top of the screen.
      await row.evaluate((el) => { el.scrollIntoView({ block: 'start', behavior: 'instant' }); el.scrollTo({ left: el.scrollWidth, behavior: 'instant' }); });
      const pane = row.locator('section.pane');
      await expect.poll(() => pane.evaluate((p) => Math.abs(p.getBoundingClientRect().left)), { timeout: 5000 }).toBeLessThan(2);
      await expect(pane.locator('figure.chart')).toHaveCount(1);
      const r = await pane.evaluate((p, vh) => {
        const label = p.querySelector('.share-label')!.getBoundingClientRect();
        const tiles = p.querySelector('section.stats')!;
        const t = tiles.getBoundingClientRect();
        return { next: p.querySelector('.share-label')!.nextElementSibling === tiles, labelTop: label.top, labelBottom: label.bottom, tilesTop: t.top, vh };
      }, hh);
      expect(r.next, `${w}: the label directly before the tiles`).toBe(true);
      // Above the tiles: whenever any part of a tile is on screen, the whole label is.
      expect(r.labelBottom, `${w}: label above the tiles`).toBeLessThanOrEqual(r.tilesTop);
      if (r.tilesTop < r.vh) expect(r.labelBottom, `${w}: label in view while a tile is`).toBeLessThanOrEqual(r.vh);
      await noHScroll(page);
    } finally {
      await ctx.close();
    }
  }
});

test('D6 stop: on yolo_yuki\'s feed card the disclaimer, the strip qualifier and the count line are in view at 360x740 and 320x740, with no horizontal scroll', async ({ browser }) => {
  for (const [w, hh] of [[360, 740], [320, 740]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: hh } });
    const page = await ctx.newPage();
    try {
      const row = await yukiRow(page);
      await expect.poll(() => row.evaluate((el) => Math.abs(el.getBoundingClientRect().top)), { timeout: 5000 }).toBeLessThan(2);
      const card = row.locator('article.card');
      await inView(page, card.locator('[data-disclaimer]'), `${w} disclaimer`);
      await inView(page, card.locator('[data-role="options"]'), `${w} strip qualifier`);
      await inView(page, card.locator('.card-options-count'), `${w} count line`);
      await noHScroll(page);
    } finally {
      await ctx.close();
    }
  }
});

test('AC6: the pane and story bodies are cached only under the current gate key; a missing or stale key gets the body with no-store; the profile is never public', async ({ request }) => {
  const get = (p: string) => request.get(p);
  const ok = await get('/u/yolo_yuki/pane?v=2&g=o0');
  expect(ok.status()).toBe(200);
  expect(ok.headers()['cache-control']).toBe('public, max-age=60');
  for (const p of ['/u/yolo_yuki/pane?v=2&g=o1', '/u/yolo_yuki/pane?v=2', '/u/yolo_yuki/pane?v=2&g=x']) {
    const r = await get(p);
    expect(r.status(), p).toBe(200);
    expect(r.headers()['cache-control'], p).toBe('no-store');
  }
  expect((await get('/u/yolo_yuki/pane?g=o0')).status()).toBe(404); // F-23: no v, no body
  const story = await get('/u/yolo_yuki/story?format=square&g=o1');
  expect(story.status()).toBe(200);
  expect(story.headers()['cache-control']).toBe('no-store');
  expect((await get('/u/yolo_yuki/story?format=square&g=o0')).headers()['cache-control']).toBe('public, max-age=300');
  expect((await get('/u/yolo_yuki')).headers()['cache-control'] ?? '').not.toMatch(/public/);
});

test('AC6: the pages reference only gate-keyed share URLs (the profile, month and trade unfurl images)', async ({ page }) => {
  await page.goto('/u/yolo_yuki');
  const og = async () => new URL((await page.locator('meta[property="og:image"]').first().getAttribute('content'))!);
  expect((await og()).searchParams.get('g')).toBe('o0');
  const html = await (await page.request.get('/u/yolo_yuki')).text();
  const trade = /href="(\/u\/yolo_yuki\/trade\/[^"#?]+)"/.exec(html)?.[1];
  const month = /href="(\/u\/yolo_yuki\/month\/\d{4}-\d{2})"/.exec(html)?.[1];
  for (const p of [trade, month]) {
    if (!p) continue;
    await page.goto(p);
    const u = await og();
    expect(u.searchParams.get('g'), p).toBe('o0');
    expect((await page.request.get(u.pathname + u.search)).status(), p).toBe(200);
  }
});

test('AC5: no public surface prints "not asked" or "declined"', async ({ page, request }) => {
  const bodies: [string, string][] = [];
  for (const p of ['/', '/u/yolo_yuki', '/how']) {
    await page.goto(p);
    bodies.push([p, await page.locator('body').innerText()]);
  }
  bodies.push(['pane json', await (await request.get('/u/yolo_yuki/pane?v=2&g=o0')).text()]);
  const html = await (await request.get('/u/yolo_yuki')).text();
  for (const re of [/href="(\/u\/yolo_yuki\/trade\/[^"#?]+)"/, /href="(\/u\/yolo_yuki\/month\/\d{4}-\d{2})"/]) {
    const p = re.exec(html)?.[1];
    if (!p) continue;
    await page.goto(p);
    bodies.push([p, await page.locator('body').innerText()]);
  }
  expect(bodies.length).toBeGreaterThanOrEqual(4);
  for (const [p, b] of bodies) expect(b, p).not.toMatch(/\bnot asked\b|\bdeclined\b/i);
});
