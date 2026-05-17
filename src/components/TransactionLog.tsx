import React, { useRef, useEffect } from 'react';

interface Log {
  time: string;
  message: string;
}

interface TransactionLogProps {
  logs: Log[];
}

// 根据日志内容识别高亮类型
function classifyLog(message: string): 'invoice' | 'session' | 'default' {
  if (/^\s*✓\s*Invoice paid/i.test(message)) return 'invoice';
  if (/^\s*Session\s*:/i.test(message)) return 'session';
  return 'default';
}

const TransactionLog: React.FC<TransactionLogProps> = ({ logs }) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // 只在日志容器内部滚动到底部，避免 scrollIntoView 连带滚动外层可滚动祖先
  // （外层右侧列是 overflow-y-auto，刷新时会被 scrollIntoView 连带向下滚一点）
  useEffect(() => {
    if (logs.length === 0) return;
    const el = scrollContainerRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="glass-panel p-4 flex-1 min-h-[200px] flex flex-col">
      <h3 className="font-display text-xs text-gray-500 mb-2 flex-shrink-0">TRANSACTION LOG</h3>
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto font-mono text-xs space-y-1">
        {logs.length === 0 ? (
          <p className="text-gray-600">No transactions yet...</p>
        ) : (
          logs.map((log, i) => {
            const type = classifyLog(log.message);
            if (type === 'invoice') {
              return (
                <div
                  key={i}
                  className="flex gap-3 items-start px-2 py-1 rounded border-l-2 border-green-400 bg-green-500/10"
                >
                  <span className="text-cyan-600 flex-shrink-0">{log.time}</span>
                  <span className="text-green-300 font-medium">{log.message}</span>
                </div>
              );
            }
            if (type === 'session') {
              return (
                <div
                  key={i}
                  className="flex gap-3 items-start px-2 py-1 rounded border-l-2 border-cyan-400 bg-cyan-500/10"
                >
                  <span className="text-cyan-600 flex-shrink-0">{log.time}</span>
                  <span className="text-cyan-300 font-medium tracking-wide">{log.message}</span>
                </div>
              );
            }
            return (
              <div key={i} className="flex gap-3 text-gray-400 px-2">
                <span className="text-cyan-600 flex-shrink-0">{log.time}</span>
                <span className="text-gray-300">{log.message}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default TransactionLog;
