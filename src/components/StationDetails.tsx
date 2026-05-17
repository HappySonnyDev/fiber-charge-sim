import React from 'react';
import { Charging } from './Icons';
import type { Station } from '../data/stations';

interface StationDetailsProps {
  selectedStation: Station | null;
  isCharging: boolean;
  onStartCharging: () => void;
  onStopCharging: () => void;
  fiberConnected?: boolean;
  /** 可用通道余额（CKB表达的 number）。不提供时不做低余额提示。 */
  channelBalanceCkb?: number;
  /** 拉起开通道 modal 的回调 */
  onOpenChannel?: () => void;
  /** 是否有正在开立的 pending 通道 */
  hasPendingChannel?: boolean;
  /** 未连接时点击按钮直接拉起 Fiber 节点连接 */
  onConnectFiber?: () => void;
  /** Fiber 节点连接中（unlocking/starting中） */
  isFiberConnecting?: boolean;
  /** Passkey 是否可用；false 时无法连接 */
  passkeySupported?: boolean | null;
}

// 低于该阈值会提示开新通道（1 CKB 够多次微支付，但不够一轮充电）
const LOW_BALANCE_THRESHOLD_CKB = 1;

const StationDetails: React.FC<StationDetailsProps> = ({
  selectedStation,
  isCharging,
  onStartCharging,
  onStopCharging,
  fiberConnected = false,
  channelBalanceCkb,
  onOpenChannel,
  hasPendingChannel = false,
  onConnectFiber,
  isFiberConnecting = false,
  passkeySupported,
}) => {
  if (!selectedStation) {
    return (
      <div className="glass-panel p-4">
        <h3 className="font-display text-xs text-cyan-400 mb-3 flex items-center gap-2">
          <Charging /> STATION DETAILS
        </h3>
        <div className="flex items-center justify-center text-gray-500 py-8 text-sm">
          <p>Select a charging station on the map</p>
        </div>
      </div>
    );
  }

  const perPayment = (selectedStation.rate * selectedStation.power * 5 / 3600).toFixed(2);

  const showLowBalanceCTA =
    fiberConnected
    && !isCharging
    && channelBalanceCkb !== undefined
    && channelBalanceCkb < LOW_BALANCE_THRESHOLD_CKB;

  // 未连接时是否走“引导连接”分支（不是 Stop、未连、有 onConnectFiber）
  const showConnectGuide = !isCharging && !fiberConnected && !!onConnectFiber;
  const passkeyBlocked = passkeySupported === false;

  const canStart =
    selectedStation.available
    && fiberConnected
    && (channelBalanceCkb === undefined || channelBalanceCkb >= LOW_BALANCE_THRESHOLD_CKB);

  const buttonLabel = isCharging
    ? 'STOP CHARGING'
    : showConnectGuide
      ? (isFiberConnecting
          ? 'CONNECTING...'
          : passkeyBlocked
            ? 'PASSKEY NOT SUPPORTED'
            : 'CONNECT FIBER NODE FIRST')
      : !fiberConnected
        ? 'CONNECT FIBER NODE FIRST'
        : channelBalanceCkb !== undefined && channelBalanceCkb < LOW_BALANCE_THRESHOLD_CKB
          ? hasPendingChannel ? 'CHANNEL OPENING...' : 'OPEN CHANNEL TO CHARGE'
          : 'START CHARGING';

  return (
    <div className="glass-panel p-4">
      {/* 头：站名 + 状态 + 内联参数行 */}
      <div className="mb-3 pb-3 border-b border-cyan-500/10">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-display text-base text-white tracking-wide leading-tight">
              {selectedStation.name}
            </p>
            <p className="text-[10px] text-gray-500 font-mono uppercase mt-0.5">
              {selectedStation.brand} · You → Hub → {selectedStation.brand}
            </p>
          </div>
          <span
            className={`flex items-center gap-1.5 font-mono text-xs ${
              selectedStation.available ? 'text-green-400' : 'text-red-400'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                selectedStation.available ? 'bg-green-400 animate-pulse' : 'bg-red-400'
              }`}
            />
            {selectedStation.available ? 'AVAILABLE' : 'OCCUPIED'}
          </span>
        </div>

        {/* 关键参数内联行（无边框） */}
        <div className="mt-2.5 flex flex-wrap items-baseline gap-x-3 gap-y-1 font-mono text-[11px]">
          <span>
            <span className="text-cyan-400">{selectedStation.power}</span>
            <span className="text-gray-500"> kW</span>
          </span>
          <span className="text-gray-700">·</span>
          <span>
            <span className="text-amber-400">{selectedStation.rate}</span>
            <span className="text-gray-500"> CKB/kWh</span>
          </span>
          <span className="text-gray-700">·</span>
          <span>
            <span className="text-green-400">{perPayment}</span>
            <span className="text-gray-500"> CKB / 5s</span>
          </span>
        </div>
      </div>

      {/* Low balance / no channel CTA */}
      {showLowBalanceCTA && (
        <div className="p-2.5 rounded-lg border border-amber-500/30 bg-amber-500/5 space-y-2 mb-3">
          <p className="text-[11px] text-amber-400 font-mono leading-snug">
            {hasPendingChannel
              ? 'New channel is opening on-chain. Charging unlocks when ready.'
              : channelBalanceCkb === 0
                ? 'No payment channel yet. Open one to start charging.'
                : `Channel balance low (${channelBalanceCkb!.toFixed(4)} CKB). Open a new channel to continue.`}
          </p>
          {onOpenChannel && !hasPendingChannel && (
            <button
              type="button"
              onClick={onOpenChannel}
              className="w-full py-1.5 rounded-md font-display font-bold text-[11px] tracking-wider bg-cyan-500/20 border border-cyan-400 text-cyan-400 hover:bg-cyan-500/30 transition-all"
            >
              + OPEN PAYMENT CHANNEL
            </button>
          )}
        </div>
      )}

      {/* 主 CTA 按钮 - 凸显 */}
      {showConnectGuide ? (
        <button
          onClick={onConnectFiber}
          disabled={isFiberConnecting || passkeyBlocked}
          className={`w-full py-5 rounded-lg font-display font-bold text-base tracking-[0.2em] transition-colors ${
            passkeyBlocked
              ? 'bg-gray-800/60 border-2 border-gray-700 text-gray-500 cursor-not-allowed'
              : isFiberConnecting
                ? 'bg-cyan-500/15 border-2 border-cyan-400/60 text-cyan-300 cursor-wait'
                : 'bg-cyan-500/20 border-2 border-cyan-400 text-cyan-400 hover:bg-cyan-500/30'
          }`}
        >
          {buttonLabel}
        </button>
      ) : (
        <button
          onClick={isCharging ? onStopCharging : onStartCharging}
          disabled={
            !selectedStation.available
            || (!isCharging && !fiberConnected)
            || (!isCharging && channelBalanceCkb !== undefined && channelBalanceCkb < LOW_BALANCE_THRESHOLD_CKB)
          }
          className={`w-full py-5 rounded-lg font-display font-bold text-base tracking-[0.2em] transition-all ${
            isCharging
              ? 'bg-red-500/20 border-2 border-red-400 text-red-400 hover:bg-red-500/30 shadow-[0_0_20px_rgba(248,113,113,0.3)]'
              : canStart
                ? 'bg-cyan-500/20 border-2 border-cyan-400 text-cyan-300 hover:bg-cyan-500/30 glow-cyan shadow-[0_0_24px_rgba(34,211,238,0.35)]'
                : 'bg-gray-800/60 border-2 border-gray-700 text-gray-500 cursor-not-allowed'
          }`}
        >
          {buttonLabel}
        </button>
      )}
    </div>
  );
};

export default StationDetails;
