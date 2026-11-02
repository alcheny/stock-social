// F-4: the record card's one read, shared by the link unfurl, the Share button's picture and the profile's alt text,
// so they cannot drift. Percent-only columns; the trust state comes from the same rules as the profile (record state,
// demo profile, every close from the broker).
// Known limits 2 (profile): the rows come from the profile's per-request reads (load.ts), so on a profile view the card
// reads nothing the page has not already read, and its two calls there (metadata, share prompt) are one. Relative imports
// so node:test loads it.
import { cache } from 'react';
import { filerVisible } from '../../../lib/public-gate.ts';
import { cardLink, recordCard, type CardKind, type CardModel } from '../../../lib/record-card.ts';
import { optionHeadline, paneView } from '../../../lib/options-load.ts'; // OPTIONS (AC 24): the flag and the line only
import { reads, type ProfileReads } from './load.ts';

export function recordCardLoader(r: ProfileReads) {
  return async (handle: string, kind: CardKind, now = new Date()): Promise<CardModel | null> => {
    if (typeof handle !== 'string' || !handle) return null;
    const user = await r.user(handle);
    if (!user) return null; // no card for an unknown handle or a profile being deleted (the profile itself is 404 too)
    const id = Number(user.id);
    // F-7: a filer's card exists only while its profile does (switch on, neither hidden nor removed: the profile's own
    // rule, lib/public-gate.ts#filerVisible, the same test as filerVisibleSql), and only with a priced close.
    if (user.public_filer_id && !filerVisible(await r.filer(id))) return null;
    const [rows, { public: { state } }, demo, options] = await Promise.all([r.trades(id), r.detail(id), r.demo(id), optionHeadline([id])]);
    if (user.public_filer_id && !rows.length) return null;
    const opt = paneView(options.get(id)!);
    // F-6: the unrealized percent of each open position only (no symbol, no account): the card prints no symbols.
    // recordCard shows them only for a broker record with no import running, so a record without one reads none.
    const open = state === 'none' ? [] : await r.positions(id);
    // The shared rows are in list order (closed_at desc, id desc); the card sums in close order (closed_at, id), stated
    // here so its figures never depend on the order a reader happened to use.
    const asc = [...rows].reverse();
    return recordCard({
      kind, handle, name: user.display_name as string | null, state, demo, now,
      // Committee round 1, demand 8: the configured origin, never the request's Host header (the picture is cacheable).
      link: kind === 'unfurl' ? null : cardLink(process.env, handle),
      verified: asc.length > 0 && asc.every((t) => t.verified),
      open: open.map((p) => Number(p.unrealized_pct)).filter(Number.isFinite),
      // F-34: the positions' as-of, the MIN(fetched_at) of the rows already read (no extra query).
      ...(open.length ? { openAsOf: new Date(Math.min(...open.map((p) => (p.fetched_at as Date).getTime()))) } : {}),
      options: { shareLabel: opt.label, line: opt.line }, // OPTIONS
      trades: asc.map((t) => ({ symbol: t.symbol, openedAt: t.opened_at, closedAt: t.closed_at, returnPct: Number(t.return_pct), holdingDays: Number(t.holding_days) })),
    });
  };
}

export const loadRecordCard = cache(recordCardLoader(reads));
