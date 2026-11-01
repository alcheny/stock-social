import { NextResponse, type NextRequest } from 'next/server';
import { currentUser } from '@/lib/session.ts';
import { BATCH_BYTES, parseBatch } from '@/lib/discovery/events.ts';
import { recordEvents } from '@/lib/discovery/activity.ts';
import { sameOrigin } from '@/lib/discovery/origin.ts';

// F-2 PR-5 (criteria 2, 3, 12): the implicit activity logger's batches (app/discovery-log.tsx). Stores only for a
// signed-in viewer whose "Personalize with my activity" and "Personalize my feed" are both On; anyone else gets 204 and
// nothing is stored (no identifier is read or set for a signed-out reader). Same-origin only; at most BATCH_BYTES and
// BATCH_MAX events; one batch per viewer per 2 s (429, dropped); unknown keys, types or targets are dropped; the time is
// the server's. Every answer is no-store.
const noStore = { 'cache-control': 'no-store' };
export async function POST(req: NextRequest) {
  if (!sameOrigin(req.headers)) return new NextResponse(null, { status: 403, headers: noStore });
  const me = await currentUser();
  if (!me) return new NextResponse(null, { status: 204, headers: noStore });
  // A declared size over the cap is refused before the body is read; otherwise the body is read with a byte counter and
  // the read stops past BATCH_BYTES (a chunked body is never buffered whole).
  if (Number(req.headers.get('content-length') ?? 0) > BATCH_BYTES) return new NextResponse(null, { status: 413, headers: noStore });
  const text = await readCapped(req, BATCH_BYTES);
  if (text === null) return new NextResponse(null, { status: 413, headers: noStore });
  let body: unknown;
  try { body = JSON.parse(text); } catch { return new NextResponse(null, { status: 400, headers: noStore }); }
  const events = parseBatch(body);
  if (!events) return new NextResponse(null, { status: 400, headers: noStore });
  const r = await recordEvents(me.id, events);
  if (r === 'rate') return new NextResponse(null, { status: 429, headers: { ...noStore, 'retry-after': '2' } });
  return new NextResponse(null, { status: 204, headers: noStore });
}

async function readCapped(req: NextRequest, max: number): Promise<string | null> {
  if (!req.body) return '';
  const reader = req.body.getReader(), parts: Uint8Array[] = [];
  let n = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    n += value.byteLength;
    if (n > max) { await reader.cancel(); return null; }
    parts.push(value);
  }
  return Buffer.concat(parts).toString('utf8');
}
