'use client';

import React, { useState, useEffect } from 'react';
import {
  fetchRestrictions,
  createRestriction,
  updateRestriction,
  deleteRestrictions,
} from '@/lib/rates-availability/api-client';
import { Restriction, RESTRICTION_TYPE_LABELS } from '@/lib/rates-availability/types';
import { Trash2, Plus, Edit2 } from 'lucide-react';

interface RestrictionsManagerProps {
  propertyId: string;
  roomTypeId?: string;
  roomId?: string;
}

export function RestrictionsManager({
  propertyId,
  roomTypeId,
  roomId,
}: RestrictionsManagerProps) {
  const [restrictions, setRestrictions] = useState<Restriction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    restrictionType: 'min_nights',
    value: 1,
    discountPercentage: 0,
  });

  useEffect(() => {
    loadRestrictions();
  }, [propertyId]);

  const loadRestrictions = async () => {
    try {
      setLoading(true);
      const data = await fetchRestrictions(propertyId);
      setRestrictions(data);
    } catch (error) {
      console.error('Failed to load restrictions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      if (editingId) {
        await updateRestriction(editingId, formData);
      } else {
        await createRestriction(propertyId, {
          ...formData,
          roomTypeId,
          roomId,
          appliedAtLevel: roomId ? 'room' : (roomTypeId ? 'room_type' : 'property'),
        });
      }
      loadRestrictions();
      setShowForm(false);
      setEditingId(null);
      setFormData({
        name: '',
        restrictionType: 'min_nights',
        value: 1,
        discountPercentage: 0,
      });
    } catch (error) {
      console.error('Failed to save restriction:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this restriction?')) return;
    try {
      await deleteRestrictions([id]);
      loadRestrictions();
    } catch (error) {
      console.error('Failed to delete restriction:', error);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading restrictions...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-gray-900">Restrictions</h3>
        <button
          onClick={() => {
            setShowForm(true);
            setEditingId(null);
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> New Restriction
        </button>
      </div>

      {showForm && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Weekend 3-night minimum"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select
              value={formData.restrictionType}
              onChange={(e) => setFormData({ ...formData, restrictionType: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {Object.entries(RESTRICTION_TYPE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Value</label>
              <input
                type="number"
                value={formData.value}
                onChange={(e) => setFormData({ ...formData, value: parseInt(e.target.value) || 0 })}
                min="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Discount %</label>
              <input
                type="number"
                value={formData.discountPercentage}
                onChange={(e) => setFormData({ ...formData, discountPercentage: parseFloat(e.target.value) || 0 })}
                min="0"
                max="100"
                step="0.01"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              {editingId ? 'Update' : 'Create'}
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {restrictions.map(restriction => (
          <div key={restriction.id} className="bg-gray-50 border border-gray-200 rounded-lg p-4 flex items-center justify-between">
            <div>
              <h4 className="font-semibold text-gray-900">{restriction.name}</h4>
              <p className="text-sm text-gray-600">
                {RESTRICTION_TYPE_LABELS[restriction.restriction_type as keyof typeof RESTRICTION_TYPE_LABELS]}
                {restriction.value && ` • Value: ${restriction.value}`}
                {restriction.discount_percentage && ` • Discount: ${restriction.discount_percentage}%`}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleDelete(restriction.id)}
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
