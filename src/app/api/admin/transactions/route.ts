import { NextRequest, NextResponse } from 'next/server';
import { getRecentPayments, getStations } from '@/db/queries';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const stations = getStations();

    const payments = getRecentPayments(limit);

    // Filter by station if needed
    // Note: payments table doesn't have station_id directly, we'd need to join
    // For simplicity, return all and let frontend filter

    return NextResponse.json({
      payments: payments.map(p => ({
        id: p.id,
        payment_hash: p.payment_hash,
        amount: p.amount / 100_000_000,
        fee: p.fee / 100_000_000,
        status: p.status,
        preimage: p.preimage,
        created_at: p.created_at,
      })),
      stations: stations.map(s => ({
        id: s.id,
        name: s.name,
        brand: s.brand,
      })),
    });
  } catch (error) {
    console.error('Admin transactions error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get transactions' },
      { status: 500 }
    );
  }
}
