// Streaming payment implementation
import type { FiberBrowserNode } from '@fiber-pay/sdk/browser';
import type { SendPaymentResult } from '@fiber-pay/sdk/browser';

export type HexString = `0x${string}`;

export interface PaymentAttempt {
  id: string;
  timestamp: number;
  amount: bigint;
  status: 'pending' | 'success' | 'failed';
  error?: string;
  result?: SendPaymentResult;
}

export interface StreamingPaymentState {
  isStreaming: boolean;
  totalPaid: bigint;
  paymentCount: number;
  lastPaymentTime: number | null;
  attempts: PaymentAttempt[];
}

export interface StreamingPaymentOptions {
  node: FiberBrowserNode;
  recipientPubkey: HexString;
  amountPerInterval: bigint;
  intervalMs: number;
  onPaymentSent?: (result: SendPaymentResult) => void;
  onError?: (error: Error) => void;
}

export class StreamingPayment {
  private node: FiberBrowserNode;
  private _recipientPubkey: HexString;
  private intervalMs: number;
  private amountPerPayment: bigint;
  private timer: ReturnType<typeof setInterval> | null = null;
  private state: StreamingPaymentState;
  private onPaymentSent: (result: SendPaymentResult) => void;
  private onError: (error: Error) => void;

  constructor(options: StreamingPaymentOptions) {
    this.node = options.node;
    this._recipientPubkey = options.recipientPubkey;
    this.intervalMs = options.intervalMs || 10000; // Default 10s
    this.amountPerPayment = options.amountPerInterval || BigInt(1000); // Default 1000 shannon
    this.onPaymentSent = options.onPaymentSent || (() => {});
    this.onError = options.onError || (() => {});
    this.state = {
      isStreaming: false,
      totalPaid: BigInt(0),
      paymentCount: 0,
      lastPaymentTime: null,
      attempts: [],
    };
  }

  getState(): StreamingPaymentState {
    return { ...this.state };
  }

  async start(): Promise<void> {
    if (this.state.isStreaming) {
      return;
    }

    this.state.isStreaming = true;
    this.timer = setInterval(() => this.makePayment(), this.intervalMs);
    
    // Make first payment immediately
    await this.makePayment();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.state.isStreaming = false;
  }

  private async makePayment(): Promise<void> {
    const attempt: PaymentAttempt = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      amount: this.amountPerPayment,
      status: 'pending',
    };

    this.state.attempts.push(attempt);

    try {
      console.log('Sending Fiber payment (keysend):', {
        target: this._recipientPubkey,
        amount: this.amountPerPayment.toString(),
      });

      // Send real payment through Fiber using keysend mode
      // Keysend allows sending payment without recipient creating invoice first
      const result = await this.node.sendPayment({
        target_pubkey: this._recipientPubkey,
        amount: `0x${this.amountPerPayment.toString(16)}` as HexString,
        keysend: true,
      });

      console.log('Fiber payment success:', result);

      attempt.status = 'success';
      attempt.result = result;
      this.state.totalPaid += this.amountPerPayment;
      this.state.paymentCount++;
      this.state.lastPaymentTime = Date.now();

      this.onPaymentSent(result);
    } catch (error) {
      attempt.status = 'failed';
      attempt.error = error instanceof Error ? error.message : 'Unknown error';
      this.onError(error instanceof Error ? error : new Error('Unknown error'));
    }
  }
}
