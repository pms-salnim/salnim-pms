'use client';

import React from 'react';
import { AlertCircle, CheckCircle, X } from 'lucide-react';

interface UpdateData {
  totalCells: number;
  uniqueRooms: number;
  uniqueDates: number;
  availabilityLabel: string;
  availabilityColor: string;
  stopSellReason?: string;
  roomsList: string[];
  datesList: string[];
  roomDateRanges?: Record<string, string[]>;
}

interface UpdatePreviewModalProps {
  isOpen: boolean;
  updateData: UpdateData | null;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function UpdatePreviewModal({
  isOpen,
  updateData,
  onConfirm,
  onCancel,
  isLoading = false,
}: UpdatePreviewModalProps) {
  if (!isOpen || !updateData) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-50 to-blue-100 px-6 py-4 border-b border-blue-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-bold text-slate-900">Review Update</h2>
          </div>
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="text-slate-400 hover:text-slate-600 disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-6 space-y-6">
          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
              <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Cells</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{updateData.totalCells}</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
              <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Rooms</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{updateData.uniqueRooms}</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
              <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Dates</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{updateData.uniqueDates}</p>
            </div>
          </div>

          {/* Availability Status */}
          <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">Status to Apply</p>
            <div className="flex items-center gap-3">
              <div
                className="w-6 h-6 rounded"
                style={{ backgroundColor: updateData.availabilityColor, opacity: 0.3 }}
              />
              <span className="text-lg font-bold text-slate-900">{updateData.availabilityLabel}</span>
            </div>
            {updateData.stopSellReason && (
              <p className="text-sm text-slate-600 mt-2">
                <span className="font-semibold">Reason:</span> {updateData.stopSellReason}
              </p>
            )}
          </div>

          {/* Rooms List */}
          <div>
            <p className="text-sm font-semibold text-slate-900 mb-3">Affected Rooms & Dates</p>
            <div className="space-y-3">
              {updateData.roomDateRanges ? (
                // Show rooms with their date ranges
                Object.entries(updateData.roomDateRanges).map(([roomLabel, dateRanges]) => (
                  <div key={roomLabel} className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                    <p className="text-sm font-semibold text-slate-900">{roomLabel}</p>
                    <div className="mt-2 space-y-1">
                      {dateRanges.map((range, idx) => (
                        <p key={idx} className="text-xs text-slate-600 break-words">{range}</p>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                // Fallback to simple room list
                <div className="grid grid-cols-2 gap-2">
                  {updateData.roomsList.map((room, idx) => (
                    <div
                      key={idx}
                      className="text-sm bg-slate-50 rounded px-3 py-2 border border-slate-200 text-slate-700"
                    >
                      {room}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Dates List - Only show if not using room-by-room view */}
          {!updateData.roomDateRanges && (
            <div>
              <p className="text-sm font-semibold text-slate-900 mb-2">Affected Dates</p>
              <div className="grid grid-cols-3 gap-2">
                {updateData.datesList.map((date, idx) => (
                  <div
                    key={idx}
                    className="text-xs bg-slate-50 rounded px-2 py-2 border border-slate-200 text-slate-700 text-center"
                  >
                    {date}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Warning */}
          <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
            <p className="text-sm text-amber-900">
              <span className="font-semibold">⚠️ This action will update:</span>
              <br />
              {updateData.totalCells} cells across {updateData.uniqueRooms} room(s) and {updateData.uniqueDates} date(s). This may affect existing reservations and availability on connected channels.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-slate-50 px-6 py-4 border-t border-slate-200 flex gap-3 justify-end">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="px-6 py-2.5 bg-white border border-slate-300 text-slate-700 rounded-lg font-semibold hover:bg-slate-50 transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition flex items-center gap-2 disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Updating...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                Confirm Update
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
