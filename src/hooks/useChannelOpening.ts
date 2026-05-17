'use client';

import { useState, useCallback, useEffect } from 'react';
import type { FiberBrowserNode, ListChannelsResult } from '@fiber-pay/sdk/browser';

export type OpenStep = 'submitting' | 'negotiating' | 'awaiting_ready' | 'ready' | 'failed';

export interface PendingChannel {
  capacity: string; // bigint serialized as string for localStorage
  startedAt: number;
  channelId?: string;
  step: OpenStep;
  error?: string;
}

const STORAGE_KEY = 'fiber-charge:pending-channel';
const STALE_MS = 60 * 60 * 1000; // 1 hour

const ROUTER_WS_MULTIADDR =
  process.env.NEXT_PUBLIC_ROUTER_WS_ADDRESS ||
  '/ip4/127.0.0.1/tcp/8231/ws/p2p/03a14ea2a93b52fafa23edc29a2b90a1319e328665a5636163a18a0eea6588e2af';
const ROUTER_PUBKEY_MATCH = ROUTER_WS_MULTIADDR.match(/p2p\/([a-f0-9]+)$/i);
const ROUTER_PUBKEY = ROUTER_PUBKEY_MATCH ? (`0x${ROUTER_PUBKEY_MATCH[1]}`) : null;
const ROUTER_WS_ADDRESS = ROUTER_WS_MULTIADDR.replace(/\/p2p\/[a-f0-9]+$/i, '');

function classifyState(stateName: string): OpenStep {
  const s = stateName.toLowerCase();
  if (s.includes('ready')) return 'ready';
  if (s.includes('await')) return 'awaiting_ready';
  if (s.includes('closed') || s.includes('shutdown') || s.includes('closing')) return 'failed';
  // 默认归类为协商中（covers NegotiatingFunding、SigningCommitment 等中间态）
  return 'negotiating';
}

export interface UseChannelOpeningResult {
  pending: PendingChannel | null;
  startOpen: (capacity: bigint) => Promise<void>;
  dismiss: () => void;
}

export function useChannelOpening(
  channels: ListChannelsResult['channels'],
  browserNodeRef: React.MutableRefObject<FiberBrowserNode | null>,
): UseChannelOpeningResult {
  const [pending, setPending] = useState<PendingChannel | null>(null);

  // 首次加载从 localStorage 恢复
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as PendingChannel;
      // 清理过期记录（避免 stale pending 永久占用 UI）
      if (Date.now() - parsed.startedAt > STALE_MS) {
        localStorage.removeItem(STORAGE_KEY);
        return;
      }
      setPending(parsed);
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  // 同步 pending → localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (pending) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pending));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [pending]);

  // 根据真实通道列表更新 step
  useEffect(() => {
    if (!pending) return;
    if (pending.step === 'failed' || pending.step === 'ready') return;

    let matched: ListChannelsResult['channels'][number] | undefined;

    if (pending.channelId) {
      matched = channels.find((ch) => ch.channel_id === pending.channelId);
    }

    if (!matched && ROUTER_PUBKEY) {
      const routerNorm = ROUTER_PUBKEY.replace(/^0x/i, '').toLowerCase();
      const routerChannels = channels.filter((ch) => {
        const peer = ch.pubkey?.replace(/^0x/i, '').toLowerCase();
        return peer === routerNorm;
      });
      // 优先取非 ready 的，认为是新开的；否则取最后一个
      const nonReady = routerChannels.filter(
        (ch) => !ch.state.state_name.toLowerCase().includes('ready'),
      );
      matched = nonReady[nonReady.length - 1] || routerChannels[routerChannels.length - 1];
    }

    if (matched) {
      const step = classifyState(matched.state.state_name);
      setPending((prev) => {
        if (!prev) return prev;
        if (prev.channelId === matched!.channel_id && prev.step === step) return prev;
        return { ...prev, channelId: matched!.channel_id, step };
      });
    }
  }, [channels, pending]);

  const startOpen = useCallback(
    async (capacity: bigint) => {
      if (!browserNodeRef.current) throw new Error('Node not connected');
      if (!ROUTER_PUBKEY) throw new Error('Router pubkey not configured');

      const node = browserNodeRef.current;

      setPending({
        capacity: capacity.toString(),
        startedAt: Date.now(),
        step: 'submitting',
      });

      try {
        // 确保已连接 router peer（已连接的话会抛错被吞掉，无影响）
        try {
          await node.connectPeer({
            address: ROUTER_WS_ADDRESS,
            pubkey: ROUTER_PUBKEY as `0x${string}`,
          });
        } catch {
          // peer 可能已连接
        }
        await new Promise((r) => setTimeout(r, 1500));

        const result = await node.openChannel({
          pubkey: ROUTER_PUBKEY as `0x${string}`,
          funding_amount: `0x${capacity.toString(16)}` as `0x${string}`,
        });

        const r = result as { temporary_channel_id?: string; channel_id?: string };
        const channelId = r.temporary_channel_id || r.channel_id;

        setPending((prev) =>
          prev ? { ...prev, step: 'negotiating', channelId: channelId || prev.channelId } : prev,
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to open channel';
        setPending((prev) => (prev ? { ...prev, step: 'failed', error: msg } : prev));
        throw err;
      }
    },
    [browserNodeRef],
  );

  const dismiss = useCallback(() => setPending(null), []);

  return { pending, startOpen, dismiss };
}
