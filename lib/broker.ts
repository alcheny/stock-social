// The ONLY file that talks to SnapTrade (docs/DESIGN.md §2.1). Swapping vendors changes this file.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { Snaptrade, SnaptradeAuth } from 'snaptrade-typescript-sdk';
import type { Activity } from './trades.ts';

// SNAPTRADE_BASE_URL points the SDK at the in-repo fake in tests (e2e/fakes/vendor.ts); unset, the SDK uses the vendor.
const client = () =>
  new Snaptrade({
    auth: SnaptradeAuth.commercialApiKey({
      clientId: process.env.SNAPTRADE_CLIENT_ID!,
      consumerKey: process.env.SNAPTRADE_CONSUMER_KEY!,
    }),
    basePath: process.env.SNAPTRADE_BASE_URL || undefined,
  });

const key = () => createHash('sha256').update(process.env.APP_SECRET_KEY!).digest();

function encrypt(plain: string) {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key(), iv);
  const body = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), body].map((b) => b.toString('base64')).join('.');
}

function decrypt(enc: string) {
  const [iv, tag, body] = enc.split('.').map((s) => Buffer.from(s, 'base64'));
  const d = createDecipheriv('aes-256-gcm', key(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(body), d.final()]).toString('utf8');
}

export type BrokerUser = { snaptradeUserId: string; secretEnc: string };

// `ref` is the app user id, or `attempt-<id>` for a brokerage-first sign-up that has no user row yet.
export async function registerUser(ref: number | string): Promise<BrokerUser> {
  const userId = `stock-social-${ref}-${randomBytes(4).toString('hex')}`;
  const { data } = await client().authentication.registerSnapTradeUser({ userId });
  return { snaptradeUserId: data.userId!, secretEnc: encrypt(data.userSecret!) };
}

// Read-only connection: we can never place trades or move money.
export async function connectUrl(u: BrokerUser, returnTo: string): Promise<string> {
  const { data } = await client().authentication.loginSnapTradeUser({
    userId: u.snaptradeUserId,
    userSecret: decrypt(u.secretEnc),
    connectionType: 'read',
    customRedirect: returnTo,
    darkMode: true,
  });
  if (!('redirectURI' in data) || !data.redirectURI) throw new Error('SnapTrade returned no redirect URI');
  return data.redirectURI;
}

type Fetched = Activity & { raw: unknown };
const auth = (u: BrokerUser) => ({ userId: u.snaptradeUserId, userSecret: decrypt(u.secretEnc) });

// Zero-depth link validation (F-1): the accounts under the login with the vendor's paper flag and whether the
// vendor's own initial transaction sync has finished. No activities are read here.
export type VendorAccount = { id: string; authorizationId: string; institution: string; isPaper: boolean; initialSyncCompleted: boolean };
export async function listAccounts(u: BrokerUser): Promise<VendorAccount[]> {
  const { data } = await client().accountInformation.listUserAccounts(auth(u));
  return data.map((a) => ({
    id: a.id, authorizationId: a.brokerage_authorization, institution: a.institution_name ?? '', isPaper: a.is_paper === true,
    initialSyncCompleted: a.sync_status?.transactions?.initial_sync_completed === true,
  }));
}

export const PAGE_LIMIT = 1000;
// One vendor page of an account's full history (TR-3): the chunked import reads one page per step and resumes by offset.
export async function fetchActivitiesPage(u: BrokerUser, accountId: string, offset: number, limit = PAGE_LIMIT): Promise<{ activities: Fetched[]; done: boolean }> {
  const { data } = await client().accountInformation.getAccountActivities({ ...auth(u), accountId, type: 'BUY,SELL', offset, limit });
  return { activities: toActivities(accountId, data.data ?? []), done: (data.data?.length ?? 0) < limit };
}

// Open positions (TR-4) as symbol + unrealized percent only; never units, prices or amounts.
export type VendorPosition = { symbol: string; unrealizedPct: number };
export function unrealizedPct(p: { units?: string | number | null; price?: string | number | null; cost_basis?: string | number | null }): number | null {
  const units = Number(p.units), price = Number(p.price), cost = Number(p.cost_basis);
  if (!(units > 0) || !(price > 0) || !(cost > 0)) return null;
  return (price * units - cost) / cost;
}
export async function fetchPositions(u: BrokerUser, accountId: string): Promise<VendorPosition[]> {
  const { data } = await client().accountInformation.getAllAccountPositions({ ...auth(u), accountId });
  const out: VendorPosition[] = [];
  for (const p of data.results ?? []) {
    const symbol = (p.instrument as { symbol?: string } | undefined)?.symbol;
    const pct = unrealizedPct(p);
    if (symbol && pct !== null && !p.cash_equivalent) out.push({ symbol, unrealizedPct: pct });
  }
  return out;
}

// Decline, expiry or no real account: the link is removed at the vendor (F-1 consent decision).
export async function deleteConnection(u: BrokerUser, authorizationId: string): Promise<void> {
  await client().connections.deleteConnection({ ...auth(u), connectionId: authorizationId });
}
// Profile deletion (POLICY P6) and the end of a brokerage-first attempt that never became a user.
export async function deleteUser(u: BrokerUser): Promise<void> {
  await client().authentication.deleteSnapTradeUser({ userId: u.snaptradeUserId });
}

function toActivities(accountId: string, rows: { id?: string; symbol?: { symbol?: string } | null; option_symbol?: unknown; trade_date?: string | null; price?: number; units?: number; fee?: number; type?: string }[]): Fetched[] {
  const out: Fetched[] = [];
  for (const a of rows) {
    const symbol = a.symbol?.symbol;
    // ponytail: equities/ETFs/crypto only; options need contract-level matching (Phase 2)
    if (!a.id || !symbol || a.option_symbol || !a.trade_date || !a.price || !a.units) continue;
    if (a.type !== 'BUY' && a.type !== 'SELL') continue;
    out.push({
      externalId: a.id, accountId, symbol, side: a.type, units: Math.abs(a.units), price: a.price, fee: Math.abs(a.fee ?? 0),
      executedAt: new Date(a.trade_date), verified: true, raw: a,
    });
  }
  return out;
}

export async function listAccountIds(u: BrokerUser): Promise<string[]> {
  const { data } = await client().accountInformation.listUserAccounts({ userId: u.snaptradeUserId, userSecret: decrypt(u.secretEnc) });
  return data.map((a) => a.id);
}

// `accountIds` limits the fetch to accounts already cleared by the TR-6 claim.
export async function fetchActivities(u: BrokerUser, since: Date, accountIds?: string[]): Promise<Fetched[]> {
  const st = client();
  const auth = { userId: u.snaptradeUserId, userSecret: decrypt(u.secretEnc) };
  const accounts = accountIds ? accountIds.map((id) => ({ id })) : (await st.accountInformation.listUserAccounts(auth)).data;
  const out: Fetched[] = [];

  for (const account of accounts) {
    for (let offset = 0; ; offset += 1000) {
      const { data } = await st.accountInformation.getAccountActivities({
        ...auth, accountId: account.id, startDate: since, type: 'BUY,SELL', offset, limit: 1000,
      });
      out.push(...toActivities(account.id, data.data ?? []));
      if ((data.data?.length ?? 0) < 1000) break;
    }
  }
  return out;
}
