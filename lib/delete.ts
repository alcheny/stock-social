// Profile deletion (POLICY P6): the vendor user goes first; if that fails nothing here is deleted. Then the users row
// cascades (identities, sessions, activities, closed_trades, claims, events) and the handle is reserved for a year
// with no personal data. The two-step screen (S9) is PR-2a; this is the action behind it.
import { sql } from './db.ts';

export type DeletableUser = { id: number; handle: string; snaptrade_user_id: string | null; snaptrade_secret_enc: string | null };
export type DeleteDeps = { deleteVendorUser: (u: { snaptradeUserId: string; secretEnc: string }) => Promise<void> };

export const HANDLE_RESERVED_DAYS = 365;

// ponytail: lib/broker.ts gains deleteUser in PR-2a; until then a connected profile cannot be deleted silently.
export const defaultDeleteDeps: DeleteDeps = {
  deleteVendorUser: async () => { throw new Error('vendor user deletion is not wired yet'); },
};

export async function deleteProfile(u: DeletableUser, deps: DeleteDeps = defaultDeleteDeps): Promise<void> {
  if (u.snaptrade_user_id && u.snaptrade_secret_enc) await deps.deleteVendorUser({ snaptradeUserId: u.snaptrade_user_id, secretEnc: u.snaptrade_secret_enc });
  await sql.begin(async (tx) => {
    await tx`insert into handle_reservations (handle, until) values (${u.handle}, now() + ${HANDLE_RESERVED_DAYS} * interval '1 day')
      on conflict (handle) do update set until = excluded.until`;
    await tx`delete from users where id = ${u.id}`;
  });
}
