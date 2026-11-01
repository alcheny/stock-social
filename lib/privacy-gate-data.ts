// Privacy work (launch gate, D1): the verified addresses on an account's sign-in identities, for
// lib/launch-gate.ts#mayConnect's email allowlist. Read only when the gate is checked; never logged or shown.
import { sql } from './db.ts';
import { mayConnect } from './launch-gate.ts';

export async function identityEmails(userId: number): Promise<string[]> {
  const rows = await sql`select email from identities where user_id = ${userId} and email is not null`;
  return rows.map((r) => String(r.email));
}

/** The gate for a connection by this account, or (signed out, null) by a brokerage-first sign-up. */
export async function connectAllowed(me: { id: number; handle: string } | null): Promise<boolean> {
  return mayConnect(me ? { handle: me.handle, emails: await identityEmails(me.id) } : null);
}
