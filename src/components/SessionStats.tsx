import React from 'react';
import { motion } from 'framer-motion';
import { Activity } from './Icons';

interface SessionStatsData {
  duration: number;
  totalPaid: number;
  txCount: number;
}

interface SessionStatsProps {
  isCharging: boolean;
  sessionStats: SessionStatsData;
}

const SessionStats: React.FC<SessionStatsProps> = ({ isCharging, sessionStats }) => {
  if (!isCharging) return null;

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-panel p-5 border-green-500/30"
    >
      <h3 className="font-display text-sm text-green-400 mb-4 flex items-center gap-2">
        <Activity /> LIVE SESSION
      </h3>
      <div className="grid grid-cols-3 gap-4">
        <div className="text-center">
          <p className="text-2xl font-mono text-white">{formatTime(sessionStats.duration)}</p>
          <p className="text-xs text-gray-500">Duration</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-mono text-cyan-400">{sessionStats.txCount}</p>
          <p className="text-xs text-gray-500">Payments</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-mono text-amber-400">
            {sessionStats.totalPaid.toFixed(6)}
          </p>
          <p className="text-xs text-gray-500">CKB Spent</p>
        </div>
      </div>
    </motion.div>
  );
};

export default SessionStats;
