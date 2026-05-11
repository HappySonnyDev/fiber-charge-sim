'use client';

import { useEffect, useState } from 'react';

interface StatsData {
  today: {
    totalAmount: number;
    totalFee: number;
    totalRoutingFee: number;
    txCount: number;
  };
  allTime: {
    totalAmount: number;
    totalFee: number;
    totalRoutingFee: number;
    txCount: number;
    sessionCount: number;
  };
  activeSessions: number;
  ranking: Array<{
    id: number;
    name: string;
    brand: string;
    totalAmount: number;
    totalFee: number;
    totalRoutingFee: number;
    txCount: number;
  }>;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = () => {
      fetch('/api/admin/stats', { cache: 'no-store' })
        .then(async res => {
          const data = await res.json();
          if (!res.ok || data.error) {
            throw new Error(data.error || 'Failed to load stats');
          }
          setStats(data);
          setLoading(false);
        })
        .catch((err) => {
          console.error('Stats fetch error:', err);
          setLoading(false);
        });
    };
    load();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, []);

  if (loading) {
    return <div className="text-gray-400">Loading...</div>;
  }

  if (!stats) {
    return <div className="text-red-400">Failed to load stats</div>;
  }

  const statCards = [
    { label: "Today's Revenue", value: `${stats.today.totalAmount.toFixed(4)} CKB`, color: 'text-green-400' },
    { label: "Today's TXs", value: stats.today.txCount.toString(), color: 'text-cyan-400' },
    { label: "Today's Routing Fees", value: `${stats.today.totalRoutingFee.toFixed(4)} CKB`, color: 'text-orange-400' },
    { label: 'Active Sessions', value: stats.activeSessions.toString(), color: 'text-purple-400' },
    { label: 'All-Time Revenue', value: `${stats.allTime.totalAmount.toFixed(4)} CKB`, color: 'text-blue-400' },
    { label: 'All-Time Routing Fees', value: `${stats.allTime.totalRoutingFee.toFixed(4)} CKB`, color: 'text-orange-400' },
  ];

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-8">Dashboard</h2>

      <div className="grid grid-cols-3 gap-6 mb-10">
        {statCards.map((card) => (
          <div key={card.label} className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <p className="text-sm text-gray-500 mb-2">{card.label}</p>
            <p className={`text-2xl font-mono font-bold ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Router Network Config */}
      <h3 className="text-lg font-semibold text-gray-300 mb-4">Router Network</h3>
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-10">
        <div className="grid grid-cols-3 gap-6">
          <div>
            <p className="text-xs text-gray-500 mb-1">Routing Topology</p>
            <p className="text-sm text-white font-mono">You → Fiber Hub → Station</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Hub Fee Rate</p>
            <p className="text-2xl font-mono font-bold text-amber-400">10%</p>
            <p className="text-xs text-gray-600 mt-1">max allowed per payment</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Router Fee Rate</p>
            <p className="text-2xl font-mono font-bold text-orange-400">10%</p>
            <p className="text-xs text-gray-600 mt-1">tlc_fee_proportional_millionths: 100000</p>
          </div>
        </div>
      </div>

      <h3 className="text-lg font-semibold text-gray-300 mb-4">Station Revenue Ranking</h3>
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-800 text-gray-400 text-sm">
            <tr>
              <th className="px-6 py-3">Station</th>
              <th className="px-6 py-3">Brand</th>
              <th className="px-6 py-3 text-right">Revenue (CKB)</th>
              <th className="px-6 py-3 text-right">TXs</th>
            </tr>
          </thead>
          <tbody>
            {stats.ranking.map((station) => (
              <tr key={station.id} className="border-t border-gray-800">
                <td className="px-6 py-4 text-white">{station.name}</td>
                <td className="px-6 py-4 text-gray-400">{station.brand}</td>
                <td className="px-6 py-4 text-right text-green-400 font-mono">
                  {station.totalAmount.toFixed(4)}
                </td>
                <td className="px-6 py-4 text-right text-cyan-400 font-mono">
                  {station.txCount}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
