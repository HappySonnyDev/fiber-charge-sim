'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import NetworkMap from '../components/NetworkMap';
import StationDetails from '../components/StationDetails';
import SessionStats from '../components/SessionStats';
import TransactionLog from '../components/TransactionLog';
import OpenChannelModal from '../components/OpenChannelModal';
import { STATIONS, BATTERY_CAPACITY_KWH, CHARGE_DEMO_SPEEDUP } from '../data/stations';
import type { Station } from '../data/stations';
import { useFiberNode } from '../hooks/useFiberNode';
import { useChannelOpening } from '../hooks/useChannelOpening';
import { InvoicePayment } from '../lib/invoice-payment';

interface Particle {
  id: number;
}

interface Log {
  time: string;
  message: string;
}

interface SessionStatsData {
  duration: number;
  totalPaid: number;
  txCount: number;
}

// Bootnode multiaddr - WebSocket proxy to local Router node
// Format: /ip4/IP/tcp/PORT/ws for WebSocket connection
// Use environment variable or default to localhost (for local development)
const BOOTNODE_MULTIADDR = process.env.NEXT_PUBLIC_FIBER_BOOTNODE || '/ip4/127.0.0.1/tcp/8231/ws';

// Station pubkeys - configured with real node pubkeys from fiber-nodes/.env
const STATION_PUBKEYS: Record<number, string> = {
  1: process.env.NEXT_PUBLIC_STATION_1_PUBKEY || '0x030aeb2f31242df1a6f2317a7e97cb2c604519e929944d512f68b3e7881e809ff3', // Tesla
  2: process.env.NEXT_PUBLIC_STATION_2_PUBKEY || '0x03abcabdd0fe402152e4d0d38b7c5a247eb650c690b404baaf3a9a83cd8fd0d9f1', // NIO
  3: process.env.NEXT_PUBLIC_STATION_3_PUBKEY || '0x02685ea605c28d9e16de0dfcddba1a81942084fb2a56ea2ea324bb0c4093959fe8', // XPeng
  4: process.env.NEXT_PUBLIC_STATION_4_PUBKEY || '0x02c0f31ab51e5b9cc11e3335e5080b93e16bf63f4eb43e3bcbca665804c7fb7030', // EA
};

// 默认选中的车站 ID（Tesla）
const DEFAULT_STATION_ID = 1;

export default function HomePage() {
  const [selectedStation, setSelectedStation] = useState<Station | null>(
    () => STATIONS.find(s => s.id === DEFAULT_STATION_ID) ?? null
  );
  const [isCharging, setIsCharging] = useState<boolean>(false);
  const [batteryLevel, setBatteryLevel] = useState<number>(23);
  const [sessionStats, setSessionStats] = useState<SessionStatsData>({ duration: 0, totalPaid: 0, txCount: 0 });
  const [particles, setParticles] = useState<Particle[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [, setFiberPayments] = useState<{ payment_hash: string }[]>([]);
  // 每次链下支付的金额（CKB），从 /api/charging/config 拉取后填入；用于网络图上粒子的金额标签
  const [amountPerPaymentCkb, setAmountPerPaymentCkb] = useState<number>(0.5);

  // Fiber node hook
  const fiberNode = useFiberNode(BOOTNODE_MULTIADDR, 'Fiber Charge User');
  const channelOpening = useChannelOpening(fiberNode.channels, fiberNode.browserNodeRef);
  const [isOpenChannelModalVisible, setIsOpenChannelModalVisible] = useState(false);
  const invoicePaymentRef = useRef<InvoicePayment | null>(null);

  const openChannelModal = useCallback(() => setIsOpenChannelModalVisible(true), []);
  const closeChannelModal = useCallback(() => setIsOpenChannelModalVisible(false), []);

  // 通道变 ready 后自动弹出 Modal（让用户清楚可以使用了），只触发一次
  const lastReadyShown = useRef<string | null>(null);
  useEffect(() => {
    const p = channelOpening.pending;
    if (!p) return;
    if (p.step === 'ready' && lastReadyShown.current !== `${p.startedAt}`) {
      lastReadyShown.current = `${p.startedAt}`;
      setIsOpenChannelModalVisible(true);
    }
  }, [channelOpening.pending]);

  // 推导可用通道余额（number）以供 StationDetails 低余额提示。
  // fiberNode.availableBalance 格式如 "12.345678 CKB"
  const channelBalanceCkb = fiberNode.isConnected
    ? parseFloat(fiberNode.availableBalance.replace(' CKB', '')) || 0
    : undefined;

  // SharedArrayBuffer check
  useEffect(() => {
    if (typeof SharedArrayBuffer === 'undefined') {
      console.error('SharedArrayBuffer is not available. COOP/COEP headers may not be set correctly.');
    } else {
      console.log('SharedArrayBuffer is available:', typeof SharedArrayBuffer);
    }
    console.log('crossOriginIsolated:', window.crossOriginIsolated);
  }, []);

  // Add log helper
  const addLog = useCallback((message: string) => {
    const time = new Date().toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    setLogs(prev => [...prev.slice(-20), { time, message }]);
  }, []);

  // Charging simulation - UI updates only (battery, duration)
  // 电量增长按真实物理公式计算：
  //   incPerSec(%) = power(kW) / 3600 / capacity(kWh) × 100 × demoSpeedup
  // 保留不同 station 的功率差异，同时加速使演示可看。
  // 粒子动画由真实的链下支付事件（onPaymentSent，默认每 5s 一次）触发，
  // 而不是这里的每秒 tick，避免视觉与实际支付脱钩。
  useEffect(() => {
    if (!isCharging || !selectedStation) return;

    const incPerSec =
      (selectedStation.power / 3600 / BATTERY_CAPACITY_KWH) * 100 * CHARGE_DEMO_SPEEDUP;

    const interval = setInterval(() => {
      setBatteryLevel(prev => Math.min(prev + incPerSec, 100));
      setSessionStats(prev => ({
        duration: prev.duration + 1,
        totalPaid: prev.totalPaid,
        txCount: prev.txCount
      }));
    }, 1000);

    return () => clearInterval(interval);
  }, [isCharging, selectedStation]);

  const startCharging = async () => {
    if (!selectedStation) return;

    if (!fiberNode.isConnected) {
      addLog('Error: Please connect your Fiber node first');
      return;
    }

    const stationPubkey = STATION_PUBKEYS[selectedStation.id];
    if (!stationPubkey) {
      addLog(`Error: No Fiber pubkey configured for ${selectedStation.name}`);
      return;
    }

    setIsCharging(true);
    setSessionStats({ duration: 0, totalPaid: 0, txCount: 0 });
    addLog(`Connected to ${selectedStation.name}`);
    addLog('Initializing invoice-based payment...');

    try {
      if (!fiberNode.browserNodeRef.current) {
        throw new Error('Browser node not initialized');
      }

      // Step 1: Get interval amount from server config
      let amountPerIntervalCkb = 0.5; // fallback
      let intervalMs = 5000;
      try {
        const configRes = await fetch('/api/charging/config', { cache: 'no-store' });
        if (configRes.ok) {
          const configData = await configRes.json();
          if (configData.amount_per_interval) amountPerIntervalCkb = configData.amount_per_interval;
          if (configData.interval_ms) intervalMs = configData.interval_ms;
        }
      } catch { /* use fallback */ }
      // 同步给 NetworkMap 用于显示粒子上的金额
      setAmountPerPaymentCkb(amountPerIntervalCkb);

      const invoicePayment = new InvoicePayment({
        node: fiberNode.browserNodeRef.current,
        stationId: selectedStation.id,
        userPubkey: fiberNode.nodeInfo?.pubkey || 'unknown',
        amountPerIntervalCkb,
        intervalMs,
        onPaymentSent: (result) => {
          setFiberPayments(prev => [...prev, { payment_hash: result.paymentHash }]);
          addLog(`✓ Invoice paid: ${result.paymentHash.slice(0, 16)}... (${(Number(result.amount) / 100000000).toFixed(6)} CKB)`);
          setSessionStats(prev => ({
            ...prev,
            txCount: prev.txCount + 1,
            totalPaid: prev.totalPaid + (Number(result.amount + result.fee) / 100000000)
          }));
          // 真实链下支付成功 -> 触发一次粒子动画（User → Hub → Station）
          // 两段动画各 1500ms + fee 气泡渐隐 ~1400ms，留余量后清理
          const particleId = Date.now() + Math.random();
          setParticles(prev => [...prev, { id: particleId }]);
          setTimeout(() => {
            setParticles(prev => prev.filter(p => p.id !== particleId));
          }, 3200);
          fiberNode.refresh();
        },
        onError: (error: Error) => {
          addLog(`Invoice payment error: ${error.message}`);
        },
        onLog: (message: string) => {
          addLog(message);
        },
      });

      await invoicePayment.start();
      invoicePaymentRef.current = invoicePayment;
      addLog(`Invoice payment stream active - ${amountPerIntervalCkb} CKB every ${intervalMs / 1000}s`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start invoice payment';
      addLog(`Error: ${message}`);
      setIsCharging(false);
    }
  };

  const stopCharging = async () => {
    if (invoicePaymentRef.current) {
      try {
        invoicePaymentRef.current.stop();
        addLog('Invoice payment stream stopped');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to stop invoice payment';
        addLog(`Error stopping payment: ${message}`);
      }
      invoicePaymentRef.current = null;
    }

    setIsCharging(false);
    addLog('Charging stopped.');
    addLog(`Session: ${sessionStats.txCount} transactions, ${sessionStats.totalPaid.toFixed(6)} CKB total`);
  };

  return (
    <div className="relative h-screen flex flex-col overflow-hidden">
      <div className="grid-bg" />

      <Header batteryLevel={batteryLevel} fiberNode={fiberNode} pendingChannel={channelOpening.pending} onOpenChannel={openChannelModal} />

      <main className="relative z-10 p-6 flex gap-6 flex-1 min-h-0 overflow-hidden">
        <div className="flex-[7] min-w-0 glass-panel p-6 relative overflow-hidden">
          <div className="scan-line" />
          <h2 className="font-display text-lg text-cyan-400 mb-4 flex items-center gap-2">
            CHARGING NETWORK MAP
          </h2>

          <NetworkMap
            selectedStation={selectedStation}
            isCharging={isCharging}
            onStationSelect={setSelectedStation}
            particles={particles}
            amountPerPaymentCkb={amountPerPaymentCkb}
          />
        </div>

        <div className="flex-[5] min-w-0 flex flex-col gap-4 min-h-0">
          <StationDetails
            selectedStation={selectedStation}
            isCharging={isCharging}
            onStartCharging={startCharging}
            onStopCharging={stopCharging}
            fiberConnected={fiberNode.isConnected}
            channelBalanceCkb={channelBalanceCkb}
            onOpenChannel={openChannelModal}
            hasPendingChannel={!!channelOpening.pending && channelOpening.pending.step !== 'failed' && channelOpening.pending.step !== 'ready'}
            onConnectFiber={fiberNode.connect}
            isFiberConnecting={fiberNode.isConnecting}
            passkeySupported={fiberNode.passkeySupported}
          />

          <SessionStats isCharging={isCharging} sessionStats={sessionStats} />

          <TransactionLog logs={logs} />
        </div>
      </main>

      <OpenChannelModal
        open={isOpenChannelModalVisible}
        onClose={closeChannelModal}
        onChainBalance={fiberNode.onChainBalance}
        ckbAddress={fiberNode.ckbAddress}
        onRefresh={fiberNode.refresh}
        isRefreshing={fiberNode.isRefreshing}
        pending={channelOpening.pending}
        startOpen={channelOpening.startOpen}
        dismiss={channelOpening.dismiss}
      />

      <Footer />
    </div>
  );
}
