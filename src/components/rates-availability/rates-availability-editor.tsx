'use client';

import React, { useState, useEffect } from 'react';
import { ScopeSelector } from './scope-selector';
import { CalendarGrid } from './calendar-grid';
import { QuickActions } from './quick-actions';
import { AvailabilityEditor } from './availability-editor';
import { RatePlansManager } from './rate-plans-manager';
import { DailyRatesEditor } from './daily-rates-editor';
import { RestrictionsManager } from './restrictions-manager';
import { PatternsManager } from './patterns-manager';
import { SeasonsManager } from './seasons-manager';
import {
  fetchAvailability,
  createOrUpdateAvailability,
  updateAvailability,
  fillCalendar,
} from '@/lib/rates-availability/api-client';
import { AvailabilityEntry } from '@/lib/rates-availability/types';
import { generateDateRange, formatDate } from '@/lib/rates-availability/calendar-utils';

interface RatesAvailabilityEditorProps {
  propertyId: string;
}

type TabType = 'calendar' | 'rates' | 'restrictions' | 'patterns' | 'seasons';

export function RatesAvailabilityEditor({ propertyId }: RatesAvailabilityEditorProps) {
  const [currentTab, setCurrentTab] = useState<TabType>('calendar');
  const [scope, setScope] = useState({
    level: 'property' as 'property' | 'room_type' | 'room',
    propertyId,
  });
  const [month, setMonth] = useState(new Date().getMonth());
  const [year, setYear] = useState(new Date().getFullYear());
  const [availability, setAvailability] = useState<AvailabilityEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<{ date: Date; availability?: AvailabilityEntry } | null>(null);
  const [selectedDateRange, setSelectedDateRange] = useState<[Date, Date] | null>(null);
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);

  useEffect(() => {
    loadAvailability();
  }, [month, year, scope]);

  const loadAvailability = async () => {
    try {
      setLoading(true);
      const startDate = new Date(year, month, 1);
      const endDate = new Date(year, month + 1, 0);
      const data = await fetchAvailability(
        propertyId,
        formatDate(startDate),
        formatDate(endDate),
        {
          roomTypeId: scope.level === 'room_type' || scope.level === 'room' ? (scope as any).roomTypeId : undefined,
          roomId: scope.level === 'room' ? (scope as any).roomId : undefined,
        }
      );
      setAvailability(data);
    } catch (error) {
      console.error('Failed to load availability:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMonthChange = (m: number, y: number) => {
    setMonth(m);
    setYear(y);
  };

  const handleScopeChange = (newScope: any) => {
    setScope(newScope);
    setSelectedDates([]);
  };

  const handleDateSelected = (date: Date, avail?: AvailabilityEntry) => {
    setSelectedDate({ date, availability: avail });
  };

  const handleDateRangeSelected = (startDate: Date, endDate: Date) => {
    const dates = generateDateRange(startDate, endDate);
    setSelectedDateRange([startDate, endDate]);
    setSelectedDates(dates);
  };

  const handleApplyStatus = async (status: string) => {
    if (!selectedDates.length) {
      alert('Please select dates first');
      return;
    }

    try {
      setLoading(true);
      const updates = selectedDates.map(date => ({
        date: formatDate(date),
        status,
      }));

      await createOrUpdateAvailability(propertyId, updates);
      loadAvailability();
      setSelectedDates([]);
    } catch (error) {
      console.error('Failed to apply status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAvailability = async (data: any) => {
    if (!selectedDate?.availability) return;

    try {
      const availability = selectedDate.availability;
      const availabilityData = {
        date: availability.date || formatDate(selectedDate.date),
        status: data.status,
        minNights: data.minNights,
        maxNights: data.maxNights,
        occupancy: data.occupancy,
        notes: data.notes,
        roomId: availability.room_id || availability.roomId,
        roomTypeId: availability.room_type_id || availability.roomTypeId,
        appliedAtLevel: availability.applied_at_level || 'property',
      };

      // If availability has an ID, update it; otherwise create it
      if (availability.id) {
        await updateAvailability(availability.id, data);
      } else {
        // Create new availability entry
        await createOrUpdateAvailability(propertyId, [availabilityData]);
      }
      
      loadAvailability();
    } catch (error) {
      console.error('Failed to save availability:', error);
      alert(`Failed to save: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleApplyPattern = async (patternId: string) => {
    if (!selectedDateRange) {
      alert('Please select a date range first');
      return;
    }

    try {
      setLoading(true);
      // Implementation would call applyPattern from api-client
      loadAvailability();
    } catch (error) {
      console.error('Failed to apply pattern:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Scope Selector */}
      <ScopeSelector
        propertyId={propertyId}
        currentScope={scope}
        onScopeChange={handleScopeChange}
      />

      {/* Quick Actions */}
      {currentTab === 'calendar' && (
        <QuickActions
          onApplyStatus={handleApplyStatus}
          onOpenSettings={() => setCurrentTab('rates')}
          onOpenPatterns={() => setCurrentTab('patterns')}
          loading={loading}
        />
      )}

      {/* Tab Navigation */}
      <div className="bg-white border-b border-gray-200 px-6">
        <div className="flex gap-8">
          {(['calendar', 'rates', 'restrictions', 'patterns', 'seasons'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setCurrentTab(tab)}
              className={`py-4 font-medium transition-colors border-b-2 ${
                currentTab === tab
                  ? 'text-blue-600 border-blue-600'
                  : 'text-gray-600 border-transparent hover:text-gray-900'
              }`}
            >
              {tab === 'calendar' && '📅 Calendar'}
              {tab === 'rates' && '💰 Rates'}
              {tab === 'restrictions' && '🚫 Restrictions'}
              {tab === 'patterns' && '🔄 Patterns'}
              {tab === 'seasons' && '🌡️ Seasons'}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="px-6 py-4">
        {currentTab === 'calendar' && (
          <CalendarGrid
            propertyId={propertyId}
            month={month}
            year={year}
            onMonthChange={handleMonthChange}
            availability={availability}
            onDateSelected={handleDateSelected}
            onDateRangeSelected={handleDateRangeSelected}
            selectedDates={selectedDates}
            loading={loading}
          />
        )}

        {currentTab === 'rates' && (
          <RatePlansManager propertyId={propertyId} />
        )}

        {currentTab === 'restrictions' && (
          <RestrictionsManager
            propertyId={propertyId}
            roomTypeId={(scope as any).roomTypeId}
            roomId={(scope as any).roomId}
          />
        )}

        {currentTab === 'patterns' && (
          <PatternsManager
            propertyId={propertyId}
            roomTypeId={(scope as any).roomTypeId}
            roomId={(scope as any).roomId}
            onApplyPattern={handleApplyPattern}
          />
        )}

        {currentTab === 'seasons' && (
          <SeasonsManager propertyId={propertyId} />
        )}
      </div>

      {/* Availability Editor Modal */}
      {selectedDate && (
        <AvailabilityEditor
          availability={selectedDate.availability || null}
          onSave={handleSaveAvailability}
          onClose={() => setSelectedDate(null)}
          loading={loading}
        />
      )}
    </div>
  );
}
