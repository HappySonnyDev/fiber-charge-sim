import React from 'react';
import { motion } from 'framer-motion';
import { Car } from './Icons';

interface VehicleStatusProps {
  batteryLevel: number;
}

const VehicleStatus: React.FC<VehicleStatusProps> = ({ batteryLevel }) => {
  const range = (batteryLevel * 3.5).toFixed(0);

  return (
    <div className="glass-panel p-5">
      <h3 className="font-display text-sm text-cyan-400 mb-4 flex items-center gap-2">
        <Car /> VEHICLE STATUS
      </h3>

      {/* Battery */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-gray-400">Battery Level</span>
          <span
            className={`font-mono text-lg font-bold ${
              batteryLevel > 50 ? 'text-green-400' : batteryLevel > 20 ? 'text-amber-400' : 'text-red-400'
            }`}
          >
            {batteryLevel.toFixed(1)}%
          </span>
        </div>
        <div className="h-4 bg-gray-800 rounded-full overflow-hidden border border-gray-700">
          <motion.div
            className="h-full progress-bar"
            initial={{ width: 0 }}
            animate={{ width: `${batteryLevel}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-black/40 rounded-lg p-3 border border-cyan-500/20">
          <p className="text-xs text-gray-500 mb-1">Range</p>
          <p className="font-mono text-cyan-400">{range} km</p>
        </div>
        <div className="bg-black/40 rounded-lg p-3 border border-cyan-500/20">
          <p className="text-xs text-gray-500 mb-1">Efficiency</p>
          <p className="font-mono text-green-400">156 Wh/km</p>
        </div>
      </div>
    </div>
  );
};

export default VehicleStatus;
