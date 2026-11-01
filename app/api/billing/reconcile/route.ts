import { NextResponse, type NextRequest } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { billingAvailable, reconcile } from '@/lib/billing.ts';

// F-3: run the billing reconciliation now (`Authorization: Bearer $CRON_SECRET`). The hourly /api/sync tick already
// runs it once a day; this is for the owner and for tests. Answers counts only.
export const maxDuration = 300;
export async function POST(req: NextRequest) {
  const got = Buffer.from(req.headers.get('authorization') ?? '');
  const want = Buffer.from(`Bearer ${process.env.CRON_SECRET}`);
  if (!process.env.CRON_SECRET || got.length !== want.length || !timingSafeEqual(got, want)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!billingAvailable()) return NextResponse.json({ error: 'billing not configured' }, { status: 404 });
  return NextResponse.json(await reconcile());
}
