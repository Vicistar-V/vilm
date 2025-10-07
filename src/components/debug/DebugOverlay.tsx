import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { X, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DebugLog {
  timestamp: string;
  type: 'info' | 'error' | 'success' | 'warning';
  category: string;
  message: string;
}

interface DebugOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

// Global debug logger
class DebugLogger {
  private logs: DebugLog[] = [];
  private listeners: ((logs: DebugLog[]) => void)[] = [];
  private maxLogs = 100;

  log(category: string, message: string, type: 'info' | 'error' | 'success' | 'warning' = 'info') {
    const log: DebugLog = {
      timestamp: new Date().toLocaleTimeString(),
      type,
      category,
      message
    };
    
    this.logs.unshift(log);
    if (this.logs.length > this.maxLogs) {
      this.logs.pop();
    }
    
    this.notifyListeners();
    
    // Also log to console
    const consoleMsg = `[${category}] ${message}`;
    if (type === 'error') {
      console.error(consoleMsg);
    } else if (type === 'warning') {
      console.warn(consoleMsg);
    } else {
      console.log(consoleMsg);
    }
  }

  info(category: string, message: string) {
    this.log(category, message, 'info');
  }

  error(category: string, message: string) {
    this.log(category, message, 'error');
  }

  success(category: string, message: string) {
    this.log(category, message, 'success');
  }

  warning(category: string, message: string) {
    this.log(category, message, 'warning');
  }

  getLogs() {
    return [...this.logs];
  }

  clear() {
    this.logs = [];
    this.notifyListeners();
  }

  subscribe(listener: (logs: DebugLog[]) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener([...this.logs]));
  }
}

export const debugLogger = new DebugLogger();

export const DebugOverlay: React.FC<DebugOverlayProps> = ({ isOpen, onClose }) => {
  const [logs, setLogs] = useState<DebugLog[]>([]);
  const [isMinimized, setIsMinimized] = useState(false);
  const [filter, setFilter] = useState<'all' | 'info' | 'error' | 'success' | 'warning'>('all');

  useEffect(() => {
    const unsubscribe = debugLogger.subscribe(setLogs);
    setLogs(debugLogger.getLogs());
    return unsubscribe;
  }, []);

  if (!isOpen) return null;

  const filteredLogs = filter === 'all' 
    ? logs 
    : logs.filter(log => log.type === filter);

  const errorCount = logs.filter(log => log.type === 'error').length;
  const warningCount = logs.filter(log => log.type === 'warning').length;

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'error': return 'text-red-500 bg-red-50 border-red-200';
      case 'warning': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'success': return 'text-green-600 bg-green-50 border-green-200';
      default: return 'text-blue-600 bg-blue-50 border-blue-200';
    }
  };

  return (
    <div className={cn(
      "fixed bottom-0 left-0 right-0 z-50 bg-white shadow-2xl border-t-2 border-gray-300",
      "transition-all duration-300 ease-in-out",
      isMinimized ? "h-16" : "h-[60vh]"
    )}>
      {/* Header */}
      <div className="flex items-center justify-between p-3 bg-gray-100 border-b border-gray-300">
        <div className="flex items-center space-x-3">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setIsMinimized(!isMinimized)}
            className="h-8 w-8 p-0"
          >
            {isMinimized ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </Button>
          <h3 className="font-bold text-sm">Debug Console</h3>
          {errorCount > 0 && (
            <span className="px-2 py-0.5 text-xs bg-red-500 text-white rounded-full">
              {errorCount} errors
            </span>
          )}
          {warningCount > 0 && (
            <span className="px-2 py-0.5 text-xs bg-yellow-500 text-white rounded-full">
              {warningCount} warnings
            </span>
          )}
          <span className="text-xs text-gray-500">
            {logs.length} logs
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => debugLogger.clear()}
            className="h-8 w-8 p-0"
          >
            <Trash2 size={14} />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onClose}
            className="h-8 w-8 p-0"
          >
            <X size={16} />
          </Button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Filter Buttons */}
          <div className="flex space-x-2 p-2 bg-gray-50 border-b border-gray-200 overflow-x-auto">
            {(['all', 'error', 'warning', 'success', 'info'] as const).map((type) => (
              <Button
                key={type}
                size="sm"
                variant={filter === type ? "default" : "outline"}
                onClick={() => setFilter(type)}
                className="text-xs whitespace-nowrap"
              >
                {type.charAt(0).toUpperCase() + type.slice(1)}
                {type !== 'all' && ` (${logs.filter(l => l.type === type).length})`}
              </Button>
            ))}
          </div>

          {/* Logs Display */}
          <div className="overflow-y-auto h-[calc(60vh-120px)] p-3 space-y-2 bg-gray-50">
            {filteredLogs.length === 0 ? (
              <div className="text-center text-gray-400 py-8">
                No logs to display
              </div>
            ) : (
              filteredLogs.map((log, index) => (
                <div
                  key={index}
                  className={cn(
                    "p-2 rounded-lg border text-xs",
                    getTypeColor(log.type)
                  )}
                >
                  <div className="flex items-start justify-between mb-1">
                    <span className="font-bold uppercase text-[10px]">
                      {log.category}
                    </span>
                    <span className="text-[10px] opacity-60">
                      {log.timestamp}
                    </span>
                  </div>
                  <div className="text-xs leading-relaxed break-words">
                    {log.message}
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
};
