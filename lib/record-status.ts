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

// QA round 2 (N7), amended by the PR #85 review (B1, committee option b): a record whose live connections still list
// accounts but every real one of them is removed (and the rest of its connections are disconnected) has no account
// connected: line 1 says "No account connected since ‹d›" (the latest removal or disconnect). It is NOT frozen: "record
// frozen" comes only from disconnected_at (frozenAt: F3-3's confirmed, two-list disconnect), so a vendor list that
// flaps can never freeze a live record, and a connection without disconnected_at always shows the live line.
export function noAccountSince(connections: StatusConnection[]): Date | null {
  if (frozenAt(connections)) return null;
  const live = connections.filter((c) => !c.disconnectedAt);
  const real = realAccounts(live);
  if (!live.length || !real.length || real.some((a) => !a.removedAt)) return null;
  const times = [...real.map((a) => a.removedAt!.getTime()), ...connections.filter((c) => c.disconnectedAt).map((c) => c.disconnectedAt!.getTime())];
  return new Date(Math.max(...times));
}

// QA round 2 (N8): one date form per line. A dated part is built lazily and a line is rendered once its parts are known:
// the year shows on every date of the line when any of them needs it (static mode, a record date the council writes
// with the year, or a date outside now's year), else on none.
type Lazy = { text: string } | { d: Date; words: (abs: string) => string; year?: boolean; rel?: boolean };
// Merge with main (#10, A11Y-FIXES): `demoText` names a Demo record on line 1; the profile passes DEMO_PROFILE.line (it says
// "not a real broker record"), the trade and month pages keep "Demo data" (their strip label says the rest).
export function statusParts(f: StatusFacts, now: Date, mode: Mode, demoText: string = S.demoLink): StatusLine {
  if (f.state === 'importing' || f.state === 'failed' || f.source === 'none' || f.source === 'filing' || !f.firstEntry) return NONE;
  const yearOf = (d: Date) => d.getUTCFullYear();
  const render = (line: Lazy[]): Part[] => {
    const year = mode === 'static' || line.some((p) => 'd' in p && (p.year || yearOf(p.d) !== yearOf(now))) ? 'always' : 'auto';
    return line.map((p) => {
      if (!('d' in p)) return p;
      const time: PartTime = { iso: p.d.toISOString(), abs: dateText(p.d, now, { year }),
        ...(p.rel && mode === 'live' ? { rel: now.getTime() - p.d.getTime() < 60_000 ? S.justNow : relativeText(p.d, now) } : {}) };
      return { text: p.words(time.rel ?? time.abs), time };
    });
  };
  // Design system R3: the record's own dates (since, disconnect, removal, idle) are written ‹Mon D, YYYY›.
  const long = (d: Date, words: (abs: string) => string): Lazy => ({ d, words, year: true });
  const since = long(f.firstEntry, S.since);
  const lastClose: Lazy[] = f.lastClose ? [{ d: f.lastClose, words: S.lastClose }] : [];
  if (f.source === 'demo') return { ...NONE, show: true, line1: render([since, { text: demoText }]) };

  const frozen = frozenAt(f.connections);
  const idleRef = frozen ? null : idleSince(f, now);
  const gone = f.connections.filter((c) => c.disconnectedAt);
  let line1: Lazy[];
  let line2: Lazy[];
  let card: Lazy[] = [];
  if (frozen) {
    const part = long(frozen, S.frozen);
    line1 = [since, part];
    line2 = lastClose; // frozen wins: no "updated", no idle
    card = [part];
  } else {
    // "Connected:" counts the live (not removed) accounts once any account is removed or a connection disconnected
    // (QA round 1, finding 6); with none left, "No account connected since ‹d›" takes its place (B1: not frozen).
    const none = noAccountSince(f.connections);
    const live = realAccounts(f.connections.filter((c) => !c.disconnectedAt)).filter((a) => !a.removedAt);
    const connected: Lazy = none ? long(none, S.allRemoved) : { text: connectedLine([...new Set(live.map((a) => institutionOf(a.connection, a)))], live.length) };
    if (gone.length) {
      line1 = [since, connected, ...gone.map((c) => long(c.disconnectedAt!, (d) => S.instDisconnected(institutionOf(c), d)))];
    } else if (realAccounts(f.connections).some((a) => a.removedAt)) {
      line1 = [since, connected];
    } else {
      line1 = [since, { text: connectedLine(f.brokers, f.accounts) }];
    }
    if (idleRef) {
      const part = long(idleRef, S.idle);
      line2 = [...lastClose, part];
      card = [{ ...part, words: (d: string) => { const w = S.idle(d); return w[0].toUpperCase() + w.slice(1); } }]; // the card's line starts a sentence
    } else if (f.lastSyncedAt) {
      line2 = [...lastClose, { d: f.lastSyncedAt, words: S.updated, rel: true }];
    } else {
      line2 = lastClose;
    }
  }

  const labels = accountLabels(f.connections);
  const real = realAccounts(f.connections);
  const accounts: Part[] = labels.size
    ? real.map((a) => render([a.removedAt ? long(a.removedAt, (d) => S.removedNumbered(labels.get(a.id)!, d))
      // PR #85 review (nit 2): on a partly disconnected record, the disconnected connection's rows say so with its date.
      : !frozen && a.connection.disconnectedAt ? long(a.connection.disconnectedAt, (d) => S.disconnectedNumbered(labels.get(a.id)!, d))
      : { text: S.accountLine(labels.get(a.id)!, institutionOf(a.connection, a)) }])[0])
    : real.length === 1 && real[0].removedAt ? render([long(real[0].removedAt, S.removed)]) : [];
  return { show: true, line1: render(line1), line2: render(line2), accounts, card: render(card), frozen, idle: !!idleRef };
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

// QA round 1 (finding 9; F-11 AC7, plan §1 `{rel} ({abs})`): what a time segment shows. A relative time shows its
// absolute date beside it, visibly ("2 hours ago (Nov 1)"); a title tooltip alone is not there on touch.
export const timeText = (s: Segment): string => (s.title ? `${s.text} (${s.title})` : s.text);

// QA round 2 (N8): each date stays on one line with the word before it ("Disconnected Nov 1, 2026", "removed Oct 28,
// 2026", "updated 2 hours ago (Nov 1)"), so a row wraps only at " · " and between other words. Merge with main (#59
// a11y e2e reads "Record since Mon D, YYYY" with plain spaces): the glue is a `glue` group, rendered in one no-wrap
// span (app/status-line.tsx, .status-glue), never no-break space characters, so the text keeps ordinary spaces. A text
// segment right before a date is split at its last word: the head stays free, the last word joins the date's group.
// Pure, so the grouping is unit-tested.
export type GluedSegment = Segment & { glue?: number };
export function glued(segs: Segment[]): GluedSegment[] {
  const out: GluedSegment[] = [];
  segs.forEach((s, i) => {
    if (s.iso) {
      const prev = out.at(-1);
      out.push(prev?.glue === i ? { ...s, glue: i } : s);
      return;
    }
    if (segs[i + 1]?.iso && s.text.endsWith(' ')) {
      const cut = s.text.slice(0, -1).lastIndexOf(' ') + 1;
      if (cut > 0) out.push({ text: s.text.slice(0, cut) });
      out.push({ text: s.text.slice(cut), glue: i + 1 });
      return;
    }
    out.push(s);
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
// QA round 1 (finding 11): a Demo record's "Demo data" is the strip label right under this line, so the line says it
// once (here only "Record since ‹date›").
export function recordSegments(f: StatusFacts | null | undefined, now: Date): Segment[] | undefined {
  const rows = recordRows(f, now);
  return rows && segments(rows.flat());
}
// QA round 2 (N8): the trade and month pages print the status in two rows like the profile (row 1: since and the
// connection; row 2: last close and updated), each row with one date form. Parts, not segments: the caller renders
// each row with segments().
export function recordRows(f: StatusFacts | null | undefined, now: Date): Part[][] | undefined {
  const l = f ? statusParts(f, now, 'live') : null;
  if (!l?.show) return undefined;
  return (f!.source === 'demo' ? [l.line1.filter((p) => p.text !== S.demoLink)] : [l.line1, l.line2]).filter((r) => r.length);
}
// Trade and month images: a frozen record's line, absolute date with the year, never relative; else null.
export function imageFrozenText(f: StatusFacts | null | undefined, now: Date): string | null {
  const l = f ? statusParts(f, now, 'static') : null;
  return l?.show && l.frozen ? l.card.map((p) => p.text).join(' · ') : null; // the same words as the card (a disconnect only, B1)
}
// The pane's segments (static: the pane JSON is cached 60 s): line 1 without "Record since" (the pane says since when
// already), then line 2.
export function paneSegments(f: StatusFacts | undefined, now: Date): Segment[] | undefined {
  const l = f && statusParts(f, now, 'static');
  const parts = l?.show ? [...l.line1.slice(1), ...l.line2] : [];
  return parts.length ? segments(parts) : undefined;
}
