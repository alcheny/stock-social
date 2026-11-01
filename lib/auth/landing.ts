// Where a sign-in lands (committee fix, item 7). A trader whose profile would be empty (nothing consented, no closed
// trades) goes straight to the trust notice (S2), one stop fewer before connecting; anyone with a record, or an import
// in progress or failed, lands on the profile. The notice links back to the profile.
import { sql } from '../db.ts';
import { recordStatus, type PublicState } from '../connections.ts';

export function landingPath(handle: string, s: { state: PublicState; closes: number }): string {
  return s.state === 'none' && s.closes === 0 ? '/connect' : `/u/${handle}`;
}

export async function landingFor(user: { id: number; handle: string }): Promise<string> {
  // F-3: a viewer who tapped "Sign in to subscribe" comes back to Record tools (one fixed path, set by /tools/signin).
  if (await afterSigninTools()) return '/tools';
  const { state } = await recordStatus(user.id);
  const [{ n }] = await sql`select count(*)::int as n from closed_trades where user_id = ${user.id}`;
  return landingPath(user.handle, { state, closes: n as number });
}

// F-3: reads and clears the "Sign in to subscribe" cookie. Outside a request (unit tests) there is none.
export async function afterSigninTools(): Promise<boolean> {
  try {
    const { cookies } = await import('next/headers'); // dynamic: node's test runner loads this file without Next
    const jar = await cookies();
    if (jar.get('after_signin')?.value !== 'tools') return false;
    jar.delete('after_signin');
    return true;
  } catch { return false; }
}
