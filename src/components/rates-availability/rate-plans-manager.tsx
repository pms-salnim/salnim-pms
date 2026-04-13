'use client';

import React, { useState, useEffect } from 'react';
import { fetchRatePlans, createRatePlan, updateRatePlan, deleteRatePlan } from '@/lib/rates-availability/api-client';
import { RatePlan } from '@/lib/rates-availability/types';
import { Trash2, Plus, Edit2 } from 'lucide-react';

interface RatePlansManagerProps {
  propertyId: string;
}

export function RatePlansManager({ propertyId }: RatePlansManagerProps) {
  const [ratePlans, setRatePlans] = useState<RatePlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    isDefault: false,
    cancellationPolicy: 'flexible',
    nonRefundable: false,
  });

  useEffect(() => {
    loadRatePlans();
  }, [propertyId]);

  const loadRatePlans = async () => {
    try {
      setLoading(true);
      const data = await fetchRatePlans(propertyId);
      setRatePlans(data);
    } catch (error) {
      console.error('Failed to load rate plans:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      if (editingId) {
        await updateRatePlan(propertyId, editingId, formData);
      } else {
        await createRatePlan(propertyId, formData);
      }
      loadRatePlans();
      setShowForm(false);
      setEditingId(null);
      setFormData({
        name: '',
        description: '',
        isDefault: false,
        cancellationPolicy: 'flexible',
        nonRefundable: false,
      });
    } catch (error) {
      console.error('Failed to save rate plan:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this rate plan?')) return;
    try {
      await deleteRatePlan(id);
      loadRatePlans();
    } catch (error) {
      console.error('Failed to delete rate plan:', error);
    }
  };

  const handleEdit = (plan: RatePlan) => {
    setEditingId(plan.id);
    setFormData({
      name: plan.name,
      description: plan.description || '',
      isDefault: plan.is_default,
      cancellationPolicy: plan.cancellation_policy || 'flexible',
      nonRefundable: plan.non_refundable,
    });
    setShowForm(true);
  };

  if (loading) {
    return <div className="text-center py-8">Loading rate plans...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-gray-900">Rate Plans</h3>
        <button
          onClick={() => {
            setShowForm(true);
            setEditingId(null);
            setFormData({
              name: '',
              description: '',
              isDefault: false,
              cancellationPolicy: 'flexible',
              nonRefundable: false,
            });
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> New Plan
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Standard, Member, Non-cancellable"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cancellation Policy</label>
              <select
                value={formData.cancellationPolicy}
                onChange={(e) => setFormData({ ...formData, cancellationPolicy: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="flexible">Flexible</option>
                <option value="moderate">Moderate</option>
                <option value="strict">Strict</option>
              </select>
            </div>

            <div className="flex items-end gap-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isDefault}
                  onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                  className="w-4 h-4 rounded"
                />
                <span className="text-sm font-medium text-gray-700">Set as default</span>
              </label>
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.nonRefundable}
              onChange={(e) => setFormData({ ...formData, nonRefundable: e.target.checked })}
              className="w-4 h-4 rounded"
            />
            <span className="text-sm font-medium text-gray-700">Non-refundable rate</span>
          </label>

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

      {/* List */}
      <div className="space-y-2">
        {ratePlans.map(plan => (
          <div key={plan.id} className="bg-gray-50 border border-gray-200 rounded-lg p-4 flex items-center justify-between">
            <div>
              <h4 className="font-semibold text-gray-900">{plan.name}</h4>
              {plan.description && <p className="text-sm text-gray-600">{plan.description}</p>}
              <div className="flex gap-2 mt-2 text-xs">
                {plan.is_default && <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded">Default</span>}
                {plan.non_refundable && <span className="bg-red-100 text-red-700 px-2 py-1 rounded">Non-refundable</span>}
                <span className="bg-gray-200 text-gray-700 px-2 py-1 rounded">{plan.cancellation_policy}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleEdit(plan)}
                className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
              >
                <Edit2 className="w-4 h-4 text-gray-600" />
              </button>
              <button
                onClick={() => handleDelete(plan.id)}
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
