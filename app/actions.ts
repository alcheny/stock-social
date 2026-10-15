'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { sql } from '@/lib/db.ts';
import { currentUser, signIn } from '@/lib/session.ts';
import { moderate } from '@/lib/moderation.ts';
import { canWatch, normalizeSymbol } from '@/lib/ticker.ts';

export async function login(form: FormData) {
  const handle = String(form.get('handle') ?? '').trim().toLowerCase();
  const name = String(form.get('name') ?? '').trim() || handle;
  if (!/^[a-z0-9_]{3,20}$/.test(handle)) throw new Error('Handle: 3–20 lowercase letters, numbers or _');
  if (form.get('adult') !== 'on') throw new Error('Stock Social is 18+ only');

  const [u] = await sql`
    insert into users (handle, display_name, adult_attested_at) values (${handle}, ${name}, now())
    on conflict (handle) do update set handle = excluded.handle
    returning id`;
  await signIn(u.id);
  redirect(`/u/${handle}`);
}

export async function saveThesis(form: FormData) {
  const user = await currentUser();
  if (!user) redirect('/login');
  const id = String(form.get('tradeId'));
  const text = String(form.get('thesis') ?? '').trim().slice(0, 280);
  const status = moderate(text);

  await sql`
    update closed_trades set thesis = ${text || null}, thesis_status = ${text ? status : null}
    where id = ${id} and user_id = ${user.id}`;
  revalidatePath(`/u/${user.handle}`);
}

export async function toggleWatch(symbol: string) {
  const user = await currentUser();
  if (!user) redirect('/login');
  const s = normalizeSymbol(String(symbol));
  if (!s) redirect('/t');
  const [existing] = await sql`select 1 from ticker_watches where user_id = ${user.id} and symbol = ${s}`;
  if (existing) {
    await sql`delete from ticker_watches where user_id = ${user.id} and symbol = ${s}`;
  } else {
    const [{ n }] = await sql`select count(*)::int as n from ticker_watches where user_id = ${user.id}`;
    const can = canWatch(n, s);
    if (!can.ok) redirect(`/t/${encodeURIComponent(s)}?watch=${can.reason}`);
    await sql`insert into ticker_watches (user_id, symbol, created_at, last_seen_at) values (${user.id}, ${s}, now(), now()) on conflict do nothing`;
  }
  revalidatePath('/t');
  revalidatePath(`/t/${s}`);
  redirect(`/t/${encodeURIComponent(s)}`);
}
