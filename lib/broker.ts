// The ONLY file that talks to SnapTrade (docs/DESIGN.md §2.1). Swapping vendors changes this file.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { Snaptrade, SnaptradeAuth } from 'snaptrade-typescript-sdk';
import type { Activity } from './trades.ts';

const client = () =>
  new Snaptrade({
    auth: SnaptradeAuth.commercialApiKey({
      clientId: process.env.SNAPTRADE_CLIENT_ID!,
      consumerKey: process.env.SNAPTRADE_CONSUMER_KEY!,
    }),
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

export async function registerUser(appUserId: number): Promise<BrokerUser> {
  const userId = `stock-social-${appUserId}-${randomBytes(4).toString('hex')}`;
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
      for (const a of data.data ?? []) {
        const symbol = a.symbol?.symbol;
        // ponytail: equities/ETFs/crypto only; options need contract-level matching (Phase 2)
        if (!a.id || !symbol || a.option_symbol || !a.trade_date || !a.price || !a.units) continue;
        if (a.type !== 'BUY' && a.type !== 'SELL') continue;
        out.push({
          externalId: a.id, accountId: account.id, symbol, side: a.type,
          units: Math.abs(a.units), price: a.price, fee: Math.abs(a.fee ?? 0),
          executedAt: new Date(a.trade_date), verified: true, raw: a,
        });
      }
      if ((data.data?.length ?? 0) < 1000) break;
    }
  }
  return out;
}
