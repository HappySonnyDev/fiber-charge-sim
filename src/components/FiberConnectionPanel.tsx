import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { UseFiberNodeResult } from '../hooks/useFiberNode';
import type { BrowserNodeState } from '@fiber-pay/sdk/browser';

interface FiberConnectionPanelProps {
  fiberNode: UseFiberNodeResult;
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

const FiberConnectionPanel: React.FC<FiberConnectionPanelProps> = ({ fiberNode }) => {
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
  } = fiberNode;

  // 默认未连接时展开，让用户一眼看到连接入口；连接后自动折叠
  const [isExpanded, setIsExpanded] = useState(!isConnected);
  const [isSettling, setIsSettling] = useState(false);
  const [settleError, setSettleError] = useState<string | null>(null);
  const [settleSuccess, setSettleSuccess] = useState<string | null>(null);

  // 连接状态切换时自动调整展开状态：连接成功折叠，断开展开
  useEffect(() => {
    setIsExpanded(!isConnected);
  }, [isConnected]);

  const getStatusColor = () => {
    if (isConnecting) return 'bg-amber-400';
    if (isConnected) return 'bg-green-400';
    return 'bg-gray-500';
  };

  const getStatusText = () => {
    if (isConnecting) return getBrowserNodeStateLabel(browserNodeState);
    if (isConnected) return 'Connected';
    return 'Disconnected';
  };

  return (
    <div className="glass-panel p-4 relative">
      {/* Header - always visible */}
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          {/* Status indicator */}
          <div className="relative flex items-center">
            <span className={`w-2.5 h-2.5 rounded-full ${getStatusColor()}`} />
            {isConnected && (
              <motion.span
                className="absolute inset-0 rounded-full bg-green-400"
                initial={{ scale: 1, opacity: 0.5 }}
                animate={{ scale: 2.5, opacity: 0 }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            )}
            {isConnecting && (
              <motion.span
                className="absolute inset-0 rounded-full bg-amber-400"
                animate={{ scale: [1, 1.5, 1], opacity: [1, 0.4, 1] }}
                transition={{ duration: 0.8, repeat: Infinity }}
              />
            )}
          </div>

          <div>
            <p className="font-display text-xs text-cyan-400">FIBER NODE</p>
            <p className="text-xs font-mono text-gray-400">{getStatusText()}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isConnected && (
            <div className="text-right hidden sm:block">
              <p className="text-xs text-gray-500 font-mono">BALANCE</p>
              <p className="text-xs font-mono text-green-400">{availableBalance}</p>
            </div>
          )}
          <motion.svg
            className="w-4 h-4 text-gray-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </motion.svg>
        </div>
      </div>

      {/* Expanded panel */}
      {/* initial={false} 避免首次渲染时播放展开动画，未连接时直接以展开状态出现 */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="mt-4 space-y-3 border-t border-cyan-500/10 pt-4">

              {/* Passkey Support Status */}
              {!isConnected && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500 font-mono">Passkey Support</span>
                    <span className={`font-mono ${
                      passkeySupported === null ? 'text-gray-500' :
                      passkeySupported ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {passkeySupported === null ? 'Checking...' :
                       passkeySupported ? 'Supported' : 'Not Supported'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500 font-mono">Key Configured</span>
                    <span className={`font-mono ${passkeyConfigured ? 'text-green-400' : 'text-amber-400'}`}>
                      {passkeyConfigured ? 'Yes' : 'Will create on connect'}
                    </span>
                  </div>
                </div>
              )}

              {/* Connected Node Info */}
              {isConnected && nodeInfo && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500 font-mono">Node Name</span>
                    <span className="font-mono text-white truncate max-w-[160px]">
                      {nodeInfo.node_name || 'Unnamed'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500 font-mono">Pubkey</span>
                    <span className="font-mono text-cyan-400 text-[10px] truncate max-w-[160px]">
                      {nodeInfo.pubkey?.slice(0, 16)}...
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500 font-mono">Channels</span>
                    <span className="font-mono text-amber-400">{channels.length}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500 font-mono">Peers</span>
                    <span className="font-mono text-amber-400">{peers.length}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500 font-mono">Channel Balance</span>
                    <span className="font-mono text-green-400">{availableBalance}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500 font-mono">On-Chain Balance</span>
                    <span className="font-mono text-cyan-400">{onChainBalance}</span>
                  </div>

                  {/* CKB Address & Faucet Link */}
                  {ckbAddress && (
                    <>
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
                      </div>

                      {/* Zero balance warning & Faucet link */}
                      {availableBalance === '0.000000 CKB' && (
                        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 mt-2">
                          <p className="text-[10px] text-amber-400 mb-2">
                            You can get testnet CKB from the faucet below.
                          </p>
                          <a
                            href="https://faucet.nervos.org/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-mono text-cyan-400 hover:text-cyan-300 transition-colors"
                          >
                            <span>Get CKB from Faucet</span>
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </a>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Browser node state (when connecting) */}
              {isConnecting && (
                <div className="bg-black/40 rounded-lg p-3 border border-amber-500/20">
                  <div className="flex items-center gap-2">
                    <motion.div
                      className="w-2 h-2 rounded-full bg-amber-400"
                      animate={{ opacity: [1, 0.3, 1] }}
                      transition={{ duration: 0.8, repeat: Infinity }}
                    />
                    <span className="text-xs font-mono text-amber-400">
                      {getBrowserNodeStateLabel(browserNodeState)}
                    </span>
                  </div>
                  {browserNodeState === 'unlocking' && (
                    <p className="text-xs text-gray-500 mt-2">
                      Please authenticate with your Passkey in the browser prompt.
                    </p>
                  )}
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="bg-red-900/20 rounded-lg p-3 border border-red-500/30">
                  <p className="text-xs font-mono text-red-400">{error}</p>
                </div>
              )}

              {/* Connect / Disconnect Button */}
              {!isConnected ? (
                <button
                  onClick={connect}
                  disabled={isConnecting || passkeySupported === false}
                  className={`w-full py-3 rounded-lg font-display font-bold text-xs tracking-wider transition-all ${
                    isConnecting || passkeySupported === false
                      ? 'bg-gray-800 border border-gray-600 text-gray-500 cursor-not-allowed'
                      : 'bg-cyan-500/20 border border-cyan-400 text-cyan-400 hover:bg-cyan-500/30 glow-cyan'
                  }`}
                >
                  {isConnecting ? 'STARTING NODE...' : 'CONNECT FIBER NODE'}
                </button>
              ) : (
                <div className="space-y-2">
                  {/* Settle Button */}
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
                    className={`w-full py-3 rounded-lg font-display font-bold text-xs tracking-wider transition-all ${
                      isSettling
                        ? 'bg-gray-800 border border-gray-600 text-gray-500 cursor-not-allowed'
                        : 'bg-amber-500/20 border border-amber-400 text-amber-400 hover:bg-amber-500/30'
                    }`}
                  >
                    {isSettling ? 'SETTLING...' : 'SETTLE & CLOSE CHANNEL'}
                  </button>

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

                  {/* Disconnect Button */}
                  <button
                    onClick={disconnect}
                    className="w-full py-3 rounded-lg font-display font-bold text-xs tracking-wider transition-all bg-red-500/10 border border-red-500/40 text-red-400 hover:bg-red-500/20"
                  >
                    DISCONNECT
                  </button>
                </div>
              )}

              {/* Info text */}
              {!isConnected && !isConnecting && (
                <p className="text-[10px] text-gray-600 text-center font-mono">
                  Uses WebAuthn Passkey to manage your private key.
                  <br />No wallet extension needed.
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default FiberConnectionPanel;
