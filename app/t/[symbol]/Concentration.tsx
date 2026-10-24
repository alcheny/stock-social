import { concentration, MIN_REST, type TickerRow } from '@/lib/ticker.ts';
import { MIN_BETS, pct, rangeText, tooEarlyText } from '@/lib/trades.ts';
import { Badge } from '../../ui.tsx';

// Counts only: no handles, no links, no ranking. Says how much of the record rests on one trader.
export default function Concentration({ rows, symbol, demoOnly, mixed }: { rows: TickerRow[]; symbol: string; demoOnly: boolean; mixed: boolean }) {
  const c = concentration(rows, new Date());
  if (!c) return null;
  const rest = c.kind === 'compare' ? c.rest : null;
  const demo = rest ? rest.demoOnly : demoOnly;
  const mix = rest ? rest.mixed : mixed;
  const y = c.kind === 'single' ? 100 : Math.round(c.share * 100);
  return (
    <section aria-label="Concentration check" data-testid="concentration" data-symbol={symbol} data-kind={c.kind}>
      <h2>Concentration check {demo && <Badge verified={false} />}</h2>
      {demo && <p role="note" className="muted small">Sample data, not from a real broker.</p>}
      {mix && <p role="note" className="muted small">Includes sample data marked Demo.</p>}
      {c.kind === 'single' && <p style={{ marginTop: 0 }}>One trader made all {c.n} trades here.</p>}
      {c.kind === 'tie' && <p style={{ marginTop: 0 }}>{c.tied === 2 ? 'The two busiest traders' : 'The busiest traders'} each made {c.each} of {c.n} trades ({y}% each).</p>}
      {c.kind === 'too-few' && <p style={{ marginTop: 0 }}>The most active trader made {c.top} of {c.n} trades ({y}%). Fewer than {MIN_REST} trades remain without them, so no comparison is shown.</p>}
      {c.kind === 'compare' && rest && (
        <>
          <p style={{ marginTop: 0 }}>The most active trader made {c.top} of {c.n} trades ({y}%).</p>
          <p data-testid="concentration-rest">
            Without them: {Math.round(rest.winRate! * 100)}% win rate, avg{' '}
            <span className={rest.avgReturn! > 0 ? 'up' : rest.avgReturn! < 0 ? 'down' : undefined}>{pct(rest.avgReturn!)}</span>,{' '}
            {rest.conf && rangeText(rest.conf) ? `${rangeText(rest.conf)} · 95% range` : rest.conf ? tooEarlyText(rest.conf) : `Too early to tell (0 of ${MIN_BETS} bets)`} over {rest.n} trades.
          </p>
        </>
      )}
      <p className="muted small">This shows how much of the record depends on one trader.</p>
    </section>
  );
}
