'use client';

import { useState, useCallback } from 'react';
import type { FiberBrowserNode } from '@fiber-pay/sdk/browser';

// Router WebSocket address - must match the bootnode multiaddr in App.tsx
// Format: /ip4/IP/tcp/PORT/ws/p2p/PUBKEY
// NOTE: connect_peer RPC requires address WITHOUT /p2p/ part, pubkey passed separately
const ROUTER_WS_MULTIADDR = process.env.NEXT_PUBLIC_ROUTER_WS_ADDRESS || '/ip4/127.0.0.1/tcp/8231/ws/p2p/03a14ea2a93b52fafa23edc29a2b90a1319e328665a5636163a18a0eea6588e2af';

const ROUTER_PUBKEY_MATCH = ROUTER_WS_MULTIADDR.match(/p2p\/([a-f0-9]+)$/i);
const ROUTER_PUBKEY = ROUTER_PUBKEY_MATCH ? (`0x${ROUTER_PUBKEY_MATCH[1]}` as `0x${string}`) : null;
const ROUTER_WS_ADDRESS = ROUTER_WS_MULTIADDR.replace(/\/p2p\/[a-f0-9]+$/i, '');

export interface ChannelManagerResult {
  isOpening: boolean;
  isPaying: boolean;
  error: string | null;
  openChannel: (node: FiberBrowserNode, counterpartyPubkey: string, capacity: bigint) => Promise<void>;
  closeChannel: (node: FiberBrowserNode, channelId: string) => Promise<void>;
  sendPayment: (node: FiberBrowserNode, targetPubkey: string, amount: bigint, paymentHash?: string) => Promise<{paymentHash: string, fee: bigint}>;
}

export function useChannelManager(): ChannelManagerResult {
  const [isOpening, setIsOpening] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openChannel = useCallback(async (
    node: FiberBrowserNode,
    counterpartyPubkey: string,
    capacity: bigint
  ) => {
    setIsOpening(true);
    setError(null);

    try {
      // First, connect to the router peer if not already connected
      console.log('Connecting to router peer...');
      try {
        await node.connectPeer({
          address: ROUTER_WS_ADDRESS,
          pubkey: ROUTER_PUBKEY || undefined,
        });
        console.log('Connected to router peer');
      } catch (connectErr) {
        // Peer might already be connected, continue
        console.log('Peer connection result:', connectErr instanceof Error ? connectErr.message : 'unknown');
      }

      // Wait a moment for the connection to establish
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Open channel with router
      console.log('Opening channel with params:', {
        pubkey: counterpartyPubkey,
        funding_amount: `0x${capacity.toString(16)}`,
        capacity_ckb: Number(capacity) / 100_000_000
      });
      const result = await node.openChannel({
        pubkey: counterpartyPubkey as `0x${string}`,
        funding_amount: `0x${capacity.toString(16)}` as `0x${string}`,
      });
      console.log('Channel opened successfully, result:', result);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to open channel';
      setError(errorMsg);
      throw err;
    } finally {
      setIsOpening(false);
    }
  }, []);

  const closeChannel = useCallback(async (
    node: FiberBrowserNode,
    channelId: string
  ) => {
    try {
      console.log('Shutting down channel:', channelId);
      await node.shutdownChannel({
        channel_id: channelId as `0x${string}`,
      });
      console.log('Channel shutdown initiated:', channelId);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to close channel';
      setError(errorMsg);
      throw err;
    }
  }, []);

  const sendPayment = useCallback(async (
    node: FiberBrowserNode,
    targetPubkey: string,
    amount: bigint,
    paymentHash?: string
  ): Promise<{paymentHash: string, fee: bigint}> => {
    setIsPaying(true);
    setError(null);

    try {
      console.log('Sending payment:', {
        target: targetPubkey,
        amount: Number(amount) / 100_000_000,
        paymentHash: paymentHash || 'auto-generated'
      });

      // Generate payment hash if not provided
      const hash = paymentHash || `0x${Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')}`;

      const result = await node.sendPayment({
        target_pubkey: targetPubkey as `0x${string}`,
        amount: `0x${amount.toString(16)}` as `0x${string}`,
        payment_hash: hash as `0x${string}`,
      });

      console.log('Payment sent successfully:', result);
      return {
        paymentHash: hash,
        fee: BigInt(result.fee || 0)
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to send payment';
      setError(errorMsg);
      throw err;
    } finally {
      setIsPaying(false);
    }
  }, []);

  return {
    isOpening,
    isPaying,
    error,
    openChannel,
    closeChannel,
    sendPayment,
  };
}
