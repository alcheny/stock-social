// F-7 test fixtures (shared by lib/f7-*.test.ts and e2e/f7-*.spec.ts; not a test file itself). Fictional filers and
// symbols only (POLICY T1/T2, legal C23): a users row marked by public_filer_id with the epoch placeholder attestation
// and a never-completed placeholder attempt, its public_filers row (demo unless asked otherwise), and closed_trades
// rows that are never verified, each with a filing link and a feed floor. Every caller deletes its own rows.
import type postgres from 'postgres';

const DAY = 86_400_000;
export type F7Close = { symbol: string; r: number; daysAgo: number; hold?: number; feedAfterDaysAgo?: number };
export type F7Filer = {
  handle: string; name: string; demo?: boolean; hidden?: boolean;
  excluded?: Record<string, number>; openSymbols?: string[]; closes: F7Close[];
};
export const filingUrl = (handle: string, i: number) => `https://filings.example/${handle}/sale-${i}`;
export const buyFilingUrl = (handle: string, i: number) => `https://filings.example/${handle}/buy-${i}`;

export async function insertFiler(sql: postgres.Sql, f: F7Filer, now = Date.now()): Promise<{ userId: number; filerId: number }> {
  const [pf] = await sql`insert into public_filers (source, filer_key, demo, excluded, open_symbols, hidden_at)
    values ('insider_reports', ${`f7-${f.handle}`}, ${f.demo ?? true}, ${sql.json(f.excluded ?? {})}, ${f.openSymbols ?? []}, ${f.hidden ? new Date(now) : null}) returning id`;
  const [a] = await sql`insert into signup_attempts (method, adult_attested_at) values ('dev', ${new Date(0)}) returning id`;
  const [u] = await sql`insert into users (handle, display_name, adult_attested_at, signup_attempt_id, public_filer_id)
    values (${f.handle}, ${f.name}, ${new Date(0)}, ${a.id}, ${pf.id}) returning id`;
  if (f.closes.length) await sql`insert into closed_trades ${sql(f.closes.map((c, i) => ({
    user_id: u.id, sell_id: `pub:${f.handle}:${i}`, account_id: 'public', symbol: c.symbol,
    opened_at: new Date(now - (c.daysAgo + (c.hold ?? 3)) * DAY), closed_at: new Date(now - c.daysAgo * DAY),
    return_pct: c.r, holding_days: c.hold ?? 3, verified: false, filing_url: filingUrl(f.handle, i),
    feed_after: new Date(now - (c.feedAfterDaysAgo ?? 1) * DAY),
  })))}`;
  // The opening purchase of each close, raw and private (never rendered): only so the trade page can link its filing.
  await sql`insert into public_transactions ${sql(f.closes.map((c, i) => ({
    filer_id: pf.id, external_id: `${f.handle}-buy-${i}`, filing_id: `${f.handle}-buy-${i}`, filing_url: buyFilingUrl(f.handle, i),
    symbol: c.symbol, code: 'P', side: 'BUY', units: 4321, price: 98.76, held_after: 4321,
    executed_at: new Date(now - (c.daysAgo + (c.hold ?? 3)) * DAY), filed_at: new Date(now - (c.daysAgo + (c.hold ?? 3)) * DAY),
  })))}`;
  return { userId: u.id as number, filerId: pf.id as number };
}

// The raw rows' price and share count: never on any surface (AC 17).
export const RAW_AMOUNTS = ['4321', '4,321', '98.76'];

export async function deleteFilers(sql: postgres.Sql, handles: string[]): Promise<void> {
  if (!handles.length) return;
  const rows = await sql`select id, public_filer_id, signup_attempt_id from users where handle in ${sql(handles)}`;
  await sql`delete from users where handle in ${sql(handles)}`;
  const pf = rows.map((r) => r.public_filer_id).filter((x) => x !== null);
  const at = rows.map((r) => r.signup_attempt_id).filter((x) => x !== null);
  if (pf.length) await sql`delete from public_filers where id in ${sql(pf)}`;
  await sql`delete from public_filers where filer_key in ${sql(handles.map((h) => `f7-${h}`))}`;
  if (at.length) await sql`delete from signup_attempts where id in ${sql(at)}`;
}

export async function ensureImportState(sql: postgres.Sql): Promise<void> {
  await sql`insert into public_import_state (source, last_success_at) values ('insider_reports', now()) on conflict (source) do update set last_success_at = coalesce(public_import_state.last_success_at, now())`;
}
