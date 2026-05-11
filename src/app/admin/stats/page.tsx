'use client';

import { useEffect, useState } from 'react';

interface DailyStat {
  date: string;
  stationId: number | null;
  totalAmount: number;
  totalFee: number;
  txCount: number;
}

export default function StatsPage() {
  const [daily, setDaily] = useState<DailyStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/stats')
      .then(async res => {
        const data = await res.json();
        if (!res.ok || data.error) {
          throw new Error(data.error || 'Failed to load stats');
        }
        setDaily(data.daily || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Stats fetch error:', err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <div className="text-gray-400">Loading...</div>;
  }

  // Aggregate by date
  const byDate = new Map<string, { amount: number; fee: number; count: number }>();
  daily.forEach(d => {
    const existing = byDate.get(d.date);
    if (existing) {
      existing.amount += d.totalAmount;
      existing.fee += d.totalFee;
      existing.count += d.txCount;
    } else {
      byDate.set(d.date, { amount: d.totalAmount, fee: d.totalFee, count: d.txCount });
    }
  });

  const dates = Array.from(byDate.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-30); // Last 30 days

  const maxAmount = Math.max(...dates.map(d => d[1].amount), 0.001);

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-8">Statistics</h2>

      {/* Daily Revenue Chart */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-8">
        <h3 className="text-lg font-semibold text-gray-300 mb-6">Daily Revenue & Fees (Last 30 Days)</h3>

        {dates.length === 0 ? (
          <div className="text-center text-gray-500 py-12">No data yet</div>
        ) : (
          <div className="space-y-3">
            {dates.map(([date, data]) => {
              const amountPct = (data.amount / maxAmount) * 100;
              const feePct = (data.fee / maxAmount) * 100;
              return (
                <div key={date} className="flex items-center gap-4">
                  <span className="text-sm text-gray-400 w-24 shrink-0">{date}</span>
                  <div className="flex-1 h-8 bg-gray-800 rounded overflow-hidden relative">
                    <div
                      className="absolute left-0 top-0 h-full bg-green-500/60"
                      style={{ width: `${amountPct}%` }}
                    />
                    <div
                      className="absolute left-0 top-0 h-full bg-amber-500/60"
                      style={{ width: `${feePct}%` }}
                    />
                  </div>
                  <span className="text-sm font-mono text-green-400 w-24 text-right">
                    {data.amount.toFixed(3)}
                  </span>
                  <span className="text-sm font-mono text-amber-400 w-20 text-right">
                    {data.fee.toFixed(3)}
                  </span>
                  <span className="text-sm font-mono text-cyan-400 w-12 text-right">
                    {data.count}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex gap-6 mt-6 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500/60 rounded" />
            <span className="text-gray-400">Revenue</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-amber-500/60 rounded" />
            <span className="text-gray-400">Fees</span>
          </div>
        </div>
      </div>

      {/* Daily Data Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <h3 className="text-lg font-semibold text-gray-300 px-6 py-4">Daily Details</h3>
        <table className="w-full text-left">
          <thead className="bg-gray-800 text-gray-400 text-sm">
            <tr>
              <th className="px-6 py-3">Date</th>
              <th className="px-6 py-3">Station</th>
              <th className="px-6 py-3 text-right">Revenue (CKB)</th>
              <th className="px-6 py-3 text-right">Fees (CKB)</th>
              <th className="px-6 py-3 text-right">TXs</th>
            </tr>
          </thead>
          <tbody>
            {daily.map((d, i) => (
              <tr key={`${d.date}-${d.stationId}-${i}`} className="border-t border-gray-800">
                <td className="px-6 py-3 text-gray-400">{d.date}</td>
                <td className="px-6 py-3 text-gray-400">
                  {d.stationId ?? 'All'}
                </td>
                <td className="px-6 py-3 text-right font-mono text-green-400">
                  {d.totalAmount.toFixed(4)}
                </td>
                <td className="px-6 py-3 text-right font-mono text-amber-400">
                  {d.totalFee.toFixed(4)}
                </td>
                <td className="px-6 py-3 text-right font-mono text-cyan-400">
                  {d.txCount}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
