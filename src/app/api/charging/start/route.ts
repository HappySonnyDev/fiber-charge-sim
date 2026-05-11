import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { createSession, getStationById } from '@/db/queries';
import { CONFIG } from '@/lib/config';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { station_id, user_pubkey } = body;

    if (!station_id || !user_pubkey) {
      return NextResponse.json(
        { error: 'Missing station_id or user_pubkey' },
        { status: 400 }
      );
    }

    const station = getStationById(station_id);
    if (!station) {
      return NextResponse.json({ error: 'Station not found' }, { status: 404 });
    }

    const sessionId = uuidv4();
    createSession({
      id: sessionId,
      station_id,
      user_pubkey,
      status: 'pending',
      total_paid: 0,
      total_fee: 0,
    });

    // Calculate amount per interval from station rate × power
    // Formula: rate (CKB/kWh) × power (kW) × interval_s / 3600
    const intervalMs = CONFIG.PAYMENT_INTERVAL_MS;
    const intervalSeconds = intervalMs / 1000;
    const amountPerInterval = parseFloat(
      (station.rate * station.power * intervalSeconds / 3600).toFixed(4)
    );

    // Return 402 with session info — client must pay invoice before charging starts
    return NextResponse.json(
      {
        session_id: sessionId,
        station: {
          id: station.id,
          name: station.name,
          rate: station.rate,
          power: station.power,
        },
        amount_per_interval: amountPerInterval,
        interval_ms: intervalMs,
        message: 'Payment required. Create and pay an invoice to start charging.',
      },
      {
        status: 402,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Start charging error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to start charging' },
      { status: 500 }
    );
  }
}
