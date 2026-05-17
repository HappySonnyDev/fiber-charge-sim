import React from 'react';
import Link from 'next/link';

const Footer: React.FC = () => {
  return (
    <footer className="relative z-10 px-8 py-4 border-t border-cyan-500/20">
      <div className="flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center gap-6">
          <Link
            href="/admin"
            className="flex items-center gap-1.5 font-mono uppercase tracking-wider text-cyan-400/80 hover:text-cyan-300 transition-colors border border-cyan-500/30 hover:border-cyan-400/60 rounded-md px-2.5 py-1"
            title="查看 Fiber Hub 与各车站收益"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            ADMIN DASHBOARD
          </Link>
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 bg-cyan-400 rounded-full" />
            User Node
          </span>
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 bg-amber-400 rounded-full" />
            Router Node (High Liquidity)
          </span>
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 bg-green-400 rounded-full" />
            Charging Station
          </span>
        </div>
        <div>Powered by Fiber Network • Multi-Hop Payments Demo</div>
      </div>
    </footer>
  );
};

export default Footer;
