import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { STATIONS, ROUTER_NODE, USER_NODE } from '../data/stations';
import type { Station } from '../data/stations';
import { Router, Charging, Car } from './Icons';

interface Particle {
  id: number;
}

interface NetworkMapProps {
  selectedStation: Station | null;
  isCharging: boolean;
  onStationSelect: (station: Station) => void;
  particles: Particle[];
}

const NetworkMap: React.FC<NetworkMapProps> = ({
  selectedStation,
  isCharging,
  onStationSelect,
  particles,
}) => {
  const canSelect = !isCharging;

  return (
    <div className="relative w-full h-full bg-black/40 rounded-xl border border-cyan-500/20 overflow-hidden">
      {/* Grid pattern */}
      <svg className="absolute inset-0 w-full h-full opacity-20">
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#00f0ff" strokeWidth="0.5"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>

      {/* Connection Lines */}
      <svg className="absolute inset-0 w-full h-full">
        {/* Router to all stations - dashed lines */}
        {STATIONS.map(station => (
          <line
            key={`router-${station.id}`}
            x1={`${ROUTER_NODE.x}%`}
            y1={`${ROUTER_NODE.y}%`}
            x2={`${station.x}%`}
            y2={`${station.y}%`}
            stroke="#ffaa00"
            strokeWidth="2"
            strokeDasharray="4 4"
            opacity="0.4"
          />
        ))}

        {/* User to Router - solid line */}
        <line
          x1={`${USER_NODE.x}%`}
          y1={`${USER_NODE.y}%`}
          x2={`${ROUTER_NODE.x}%`}
          y2={`${ROUTER_NODE.y}%`}
          stroke="#00f0ff"
          strokeWidth="3"
          opacity={selectedStation ? 0.8 : 0.3}
        />

        {/* Active charging line */}
        {isCharging && selectedStation && (
          <motion.line
            x1={`${ROUTER_NODE.x}%`}
            y1={`${ROUTER_NODE.y}%`}
            x2={`${selectedStation.x}%`}
            y2={`${selectedStation.y}%`}
            stroke="#00ff88"
            strokeWidth="3"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.5 }}
          />
        )}
      </svg>

      {/* Router Node */}
      <motion.div
        className="absolute w-16 h-16 -ml-8 -mt-8 flex flex-col items-center justify-center"
        style={{ left: `${ROUTER_NODE.x}%`, top: `${ROUTER_NODE.y}%` }}
        whileHover={{ scale: 1.1 }}
      >
        <div className="w-12 h-12 rounded-full bg-amber-500/20 border-2 border-amber-400 flex items-center justify-center glow-amber">
          <Router />
        </div>
        <span className="mt-2 text-xs font-mono text-amber-400 bg-black/60 px-2 py-1 rounded whitespace-nowrap">
          {ROUTER_NODE.name}
        </span>
      </motion.div>

      {/* Charging Stations */}
      {STATIONS.map(station => (
        <motion.div
          key={station.id}
          className={`absolute w-14 h-14 -ml-7 -mt-7 flex flex-col items-center justify-center ${
            selectedStation?.id === station.id ? 'z-20' : 'z-10'
          }`}
          style={{ left: `${station.x}%`, top: `${station.y}%` }}
          onClick={() => canSelect && onStationSelect(station)}
          whileHover={canSelect ? { scale: 1.15 } : undefined}
          whileTap={canSelect ? { scale: 0.95 } : undefined}
        >
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
              selectedStation?.id === station.id
                ? 'bg-green-500/30 border-2 border-green-400 glow-green'
                : station.available
                  ? 'bg-green-500/10 border border-green-400/50 cursor-pointer hover:bg-green-500/20'
                  : 'bg-red-500/10 border border-red-400/50 cursor-not-allowed'
            }`}
          >
            <Charging />
          </div>
          <span
            className={`mt-1 text-xs font-mono px-2 py-0.5 rounded whitespace-nowrap ${
              selectedStation?.id === station.id
                ? 'bg-green-500/20 text-green-400'
                : 'bg-black/60 text-gray-400'
            }`}
          >
            {station.brand}
          </span>
          {selectedStation?.id === station.id && (
            <motion.div
              className="absolute inset-0 rounded-full border-2 border-green-400"
              initial={{ scale: 1, opacity: 1 }}
              animate={{ scale: 1.5, opacity: 0 }}
              transition={{ duration: 1, repeat: Infinity }}
            />
          )}
        </motion.div>
      ))}

      {/* User Car */}
      <div
        className="absolute w-14 h-14 -ml-7 -mt-7 flex flex-col items-center justify-center"
        style={{ left: `${USER_NODE.x}%`, top: `${USER_NODE.y}%` }}
      >
        <div className="w-12 h-12 rounded-xl bg-cyan-500/20 border-2 border-cyan-400 flex items-center justify-center glow-cyan">
          <Car />
        </div>
        <span className="mt-1 text-xs font-mono text-cyan-400 bg-black/60 px-2 py-1 rounded">
          {USER_NODE.name}
        </span>
      </div>

      {/* Payment Particles */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        <AnimatePresence>
          {particles.map(particle => (
            <motion.circle
              key={particle.id}
              r="5"
              fill="#00f0ff"
              filter="drop-shadow(0 0 8px #00f0ff)"
              initial={{
                cx: `${USER_NODE.x}%`,
                cy: `${USER_NODE.y}%`,
              }}
              animate={{
                cx: [`${USER_NODE.x}%`, `${ROUTER_NODE.x}%`, `${selectedStation?.x ?? 0}%`],
                cy: [`${USER_NODE.y}%`, `${ROUTER_NODE.y}%`, `${selectedStation?.y ?? 0}%`],
              }}
              transition={{ duration: 1.2, ease: 'easeInOut' }}
            />
          ))}
        </AnimatePresence>
      </svg>
    </div>
  );
};

export default NetworkMap;
