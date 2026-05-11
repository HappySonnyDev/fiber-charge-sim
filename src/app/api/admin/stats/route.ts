import { NextResponse } from 'next/server';
import { getTodayStats, getAllTimeStats, getActiveSessions, getStationRevenueRanking, getDailyStats } from '@/db/queries';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const today = getTodayStats();
    const allTime = getAllTimeStats();
    const activeSessions = getActiveSessions();
    const ranking = getStationRevenueRanking();
    const daily = getDailyStats();

    return NextResponse.json({
      today: {
        totalAmount: today.total_amount / 100_000_000,
        totalFee: today.total_fee / 100_000_000,
        totalRoutingFee: today.total_routing_fee / 100_000_000,
        txCount: today.tx_count,
      },
      allTime: {
        totalAmount: allTime.total_amount / 100_000_000,
        totalFee: allTime.total_fee / 100_000_000,
        totalRoutingFee: allTime.total_routing_fee / 100_000_000,
        txCount: allTime.tx_count,
        sessionCount: allTime.session_count,
      },
      activeSessions: activeSessions.length,
      ranking: ranking.map(r => ({
        id: r.id,
        name: r.name,
        brand: r.brand,
        totalAmount: r.total_amount / 100_000_000,
        totalFee: r.total_fee / 100_000_000,
        totalRoutingFee: r.total_routing_fee / 100_000_000,
        txCount: r.tx_count,
      })),
      daily: daily.map(d => ({
        date: d.date,
        stationId: d.station_id,
        totalAmount: d.total_amount / 100_000_000,
        totalFee: d.total_fee / 100_000_000,
        totalRoutingFee: d.total_routing_fee / 100_000_000,
        txCount: d.tx_count,
      })),
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get stats' },
      { status: 500 }
    );
  }
}
