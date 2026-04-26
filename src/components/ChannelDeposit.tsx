'use client';

import React, { useState } from 'react';
import type { FiberBrowserNode } from '@fiber-pay/sdk/browser';
import { useChannelManager } from '../hooks/useChannelManager';

interface ChannelDepositProps {
  fiberNode: {
    isConnected: boolean;
    onChainBalance: string;
    availableBalance: string;
    ckbAddress: string | null;
    browserNodeRef: React.MutableRefObject<FiberBrowserNode | null>;
  };
  routerPubkey?: string;
}

const PRESET_AMOUNTS = [
  { label: '200 CKB', value: 200n * 100_000_000n },
  { label: '500 CKB', value: 500n * 100_000_000n },
  { label: '1000 CKB', value: 1000n * 100_000_000n },
  { label: '5000 CKB', value: 5000n * 100_000_000n },
];

const ChannelDeposit: React.FC<ChannelDepositProps> = ({
  fiberNode,
  routerPubkey = process.env.NEXT_PUBLIC_ROUTER_PUBKEY || '0x03a14ea2a93b52fafa23edc29a2b90a1319e328665a5636163a18a0eea6588e2af',
}) => {
  const { isOpening, error, openChannel } = useChannelManager();
  const [selectedAmount, setSelectedAmount] = useState<bigint | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  const onChainBalanceNum = parseFloat(fiberNode.onChainBalance.replace(' CKB', ''));
  const hasEnoughBalance = selectedAmount !== null && onChainBalanceNum >= Number(selectedAmount) / 100_000_000;

  const handleDeposit = async () => {
    if (!fiberNode.browserNodeRef.current || !selectedAmount) return;

    try {
      await openChannel(fiberNode.browserNodeRef.current, routerPubkey, selectedAmount);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to deposit:', err);
    }
  };

  if (!fiberNode.isConnected) {
    return (
      <div className="glass-panel p-4">
        <h3 className="font-display text-sm text-cyan-400 mb-2">DEPOSIT</h3>
        <p className="text-gray-500 text-sm">Connect your node to deposit funds</p>
      </div>
    );
  }

  return (
    <div className="glass-panel p-4">
      <h3 className="font-display text-sm text-cyan-400 mb-3 flex items-center gap-2">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
        DEPOSIT TO CHANNEL
      </h3>

      <div className="mb-4">
        <p className="text-xs text-gray-500 mb-2">Select amount to deposit:</p>
        <div className="grid grid-cols-2 gap-2">
          {PRESET_AMOUNTS.map((amount) => {
            const isSelected = selectedAmount === amount.value;
            const canAfford = onChainBalanceNum >= Number(amount.value) / 100_000_000;

            return (
              <button
                key={amount.label}
                onClick={() => canAfford && setSelectedAmount(amount.value)}
                disabled={!canAfford}
                className={`px-3 py-2 rounded text-xs font-mono transition-all ${
                  isSelected
                    ? 'bg-cyan-500/20 border border-cyan-500 text-cyan-400'
                    : canAfford
                    ? 'bg-gray-800/50 border border-gray-700 text-gray-400 hover:border-gray-600'
                    : 'bg-gray-900/30 border border-gray-800 text-gray-600 cursor-not-allowed'
                }`}
              >
                {amount.label}
                {!canAfford && (
                  <span className="block text-[10px] text-red-500/70">Insufficient balance</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {selectedAmount && (
        <div className="mb-4 p-3 bg-gray-900/50 rounded border border-gray-800">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-gray-500">Deposit Amount:</span>
            <span className="text-cyan-400 font-mono">
              {(Number(selectedAmount) / 100_000_000).toFixed(2)} CKB
            </span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-500">Router:</span>
            <span className="text-gray-400 font-mono truncate max-w-[150px]">
              {routerPubkey.slice(0, 20)}...
            </span>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-3 p-2 bg-red-500/10 border border-red-500/20 rounded">
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      {showSuccess && (
        <div className="mb-3 p-2 bg-green-500/10 border border-green-500/20 rounded">
          <p className="text-xs text-green-400">Channel opened successfully!</p>
        </div>
      )}

      <button
        onClick={handleDeposit}
        disabled={!hasEnoughBalance || isOpening}
        className={`w-full py-2 rounded text-xs font-medium transition-all ${
          hasEnoughBalance && !isOpening
            ? 'bg-cyan-500/20 border border-cyan-500 text-cyan-400 hover:bg-cyan-500/30'
            : 'bg-gray-800 border border-gray-700 text-gray-500 cursor-not-allowed'
        }`}
      >
        {isOpening ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Opening Channel...
          </span>
        ) : (
          'Open Channel'
        )}
      </button>

      <p className="mt-3 text-[10px] text-gray-600">
        Depositing creates a payment channel with the Router node for instant transactions.
      </p>
    </div>
  );
};

export default ChannelDeposit;
