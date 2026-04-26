import React from 'react';
import { Zap } from './Icons';

const Header: React.FC = () => {
  return (
    <header className="relative z-10 px-8 py-6 border-b border-cyan-500/20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center glow-cyan">
            <Zap />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-white tracking-wider">
              FIBER<span className="text-cyan-400">CHARGE</span>
            </h1>
            <p className="text-cyan-400/60 text-sm font-mono">Multi-Hop Payment Simulator</p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className="text-xs text-gray-400 font-mono">NETWORK STATUS</p>
            <p className="text-green-400 font-mono text-sm flex items-center gap-2 justify-end">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              ONLINE
            </p>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
