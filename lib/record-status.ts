// F-11 / D-12 / fix #4: the one record status-line model (docs/features/F-11-record-status-line.md, plan
// docs/features/logs/fixes-labels/plan.md §1 "Status rules"). Pure: the facts come from lib/record-status-load.ts and
// `now` is the caller's request time, so "updated" is always derived from the last successful sync (last_synced_at,
// written only by a completed rebuild), never from when syncs are planned, the render clock or a cache. `'live'` is for dynamic pages
// (relative time beside the absolute date); `'static'` is for images and cached renders (absolute dates with the year).
// The .tsx (app/status-line.tsx) renders `segments()` only, so every word is unit-tested here.
import type { PublicState } from './connections.ts';
import { connectedLine, STATUS_LINE as S } from './copy.ts';
import { dateText, relativeText } from './date-text.ts';

export const IDLE_DAYS = 30;
const IDLE_MS = IDLE_DAYS * 86_400_000;

export type StatusAccount = { id: string; isPaper: boolean; removedAt: Date | null; institution?: string | null };
export type StatusConnection = { id: number; consentAt: Date; disconnectedAt: Date | null; institution: string | null; accounts: StatusAccount[] };
// source: 'filing' is an F-7 public filing profile (its own freshness rules; no line here). 'none': no consented
// connection, no pre-F-1 claim and no demo data.
export type StatusFacts = {
  source: 'broker' | 'demo' | 'filing' | 'none'; state: PublicState;
  firstEntry: Date | null; lastClose: Date | null; lastSyncedAt: Date | null;
  // Today's "Connected:" inputs (lib/connections.ts#recordInstitutions, the profile's account count), used as-is while no
  // connection is disconnected so the line reads exactly as before.
  brokers: string[]; accounts: number;
  // Consented connections in the `connected` state, in link order.
  connections: StatusConnection[];
};
export type PartTime = { iso: string; abs: string; rel?: string };
// `text` is the part in words; when `time` is set its shown form (`rel (abs)` or `abs`) occurs in `text`.
export type Part = { text: string; time?: PartTime };
export type StatusLine = {
  show: boolean;
  line1: Part[]; line2: Part[]; accounts: Part[];
  // The feed card's line: only a frozen or idle record says anything there.
  card: Part[];
  frozen: Date | null; idle: boolean;
};
export type Mode = 'live' | 'static';
// `iso`: a dated segment (<time dateTime>); `title`: a relative segment's absolute date (the <time>'s tooltip).
export type Segment = { text: string; iso?: string; title?: string };

const NONE: StatusLine = { show: false, line1: [], line2: [], accounts: [], card: [], frozen: null, idle: false };

// Every consented connected connection disconnected → the latest disconnect; else null (a legacy or demo record has none).
export function frozenAt(connections: StatusConnection[]): Date | null {
  if (!connections.length || connections.some((c) => !c.disconnectedAt)) return null;
  return new Date(Math.max(...connections.map((c) => c.disconnectedAt!.getTime())));
}

// ponytail: idle is per record (users.last_synced_at) — a per-connection last_synced_at would let each account say it
// The record's reference time (its last successful sync, else its earliest live consent: a record that has not synced
// yet right after connecting is not idle) when it is 30 days old or more and the record is not frozen; else null.
export function idleSince(f: Pick<StatusFacts, 'lastSyncedAt' | 'connections'>, now: Date): Date | null {
  if (frozenAt(f.connections)) return null;
  const live = f.connections.filter((c) => !c.disconnectedAt);
  if (!live.length) return null;
  const ref = f.lastSyncedAt ?? new Date(Math.min(...live.map((c) => c.consentAt.getTime())));
  return now.getTime() - ref.getTime() >= IDLE_MS ? ref : null;
}

// Real accounts of the consented connections, each once, in link order → "Account i of n"; empty when n < 2.
export function accountLabels(connections: StatusConnection[]): Map<string, string> {
  const ids = realAccounts(connections).map((a) => a.id);
  return ids.length < 2 ? new Map() : new Map(ids.map((id, i) => [id, S.accountOf(i + 1, ids.length)]));
}

function realAccounts(connections: StatusConnection[]): (StatusAccount & { connection: StatusConnection })[] {
  const seen = new Set<string>();
  const out: (StatusAccount & { connection: StatusConnection })[] = [];
  for (const c of [...connections].sort((a, b) => a.id - b.id)) {
    for (const a of c.accounts) if (!a.isPaper && !seen.has(a.id)) { seen.add(a.id); out.push({ ...a, connection: c }); }
  }
  return out;
}

const institutionOf = (c: StatusConnection, a?: StatusAccount) => (a?.institution ?? '').trim() || (c.institution ?? '').trim() || (c.accounts.find((x) => (x.institution ?? '').trim())?.institution ?? '').trim() || 'The broker';

export function statusParts(f: StatusFacts, now: Date, mode: Mode): StatusLine {
  if (f.state === 'importing' || f.state === 'failed' || f.source === 'none' || f.source === 'filing' || !f.firstEntry) return NONE;
  // Design system R3: the web year rule ('auto') for last close; the year always on images and cached renders, and
  // always for the record's own dates (since, disconnect, removal, idle), which the council writes ‹Mon D, YYYY›.
  const year = mode === 'static' ? 'always' : 'auto';
  const t = (d: Date, y: 'auto' | 'always' = year, rel = false): PartTime => ({ iso: d.toISOString(), abs: dateText(d, now, { year: y }), ...(rel && mode === 'live' ? { rel: now.getTime() - d.getTime() < 60_000 ? S.justNow : relativeText(d, now) } : {}) });
  const dated = (d: Date, words: (abs: string) => string, y: 'auto' | 'always' = year): Part => { const time = t(d, y); return { text: words(time.abs), time }; };
  const long = (d: Date, words: (abs: string) => string) => dated(d, words, 'always');
  const since = long(f.firstEntry, S.since);
  const lastClose = f.lastClose ? [dated(f.lastClose, S.lastClose)] : [];
  if (f.source === 'demo') return { ...NONE, show: true, line1: [since, { text: S.demoLink }] };

  const frozen = frozenAt(f.connections);
  const idleRef = idleSince(f, now);
  const gone = f.connections.filter((c) => c.disconnectedAt);
  let line1: Part[];
  let line2: Part[];
  let card: Part[] = [];
  if (frozen) {
    const part = long(frozen, S.frozen);
    line1 = [since, part];
    line2 = lastClose; // frozen wins: no "updated", no idle
    card = [part];
  } else {
    if (gone.length) {
      const live = realAccounts(f.connections.filter((c) => !c.disconnectedAt)).filter((a) => !a.removedAt);
      const insts = [...new Set(live.map((a) => institutionOf(a.connection, a)))];
      line1 = [since, { text: connectedLine(insts, live.length) }, ...gone.map((c) => long(c.disconnectedAt!, (d) => S.instDisconnected(institutionOf(c), d)))];
    } else {
      line1 = [since, { text: connectedLine(f.brokers, f.accounts) }];
    }
    if (idleRef) {
      const part = long(idleRef, S.idle);
      line2 = [...lastClose, part];
      card = [{ ...part, text: part.text[0].toUpperCase() + part.text.slice(1) }]; // the card's line starts a sentence
    } else if (f.lastSyncedAt) {
      const time = t(f.lastSyncedAt, year, true);
      line2 = [...lastClose, { text: S.updated(time.rel ?? time.abs), time }];
    } else {
      line2 = lastClose;
    }
  }

  const labels = accountLabels(f.connections);
  const real = realAccounts(f.connections);
  const accounts: Part[] = labels.size
    ? real.map((a) => (a.removedAt ? long(a.removedAt, (d) => S.accountLine(labels.get(a.id)!, S.removed(d))) : { text: S.accountLine(labels.get(a.id)!, institutionOf(a.connection, a)) }))
    : real.length === 1 && real[0].removedAt ? [long(real[0].removedAt, S.removed)] : [];
  return { show: true, line1, line2, accounts, card, frozen, idle: !!idleRef };
}

// Parts → render segments joined by ' · '. A dated part splits around its shown date, which becomes a segment with an
// ISO `iso` (rendered as <time dateTime>); a relative time is a <time> whose datetime is the absolute instant and whose
// title is the absolute date. Relative times exist in live mode only (dynamic pages, computed at request time).
export function segments(parts: Part[]): Segment[] {
  const out: Segment[] = [];
  parts.forEach((p, i) => {
    if (i) out.push({ text: ' · ' });
    const shown = p.time ? (p.time.rel ?? p.time.abs) : null;
    const at = shown ? p.text.lastIndexOf(shown) : -1;
    if (!shown || at < 0) { out.push({ text: p.text }); return; }
    if (at > 0) out.push({ text: p.text.slice(0, at) });
    out.push({ text: shown, iso: p.time!.iso, ...(p.time!.rel ? { title: p.time!.abs } : {}) });
    if (at + shown.length < p.text.length) out.push({ text: p.text.slice(at + shown.length) });
  });
  return out;
}

// The feed card's segments (static: the feed page's rows are also sent by the paging action and may be shown later):
// a frozen or idle record only, else undefined (nothing renders).
export function cardSegments(f: StatusFacts | undefined, now: Date): Segment[] | undefined {
  const l = f && statusParts(f, now, 'static');
  return l?.show && l.card.length ? segments(l.card) : undefined;
}
// The trade and month pages (dynamic, live): line 1 then line 2, the first line of "Their whole record".
export function recordSegments(f: StatusFacts | null | undefined, now: Date): Segment[] | undefined {
  const l = f ? statusParts(f, now, 'live') : null;
  return l?.show ? segments([...l.line1, ...l.line2]) : undefined;
}
// Trade and month images: a frozen record's line, absolute date with the year, never relative; else null.
export function imageFrozenText(f: StatusFacts | null | undefined, now: Date): string | null {
  const l = f ? statusParts(f, now, 'static') : null;
  return l?.show && l.frozen ? S.frozen(dateText(l.frozen, now, { year: 'always' })) : null;
}
// The pane's segments (static: the pane JSON is cached 60 s): line 1 without "Record since" (the pane says since when
// already), then line 2.
export function paneSegments(f: StatusFacts | undefined, now: Date): Segment[] | undefined {
  const l = f && statusParts(f, now, 'static');
  const parts = l?.show ? [...l.line1.slice(1), ...l.line2] : [];
  return parts.length ? segments(parts) : undefined;
}
