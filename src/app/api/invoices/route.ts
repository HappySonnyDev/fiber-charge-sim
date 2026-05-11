import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { createInvoice, getSessionById } from '@/db/queries';
import { createFiberInvoice } from '@/lib/l402-utils';
import { calculatePaymentBreakdown } from '@/lib/fee-service';
import { getStationById } from '@/db/queries';
import { CONFIG } from '@/lib/config';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { session_id, amount_ckb } = body;

    if (!session_id || typeof amount_ckb !== 'number') {
      return NextResponse.json(
        { error: 'Missing session_id or amount_ckb' },
        { status: 400 }
      );
    }

    const session = getSessionById(session_id);
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const station = getStationById(session.station_id);
    if (!station) {
      return NextResponse.json({ error: 'Station not found' }, { status: 404 });
    }

    // Calculate amount with fee
    const breakdown = calculatePaymentBreakdown(amount_ckb, station.fee_rate);

    // Create invoice on the target station node (enables multi-hop payment)
    // If station has no RPC URL, fall back to Router node
    console.log(`[invoices] Creating invoice for station ${station.name} via RPC: ${station.rpc_url || 'Router(default)'}`);
    const fiberResult = await createFiberInvoice({
      amountCkb: breakdown.totalCkb,
      description: `Charging at ${station.name} - Session ${session_id.slice(0, 8)}`,
      rpcUrl: station.rpc_url || undefined,
      allowTrampolineRouting: true,
    });

    // Store invoice in DB
    const invoiceId = uuidv4();
    createInvoice({
      id: invoiceId,
      session_id,
      payment_hash: fiberResult.invoice.data.payment_hash,
      amount: breakdown.baseShannon,
      fee: breakdown.feeShannon,
      status: 'pending',
      invoice_string: fiberResult.invoice_address,
    });

    return NextResponse.json({
      id: invoiceId,
      payment_hash: fiberResult.invoice.data.payment_hash,
      invoice: fiberResult.invoice_address,
      amount_ckb: breakdown.baseCkb,
      fee_ckb: breakdown.feeCkb,
      total_ckb: breakdown.totalCkb,
      // Router pubkey for trampoline routing (WASM node delegates path-finding to Router)
      router_pubkey: CONFIG.ROUTER_PUBKEY || undefined,
    });
  } catch (error) {
    console.error('Create invoice error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create invoice' },
      { status: 500 }
    );
  }
}
