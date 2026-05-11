'use client';

import { useEffect, useState } from 'react';

interface Payment {
  id: string;
  payment_hash: string;
  amount: number;
  fee: number;
  status: string;
  preimage: string | null;
  created_at: string;
}

export default function TransactionsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/transactions?limit=100')
      .then(async res => {
        const data = await res.json();
        if (!res.ok || data.error) {
          throw new Error(data.error || 'Failed to load transactions');
        }
        setPayments(data.payments || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Transactions fetch error:', err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <div className="text-gray-400">Loading...</div>;
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-8">Transactions</h2>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-800 text-gray-400 text-sm">
            <tr>
              <th className="px-6 py-3">Time</th>
              <th className="px-6 py-3">Payment Hash</th>
              <th className="px-6 py-3 text-right">Amount (CKB)</th>
              <th className="px-6 py-3 text-right">Fee (CKB)</th>
              <th className="px-6 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((payment) => (
              <tr key={payment.id} className="border-t border-gray-800">
                <td className="px-6 py-4 text-gray-400 text-sm">
                  {new Date(payment.created_at).toLocaleString()}
                </td>
                <td className="px-6 py-4 font-mono text-sm text-cyan-400">
                  {payment.payment_hash.slice(0, 20)}...
                </td>
                <td className="px-6 py-4 text-right font-mono text-green-400">
                  {payment.amount.toFixed(6)}
                </td>
                <td className="px-6 py-4 text-right font-mono text-amber-400">
                  {payment.fee.toFixed(6)}
                </td>
                <td className="px-6 py-4">
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      payment.status === 'confirmed'
                        ? 'bg-green-500/20 text-green-400'
                        : payment.status === 'pending'
                        ? 'bg-yellow-500/20 text-yellow-400'
                        : 'bg-red-500/20 text-red-400'
                    }`}
                  >
                    {payment.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {payments.length === 0 && (
          <div className="px-6 py-12 text-center text-gray-500">
            No transactions yet
          </div>
        )}
      </div>
    </div>
  );
}
