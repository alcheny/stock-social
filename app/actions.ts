'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { sql } from '@/lib/db.ts';
import { currentUser, signIn } from '@/lib/session.ts';
import { moderate } from '@/lib/moderation.ts';

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
