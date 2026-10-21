import Link from 'next/link';

const MAX_SHOWN = 20;
const LABELS: Record<string, string> = { profile: 'your profile link', trade: 'a trade link', month: 'your monthly recap', badge: 'your badge' };

// Owner-only, plain text: which traders connected a broker from this trader's link. Nothing at 0.
export function ReferralFeedback({ handles, byVia }: { handles: string[]; byVia: Record<string, number> }) {
  if (handles.length === 0) return null;
  const n = handles.length;
  // Ordering only (count, then label); unknown keys and zero counts are skipped.
  const parts = Object.entries(byVia)
    .filter(([k, c]) => c > 0 && k in LABELS)
    .map(([k, c]) => ({ c, label: LABELS[k] }))
    .sort((a, b) => b.c - a.c || a.label.localeCompare(b.label))
    .map(({ c, label }) => `${c} from ${label}`);
  return (
    <>
    <p className="muted small">
      {n} {n === 1 ? 'trader' : 'traders'} connected from your link:{' '}
      {handles.slice(0, MAX_SHOWN).map((h, i) => (
        <span key={h}>
          {i > 0 && ', '}
          <Link href={`/u/${h}`}>@{h}</Link>
        </span>
      ))}
    </p>
    {parts.length > 0 && <p className="muted small">{parts.join(', ')}.</p>}
    </>
  );
}
