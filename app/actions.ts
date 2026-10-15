'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { sql } from '@/lib/db.ts';
import { currentUser, signIn } from '@/lib/session.ts';
import { moderate } from '@/lib/moderation.ts';
import { checkReflection } from '@/lib/reflections.ts';
import { checkRule } from '@/lib/rules.ts';

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

export async function setReflection(form: FormData) {
  const user = await currentUser();
  const sellId = form.get('sellId');
  const owned = !!user && typeof sellId === 'string' && (await sql`select 1 from closed_trades where user_id = ${user.id} and sell_id = ${sellId}`).length > 0;
  const c = checkReflection({ userId: user?.id ?? null, reason: form.get('reason'), sellId, owned });
  if (!user) redirect('/login');
  if (!c.ok) throw new Error('Not allowed');
  if (c.reason) {
    await sql`insert into trade_reflections (user_id, sell_id, reason) values (${user.id}, ${c.sellId}, ${c.reason})
      on conflict (user_id, sell_id) do update set reason = excluded.reason`;
  } else {
    await sql`delete from trade_reflections where user_id = ${user.id} and sell_id = ${c.sellId}`;
  }
  revalidatePath('/me/record');
}

export async function setRule(form: FormData) {
  const user = await currentUser();
  if (!user) redirect('/login');
  const c = checkRule({ userId: user.id, kind: form.get('kind'), days: form.get('days'), clear: form.get('intent') === 'clear' });
  if (!c.ok) throw new Error('Not allowed');
  if (c.days === null) {
    await sql`delete from trade_rules where user_id = ${user.id} and kind = ${c.kind}`;
  } else {
    await sql`insert into trade_rules (user_id, kind, days) values (${user.id}, ${c.kind}, ${c.days})
      on conflict (user_id, kind) do update set days = excluded.days, updated_at = now()`;
  }
  revalidatePath('/me/record');
}
