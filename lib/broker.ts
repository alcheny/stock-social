// The ONLY file that talks to SnapTrade (docs/DESIGN.md §2.1). Swapping vendors changes this file.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { Snaptrade, SnaptradeAuth } from 'snaptrade-typescript-sdk';
import type { AccountPosition, AccountUniversalActivity, OptionInstrument } from 'snaptrade-typescript-sdk';
import type { Activity } from './trades.ts';
// OPTIONS (docs/features/logs/options/plan.md D2, D7): option rows and option positions are parsed here (the vendor's
// field names stay in this file) and handed to an optional sink; the share path below is unchanged.
import { isOccSymbol, multiplierOf, strikeMilli, validExpiry, type OptionRow } from './options.ts';

// SNAPTRADE_BASE_URL points the SDK at the in-repo fake in tests (e2e/fakes/vendor.ts); unset, the SDK uses the vendor.
const client = () =>
  new Snaptrade({
    auth: SnaptradeAuth.commercialApiKey({
      clientId: process.env.SNAPTRADE_CLIENT_ID!,
      consumerKey: process.env.SNAPTRADE_CONSUMER_KEY!,
    }),
    basePath: process.env.SNAPTRADE_BASE_URL || undefined,
  });

// F-1 fix round 3: every vendor request is bounded. Syncs and import steps call the vendor inside their transaction,
// under the per-user lock; an unbounded hung request could hold both past the sync tick's 10-minute claim lease. Each
// request gets VENDOR_TIMEOUT_MS from its start, covering the SDK's own waits between rate-limit retries: the request is
// aborted and the call fails with VendorTimeoutError, which callers treat like a transport error (the transaction rolls
// back; an import step keeps its cursor and backs off; a sync is retried next round). `vendorTimeout.ms` is a test hook.
export const VENDOR_TIMEOUT_MS = 30_000;
export const vendorTimeout = { ms: VENDOR_TIMEOUT_MS };
export class VendorTimeoutError extends Error {
  name = 'VendorTimeoutError';
  constructor(ms: number) { super(`vendor request timed out after ${ms} ms`); }
}
async function bounded<T>(call: (options: { signal: AbortSignal; timeout: number }) => Promise<T>): Promise<T> {
  const ms = vendorTimeout.ms;
  const abort = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise<never>((_, reject) => {
    timer = setTimeout(() => { abort.abort(); reject(new VendorTimeoutError(ms)); }, ms);
  });
  try {
    return await Promise.race([call({ signal: abort.signal, timeout: ms }), expired]);
  } finally {
    clearTimeout(timer);
  }
}

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
  const { data } = await bounded((o) => client().authentication.registerSnapTradeUser({ userId }, o));
  return { snaptradeUserId: data.userId!, secretEnc: encrypt(data.userSecret!) };
}

// Read-only connection: we can never place trades or move money.
export async function connectUrl(u: BrokerUser, returnTo: string): Promise<string> {
  const { data } = await bounded((o) => client().authentication.loginSnapTradeUser({
    userId: u.snaptradeUserId,
    userSecret: decrypt(u.secretEnc),
    connectionType: 'read',
    customRedirect: returnTo,
    darkMode: true,
  }, o));
  if (!('redirectURI' in data) || !data.redirectURI) throw new Error('SnapTrade returned no redirect URI');
  return data.redirectURI;
}

type Fetched = Activity & { raw: unknown };
const auth = (u: BrokerUser) => ({ userId: u.snaptradeUserId, userSecret: decrypt(u.secretEnc) });

// Zero-depth link validation (F-1): the accounts under the login with the vendor's paper flag and whether the
// vendor's own initial transaction sync has finished. No activities are read here.
export type VendorAccount = { id: string; authorizationId: string; institution: string; isPaper: boolean; initialSyncCompleted: boolean };
export async function listAccounts(u: BrokerUser): Promise<VendorAccount[]> {
  const { data } = await bounded((o) => client().accountInformation.listUserAccounts(auth(u), o));
  return data.map((a) => ({
    id: a.id, authorizationId: a.brokerage_authorization, institution: a.institution_name ?? '', isPaper: a.is_paper === true,
    initialSyncCompleted: a.sync_status?.transactions?.initial_sync_completed === true,
  }));
}

export const PAGE_LIMIT = 1000;
// OPTIONS (AC 12): the three option event types, added to the activity type filter through this one list. The filter is
// the share types plus each list; another importer's types join with one more spread in ACTIVITY_TYPES.
export const OPTION_EVENT_TYPES = ['OPTIONEXPIRATION', 'OPTIONASSIGNMENT', 'OPTIONEXERCISE'] as const;
export const ACTIVITY_TYPES = ['BUY', 'SELL', ...OPTION_EVENT_TYPES].join(',');
export type OptionSink = (rows: (OptionRow & { raw: unknown })[]) => void;
// One vendor page of an account's full history (TR-3): the chunked import reads one page per step and resumes by offset.
export async function fetchActivitiesPage(u: BrokerUser, accountId: string, offset: number, limit = PAGE_LIMIT, optionSink?: OptionSink): Promise<{ activities: Fetched[]; done: boolean }> {
  const { data } = await bounded((o) => client().accountInformation.getAccountActivities({ ...auth(u), accountId, type: ACTIVITY_TYPES, offset, limit }, o));
  optionSink?.(toOptionRows(accountId, data.data ?? [])); // OPTIONS
  return { activities: toActivities(accountId, data.data ?? []), done: (data.data?.length ?? 0) < limit };
}

// Open positions (TR-4) as symbol + unrealized percent only; never units, prices or amounts.
// The vendor SDK documents both cost fields as per unit, not as the lot total: the account position's `cost_basis` is
// "Book price or average purchase price for the position" and the older position model's `average_purchase_price` is
// "Cost basis _per share_"; `price` is the "Last known market price _per share_". So the percent is
// (price - per-unit cost) / per-unit cost; units only gate long positions (long-only, like the FIFO matcher).
// When both cost fields are present `average_purchase_price` wins (its doc is unambiguous); `cost_basis` is the fallback.
export type VendorPosition = { symbol: string; unrealizedPct: number };
type Num = string | number | null | undefined;
export function unrealizedPct(p: { units?: Num; price?: Num; cost_basis?: Num; average_purchase_price?: Num }): number | null {
  const units = Number(p.units), price = Number(p.price);
  const avg = Number(p.average_purchase_price ?? NaN), basis = Number(p.cost_basis ?? NaN);
  const cost = avg > 0 ? avg : basis;
  if (!(units > 0) || !(price > 0) || !(cost > 0)) return null;
  return (price - cost) / cost;
}
export async function fetchPositions(u: BrokerUser, accountId: string, optionSink?: PositionSink): Promise<VendorPosition[]> {
  const { data } = await bounded((o) => client().accountInformation.getAllAccountPositions({ ...auth(u), accountId }, o));
  const out: VendorPosition[] = [];
  // OPTIONS (D7, E1): options and futures-type kinds never reach open_positions (an OCC symbol carries the strike).
  const { equityLike, split } = splitPositionKinds(data.results ?? []);
  optionSink?.(split);
  for (const p of equityLike) {
    const symbol = (p.instrument as { symbol?: string } | undefined)?.symbol;
    const pct = unrealizedPct(p);
    if (symbol && pct !== null && !p.cash_equivalent) out.push({ symbol, unrealizedPct: pct });
  }
  return out;
}

// Decline, expiry or no real account: the link is removed at the vendor (F-1 consent decision).
export async function deleteConnection(u: BrokerUser, authorizationId: string): Promise<void> {
  await bounded((o) => client().connections.deleteConnection({ ...auth(u), connectionId: authorizationId }, o));
}
// Profile deletion (POLICY P6) and the end of a brokerage-first attempt that never became a user.
export async function deleteUser(u: BrokerUser): Promise<void> {
  await bounded((o) => client().authentication.deleteSnapTradeUser({ userId: u.snaptradeUserId }, o));
}

// ---- OPTIONS (docs/features/logs/options/plan.md D2, D7). Separate from the share path above so another importer's
// changes to it merge without touching these.
// ponytail: K1 option trades are not on feed cards and the pane's last-5 list is shares only — when feed cards come, cap
// the ranking size term at 100% for options (long losses stop at -100%, so uncapped gains would tilt toward winners).
// ponytail: K2 no per-trade share card for options (follows K3); the record card carries the label and the line.
// ponytail: K3 no option trade page, theses or likes on option trades — build them on option_trades.close_id.
// ponytail: K4 similar, compare, recap, /me/record and the import banner count ignore options — read lib/options-load.ts there.
// ponytail: K5 a corporate action on the underlying during a hold is caught only when the OCC root changes — taint the
// contract from corporate-action rows once that importer is wired.
// ponytail: K6 cash-settled exercise is not priced and index underlyings are outside the allowlist — price it from the
// settlement amount if index options are ever in scope (they are not: COMPLIANCE §2).
// K7 (per-cause counts) is at lib/options.ts#CAUSES; K8 (the exercise-day share rule) at lib/options-sync.ts#rebuildRecord.
// ponytail: K9 consents before consent_scope_hash have no wording version, so those traders stay gated — a re-consent
// prompt (K10) writes the current hash.
const isOptionRow = (a: { type?: string; option_symbol?: unknown; option_type?: string; symbol?: { symbol?: string } | null }) =>
  !!a.option_symbol || (OPTION_EVENT_TYPES as readonly string[]).includes(a.type ?? '') || (!!a.option_type && !a.symbol?.symbol);
const num = (x: unknown): number | null => (typeof x === 'number' && Number.isFinite(x) ? x : null);
export function toOptionRows(accountId: string, rows: AccountUniversalActivity[]): (OptionRow & { raw: unknown })[] {
  const out: (OptionRow & { raw: unknown })[] = [];
  for (const a of rows) {
    if (!a.id || !isOptionRow(a)) continue;
    const os = a.option_symbol ?? null;
    const at = a.trade_date ? new Date(a.trade_date) : null;
    const units = num(a.units);
    out.push({
      externalId: a.id, accountId, kind: a.type ?? null, openClose: a.option_type ?? null,
      underlying: os?.underlying_symbol?.symbol ?? null, underlyingType: os?.underlying_symbol?.type?.code ?? null,
      right: os?.option_type ?? null, expiry: validExpiry(os?.expiration_date), strikeMilli: os ? strikeMilli(os.strike_price) : null,
      multiplier: os ? multiplierOf(os.is_mini_option) : null, occTicker: os?.ticker ?? null,
      units: units === null ? null : Math.abs(units), price: num(a.price), fee: num(a.fee) === null ? null : Math.abs(a.fee!),
      amount: num(a.amount), currency: a.currency?.code ?? null, executedAt: at && !Number.isNaN(at.getTime()) ? at : null, verified: true, raw: a,
    });
  }
  return out;
}

// D7: an open option position as percent per share (the SDK: `cost_basis` "For options, this is per-share", `price` per
// share), so no multiplier. Long only; shorts and futures-type kinds are counts.
export type OptionPosition = { positionKey: string; underlying: string; right: 'CALL' | 'PUT'; expiry: string; unrealizedPct: number };
export type PositionSplit = { options: OptionPosition[]; short: number; unsupported: number };
export type PositionSink = (s: PositionSplit) => void;
const UNSUPPORTED_KINDS = ['future', 'future_option', 'cfd'];
const OPTION_UNDERLYING_KINDS = ['stock', 'etf', 'adr', 'cef'];
export function splitPositionKinds(results: AccountPosition[]): { equityLike: AccountPosition[]; split: PositionSplit } {
  const equityLike: AccountPosition[] = [];
  const split: PositionSplit = { options: [], short: 0, unsupported: 0 };
  for (const p of results) {
    const kind = (p.instrument as { kind?: string } | undefined)?.kind;
    if (kind === 'option') {
      const o = p.instrument as OptionInstrument;
      const units = Number(p.units), price = Number(p.price), cost = Number(p.cost_basis);
      const expiry = validExpiry(o.expiration_date), sm = strikeMilli(o.strike_price);
      const underlying = o.underlying?.symbol;
      if (units < 0) { split.short++; continue; }
      if (!underlying || !OPTION_UNDERLYING_KINDS.includes(o.underlying?.kind) || !expiry || sm === null || (o.option_type !== 'CALL' && o.option_type !== 'PUT')
        || !(units > 0) || !(price >= 0) || !(cost > 0)) { split.unsupported++; continue; }
      split.options.push({ positionKey: [underlying, expiry, o.option_type, sm, Number(o.multiplier) || 100].join('|'), underlying, right: o.option_type, expiry, unrealizedPct: (price - cost) / cost });
    } else if (UNSUPPORTED_KINDS.includes(kind ?? '') || isOccSymbol((p.instrument as { symbol?: string } | undefined)?.symbol)) split.unsupported++;
    else equityLike.push(p);
  }
  return { equityLike, split };
}

function toActivities(accountId: string, rows: { id?: string; symbol?: { symbol?: string } | null; option_symbol?: unknown; trade_date?: string | null; price?: number; units?: number; fee?: number; type?: string }[]): Fetched[] {
  const out: Fetched[] = [];
  for (const a of rows) {
    const symbol = a.symbol?.symbol;
    // Option rows go to toOptionRows (OPTIONS, K1–K9 above); this path is shares, ETFs and crypto.
    if (!a.id || !symbol || a.option_symbol || !a.trade_date || !a.price || !a.units) continue;
    if (a.type !== 'BUY' && a.type !== 'SELL') continue;
    out.push({
      externalId: a.id, accountId, symbol, side: a.type, units: Math.abs(a.units), price: a.price, fee: Math.abs(a.fee ?? 0),
      executedAt: new Date(a.trade_date), verified: true, raw: a,
    });
  }
  return out;
}

// `accountIds` limits the fetch to accounts already cleared by the TR-6 claim.
export async function fetchActivities(u: BrokerUser, since: Date, accountIds?: string[], optionSink?: OptionSink): Promise<Fetched[]> {
  const st = client();
  const auth = { userId: u.snaptradeUserId, userSecret: decrypt(u.secretEnc) };
  const accounts = accountIds ? accountIds.map((id) => ({ id })) : (await bounded((o) => st.accountInformation.listUserAccounts(auth, o))).data;
  const out: Fetched[] = [];

  for (const account of accounts) {
    for (let offset = 0; ; offset += 1000) {
      const { data } = await bounded((o) => st.accountInformation.getAccountActivities({
        ...auth, accountId: account.id, startDate: since, type: ACTIVITY_TYPES, offset, limit: 1000,
      }, o));
      optionSink?.(toOptionRows(account.id, data.data ?? [])); // OPTIONS
      out.push(...toActivities(account.id, data.data ?? []));
      if ((data.data?.length ?? 0) < 1000) break;
    }
  }
  return out;
}
