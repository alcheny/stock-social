import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { currentUser } from '@/lib/session.ts';
import { access, isPlan, testMode, type Access } from '@/lib/billing.ts';
import { compareCards, followOptions, getView, listNotes, listViews, MAX_TRADERS, MAX_VIEWS, removedNotice, type Card, type View } from '@/lib/record-tools.ts';
import { BILLING, RECORD_TOOLS } from '@/lib/copy.ts';
import { Badge } from '../ui.tsx';
import { FocusMessage } from './focus.tsx';
import { BackToFeed, checkoutFor, Disclaimer, fmt, PastDueBanner, SubscribeBlock } from './parts.tsx';
import { addTraderAction, createViewAction, dismissNoticeAction, deleteNoteAction, deleteViewAction, moveAction, removeAction, renameViewAction, saveNoteAction } from './actions.ts';

// F-3 · Record tools (docs/features/logs/F-3/plan.md §3 to §7; committee conditions K1 to K13). Private and unshareable:
// noindex, no referrer, no share UI, a generic title (never a view name), owner-only views (the same 404 for a missing
// and a foreign view). Next.js serves this dynamic page with private, no-store caching; next.config.ts repeats it.
export const metadata: Metadata = { title: `${RECORD_TOOLS.title} · Stock Social`, robots: { index: false, follow: false }, referrer: 'no-referrer' };

type SP = { view?: string; m?: string; e?: string; i?: string; n?: string; p?: string };
const one = (v: unknown) => (typeof v === 'string' ? v : undefined);

function message(sp: SP): { text: string; error: boolean } | null {
  const M = RECORD_TOOLS.messages;
  const i = Number(sp.i), n = Number(sp.n);
  const ok = Number.isInteger(i) && Number.isInteger(n) && i >= 1 && n >= i && n <= MAX_TRADERS;
  switch (sp.m) {
    case 'created': return { text: M.created, error: false };
    case 'renamed': return { text: M.renamed, error: false };
    case 'added': return ok ? { text: M.added(i, n), error: false } : null;
    case 'moved': return ok ? { text: M.moved(i, n), error: false } : null;
    case 'removed': return { text: M.removed, error: false };
    case 'deleted': return { text: M.deleted, error: false };
    case 'noteSaved': return { text: M.noteSaved, error: false };
    case 'noteDeleted': return { text: M.noteDeleted, error: false };
  }
  switch (sp.e) {
    case 'unknown': return { text: M.unknown, error: true };
    case 'duplicate': return { text: M.duplicate, error: true };
    case 'full': return { text: RECORD_TOOLS.full, error: true };
    case 'name': return { text: M.name, error: true };
    case 'views': return { text: RECORD_TOOLS.viewsFull, error: true };
    case 'noteLong': return { text: M.noteLong, error: true };
    case 'noteSelf': return { text: M.noteSelf, error: true };
  }
  return null;
}

export default async function Tools({ searchParams }: { searchParams?: Promise<SP> }) {
  const raw = (await searchParams) ?? {};
  const sp: SP = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, one(v)]));
  const me = await currentUser();
  const now = new Date();
  const a: Access = await access(me?.id, now);
  // The launch gate: while sign-up is closed only an allowlisted account sees the Subscribe screen (lib/launch-gate.ts).
  // CHORES-3 (C3-39): the rule lives in ./parts.tsx#checkoutFor, shared with /account.
  const { billing, closed } = await checkoutFor(me?.id);
  const entitled = a.kind === 'trader' || a.kind === 'subscriber';
  const views = me ? await listViews(me.id) : [];
  const notes = me ? await listNotes(me.id) : [];
  const view = me && sp.view !== undefined ? await getView(me.id, sp.view) : null;
  if (sp.view !== undefined && !view) notFound();
  const lapsed = a.kind === 'none' && (!!a.row || views.length > 0 || notes.length > 0);
  const removed = me ? await removedNotice(me.id) : false;
  // A first payment still being confirmed: never offered checkout again (orchestrator review 5).
  const confirming = a.kind === 'none' && a.row?.status === 'incomplete';
  const msg = message(sp);

  // Locked: signed out, or signed in with nothing of their own here yet. Traders never reach it (K14).
  if (!me || (a.kind === 'none' && !lapsed)) {
    return (
      <main className="page rt">
        <h1>{RECORD_TOOLS.title}</h1>
        <Disclaimer />
        {!billing && <p>{RECORD_TOOLS.what}</p>}
        {billing
          ? <SubscribeBlock signedIn={!!me} testMode={testMode(billing)} error={me ? sp.e ?? null : null} chosen={isPlan(sp.p) ? sp.p : null} now={now} />
          : <><p className="muted">{closed ? BILLING.notOpen : BILLING.unavailable}</p><BackToFeed /></>}
      </main>
    );
  }

  const status = (
    <>
      {a.kind === 'subscriber' && a.row.status === 'past_due' && a.row.grace_until && <PastDueBanner until={a.row.grace_until} />}
      {a.kind === 'subscriber' && a.row.cancel_at_period_end && a.row.current_period_end && <p className="rt-banner">{RECORD_TOOLS.endsOn(a.row.current_period_end)}</p>}
      {a.kind === 'trader' && <p className="muted">{RECORD_TOOLS.trader}</p>}
      {confirming && <p role="status" className="rt-banner">{BILLING.confirming} <Link href="/account">{RECORD_TOOLS.account}</Link></p>}
      {lapsed && !confirming && <p className="rt-banner">{RECORD_TOOLS.lapsed}</p>}
      {removed && <form action={dismissNoticeAction} className="rt-banner"><p role="status" style={{ margin: 0 }}>{RECORD_TOOLS.removedNotice}</p><button className="button secondary">{RECORD_TOOLS.dismiss}</button></form>}
      <p id="rt-msg" tabIndex={-1} role={msg?.error ? 'alert' : 'status'} className={msg?.error ? 'down rt-msg' : 'rt-msg'}>{msg?.text ?? ''}</p>
      {msg && <FocusMessage target={sp.m === 'moved' && sp.i ? `card-${sp.i}` : 'rt-msg'} />}
    </>
  );

  if (view) return <ViewPage view={view} entitled={entitled} status={status} />;

  const { options: follows, more: followsMore } = entitled ? await followOptions(me.id) : { options: [], more: false };
  return (
    <main className="page rt">
      <h1>{RECORD_TOOLS.title}</h1>
      <Disclaimer />
      <p className="rt-links"><Link href="/account">{RECORD_TOOLS.account}</Link> · <a href="/account/export" download>{RECORD_TOOLS.download}</a></p>
      {status}
      <h2>{RECORD_TOOLS.viewsTitle}</h2>
      {views.length ? (
        <ul className="rows rt-views">
          {views.map((v) => <li key={v.id}><div className="line"><Link href={`/tools?view=${v.id}`}>{v.name}</Link><span className="muted">{RECORD_TOOLS.traders(v.traders)}</span></div></li>)}
        </ul>
      ) : <p className="muted">{RECORD_TOOLS.noViews}</p>}
      {entitled && (views.length >= MAX_VIEWS ? <p className="muted">{RECORD_TOOLS.viewsFull}</p> : (
        <form action={createViewAction} className="rt-form">
          <label htmlFor="rt-name">{RECORD_TOOLS.newViewLabel}</label>
          <input id="rt-name" name="name" maxLength={60} autoComplete="off" />
          {follows.length > 0 && (
            <fieldset className="rt-follows">
              <legend>{RECORD_TOOLS.followLabel}</legend>
              {follows.map((f) => <label key={f.handle} className="rt-check"><input type="checkbox" name="handle" value={f.handle} /> @{f.handle}</label>)}
              {followsMore && <p className="muted small">{RECORD_TOOLS.followMoreNew}</p>}
            </fieldset>
          )}
          <button className="button">{RECORD_TOOLS.createView}</button>
        </form>
      ))}
      {lapsed && !confirming && <p><a className="button" href="#subscribe">{BILLING.subscribeAgain}</a></p>}
      <h2 id="notes">{RECORD_TOOLS.notesTitle}</h2>
      <p className="muted small">{RECORD_TOOLS.removedAdvance}</p>
      {notes.length ? (
        <ul className="rows rt-notes">
          {notes.map((n) => (
            <li key={n.traderId} id={`note-${n.traderId}`}>
              <div className="line"><b>@{n.handle}</b><span className="muted small">{RECORD_TOOLS.updated(n.updatedAt)}</span></div>
              <NoteForm trader={n.traderId} handle={n.handle} body={n.body} view="" />
            </li>
          ))}
        </ul>
      ) : <p className="muted">{RECORD_TOOLS.noNotes}</p>}
      {lapsed && !confirming && billing && <SubscribeBlock signedIn testMode={testMode(billing)} error={sp.e ?? null} chosen={isPlan(sp.p) ? sp.p : null} now={new Date()} />}
    </main>
  );
}

function NoteForm({ trader, handle, body, view }: { trader: number; handle: string; body: string; view: string }) {
  const id = `nb-${trader}`;
  return (
    <>
      <form action={saveNoteAction} className="rt-note">
        <input type="hidden" name="trader" value={trader} />
        <input type="hidden" name="view" value={view} />
        <label htmlFor={id}>{RECORD_TOOLS.noteLabel(handle)}</label>
        <textarea id={id} name="body" rows={4} defaultValue={body} aria-describedby={`${id}-c`} />
        <p id={`${id}-c`} className="muted small">{RECORD_TOOLS.noteCount([...body].length)}</p>
        <button className="button secondary" aria-label={`Save note about @${handle}`}>{RECORD_TOOLS.saveNote}</button>
      </form>
      {body && (
        <form action={deleteNoteAction} className="rt-inline">
          <input type="hidden" name="trader" value={trader} />
          <input type="hidden" name="view" value={view} />
          <button className="button secondary" aria-label={`Delete note about @${handle}`}>{RECORD_TOOLS.deleteNote}</button>
        </form>
      )}
    </>
  );
}

async function ViewPage({ view, entitled, status }: { view: View; entitled: boolean; status: React.ReactNode }) {
  const cards: Card[] = entitled ? await compareCards(view.traders) : [];
  const owner = (await currentUser())!;
  const notes = new Map((await listNotes(owner.id)).map((n) => [n.traderId, n.body]));
  const { options: follows, more: followsMore } = entitled ? await followOptions(owner.id, view.traders.map((t) => t.handle)) : { options: [], more: false };
  const n = view.traders.length;
  return (
    <main className="page rt">
      <p className="rt-back"><Link href="/tools">← {RECORD_TOOLS.allViews}</Link></p>
      <h1 id="view-h">{view.name}</h1>
      <Disclaimer />
      {status}
      <details className="rt-rename">
        <summary>{RECORD_TOOLS.renameSummary}</summary>
        <form action={renameViewAction} className="rt-form">
          <input type="hidden" name="view" value={view.id} />
          <label htmlFor="rt-rename">{RECORD_TOOLS.renameLabel}</label>
          <input id="rt-rename" name="name" maxLength={60} defaultValue={view.name} required />
          <button className="button secondary">{RECORD_TOOLS.saveName}</button>
        </form>
      </details>
      {entitled && (n >= MAX_TRADERS ? <p className="muted" id="add">{RECORD_TOOLS.full}</p> : (
        <div id="add" className="rt-add">
          <form action={addTraderAction} className="rt-form">
            <input type="hidden" name="view" value={view.id} />
            <label htmlFor="rt-handle">{RECORD_TOOLS.addLabel}</label>
            <div className="rt-handle"><span aria-hidden="true">@</span><input id="rt-handle" name="handle" autoCapitalize="none" spellCheck={false} autoComplete="off" maxLength={21} /></div>
            <button className="button">{RECORD_TOOLS.addButton}</button>
          </form>
          {follows.length > 0 && (
            <form action={addTraderAction} className="rt-form">
              <input type="hidden" name="view" value={view.id} />
              <label htmlFor="rt-followed">{RECORD_TOOLS.followLabel}</label>
              <select id="rt-followed" name="followed" defaultValue="">
                <option value="" disabled>{RECORD_TOOLS.followChoose}</option>
                {follows.map((f) => <option key={f.handle} value={f.handle}>@{f.handle}</option>)}
              </select>
              <button className="button secondary">{RECORD_TOOLS.addButton}</button>
              {followsMore && <p className="muted small">{RECORD_TOOLS.followMore}</p>}
            </form>
          )}
        </div>
      ))}
      {!entitled && <p className="muted">{RECORD_TOOLS.lockedAdd}</p>}
      {entitled && n === 0 && <p className="muted">{RECORD_TOOLS.addHint}</p>}
      {entitled && n === 1 && <p className="muted">{RECORD_TOOLS.addOneMore}</p>}
      <ol className={`rt-cards rt-n${n}`}>
        {view.traders.map((t, i) => {
          const c = cards[i];
          return (
            <li key={t.id} id={`card-${i + 1}`} tabIndex={-1} className="rt-card" aria-labelledby={`card-h-${i + 1}`}>
              <p className="muted small rt-pos">{RECORD_TOOLS.position(i + 1, n)}</p>
              <h2 id={`card-h-${i + 1}`}><Link href={`/u/${t.handle}`}>@{t.handle}</Link>{' '}
                {c?.badge && <Badge verified={c.badge === 'verified'} />}{' '}
                {c?.isNew && <span className="badge new">New record</span>}
              </h2>
              {c && <CardBody c={c} />}
              <div className="rt-controls">
                {i > 0 && <form action={moveAction}><input type="hidden" name="view" value={view.id} /><input type="hidden" name="trader" value={t.id} /><input type="hidden" name="dir" value="up" /><button className="button secondary" aria-label={`Move @${t.handle} up`}>{RECORD_TOOLS.moveUp}</button></form>}
                {i < n - 1 && <form action={moveAction}><input type="hidden" name="view" value={view.id} /><input type="hidden" name="trader" value={t.id} /><input type="hidden" name="dir" value="down" /><button className="button secondary" aria-label={`Move @${t.handle} down`}>{RECORD_TOOLS.moveDown}</button></form>}
                <form action={removeAction}><input type="hidden" name="view" value={view.id} /><input type="hidden" name="trader" value={t.id} /><button className="button secondary" aria-label={`Remove @${t.handle} from this view`}>{RECORD_TOOLS.remove}</button></form>
              </div>
              {t.id !== owner.id && (
                // Business lead demand 2: the note folds away so cards sit close together at 360 px.
                <details id={`note-${t.id}`} className="rt-note-fold" open={!!notes.get(t.id) && n <= 1}>
                  <summary>{RECORD_TOOLS.noteSummary(t.handle, !!notes.get(t.id))}</summary>
                  <NoteForm trader={t.id} handle={t.handle} body={notes.get(t.id) ?? ''} view={view.id} />
                </details>
              )}
            </li>
          );
        })}
      </ol>
      <details className="rt-confirm">
        <summary className="button secondary">{RECORD_TOOLS.deleteView}</summary>
        <p>{RECORD_TOOLS.deleteViewConfirm(view.name)}</p>
        <form action={deleteViewAction} className="rt-inline"><input type="hidden" name="view" value={view.id} /><button className="button">{RECORD_TOOLS.deleteView}</button></form>
      </details>
    </main>
  );
}

// K2, K3: the profile's own figures in a fixed order, identical styling for every card; the lower end is shown only
// inside the range row (business lead demand 1), never alone; losses read like gains (sign and text).
function CardBody({ c }: { c: Card }) {
  const R = RECORD_TOOLS.rows;
  return (
    <>
      {c.state === 'importing' && <p className="muted small">{RECORD_TOOLS.importing}</p>}
      {c.since && <p className="muted small">Record since {c.since} · {c.connected}.</p>}
      {c.figures ? (
        <dl className="rt-figures">
          <div><dt>{R.closed}</dt><dd>{c.closed.toLocaleString('en-US')}</dd></div>
          <div><dt>{R.winRate}</dt><dd>{c.figures.winRate}</dd></div>
          <div><dt>{R.avg}</dt><dd className={c.figures.avgSign}>{c.figures.avg}</dd></div>
          {c.figures.range && <div><dt>{R.range}</dt><dd>{c.figures.range}{c.figures.low && <><br /><span className="small">{R.low}: {c.figures.low}</span></>}{/* F-33 R5: no low end for "Too early to tell" */}</dd></div>}
          <div className="rt-wide"><dt>{R.evidence}</dt><dd>{c.figures.evidence}</dd></div>
          <div><dt>{R.drawdown}</dt><dd className="down">{c.figures.drawdown}</dd></div>
        </dl>
      ) : c.state !== 'importing' && <p className="muted small">{RECORD_TOOLS.noTrades}</p>}
      {c.excluded.map((line) => <p key={line} className="muted small">{line}</p>)}
    </>
  );
}
