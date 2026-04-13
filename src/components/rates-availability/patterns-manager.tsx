'use client';

import React, { useState, useEffect } from 'react';
import {
  fetchRecurringPatterns,
  createRecurringPattern,
  updateRecurringPattern,
  deleteRecurringPatterns,
} from '@/lib/rates-availability/api-client';
import { RecurringPattern, DAYS_OF_WEEK_FULL } from '@/lib/rates-availability/types';
import { Trash2, Plus, Play } from 'lucide-react';

interface PatternsManagerProps {
  propertyId: string;
  roomTypeId?: string;
  roomId?: string;
  onApplyPattern?: (patternId: string) => void;
}

export function PatternsManager({
  propertyId,
  roomTypeId,
  roomId,
  onApplyPattern,
}: PatternsManagerProps) {
  const [patterns, setPatterns] = useState<RecurringPattern[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    patternType: 'weekly',
    daysOfWeek: [] as string[],
    minNights: 1,
    maxNights: null as number | null,
  });

  useEffect(() => {
    loadPatterns();
  }, [propertyId]);

  const loadPatterns = async () => {
    try {
      setLoading(true);
      const data = await fetchRecurringPatterns(propertyId);
      setPatterns(data);
    } catch (error) {
      console.error('Failed to load patterns:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      await createRecurringPattern(propertyId, {
        ...formData,
        roomTypeId,
        roomId,
        appliedAtLevel: roomId ? 'room' : (roomTypeId ? 'room_type' : 'property'),
      });
      loadPatterns();
      setShowForm(false);
      setFormData({
        name: '',
        patternType: 'weekly',
        daysOfWeek: [],
        minNights: 1,
        maxNights: null,
      });
    } catch (error) {
      console.error('Failed to save pattern:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this pattern?')) return;
    try {
      await deleteRecurringPatterns([id]);
      loadPatterns();
    } catch (error) {
      console.error('Failed to delete pattern:', error);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading patterns...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-gray-900">Recurring Patterns</h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> New Pattern
        </button>
      </div>

      {showForm && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Weekends require 3 nights"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Days of Week</label>
            <div className="grid grid-cols-4 gap-2">
              {DAYS_OF_WEEK_FULL.map((day, idx) => (
                <label key={day} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.daysOfWeek.includes(['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][idx])}
                    onChange={(e) => {
                      const dayCode = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][idx];
                      if (e.target.checked) {
                        setFormData({
                          ...formData,
                          daysOfWeek: [...formData.daysOfWeek, dayCode],
                        });
                      } else {
                        setFormData({
                          ...formData,
                          daysOfWeek: formData.daysOfWeek.filter(d => d !== dayCode),
                        });
                      }
                    }}
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-sm text-gray-700">{day.slice(0, 3)}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Min Nights</label>
              <input
                type="number"
                value={formData.minNights}
                onChange={(e) => setFormData({ ...formData, minNights: parseInt(e.target.value) || 1 })}
                min="1"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Max Nights</label>
              <input
                type="number"
                value={formData.maxNights || ''}
                onChange={(e) => setFormData({ ...formData, maxNights: e.target.value ? parseInt(e.target.value) : null })}
                min="1"
                placeholder="Unlimited"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setShowForm(false)}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors"
            >
              Create
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {patterns.map(pattern => (
          <div key={pattern.id} className="bg-purple-50 border border-purple-200 rounded-lg p-4 flex items-center justify-between">
            <div>
              <h4 className="font-semibold text-gray-900">{pattern.name}</h4>
              <p className="text-sm text-gray-600">
                {pattern.days_of_week?.join(', ')} • Min: {pattern.min_nights}
                {pattern.max_nights && ` / Max: ${pattern.max_nights}`}
              </p>
            </div>
            <div className="flex gap-2">
              {onApplyPattern && (
                <button
                  onClick={() => onApplyPattern(pattern.id)}
                  className="p-2 hover:bg-purple-100 rounded-lg transition-colors"
                  title="Apply pattern"
                >
                  <Play className="w-4 h-4 text-purple-600" />
                </button>
              )}
              <button
                onClick={() => handleDelete(pattern.id)}
                className="p-2 hover:bg-red-100 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4 text-red-600" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
