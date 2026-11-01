'use server';
// F-3 · Record tools and Subscribe (docs/features/logs/F-3/plan.md). Every action reads the signed-in user on the
// server and passes only that id to lib/record-tools.ts, which checks ownership on every row (committee K4). Messages
// travel as short codes in the URL: never a handle, a view name or note text (K1, K4). Paid actions (adding traders,
// reordering) check the entitlement from the app's own rows; reading, editing, exporting and deleting one's own views
// and notes never does (K10). Nothing here writes discovery_events or sends anything (K7, K13).
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/session.ts';
import { access, billingAvailable, CheckoutRefused, disclosureText, isPlan, siteOrigin, startCheckout } from '@/lib/billing.ts';
import { addTrader, createView, deleteNote, deleteView, dismissRemovedNotice, isViewId, moveTrader, removeTrader, renameView, saveNote } from '@/lib/record-tools.ts';

const str = (f: FormData, k: string) => { const v = f.get(k); return typeof v === 'string' ? v : ''; };
const viewUrl = (id: string, q: string) => `/tools?view=${id}&${q}`;

async function me() {
  const u = await currentUser();
  if (!u) redirect('/login');
  return u;
}
async function paid(userId: number) {
  const a = await access(userId);
  return a.kind === 'trader' || a.kind === 'subscriber';
}

// Engineer E5: the consent hashes the text as shown, so the next-charge date is the one on the page the subscriber read
// (accepted when it was rendered in the last day; otherwise now).
function shownAt(v: string): Date {
  const t = Date.parse(v), now = Date.now();
  return Number.isFinite(t) && t <= now && now - t < 86_400_000 ? new Date(t) : new Date(now);
}

export async function subscribe(form: FormData) {
  const u = await me();
  const plan = str(form, 'plan');
  if (!isPlan(plan)) redirect('/tools?e=plan#subscribe');
  if (str(form, 'agreed') !== plan) redirect(`/tools?e=agree&p=${plan}#subscribe`);
  if (!billingAvailable()) redirect('/tools');
  let url: string;
  try {
    url = await startCheckout({ userId: u.id, plan, agreed: true, disclosure: disclosureText(plan, shownAt(str(form, 'shown'))), origin: siteOrigin() });
  } catch (e) {
    if (e instanceof CheckoutRefused) redirect(e.reason === 'subscribed' ? '/account' : '/tools');
    console.error('checkout failed', e instanceof Error ? e.message : 'unknown');
    redirect('/tools?e=checkout#subscribe');
  }
  redirect(url);
}

// One submit makes the first comparison (business lead demand 6): an optional name (default "View n") and 2 to 4
// followed traders ticked at once, added in alphabetical order (the order the list shows; the owner reorders after).
export async function createViewAction(form: FormData) {
  const u = await me();
  if (!(await paid(u.id))) redirect('/tools');
  const r = await createView(u.id, str(form, 'name'));
  if (!r.ok) redirect(`/tools?e=${r.reason === 'limit' ? 'views' : 'name'}`);
  const picked = form.getAll('handle').filter((h): h is string => typeof h === 'string').slice(0, 4).sort();
  for (const h of picked) await addTrader(u.id, r.id, h);
  redirect(viewUrl(r.id, 'm=created'));
}

export async function dismissNoticeAction() {
  const u = await me();
  await dismissRemovedNotice(u.id);
  redirect('/tools');
}

export async function renameViewAction(form: FormData) {
  const u = await me();
  const id = str(form, 'view');
  const ok = await renameView(u.id, id, str(form, 'name'));
  redirect(isViewId(id) ? viewUrl(id, ok ? 'm=renamed' : 'e=name') : '/tools');
}

export async function deleteViewAction(form: FormData) {
  const u = await me();
  await deleteView(u.id, str(form, 'view'));
  redirect('/tools?m=deleted');
}

export async function addTraderAction(form: FormData) {
  const u = await me();
  const id = str(form, 'view');
  if (!isViewId(id)) redirect('/tools');
  if (!(await paid(u.id))) redirect(viewUrl(id, 'e=locked'));
  const r = await addTrader(u.id, id, str(form, 'handle') || str(form, 'followed'));
  redirect(r.ok ? viewUrl(id, `m=added&i=${r.position}&n=${r.count}#add`) : viewUrl(id, `e=${r.reason}#add`));
}

export async function moveAction(form: FormData) {
  const u = await me();
  const id = str(form, 'view');
  if (!isViewId(id)) redirect('/tools');
  const dir = str(form, 'dir') === 'up' ? 'up' : 'down';
  const r = await moveTrader(u.id, id, str(form, 'trader'), dir);
  redirect(r ? viewUrl(id, `m=moved&i=${r.position}&n=${r.count}#card-${r.position}`) : viewUrl(id, ''));
}

export async function removeAction(form: FormData) {
  const u = await me();
  const id = str(form, 'view');
  if (!isViewId(id)) redirect('/tools');
  await removeTrader(u.id, id, str(form, 'trader'));
  redirect(viewUrl(id, 'm=removed'));
}

export async function saveNoteAction(form: FormData) {
  const u = await me();
  const r = await saveNote(u.id, str(form, 'trader'), str(form, 'body'));
  const back = str(form, 'view');
  const code = r === 'saved' ? 'm=noteSaved' : r === 'deleted' ? 'm=noteDeleted' : r === 'too_long' ? 'e=noteLong' : r === 'self' ? 'e=noteSelf' : 'e=unknown';
  redirect(isViewId(back) ? viewUrl(back, `${code}#note-${str(form, 'trader')}`) : `/tools?${code}#notes`);
}

export async function deleteNoteAction(form: FormData) {
  const u = await me();
  await deleteNote(u.id, str(form, 'trader'));
  const back = str(form, 'view');
  redirect(isViewId(back) ? viewUrl(back, 'm=noteDeleted') : '/tools?m=noteDeleted#notes');
}
