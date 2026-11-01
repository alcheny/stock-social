// F-24 AC7 (docs/features/F-24-late-sell-reconciliation.md; plan docs/features/logs/F-24/plan.md §5, §6): a close the
// reconciliation pass found renders like any close. No "late", "corrected" or "new" wording on its profile row, its trade
// page or its feed card; its thesis stays attached by sell_id through a rebuild that re-prices it; the feed ranks the
// found losing close by abs(return_pct); and nothing under app/ branches on reconcile or re-issue state.
//
// The close is found the production way: syncUser with `cadence` on a shifted database clock, an in-memory broker in the
// vendor's shapes whose week read honours its window, and a due pass. The pages are the real server components, rendered
// with react-dom/server after the module hook lib/f10-feed-card.test.ts uses (.tsx through Next's own SWC binding, `@/`
// to the repo root, next/link a plain <a>), plus signed-out request stubs: next/headers with no cookies (so the real
// currentUser returns null) and next/navigation with throwing notFound/redirect.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { createRequire, registerHooks } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = new URL('..', import.meta.url);
const hasDb = !!process.env.DATABASE_URL;
const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL', timeout: 180_000 }, fn);

// The words a found close must never carry (D6). "New record" (TR-7) is about the record's age, not this close: it is
// left out by scoping each check to the close's own row, card or section.
const FLAGGED = /\blate\b|corrected|\bnew\b/i;
// Anything that would let app/ tell a found close from any other (lib/reconcile.ts, its columns and tables).
const REISSUE_STATE = /lib\/reconcile(\.ts)?['"]|\breconcile_[a-z_]+|activity_reissues|closes_rewritten|reissue|notReissued|recordPage|plannedPages/i;

// ---- static: no UI branch on found closes (runs without a database) ----
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : /\.(tsx?|css)$/.test(n) ? [p] : [];
  });
}

test('AC7 (static): no file under app/ reads reconcile or re-issue state, so nothing can render a found close differently', () => {
  const files = walk(fileURLToPath(new URL('app', ROOT)));
  assert.ok(files.length > 50, `scanned ${files.length} files`);
  const hits = files.filter((f) => REISSUE_STATE.test(readFileSync(f, 'utf8'))).map((f) => f.slice(fileURLToPath(ROOT).length));
  assert.deepEqual(hits, []);
});

test('AC7 (static): the profile row, the trade page\'s trade section and the feed card carry no late/corrected/new copy', () => {
  const read = (p: string) => readFileSync(new URL(p, ROOT), 'utf8');
  // The JSX between the closed-trades list's opening and closing tags (the row a found close renders in).
  const page = read('app/u/[handle]/page.tsx');
  const row = page.slice(page.indexOf('<ul className="rows closes">'), page.indexOf('</ul>', page.indexOf('<ul className="rows closes">')));
  assert.ok(row.includes('saveThesis') && row.includes('trade-link'), 'found the closed-trades row');
  const trade = read('app/u/[handle]/trade/[sellId]/page.tsx');
  // Since FIXES-LABELS (#85) the close's figures ("This trade") and its note ("trade-thesis") are two sections; both are
  // the close's own and both are checked. The record section between them (its "New record" badge is about the record's
  // age, TR-7) stays out, as before.
  const sectionOf = (label: string) => trade.slice(trade.indexOf(`aria-labelledby="${label}"`), trade.indexOf('</section>', trade.indexOf(`aria-labelledby="${label}"`)));
  const figures = sectionOf('this-trade'), note = sectionOf('trade-thesis');
  assert.ok(figures.includes('id="this-trade"'), 'found the trade section');
  assert.ok(note.includes('UserNote'), 'found the trade note section');
  const section = figures + note;
  const ui = read('app/ui.tsx');
  const card = ui.slice(ui.indexOf('export function TradeCard'), ui.indexOf('</article>', ui.indexOf('export function TradeCard')));
  assert.ok(card.includes('className="card"'), 'found the feed card');
  // Literal text only (JSX text and string literals), never identifiers such as `firstNew`.
  const literals = (src: string) => [...src.matchAll(/>([^<>{}]+)</g), ...src.matchAll(/'([^'\n]*)'|"([^"\n]*)"|`([^`\n]*)`/g)]
    .map((m) => m[1] ?? m[2] ?? m[3] ?? '').filter((s) => /[a-z]/i.test(s));
  for (const [name, src] of [['profile row', row], ['trade section', section], ['feed card', card]] as const) {
    assert.deepEqual(literals(src).filter((s) => FLAGGED.test(s)), [], name);
  }
});

// ---- rendered, through a real pass ----
const require = createRequire(import.meta.url);
const swc = require('next/dist/build/swc') as { loadBindings: () => Promise<unknown>; transformSync: (src: string, o: object) => { code: string } };
const mod = (src: string) => `data:text/javascript,${encodeURIComponent(src)}`;
const STUBS: Record<string, string> = {
  'next/link': mod("import { createElement } from 'react'; export default function Link({ href, children, prefetch: _p, scroll: _s, replace: _r, ...rest }) { return createElement('a', { href, ...rest }, children); }"),
  // Signed out: no session cookie, so lib/session.ts#currentUser returns null through its real code.
  'next/headers': mod('export async function cookies() { return { get: () => undefined, getAll: () => [], has: () => false, set() {}, delete() {} }; } export async function headers() { return new Headers(); } export async function draftMode() { return { isEnabled: false }; }'),
  'next/navigation': mod("export function notFound() { throw new Error('NEXT_NOT_FOUND'); } export function redirect(u) { throw new Error('NEXT_REDIRECT ' + u); } export function permanentRedirect(u) { throw new Error('NEXT_REDIRECT ' + u); } export function useRouter() { return { push() {}, replace() {}, refresh() {}, prefetch() {}, back() {} }; } export function usePathname() { return '/'; } export function useSearchParams() { return new URLSearchParams(); }"),
};
let hooked = false;
async function hook() {
  if (hooked) return;
  hooked = true;
  await swc.loadBindings();
  registerHooks({
    resolve(spec, ctx, next) {
      if (STUBS[spec]) return { url: STUBS[spec], shortCircuit: true };
      if (spec.startsWith('@/')) return next(new URL(spec.slice(2), ROOT).href, ctx);
      if (ctx.parentURL?.startsWith('data:')) return next(spec, { ...ctx, parentURL: import.meta.url });
      if (/^next\/[a-z-]+$/.test(spec)) return next(`${spec}.js`, ctx); // Next's CommonJS entry points (next/cache, next/og, …)
      return next(spec, ctx);
    },
    load(url, ctx, next) {
      if (!url.endsWith('.tsx')) return next(url, ctx);
      const file = new URL(url);
      const { code } = swc.transformSync(readFileSync(file, 'utf8'), {
        filename: file.pathname, jsc: { parser: { syntax: 'typescript', tsx: true }, transform: { react: { runtime: 'automatic' } }, target: 'es2022' }, module: { type: 'es6' },
      });
      return { format: 'module', source: code, shortCircuit: true };
    },
  });
}
const page = async (p: string) => import(pathToFileURL(fileURLToPath(new URL(p, ROOT))).href);

before(async () => { if (hasDb) await (await import('./db.ts')).sql.unsafe(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')).simple(); });
after(async () => { if (hasDb) await (await import('./db.ts')).sql.end({ timeout: 1 }); });

// Tags stripped until nothing changes (a single pass can leave a tag formed by what it removed); entities decoded last.
const stripTags = (s: string) => { let prev: string; do { prev = s; s = s.replace(/<[^>]*>/g, ' '); } while (s !== prev); return s; };
const text = (html: string) => stripTags(html).replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

const HOUR = 3_600_000, DAY = 24 * HOUR;
type Act = { externalId: string; accountId: string; symbol: string; side: 'BUY' | 'SELL'; units: number; price: number; fee: number; executedAt: Date; verified: true; raw: { type: string } };

dbTest('AC7: a close found by a pass renders like any close (profile row, trade page, feed card), keeps its thesis through a re-pricing rebuild, and ranks by abs(return_pct)', async () => {
  await hook();
  const { sql } = await import('./db.ts');
  const { createAttempt, createUserForAttempt } = await import('./auth/attempts.ts');
  const { syncUser, insertActivities } = await import('./sync.ts');
  const { saveThesisFor } = await import('./thesis-save.ts');
  const { feedCandidates, clearFeedCache } = await import('./feed.ts');
  const tag = `fc${Math.random().toString(36).slice(2, 9)}`;
  const u = await createUserForAttempt(await createAttempt({ method: 'dev', attested: true }), { handle: `${tag}u` });
  const handle = `${tag}u`;
  await sql`update users set snaptrade_user_id = ${`${tag}-v`}, snaptrade_secret_enc = 'enc' where id = ${u.id}`;
  const acc = { id: `${tag}-a`, authorizationId: 'a', institution: 'x', isPaper: false, initialSyncCompleted: true };
  await sql`insert into connections (attempt_id, user_id, vendor_authorization_id, state, consent_at, importing_at, connected_at, accounts, options_backfilled_at)
    select signup_attempt_id, id, 'a', 'connected', now() - interval '400 days', now() - interval '400 days', now() - interval '400 days', ${sql.json([acc])}, now()
    from users where id = ${u.id}`;
  const user = { id: u.id, snaptrade_user_id: `${tag}-v`, snaptrade_secret_enc: 'enc' };
  try {
    const now = Date.now();
    const at = (d: number) => new Date(now - d * DAY);
    const act = (id: string, symbol: string, side: 'BUY' | 'SELL', units: number, price: number, executedAt: Date): Act =>
      ({ externalId: `${tag}-${id}`, accountId: acc.id, symbol, side, units, price, fee: 0, executedAt, verified: true, raw: { type: side } });
    const sameDay = at(12); // the found sell, an equal-size gain and a smaller gain close at the same instant
    // Stored before the pass: five older closes (so the trader is feed-eligible), the two gains, the found close's buy and a
    // buy 2 days ago (the newest stored trade: the week read starts 7 days before it).
    const stored: Act[] = [
      ...[1, 2, 3, 4, 5].flatMap((i) => [act(`f${i}b`, `F${i}`, 'BUY', 10, 50, at(40)), act(`f${i}s`, `F${i}`, 'SELL', 10, 50 + i * 0.1, at(30))]),
      act('gb', 'GAIN', 'BUY', 10, 100, at(30)), act('gs', 'GAIN', 'SELL', 10, 108, sameDay),
      act('hb', 'HALF', 'BUY', 10, 100, at(30)), act('hs', 'HALF', 'SELL', 10, 104, sameDay),
      act('lb', 'LOSS', 'BUY', 10, 100, at(30)),
      act('nb', 'NEWEST', 'BUY', 1, 10, at(2)),
    ];
    await insertActivities(u.id, 'snaptrade', stored);
    // Posted by the vendor late: the loss's sell, dated 10 days before the newest stored trade (first pass), then an older
    // buy of the same stock that re-prices it (second pass).
    const lateSell = act('ls', 'LOSS', 'SELL', 10, 92, sameDay);
    const lateBuy = act('lb0', 'LOSS', 'BUY', 5, 96, at(45));
    let vendor: Act[] = [...stored];
    let weekReads = 0, pages = 0;
    const broker = {
      pageLimit: 1000,
      listAccounts: async () => [acc],
      fetchActivities: async (_u: unknown, since: Date) => { weekReads++; return vendor.filter((a) => a.executedAt >= since); },
      fetchActivitiesPage: async (_u: unknown, _id: string, offset: number, limit = 1000) => { pages++; return { activities: vendor.slice(offset, offset + limit), done: offset + limit >= vendor.length }; },
    };
    const sync = (h: number) => syncUser(user, broker as never, undefined, undefined, { cadence: true, shiftMs: h * HOUR });
    const due = () => sql`update broker_accounts set reconcile_due_at = now() - interval '1 day' where account_id = ${acc.id}`;
    const close = async () => (await sql`select id, sell_id, return_pct, opened_at, thesis, thesis_status from closed_trades where user_id = ${u.id} and symbol = 'LOSS'`)[0];

    // Day 0: the week read, before the vendor posts the sell.
    await sync(0);
    assert.equal(weekReads, 1);
    vendor = [...stored, lateSell];
    // Day 1, no pass due: the week read cannot see a sell dated before its window.
    await sql`update broker_accounts set reconcile_due_at = now() + interval '30 days' where account_id = ${acc.id}`;
    await sync(25);
    assert.equal(weekReads, 2);
    assert.equal(await close(), undefined, 'the week read missed the late sell');
    // Day 2, a pass is due: one page reads the whole history in place of the week read and finds the close.
    await due();
    await sync(50);
    assert.equal(weekReads, 2, 'the pass page replaced the week read');
    assert.equal(pages, 1);
    const found = await close();
    assert.ok(found, 'the pass found the close');
    assert.equal(found.sell_id, lateSell.externalId);
    assert.ok(Math.abs(found.return_pct - -0.08) < 1e-9, `a loss of 8% (${found.return_pct})`);

    // The trader writes a thesis on the found close.
    const THESIS = 'Sized small ahead of the earnings call; the guide came in weak.';
    await saveThesisFor(u.id, String(found.id), THESIS);
    assert.equal((await close()).thesis_status, 'published');

    // ---- rendered, signed out ----
    const { default: Profile } = await page('app/u/[handle]/page.tsx');
    const { default: TradePage } = await page('app/u/[handle]/trade/[sellId]/page.tsx');
    const { TradeCard } = await page('app/ui.tsx');
    const { renderToStaticMarkup } = await import('react-dom/server' as string) as { renderToStaticMarkup: (e: unknown) => string };
    const { createElement } = await import('react');
    const params = (o: object) => Promise.resolve(o);

    const profileRow = async () => {
      const html = renderToStaticMarkup(await Profile({ params: params({ handle }), searchParams: params({}) }));
      const id = String((await close()).id);
      const start = html.indexOf(`<li id="trade-${id}"`);
      assert.ok(start >= 0, 'the found close is listed on the profile');
      return { html, row: html.slice(start, html.indexOf('</li>', start) + 5) };
    };
    const tradeSection = async () => {
      const html = renderToStaticMarkup(await TradePage({ params: params({ handle, sellId: encodeURIComponent(lateSell.externalId) }) }));
      const start = html.indexOf('aria-labelledby="this-trade"');
      assert.ok(start >= 0, 'the trade page renders the found close');
      // The close's figures and its note section (two sections since #85); the record section between them stays out.
      const noteAt = html.indexOf('aria-labelledby="trade-thesis"');
      assert.ok(noteAt >= 0, 'the trade page renders the note section');
      return { html, section: html.slice(start, html.indexOf('</section>', start)) + html.slice(noteAt, html.indexOf('</section>', noteAt)) };
    };
    const feedCard = async () => {
      clearFeedCache();
      const ranked = await feedCandidates({ ids: [u.id] });
      const c = ranked.find((r) => r.sell_id === lateSell.externalId);
      assert.ok(c, 'the found close is a feed candidate');
      const row = { ...c, id: String(c.id) };
      return { ranked, html: renderToStaticMarkup(createElement(TradeCard, { t: row, state: 'connected' })) };
    };

    {
      const { row } = await profileRow();
      assert.match(text(row), /LOSS/);
      assert.match(text(row), /-8\.0%/);
      assert.doesNotMatch(text(row), FLAGGED, text(row));
      assert.doesNotMatch(row, /class="[^"]*\b(late|corrected|new|found|reissue)\b/i, 'no styling of its own');
      assert.ok(text(row).includes(THESIS), 'the thesis shows on the row');
      const { section } = await tradeSection();
      assert.doesNotMatch(text(section), FLAGGED, text(section));
      assert.doesNotMatch(section, /class="[^"]*\b(late|corrected|new|found|reissue)\b/i);
      assert.ok(text(section).includes(THESIS));
      const { html, ranked } = await feedCard();
      assert.doesNotMatch(text(html), FLAGGED, text(html));
      assert.doesNotMatch(html, /class="[^"]*\b(late|corrected|new|found|reissue)\b/i);
      assert.ok(text(html).includes(THESIS));
      // Losses rank like gains of the same size: the -8% close scores as the +8% one closed at the same instant, and above
      // the +4% one.
      const score = (s: string) => Number(ranked.find((r) => r.symbol === s)!.score);
      assert.ok(Math.abs(score('LOSS') - score('GAIN')) < 1e-9, `${score('LOSS')} vs ${score('GAIN')}`);
      assert.ok(score('LOSS') > score('HALF'));
      const order = ranked.map((r) => r.symbol);
      assert.ok(order.indexOf('LOSS') < order.indexOf('HALF'), order.join(' '));
    }

    // Day 4, a second pass finds an older buy of the same stock: the rebuild re-prices the close (FIFO: 5 at 96 and 5 at
    // 100), the change is counted for the owner, and the thesis stays attached by sell_id.
    const [{ rewritten: before }] = await sql`select closes_rewritten as rewritten from users where id = ${u.id}`;
    vendor = [lateBuy, ...stored, lateSell];
    await due();
    await sync(100);
    assert.equal(pages, 2);
    const repriced = await close();
    assert.equal(repriced.sell_id, lateSell.externalId);
    assert.ok(Math.abs(repriced.return_pct - (92 / 98 - 1)) < 1e-9, `re-priced (${repriced.return_pct})`);
    assert.equal(repriced.thesis, THESIS, 'the thesis survived the rebuild');
    assert.equal(repriced.thesis_status, 'published');
    const [{ rewritten }] = await sql`select closes_rewritten as rewritten from users where id = ${u.id}`;
    assert.equal(rewritten, before + 1, 'the re-priced close is counted for the owner');
    {
      const { row } = await profileRow();
      assert.match(text(row), /-6\.1%/);
      assert.ok(text(row).includes(THESIS));
      assert.doesNotMatch(text(row), FLAGGED);
      const { section } = await tradeSection();
      assert.ok(text(section).includes(THESIS));
      assert.doesNotMatch(text(section), FLAGGED);
      const { html } = await feedCard();
      assert.ok(text(html).includes(THESIS));
      assert.doesNotMatch(text(html), FLAGGED);
    }
  } finally {
    await sql`delete from users where id = ${u.id}`;
    await sql`delete from broker_accounts where account_id = ${acc.id}`;
  }
});
