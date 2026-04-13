'use client';

import React, { useState } from 'react';
import { STATUS_LABELS, STATUS_COLORS } from '@/lib/rates-availability/types';
import { ChevronDown } from 'lucide-react';

interface QuickActionsProps {
  onApplyStatus: (status: string) => void;
  onOpenSettings: () => void;
  onOpenPatterns: () => void;
  loading?: boolean;
}

export function QuickActions({
  onApplyStatus,
  onOpenSettings,
  onOpenPatterns,
  loading = false,
}: QuickActionsProps) {
  const [showMenu, setShowMenu] = useState(false);

  const statuses = [
    { key: 'available', label: STATUS_LABELS.available, color: STATUS_COLORS.available },
    { key: 'not_available', label: STATUS_LABELS.not_available, color: STATUS_COLORS.not_available },
    { key: 'closed_to_arrival', label: STATUS_LABELS.closed_to_arrival, color: STATUS_COLORS.closed_to_arrival },
    { key: 'closed_to_departure', label: STATUS_LABELS.closed_to_departure, color: STATUS_COLORS.closed_to_departure },
    { key: 'on_request', label: STATUS_LABELS.on_request, color: STATUS_COLORS.on_request },
  ];

  return (
    <div className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center gap-3 flex-wrap">
        {/* Availability Status Quick Buttons */}
        <div className="flex gap-2">
          {statuses.slice(0, 3).map(({ key, label, color }) => (
            <button
              key={key}
              onClick={() => onApplyStatus(key)}
              disabled={loading}
              className="px-3 py-2 rounded-lg font-medium text-sm transition-all hover:shadow-md disabled:opacity-50"
              style={{
                backgroundColor: color,
                color: 'white',
              }}
              title={label}
            >
              {label}
            </button>
          ))}
        </div>

        {/* More Options Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            disabled={loading}
            className="px-3 py-2 rounded-lg font-medium text-sm bg-gray-100 hover:bg-gray-200 transition-colors flex items-center gap-1 disabled:opacity-50"
          >
            More <ChevronDown className="w-4 h-4" />
          </button>
          
          {showMenu && (
            <div className="absolute top-full mt-1 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-[200px]">
              {statuses.slice(3).map(({ key, label, color }) => (
                <button
                  key={key}
                  onClick={() => {
                    onApplyStatus(key);
                    setShowMenu(false);
                  }}
                  className="w-full text-left px-4 py-2 hover:bg-gray-50 transition-colors flex items-center gap-2"
                >
                  <div className="w-3 h-3 rounded" style={{ backgroundColor: color }} />
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Settings & Patterns */}
        <div className="ml-auto flex gap-2">
          <button
            onClick={onOpenSettings}
            disabled={loading}
            className="px-4 py-2 rounded-lg font-medium text-sm bg-gray-100 hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            ⚙️ Settings
          </button>
          
          <button
            onClick={onOpenPatterns}
            disabled={loading}
            className="px-4 py-2 rounded-lg font-medium text-sm bg-purple-100 text-purple-700 hover:bg-purple-200 transition-colors disabled:opacity-50"
          >
            🔄 Patterns
          </button>
        </div>
      </div>
    </div>
  );
}
