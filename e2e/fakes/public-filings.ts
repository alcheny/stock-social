// In-repo fake of the public filing system for F-7 tests (never on the internet). Fictional filers, issuers and symbols
// only (POLICY T1/T2, legal C23). It serves a daily structured index and the filings it lists, shaped like the real
// report generically: issuer symbol, reporting owner id and name, relationship flags, a non-derivative table (date,
// code, shares, price, acquired/disposed, shares owned after, direct/indirect) and a derivative table, plus the parts
// the importer must never keep (address, signature, remarks, footnotes, an indirect holding's label).
//   GET  /index/<YYYY-MM-DD>.json   {filings: [{id, url, filedAt, amends?}]}; 404 for a day with no index
//   GET  /filings/<id>.xml          the filing
//   POST /_scenario {filings: FakeFiling[], fail?: {status, times}} or {name: '429' | '5xx' | 'amendment' | 'unreconciled'}
//   POST /_fail {status, times}     the next `times` requests answer `status`
//   GET  /_state                    {requests: [{at, path, ua}]} for assertions (times in ms, the User-Agent header)
import { createServer, type Server } from 'node:http';

export type FakeRow = { date: string; code: string; units: number; price?: number | null; ad: 'A' | 'D'; after?: number | null; indirect?: boolean };
export type FakeOwner = { key: string; name: string; director?: boolean; officer?: boolean; tenPercent?: boolean; other?: boolean };
export type FakeFiling = { id: string; day: string; filedAt?: string; amends?: string; owner: FakeOwner; owners?: FakeOwner[]; symbol: string; rows: FakeRow[]; derivative?: FakeRow[] };

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const v = (tag: string, x: unknown) => (x === null || x === undefined ? '' : `<${tag}><value>${esc(String(x))}</value></${tag}>`);
const flag = (tag: string, b?: boolean) => `<${tag}>${b ? '1' : '0'}</${tag}>`;
const row = (tag: string, r: FakeRow) => `<${tag}>${v('securityTitle', 'Common Stock')}${v('transactionDate', r.date)}
  <transactionCoding><transactionFormType>X</transactionFormType><transactionCode>${r.code}</transactionCode></transactionCoding>
  <transactionAmounts>${v('transactionShares', r.units)}${v('transactionPricePerShare', r.price)}${v('transactionAcquiredDisposedCode', r.ad)}</transactionAmounts>
  <postTransactionAmounts>${v('sharesOwnedFollowingTransaction', r.after)}</postTransactionAmounts>
  <ownershipNature>${v('directOrIndirectOwnership', r.indirect ? 'I' : 'D')}${r.indirect ? v('natureOfOwnership', 'By Fictional Family Holding Trust') : ''}</ownershipNature>
  <footnoteId id="F1"/></${tag}>`;
const owner = (o: FakeOwner) => `<reportingOwner><reportingOwnerId><rptOwnerCik>${esc(o.key)}</rptOwnerCik><rptOwnerName>${esc(o.name)}</rptOwnerName></reportingOwnerId>
  <reportingOwnerAddress><rptOwnerStreet1>1 Imaginary Lane</rptOwnerStreet1><rptOwnerCity>Nowhereville</rptOwnerCity></reportingOwnerAddress>
  <reportingOwnerRelationship>${flag('isDirector', o.director)}${flag('isOfficer', o.officer)}${flag('isTenPercentOwner', o.tenPercent)}${flag('isOther', o.other)}<officerTitle>Chief Imaginary Officer</officerTitle></reportingOwnerRelationship></reportingOwner>`;

export function filingXml(f: FakeFiling): string {
  return `<?xml version="1.0"?>
<!-- fictional fixture -->
<ownershipDocument><schemaVersion>X1</schemaVersion><periodOfReport>${f.rows[0]?.date ?? f.day}</periodOfReport>
<issuer><issuerCik>0000000001</issuerCik><issuerName>Fictional Widgets &amp; Gadgets Co</issuerName><issuerTradingSymbol>${esc(f.symbol)}</issuerTradingSymbol></issuer>
${(f.owners ?? [f.owner]).map(owner).join('\n')}
<nonDerivativeTable>${f.rows.map((r) => row('nonDerivativeTransaction', r)).join('\n')}
<nonDerivativeHolding>${v('securityTitle', 'Common Stock')}<postTransactionAmounts>${v('sharesOwnedFollowingTransaction', 999)}</postTransactionAmounts></nonDerivativeHolding></nonDerivativeTable>
<derivativeTable>${(f.derivative ?? []).map((r) => row('derivativeTransaction', r)).join('\n')}</derivativeTable>
<footnotes><footnote id="F1">Fictional footnote text that must never be stored.</footnote></footnotes>
<remarks>Fictional remarks that must never be stored.</remarks>
<ownerSignature><signatureName>Fictional Signer</signatureName><signatureDate>${f.day}</signatureDate></ownerSignature>
</ownershipDocument>`;
}

const DIRECTOR = { key: '9000000001', name: 'Rowan Fictional', director: true };
const OFFICER = { key: '9000000002', name: 'Quinn Imaginary', officer: true };
/** Named scenarios: fictional filers on fixed past days. */
export function namedScenario(name: string): { filings: FakeFiling[]; fail?: { status: number; times: number } } {
  const buy: FakeFiling = { id: 'fx-0001', day: '2026-03-02', owner: DIRECTOR, symbol: 'QZXA', rows: [{ date: '2026-02-27', code: 'P', units: 100, price: 10, ad: 'A', after: 100 }] };
  const sell: FakeFiling = { id: 'fx-0002', day: '2026-03-03', owner: DIRECTOR, symbol: 'QZXA', rows: [{ date: '2026-03-02', code: 'S', units: 100, price: 12, ad: 'D', after: 0 }] };
  if (name === '429' || name === '5xx') return { filings: [buy, sell], fail: { status: name === '429' ? 429 : 503, times: 99 } };
  if (name === 'amendment') return { filings: [buy, sell, { ...buy, id: 'fx-0003', day: '2026-03-04', amends: 'fx-0001', rows: [{ ...buy.rows[0], price: 8 }] }] };
  if (name === 'unreconciled') return { filings: [buy, { ...sell, rows: [{ ...sell.rows[0], units: 50, after: 20 }] }] };
  return { filings: [buy, sell, { id: 'fx-0004', day: '2026-03-03', owner: OFFICER, symbol: 'QZXB', rows: [{ date: '2026-03-02', code: 'P', units: 10, price: 5, ad: 'A', after: 10 }] }] };
}

export const fakeFilingUrl = (id: string) => `https://filings.example.test/view/${id}`;

export function startPublicFilingsFake(port: number): Promise<{ server: Server; base: string }> {
  let filings: FakeFiling[] = [];
  let fail = { status: 0, times: 0 };
  const requests: { at: number; path: string; ua: string }[] = [];
  const base = `http://127.0.0.1:${port}`;
  const server = createServer(async (req, res) => {
    const path = (req.url ?? '/').split('?')[0];
    let body = '';
    for await (const c of req) body += c;
    const json = (code: number, x: unknown) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(x)); };
    if (path === '/_state') return json(200, { requests });
    if (path === '/_scenario') {
      const s = JSON.parse(body || '{}');
      const n = s.name ? namedScenario(s.name) : s;
      filings = n.filings ?? []; fail = n.fail ?? { status: 0, times: 0 }; requests.length = 0;
      return json(200, { ok: true });
    }
    if (path === '/_fail') { fail = JSON.parse(body); return json(200, { ok: true }); }
    requests.push({ at: Date.now(), path, ua: String(req.headers['user-agent'] ?? '') });
    if (fail.times > 0) { fail.times--; res.writeHead(fail.status); return res.end(); }
    const day = path.match(/^\/index\/(\d{4}-\d{2}-\d{2})\.json$/)?.[1];
    if (day) {
      const list = filings.filter((f) => f.day === day);
      if (!list.length) { res.writeHead(404); return res.end(); }
      return json(200, { filings: list.map((f) => ({ id: f.id, url: fakeFilingUrl(f.id), filedAt: f.filedAt ?? `${f.day}T21:00:00Z`, ...(f.amends ? { amends: f.amends } : {}) })) });
    }
    const id = path.match(/^\/filings\/([\w-]+)\.xml$/)?.[1];
    const f = filings.find((x) => x.id === id);
    if (!f) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': 'application/xml' });
    res.end(filingXml(f));
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve({ server, base })));
}

export async function setScenario(base: string, s: { name: string } | { filings: FakeFiling[]; fail?: { status: number; times: number } }) {
  await fetch(`${base}/_scenario`, { method: 'POST', body: JSON.stringify(s) });
}
export const fakeState = async (base: string) => (await (await fetch(`${base}/_state`)).json()) as { requests: { at: number; path: string; ua: string }[] };
