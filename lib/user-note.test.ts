// fix-user-text B (F-9): every thesis renders through one UserNote: <bdi> around the trader's text, an attribution line,
// a written/edited date line only for recorded dates, never larger than the verified figure. The profile row, feed card,
// pane (chart sheet), trade page and /t/[symbol] all use it, and none renders thesis text any other way.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement, type ReactElement } from 'react';
import { noteDateLine, UserNote } from './user-note.ts';

// react-dom ships no types here (no @types/react-dom; no new dependency): the one function used, typed by hand.
const { renderToStaticMarkup } = (await import('react-dom/server' as string)) as { renderToStaticMarkup: (e: ReactElement) => string };

const render = (p: Parameters<typeof UserNote>[0]) => renderToStaticMarkup(createElement(UserNote, p));
const read = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8');

test('markup: <bdi> around the text, quotes outside it, attribution, escaped text', () => {
  const html = render({ text: 'Breakout <b>on</b> volume', handle: 'trader_one' });
  assert.equal(html, '<figure class="user-note" data-user-note=""><blockquote class="user-note-text">“<bdi>Breakout &lt;b&gt;on&lt;/b&gt; volume</bdi>”</blockquote><figcaption class="user-note-by muted">Note by @trader_one</figcaption></figure>');
});

test('dates: shown only when recorded, never invented', () => {
  const w = new Date('2026-10-05T15:00:00Z'), e = new Date('2026-10-07T01:00:00Z');
  assert.equal(noteDateLine(null, null), null);
  assert.equal(noteDateLine(undefined, undefined), null);
  assert.equal(noteDateLine(w, null), 'Written Oct 5, 2026, after the trade closed');
  assert.equal(noteDateLine(w, e), 'Written Oct 5, 2026, after the trade closed · edited Oct 7, 2026');
  assert.equal(noteDateLine(null, e), 'Edited Oct 7, 2026, after the trade closed');
  assert.equal(noteDateLine('not a date', null), null);
  assert.match(render({ text: 'x', handle: 'h', writtenAt: w, editedAt: e }), /Note by @h · Written Oct 5, 2026, after the trade closed · edited Oct 7, 2026<\/figcaption>/);
  assert.doesNotMatch(render({ text: 'x', handle: 'h' }), /Written|Edited|edited/);
  // Fix round 3: an edit on the same calendar day (UTC) as the writing adds nothing to the line.
  assert.equal(noteDateLine(w, new Date('2026-10-05T23:59:00Z')), 'Written Oct 5, 2026, after the trade closed');
  assert.equal(noteDateLine(w, new Date('2026-10-06T00:00:00Z')), 'Written Oct 5, 2026, after the trade closed · edited Oct 6, 2026');
  // The JSON form a client component receives (an ISO string) reads the same.
  assert.equal(noteDateLine(w.toISOString(), null), noteDateLine(w, null));
});

test('right-to-left text cannot reorder the attribution: it stays inside <bdi>', () => {
  const html = render({ text: 'שלום עולם 12%', handle: 'h' });
  assert.match(html, /<bdi>שלום עולם 12%<\/bdi>”<\/blockquote><figcaption/);
});

test('the report slot renders only when given', () => {
  assert.doesNotMatch(render({ text: 'x', handle: 'h' }), /<form|<button/);
  // The caption is the figure's last child (fix round 1): the control sits at its end, never after it.
  assert.match(render({ text: 'x', handle: 'h', report: createElement('button', null, 'Report') }), /Note by @h<button>Report<\/button><\/figcaption><\/figure>$/);
  for (const html of [render({ text: 'x', handle: 'h' }), render({ text: 'x', handle: 'h', report: createElement('button', null, 'Report') })]) {
    const inner = html.replace(/^<figure[^>]*>|<\/figure>$/g, '');
    assert.match(inner, /^<blockquote[\s\S]*<\/blockquote><figcaption[\s\S]*<\/figcaption>$/, 'blockquote then the caption, nothing after it');
  }
});

test('never larger than the verified figure: the note is body size or smaller, set only in the UserNote CSS block', () => {
  const css = read('../app/globals.css');
  // The block runs to its end marker (later features append their own blocks after it).
  const start = css.indexOf('/* fix-user-text: UserNote');
  const end = css.indexOf('/* end fix-user-text: UserNote */', start);
  assert.ok(start >= 0 && end > start, 'the UserNote block has its end marker');
  const block = css.slice(start, end);
  assert.ok(block.length > 50);
  for (const m of block.matchAll(/font-size:\s*([^;]+);/g)) {
    const v = m[1].trim();
    const px = v.endsWith('rem') ? parseFloat(v) * 16 : parseFloat(v);
    assert.ok(/^\d+(\.\d+)?(px|rem)$/.test(v) && px <= 16, `font-size ${v} is larger than body text`);
  }
  assert.match(block, /\.user-note-text \{[^}]*font-size: 1rem/);
  const src = read('./user-note.ts');
  assert.doesNotMatch(src, /fontSize|style:/);
});

test('every thesis surface renders through UserNote and nowhere else prints thesis text', () => {
  const surfaces: Record<string, RegExp> = {
    '../app/u/[handle]/page.tsx': /<UserNote text=\{t\.thesis\}/,
    '../app/u/[handle]/trade/[sellId]/page.tsx': /<UserNote text=\{t\.thesis\}/,
    '../app/t/[symbol]/Theses.tsx': /<UserNote text=\{r\.thesis\}/,
    '../app/ui.tsx': /<UserNote text=\{t\.thesis\}/,
    '../app/u/[handle]/chart.tsx': /<UserNote text=\{chosen\.thesis\}/,
  };
  for (const [f, re] of Object.entries(surfaces)) {
    const s = read(f);
    assert.match(s, re, f);
    assert.match(s, /F-9: UserNote/, `${f} marks the swap`);
    // No raw render of the text: `{x.thesis}` only as the UserNote prop.
    const raw = [...s.matchAll(/\{[a-z]+\.thesis\}/g)].filter((m) => !/text=$/.test(s.slice(Math.max(0, m.index! - 5), m.index)));
    assert.deepEqual(raw.map((m) => m[0]), [], `${f} renders thesis text outside UserNote`);
    assert.doesNotMatch(s, /“\$?\{[a-z]+\.thesis\}”|`“\$\{t\.thesis\}”`/, f);
  }
  // The pane's thesis is the chart sheet's, attributed to the pane's trader.
  assert.match(read('../app/pane.tsx'), /noteBy=\{handle\}/);
  // The Report control: accessible name, a polite live region, and only for a signed-in reader who is not the author.
  const island = read('../app/report-note.tsx');
  assert.match(island, /^'use client';/);
  assert.match(island, /aria-label=/);
  assert.match(island, /aria-live="polite"/);
  assert.match(read('../app/u/[handle]/page.tsx'), /reportId=\{me && !isMe \?/);
  assert.match(read('../app/u/[handle]/trade/[sellId]/page.tsx'), /reportId=\{me && me\.handle !== t\.handle \?/);
  // F-7 merge: never on a public filer's card.
  assert.match(read('../app/feed-rows.tsx'), /report=\{page\.viewer && page\.viewer\.id !== t\.user_id && !isPublicRecord\(page\.records\.get\(t\.user_id\)\?\.state \?\? 'none'\) \? <ReportNote tradeId=\{tradeKey\(t\.sell_id\)\} symbol=\{t\.symbol\} \/> : undefined\}/);
  // F-13 merge: the card's thesis slot is thesisLine(t, pub, report): a filer's line, else the UserNote.
  assert.match(read('../app/ui.tsx'), /pub \? <p className="thesis muted" data-public-card>/);
  // F-26: plus the author's own held line (ownHeld), the only other thing the slot can hold.
  assert.match(read('../app/ui.tsx'), /thesisLine\(t, pub, report, ownHeld\)/);
  // The card (app/ui.tsx) takes the control as a prop and never imports the server-action island itself.
  assert.doesNotMatch(read('../app/ui.tsx'), /from ['"][^'"]*(report-note|actions)\.tsx?['"]/);
});

// Fix round 2 (B): the rule is named by its plain explanation (lib/report-copy.ts#heldLine) instead of the raw label.
test('the author sees "held for review" and the matched rule as text, muted (never the loss colour)', async () => {
  const s = read('../app/u/[handle]/page.tsx');
  const line = s.split('\n').find((l) => l.includes("t.thesis_status === 'held'"))!;
  assert.match(line, /isMe &&/);
  // F-26: the line is HeldNote (one markup for the card, the trade page and the profile), rendered here to check it.
  assert.match(line, /<HeldNote rule=\{t\.thesis_hold_rule\} id=\{`held-\$\{t\.id\}`\} \/>/); // F4-17: the id the edit field names
  const { HeldNote } = await import('./user-note.ts');
  const html = renderToStaticMarkup(createElement(HeldNote, { rule: 'promotion' }));
  assert.match(html, /^<p class="muted thesis-held" data-own-held="">Thesis held for review\. [^<]*Held because it has a promotion\.[^<]*<\/p>$/);
  assert.doesNotMatch(html, /\bdown\b|--down/);
  const { heldLine } = await import('./report-copy.ts');
  assert.match(heldLine('promotion'), /^Thesis held for review\. .*Held because it has a promotion\./);
  assert.doesNotMatch(line, /\bdown\b|--down/);
});

// Fix round 2 (C): the feed card already names the trader, so its note has no byline.
test('byline={false}: the caption starts at the date line; no caption without a date or a Report control', () => {
  const w = new Date('2026-10-05T15:00:00Z');
  assert.equal(render({ text: 'x', handle: 'h', writtenAt: w, byline: false }),
    '<figure class="user-note" data-user-note=""><blockquote class="user-note-text">“<bdi>x</bdi>”</blockquote><figcaption class="user-note-by muted">Written Oct 5, 2026, after the trade closed</figcaption></figure>');
  assert.equal(render({ text: 'x', handle: 'h', byline: false }), '<figure class="user-note" data-user-note=""><blockquote class="user-note-text">“<bdi>x</bdi>”</blockquote></figure>');
  assert.equal(render({ text: 'x', handle: 'h', byline: false, report: createElement('button', null, 'Report') }),
    '<figure class="user-note" data-user-note=""><blockquote class="user-note-text">“<bdi>x</bdi>”</blockquote><figcaption class="user-note-by muted"><button>Report</button></figcaption></figure>');
  assert.doesNotMatch(render({ text: 'x', handle: 'h', writtenAt: w, byline: false }), /Note by/);
  // The default keeps the byline (profile, trade page, /t, pane).
  assert.match(render({ text: 'x', handle: 'h', writtenAt: w }), /Note by @h · Written Oct 5, 2026/);
  assert.match(render({ text: 'x', handle: 'h', byline: true }), /Note by @h<\/figcaption>/);
});

test('byline: only the feed card drops it; profile, trade page, /t and the pane keep "Note by @handle"', () => {
  assert.match(read('../app/ui.tsx'), /<UserNote text=\{t\.thesis\}[^>]*byline=\{false\}/);
  for (const f of ['../app/u/[handle]/page.tsx', '../app/u/[handle]/trade/[sellId]/page.tsx', '../app/t/[symbol]/Theses.tsx', '../app/u/[handle]/chart.tsx']) {
    assert.doesNotMatch(read(f), /byline=\{false\}/, f);
  }
});

// Fix round 2 (E): the Report control's focus ring clears the caption; on /t/[symbol] the note is outside the row link.
test('the Report control sits 4px below the caption; the /t row link holds no note', () => {
  const css = read('../app/globals.css');
  // The block runs to its end marker (later features append their own blocks after it).
  const start = css.indexOf('/* fix-user-text: UserNote');
  const end = css.indexOf('/* end fix-user-text: UserNote */', start);
  assert.ok(start >= 0 && end > start, 'the UserNote block has its end marker');
  const block = css.slice(start, end);
  assert.match(block, /\.user-note \.report-note \{[^}]*margin: 4px 0 0;/);
  const t = read('../app/t/[symbol]/Theses.tsx');
  // A11Y-FIXES #22 (main) moved the row link to the trade page; the note still sits outside it.
  const from = t.indexOf('<Link href={`/u/${r.handle}/trade/${encodeURIComponent(r.sellId)}`}');
  assert.ok(from >= 0, 'the row link');
  const link = t.slice(from, t.indexOf('</Link>'));
  assert.ok(link.length > 0);
  assert.doesNotMatch(link, /UserNote/, 'the note is not inside the row link');
  assert.ok(t.indexOf('<UserNote text={r.thesis}') > t.indexOf('</Link>'), 'the note follows the row link');
});

// Fix round 2 (H): the chart sheet header separates the date from the figure.
test('chart sheet header: " · " between the close date and the figure', () => {
  const c = read('../app/u/[handle]/chart.tsx');
  // A11Y-FIXES #23 (main): the figure's tone comes from toneClass (flat is neither colour).
  assert.match(c, /\{chosen\.closedAt\.toLocaleDateString\('en-US'\)\}\{' · '\}<\/span><\/span>\s*<b className=\{toneClass\(chosen\.returnPct\)\}>/);
});

// Fix round 4 (F-10 AC8 at 780×360): on a short screen the feed card's note is one compact line: the date takes no
// space, Report stays on the line with a target of at least 24 px, and the note may give up height like F-10's .thesis.
test('short screens: the feed card note is one line, the date takes no space, Report keeps a 24 px+ target', () => {
  const css = read('../app/globals.css');
  const start = css.indexOf('/* fix-user-text: UserNote');
  const block = css.slice(start, css.indexOf('/* end fix-user-text: UserNote */', start));
  const short = [...block.matchAll(/@media \(max-height: 480px\) \{([\s\S]*?)\n\}/g)].map((m) => m[1]).join('\n');
  assert.match(short, /\.feed \.card \.user-note \{[^}]*display: flex;[^}]*min-height: 0;[^}]*overflow: hidden;/);
  assert.match(short, /\.feed \.card \.user-note-by \{[^}]*font-size: 0px;/);
  assert.match(short, /\.feed \.card \.user-note \.report-note \{[^}]*margin: 0;/);
  const btn = short.match(/\.feed \.card \.user-note \.link-button \{([^}]*)\}/)?.[1] ?? '';
  assert.ok(parseFloat(btn.match(/min-height: (\d+)px/)?.[1] ?? '0') >= 24, 'Report target at least 24 px tall');
  assert.ok(parseFloat(btn.match(/min-width: (\d+)px/)?.[1] ?? '0') >= 24, 'Report target at least 24 px wide');
  // The button and the live region keep their own sizes (the caption's 0px hides only its bare date text).
  assert.match(block, /\.user-note \.link-button \{[^}]*font-size: 13px/);
  assert.match(block, /\.user-note \.report-status \{[^}]*font-size: 13px/);
});

// Merge with F-10's 15% headroom check: in the feed card's flex column the note's basis is its own height, never the 100%
// basis the /t row's wrap layout uses (that basis made the clamped note claim the whole card and squeeze the rest).
test('feed card: the note takes its own height in the card column (flex-basis auto)', () => {
  const css = read('../app/globals.css');
  const start = css.indexOf('/* fix-user-text: UserNote');
  const block = css.slice(start, css.indexOf('/* end fix-user-text: UserNote */', start));
  assert.match(block, /^\.user-note \{[^}]*flex-basis: 100%/m);
  assert.match(block, /^\.feed \.card \.user-note \{ flex-basis: auto; \}/m);
});

// Merge with FIXES-CYCLE2-A11Y (#71): the feed card's note text is also the card's `.thesis` (its layout checks and
// slot rules address that class); other surfaces keep the plain quote.
test('feed card: the note text carries the card thesis class; other surfaces do not', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server' as string) as { renderToStaticMarkup: (e: unknown) => string };
  const { UserNote } = await import('./user-note.ts');
  assert.match(renderToStaticMarkup(UserNote({ text: 'x', handle: 'h', textClass: 'thesis' })), /<blockquote class="user-note-text thesis">/);
  assert.match(renderToStaticMarkup(UserNote({ text: 'x', handle: 'h' })), /<blockquote class="user-note-text">/);
  assert.match(read('../app/ui.tsx'), /byline=\{false\} textClass="thesis" \/>/);
});
