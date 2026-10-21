import Link from 'next/link';
import { pct } from '@/lib/trades.ts';

export function Badge({ verified }: { verified: boolean }) {
  return verified
    ? <span className="badge verified" title="Pulled read-only from the trader's broker. Cannot be edited.">✓ Verified</span>
    : <span className="badge demo" title="Sample data, not from a real broker.">Demo</span>;
}

export type TradeRow = {
  id: string; symbol: string; return_pct: number; holding_days: number; closed_at: Date; verified: boolean;
  thesis: string | null; thesis_status: string | null; handle: string; display_name: string; user_id: number;
};

const days = (d: number) => (d < 1 ? `${Math.max(1, Math.round(d * 24))}h` : `${d.toFixed(d < 10 ? 1 : 0)}d`);

export function TradeCard({ t }: { t: TradeRow }) {
  const up = t.return_pct > 0;
  return (
    <article className="card">
      <header>
        <Link href={`/u/${t.handle}`} className="who">
          <strong>{t.display_name}</strong> <span className="muted">@{t.handle}</span>
        </Link>
        <Badge verified={t.verified} />
      </header>
      <div className="hero">
        <div className="symbol"><Link href={`/t/${encodeURIComponent(t.symbol)}`}>{t.symbol}</Link></div>
        <div className={`ret ${up ? 'up' : 'down'}`}>{pct(t.return_pct)}</div>
        <div className="muted">held {days(t.holding_days)} · closed {t.closed_at.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
      </div>
      <p className="thesis">{t.thesis_status === 'published' ? `“${t.thesis}”` : <span className="muted">No thesis posted.</span>}</p>
      <footer className="muted">
        <Link href={`/u/${t.handle}`}>See their record, wins and losses →</Link>
      </footer>
    </article>
  );
}
