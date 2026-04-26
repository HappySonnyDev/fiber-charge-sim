import React from 'react';
import { Wallet } from './Icons';

interface WalletBalanceProps {
  userBalance: string;
  isConnected: boolean;
}

const WalletBalance: React.FC<WalletBalanceProps> = ({ userBalance, isConnected }) => {
  return (
    <div className="glass-panel p-5">
      <h3 className="font-display text-sm text-cyan-400 mb-4 flex items-center gap-2">
        <Wallet /> BALANCES
      </h3>
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-gray-400 text-sm">On-Chain Balance</span>
          <span className={`font-mono ${isConnected ? 'text-cyan-400' : 'text-gray-600'}`}>
            {isConnected ? userBalance : 'Connect node to view'}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-400 text-sm">Router Liquidity</span>
          <span className="font-mono text-gray-600">N/A</span>
        </div>
      </div>
    </div>
  );
};

export default WalletBalance;
