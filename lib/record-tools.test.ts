// F-3 · Record tools (lib/record-tools.ts) and its copy: owner-only views and notes, the saved order, exact-handle adds,
// limits, the cascade when a trader deletes their account, the export, the figures equal to the profile's, and the
// static rules (no entitlement by symbol or under app/t, no discovery_events, nothing pushed, nothing shareable).
// Fixture data is fictional (POLICY P2).
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MARKS, MINORS, PROMO } from '../scripts/compliance.ts';
import { BILLING, RECORD_TOOLS } from './copy.ts';

const hasDb = !!process.env.DATABASE_URL;
const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL' }, fn);
before(async () => { if (hasDb) await (await import('./db.ts')).sql.unsafe(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')).simple(); });
after(async () => { if (hasDb) await (await import('./db.ts')).sql.end({ timeout: 1 }); });

const root = fileURLToPath(new URL('..', import.meta.url));
const sources = (dir: string): string[] => readdirSync(join(root, dir)).flatMap((f) => {
  const p = join(root, dir, f);
  return statSync(p).isDirectory() ? sources(relative(root, p)) : /\.tsx?$/.test(f) && !/\.test\.ts$/.test(f) ? [relative(root, p)] : [];
});
const read = (f: string) => readFileSync(join(root, f), 'utf8');
const code = (f: string) => read(f).replace(/\/\*[\s\S]*?\*\/|(^|[^:])\/\/.*$/gm, '$1'); // comments stripped

const strings = (v: unknown): string[] => typeof v === 'string' ? [v]
  : typeof v === 'function' ? [String((v as (...a: unknown[]) => unknown)(new Date(Date.UTC(2026, 10, 1)), 'monthly'))]
  : v && typeof v === 'object' ? Object.values(v).flatMap(strings) : [];

test('copy: no advice, promise, ranking, completeness or third-party words; the disclaimer and the binding lines are verbatim', () => {
  const all = [...strings(RECORD_TOOLS), ...strings(BILLING)];
  assert.ok(all.length > 80);
  const MARK_RE = new RegExp(`\\b(${MARKS.map((m) => m.replace(/ /g, '[\\s-]?')).join('|')})\\b`, 'i');
  const MINORS_RE = new RegExp(`\\b(${MINORS.map((m) => m.replace(/ /g, '\\s')).join('|')})\\b`, 'i');
  const BANNED = [/\bbest\b/i, /\btop\b/i, /\bwinners?\b/i, /beat the market/i, /\brecommend/i, /\bguarantee[sd]?\b(?! future results)/i, /\bsignal/i, /\bpicks?\b/i, /\bedge\b/i, /\bskill/i,
    /\bwho to follow\b/i, /every trader/i, /all (of )?(their )?trades/i, /\bany broker/i, /\bbuy\b/i, /\bsell\b/i, /\bhold\b/i, /\badvice\b/i, /\bfind\b/i, /\bunlock/i, /\bonly \d+ left\b/i, /\bhurry\b/i];
  for (const s of all) {
    for (const re of PROMO) assert.doesNotMatch(s, re, s);
    for (const re of BANNED) assert.doesNotMatch(s, re, s);
    assert.doesNotMatch(s, MARK_RE, s);
    assert.doesNotMatch(s, MINORS_RE, s);
  }
  assert.equal(BILLING.refund, 'Cancel within 14 days of your first charge, or of a yearly renewal, for a full refund. Otherwise there are no partial refunds, except for billing errors, a discontinued feature, or where the law requires one.'); // the idea board's refund decision (F-3 feature file, 2026-11-01)
  assert.equal(BILLING.noTrial, 'No free trial. You are charged today.');
  assert.equal(BILLING.agreeMonthly, 'I agree my subscription renews automatically at $9.99 per month plus tax until I cancel.');
  assert.equal(BILLING.agreeAnnual, 'I agree my subscription renews automatically at $99.99 per year plus tax until I cancel.');
  assert.equal(BILLING.subscribeMonthly, 'Subscribe: $9.99/month');
  assert.equal(BILLING.subscribeAnnual, 'Subscribe: $99.99/year');
  assert.equal(BILLING.cancel, 'Cancel subscription');
  assert.equal(BILLING.testMode, 'Test mode, no real charge');
  assert.equal(RECORD_TOOLS.free, 'Trader records stay free to view without a subscription.');
  assert.equal(RECORD_TOOLS.removedNotice, 'A trader in your views or notes deleted their account; they and your note were removed.');
  // Every price says tax is added (AC9); every plan line names the interval.
  for (const s of all.filter((x) => /\$\d/.test(x) && !/^Subscribe:/.test(x))) assert.match(s, /tax/, s);
  assert.match(BILLING.renewMonthly(new Date(Date.UTC(2026, 11, 1))), /next charge is on Dec 1, 2026\./);
});

test('the disclosure text the consent hashes is the Subscribe screen\'s, in order, with the disclaimer; next charge one month or one year on', async () => {
  const { disclosureText, nextCharge, disclosureHash } = await import('./billing.ts');
  const now = new Date(Date.UTC(2026, 0, 31));
  assert.equal(nextCharge('monthly', now).toISOString().slice(0, 10), '2026-03-03'); // UTC month arithmetic, never earlier than a month
  assert.equal(nextCharge('annual', now).toISOString().slice(0, 10), '2027-01-31');
  const t = disclosureText('annual', now);
  for (const line of [BILLING.title, 'Not investment advice. Past performance does not guarantee future results.', BILLING.whatYouGet, BILLING.planAnnual, BILLING.noTrial, BILLING.cancelHow, BILLING.refund, BILLING.card, BILLING.agreeAnnual, BILLING.subscribeAnnual]) assert.ok(t.includes(line), line);
  assert.doesNotMatch(t, /\$9\.99/);
  assert.notEqual(disclosureHash(t), disclosureHash(disclosureText('monthly', now)));
});

let n = 0;
const tag = `rt${process.pid % 100000}`;
async function user(name = 'Test viewer'): Promise<{ id: number; handle: string }> {
  const { sql } = await import('./db.ts');
  const [a] = await sql`insert into signup_attempts (method, adult_attested_at) values ('dev', now()) returning id`;
  const handle = `${tag}_${++n}_${Math.random().toString(36).slice(2, 5)}`.slice(0, 20);
  const [u] = await sql`insert into users (handle, display_name, adult_attested_at, signup_attempt_id) values (${handle}, ${name}, now(), ${a.id}) returning id, handle`;
  return { id: u.id as number, handle: u.handle as string };
}

dbTest('views: random owner-only ids, default names, the 20-view limit under concurrency, rename and delete only by the owner, the same null for missing and foreign', async () => {
  const rt = await import('./record-tools.ts');
  const me = await user(), other = await user();
  const v = await rt.createView(me.id, '');
  assert.ok(v.ok);
  assert.match(v.id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/, 'a random (v4) id, never sequential');
  assert.equal((await rt.getView(me.id, v.id))!.name, 'View 1');
  assert.equal(await rt.getView(other.id, v.id), null);
  assert.equal(await rt.getView(me.id, '00000000-0000-4000-8000-000000000000'), null);
  assert.equal(await rt.getView(me.id, "1' or '1'='1"), null);
  assert.equal(await rt.renameView(other.id, v.id, 'Taken'), false);
  assert.equal(await rt.deleteView(other.id, v.id), false);
  assert.equal(await rt.renameView(me.id, v.id, '  Mine\u0000 '), true);
  assert.equal((await rt.getView(me.id, v.id))!.name, 'Mine');
  assert.equal(await rt.renameView(me.id, v.id, '   '), false);
  const many = await Promise.all(Array.from({ length: 30 }, (_, i) => rt.createView(me.id, `v${i}`)));
  assert.equal(many.filter((r) => r.ok).length, rt.MAX_VIEWS - 1);
  assert.equal((await rt.listViews(me.id)).length, rt.MAX_VIEWS);
  assert.deepEqual(await rt.createView(me.id, 'one more'), { ok: false, reason: 'limit' });
  assert.equal(await rt.deleteView(me.id, v.id), true);
  assert.equal((await rt.listViews(other.id)).length, 0);
});

dbTest('adding traders: exact handle only (no search), unknown, duplicate and the 4-trader limit; the order is the owner\'s, moves swap neighbours, removal keeps the note', async () => {
  const rt = await import('./record-tools.ts');
  const me = await user();
  const ts = await Promise.all([user('A'), user('B'), user('C'), user('D'), user('E')]);
  const v = await rt.createView(me.id, 'Compare');
  assert.ok(v.ok);
  assert.deepEqual(await rt.addTrader(me.id, v.id, ts[0].handle.slice(0, -1)), { ok: false, reason: 'unknown' }, 'a prefix finds no one');
  assert.deepEqual(await rt.addTrader(me.id, v.id, '%'), { ok: false, reason: 'unknown' });
  // Added in this order: C, A, D, B. Never re-sorted by name, id or any number.
  for (const [i, t] of [ts[2], ts[0], ts[3], ts[1]].entries()) assert.deepEqual(await rt.addTrader(me.id, v.id, i === 1 ? `@${t.handle.toUpperCase()}` : t.handle), { ok: true, position: i + 1, count: i + 1 });
  assert.deepEqual(await rt.addTrader(me.id, v.id, ts[0].handle), { ok: false, reason: 'duplicate' });
  assert.deepEqual(await rt.addTrader(me.id, v.id, ts[4].handle), { ok: false, reason: 'full' });
  const order = async () => (await rt.getView(me.id, v.id))!.traders.map((t) => t.id);
  assert.deepEqual(await order(), [ts[2].id, ts[0].id, ts[3].id, ts[1].id]);
  assert.deepEqual(await rt.moveTrader(me.id, v.id, ts[3].id, 'up'), { position: 2, count: 4 });
  assert.deepEqual(await order(), [ts[2].id, ts[3].id, ts[0].id, ts[1].id]);
  assert.deepEqual(await rt.moveTrader(me.id, v.id, ts[2].id, 'up'), { position: 1, count: 4 }, 'the first stays first');
  assert.equal(await rt.moveTrader((await user()).id, v.id, ts[2].id, 'down'), null, 'not the owner');
  await rt.saveNote(me.id, ts[0].id, 'kept');
  assert.equal(await rt.removeTrader(me.id, v.id, ts[0].id), true);
  assert.deepEqual(await order(), [ts[2].id, ts[3].id, ts[1].id]);
  assert.equal((await rt.listNotes(me.id)).length, 1);
  // Positions are derived from the order: a gap left by a removal is never shown.
  const cards = await rt.compareCards((await rt.getView(me.id, v.id))!.traders);
  assert.deepEqual(cards.map((c) => c.id), [ts[2].id, ts[3].id, ts[1].id], 'cards keep the saved order');
});

dbTest('notes: 2,000 characters enforced on the server, never about oneself, empty deletes, owner-only, keyed by trader id so a reissued handle never inherits a note', async () => {
  const rt = await import('./record-tools.ts');
  const { sql } = await import('./db.ts');
  const me = await user(), t = await user(), other = await user();
  assert.equal(await rt.saveNote(me.id, t.id, 'about an account in none of my views'), 'unknown', 'never about an arbitrary account id');
  const v = await rt.createView(me.id, 'n'); assert.ok(v.ok);
  await rt.addTrader(me.id, v.id, t.handle);
  assert.equal(await rt.saveNote(me.id, t.id, 'x'.repeat(2001)), 'too_long');
  assert.equal(await rt.saveNote(me.id, t.id, '😀'.repeat(2000)), 'saved', 'characters, not bytes');
  assert.equal(await rt.saveNote(me.id, me.id, 'self'), 'self');
  assert.equal(await rt.saveNote(me.id, 999999999, 'gone'), 'unknown');
  assert.equal(await rt.saveNote(me.id, t.id, '<script>alert(1)</script>\r\nline'), 'saved');
  assert.equal((await rt.listNotes(me.id))[0].body, '<script>alert(1)</script>\nline', 'stored as text; React escapes it on render');
  assert.equal((await rt.listNotes(other.id)).length, 0);
  assert.equal(await rt.deleteNote(other.id, t.id), false);
  assert.equal(await rt.saveNote(me.id, t.id, '   '), 'deleted');
  assert.equal((await rt.listNotes(me.id)).length, 0);
  await rt.saveNote(me.id, t.id, 'about the old account');
  await assert.rejects(sql`insert into record_notes (owner_id, trader_id, body) values (${me.id}, ${t.id}, ${'y'.repeat(2001)}) on conflict (owner_id, trader_id) do update set body = excluded.body`, /check/);
  const [cols] = await sql`select string_agg(column_name, ',' order by column_name) as c from information_schema.columns where table_name = 'record_notes'`;
  assert.equal(cols.c, 'body,owner_id,trader_id,updated_at', 'keyed by trader id; no handle column');
});

dbTest('a trader deletes their account: notes about them and their view entries go, each affected subscriber sees one line once, naming no one; the deleter\'s own views and notes go', async () => {
  const rt = await import('./record-tools.ts');
  const { deleteProfile } = await import('./delete.ts');
  const { sql } = await import('./db.ts');
  const a = await user(), b = await user(), t = await user(), keep = await user();
  const va = await rt.createView(a.id, 'A'); assert.ok(va.ok);
  await rt.addTrader(a.id, va.id, t.handle); await rt.addTrader(a.id, va.id, keep.handle);
  const vb = await rt.createView(b.id, 'B'); assert.ok(vb.ok);
  await rt.addTrader(b.id, vb.id, t.handle); await rt.addTrader(b.id, vb.id, keep.handle);
  await rt.saveNote(b.id, t.id, 'note about t');
  await rt.saveNote(b.id, keep.id, 'note about keep');
  await rt.removeTrader(b.id, vb.id, t.id); // b's note about t stays after t leaves b's view; t's deletion removes it
  const vt = await rt.createView(t.id, 'T own'); assert.ok(vt.ok);
  await rt.addTrader(t.id, vt.id, keep.handle);
  assert.equal(await rt.saveNote(t.id, keep.id, 't wrote this'), 'saved');
  await deleteProfile({ id: t.id, handle: t.handle, snaptrade_user_id: null, snaptrade_secret_enc: null }, { deleteVendorUser: async () => {}, endBilling: async () => {} });
  assert.deepEqual((await rt.getView(a.id, va.id))!.traders.map((x) => x.id), [keep.id]);
  assert.deepEqual((await rt.listNotes(b.id)).map((x) => x.traderId), [keep.id]);
  assert.equal((await sql`select count(*)::int as n from record_views where owner_id = ${t.id}`)[0].n, 0);
  assert.equal((await sql`select count(*)::int as n from record_notes where owner_id = ${t.id} or trader_id = ${t.id}`)[0].n, 0);
  for (const s of [a, b]) {
    assert.equal(await rt.removedNotice(s.id), true);
    assert.equal(await rt.removedNotice(s.id), true, 'reading never clears it');
    await rt.dismissRemovedNotice(s.id);
    assert.equal(await rt.removedNotice(s.id), false, 'gone once dismissed');
  }
  assert.equal(await rt.removedNotice(keep.id), false);
  const [cols] = await sql`select string_agg(column_name, ',' order by column_name) as c from information_schema.columns where table_name = 'record_tool_notices'`;
  assert.equal(cols.c, 'owner_id,removed', 'no trader id kept');
});

dbTest('the figures on a card are the profile\'s: the same functions over the same rows, losses as signed text; no open positions, no cross-trader figure', async () => {
  const rt = await import('./record-tools.ts');
  const { sql } = await import('./db.ts');
  const { confidence, evidenceLine, pct, rangeText, stats } = await import('./trades.ts');
  // Own fixture (CI review): three traders with unverified (demo) closes, gains and losses, so no other test file's rows
  // can change what is compared. 12 closes each over different stocks: enough bets for a range.
  const demos: { id: number; handle: string; display_name: string }[] = [];
  for (let k = 0; k < 3; k++) {
    const t = await user(`Fixture ${k}`);
    demos.push({ id: t.id, handle: t.handle, display_name: `Fixture ${k}` });
    for (let j = 0; j < 12; j++) {
      const opened = new Date(Date.UTC(2026, 0, 1 + j * 7)), closed = new Date(opened.getTime() + (2 + j) * 86_400_000);
      const r = ((j * 37 + k * 11) % 21 - 9) / 100; // -9% to +11%, losses included
      await sql`insert into closed_trades (user_id, sell_id, account_id, symbol, opened_at, closed_at, return_pct, holding_days, verified)
        values (${t.id}, ${`${t.handle}-s${j}`}, ${`${t.handle}-a`}, ${`S${j}`}, ${opened}, ${closed}, ${r}, ${2 + j}, false)`;
    }
  }
  const cards = await rt.compareCards(demos.map((d) => ({ id: d.id as number, handle: d.handle as string, name: d.display_name as string })));
  for (const [i, d] of demos.entries()) {
    const trades = await sql`select symbol, return_pct, holding_days, opened_at, closed_at from closed_trades where user_id = ${d.id}`;
    const c = confidence(trades.map((x) => ({ symbol: x.symbol, openedAt: x.opened_at, closedAt: x.closed_at, returnPct: x.return_pct, holdingDays: x.holding_days })), new Date());
    const s = stats(trades.map((x) => ({ returnPct: x.return_pct, holdingDays: x.holding_days, closedAt: x.closed_at })));
    const card = cards[i];
    assert.equal(card.handle, d.handle);
    assert.equal(card.badge, 'demo');
    assert.equal(card.connected, 'Demo data');
    assert.equal(card.closed, trades.length);
    assert.deepEqual(card.figures, { winRate: `${(s.winRate * 100).toFixed(0)}%`, avg: pct(s.avgReturn), avgSign: s.avgReturn > 0 ? 'up' : 'down', range: rangeText(c), low: c.perTrade ? pct(c.perTrade.low) : null, evidence: evidenceLine(c), drawdown: pct(-s.maxDrawdown) });
    if (card.figures!.low) assert.ok(card.figures!.range!.includes(card.figures!.low), 'the lower end is the range\'s own low');
  }
  const keys = Object.keys(cards[0]).sort().join(',');
  assert.equal(keys, 'badge,closed,connected,excluded,figures,handle,id,isNew,name,since,state');
  assert.doesNotMatch(JSON.stringify(cards), /open_position|positions"|symbol|unrealized|rank|score|best|delta|diff/i);
});

dbTest('export: exactly the disclaimer, views, notes and subscription; no figures; a trader\'s export never includes others\' notes about them', async () => {
  const rt = await import('./record-tools.ts');
  const me = await user(), t = await user();
  const v = await rt.createView(me.id, 'Exported'); assert.ok(v.ok);
  await rt.addTrader(me.id, v.id, t.handle);
  await rt.saveNote(me.id, t.id, 'private');
  const e = await rt.exportFor(me.id);
  assert.deepEqual(Object.keys(e).sort(), ['disclaimer', 'notes', 'subscription', 'views']);
  assert.equal(e.disclaimer, 'Not investment advice. Past performance does not guarantee future results.');
  assert.deepEqual(e.views.map((x) => ({ ...x, createdAt: typeof x.createdAt, updatedAt: typeof x.updatedAt })), [{ name: 'Exported', traders: [t.handle], createdAt: 'string', updatedAt: 'string' }]);
  assert.deepEqual(e.notes.map((x) => Object.keys(x).sort()), [['text', 'trader', 'updatedAt']]);
  assert.equal(e.subscription, null);
  assert.doesNotMatch(JSON.stringify(e), /%|return|win|range|drawdown/i);
  const theirs = await rt.exportFor(t.id);
  assert.deepEqual(theirs.notes, []);
  assert.deepEqual(theirs.views, []);
});

test('static rules: no entitlement under app/t or keyed by a symbol; Record tools writes no discovery_events, sends nothing, offers no share; notes are read only by Record tools, deletion and export', () => {
  for (const f of sources('app/t')) assert.doesNotMatch(read(f), /lib\/billing|entitled\(|access\(/, f);
  const billingUsers = [...sources('app'), ...sources('lib')].filter((f) => /from ['"][^'"]*\/billing\.ts['"]/.test(read(f)));
  assert.deepEqual(billingUsers.sort(), ['app/account/actions.ts', 'app/account/page.tsx', 'app/api/billing/reconcile/route.ts', 'app/api/billing/webhook/route.ts', 'app/api/sync/route.ts', 'app/connect/actions.ts', 'app/settings/page.tsx', 'app/tools/actions.ts', 'app/tools/page.tsx', 'app/tools/parts.tsx', 'app/tools/signin/route.ts', 'lib/delete.ts', 'lib/record-tools.ts']);
  assert.doesNotMatch(read('lib/billing.ts'), /symbol/);
  const tools = [...sources('app/tools'), ...sources('app/account'), 'lib/record-tools.ts', 'lib/billing.ts'];
  for (const f of tools) {
    const src = code(f);
    assert.doesNotMatch(src, /discovery_events|recordGesture|recordFunnel|funnel_events/, f);
    assert.doesNotMatch(src, /sendMail|AUTH_EMAIL_SEND|issueLink|Notification|webpush|pushManager/i, f);
    assert.doesNotMatch(src, /share-button|ShareCard|opengraph|navigator\.share|clipboard/i, f);
    assert.doesNotMatch(src, /\.sort\(\(a, b\) => [^)]*(return|winRate|avg|low|weight|score)/, f);
  }
  const noteReaders = [...sources('app'), ...sources('lib')].filter((f) => [...read(f).matchAll(/(?:sql|tx)`[^`]*`/g)].some((m) => /record_notes/.test(m[0])));
  assert.deepEqual(noteReaders.sort(), ['lib/delete.ts', 'lib/record-tools.ts']);
  for (const f of [...sources('lib/discovery'), 'lib/feed.ts', 'lib/similar.ts', 'lib/follows.ts']) assert.doesNotMatch(read(f), /record-tools|record_notes|record_views|billing/, f);
  // Not in the sitemap or the robots allow-list; the pages are noindex with no referrer.
  for (const f of ['app/sitemap.ts', 'app/robots.ts']) assert.doesNotMatch(read(f), /\/tools|\/account/, f);
  for (const f of ['app/tools/page.tsx', 'app/account/page.tsx']) assert.match(read(f), /robots: \{ index: false, follow: false \}, referrer: 'no-referrer'/, f);
  assert.match(read('next.config.ts'), /'\/tools', '\/account', '\/account\/:path\*'/);
  // Follow and watchlist limits are the same for every viewer: neither module reads billing.
  for (const f of sources('lib').filter((x) => /follow|ticker/.test(x))) assert.doesNotMatch(read(f), /billing|entitled/, f);
  // No public surface names a price or plan (profiles, trade and stock pages, the feed, share cards, connect, settings).
  for (const f of [...sources('app/u'), ...sources('app/t'), ...sources('app/connect'), 'app/page.tsx', 'app/settings/page.tsx', 'app/layout.tsx']) assert.doesNotMatch(read(f), /\$\d|BILLING\.(plan|subscribe|renew|agree|what)/, f);
});

dbTest('concurrent adds never put a fifth trader in a view (engineer E7)', async () => {
  const rt = await import('./record-tools.ts');
  const me = await user();
  const ts = await Promise.all(Array.from({ length: 8 }, () => user()));
  const v = await rt.createView(me.id, 'race'); assert.ok(v.ok);
  const r = await Promise.all(ts.map((t) => rt.addTrader(me.id, v.id, t.handle)));
  assert.equal(r.filter((x) => x.ok).length, 4);
  const view = (await rt.getView(me.id, v.id))!;
  assert.equal(view.traders.length, 4);
});
