import { NextResponse } from 'next/server';
import { getStations, getAllTimeStats } from '@/db/queries';

export const dynamic = 'force-dynamic';

const ROUTER_RPC_URL = process.env.FIBER_RPC_URL || 'http://127.0.0.1:8227';
const ROUTER_BISCUIT = process.env.FIBER_RPC_BISCUIT_TOKEN || '';

interface FiberChannel {
  channel_id: string;
  pubkey: string;
  funding_udt_type_script?: unknown;
  is_public: boolean;
  channel_outpoint: string;
  local_balance: string;
  offered_tlc_balance: string;
  remote_balance: string;
  received_tlc_balance: string;
  latest_commitment_transaction_hash?: string;
  created_at: string;
  enabled: boolean;
  tlc_expiry_delta?: string;
  tlc_minimum_value?: string;
  tlc_fee_proportional_millionths?: string;
  tlc_max_value?: string;
}

async function fetchRouterChannels(): Promise<FiberChannel[]> {
  const res = await fetch(ROUTER_RPC_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(ROUTER_BISCUIT ? { Authorization: `Bearer ${ROUTER_BISCUIT}` } : {}),
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'list_channels',
      params: [{}],
    }),
  });

  const data = await res.json();
  if (data.error) {
    throw new Error(data.error.message || 'RPC error');
  }
  return data.result?.channels || [];
}

export async function GET() {
  try {
    const [channels, stations, allTime] = await Promise.all([
      fetchRouterChannels(),
      getStations(),
      getAllTimeStats(),
    ]);

    const stationPubkeys = new Set(stations.map(s => s.pubkey).filter(Boolean));
    const stationMap = new Map(stations.map(s => [s.pubkey, s]));

    let userChannels = 0;
    let stationChannelCount = 0;

    const enrichedChannels = channels.map((ch) => {
      const pubkey = ch.pubkey;
      const isStation = stationPubkeys.has(pubkey);
      if (isStation) stationChannelCount++;
      else userChannels++;

      const station = isStation ? stationMap.get(pubkey) : null;
      const localCkb = parseInt(ch.local_balance, 16) / 100_000_000;
      const remoteCkb = parseInt(ch.remote_balance, 16) / 100_000_000;
      const feeMillionths = ch.tlc_fee_proportional_millionths
        ? parseInt(ch.tlc_fee_proportional_millionths, 16)
        : 1000;

      return {
        channelId: ch.channel_id,
        peerPubkey: pubkey,
        peerType: isStation ? 'station' : ('user' as 'station' | 'user'),
        peerName: station?.name || (isStation ? 'Unknown Station' : 'User Node'),
        peerBrand: station?.brand || null,
        localBalance: localCkb,
        remoteBalance: remoteCkb,
        totalCapacity: localCkb + remoteCkb,
        feeProportionalMillionths: feeMillionths,
        feePercent: (feeMillionths / 1_000_000 * 100).toFixed(2),
        isPublic: ch.is_public,
        enabled: ch.enabled,
        createdAt: ch.created_at,
      };
    });

    return NextResponse.json({
      summary: {
        totalChannels: channels.length,
        userChannels,
        stationChannels: stationChannelCount,
        totalRoutingFee: allTime.total_routing_fee / 100_000_000,
        totalTxCount: allTime.tx_count,
      },
      channels: enrichedChannels,
    });
  } catch (error) {
    console.error('Admin router error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get router status' },
      { status: 500 }
    );
  }
}
