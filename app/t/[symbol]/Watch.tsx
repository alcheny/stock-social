import Link from 'next/link';
import { sql } from '@/lib/db.ts';
import { currentUser } from '@/lib/session.ts';
import { canWatch, WATCH_CAP } from '@/lib/ticker.ts';
import { toggleWatch } from '../../actions.ts';

export type WatchState = { signedIn: boolean; watching: boolean };

export async function loadWatch(symbol: string): Promise<WatchState> {
  const user = await currentUser();
  if (!user) return { signedIn: false, watching: false };
  const [w] = await sql`select 1 from ticker_watches where user_id = ${user.id} and symbol = ${symbol}`;
  return { signedIn: true, watching: !!w };
}

/** Deliberate write during GET: viewing a watched stock marks it seen. Never runs signed out; failures are swallowed. */
export async function markSeen(symbol: string, state: WatchState) {
  if (!state.signedIn || !state.watching) return;
  try {
    const user = await currentUser();
    if (!user) return;
    await sql`update ticker_watches set last_seen_at = now() where user_id = ${user.id} and symbol = ${symbol}`;
  } catch (e) {
    console.error('markSeen failed', e);
  }
}

export default function Watch({ symbol, state, capHit }: { symbol: string; state: WatchState; capHit: boolean }) {
  if (!state.signedIn) {
    return <p><Link href="/login" style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44 }}>Sign in to watch</Link></p>;
  }
  const act = toggleWatch.bind(null, symbol);
  const cap = canWatch(WATCH_CAP, symbol);
  return (
    <div className="watch">
      <form action={act}>
        {state.watching
          ? <button type="submit" aria-pressed="true" aria-label={`Watching ${symbol}. Tap to unwatch.`} className="watch-btn" style={{ minHeight: 44 }}>Watching</button>
          : <button type="submit" className="watch-btn" style={{ minHeight: 44 }}>Watch</button>}
      </form>
      <p className="muted small">Private. We'll show new verified closed trades on the stock index. No notifications.</p>
      {capHit && !cap.ok && <p role="status">{cap.message}</p>}
    </div>
  );
}
