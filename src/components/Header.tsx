import React from 'react';
import { motion } from 'framer-motion';
import { Zap, Car } from './Icons';
import HeaderFiberStatus from './HeaderFiberStatus';
import type { UseFiberNodeResult } from '../hooks/useFiberNode';
import type { PendingChannel } from '../hooks/useChannelOpening';

interface HeaderProps {
  batteryLevel?: number;
  fiberNode?: UseFiberNodeResult;
  pendingChannel?: PendingChannel | null;
  onOpenChannel?: () => void;
}

const Header: React.FC<HeaderProps> = ({ batteryLevel, fiberNode, pendingChannel, onOpenChannel }) => {
  const hasBattery = typeof batteryLevel === 'number';
  const range = hasBattery ? (batteryLevel! * 3.5).toFixed(0) : '0';
  const batteryColor = !hasBattery
    ? 'text-gray-500'
    : batteryLevel! > 50
      ? 'text-green-400'
      : batteryLevel! > 20
        ? 'text-amber-400'
        : 'text-red-400';

  return (
    <header className="relative z-50 px-8 pt-7 pb-5 border-b border-cyan-500/20">
      <div className="flex items-center justify-between gap-6">
        {/* Left: Logo */}
        <div className="flex items-center gap-4 flex-shrink-0">
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

        {/* Center: Vehicle / Battery Status */}
        {hasBattery && (
          <div className="hidden md:flex items-center gap-5">
            <div className="flex items-center gap-2 text-cyan-400">
              <Car />
              <span className="font-display text-xs tracking-wider text-cyan-400/80">VEHICLE</span>
            </div>

            {/* Battery bar */}
            <div className="flex items-center gap-3 min-w-[180px]">
              <span className="text-[10px] text-gray-500 font-mono uppercase">Battery</span>
              <div className="relative h-2 flex-1 bg-gray-800 rounded-full overflow-hidden border border-gray-700">
                <motion.div
                  className="h-full progress-bar"
                  initial={{ width: 0 }}
                  animate={{ width: `${batteryLevel}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
              <span className={`font-mono text-sm font-bold tabular-nums ${batteryColor}`}>
                {batteryLevel!.toFixed(1)}%
              </span>
            </div>

            {/* Divider */}
            <div className="w-px h-6 bg-cyan-500/20" />

            {/* Range */}
            <div className="flex items-baseline gap-1.5">
              <span className="text-[10px] text-gray-500 font-mono uppercase">Range</span>
              <span className="font-mono text-sm text-cyan-400 tabular-nums">{range}</span>
              <span className="text-[10px] text-gray-500 font-mono">km</span>
            </div>

            {/* Efficiency */}
            <div className="flex items-baseline gap-1.5">
              <span className="text-[10px] text-gray-500 font-mono uppercase">Eff</span>
              <span className="font-mono text-sm text-green-400 tabular-nums">156</span>
              <span className="text-[10px] text-gray-500 font-mono">Wh/km</span>
            </div>
          </div>
        )}

        {/* Right: Fiber Node Status */}
        <div className="flex items-center gap-6 flex-shrink-0">
          {fiberNode ? (
            <HeaderFiberStatus fiberNode={fiberNode} pendingChannel={pendingChannel} onOpenChannel={onOpenChannel} />
          ) : (
            <div className="text-right">
              <p className="text-xs text-gray-400 font-mono">NETWORK STATUS</p>
              <p className="text-green-400 font-mono text-sm flex items-center gap-2 justify-end">
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                ONLINE
              </p>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
