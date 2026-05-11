'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import NetworkMap from '../components/NetworkMap';
import VehicleStatus from '../components/VehicleStatus';
import StationDetails from '../components/StationDetails';
import SessionStats from '../components/SessionStats';
import TransactionLog from '../components/TransactionLog';
import FiberConnectionPanel from '../components/FiberConnectionPanel';
import ChannelDeposit from '../components/ChannelDeposit';
import { STATIONS } from '../data/stations';
import type { Station } from '../data/stations';
import { useFiberNode } from '../hooks/useFiberNode';
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

export default function HomePage() {
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const [isCharging, setIsCharging] = useState<boolean>(false);
  const [batteryLevel, setBatteryLevel] = useState<number>(23);
  const [stationBalance, setStationBalance] = useState<Record<number, number>>({});
  const [sessionStats, setSessionStats] = useState<SessionStatsData>({ duration: 0, totalPaid: 0, txCount: 0 });
  const [particles, setParticles] = useState<Particle[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [, setFiberPayments] = useState<{ payment_hash: string }[]>([]);

  // Fiber node hook
  const fiberNode = useFiberNode(BOOTNODE_MULTIADDR, 'Fiber Charge User');
  const invoicePaymentRef = useRef<InvoicePayment | null>(null);

  // SharedArrayBuffer check
  useEffect(() => {
    if (typeof SharedArrayBuffer === 'undefined') {
      console.error('SharedArrayBuffer is not available. COOP/COEP headers may not be set correctly.');
    } else {
      console.log('SharedArrayBuffer is available:', typeof SharedArrayBuffer);
    }
    console.log('crossOriginIsolated:', window.crossOriginIsolated);
  }, []);

  // Initialize station balances
  useEffect(() => {
    const initial: Record<number, number> = {};
    STATIONS.forEach(s => {
      initial[s.id] = 0;
    });
    setStationBalance(initial);
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

  // Charging simulation - UI updates only (battery, particles, duration)
  useEffect(() => {
    if (!isCharging || !selectedStation) return;

    const interval = setInterval(() => {
      setBatteryLevel(prev => Math.min(prev + 0.5, 100));
      setSessionStats(prev => ({
        duration: prev.duration + 1,
        totalPaid: prev.totalPaid,
        txCount: prev.txCount
      }));
      const particleId = Date.now();
      setParticles(prev => [...prev, { id: particleId }]);
      setTimeout(() => {
        setParticles(prev => prev.filter(p => p.id !== particleId));
      }, 1500);
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

      <Header />

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
          />
        </div>

        <div className="flex-[5] min-w-0 flex flex-col gap-4 overflow-y-auto">
          <FiberConnectionPanel fiberNode={fiberNode} />

          <VehicleStatus batteryLevel={batteryLevel} />

          <StationDetails
            selectedStation={selectedStation}
            isCharging={isCharging}
            onStartCharging={startCharging}
            onStopCharging={stopCharging}
            stationBalance={stationBalance}
            fiberConnected={fiberNode.isConnected}
          />

          <SessionStats isCharging={isCharging} sessionStats={sessionStats} />

          <ChannelDeposit fiberNode={fiberNode} />

          <TransactionLog logs={logs} />
        </div>
      </main>

      <Footer />
    </div>
  );
}
