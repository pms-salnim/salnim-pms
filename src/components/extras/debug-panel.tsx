"use client";

import React, { useState } from 'react';
import { Icons } from '@/components/icons';

interface DebugLog {
  timestamp: string;
  type: 'request' | 'response' | 'error';
  method: string;
  endpoint: string;
  status?: number;
  requestBody?: any;
  responseBody?: any;
  error?: string;
}

interface DebugPanelProps {
  isOpen: boolean;
  onClose: () => void;
  logs: DebugLog[];
  onClear: () => void;
}

export default function DebugPanel({ isOpen, onClose, logs, onClear }: DebugPanelProps) {
  const [expandedLog, setExpandedLog] = useState<number | null>(null);

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-0 right-0 w-full md:w-1/2 h-96 bg-slate-900 text-slate-100 rounded-t-lg shadow-2xl border-t border-slate-700 flex flex-col z-40">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-700 bg-slate-800">
        <div className="flex items-center gap-2">
          <Icons.Bug className="w-5 h-5 text-yellow-400" />
          <h3 className="font-bold text-sm">Debug Panel</h3>
          <span className="text-xs bg-slate-700 px-2 py-1 rounded">{logs.length} logs</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onClear}
            className="text-xs px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded transition-colors"
          >
            Clear
          </button>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-700 rounded transition-colors"
          >
            <Icons.X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Logs Container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {logs.length === 0 ? (
          <div className="text-center text-slate-500 text-sm py-8">
            No logs yet. Perform an action to see debug information.
          </div>
        ) : (
          logs.map((log, idx) => (
            <div
              key={idx}
              className={`p-3 rounded border text-xs font-mono cursor-pointer transition-all ${
                log.type === 'error'
                  ? 'border-red-600 bg-red-950/30 hover:bg-red-950/50'
                  : log.type === 'response'
                  ? 'border-green-600 bg-green-950/30 hover:bg-green-950/50'
                  : 'border-blue-600 bg-blue-950/30 hover:bg-blue-950/50'
              }`}
              onClick={() => setExpandedLog(expandedLog === idx ? null : idx)}
            >
              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                  log.type === 'error'
                    ? 'bg-red-600 text-white'
                    : log.type === 'response'
                    ? 'bg-green-600 text-white'
                    : 'bg-blue-600 text-white'
                }`}>
                  {log.type.toUpperCase()}
                </span>
                <span className="text-slate-400">{log.timestamp}</span>
                <span className="font-semibold">{log.method}</span>
                <span className="text-slate-400">{log.endpoint}</span>
                {log.status && (
                  <span className={log.status >= 400 ? 'text-red-400' : 'text-green-400'}>
                    {log.status}
                  </span>
                )}
              </div>

              {/* Expanded Details */}
              {expandedLog === idx && (
                <div className="mt-3 space-y-2 pt-3 border-t border-slate-700">
                  {log.requestBody && (
                    <div>
                      <div className="text-slate-400 font-bold mb-1">Request Body:</div>
                      <div className="bg-slate-950 p-2 rounded text-xs max-h-32 overflow-y-auto">
                        <pre className="whitespace-pre-wrap break-words">{JSON.stringify(log.requestBody, null, 2)}</pre>
                      </div>
                    </div>
                  )}

                  {log.responseBody && (
                    <div>
                      <div className="text-slate-400 font-bold mb-1">Response Body:</div>
                      <div className="bg-slate-950 p-2 rounded text-xs max-h-32 overflow-y-auto">
                        <pre className="whitespace-pre-wrap break-words">{JSON.stringify(log.responseBody, null, 2)}</pre>
                      </div>
                    </div>
                  )}

                  {log.error && (
                    <div>
                      <div className="text-red-400 font-bold mb-1">Error Message:</div>
                      <div className="bg-slate-950 p-2 rounded text-xs">{log.error}</div>
                    </div>
                  )}

                  {log.responseBody?.details && (
                    <div>
                      <div className="text-yellow-400 font-bold mb-1">Details:</div>
                      <div className="bg-slate-950 p-2 rounded text-xs max-h-40 overflow-y-auto">
                        <pre className="whitespace-pre-wrap break-words text-yellow-300">
                          {typeof log.responseBody.details === 'object'
                            ? JSON.stringify(log.responseBody.details, null, 2)
                            : String(log.responseBody.details)}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
