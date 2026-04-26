import React, { useRef, useEffect } from 'react';

interface Log {
  time: string;
  message: string;
}

interface TransactionLogProps {
  logs: Log[];
}

const TransactionLog: React.FC<TransactionLogProps> = ({ logs }) => {
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div className="glass-panel p-4 flex-1 min-h-[150px] max-h-[200px] flex flex-col">
      <h3 className="font-display text-xs text-gray-500 mb-2">TRANSACTION LOG</h3>
      <div className="flex-1 overflow-y-auto font-mono text-xs space-y-1">
        {logs.length === 0 ? (
          <p className="text-gray-600">No transactions yet...</p>
        ) : (
          logs.map((log, i) => (
            <div key={i} className="flex gap-3 text-gray-400">
              <span className="text-cyan-600">{log.time}</span>
              <span className="text-gray-300">{log.message}</span>
            </div>
          ))
        )}
        <div ref={logsEndRef} />
      </div>
    </div>
  );
};

export default TransactionLog;
