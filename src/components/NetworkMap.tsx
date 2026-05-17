import React, { useEffect, useState } from 'react';
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
  /** 每次真实链下支付完成时新增一个粒子（由 page.tsx 在 onPaymentSent 中触发） */
  particles: Particle[];
  /** 每笔支付金额（CKB），用于动画数字显示 */
  amountPerPaymentCkb?: number;
  /** Hub 路由费率（如 0.1 表示 10%），用于动画拆分和 hover tooltip 展示 */
  hubFeeRate?: number;
}

const DEFAULT_AMOUNT = 0.5;
const DEFAULT_FEE_RATE = 0.1;

// 数字格式化：去掉冗余小数 0，0.5 / 0.45 / 0.05 而非 0.500000
function fmt(n: number): string {
  return parseFloat(n.toFixed(4)).toString();
}

const NetworkMap: React.FC<NetworkMapProps> = ({
  selectedStation,
  isCharging,
  onStationSelect,
  particles,
  amountPerPaymentCkb = DEFAULT_AMOUNT,
  hubFeeRate = DEFAULT_FEE_RATE,
}) => {
  const canSelect = !isCharging;
  const [hubHovered, setHubHovered] = useState(false);

  const hubFee = amountPerPaymentCkb * hubFeeRate;
  const stationAmount = amountPerPaymentCkb - hubFee;
  const feePercent = Math.round(hubFeeRate * 100);

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

      {/* Router (Fiber Hub) Node - hover 显示费率说明 tooltip */}
      <div
        className="absolute z-20"
        style={{ left: `${ROUTER_NODE.x}%`, top: `${ROUTER_NODE.y}%` }}
        onMouseEnter={() => setHubHovered(true)}
        onMouseLeave={() => setHubHovered(false)}
      >
        <motion.div
          className="w-16 h-16 -ml-8 -mt-8 flex flex-col items-center justify-center"
          whileHover={{ scale: 1.1 }}
        >
          <div className="w-12 h-12 rounded-full bg-amber-500/20 border-2 border-amber-400 flex items-center justify-center glow-amber cursor-help">
            <Router />
          </div>
          <span className="mt-2 text-xs font-mono text-amber-400 bg-black/60 px-2 py-1 rounded whitespace-nowrap">
            {ROUTER_NODE.name}
          </span>
        </motion.div>

        {/* Hub 费率说明 tooltip：紧贴 Hub label 下方，允许鼠标进入点击链接 */}
        <AnimatePresence>
          {hubHovered && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="absolute left-1/2 -translate-x-1/2 w-72 glass-panel p-3 z-30 shadow-xl"
              style={{ top: '40px' }}
              onMouseEnter={() => setHubHovered(true)}
              onMouseLeave={() => setHubHovered(false)}
            >
              <div className="flex items-baseline justify-between mb-2 border-b border-amber-500/20 pb-2">
                <span className="font-display text-[11px] text-amber-400 tracking-wider">
                  HUB FEE RATE
                </span>
                <span className="font-mono text-amber-400 text-base font-bold">
                  {feePercent}%
                </span>
              </div>
              <p className="text-[11px] text-gray-300 font-mono leading-relaxed mb-2">
                This routing fee is settled between{' '}
                <span className="text-amber-300">Stations</span> and the{' '}
                <span className="text-amber-300">Fiber Hub</span> —{' '}
                <span className="text-cyan-300">independent of you</span>. You always pay only the listed energy price.
              </p>
              <p className="text-[10px] text-gray-500 font-mono leading-relaxed mb-2">
                Shown in this animation for demonstration purposes only.
              </p>
              <a
                href="/admin"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] font-mono text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1"
              >
                See <span className="underline">/admin</span> for revenue split →
              </a>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

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

      {/* Payment Particles - 两段动画：User→Hub (full)，Hub→Station (扣除 fee 后) */}
      <AnimatePresence>
        {selectedStation && particles.map(particle => (
          <PaymentParticle
            key={particle.id}
            targetX={selectedStation.x}
            targetY={selectedStation.y}
            fullAmount={amountPerPaymentCkb}
            hubFee={hubFee}
            stationAmount={stationAmount}
          />
        ))}
      </AnimatePresence>
    </div>
  );
};

// 单笔支付动画：User→Hub 全额，到达 Hub 时弹出 fee 气泡，然后 Hub→Station 剩余金额
interface PaymentParticleProps {
  targetX: number;
  targetY: number;
  fullAmount: number;
  hubFee: number;
  stationAmount: number;
}

const STAGE1_MS = 1500;
const STAGE2_MS = 1500;
const FEE_BUBBLE_MS = 1400;

const PaymentParticle: React.FC<PaymentParticleProps> = ({
  targetX, targetY, fullAmount, hubFee, stationAmount,
}) => {
  const [stage, setStage] = useState<1 | 2>(1);

  useEffect(() => {
    const t = setTimeout(() => setStage(2), STAGE1_MS);
    return () => clearTimeout(t);
  }, []);

  if (stage === 1) {
    // Stage 1: User → Hub, 携带全额
    return (
      <motion.div
        className="absolute pointer-events-none flex items-center gap-1.5 z-10"
        initial={{
          left: `${USER_NODE.x}%`,
          top: `${USER_NODE.y}%`,
          opacity: 1,
          scale: 1,
        }}
        animate={{
          left: `${ROUTER_NODE.x}%`,
          top: `${ROUTER_NODE.y}%`,
          opacity: 1,
          scale: 1,
        }}
        transition={{ duration: STAGE1_MS / 1000, ease: 'linear' }}
        style={{ transform: 'translate(-50%, -50%)' }}
      >
        <span
          className="w-2.5 h-2.5 rounded-full bg-cyan-400"
          style={{ filter: 'drop-shadow(0 0 8px #00f0ff)' }}
        />
        <span className="text-sm font-mono font-bold text-cyan-200 bg-black/80 px-2 py-1 rounded border border-cyan-500/40 whitespace-nowrap">
          {fmt(fullAmount)} CKB
        </span>
      </motion.div>
    );
  }

  // Stage 2: Hub fee 气泡 + Hub → Station 剩余
  return (
    <>
      {/* Hub 抽成气泡：上飘 + 渐隐 */}
      <motion.div
        className="absolute pointer-events-none z-20"
        initial={{
          left: `${ROUTER_NODE.x}%`,
          top: `${ROUTER_NODE.y}%`,
          opacity: 1,
          scale: 0.8,
        }}
        animate={{
          top: `${ROUTER_NODE.y - 10}%`,
          opacity: 0,
          scale: 1.15,
        }}
        transition={{ duration: FEE_BUBBLE_MS / 1000, ease: 'linear' }}
        style={{ transform: 'translate(-50%, -50%)' }}
      >
        <span className="text-sm font-mono font-bold text-amber-400 bg-black/80 px-2 py-1 rounded border border-amber-500/40 whitespace-nowrap">
          +{fmt(hubFee)} fee
        </span>
      </motion.div>

      {/* Hub → Station，绿色，剩余金额 */}
      <motion.div
        className="absolute pointer-events-none flex items-center gap-1.5 z-10"
        initial={{
          left: `${ROUTER_NODE.x}%`,
          top: `${ROUTER_NODE.y}%`,
          opacity: 1,
          scale: 1,
        }}
        animate={{
          left: `${targetX}%`,
          top: `${targetY}%`,
          opacity: [1, 1, 0],
          scale: [1, 1, 0.6],
        }}
        transition={{
          duration: STAGE2_MS / 1000,
          ease: 'linear',
          times: [0, 0.85, 1],
        }}
        style={{ transform: 'translate(-50%, -50%)' }}
      >
        <span
          className="w-2 h-2 rounded-full bg-green-400"
          style={{ filter: 'drop-shadow(0 0 8px #00ff88)' }}
        />
        <span className="text-sm font-mono font-bold text-green-200 bg-black/80 px-2 py-1 rounded border border-green-500/40 whitespace-nowrap">
          {fmt(stationAmount)} CKB
        </span>
      </motion.div>
    </>
  );
};

export default NetworkMap;
