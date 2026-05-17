'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { PendingChannel, OpenStep } from '../hooks/useChannelOpening';

interface OpenChannelModalProps {
  open: boolean;
  onClose: () => void;
  onChainBalance: string;        // e.g. "12345.000000 CKB"
  ckbAddress?: string | null;    // 用户 CKB 地址，用于无余额时引导充值
  onRefresh?: () => Promise<void>; // 刷新链上数据（全局共享）
  isRefreshing?: boolean;
  pending: PendingChannel | null;
  startOpen: (capacity: bigint) => Promise<void>;
  dismiss: () => void;            // 清除 pending 状态（成功/失败后）
}

const CKB_TESTNET_FAUCET_URL = 'https://faucet.nervos.org/';

const PRESET_AMOUNTS: { label: string; value: bigint }[] = [
  { label: '200 CKB', value: 200n * 100_000_000n },
  { label: '500 CKB', value: 500n * 100_000_000n },
  { label: '1000 CKB', value: 1000n * 100_000_000n },
  { label: '5000 CKB', value: 5000n * 100_000_000n },
];

const STEPS: { key: OpenStep; label: string; hint: string }[] = [
  { key: 'submitting', label: 'Submitting', hint: 'Calling open_channel RPC' },
  { key: 'negotiating', label: 'Negotiating', hint: 'Building funding transaction with router' },
  { key: 'awaiting_ready', label: 'On-Chain Confirmation', hint: 'Waiting for funding tx to be confirmed' },
  { key: 'ready', label: 'Channel Ready', hint: 'You can charge now' },
];

function stepIndex(step: OpenStep): number {
  switch (step) {
    case 'submitting': return 0;
    case 'negotiating': return 1;
    case 'awaiting_ready': return 2;
    case 'ready': return 3;
    case 'failed': return -1;
  }
}

function formatElapsed(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const OpenChannelModal: React.FC<OpenChannelModalProps> = ({
  open,
  onClose,
  onChainBalance,
  ckbAddress,
  onRefresh,
  isRefreshing = false,
  pending,
  startOpen,
  dismiss,
}) => {
  const [selectedAmount, setSelectedAmount] = useState<bigint | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [copied, setCopied] = useState(false);

  // 实时刷新 elapsed
  useEffect(() => {
    if (!open || !pending) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [open, pending]);

  // 关闭时清空局部状态
  useEffect(() => {
    if (!open) {
      setSelectedAmount(null);
      setSubmitError(null);
      setCopied(false);
    }
  }, [open]);

  const onChainNum = parseFloat(onChainBalance.replace(' CKB', '')) || 0;
  const noFunds = onChainNum <= 0;
  const hasPending = !!pending && pending.step !== 'failed';
  const isReady = pending?.step === 'ready';
  const isFailed = pending?.step === 'failed';

  const handleCopyAddress = async () => {
    if (!ckbAddress) return;
    try {
      await navigator.clipboard.writeText(ckbAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error('Failed to copy address', err);
    }
  };

  const handleSubmit = async () => {
    if (!selectedAmount) return;
    setSubmitError(null);
    try {
      await startOpen(selectedAmount);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to open channel');
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, y: 10 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 10 }}
            transition={{ duration: 0.18 }}
            className="glass-panel p-6 w-full max-w-[520px] relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-300 transition-colors"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Title */}
            <h2 className="font-display text-lg text-cyan-400 tracking-wider mb-1">
              OPEN PAYMENT CHANNEL
            </h2>
            <p className="text-xs text-gray-500 font-mono mb-5">
              Fund a new channel with the Router to enable instant charging payments.
            </p>

            {/* === Pending / Result View === */}
            {hasPending || isFailed ? (
              <PendingView
                pending={pending!}
                elapsedMs={now - pending!.startedAt}
                onBackground={onClose}
                onDone={() => {
                  dismiss();
                  onClose();
                }}
                onRetry={() => {
                  dismiss();
                  setSelectedAmount(null);
                  setSubmitError(null);
                }}
                isReady={isReady}
                isFailed={isFailed}
              />
            ) : (
              /* === Amount Picker View === */
              <>
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2 text-xs">
                    <span className="text-gray-500 font-mono">Select Capacity</span>
                    <span className="text-gray-500 font-mono flex items-center gap-1.5">
                      On-Chain: <span className={noFunds ? 'text-red-400' : 'text-cyan-400'}>{onChainBalance}</span>
                      {onRefresh && (
                        <button
                          type="button"
                          onClick={() => { if (!isRefreshing) onRefresh(); }}
                          disabled={isRefreshing}
                          aria-label="Refresh on-chain data"
                          title="Refresh on-chain data"
                          className={`p-0.5 rounded transition-colors ${
                            isRefreshing
                              ? 'text-cyan-300 cursor-wait'
                              : 'text-gray-500 hover:text-cyan-400 hover:bg-cyan-500/10'
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
                        </button>
                      )}
                    </span>
                  </div>

                  {/* 无链上余额：展示 CKB 地址 + 水龙头链接 */}
                  {noFunds && (
                    <div className="mb-3 p-3 bg-amber-500/5 border border-amber-500/30 rounded-lg space-y-3">
                      <div className="flex items-start gap-2">
                        <svg className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <div className="flex-1">
                          <p className="text-xs font-mono text-amber-300">No on-chain CKB</p>
                          <p className="text-[10px] text-gray-500 font-mono mt-0.5">
                            You need testnet CKB to fund a channel. Send CKB to the address below from the faucet.
                          </p>
                        </div>
                      </div>

                      {/* CKB Address */}
                      <div>
                        <p className="text-[10px] text-gray-500 font-mono uppercase mb-1">Your CKB Address</p>
                        <div className="flex items-center gap-2 bg-black/50 border border-gray-700 rounded px-2 py-1.5">
                          <code className="flex-1 text-[10px] text-cyan-300 font-mono break-all leading-relaxed">
                            {ckbAddress || 'Loading address...'}
                          </code>
                          <button
                            type="button"
                            onClick={handleCopyAddress}
                            disabled={!ckbAddress}
                            className="flex-shrink-0 px-2 py-1 rounded text-[10px] font-mono tracking-wider bg-cyan-500/20 border border-cyan-400/60 text-cyan-300 hover:bg-cyan-500/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            {copied ? 'COPIED' : 'COPY'}
                          </button>
                        </div>
                      </div>

                      {/* Faucet link */}
                      <a
                        href={CKB_TESTNET_FAUCET_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between gap-2 px-3 py-2 rounded bg-cyan-500/10 border border-cyan-500/40 hover:bg-cyan-500/20 transition-colors group"
                      >
                        <div>
                          <p className="text-xs font-mono text-cyan-300">CKB Testnet Faucet</p>
                          <p className="text-[10px] text-gray-500 font-mono">faucet.nervos.org</p>
                        </div>
                        <svg className="w-4 h-4 text-cyan-400 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>

                      {/* 已充值提示：避免用户重载页面 */}
                      <p className="text-[10px] text-gray-500 font-mono leading-relaxed">
                        Already funded from the faucet? It usually takes a few minutes for the transaction to be confirmed on-chain. Use the
                        <span className="inline-flex items-center gap-0.5 mx-1 text-cyan-400">
                          <svg className="w-3 h-3 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h5M20 20v-5h-5M5 9a7 7 0 0112-4.95M19 15a7 7 0 01-12 4.95" />
                          </svg>
                          refresh
                        </span>
                        button above to check again — no need to reload the page.
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    {PRESET_AMOUNTS.map((amount) => {
                      const ckb = Number(amount.value) / 100_000_000;
                      const canAfford = onChainNum >= ckb;
                      const isSelected = selectedAmount === amount.value;
                      return (
                        <button
                          key={amount.label}
                          type="button"
                          onClick={() => canAfford && setSelectedAmount(amount.value)}
                          disabled={!canAfford}
                          className={`px-4 py-3 rounded-lg text-sm font-mono transition-all ${
                            isSelected
                              ? 'bg-cyan-500/20 border border-cyan-400 text-cyan-400 glow-cyan'
                              : canAfford
                                ? 'bg-black/40 border border-gray-700 text-gray-300 hover:border-cyan-500/40'
                                : 'bg-black/20 border border-gray-800 text-gray-600 cursor-not-allowed'
                          }`}
                        >
                          {amount.label}
                          {!canAfford && (
                            <span className="block text-[10px] text-red-500/70 mt-0.5">
                              Insufficient
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Summary */}
                {selectedAmount && (
                  <div className="mb-4 p-3 bg-black/40 rounded-lg border border-cyan-500/20 space-y-1 text-xs">
                    <Row label="Capacity" value={`${Number(selectedAmount) / 100_000_000} CKB`} valueClass="text-cyan-400 font-mono" />
                    <Row label="Counterparty" value="Router" valueClass="text-amber-400 font-mono" />
                    <Row label="Expected Wait" value="~ 2-5 min on-chain" valueClass="text-gray-400 font-mono" />
                  </div>
                )}

                {submitError && (
                  <div className="mb-3 p-2 bg-red-500/10 border border-red-500/20 rounded">
                    <p className="text-xs text-red-400 font-mono">{submitError}</p>
                  </div>
                )}

                <div className="flex gap-2 mt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 py-2.5 rounded-lg font-display text-xs tracking-wider bg-gray-800/50 border border-gray-700 text-gray-400 hover:bg-gray-800 transition-all"
                  >
                    CANCEL
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={!selectedAmount}
                    className={`flex-[2] py-2.5 rounded-lg font-display font-bold text-xs tracking-wider transition-all ${
                      selectedAmount
                        ? 'bg-cyan-500/20 border border-cyan-400 text-cyan-400 hover:bg-cyan-500/30 glow-cyan'
                        : 'bg-gray-800 border border-gray-700 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    OPEN CHANNEL
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// === Pending Progress View ===
interface PendingViewProps {
  pending: PendingChannel;
  elapsedMs: number;
  onBackground: () => void;
  onDone: () => void;
  onRetry: () => void;
  isReady: boolean;
  isFailed: boolean;
}

const PendingView: React.FC<PendingViewProps> = ({
  pending, elapsedMs, onBackground, onDone, onRetry, isReady, isFailed,
}) => {
  const currentIdx = stepIndex(pending.step);
  const capacity = (Number(BigInt(pending.capacity)) / 100_000_000).toFixed(2);

  return (
    <div>
      {/* Stepper */}
      <div className="bg-black/40 rounded-lg border border-cyan-500/20 p-4 mb-4">
        <div className="space-y-3">
          {STEPS.map((s, idx) => {
            const done = !isFailed && idx < currentIdx;
            const active = !isFailed && idx === currentIdx;
            const pendingStep = !isFailed && idx > currentIdx;
            return (
              <div key={s.key} className="flex items-start gap-3">
                <div className="flex flex-col items-center mt-0.5">
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      done
                        ? 'bg-green-500/30 border border-green-400 text-green-400'
                        : active
                          ? 'bg-amber-500/30 border border-amber-400 text-amber-400'
                          : isFailed && idx <= Math.max(currentIdx, 0)
                            ? 'bg-red-500/30 border border-red-400 text-red-400'
                            : 'bg-gray-800 border border-gray-700 text-gray-600'
                    }`}
                  >
                    {done ? '✓' : active ? (
                      <motion.span
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                        className="block w-2 h-2 border border-amber-400 border-t-transparent rounded-full"
                      />
                    ) : idx + 1}
                  </div>
                  {idx < STEPS.length - 1 && (
                    <div className={`w-px h-5 mt-1 ${done ? 'bg-green-500/40' : 'bg-gray-700'}`} />
                  )}
                </div>
                <div className="flex-1 pb-1">
                  <p className={`text-xs font-mono ${
                    done ? 'text-green-400' : active ? 'text-amber-400' : pendingStep ? 'text-gray-500' : 'text-gray-500'
                  }`}>
                    {s.label}
                  </p>
                  <p className="text-[10px] text-gray-600 font-mono">{s.hint}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Meta */}
      <div className="grid grid-cols-3 gap-2 text-xs mb-4">
        <MetaCell label="Capacity" value={`${capacity} CKB`} valueClass="text-cyan-400" />
        <MetaCell label="Elapsed" value={formatElapsed(elapsedMs)} valueClass="text-amber-400" />
        <MetaCell
          label="Status"
          value={isFailed ? 'FAILED' : isReady ? 'READY' : 'PENDING'}
          valueClass={isFailed ? 'text-red-400' : isReady ? 'text-green-400' : 'text-amber-400'}
        />
      </div>

      {isFailed && pending.error && (
        <div className="mb-3 p-2 bg-red-500/10 border border-red-500/20 rounded">
          <p className="text-xs text-red-400 font-mono break-words">{pending.error}</p>
        </div>
      )}

      {!isReady && !isFailed && (
        <p className="text-[10px] text-gray-500 mb-3 font-mono">
          On-chain confirmation can take a few minutes. You can close this dialog —
          progress will continue and you&apos;ll see updates in the header.
        </p>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        {isFailed ? (
          <>
            <button
              type="button"
              onClick={() => {
                onRetry();
              }}
              className="flex-1 py-2.5 rounded-lg font-display font-bold text-xs tracking-wider bg-cyan-500/20 border border-cyan-400 text-cyan-400 hover:bg-cyan-500/30 transition-all"
            >
              TRY AGAIN
            </button>
            <button
              type="button"
              onClick={onDone}
              className="flex-1 py-2.5 rounded-lg font-display text-xs tracking-wider bg-gray-800/50 border border-gray-700 text-gray-400 hover:bg-gray-800 transition-all"
            >
              DISMISS
            </button>
          </>
        ) : isReady ? (
          <button
            type="button"
            onClick={onDone}
            className="w-full py-2.5 rounded-lg font-display font-bold text-xs tracking-wider bg-green-500/20 border border-green-400 text-green-400 hover:bg-green-500/30 transition-all"
          >
            DONE
          </button>
        ) : (
          <button
            type="button"
            onClick={onBackground}
            className="w-full py-2.5 rounded-lg font-display font-bold text-xs tracking-wider bg-cyan-500/20 border border-cyan-400 text-cyan-400 hover:bg-cyan-500/30 transition-all"
          >
            RUN IN BACKGROUND
          </button>
        )}
      </div>
    </div>
  );
};

const Row: React.FC<{ label: string; value: string; valueClass?: string }> = ({ label, value, valueClass }) => (
  <div className="flex items-center justify-between">
    <span className="text-gray-500">{label}</span>
    <span className={valueClass || 'text-white'}>{value}</span>
  </div>
);

const MetaCell: React.FC<{ label: string; value: string; valueClass?: string }> = ({ label, value, valueClass }) => (
  <div className="bg-black/40 rounded-lg border border-cyan-500/10 p-2 text-center">
    <p className="text-[10px] text-gray-500 font-mono uppercase">{label}</p>
    <p className={`text-xs font-mono ${valueClass || 'text-white'}`}>{value}</p>
  </div>
);

export default OpenChannelModal;
