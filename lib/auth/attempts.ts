// The attempt-first identity model (F-1 mechanic c): the 18+ attestation is a signup_attempts row written before
// any redirect; the users row (signup_attempt_id not null) is created only when a method completes.
import { randomBytes } from 'node:crypto';
import { sql } from '../db.ts';
import { recordFunnel } from '../funnel.ts';
import { legacyVia, normalizeHandle, type ReferredSurface } from '../referral.ts';

export const METHODS = ['provider_a', 'provider_b', 'email', 'brokerage', 'dev'] as const;
export type Method = (typeof METHODS)[number];
export const isMethod = (m: unknown): m is Method => typeof m === 'string' && (METHODS as readonly string[]).includes(m);

export class NotAttestedError extends Error { constructor() { super('Stock Social is 18+ only'); } }
export class HandleTakenError extends Error { constructor() { super('That handle is taken or reserved'); } }

export type NewAttempt = { method: Method; attested: boolean; referredBy?: number | null; surface?: ReferredSurface | null; landedAt?: Date | null; source?: string | null };

// Writes the attestation, the landing and the method choice. Throws (and writes nothing) without the attestation.
export async function createAttempt(i: NewAttempt): Promise<number> {
  if (!i.attested) throw new NotAttestedError();
  const [a] = await sql`insert into signup_attempts (method, adult_attested_at, referred_by_user_id, referred_surface)
    values (${i.method}, now(), ${i.referredBy ?? null}, ${i.surface ?? null}) returning id`;
  const id = Number(a.id);
  const landed = i.landedAt && i.landedAt.getTime() <= Date.now() && Date.now() - i.landedAt.getTime() < 86_400_000 ? i.landedAt : undefined;
  await recordFunnel(id, 'landed', { source: i.source ?? 'direct' }, landed);
  await recordFunnel(id, 'method_chosen', { method: i.method });
  await recordFunnel(id, 'attested');
  return id;
}

// Provisional handle: random, never derived from an email or a name; the trader changes it on their profile.
export function provisionalHandle(rand: (n: number) => Buffer = randomBytes): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = rand(8);
  let s = '';
  for (let i = 0; i < 8; i++) s += alphabet[bytes[i] % alphabet.length];
  return `trader_${s}`;
}

export async function handleAvailable(handle: string): Promise<boolean> {
  const [r] = await sql`select 1 from users where handle = ${handle} union all select 1 from handle_reservations where handle = ${handle} and until > now()`;
  return !r;
}

export type Attempt = { id: number; method: Method; user_id: number | null; completed_at: Date | null; referred_by_user_id: number | null; referred_surface: string | null };
export async function getAttempt(id: number): Promise<Attempt | null> {
  const [a] = await sql<Attempt[]>`select id, method, user_id, completed_at, referred_by_user_id, referred_surface from signup_attempts where id = ${id}`;
  return a ? { ...a, id: Number(a.id) } : null;
}

// Creates the users row for a completed attempt. The attempt supplies the attestation and the referral.
export async function createUserForAttempt(attemptId: number, i: { handle?: string; name?: string } = {}): Promise<{ id: number; handle: string }> {
  const a = await getAttempt(attemptId);
  if (!a) throw new Error('unknown attempt');
  const surface = (a.referred_by_user_id ? a.referred_surface : null) as ReferredSurface | null;
  for (let tries = 0; tries < 5; tries++) {
    const handle = i.handle ? normalizeHandle(i.handle) : provisionalHandle();
    if (!handle) throw new HandleTakenError();
    if (!(await handleAvailable(handle))) { if (i.handle) throw new HandleTakenError(); continue; }
    const name = (i.name ?? '').trim().slice(0, 40) || handle;
    const [u] = await sql`insert into users (handle, display_name, adult_attested_at, signup_attempt_id, referred_by_user_id, referred_via, referred_surface)
      select ${handle}, ${name}, adult_attested_at, id, ${a.referred_by_user_id}, ${legacyVia(surface)}, ${surface} from signup_attempts where id = ${attemptId}
      on conflict (handle) do nothing returning id, handle`;
    if (!u) { if (i.handle) throw new HandleTakenError(); continue; }
    await completeAttempt(attemptId, u.id as number);
    return { id: u.id as number, handle: u.handle as string };
  }
  throw new HandleTakenError();
}

export async function completeAttempt(attemptId: number, userId: number) {
  await sql`update signup_attempts set user_id = ${userId}, completed_at = coalesce(completed_at, now()) where id = ${attemptId}`;
}

export type Identity = { provider: 'provider_a' | 'provider_b' | 'email'; subject: string; email: string | null };

// Signs an attempt in with a verified identity: the known subject wins, then a verified email already on file,
// else a new user with a provisional handle. Returns the user.
export async function signInWithIdentity(attemptId: number, id: Identity): Promise<{ id: number; handle: string }> {
  const [known] = await sql`select u.id, u.handle from identities i join users u on u.id = i.user_id where i.provider = ${id.provider} and i.subject = ${id.subject}`;
  if (known) { await completeAttempt(attemptId, known.id); return { id: known.id, handle: known.handle }; }
  if (id.email) {
    const [byMail] = await sql`select u.id, u.handle from identities i join users u on u.id = i.user_id where i.email = ${id.email} limit 1`;
    if (byMail) {
      await sql`insert into identities (user_id, provider, subject, email) values (${byMail.id}, ${id.provider}, ${id.subject}, ${id.email}) on conflict do nothing`;
      await completeAttempt(attemptId, byMail.id);
      return { id: byMail.id, handle: byMail.handle };
    }
  }
  const u = await createUserForAttempt(attemptId);
  await sql`insert into identities (user_id, provider, subject, email) values (${u.id}, ${id.provider}, ${id.subject}, ${id.email})`;
  return u;
}

// Owner-only handle change (the provisional handle is editable on the profile).
export async function changeHandle(userId: number, raw: unknown): Promise<string> {
  const handle = normalizeHandle(raw);
  if (!handle) throw new HandleTakenError();
  if (!(await handleAvailable(handle))) throw new HandleTakenError();
  const [u] = await sql`update users set handle = ${handle} where id = ${userId} returning handle`;
  return u.handle as string;
}
