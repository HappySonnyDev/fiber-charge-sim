// Fiber RPC types and utilities
// Based on fiber-audio-player implementation

export type HexString = `0x${string}`;

export interface NodeInfo {
  version: string;
  commit_hash: string;
  public_key: HexString;
  node_name: string;
  peer_id: string;
  addresses: string[];
  default_funding_lock_script: {
    code_hash: HexString;
    hash_type: 'type' | 'data';
    args: HexString;
  };
  channels: {
    channel_id: HexString;
    peer_pubkey: HexString;
    state: ChannelState;
  }[];
}

export enum ChannelState {
  ChannelReady = 'CHANNEL_READY',
  AwaitingTxSignatures = 'AWAITING_TX_SIGNATURES',
  NegotiatingFunding = 'NEGOTIATING_FUNDING',
  Closed = 'CLOSED',
}

export interface Channel {
  channel_id: HexString;
  peer_pubkey: HexString;
  state: {
    state_name: ChannelState;
  };
  local_balance: HexString;
  remote_balance: HexString;
}

export interface PeerInfo {
  pubkey: HexString;
  peer_id: string;
  addresses: string[];
}

export interface PaymentRequest {
  target_pubkey: HexString;
  amount: HexString;
  keysend?: boolean;
  dry_run?: boolean;
}

export interface PaymentResult {
  payment_hash: HexString;
  status: 'Succeeded' | 'Failed' | 'Pending';
}

// Utility functions
export function toHex(value: bigint | number): HexString {
  return `0x${value.toString(16)}` as HexString;
}

export function fromHex(hex: HexString): bigint {
  return BigInt(hex);
}

export function ckbToShannon(ckb: number): bigint {
  return BigInt(Math.floor(ckb * 100_000_000));
}

export function shannonToCkb(shannon: bigint): number {
  return Number(shannon) / 100_000_000;
}

export function formatShannon(shannon: bigint): string {
  const ckb = shannonToCkb(shannon);
  return `${ckb.toFixed(6)} CKB`;
}

// RPC Client
export class FiberRpcClient {
  private url: string;

  constructor(url: string) {
    this.url = url;
  }

  async call<T>(method: string, params?: unknown): Promise<T> {
    const response = await fetch(this.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method,
        params,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(`RPC Error: ${data.error.message}`);
    }

    return data.result;
  }

  async node_info(): Promise<NodeInfo> {
    return this.call('node_info');
  }

  async list_channels(params?: { pubkey?: HexString }): Promise<{ channels: Channel[] }> {
    return this.call('list_channels', params);
  }

  async list_peers(): Promise<{ peers: PeerInfo[] }> {
    return this.call('list_peers');
  }

  async connect_peer(params: { address: string; save?: boolean }): Promise<unknown> {
    return this.call('connect_peer', params);
  }

  async open_channel(params: {
    pubkey: HexString;
    funding_amount: HexString;
    public?: boolean;
  }): Promise<unknown> {
    return this.call('open_channel', params);
  }

  async send_payment(params: PaymentRequest): Promise<PaymentResult> {
    return this.call('send_payment', params);
  }
}

// Streaming payment client interface
export interface StreamingPaymentClient {
  sendPayment: (params: PaymentRequest) => Promise<PaymentResult>;
  waitForPayment: (paymentHash: HexString, options?: { timeout?: number }) => Promise<PaymentResult>;
}
