// Pure model for the story/square record image. No DB or React imports. Percentages only.
import { pct, rangeText, type Confidence, type Stats } from './trades.ts';

export type ImageFormat = 'story' | 'square';
export const FORMATS = { story: { width: 1080, height: 1920 }, square: { width: 1080, height: 1080 } };
export const parseFormat = (v: string | null | undefined): ImageFormat => (v === 'story' ? 'story' : 'square');

export type StoryModel = {
  empty: boolean;
  demo: boolean;
  badge: string; // 'Imported read-only from the broker' never appears on demo images
  headline: string | null;
  winRatePct: string | null;
  avgReturn: string | null;
  avgPositive: boolean | null;
  closedCount: number;
  rangeLine: string | null;
  worstReturn: string | null;
  uncertaintyLine: string | null;
};

// `worst` is the minimum returnPct (Stats does not expose it). `demo` swaps the verified label.
export function storyModel(s: Stats, closedCount: number, c: Confidence | null = null, opts: { worst?: number | null; demo?: boolean } = {}): StoryModel {
  const empty = closedCount === 0;
  const demo = !!opts.demo;
  const range = !empty && c ? rangeText(c) : null;
  return {
    empty,
    demo,
    badge: demo ? 'Demo data, not a real broker record' : 'Imported read-only from the broker',
    headline: empty ? 'No closed trades yet' : null,
    winRatePct: empty ? null : `${(s.winRate * 100).toFixed(0)}%`,
    avgReturn: empty ? null : pct(s.avgReturn),
    avgPositive: empty ? null : s.avgReturn > 0,
    closedCount,
    rangeLine: range ? `Range ${range} · 95%` : null,
    worstReturn: empty || opts.worst == null ? null : pct(opts.worst),
    uncertaintyLine: !empty && closedCount < 10 ? 'New record, wide uncertainty' : null,
  };
}
