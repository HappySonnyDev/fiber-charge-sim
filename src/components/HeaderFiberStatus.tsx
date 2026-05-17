'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { UseFiberNodeResult } from '../hooks/useFiberNode';
import type { BrowserNodeState } from '@fiber-pay/sdk/browser';
import type { PendingChannel } from '../hooks/useChannelOpening';

interface HeaderFiberStatusProps {
  fiberNode: UseFiberNodeResult;
  pendingChannel?: PendingChannel | null;
  onOpenChannel?: () => void;
}

function formatElapsed(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function getBrowserNodeStateLabel(state: BrowserNodeState): string {
  switch (state) {
    case 'idle': return 'Idle';
    case 'unlocking': return 'Unlocking Passkey...';
    case 'starting': return 'Starting WASM Node...';
    case 'running': return 'Running';
    case 'stopping': return 'Stopping...';
    case 'stopped': return 'Stopped';
    case 'error': return 'Error';
    default: return 'Unknown';
  }
}

const HeaderFiberStatus: React.FC<HeaderFiberStatusProps> = ({ fiberNode, pendingChannel, onOpenChannel }) => {
  const {
    isConnected,
    isConnecting,
    nodeInfo,
    channels,
    peers,
    error,
    connect,
    disconnect,
    settleRouterChannels,
    passkeySupported,
    passkeyConfigured,
    browserNodeState,
    availableBalance,
    ckbAddress,
    onChainBalance,
    isRefreshing,
    refresh,
  } = fiberNode;

  const [open, setOpen] = useState(false);
  const [isSettling, setIsSettling] = useState(false);
  const [settleError, setSettleError] = useState<string | null>(null);
  const [settleSuccess, setSettleSuccess] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const wrapRef = useRef<HTMLDivElement>(null);

  const hasPending = !!pendingChannel && pendingChannel.step !== 'failed' && pendingChannel.step !== 'ready';

  // 当 pending 中时持续刷新 elapsed 用于徽章倒计时显示
  useEffect(() => {
    if (!hasPending) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [hasPending]);

  // 外部点击关闭下拉
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const statusDotColor = isConnecting
    ? 'bg-amber-400'
    : hasPending
      ? 'bg-amber-400'
      : isConnected
        ? 'bg-green-400'
        : 'bg-red-400';

  // 未连接：紧凑 Connect 入口
  if (!isConnected) {
    return (
      <div ref={wrapRef} className="relative flex items-center gap-3">
        <div className="text-right hidden sm:block">
          <p className="text-xs text-gray-400 font-mono">FIBER NODE</p>
          <p className="text-red-400/80 font-mono text-sm flex items-center gap-2 justify-end">
            <span className={`w-2 h-2 rounded-full ${statusDotColor} ${isConnecting ? 'animate-pulse' : ''}`} />
            {isConnecting ? getBrowserNodeStateLabel(browserNodeState) : 'DISCONNECTED'}
          </p>
        </div>
        <button
          onClick={connect}
          disabled={isConnecting || passkeySupported === false}
          className={`px-4 py-2 rounded-lg font-display font-bold text-xs tracking-wider transition-all ${
            isConnecting || passkeySupported === false
              ? 'bg-gray-800 border border-gray-600 text-gray-500 cursor-not-allowed'
              : 'bg-cyan-500/20 border border-cyan-400 text-cyan-400 hover:bg-cyan-500/30 glow-cyan'
          }`}
        >
          {isConnecting ? 'STARTING...' : 'CONNECT'}
        </button>
      </div>
    );
  }

  // 已连接：紧凑摘要 + 下拉
  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-4 px-3 py-1.5 rounded-lg hover:bg-cyan-500/10 transition-colors"
      >
        {/* 状态指示 */}
        <div className="relative flex items-center">
          <span className={`w-2.5 h-2.5 rounded-full ${statusDotColor}`} />
          <motion.span
            className="absolute inset-0 rounded-full bg-green-400"
            initial={{ scale: 1, opacity: 0.5 }}
            animate={{ scale: 2.5, opacity: 0 }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        </div>

        {/* Pending channel 徽章 */}
        {hasPending && pendingChannel && (
          <div className="text-right border border-amber-500/40 bg-amber-500/10 rounded px-2 py-0.5">
            <p className="text-[9px] text-amber-300 font-mono uppercase leading-tight">Opening</p>
            <p className="font-mono text-amber-400 text-xs tabular-nums leading-tight">
              {formatElapsed(now - pendingChannel.startedAt)}
            </p>
          </div>
        )}

        {/* Channels */}
        <div className="text-right">
          <p className="text-[10px] text-gray-500 font-mono uppercase">Channels</p>
          <p className="font-mono text-amber-400 text-sm tabular-nums">{channels.length}</p>
        </div>

        {/* Channel Balance */}
        <div className="text-right">
          <p className="text-[10px] text-gray-500 font-mono uppercase">Channel</p>
          <p className="font-mono text-green-400 text-sm tabular-nums">{availableBalance}</p>
        </div>

        {/* On-Chain Balance */}
        <div className="text-right">
          <p className="text-[10px] text-gray-500 font-mono uppercase">On-Chain</p>
          <p className="font-mono text-cyan-400 text-sm tabular-nums">{onChainBalance}</p>
        </div>

        {/* 全局刷新按钮：一次刷新所有链上数据，避免用户重载页面导致 wasm node 断连 */}
        <span
          role="button"
          tabIndex={0}
          aria-label="Refresh on-chain data"
          title="Refresh on-chain data"
          onClick={(e) => {
            e.stopPropagation();
            if (!isRefreshing) refresh();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              e.stopPropagation();
              if (!isRefreshing) refresh();
            }
          }}
          className={`p-1 rounded transition-colors ${
            isRefreshing ? 'text-cyan-300 cursor-wait' : 'text-gray-500 hover:text-cyan-400 hover:bg-cyan-500/10 cursor-pointer'
          }`}
        >
          <motion.svg
            className="w-3.5 h-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            animate={isRefreshing ? { rotate: 360 } : { rotate: 0 }}
            transition={isRefreshing ? { duration: 1, repeat: Infinity, ease: 'linear' } : { duration: 0.2 }}
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h5M20 20v-5h-5M5 9a7 7 0 0112-4.95M19 15a7 7 0 01-12 4.95" />
          </motion.svg>
        </span>

        {/* 箭头 */}
        <motion.svg
          className="w-4 h-4 text-gray-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </motion.svg>
      </button>

      {/* 详情下拉 */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 right-0 top-full mt-2 w-full min-w-[360px] glass-panel p-4 z-50 shadow-xl"
          >
            <div className="space-y-3">
              <h4 className="font-display text-xs text-cyan-400 tracking-wider border-b border-cyan-500/10 pb-2">
                FIBER NODE DETAILS
              </h4>

              {nodeInfo && (
                <div className="space-y-2">
                  <Row label="Node Name" value={nodeInfo.node_name || 'Unnamed'} valueClass="text-white truncate max-w-[200px]" />
                  <Row label="Pubkey" value={`${nodeInfo.pubkey?.slice(0, 20)}...`} valueClass="text-cyan-400 text-[10px]" />
                  <Row label="Peers" value={String(peers.length)} valueClass="text-amber-400" />
                  <Row label="Passkey" value={
                    passkeySupported === null ? 'Checking...' :
                    passkeySupported ? 'Supported' : 'Not Supported'
                  } valueClass={
                    passkeySupported === null ? 'text-gray-500' :
                    passkeySupported ? 'text-green-400' : 'text-red-400'
                  } />
                  <Row label="Key" value={passkeyConfigured ? 'Configured' : 'Not Set'} valueClass={passkeyConfigured ? 'text-green-400' : 'text-amber-400'} />
                </div>
              )}

              {/* CKB Address */}
              {ckbAddress && (
                <div className="pt-2 border-t border-cyan-500/10">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-gray-500 font-mono">CKB Address</span>
                    <button
                      onClick={() => navigator.clipboard.writeText(ckbAddress)}
                      className="text-[10px] text-cyan-400 hover:text-cyan-300 transition-colors"
                    >
                      Copy
                    </button>
                  </div>
                  <div className="font-mono text-[10px] text-gray-400 break-all bg-black/30 p-2 rounded">
                    {ckbAddress}
                  </div>

                  {availableBalance === '0.000000 CKB' && (
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-2 mt-2">
                      <p className="text-[10px] text-amber-400 mb-1">
                        You can get testnet CKB from the faucet below.
                      </p>
                      <a
                        href="https://faucet.nervos.org/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[10px] font-mono text-cyan-400 hover:text-cyan-300"
                      >
                        <span>Get CKB from Faucet ↗</span>
                      </a>
                    </div>
                  )}
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="bg-red-900/20 rounded-lg p-2 border border-red-500/30">
                  <p className="text-[10px] font-mono text-red-400">{error}</p>
                </div>
              )}

              {/* Settle feedback */}
              {settleSuccess && (
                <div className="bg-green-900/20 rounded-lg p-2 border border-green-500/30">
                  <p className="text-[10px] font-mono text-green-400">{settleSuccess}</p>
                </div>
              )}
              {settleError && (
                <div className="bg-red-900/20 rounded-lg p-2 border border-red-500/30">
                  <p className="text-[10px] font-mono text-red-400">{settleError}</p>
                </div>
              )}

              {/* 通道开立中提示 */}
              {hasPending && pendingChannel && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-2">
                  <p className="text-[10px] font-mono text-amber-400">
                    Channel opening · {formatElapsed(now - pendingChannel.startedAt)} elapsed
                  </p>
                  <p className="text-[10px] font-mono text-amber-300/70 mt-0.5">
                    {pendingChannel.step === 'submitting' && 'Submitting open_channel RPC...'}
                    {pendingChannel.step === 'negotiating' && 'Negotiating with router...'}
                    {pendingChannel.step === 'awaiting_ready' && 'Waiting for on-chain confirmation...'}
                  </p>
                  {onOpenChannel && (
                    <button
                      onClick={() => {
                        setOpen(false);
                        onOpenChannel();
                      }}
                      className="mt-2 text-[10px] text-amber-300 hover:text-amber-200 font-mono underline"
                    >
                      View progress →
                    </button>
                  )}
                </div>
              )}

              {/* Open new channel */}
              {onOpenChannel && !hasPending && (
                <button
                  onClick={() => {
                    setOpen(false);
                    onOpenChannel();
                  }}
                  className="w-full py-2 rounded-lg font-display font-bold text-[10px] tracking-wider bg-cyan-500/15 border border-cyan-400/60 text-cyan-400 hover:bg-cyan-500/25 transition-all"
                >
                  + OPEN NEW CHANNEL
                </button>
              )}

              {/* Actions */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-cyan-500/10">
                <button
                  onClick={async () => {
                    setIsSettling(true);
                    setSettleError(null);
                    setSettleSuccess(null);
                    try {
                      const count = await settleRouterChannels();
                      setSettleSuccess(`已提交结算请求，共关闭 ${count} 个通道，等待上链确认`);
                    } catch (err) {
                      setSettleError(err instanceof Error ? err.message : '结算失败');
                    } finally {
                      setIsSettling(false);
                    }
                  }}
                  disabled={isSettling}
                  className={`py-2 rounded-lg font-display font-bold text-[10px] tracking-wider transition-all ${
                    isSettling
                      ? 'bg-gray-800 border border-gray-600 text-gray-500 cursor-not-allowed'
                      : 'bg-amber-500/20 border border-amber-400 text-amber-400 hover:bg-amber-500/30'
                  }`}
                >
                  {isSettling ? 'SETTLING...' : 'SETTLE & CLOSE'}
                </button>
                <button
                  onClick={() => {
                    disconnect();
                    setOpen(false);
                  }}
                  className="py-2 rounded-lg font-display font-bold text-[10px] tracking-wider bg-red-500/10 border border-red-500/40 text-red-400 hover:bg-red-500/20 transition-all"
                >
                  DISCONNECT
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const Row: React.FC<{ label: string; value: string; valueClass?: string }> = ({ label, value, valueClass }) => (
  <div className="flex items-center justify-between text-xs">
    <span className="text-gray-500 font-mono">{label}</span>
    <span className={`font-mono ${valueClass || 'text-white'}`}>{value}</span>
  </div>
);

export default HeaderFiberStatus;
