import { NextRequest, NextResponse } from 'next/server';
import { getStations, updateStationFeeRate, getStationStats } from '@/db/queries';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const stations = getStations();
    const enriched = stations.map(s => {
      const stats = getStationStats(s.id);
      return {
        ...s,
        stats: {
          totalAmount: stats.total_amount / 100_000_000,
          totalFee: stats.total_fee / 100_000_000,
          txCount: stats.tx_count,
        },
      };
    });

    return NextResponse.json({ stations: enriched });
  } catch (error) {
    console.error('Admin stations error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get stations' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, fee_rate } = body;

    if (!id || typeof fee_rate !== 'number') {
      return NextResponse.json(
        { error: 'Missing id or fee_rate' },
        { status: 400 }
      );
    }

    updateStationFeeRate(id, fee_rate);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update station error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update station' },
      { status: 500 }
    );
  }
}
