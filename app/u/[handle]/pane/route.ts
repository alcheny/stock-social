import { NextResponse } from 'next/server';
import { sql } from '@/lib/db.ts';
import { records } from '@/lib/feed.ts';
import { recordStates } from '@/lib/connections.ts';
import { statusForOrNull as statusFor } from '@/lib/record-status-load.ts'; // FIXES-LABELS: status (QA round 2 N3: guarded, null on error)
import { paneSegments } from '@/lib/record-status.ts'; // FIXES-LABELS: status
import { optionHeadline, paneView } from '@/lib/options-load.ts'; // OPTIONS (AC 24): the pane's label and line, gated per trader
import { filerVisibleSql, isFilerHandle } from '@/lib/public-gate.ts';
import { paneModel } from '@/lib/pane-model.ts'; // F-23
import { feedPaneChart, PAYLOAD_V } from '@/lib/chart-series.ts'; // F-23

// F-2 PR-3b fix round 1 (business lead D2): a Similar trades row's pane, fetched when its sheet first opens
// (app/lazy-pane.tsx), so the profile no longer renders three other traders' records. Public like the profile (signed
// out works): the same closed trades the feed's pane reads, theses only when published, percentages only. An importing
// record is not whole, so it is not served.
// F-23: the body is the pane's model (every printed figure, computed here from stored values and rounded to what the
// pane prints) and its chart, never the raw closes; dates are UTC days. Only `?v=<PAYLOAD_V>` is served: a client built
// before F-23 asks for the bare URL and gets a 404 (its "could not be loaded" line), never a body it would misread, and
// no cache holds a pre-F-23 body under the new key.
export async function GET(req: Request, { params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  // Reviewer (tester Low): a handle outside the signup pattern (a NUL byte made Postgres throw, a 500) is a 404 before any query.
  if (!/^[a-z0-9_]{3,20}$/.test(handle)) return NextResponse.json({ error: 'not found' }, { status: 404, headers: { 'cache-control': 'no-store' } });
  if (new URL(req.url).searchParams.get('v') !== String(PAYLOAD_V)) return NextResponse.json({ error: 'not found' }, { status: 404, headers: { 'cache-control': 'no-store' } });
  const no = () => NextResponse.json({ error: 'not found' }, { status: 404, headers: { 'cache-control': 'no-store' } });
  const [user] = await sql`select id from users u where handle = ${handle} and deleted_at is null and ${filerVisibleSql('u')}`;
  if (!user) return no();
  // F-6: the trader's open positions (unrealized percent only), served for a connected or failed record only, as on the feed.
  const [rows, states, positions, options] = await Promise.all([records([user.id as number]), recordStates([user.id as number]),
    sql`select unrealized_pct, fetched_at from open_positions where user_id = ${user.id as number}`, optionHeadline([user.id as number])]);
  const state = states.get(user.id as number)?.state ?? 'connected';
  if (state === 'importing') return no();
  const shown = state === 'connected' || state === 'failed' ? positions : [];
  const open = shown.map((p) => p.unrealized_pct as number);
  const openAsOf = shown.length ? new Date(Math.min(...shown.map((p) => (p.fetched_at as Date).getTime()))) : null;
  const now = new Date();
  // FIXES-LABELS (code review): the entry times (openedAt) feed the model's range line and New record on the server.
  const model = paneModel(rows, state, now, open, openAsOf);
  const chart = feedPaneChart(rows, now);
  // FIXES-LABELS: status (F-11): the pane's status as static segments (absolute dates; this JSON is cached 60 s).
  const status = paneSegments((await statusFor(user.id as number, state)) ?? undefined, now) ?? null;
  return NextResponse.json({ v: PAYLOAD_V, state, model, chart, status, options: paneView(options.get(user.id as number)!) /* the flag and the line only (QA 2) */ }, { headers: { 'cache-control': isFilerHandle(handle) ? 'no-store' : 'public, max-age=60' } }); // F-7: never cached
}
