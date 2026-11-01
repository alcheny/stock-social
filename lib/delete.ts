// Profile deletion (POLICY P6): the vendor user goes first; if that fails nothing here is deleted. Then the users row
// cascades (identities, sessions, activities, closed_trades, claims, events), the sign-in links that carried the address
// go in the same transaction, and the handle is reserved for a year
// with no personal data. The two-step screen (S9) is PR-2a; this is the action behind it.
import { sql } from './db.ts';
import { deleteUser } from './broker.ts';
import { endBillingForDeletion } from './billing.ts';

export type DeletableUser = { id: number; handle: string; snaptrade_user_id: string | null; snaptrade_secret_enc: string | null };
// F-3: endBilling cancels the processor subscription and deletes the processor customer first (committee condition 20).
export type DeleteDeps = { deleteVendorUser: (u: { snaptradeUserId: string; secretEnc: string }) => Promise<void>; endBilling?: (userId: number) => Promise<void> };

export const HANDLE_RESERVED_DAYS = 365;

// A vendor user already gone (404) counts as deleted; any other vendor error keeps the row, marked, for the hourly retry.
export const defaultDeleteDeps: DeleteDeps = {
  deleteVendorUser: async (u) => { try { await deleteUser(u); } catch (e) { const x = e as { status?: number; response?: { status?: number } }; if ((x?.status ?? x?.response?.status) !== 404) throw e; } },
  endBilling: endBillingForDeletion,
};

// deleted_at marks a deletion in progress before the vendor call: if the vendor call fails the row stays, marked, and
// the next call finishes it (PR-2a's S9 hides marked rows and retries from the hourly tick).
export async function deleteProfile(u: DeletableUser, deps: DeleteDeps = defaultDeleteDeps): Promise<void> {
  // F-2 PR-2: the first step, with the mark: follows and exclusions made by this account or naming it go before the
  // vendor call, so a failed vendor call still leaves none (the cascade covers any written meanwhile).
  await sql.begin((tx) => [
    tx`update users set deleted_at = coalesce(deleted_at, now()) where id = ${u.id}`,
    // Security hardening (2026-11-01), F17: every session of the profile ends with the mark, not when the row goes.
    tx`delete from sessions where user_id = ${u.id}`,
    tx`delete from follows where viewer_id = ${u.id} or trader_id = ${u.id}`,
    tx`delete from viewer_exclusions where viewer_id = ${u.id} or trader_id = ${u.id}`,
    // F-2 PR-4: likes and rejected trades, made by this account or naming it.
    tx`delete from trade_likes where viewer_id = ${u.id} or trader_id = ${u.id}`,
    tx`delete from trade_exclusions where viewer_id = ${u.id} or trader_id = ${u.id}`,
    // F-3 Record tools (committee condition 12): every subscriber whose views or notes named this account gets one
    // line on the next visit (a count, no trader id kept); then the notes and view entries naming it, and its own.
    tx`insert into record_tool_notices (owner_id, removed)
      select distinct owner_id, 1 from (select owner_id from record_notes where trader_id = ${u.id}
        union all select v.owner_id from record_view_traders t join record_views v on v.id = t.view_id where t.trader_id = ${u.id}) x
      where owner_id <> ${u.id}
      on conflict (owner_id) do update set removed = record_tool_notices.removed + 1`,
    tx`delete from record_notes where owner_id = ${u.id} or trader_id = ${u.id}`,
    tx`delete from record_view_traders where trader_id = ${u.id}`,
    tx`delete from record_views where owner_id = ${u.id}`,
  ]);
  // F-3: billing ends before the account's own rows and the vendor user go (Record tools rows naming it went just above,
  // with the mark); a processor error throws, the account stays marked, and the hourly tick retries.
  await (deps.endBilling ?? endBillingForDeletion)(u.id);
  if (u.snaptrade_user_id && u.snaptrade_secret_enc) await deps.deleteVendorUser({ snaptradeUserId: u.snaptrade_user_id, secretEnc: u.snaptrade_secret_enc });
  await sql.begin(async (tx) => {
    // Sign-in links are keyed by attempt, not user (COMPLIANCE §3): every link on the user's attempts and every link sent
    // to an address on the user's identities goes before the users row (which would null the attempts' user_id).
    await tx`delete from login_links where attempt_id in (select id from signup_attempts where user_id = ${u.id})
      or email in (select email from identities where user_id = ${u.id} and email is not null)`;
    await tx`insert into handle_reservations (handle, until) values (${u.handle}, now() + ${HANDLE_RESERVED_DAYS} * interval '1 day')
      on conflict (handle) do update set until = excluded.until`;
    // Privacy work (committee D17): the account's attempts stay as anonymous funnel rows (user_id goes null with the
    // users row, F-1 design); any vendor id left on one is blanked here, so nothing on them points at the person.
    // Only the vendor user just deleted above (orchestrator review nit): any other vendor id stays for its own cleanup.
    if (u.snaptrade_user_id) await tx`update signup_attempts set snaptrade_user_id = null, snaptrade_secret_enc = null
      where (user_id = ${u.id} or id = (select signup_attempt_id from users where id = ${u.id})) and snaptrade_user_id = ${u.snaptrade_user_id}`;
    await tx`delete from users where id = ${u.id}`;
  });
}
