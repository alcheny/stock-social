import { NextResponse, type NextRequest } from 'next/server';
import { billingAvailable, handleWebhook } from '@/lib/billing.ts';

// F-3: the processor's webhook. The raw body is read as text (no parsing before verification) and handed to
// lib/billing.ts#handleWebhook, which verifies the signature, stores the event once by its id and applies it. 200 only
// after the row is written; 500 so the processor retries; 400 for a bad signature. Nothing from the body is logged.
export async function POST(req: NextRequest) {
  if (!billingAvailable()) return NextResponse.json({ error: 'billing not configured' }, { status: 404 });
  const raw = await req.text();
  const r = await handleWebhook(raw, req.headers.get('stripe-signature'));
  return NextResponse.json({ received: r.status === 200 }, { status: r.status });
}
