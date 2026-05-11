'use client';

import { useEffect, useState } from 'react';

interface Station {
  id: number;
  name: string;
  brand: string;
  rate: number;
  power: number;
  pubkey: string | null;
  stats: {
    totalAmount: number;
    txCount: number;
  };
}

export default function StationsPage() {
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStations = () => {
    fetch('/api/admin/stations')
      .then(async res => {
        const data = await res.json();
        if (!res.ok || data.error) {
          throw new Error(data.error || 'Failed to load stations');
        }
        setStations(data.stations || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Stations fetch error:', err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchStations();
  }, []);

  if (loading) {
    return <div className="text-gray-400">Loading...</div>;
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-8">Stations</h2>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-800 text-gray-400 text-sm">
            <tr>
              <th className="px-6 py-3">Name</th>
              <th className="px-6 py-3">Brand</th>
              <th className="px-6 py-3 text-right">Rate (CKB/kWh)</th>
              <th className="px-6 py-3 text-right">Power (kW)</th>
              <th className="px-6 py-3 text-right">Revenue</th>
              <th className="px-6 py-3 text-right">TXs</th>
            </tr>
          </thead>
          <tbody>
            {stations.map((station) => (
              <tr key={station.id} className="border-t border-gray-800">
                <td className="px-6 py-4 text-white">{station.name}</td>
                <td className="px-6 py-4 text-gray-400">{station.brand}</td>
                <td className="px-6 py-4 text-right font-mono">{station.rate.toFixed(2)}</td>
                <td className="px-6 py-4 text-right font-mono">{station.power}</td>
                <td className="px-6 py-4 text-right font-mono text-green-400">
                  {station.stats.totalAmount.toFixed(4)}
                </td>
                <td className="px-6 py-4 text-right font-mono text-cyan-400">
                  {station.stats.txCount}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
