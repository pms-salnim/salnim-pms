'use client';

import React, { useState } from 'react';
import { STATUS_LABELS, AvailabilityEntry } from '@/lib/rates-availability/types';
import { X } from 'lucide-react';

interface AvailabilityEditorProps {
  availability: AvailabilityEntry | null;
  onSave: (data: any) => Promise<void>;
  onClose: () => void;
  loading?: boolean;
}

export function AvailabilityEditor({
  availability,
  onSave,
  onClose,
  loading = false,
}: AvailabilityEditorProps) {
  const [status, setStatus] = useState(availability?.status || 'available');
  const [minNights, setMinNights] = useState(availability?.min_nights || 1);
  const [maxNights, setMaxNights] = useState(availability?.max_nights || '');
  const [occupancy, setOccupancy] = useState(availability?.occupancy || 1);
  const [notes, setNotes] = useState(availability?.notes || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        status,
        minNights,
        maxNights: maxNights ? parseInt(maxNights) : null,
        occupancy,
        notes,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  if (!availability) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-2xl max-w-md w-full mx-4">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h3 className="text-lg font-bold text-gray-900">
            Edit Availability: {availability.date}
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Availability Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {Object.entries(STATUS_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          {/* Min Nights */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Minimum Nights Required
            </label>
            <input
              type="number"
              value={minNights}
              onChange={(e) => setMinNights(parseInt(e.target.value) || 1)}
              min="1"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Max Nights */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Maximum Nights Allowed
            </label>
            <input
              type="number"
              value={maxNights}
              onChange={(e) => setMaxNights(e.target.value)}
              min="1"
              placeholder="Unlimited"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Minimum Occupancy */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Minimum Occupancy (guests)
            </label>
            <input
              type="number"
              value={occupancy}
              onChange={(e) => setOccupancy(parseInt(e.target.value) || 1)}
              min="1"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Internal notes about this date..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex gap-2 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
