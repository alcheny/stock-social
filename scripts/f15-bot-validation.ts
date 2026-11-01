// F-15 · bot-filter validation (docs/features/F-15-measurement-foundation.md: "before week 1, the bot filter is checked
// against 200 scripted preview fetches and 50 human visits; it passes when at least 95% of the scripted fetches are
// dropped and at least 95% of the human visits are counted"). Owner-run, against a running server and its database:
//
//   npm run build && ALLOW_DEV_AUTH=1 TRUST_PROXY_HEADERS=1 npm run start      # in one shell
//   node --env-file=.env scripts/f15-bot-validation.ts [--base http://localhost:3000]
//
// It creates one throwaway trader, aims every group at that trader's profile, reads only that trader's rollup rows and
// the day's drop rows, and deletes the trader at the end (the rollup rows go with it). Prints counts only.
// Groups (business lead D1, engineer E1; plan "Round 2 revisions" 1), run in this order with a pause past the rate
// window between groups, so a burst never caps the human group:
//   human     50 visits in a real browser with the automation flag hidden, 2.5 s on the page: 20 with a desktop agent,
//             15 with a phone agent and 15 with in-app browser agents (an embedded web view, with and without an app
//             token), the phone and in-app ones at a 360 px touch viewport (HUMAN_AGENTS; generic shapes, no app named)
//   nojs      50 page fetches with declared-bot agents and no script engine (cannot send a beacon at all)
//   headless  50 script-running visits that declare themselves: 25 with the headless agent, 25 with the automation flag
//   preview   50 script-running visits with the automation flag hidden but a declared preview agent
//   post      50 direct beacon posts from scripts: 20 declared-bot agents, 15 with no fetch metadata, 15 cross-site
// Reported apart (not in the 200): forged posts that copy a browser's agent and headers (counted: the filter is a speed
// bump, not a wall) and a 70-post burst from one address (the rate cap; needs TRUST_PROXY_HEADERS=1 on the server).
// ponytail: simulated humans and scripted fetchers on one machine, not real devices or real preview services; the phone
// and in-app shapes are agent strings on a desktop engine — fix: the owner's real-device check before week 1, logging
// drop reasons only (tracked in docs/direction/business-2026-11-01.md, Stage Beta row B14a, and F-15 Open questions).
import type { Browser } from '@playwright/test';
import { pathToFileURL } from 'node:url';

const arg = (k: string) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : undefined; };
const BASE = arg('--base') ?? 'http://localhost:3000';
const ORIGIN = new URL(BASE).origin;
const DESKTOP = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
// Generic phone and in-app browser shapes (cycle 4 F4-13): a phone browser, an embedded web view ("; wv)") and the same
// web view with an app token appended, as in-app browsers do; the app token is fictional.
const PHONE = 'Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
const WEBVIEW = 'Mozilla/5.0 (Linux; Android 14; Mobile; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.0.0 Mobile Safari/537.36';
export type HumanAgent = { kind: 'desktop' | 'phone' | 'in-app'; ua: string; n: number; mobile: boolean };
export const HUMAN_AGENTS: HumanAgent[] = [
  { kind: 'desktop', ua: DESKTOP, n: 20, mobile: false },
  { kind: 'phone', ua: PHONE, n: 15, mobile: true },
  { kind: 'in-app', ua: WEBVIEW, n: 8, mobile: true },
  { kind: 'in-app', ua: `${WEBVIEW} ExampleApp/312.0.0`, n: 7, mobile: true },
];
export const BOTS = ['Mozilla/5.0 (compatible; ExampleBot/2.1; +https://bot.example/)', 'ExamplePreview/1.0', 'Mozilla/5.0 (compatible; LinkUnfurler/3.0)',
  'Mozilla/5.0 (compatible; SomeCrawler/1.0)', 'Mozilla/5.0 (compatible; ExampleExternalHit/1.1)', 'Mozilla/5.0 (compatible; EmbedFetcher/2.0)',
  'link-checker/1.4', 'curl/8.5.0', 'Mozilla/5.0 (compatible; ArchiveSpider/1.0)', 'Mozilla/5.0 (compatible; MonitorProbe/1.0)'];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const WINDOW_GAP_MS = 61_000;

const db = async () => (await import('../lib/db.ts')).sql;
async function counts(userId: number) {
  const sql = await db();
  const [v] = await sql`select coalesce(sum(n), 0)::int n from view_rollup where user_id = ${userId}`;
  const d = await sql<{ reason: string; n: number }[]>`select reason, sum(n)::int n from view_drops where day = current_date and surface = 'profile' group by reason`;
  return { views: v.n as number, drops: Object.fromEntries(d.map((r) => [r.reason, r.n])) as Record<string, number> };
}
const diff = (a: Awaited<ReturnType<typeof counts>>, b: Awaited<ReturnType<typeof counts>>) => {
  const drops: Record<string, number> = {};
  for (const k of new Set([...Object.keys(a.drops), ...Object.keys(b.drops)])) { const n = (b.drops[k] ?? 0) - (a.drops[k] ?? 0); if (n) drops[k] = n; }
  return { counted: b.views - a.views, drops };
};

async function visits(browser: Browser, path: string, n: number, o: { ua?: string; hideFlag?: boolean; stay?: number; mobile?: boolean }) {
  for (let i = 0; i < n; i += 10) {
    await Promise.all(Array.from({ length: Math.min(10, n - i) }, async () => {
      const ctx = await browser.newContext({ ...(o.ua ? { userAgent: o.ua } : {}), ...(o.mobile ? { viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true } : {}) });
      const page = await ctx.newPage();
      if (o.hideFlag) await page.addInitScript(() => Object.defineProperty(Navigator.prototype, 'webdriver', { configurable: true, get: () => false }));
      let sent = false;
      page.on('requestfinished', (r) => { if (new URL(r.url()).pathname === '/api/views') sent = true; });
      await page.goto(BASE + path);
      await page.waitForTimeout(o.stay ?? 2_500);
      for (let t = 0; t < 30 && !sent; t++) await page.waitForTimeout(100); // the beacon was sent; let it land
      await ctx.close();
    }));
  }
}
async function post(path: string, headers: Record<string, string>) {
  await fetch(`${BASE}/api/views`, { method: 'POST', headers: { 'content-type': 'text/plain', ...headers }, body: JSON.stringify({ path, ref: 'external' }) }).catch(() => {});
}

async function main() {
  const sql = await db();
  const { chromium } = await import('@playwright/test');
  const handle = `f15val${Math.random().toString(36).slice(2, 10)}`;
  const [a] = await sql`insert into signup_attempts (method, adult_attested_at) values ('dev', now()) returning id`;
  const [u] = await sql`insert into users (handle, display_name, adult_attested_at, signup_attempt_id) values (${handle}, 'Validation', now(), ${a.id}) returning id`;
  const path = `/u/${handle}`;
  const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
  const out: Record<string, { n: number; counted: number; drops: Record<string, number> }> = {};
  const run = async (name: string, n: number, fn: () => Promise<void>, gap = true) => {
    const before = await counts(u.id);
    await fn();
    await sleep(1_500);
    out[name] = { n, ...diff(before, await counts(u.id)) };
    console.log(name, JSON.stringify(out[name]));
    if (gap) await sleep(WINDOW_GAP_MS);
  };
  try {
    await run('human', 50, async () => { for (const a of HUMAN_AGENTS) await visits(browser, path, a.n, { ua: a.ua, hideFlag: true, mobile: a.mobile }); });
    await run('nojs', 50, async () => { for (let i = 0; i < 50; i++) await fetch(BASE + path, { headers: { 'user-agent': BOTS[i % BOTS.length] } }).then((r) => r.text()).catch(() => ''); }, false);
    await run('headless', 50, async () => { await visits(browser, path, 25, {}); await visits(browser, path, 25, { ua: DESKTOP }); });
    await run('preview', 50, () => visits(browser, path, 50, { ua: BOTS[1], hideFlag: true }));
    await run('post', 50, async () => {
      for (let i = 0; i < 20; i++) await post(path, { 'user-agent': BOTS[i % BOTS.length], origin: ORIGIN, 'sec-fetch-site': 'same-origin', 'sec-fetch-mode': 'cors' });
      for (let i = 0; i < 15; i++) await post(path, { 'user-agent': DESKTOP });
      for (let i = 0; i < 15; i++) await post(path, { 'user-agent': DESKTOP, origin: 'https://elsewhere.example', 'sec-fetch-site': 'cross-site' });
    });
    await run('forged (not in the 200)', 20, async () => { for (let i = 0; i < 20; i++) await post(path, { 'user-agent': DESKTOP, origin: ORIGIN, 'sec-fetch-site': 'same-origin', 'sec-fetch-mode': 'cors', 'x-forwarded-for': `198.51.100.${i + 1}` }); });
    await run('burst (not in the 200)', 70, async () => { for (let i = 0; i < 70; i++) await post(path, { 'user-agent': DESKTOP, origin: ORIGIN, 'sec-fetch-site': 'same-origin', 'sec-fetch-mode': 'cors', 'x-forwarded-for': '198.51.100.200' }); }, false);
  } finally {
    await browser.close();
    await sql`delete from users where id = ${u.id}`; // its rollup rows cascade
  }
  const scripted = ['nojs', 'headless', 'preview', 'post'];
  const share = (x: number, n: number) => `${((100 * x) / n).toFixed(1)}%`;
  const dropped = (k: string) => out[k].n - out[k].counted;
  const all = scripted.reduce((s, k) => s + dropped(k), 0);
  const js = ['headless', 'preview', 'post'].reduce((s, k) => s + dropped(k), 0);
  const noRate = scripted.reduce((s, k) => s + out[k].n - out[k].counted - (out[k].drops.rate ?? 0), 0);
  console.log('\n| group | n | counted | dropped | drop reasons |\n|---|---|---|---|---|');
  for (const [k, v] of Object.entries(out)) console.log(`| ${k} | ${v.n} | ${v.counted} | ${v.n - v.counted} | ${JSON.stringify(v.drops)} |`);
  console.log(`\nScripted (200): dropped ${all}/200 = ${share(all, 200)}; script-running and direct posts alone (150): ${js}/150 = ${share(js, 150)}`);
  console.log(`Without the rate rule: dropped ${noRate}/200 = ${share(noRate, 200)}`);
  console.log(`Human (50): counted ${out.human.counted}/50 = ${share(out.human.counted, 50)}; false-count rate ${share(200 - all, 200)}`);
  console.log(`Pass: ${all / 200 >= 0.95 && js / 150 >= 0.95 && out.human.counted / 50 >= 0.95 ? 'yes' : 'no'}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then(async () => (await db()).end({ timeout: 1 }), async (e) => { console.error('validation failed', e instanceof Error ? e.name : 'error'); await (await db()).end({ timeout: 1 }); process.exit(1); });
}
