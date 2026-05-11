'use client';

import { useEffect, useState } from 'react';

interface Channel {
  channelId: string;
  peerPubkey: string;
  peerType: 'station' | 'user';
  peerName: string;
  peerBrand: string | null;
  localBalance: number;
  remoteBalance: number;
  totalCapacity: number;
  feeProportionalMillionths: number;
  feePercent: string;
  isPublic: boolean;
  enabled: boolean;
  createdAt: string;
}

interface RouterData {
  summary: {
    totalChannels: number;
    userChannels: number;
    stationChannels: number;
    totalRoutingFee: number;
    totalTxCount: number;
  };
  channels: Channel[];
}

export default function RouterPage() {
  const [data, setData] = useState<RouterData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = () => {
      fetch('/api/admin/router', { cache: 'no-store' })
        .then(async res => {
          const json = await res.json();
          if (!res.ok || json.error) {
            throw new Error(json.error || 'Failed to load router data');
          }
          setData(json);
          setLoading(false);
        })
        .catch((err) => {
          console.error('Router fetch error:', err);
          setLoading(false);
        });
    };
    load();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, []);

  if (loading) {
    return <div className="text-gray-400">Loading Router status...</div>;
  }

  if (!data) {
    return <div className="text-red-400">Failed to load Router status</div>;
  }

  const { summary, channels } = data;
  const userChs = channels.filter(c => c.peerType === 'user');
  const stationChs = channels.filter(c => c.peerType === 'station');

  const statCards = [
    { label: 'Total Channels', value: summary.totalChannels.toString(), color: 'text-cyan-400' },
    { label: 'User Connections', value: summary.userChannels.toString(), color: 'text-purple-400' },
    { label: 'Station Connections', value: summary.stationChannels.toString(), color: 'text-green-400' },
    { label: 'Total Routing Fees', value: `${summary.totalRoutingFee.toFixed(4)} CKB`, color: 'text-orange-400' },
    { label: 'Total TXs Routed', value: summary.totalTxCount.toString(), color: 'text-blue-400' },
  ];

  const ChannelTable = ({ title, rows }: { title: string; rows: Channel[] }) => (
    <div className="mb-8">
      <h3 className="text-lg font-semibold text-gray-300 mb-4">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-gray-500">No channels</p>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-gray-800 text-gray-400 text-sm">
              <tr>
                <th className="px-4 py-3">Peer</th>
                <th className="px-4 py-3">Pubkey</th>
                <th className="px-4 py-3 text-right">Router Balance</th>
                <th className="px-4 py-3 text-right">Peer Balance</th>
                <th className="px-4 py-3 text-right">Capacity</th>
                <th className="px-4 py-3 text-right">Fee Rate</th>
                <th className="px-4 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((ch) => (
                <tr key={ch.channelId} className="border-t border-gray-800">
                  <td className="px-4 py-3 text-white">
                    {ch.peerName}
                    {ch.peerBrand && (
                      <span className="text-gray-500 text-xs ml-2">({ch.peerBrand})</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-400 font-mono text-xs truncate max-w-[180px]">
                    {ch.peerPubkey.slice(0, 20)}...
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-cyan-400">
                    {ch.localBalance.toFixed(4)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-green-400">
                    {ch.remoteBalance.toFixed(4)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-gray-300">
                    {ch.totalCapacity.toFixed(4)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-orange-400">
                    {ch.feePercent}%
                  </td>
                  <td className="px-4 py-3 text-center">
                    {ch.enabled ? (
                      <span className="text-xs px-2 py-1 rounded bg-green-500/20 text-green-400">Active</span>
                    ) : (
                      <span className="text-xs px-2 py-1 rounded bg-red-500/20 text-red-400">Inactive</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-8">Router Network</h2>

      <div className="grid grid-cols-5 gap-4 mb-10">
        {statCards.map((card) => (
          <div key={card.label} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <p className="text-sm text-gray-500 mb-2">{card.label}</p>
            <p className={`text-xl font-mono font-bold ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      <ChannelTable title="User Channels" rows={userChs} />
      <ChannelTable title="Station Channels" rows={stationChs} />
    </div>
  );
}
