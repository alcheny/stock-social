// F-26 (docs/features/F-26-no-empty-note-line.md): no empty-note line, and a held note looks like no note to everyone
// but its author. Render tests on app/ui.tsx#TradeCard (react-dom/server; the module hook is lib/f10-feed-card.test.ts's:
// .tsx through Next's own SWC binding, `@/` to the repo root, next/link as a plain <a>), source tests on the surfaces
// that must not branch on who is asking, and the report answers. The database cases are lib/f26-held-like-none.db.test.ts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { createRequire, registerHooks } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = new URL('..', import.meta.url);
const require = createRequire(import.meta.url);
const swc = require('next/dist/build/swc') as { loadBindings: () => Promise<unknown>; transformSync: (src: string, o: object) => { code: string } };
await swc.loadBindings();
const LINK = `data:text/javascript,${encodeURIComponent("import { createElement } from 'react'; export default function Link({ href, children, prefetch: _p, ...rest }) { return createElement('a', { href, ...rest }, children); }")}`;
registerHooks({
  resolve(spec, ctx, next) {
    if (spec === 'next/link') return { url: LINK, shortCircuit: true };
    if (spec.startsWith('@/')) return next(new URL(spec.slice(2), ROOT).href, ctx);
    if (ctx.parentURL?.startsWith('data:')) return next(spec, { ...ctx, parentURL: import.meta.url });
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

const { renderToStaticMarkup } = await import('react-dom/server' as string) as { renderToStaticMarkup: (e: unknown) => string };
const { createElement } = await import('react');
const { TradeCard } = await import(pathToFileURL(new URL('app/ui.tsx', ROOT).pathname).href) as typeof import('../app/ui.tsx');
const { heldLine, KEPT_RULE, RULE_EXPLAIN } = await import('./report-copy.ts');
const { HeldNote } = await import('./user-note.ts');
const { REPORT_COPY, reportMessage } = await import('./reports.ts');
const { selectTheses } = await import('./ticker.ts');

type Row = import('../app/ui.tsx').TradeRow;
const base: Row = { id: '7', symbol: 'ACME', return_pct: -0.052, holding_days: 3.4, closed_at: new Date(Date.UTC(2026, 9, 30)), verified: true,
  thesis: null, thesis_status: null, handle: 'f26_card', display_name: 'F26 Card', user_id: 1 };
const now = new Date(Date.UTC(2026, 10, 1));
const card = (t: Partial<Row>, more: Record<string, unknown> = {}) => renderToStaticMarkup(createElement(TradeCard, { t: { ...base, ...t }, state: 'connected', now, ...more }));
// What sits between the hero and the footer: the note slot (and the open-positions line, absent here).
// The hero (no strip here) ends with its last line's </div> and its own: the first '</div></div>' after it opens.
const slot = (html: string) => html.slice(html.indexOf('</div></div>', html.indexOf('<div class="hero">')) + 12, html.indexOf('<footer'));
const RULES = [...Object.keys(RULE_EXPLAIN), 'reports', KEPT_RULE, 'unknown-rule', null];
const NOTE = 'Bought the base retest, stop under the low.';
// Code only: line comments removed (so a comment may name what the code must not do).
const code = (p: string) => readFileSync(new URL(p, ROOT), 'utf8').replace(/(^|\s)\/\/[^\n]*/g, '$1').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const ABSENCE = ['No thesis', 'posted.'].join(' ');

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
  });
}

test('F-26 AC1: the empty-note line appears nowhere in app/ or lib/', () => {
  const hits = ['app', 'lib'].flatMap((d) => files(fileURLToPath(new URL(d, ROOT)))).filter((f) => readFileSync(f, 'utf8').includes(ABSENCE));
  assert.deepEqual(hits, []);
});

test('F-26 AC2: for a viewer the card is the same for no note, a held note (every rule) and every other unpublished status; the slot is empty', () => {
  const none = card({});
  assert.equal(slot(none), '', 'no element in the note slot');
  for (const rule of RULES) {
    // The feed nulls the text and status in SQL (lib/feed.ts); the card must not show a held note even if handed one.
    assert.equal(card({ thesis: NOTE, thesis_status: 'held' }), none, `held (${rule})`);
    assert.equal(card({ thesis: null, thesis_status: null }, { ownHeld: null }), none);
  }
  for (const st of ['held', 'pending', 'rejected', 'draft', '', 'PUBLISHED']) assert.equal(card({ thesis: NOTE, thesis_status: st }), none, st);
  assert.equal(card({ thesis: '', thesis_status: 'published' }), none, 'an empty published text is no note');
});

test('F-26 AC3: a published note renders UserNote; a public filer card keeps its own card line', () => {
  const html = card({ thesis: NOTE, thesis_status: 'published', thesis_written_at: new Date(Date.UTC(2026, 9, 30)) });
  assert.match(slot(html), /^<figure class="user-note"/);
  assert.match(slot(html), /<blockquote class="user-note-text thesis">“<bdi>Bought the base retest, stop under the low\.<\/bdi>”<\/blockquote>/);
  const pub = renderToStaticMarkup(createElement(TradeCard, { t: base, state: 'public', now }));
  assert.match(slot(pub), /^<p class="thesis muted" data-public-card="true">/);
  // A held note never shows on a public card either (filers post none).
  assert.equal(renderToStaticMarkup(createElement(TradeCard, { t: { ...base, thesis: NOTE, thesis_status: 'held' }, state: 'public', now })), pub);
});

test('F-26 AC4: the author\'s own held card shows heldLine(rule) in the note slot, in .thesis-held, never the loss or warn colour', () => {
  for (const rule of RULES) {
    const html = card({}, { ownHeld: heldLine(rule) });
    const s = slot(html);
    const p = s.match(/^<p class="([^"]*)"[^>]*>([^<]*)<\/p>$/);
    assert.ok(p, s);
    assert.ok(p[1].split(' ').includes('thesis-held'), p[1]);
    for (const bad of ['down', 'up', 'warn', 'loss', 'record-failed']) assert.ok(!p[1].split(' ').includes(bad), `${bad} in ${p[1]}`);
    assert.equal(p[2].replace(/&#x27;/g, "'"), heldLine(rule));
    assert.match(p[2], /^Thesis held for review\./); // DS: always begins with "Thesis" (never the holding period's "held")
  }
  // A published note wins over a stale held line (the author sees what everyone sees).
  assert.match(slot(card({ thesis: NOTE, thesis_status: 'published' }, { ownHeld: heldLine('link') })), /^<figure class="user-note"/);
  // A public filer's card never carries one.
  assert.doesNotMatch(renderToStaticMarkup(createElement(TradeCard, { t: base, state: 'public', now, ownHeld: heldLine('link') })), /thesis-held/);
});

test('F-26 AC (F-13): with the first-visit line on card 1 and no published note, the slot holds only the first-visit line', () => {
  const notice = createElement('p', { className: 'first-visit' }, 'First visit line');
  for (const t of [{}, { thesis: NOTE, thesis_status: 'held' }]) {
    assert.equal(slot(card(t, { notice })), '<div class="fv-slot"><p class="first-visit">First visit line</p></div>');
  }
  // With a published note, the first-visit line and the note share the slot (unchanged).
  assert.match(slot(card({ thesis: NOTE, thesis_status: 'published' }, { notice })), /^<div class="fv-slot"><p class="first-visit">First visit line<\/p><figure class="user-note"/);
});

test('F-26: HeldNote is heldLine(rule) in .thesis-held, with the profile link only when given', () => {
  const plain = renderToStaticMarkup(createElement(HeldNote, { rule: 'link' }));
  assert.equal(plain.replace(/&#x27;/g, "'"), `<p class="muted thesis-held" data-own-held="">${heldLine('link')}</p>`);
  // Business lead (Q-A): the link sits on its own line below the held line, a 44 px target, in the same slot.
  const linked = renderToStaticMarkup(createElement(HeldNote, { rule: 'reports', edit: '/u/a_b?closes=100#trade-9' }));
  assert.equal(linked.replace(/&#x27;/g, "'"), `<p class="muted thesis-held" data-own-held="">${heldLine('reports')}</p><p class="held-edit"><a class="tap44" href="/u/a_b?closes=100#trade-9">Edit it on your profile</a></p>`);
});

test('F-26: the stock page\'s notes list is published notes only, the same for held and none', () => {
  const r = { id: 1, sellId: 's', handle: 'h', returnPct: 0.1, holdingDays: 2, closedAt: new Date(0), verified: true };
  assert.deepEqual(selectTheses([{ ...r, thesis: NOTE, thesisStatus: 'held' }]), selectTheses([{ ...r, thesis: null, thesisStatus: null }]));
  assert.equal(selectTheses([{ ...r, thesis: NOTE, thesisStatus: 'held' }]).n, 0);
  assert.deepEqual(selectTheses([{ ...r, thesis: NOTE, thesisStatus: 'held' }]).items, []);
  const sql = code('app/t/[symbol]/page.tsx');
  assert.match(sql, /t\.thesis_status = 'published' and t\.thesis is not null/);
});

test('F-26 AC (report): the confirmation is one string below and at the hold threshold, and for a held or removed note', () => {
  assert.equal(reportMessage('held'), REPORT_COPY.done);
  assert.equal(reportMessage('reported'), REPORT_COPY.done);
  // lib/reports.ts answers 'not-found' both for a note its author removed and for one already held.
  assert.equal(reportMessage('not-found'), reportMessage('reported'));
});

test('F-26 AC (metadata and image): the trade page\'s generateMetadata and its opengraph-image read no session and select no hold field', () => {
  const page = code('app/u/[handle]/trade/[sellId]/page.tsx');
  const meta = page.slice(page.indexOf('export async function generateMetadata'), page.indexOf('export default async function'));
  assert.ok(meta.length > 100, 'generateMetadata found');
  assert.doesNotMatch(meta, /currentUser|viewerId|cookies\(|headers\(|loadOwnNote|thesis_status|hold_rule|heldLine/);
  const img = code('app/u/[handle]/trade/[sellId]/opengraph-image.tsx');
  assert.doesNotMatch(img, /lib\/session|lib\/viewer|next\/headers|own-note|thesis_status|hold_rule|heldLine/);
  // The shared loader nulls every note field unless published and never reads the hold rule or the author loader.
  const share = code('lib/trade-share-load.ts');
  assert.doesNotMatch(share, /thesis_hold_rule|own-note|loadOwnNote|lib\/session/);
  for (const col of ['thesis', 'thesis_written_at', 'thesis_edited_at']) assert.match(share, new RegExp(`case when ct\\.thesis_status = 'published' then ct\\.${col} end as ${col}`));
  assert.doesNotMatch(share.replace(/case when ct\.thesis_status = 'published'/g, ''), /thesis_status/);
  // Only the page body reads the session, and the author loader runs only for the author.
  const body = page.slice(page.indexOf('export default async function'));
  assert.match(body, /const me = await currentUser\(\)/);
  assert.match(body, /me && me\.handle === t\.handle \? await loadOwnNote\(me\.id, /);
});

test('F-26: share and record images and the public JSON routes never import the held line', () => {
  for (const f of ['app/u/[handle]/opengraph-image.tsx', 'app/u/[handle]/story/route.tsx', 'app/u/[handle]/pane/route.ts', 'app/u/[handle]/pane-chart/route.ts',
    'app/u/[handle]/trade/[sellId]/opengraph-image.tsx', 'app/u/[handle]/month/[ym]/page.tsx', 'lib/recap-load.ts']) {
    assert.doesNotMatch(code(f), /heldLine|HeldNote|thesis_hold_rule|own-note/, f);
  }
  // The pane routes send published text only.
  assert.match(code('app/u/[handle]/pane-chart/route.ts'), /case when thesis_status = 'published' then thesis end as thesis/);
  assert.match(code('lib/feed.ts'), /to_json\(case when thesis_status = 'published' then thesis end\)/);
});

test('F-26: the feed\'s two statements that select a note null it unless published; the hold rule only for the signed-in author', () => {
  const f = code('lib/feed.ts');
  const raw = f.match(/\bt\.thesis, t\.thesis_status\b/g); // top.* reads c, which is already nulled
  assert.equal(raw, null, 'no raw thesis/thesis_status select');
  assert.equal((f.match(/case when t\.thesis_status = 'published' then t\.thesis end as thesis, case when t\.thesis_status = 'published' then t\.thesis_status end as thesis_status/g) ?? []).length, 2);
  assert.match(f, /case when t\.thesis_status = 'published' then t\.thesis_written_at end as thesis_written_at/);
  assert.match(f, /case when t\.user_id = \$\{own\} and t\.thesis_status = 'held' and t\.thesis is not null then t\.thesis_hold_rule end as own_hold_rule/);
  // The feed rows set the author's line from the existing viewer check only.
  const rows = code('app/feed-rows.tsx');
  assert.match(rows, /ownHeld=\{page\.viewer && page\.viewer\.id === t\.user_id && t\.own_held \? heldLine\(t\.own_hold_rule\) : undefined\}/);
});

test('F-26: the profile renders a held note to its author only, and its load runs the same statements whatever the note\'s state', () => {
  const p = code('app/u/[handle]/page.tsx');
  // Every use of thesis_status in the profile is a render condition, never a query branch.
  const uses = p.split('\n').filter((l) => /thesis_status/.test(l) && !/^\s*select |thesis_written_at, thesis_edited_at, thesis_hold_rule/.test(l));
  for (const l of uses) assert.doesNotMatch(l, /await|sql`/, l);
  assert.match(p, /isMe && t\.thesis_status === 'held' &&/);
});
