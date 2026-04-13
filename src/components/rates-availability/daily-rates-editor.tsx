'use client';

import React, { useState, useEffect } from 'react';
import { fetchDailyRates, createOrUpdateDailyRates, deleteDailyRates } from '@/lib/rates-availability/api-client';
import { formatDate, generateDateRange } from '@/lib/rates-availability/calendar-utils';
import { DailyRate } from '@/lib/rates-availability/types';
import { Trash2, Plus } from 'lucide-react';

interface DailyRatesEditorProps {
  propertyId: string;
  ratePlanId: string;
  startDate: Date;
  endDate: Date;
  roomTypeId?: string;
  roomId?: string;
}

export function DailyRatesEditor({
  propertyId,
  ratePlanId,
  startDate,
  endDate,
  roomTypeId,
  roomId,
}: DailyRatesEditorProps) {
  const [rates, setRates] = useState<DailyRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [basePrice, setBasePrice] = useState('0');
  const [occupancyPrice, setOccupancyPrice] = useState('0');

  useEffect(() => {
    loadRates();
  }, [propertyId, ratePlanId, startDate, endDate]);

  const loadRates = async () => {
    try {
      setLoading(true);
      const data = await fetchDailyRates(
        propertyId,
        formatDate(startDate),
        formatDate(endDate),
        { roomTypeId, roomId, ratePlanId }
      );
      setRates(data);
    } catch (error) {
      console.error('Failed to load rates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBulkFill = async () => {
    const dates = generateDateRange(startDate, endDate);
    const newRates = dates.map(date => ({
      date: formatDate(date),
      basePrice: parseFloat(basePrice),
      occupancyPrice: parseFloat(occupancyPrice),
      roomTypeId,
      roomId,
      appliedAtLevel: roomId ? 'room' : (roomTypeId ? 'room_type' : 'property'),
    }));

    try {
      await createOrUpdateDailyRates(propertyId, ratePlanId, newRates);
      loadRates();
    } catch (error) {
      console.error('Failed to create rates:', error);
    }
  };

  const handleDelete = async (rateIds: string[]) => {
    try {
      await deleteDailyRates(rateIds);
      loadRates();
    } catch (error) {
      console.error('Failed to delete rates:', error);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading rates...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-gray-900 mb-3">Bulk Fill Rates</h3>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Base Price</label>
            <input
              type="number"
              value={basePrice}
              onChange={(e) => setBasePrice(e.target.value)}
              step="0.01"
              min="0"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Price per Extra Guest</label>
            <input
              type="number"
              value={occupancyPrice}
              onChange={(e) => setOccupancyPrice(e.target.value)}
              step="0.01"
              min="0"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={handleBulkFill}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" /> Fill All Dates
            </button>
          </div>
        </div>
      </div>

      {/* Rates Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-100 border-b border-gray-200">
              <th className="px-3 py-2 text-left font-semibold text-gray-700">Date</th>
              <th className="px-3 py-2 text-right font-semibold text-gray-700">Base Price</th>
              <th className="px-3 py-2 text-right font-semibold text-gray-700">Extra Guest</th>
              <th className="px-3 py-2 text-center font-semibold text-gray-700">Action</th>
            </tr>
          </thead>
          <tbody>
            {rates.map(rate => (
              <tr key={rate.id} className="border-b border-gray-200 hover:bg-gray-50">
                <td className="px-3 py-2 text-gray-900">{rate.date}</td>
                <td className="px-3 py-2 text-right text-gray-900 font-semibold">${rate.base_price.toFixed(2)}</td>
                <td className="px-3 py-2 text-right text-gray-900">${rate.occupancy_price.toFixed(2)}</td>
                <td className="px-3 py-2 text-center">
                  <button
                    onClick={() => handleDelete([rate.id])}
                    className="inline-flex p-1 hover:bg-red-100 rounded transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rates.length === 0 && (
        <div className="text-center py-8 bg-gray-50 rounded-lg">
          <p className="text-gray-500">No rates set for this period. Use bulk fill to create them.</p>
        </div>
      )}
    </div>
  );
}
