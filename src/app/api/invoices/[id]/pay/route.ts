import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getInvoiceById, markInvoicePaid, getSessionById, getStationById, updateSessionStatus, incrementSessionPayment, createPayment, upsertDailyStat } from '@/db/queries';
import { verifyPayment } from '@/lib/l402-utils';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { preimage, payment_hash } = body;

    if (!preimage || !payment_hash) {
      return NextResponse.json(
        { error: 'Missing preimage or payment_hash' },
        { status: 400 }
      );
    }

    const invoice = getInvoiceById(id);
    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    if (invoice.payment_hash !== payment_hash) {
      return NextResponse.json({ error: 'Payment hash mismatch' }, { status: 400 });
    }

    if (invoice.status === 'paid') {
      return NextResponse.json({ success: true, message: 'Already paid' });
    }

    // Determine which node to query: station node (multi-hop) or Router (fallback)
    const session = getSessionById(invoice.session_id);
    const station = session ? getStationById(session.station_id) : null;
    const verifyRpcUrl = station?.rpc_url || undefined;

    // Verify payment via Fiber RPC on the station node (receiving end of multi-hop)
    console.log(`[pay] Verifying payment for invoice ${id} on ${station?.name || 'unknown'} (${verifyRpcUrl || 'Router'}), payment_hash: ${payment_hash.slice(0, 16)}...`);
    const paymentResult = await verifyPayment(payment_hash, verifyRpcUrl);
    console.log(`[pay] verifyPayment result:`, paymentResult);
    const isPaid = paymentResult?.status === 'Success';

    if (!isPaid) {
      console.log(`[pay] Payment not confirmed for invoice ${id}, returning 402`);
      return NextResponse.json(
        { error: 'Payment not confirmed' },
        { status: 402 }
      );
    }

    console.log(`[pay] Payment confirmed for invoice ${id}`);

    // Mark invoice as paid
    markInvoicePaid(id);

    // Calculate routing fee as 5% of invoice amount (Router's actual fee rate)
    // Note: WASM node locks 10% as max_fee_rate, but Router only charges 5%
    const ROUTER_FEE_RATE = parseFloat(process.env.ROUTER_FEE_RATE || '0.05');
    const routingFeeShannon = Math.floor(invoice.amount * ROUTER_FEE_RATE);

    // Record payment (including network routing fee)
    createPayment({
      id: uuidv4(),
      invoice_id: id,
      payment_hash,
      amount: invoice.amount,
      fee: invoice.fee,
      routing_fee: routingFeeShannon,
      status: 'confirmed',
      preimage,
    });

    // Update session
    if (session) {
      incrementSessionPayment(session.id, invoice.amount, invoice.fee);

      // If session was pending, start charging
      if (session.status === 'pending') {
        updateSessionStatus(session.id, 'charging');
      }

      // Upsert daily stats (including routing fee)
      const today = new Date().toISOString().split('T')[0];
      upsertDailyStat(today, session.station_id, invoice.amount, invoice.fee, routingFeeShannon);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Pay invoice error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process payment' },
      { status: 500 }
    );
  }
}
