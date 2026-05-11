'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/admin', label: 'Dashboard', icon: '◆' },
  { href: '/admin/router', label: 'Router Network', icon: '◐' },
  { href: '/admin/stations', label: 'Stations', icon: '⚡' },
  { href: '/admin/transactions', label: 'Transactions', icon: '◈' },
  { href: '/admin/stats', label: 'Statistics', icon: '◉' },
  { href: '/', label: '← Back to App', icon: '←' },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-gray-900 border-r border-gray-800 min-h-screen p-6">
      <h1 className="text-xl font-bold text-cyan-400 mb-8">Admin Panel</h1>
      <nav className="space-y-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                isActive
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
              }`}
            >
              <span className="text-sm">{item.icon}</span>
              <span className="text-sm font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
