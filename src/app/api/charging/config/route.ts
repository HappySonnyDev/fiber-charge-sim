import { NextResponse } from 'next/server';
import { CONFIG } from '@/lib/config';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    amount_per_interval: CONFIG.INVOICE_AMOUNT_CKB,
    interval_ms: CONFIG.PAYMENT_INTERVAL_MS,
  });
}
