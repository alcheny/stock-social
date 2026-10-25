// Pure model for the story/square record image. No DB or React imports. Percentages only.
import { pct, rangeText, type Confidence, type Stats } from './trades.ts';
import { imageTrust, SHARE_CARD, type RecordState } from './copy.ts';

// F-4 PR 2: the canvases moved to the card model; this file is removed in PR 3.
export { FORMATS, parseFormat, type ImageFormat } from './record-card.ts';

export type StoryModel = {
  empty: boolean;
  demo: boolean;
  badge: string; // 'Imported read-only from the broker' never appears on demo images, or for a failed or running import ('' = none)
  tone: 'ok' | 'muted' | 'warn';
  note: string | null; // fix round 6: the profile's incomplete line (failed) or the import-running note
  headline: string | null;
  winRatePct: string | null;
  avgReturn: string | null;
  avgPositive: boolean | null;
  closedCount: number;
  rangeLine: string | null;
  worstReturn: string | null;
  uncertaintyLine: string | null;
};

// `worst` is the minimum returnPct (Stats does not expose it). `demo` swaps the verified label. `state` is the trader's
// aggregate record state (fix round 6, TR-3): the profile card's rule, so a failed import is never labelled as imported
// whole and an import still running shows no stats. Omitted = a finished import.
export function storyModel(s: Stats, closedCount: number, c: Confidence | null = null, opts: { worst?: number | null; demo?: boolean; state?: RecordState } = {}): StoryModel {
  const demo = !!opts.demo;
  const trust = imageTrust('story', { state: opts.state ?? 'connected', demo, verified: !demo && closedCount > 0, empty: closedCount === 0 });
  const empty = closedCount === 0 || !trust.stats;
  const range = !empty && c ? rangeText(c) : null;
  return {
    empty,
    demo,
    badge: demo ? 'Demo data, not a real broker record' : trust.label ?? '',
    tone: demo ? 'muted' : trust.tone,
    note: demo ? null : trust.note,
    headline: !trust.stats ? SHARE_CARD.importingBody : empty ? 'No closed trades yet' : null,
    winRatePct: empty ? null : `${(s.winRate * 100).toFixed(0)}%`,
    avgReturn: empty ? null : pct(s.avgReturn),
    avgPositive: empty ? null : s.avgReturn > 0,
    closedCount: trust.stats ? closedCount : 0,
    rangeLine: range ? `Range ${range} · 95%` : null,
    worstReturn: empty || opts.worst == null ? null : pct(opts.worst),
    uncertaintyLine: !empty && closedCount < 10 ? 'New record, wide uncertainty' : null,
  };
}
