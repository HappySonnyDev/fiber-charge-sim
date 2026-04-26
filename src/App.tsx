import React, { useState, useEffect, useCallback, useRef } from 'react';
import Header from './components/Header';
import Footer from './components/Footer';
import NetworkMap from './components/NetworkMap';
import VehicleStatus from './components/VehicleStatus';
import StationDetails from './components/StationDetails';
import SessionStats from './components/SessionStats';
import WalletBalance from './components/WalletBalance';
import TransactionLog from './components/TransactionLog';
import FiberConnectionPanel from './components/FiberConnectionPanel';
import ChannelDeposit from './components/ChannelDeposit';
import { STATIONS } from './data/stations';
import type { Station } from './data/stations';
import { useFiberNode } from './hooks/useFiberNode';
import { StreamingPayment } from './lib/streaming-payment';
import type { SendPaymentResult } from '@fiber-pay/sdk/browser';

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
const BOOTNODE_MULTIADDR = import.meta.env.VITE_FIBER_BOOTNODE || '/ip4/127.0.0.1/tcp/8231/ws';

// Station pubkeys - configured with real node pubkeys from fiber-nodes/.env
const STATION_PUBKEYS: Record<number, string> = {
  1: import.meta.env.VITE_STATION_1_PUBKEY || '0x030aeb2f31242df1a6f2317a7e97cb2c604519e929944d512f68b3e7881e809ff3', // Tesla
  2: import.meta.env.VITE_STATION_2_PUBKEY || '0x03abcabdd0fe402152e4d0d38b7c5a247eb650c690b404baaf3a9a83cd8fd0d9f1', // NIO
  3: import.meta.env.VITE_STATION_3_PUBKEY || '0x02685ea605c28d9e16de0dfcddba1a81942084fb2a56ea2ea324bb0c4093959fe8', // XPeng
  4: import.meta.env.VITE_STATION_4_PUBKEY || '0x02c0f31ab51e5b9cc11e3335e5080b93e16bf63f4eb43e3bcbca665804c7fb7030', // EA
};

// Router pubkey for testing direct payment
const ROUTER_PUBKEY = '0x03a14ea2a93b52fafa23edc29a2b90a1319e328665a5636163a18a0eea6588e2af';

const App: React.FC = () => {
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const [isCharging, setIsCharging] = useState<boolean>(false);
  const [batteryLevel, setBatteryLevel] = useState<number>(23);
  const [stationBalance, setStationBalance] = useState<Record<number, number>>({});
  const [sessionStats, setSessionStats] = useState<SessionStatsData>({ duration: 0, totalPaid: 0, txCount: 0 });
  const [particles, setParticles] = useState<Particle[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [, setFiberPayments] = useState<SendPaymentResult[]>([]);

  // Fiber node hook
  const fiberNode = useFiberNode(BOOTNODE_MULTIADDR, 'Fiber Charge User');
  const streamingPaymentRef = useRef<StreamingPayment | null>(null);

  // Initialize station balances
  // TODO: Fetch real station balances from Fiber nodes
  // For now, initialize to 0 until real data is available
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
  // Real payments are handled by StreamingPayment
  useEffect(() => {
    if (!isCharging || !selectedStation) return;

    const interval = setInterval(() => {
      // Update battery
      setBatteryLevel(prev => Math.min(prev + 0.5, 100));

      // Calculate payment amount for stats only (not real payment)
      const paymentAmount = selectedStation.rate / 3600;

      // Update session stats (for display only, real balance from Fiber node)
      setSessionStats(prev => ({
        duration: prev.duration + 1,
        totalPaid: prev.totalPaid + paymentAmount,
        txCount: prev.txCount
      }));

      // Add payment particle (visual effect only)
      const particleId = Date.now();
      setParticles(prev => [...prev, { id: particleId }]);

      // Remove particle after animation
      setTimeout(() => {
        setParticles(prev => prev.filter(p => p.id !== particleId));
      }, 1500);

    }, 1000);

    return () => clearInterval(interval);
  }, [isCharging, selectedStation]);

  const startCharging = async () => {
    if (!selectedStation) return;

    // Check if Fiber node is connected
    if (!fiberNode.isConnected) {
      addLog('Error: Please connect your Fiber node first');
      return;
    }

    // Check if we have pubkey for this station
    const stationPubkey = STATION_PUBKEYS[selectedStation.id];
    if (!stationPubkey) {
      addLog(`Error: No Fiber pubkey configured for ${selectedStation.name}`);
      return;
    }

    setIsCharging(true);
    setSessionStats({ duration: 0, totalPaid: 0, txCount: 0 });
    addLog(`Connected to ${selectedStation.name}`);
    addLog('Initializing Fiber streaming payment...');

    try {
      // Check if browser node is available
      if (!fiberNode.browserNodeRef.current) {
        throw new Error('Browser node not initialized');
      }

      // Initialize streaming payment with real browser node
      // Multi-hop payment: Browser -> Router -> Tesla
      const streamingPayment = new StreamingPayment({
        node: fiberNode.browserNodeRef.current,
        recipientPubkey: stationPubkey as `0x${string}`,
        amountPerInterval: BigInt(1000000), // 0.01 CKB per payment (in shannons)
        intervalMs: 5000, // Every 5 seconds
        onPaymentSent: (result: SendPaymentResult) => {
          setFiberPayments(prev => [...prev, result]);
          addLog(`✓ Fiber payment: ${result.payment_hash.slice(0, 16)}... (${(Number(1000000) / 100000000).toFixed(6)} CKB)`);
          // Update session stats with real payment
          setSessionStats(prev => ({
            ...prev,
            txCount: prev.txCount + 1
          }));
          // Refresh balance to show decrease
          fiberNode.refresh();
        },
        onError: (error: Error) => {
          addLog(`Fiber payment error: ${error.message}`);
        },
      });

      await streamingPayment.start();
      streamingPaymentRef.current = streamingPayment;
      addLog('Fiber streaming payment active - 0.01 CKB every 5s');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start streaming payment';
      addLog(`Error: ${message}`);
      setIsCharging(false);
    }
  };

  const stopCharging = async () => {
    // Stop streaming payment
    if (streamingPaymentRef.current) {
      try {
        await streamingPaymentRef.current.stop();
        addLog('Fiber streaming payment stopped');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to stop streaming payment';
        addLog(`Error stopping payment: ${message}`);
      }
      streamingPaymentRef.current = null;
    }

    setIsCharging(false);
    addLog('Charging stopped. Payment channel closed.');
    addLog(`Session: ${sessionStats.txCount} transactions, ${sessionStats.totalPaid.toFixed(6)} CKB total`);
  };

  return (
    <div className="relative min-h-screen">
      <div className="grid-bg" />

      <Header />

      {/* Main Content */}
      <main className="relative z-10 p-6 grid grid-cols-12 gap-6 h-[calc(100vh-100px)]">

        {/* Left Panel - City Map */}
        <div className="col-span-7 glass-panel p-6 relative overflow-hidden">
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

        {/* Right Panel - Dashboard */}
        <div className="col-span-5 flex flex-col gap-4">
          {/* Fiber Node Connection Panel */}
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

          <WalletBalance userBalance={fiberNode.onChainBalance} isConnected={fiberNode.isConnected} />

          <ChannelDeposit fiberNode={fiberNode} />

          <TransactionLog logs={logs} />
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default App;
