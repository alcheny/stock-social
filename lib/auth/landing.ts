// Where a sign-in lands (committee fix, item 7). A trader whose profile would be empty (nothing consented, no closed
// trades) goes straight to the trust notice (S2), one stop fewer before connecting; anyone with a record, or an import
// in progress or failed, lands on the profile. The notice links back to the profile.
import { sql } from '../db.ts';
import { recordStatus, type PublicState } from '../connections.ts';

export function landingPath(handle: string, s: { state: PublicState; closes: number }): string {
  return s.state === 'none' && s.closes === 0 ? '/connect' : `/u/${handle}`;
}

export async function landingFor(user: { id: number; handle: string }): Promise<string> {
  const { state } = await recordStatus(user.id);
  const [{ n }] = await sql`select count(*)::int as n from closed_trades where user_id = ${user.id}`;
  return landingPath(user.handle, { state, closes: n as number });
}
