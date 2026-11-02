// F-21 · the profile's #excluded section (committee decisions 1, 7, 13; legal R1-R4): the heading states the one sum
// (lib/exclusions.ts#exclusionTotal) and every reason line follows as data (exclusionReasons), so the lines' counts add up
// to the heading in both option-gate states. The option count lines moved here from options-block.tsx word for word,
// with their class names: the gated sentence and its /how link (gate closed), the short, technical and open-other lines
// (gate open), and the exercise-share line (both). The pane and strip lines link here (#excluded; focus via RowFocus).
// Pure: no reads (the page passes the stored counters it loaded).
import { EXCLUSIONS, OPTIONS } from '@/lib/copy.ts';
import { exclusionReasons, exclusionTotal, type ExclusionInput, type Reason } from '@/lib/exclusions.ts';

const CLASS: Record<string, string> = {
  'options.gated': 'muted options-gated', 'options.short': 'muted options-short', 'options.technical': 'muted options-technical',
  'options.exerciseShares': 'muted options-exercise-shares', 'options.openOther': 'muted options-open-other', 'options.summarized': 'muted options-summarized',
};

function ReasonLine({ r }: { r: Reason }) {
  const data = { 'data-reason': r.key, 'data-n': r.n, ...(r.key === 'held' ? { 'data-excluded-held': true } : {}), ...(r.key.startsWith('public.') ? { 'data-public-excluded': true } : {}),
    ...(r.key === 'options.gated' ? { 'data-options': 'gated' } : {}) };
  // Fix round 3 (item 6), moved: the gated sentence, then its own short link to /how.
  if (r.key === 'options.gated') return <p className={CLASS[r.key]} {...data}>{r.text} <a className="options-how" href="/how#options">{OPTIONS.howLink}</a></p>;
  return <p className={CLASS[r.key] ?? 'muted'} {...data}>{r.text}</p>;
}

export function ExcludedSection({ c }: { c: ExclusionInput }) {
  const reasons = exclusionReasons(c), n = exclusionTotal(c);
  const lines = reasons.map((r) => <ReasonLine key={r.key} r={r} />);
  // Nothing excluded: only the context lines that count nothing (open options), with no heading.
  if (n === 0) return lines.length ? <>{lines}</> : null;
  return <section id="excluded" tabIndex={-1} aria-labelledby="excluded-h" className="excluded" data-exclusions-block>
    <h2 id="excluded-h" className="small">{EXCLUSIONS.title(n)}</h2>
    {lines}
  </section>;
}
