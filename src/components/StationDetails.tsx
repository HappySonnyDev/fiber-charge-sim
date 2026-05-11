import React from 'react';
import { Charging, ArrowRight } from './Icons';
import type { Station } from '../data/stations';

interface StationDetailsProps {
  selectedStation: Station | null;
  isCharging: boolean;
  onStartCharging: () => void;
  onStopCharging: () => void;
  stationBalance: Record<number, number>;
  fiberConnected?: boolean;
}

const StationDetails: React.FC<StationDetailsProps> = ({
  selectedStation,
  isCharging,
  onStartCharging,
  onStopCharging,
  stationBalance,
  fiberConnected = false,
}) => {
  if (!selectedStation) {
    return (
      <div className="glass-panel p-5 flex-1">
        <h3 className="font-display text-sm text-cyan-400 mb-4 flex items-center gap-2">
          <Charging /> STATION DETAILS
        </h3>
        <div className="h-full flex items-center justify-center text-gray-500 min-h-[200px]">
          <p>Select a charging station on the map</p>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-panel p-5 flex-1">
      <h3 className="font-display text-sm text-cyan-400 mb-4 flex items-center gap-2">
        <Charging /> STATION DETAILS
      </h3>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-gray-400">Name</span>
          <span className="font-mono text-white">{selectedStation.name}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-400">Power Output</span>
          <span className="font-mono text-cyan-400">{selectedStation.power} kW</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-400">Rate</span>
          <span className="font-mono text-amber-400">{selectedStation.rate} CKB/kWh</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-400">Per Payment</span>
          <span className="font-mono text-green-400">
            {(selectedStation.rate * selectedStation.power * 5 / 3600).toFixed(4)} CKB / 5s
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-400">Status</span>
          <span
            className={`font-mono ${
              selectedStation.available ? 'text-green-400' : 'text-red-400'
            }`}
          >
            {selectedStation.available ? 'AVAILABLE' : 'OCCUPIED'}
          </span>
        </div>

        {/* Payment Path Visualization */}
        <div className="mt-6 p-4 bg-black/40 rounded-lg border border-cyan-500/20">
          <p className="text-xs text-gray-500 mb-3">PAYMENT PATH</p>
          <div className="flex items-center justify-center gap-2 text-sm">
            <div className="text-cyan-400 font-mono">You</div>
            <ArrowRight />
            <div className="text-amber-400 font-mono">Fiber Hub</div>
            <ArrowRight />
            <div className="text-green-400 font-mono">{selectedStation.brand}</div>
          </div>
          <p className="text-xs text-gray-500 mt-3 text-center">
            Multi-hop: 2 hops
          </p>
        </div>

        {/* Station Revenue */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-700">
          <span className="text-gray-400 text-sm">Station Revenue</span>
          <span className="font-mono text-green-400">
            {stationBalance[selectedStation.id]?.toFixed(6) || '0.000000'} CKB
          </span>
        </div>

        {/* Action Button */}
        <button
          onClick={isCharging ? onStopCharging : onStartCharging}
          disabled={!selectedStation.available || (!isCharging && !fiberConnected)}
          className={`w-full py-4 rounded-lg font-display font-bold tracking-wider transition-all ${
            isCharging
              ? 'bg-red-500/20 border-2 border-red-400 text-red-400 hover:bg-red-500/30'
              : selectedStation.available && fiberConnected
                ? 'bg-cyan-500/20 border-2 border-cyan-400 text-cyan-400 hover:bg-cyan-500/30 glow-cyan'
                : 'bg-gray-800 border-2 border-gray-600 text-gray-500 cursor-not-allowed'
          }`}
        >
          {isCharging
            ? 'STOP CHARGING'
            : fiberConnected
              ? 'START CHARGING'
              : 'CONNECT FIBER NODE FIRST'}
        </button>
      </div>
    </div>
  );
};

export default StationDetails;
