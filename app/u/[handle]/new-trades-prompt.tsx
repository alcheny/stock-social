'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { markTradesPromptSeen, recordTradesPromptAction } from '../../actions.ts';
import { moreText, type TradesPromptAction } from '@/lib/new-trades.ts';
import { pct } from '@/lib/trades.ts';

type Row = { sellId: string; symbol: string; returnPct: number; closedAt: string };

const record = (a: TradesPromptAction) => void recordTradesPromptAction(a).catch(() => {});

// First-ever owner visit: stamp "seen" in an effect (never during render). No panel, so history is never "new".
export function MarkTradesPromptSeen() {
  useEffect(() => {
    void markTradesPromptSeen().catch(() => {});
  }, []);
  return null;
}

export function NewTradesPrompt({ handle, trades, more }: { handle: string; trades: Row[]; more: number }) {
  const [open, setOpen] = useState(true);
  if (!open) return null;
  const extra = moreText(more);
  return (
    <section className="new-trades" aria-labelledby="nt-h">
      <h2 id="nt-h">New closed trades since your last visit</h2>
      <ul>
        {trades.map((t) => (
          <li key={t.sellId}>
            {/* Opening one row advances the timestamp, so the other new trades stop being prompted (accepted). */}
            <Link href={`/u/${handle}/trade/${encodeURIComponent(t.sellId)}`} onClick={() => record('opened')}>
              <span><b>{t.symbol}</b> <span className="muted small">closed {new Date(t.closedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}</span></span>
              <b><span className="sr-only">{t.returnPct < 0 ? 'Loss ' : 'Gain '}</span>{pct(t.returnPct)}</b>
            </Link>
          </li>
        ))}
      </ul>
      {extra && <p className="muted small">{extra}</p>}
      <button type="button" className="secondary" onClick={() => { record('dismissed'); setOpen(false); }}>Dismiss</button>
    </section>
  );
}
