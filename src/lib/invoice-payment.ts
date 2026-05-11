import type { FiberBrowserNode, SendPaymentParams } from '@fiber-pay/sdk/browser';

export type HexString = `0x${string}`;

export interface InvoicePaymentAttempt {
  id: string;
  timestamp: number;
  amount: bigint;
  status: 'pending' | 'success' | 'failed';
  error?: string;
  paymentHash?: string;
}

export interface InvoicePaymentState {
  isStreaming: boolean;
  totalPaid: bigint;
  paymentCount: number;
  lastPaymentTime: number | null;
  attempts: InvoicePaymentAttempt[];
  sessionId: string | null;
}

export interface InvoicePaymentOptions {
  node: FiberBrowserNode;
  stationId: number;
  userPubkey: string;
  amountPerIntervalCkb: number;
  intervalMs: number;
  onPaymentSent?: (result: { paymentHash: string; amount: bigint; fee: bigint }) => void;
  onError?: (error: Error) => void;
  onLog?: (message: string) => void;
}

export class InvoicePayment {
  private node: FiberBrowserNode;
  private stationId: number;
  private userPubkey: string;
  private intervalMs: number;
  private amountPerPaymentCkb: number;
  private timer: ReturnType<typeof setInterval> | null = null;
  private state: InvoicePaymentState;
  private onPaymentSent: (result: { paymentHash: string; amount: bigint; fee: bigint }) => void;
  private onError: (error: Error) => void;
  private onLog: (message: string) => void;

  constructor(options: InvoicePaymentOptions) {
    this.node = options.node;
    this.stationId = options.stationId;
    this.userPubkey = options.userPubkey;
    this.intervalMs = options.intervalMs || 5000;
    this.amountPerPaymentCkb = options.amountPerIntervalCkb || 0.01;
    this.onPaymentSent = options.onPaymentSent || (() => {});
    this.onError = options.onError || (() => {});
    this.onLog = options.onLog || (() => {});
    this.state = {
      isStreaming: false,
      totalPaid: BigInt(0),
      paymentCount: 0,
      lastPaymentTime: null,
      attempts: [],
      sessionId: null,
    };
  }

  getState(): InvoicePaymentState {
    return { ...this.state };
  }

  async start(): Promise<void> {
    if (this.state.isStreaming) {
      return;
    }

    this.onLog('Starting invoice-based charging session...');

    try {
      // Step 1: Create charging session via API
      const startRes = await fetch('/api/charging/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          station_id: this.stationId,
          user_pubkey: this.userPubkey,
        }),
      });

      const startData = await startRes.json();

      if (!startRes.ok && startRes.status !== 402) {
        throw new Error(startData.error || 'Failed to start charging session');
      }

      this.state.sessionId = startData.session_id;
      this.onLog(`Session created: ${startData.session_id.slice(0, 8)}...`);

      this.state.isStreaming = true;

      // Make first payment immediately
      await this.makePayment();

      // Set up interval for subsequent payments
      this.timer = setInterval(() => this.makePayment(), this.intervalMs);
    } catch (error) {
      this.onError(error instanceof Error ? error : new Error('Failed to start'));
      throw error;
    }
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.state.isStreaming = false;
    this.onLog('Invoice payment stream stopped');

    // Notify server to complete session
    if (this.state.sessionId) {
      fetch('/api/charging/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: this.state.sessionId }),
      }).catch(() => {});
    }
  }

  private async makePayment(): Promise<void> {
    if (!this.state.sessionId) {
      this.onError(new Error('No active session'));
      return;
    }

    const attempt: InvoicePaymentAttempt = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      amount: BigInt(Math.floor(this.amountPerPaymentCkb * 100_000_000)),
      status: 'pending',
    };

    this.state.attempts.push(attempt);

    try {
      // Step 1: Request invoice from server
      this.onLog('Requesting invoice...');
      const invoiceRes = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: this.state.sessionId,
          amount_ckb: this.amountPerPaymentCkb,
        }),
      });

      const invoiceData = await invoiceRes.json();
      if (!invoiceRes.ok) {
        throw new Error(invoiceData.error || 'Failed to create invoice');
      }

      const { invoice, payment_hash, total_ckb, router_pubkey } = invoiceData;
      attempt.paymentHash = payment_hash;
      this.onLog(`Invoice received: ${payment_hash.slice(0, 16)}... (${total_ckb.toFixed(6)} CKB)`);

      // Step 2: Pay invoice via Fiber
      // Use trampoline routing: WASM node delegates path-finding to Router
      this.onLog('Paying invoice via Fiber...');
      // max_fee_rate: allow up to 10% routing fee rate (100000 millionths)
      const maxFeeShannon = BigInt(Math.ceil(this.amountPerPaymentCkb * 0.10 * 100_000_000));
      const maxFeeHex = `0x${maxFeeShannon.toString(16)}` as `0x${string}`;
      this.onLog(`max_fee_amount set to: ${maxFeeHex} (${Number(maxFeeShannon)/1e8} CKB)`);
      const payParams: SendPaymentParams = {
        invoice,
        max_fee_amount: maxFeeHex,
        max_fee_rate: '0x186a0' as `0x${string}`, // 100000 millionths = 10%
      };
      if (router_pubkey) {
        payParams.trampoline_hops = [router_pubkey as `0x${string}`];
        this.onLog(`Using trampoline routing via Router: ${router_pubkey.slice(0, 16)}...`);
      }
      const payResult = await this.node.sendPayment(payParams);

      this.onLog(`Payment sent: ${payResult.payment_hash?.slice(0, 16) || 'unknown'}... (status: ${payResult.status}, fee: ${payResult.fee ?? 'N/A'})`);

      // Wait for payment to reach terminal state if still in flight
      let finalFee = payResult.fee || '0x0';
      if (payResult.status !== 'Success' && payResult.status !== 'Failed') {
        this.onLog('Waiting for payment to complete...');
        try {
          const finalResult = await this.node.waitForPayment(payResult.payment_hash, {
            timeout: 30000,
            interval: 1000,
          });
          this.onLog(`Payment final status: ${finalResult.status}, fee: ${finalResult.fee ?? 'N/A'}`);
          finalFee = finalResult.fee || '0x0';
          if (finalResult.status === 'Failed') {
            throw new Error(finalResult.failed_error || 'Payment failed');
          }
        } catch (waitErr) {
          this.onLog(`Payment wait error: ${waitErr instanceof Error ? waitErr.message : 'unknown'}`);
          throw waitErr;
        }
      }

      if (payResult.status === 'Failed') {
        throw new Error(payResult.failed_error || 'Payment failed');
      }

      // Extract routing fee from payment final result (network layer fee)
      const routingFeeShannon = finalFee ? BigInt(finalFee) : BigInt(0);
      const routingFeeCkb = Number(routingFeeShannon) / 100_000_000;
      this.onLog(`Network routing fee: ${routingFeeCkb.toFixed(6)} CKB`);

      // Step 3: Notify server of payment (include routing fee for stats)
      const confirmRes = await fetch(`/api/invoices/${invoiceData.id}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preimage: payResult.payment_hash || payment_hash,
          payment_hash,
          routing_fee_ckb: routingFeeCkb,
        }),
      });

      const confirmData = await confirmRes.json();
      if (!confirmRes.ok) {
        throw new Error(confirmData.error || 'Payment confirmation failed');
      }

      this.onLog('Payment confirmed by server');

      attempt.status = 'success';
      const amountShannon = BigInt(Math.floor(this.amountPerPaymentCkb * 100_000_000));
      this.state.totalPaid += amountShannon;
      this.state.paymentCount++;
      this.state.lastPaymentTime = Date.now();

      this.onPaymentSent({
        paymentHash: payment_hash,
        amount: amountShannon,
        fee: BigInt(0),
      });
    } catch (error) {
      attempt.status = 'failed';
      attempt.error = error instanceof Error ? error.message : 'Unknown error';
      this.onError(error instanceof Error ? error : new Error('Unknown error'));
    }
  }
}
