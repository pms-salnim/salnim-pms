'use client';

import React, { useState, useEffect } from 'react';
import {
  fetchSeasons,
  createSeason,
  updateSeason,
  deleteSeasons,
} from '@/lib/rates-availability/api-client';
import { Season } from '@/lib/rates-availability/types';
import { Trash2, Plus, Edit2 } from 'lucide-react';

interface SeasonsManagerProps {
  propertyId: string;
}

export function SeasonsManager({ propertyId }: SeasonsManagerProps) {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    seasonStart: '',
    seasonEnd: '',
    priceModifier: 100,
    color: '#FF6B6B',
  });

  useEffect(() => {
    loadSeasons();
  }, [propertyId]);

  const loadSeasons = async () => {
    try {
      setLoading(true);
      const data = await fetchSeasons(propertyId);
      setSeasons(data);
    } catch (error) {
      console.error('Failed to load seasons:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      if (editingId) {
        await updateSeason(editingId, formData);
      } else {
        await createSeason(propertyId, formData);
      }
      loadSeasons();
      setShowForm(false);
      setEditingId(null);
      setFormData({
        name: '',
        seasonStart: '',
        seasonEnd: '',
        priceModifier: 100,
        color: '#FF6B6B',
      });
    } catch (error) {
      console.error('Failed to save season:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this season?')) return;
    try {
      await deleteSeasons([id]);
      loadSeasons();
    } catch (error) {
      console.error('Failed to delete season:', error);
    }
  };

  const handleEdit = (season: Season) => {
    setEditingId(season.id);
    setFormData({
      name: season.name,
      seasonStart: season.season_start,
      seasonEnd: season.season_end,
      priceModifier: season.price_modifier,
      color: season.color || '#FF6B6B',
    });
    setShowForm(true);
  };

  if (loading) {
    return <div className="text-center py-8">Loading seasons...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-gray-900">Seasonal Pricing</h3>
        <button
          onClick={() => {
            setShowForm(true);
            setEditingId(null);
          }}
          className="px-4 py-2 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> New Season
        </button>
      </div>

      {showForm && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Summer Peak, Holiday Season"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input
                type="date"
                value={formData.seasonStart}
                onChange={(e) => setFormData({ ...formData, seasonStart: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input
                type="date"
                value={formData.seasonEnd}
                onChange={(e) => setFormData({ ...formData, seasonEnd: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Price Modifier (%)</label>
              <input
                type="number"
                value={formData.priceModifier}
                onChange={(e) => setFormData({ ...formData, priceModifier: parseFloat(e.target.value) || 100 })}
                step="5"
                min="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
              <p className="text-xs text-gray-500 mt-1">100 = normal price | 150 = 50% increase | 50 = 50% discount</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
              <div className="flex gap-2 items-center">
                <input
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="w-12 h-10 rounded cursor-pointer"
                />
                <span className="text-sm text-gray-600">{formData.color}</span>
              </div>
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
              className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 transition-colors"
            >
              {editingId ? 'Update' : 'Create'}
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {seasons.map(season => (
          <div key={season.id} className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3 flex-1">
                <div
                  className="w-8 h-8 rounded"
                  style={{ backgroundColor: season.color || '#FF6B6B' }}
                />
                <div>
                  <h4 className="font-semibold text-gray-900">{season.name}</h4>
                  <p className="text-sm text-gray-600">
                    {season.season_start} to {season.season_end} • {season.price_modifier > 100 ? '+' : ''}{season.price_modifier - 100}%
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleEdit(season)}
                  className="p-2 hover:bg-orange-100 rounded-lg transition-colors"
                >
                  <Edit2 className="w-4 h-4 text-orange-600" />
                </button>
                <button
                  onClick={() => handleDelete(season.id)}
                  className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4 text-red-600" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
