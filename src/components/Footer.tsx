import React from 'react';

const Footer: React.FC = () => {
  return (
    <footer className="relative z-10 px-8 py-4 border-t border-cyan-500/20">
      <div className="flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center gap-6">
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
