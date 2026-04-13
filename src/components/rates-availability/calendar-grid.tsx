'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Settings2,
  Calendar as CalendarIcon,
  Lock,
  Unlock,
  Zap,
  Filter,
  Save,
  Plus,
  Info,
  ChevronDown,
  ChevronUp,
  CreditCard,
  Tag
} from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { fetchAvailability, fetchDailyRates, fetchRatePlans, createOrUpdateAvailability, updateDailyRate } from '@/lib/rates-availability/api-client';
import { formatDate } from '@/lib/rates-availability/calendar-utils';

interface CalendarGridProps {
  month: number;
  year: number;
  onMonthChange: (month: number, year: number) => void;
  availability: any[];
  onDateSelected?: (date: Date, availability?: any) => void;
  onDateRangeSelected?: (startDate: Date, endDate: Date) => void;
  selectedDates?: Date[];
  loading?: boolean;
  propertyId: string;
}

const generateDates = (startDate: Date, days = 14) => {
  const dates = [];
  for (let i = 0; i < days; i++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i);
    dates.push(date);
  }
  return dates;
};

// Initialize Supabase client for auth token
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!
);

export function CalendarGrid({
  propertyId,
  month,
  year,
  onMonthChange,
  availability,
  onDateSelected,
  onDateRangeSelected,
  selectedDates = [],
  loading: externalLoading = false,
}: CalendarGridProps) {
  const [viewDate, setViewDate] = useState(new Date(year, month, 1));
  const [gridData, setGridData] = useState<{ [key: string]: any }>({});
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [expandedRooms, setExpandedRooms] = useState<{ [key: string]: boolean }>({});
  const [roomTypes, setRoomTypes] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [ratePlans, setRatePlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const dates = useMemo(() => generateDates(viewDate, 14), [viewDate]);

  // Load room types, rooms, and rate plans
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);
        console.log('[CalendarGrid] Loading data for propertyId:', propertyId);

        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData.session) {
          throw new Error('Not authenticated');
        }

        const authToken = sessionData.session.access_token;
        const headers = {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        };

        // Fetch room types
        console.log('[CalendarGrid] Fetching room types...');
        const rtResponse = await fetch(
          `/api/rooms/room-types/list?propertyId=${propertyId}`,
          { method: 'GET', headers }
        );

        if (!rtResponse.ok) {
          throw new Error(`Failed to fetch room types: ${rtResponse.status}`);
        }

        const rtData = await rtResponse.json();
        const roomTypesData = rtData.roomTypes || rtData.data || [];
        console.log('[CalendarGrid] Room types loaded:', roomTypesData.length);
        setRoomTypes(roomTypesData);

        // Fetch rooms
        console.log('[CalendarGrid] Fetching rooms...');
        const rResponse = await fetch(
          `/api/rooms/list?propertyId=${propertyId}`,
          { method: 'GET', headers }
        );

        if (!rResponse.ok) {
          throw new Error(`Failed to fetch rooms: ${rResponse.status}`);
        }

        const rData = await rResponse.json();
        const roomsData = rData.rooms || rData.data || [];
        console.log('[CalendarGrid] Rooms loaded:', roomsData.length);
        setRooms(roomsData);

        // Fetch rate plans
        console.log('[CalendarGrid] Fetching rate plans...');
        const rpResponse = await fetch(
          `/api/rate-plans/list?propertyId=${propertyId}`,
          { method: 'GET', headers }
        );

        if (rpResponse.ok) {
          const rpData = await rpResponse.json();
          const ratePlansData = rpData.ratePlans || rpData.data || [];
          console.log('[CalendarGrid] Rate plans loaded:', ratePlansData.length);
          setRatePlans(ratePlansData);
        } else {
          console.warn('[CalendarGrid] Could not fetch rate plans, using empty array');
          setRatePlans([]);
        }

        if (roomTypesData.length === 0) {
          setError('No room types found for this property');
        } else if (roomsData.length === 0) {
          setError('No rooms found for this property');
        }
      } catch (error) {
        console.error('[CalendarGrid] Error loading data:', error);
        setError(`Failed to load data: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } finally {
        setLoading(false);
      }
    };

    if (propertyId) {
      loadData();
    }
  }, [propertyId]);

  // Load availability and rates for the current view
  useEffect(() => {
    const loadGridData = async () => {
      try {
        if (rooms.length === 0 || ratePlans.length === 0) {
          console.log('[CalendarGrid] Skipping grid data load - no rooms or rate plans');
          return;
        }

        console.log('[CalendarGrid] Loading grid data for:', {
          dateRange: `${formatDate(dates[0])} to ${formatDate(dates[dates.length - 1])}`,
          roomsCount: rooms.length,
          ratePlansCount: ratePlans.length,
        });

        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData.session) {
          console.warn('[CalendarGrid] Not authenticated, using mock data');
          initializeMockGridData();
          return;
        }

        const authToken = sessionData.session.access_token;
        const headers = {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        };

        const startDateStr = formatDate(dates[0]);
        const endDateStr = formatDate(dates[dates.length - 1]);

        // Fetch actual daily rates
        console.log('[CalendarGrid] Fetching daily rates...');
        const ratesResponse = await fetch(
          `/api/property-settings/rates-availability/daily-rates?propertyId=${propertyId}&startDate=${startDateStr}&endDate=${endDateStr}`,
          { method: 'GET', headers }
        );

        let ratesData: any[] = [];
        if (ratesResponse.ok) {
          const ratesJson = await ratesResponse.json();
          ratesData = ratesJson.data || [];
          console.log('[CalendarGrid] Rates loaded:', ratesData.length);
        } else {
          console.warn('[CalendarGrid] Could not fetch rates, will use defaults');
        }

        const mock: { [key: string]: any } = {};

        // Initialize room availability with defaults
        rooms.forEach((room: any) => {
          const roomId = room.id;
          dates.forEach(d => {
            const dateStr = formatDate(d);
            const key = `${roomId}-${dateStr}`;
            mock[key] = {
              available: true,
              status: 'available',
              availabilityId: undefined,
            };
          });
        });

        // Initialize rate plan pricing with actual rates from database
        ratePlans.forEach((plan: any) => {
          rooms.forEach((room: any) => {
            const roomId = room.id;
            const planId = plan.id;
            const roomTypeId = room.room_type_id || room.roomTypeId;

            dates.forEach(d => {
              const dateStr = formatDate(d);
              const planKey = `${roomId}-${planId}-${dateStr}`;

              // Find matching rate from database
              let rate: any = ratesData.find(
                r =>
                  r.rate_plan_id === planId &&
                  r.date === dateStr &&
                  (r.room_id === roomId || (!r.room_id && r.room_type_id === roomTypeId))
              );

              // Fallback to room type level rate if room-specific rate not found
              if (!rate) {
                rate = ratesData.find(
                  r =>
                    r.rate_plan_id === planId &&
                    r.date === dateStr &&
                    r.room_type_id === roomTypeId &&
                    !r.room_id
                );
              }

              // Fallback to property level rate if still not found
              if (!rate) {
                rate = ratesData.find(
                  r =>
                    r.rate_plan_id === planId &&
                    r.date === dateStr &&
                    !r.room_id &&
                    !r.room_type_id
                );
              }

              mock[planKey] = {
                rate: rate?.base_price || plan.default_price || 150,
                closed: false,
                rateId: rate?.id,
                basePrice: rate?.base_price,
                occupancyPrice: rate?.occupancy_price || 0,
                appliedAtLevel: rate?.applied_at_level || 'property',
              };
            });
          });
        });

        setGridData(mock);
      } catch (error) {
        console.error('[CalendarGrid] Error loading grid data:', error);
        initializeMockGridData();
      }
    };

    const initializeMockGridData = () => {
      const mock: { [key: string]: any } = {};

      rooms.forEach((room: any) => {
        const roomId = room.id;
        dates.forEach(d => {
          const dateStr = formatDate(d);
          const key = `${roomId}-${dateStr}`;
          mock[key] = {
            available: true,
            status: 'available',
            availabilityId: undefined,
          };
        });
      });

      ratePlans.forEach((plan: any) => {
        rooms.forEach((room: any) => {
          const roomId = room.id;
          const planId = plan.id;
          dates.forEach(d => {
            const dateStr = formatDate(d);
            const planKey = `${roomId}-${planId}-${dateStr}`;
            mock[planKey] = {
              rate: plan.default_price || 150,
              closed: false,
              rateId: undefined,
            };
          });
        });
      });

      setGridData(mock);
    };

    loadGridData();
  }, [propertyId, dates, rooms, ratePlans]);

  const toggleRoom = (roomId: string) => {
    setExpandedRooms(prev => ({ ...prev, [roomId]: !prev[roomId] }));
  };

  const handleDataChange = (key: string, field: string, value: any) => {
    setGridData(prev => ({
      ...prev,
      [key]: { ...prev[key], [field]: value }
    }));
  };

  const navigateDate = (days: number) => {
    const newDate = new Date(viewDate);
    newDate.setDate(viewDate.getDate() + days);
    setViewDate(newDate);
    onMonthChange(newDate.getMonth(), newDate.getFullYear());
  };

  const handleSaveRates = async () => {
    try {
      setLoading(true);
      console.log('[CalendarGrid] Saving rate changes...');

      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        alert('Please log in to save changes');
        return;
      }

      const authToken = sessionData.session.access_token;
      const headers = {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      };

      // Collect all rate changes from gridData
      // Keys are in format: roomId-planId-YYYY-MM-DD
      const ratesByPlan: { [planId: string]: any[] } = {};

      Object.entries(gridData).forEach(([key, data]) => {
        // Skip if not a rate entry or rate is not a number
        if (!data.rate || typeof data.rate === 'undefined') return;

        // Extract room, plan, and date from key
        // Format: roomId-planId-YYYY-MM-DD
        const lastDashIndex = key.lastIndexOf('-');
        const secondLastDashIndex = key.lastIndexOf('-', lastDashIndex - 1);

        if (secondLastDashIndex === -1) return; // Invalid format

        const roomId = key.substring(0, secondLastDashIndex);
        const planId = key.substring(secondLastDashIndex + 1, lastDashIndex);
        const dateStr = key.substring(lastDashIndex + 1);

        if (!ratesByPlan[planId]) {
          ratesByPlan[planId] = [];
        }

        ratesByPlan[planId].push({
          date: dateStr,
          basePrice: parseFloat(data.rate) || 150,
          occupancyPrice: data.occupancyPrice || 0,
          roomId: roomId,
          roomTypeId: undefined,
          appliedAtLevel: 'room',
        });
      });

      // Save rates for each plan
      for (const [planId, rates] of Object.entries(ratesByPlan)) {
        if (rates.length === 0) continue;

        const response = await fetch(
          `/api/property-settings/rates-availability/daily-rates`,
          {
            method: 'POST',
            headers,
            body: JSON.stringify({ propertyId, ratePlanId: planId, rates }),
          }
        );

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || `Failed to save rates for plan ${planId}`);
        }
      }

      console.log('[CalendarGrid] Rates saved successfully');
      alert('Rates updated successfully!');
    } catch (error) {
      console.error('[CalendarGrid] Error saving rates:', error);
      alert(`Failed to save rates: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  // Group rooms by room type
  const roomsByType = useMemo(() => {
    const grouped: { [key: string]: any[] } = {};
    rooms.forEach(room => {
      const typeId = room.room_type_id || room.roomTypeId;
      if (!grouped[typeId]) {
        grouped[typeId] = [];
      }
      grouped[typeId].push(room);
    });
    return grouped;
  }, [rooms]);

  const isLoading = loading || externalLoading;

  if (error && !loading) {
    return (
      <div className="flex flex-col h-full bg-slate-50">
        <header className="bg-white border-b px-6 py-4 flex justify-between items-center shrink-0 shadow-sm">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-blue-600" />
              Inventory & Rate Plans
            </h1>
          </div>
        </header>
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
            <h3 className="text-red-900 font-bold mb-2">Error Loading Data</h3>
            <p className="text-red-800 text-sm mb-4">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col h-full bg-slate-50 font-sans text-slate-900">
        <header className="bg-white border-b px-6 py-4 flex justify-between items-center shrink-0 shadow-sm z-30">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-blue-600" />
              Inventory & Rate Plans
            </h1>
            <p className="text-xs text-slate-500 font-medium">Loading...</p>
          </div>
        </header>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 mb-4 animate-spin">
              <div className="w-8 h-8 rounded-full border-4 border-slate-200 border-t-blue-600"></div>
            </div>
            <p className="text-slate-600 font-medium">Loading rooms and rate plans...</p>
          </div>
        </div>
      </div>
    );
  }

  if (roomTypes.length === 0 || rooms.length === 0) {
    return (
      <div className="flex flex-col h-full bg-slate-50 font-sans text-slate-900">
        <header className="bg-white border-b px-6 py-4 flex justify-between items-center shrink-0 shadow-sm z-30">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-blue-600" />
              Inventory & Rate Plans
            </h1>
          </div>
        </header>
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 max-w-md text-center">
            <h3 className="text-yellow-900 font-bold mb-2">No Rooms Found</h3>
            <p className="text-yellow-800 text-sm">
              Please create room types and rooms for this property before managing rates and availability.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 font-sans text-slate-900">
      <header className="bg-white border-b px-6 py-4 flex justify-between items-center shrink-0 shadow-sm z-30">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-blue-600" />
            Inventory & Rate Plans
          </h1>
          <div className="text-xs text-slate-500 font-medium flex gap-4 mt-1">
            <span>📦 {roomTypes.length} Room Type{roomTypes.length !== 1 ? 's' : ''}</span>
            <span>🏠 {rooms.length} Room{rooms.length !== 1 ? 's' : ''}</span>
            <span>💰 {ratePlans.length} Rate Plan{ratePlans.length !== 1 ? 's' : ''}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center bg-white border rounded-lg overflow-hidden shadow-sm">
            <button onClick={() => navigateDate(-7)} className="p-2 hover:bg-slate-50 border-r transition"><ChevronLeft className="w-4 h-4" /></button>
            <div className="px-4 py-2 text-sm font-bold flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-blue-500" />
              {viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </div>
            <button onClick={() => navigateDate(7)} className="p-2 hover:bg-slate-50 border-l transition"><ChevronRight className="w-4 h-4" /></button>
          </div>

          <button onClick={() => setIsBulkOpen(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-blue-700 transition">
            <Zap className="w-4 h-4" /> Bulk Update
          </button>
          <button 
            onClick={handleSaveRates}
            disabled={loading}
            className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-emerald-700 transition shadow-lg shadow-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" /> {loading ? 'Saving...' : 'Save'}
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-4 lg:p-6">
        <div className="inline-block min-w-full align-middle bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="min-w-full border-collapse">
            <thead>
              <tr className="bg-slate-50/80 backdrop-blur-sm">
                <th className="sticky left-0 z-40 bg-slate-50 border-b border-r p-4 text-left w-72 min-w-[280px] shadow-[2px_0_5px_rgba(0,0,0,0.02)]">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Inventory / Plans</span>
                    <Filter className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                </th>
                {dates.map((date, i) => (
                  <th key={i} className={`border-b border-r p-2 text-center min-w-[110px] ${date.getDay() === 0 || date.getDay() === 6 ? 'bg-blue-50/50' : ''}`}>
                    <div className="text-[10px] uppercase font-bold text-slate-400">
                      {date.toLocaleDateString('en-US', { weekday: 'short' })}
                    </div>
                    <div className="text-sm font-black">
                      {date.getDate()}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {roomsByType && Object.entries(roomsByType).map(([typeId, typeRooms]) => {
                const roomType = roomTypes.find(rt => rt.id === typeId);
                return (
                  <React.Fragment key={typeId}>
                    {/* ROOM TYPE HEADER */}
                    <tr className="bg-slate-100/70">
                      <td className="sticky left-0 z-30 bg-slate-100 border-b border-r p-3 px-4 font-black text-slate-700 text-sm uppercase tracking-tight">
                        {roomType?.name || 'Unknown Room Type'}
                      </td>
                      {dates.map((_, i) => (
                        <td key={i} className="border-b border-r bg-slate-100/30"></td>
                      ))}
                    </tr>

                    {typeRooms.map((room) => (
                      <React.Fragment key={room.id}>
                        {/* UNIT ROW */}
                        <tr className="group">
                          <td className="sticky left-0 z-30 bg-white border-b border-r p-3 pl-6 hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => toggleRoom(room.id)}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="p-1 hover:bg-slate-200 rounded text-slate-400">
                                  {expandedRooms[room.id] ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                </div>
                                <span className="text-sm font-bold text-slate-700">
                                  {room.name || room.number || room.id}
                                </span>
                              </div>
                              <div className={`text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-700`}>
                                AVAILABLE
                              </div>
                            </div>
                          </td>
                          {dates.map((date, i) => {
                            const dateStr = formatDate(date);
                            const key = `${room.id}-${dateStr}`;
                            const cell = gridData[key] || { available: true };
                            return (
                              <td key={i} className={`border-b border-r p-0 text-center ${!cell.available ? 'bg-slate-100/80' : ''}`}>
                                <button
                                  onClick={() => {
                                    handleDataChange(key, 'available', !cell.available);
                                    onDateSelected?.(date, cell);
                                  }}
                                  className={`w-full h-full min-h-[50px] flex items-center justify-center transition ${cell.available ? 'hover:bg-blue-50' : 'hover:bg-slate-200'}`}
                                >
                                  {cell.available ? (
                                    <span className="text-xs font-black text-emerald-600">OPEN</span>
                                  ) : (
                                    <Lock className="w-3.5 h-3.5 text-slate-400" />
                                  )}
                                </button>
                              </td>
                            );
                          })}
                        </tr>

                        {/* RATE PLANS DROPDOWN ROWS */}
                        {expandedRooms[room.id] && ratePlans.map((plan) => (
                          <tr key={plan.id} className="bg-slate-50/40 animate-in slide-in-from-top-2 duration-200">
                            <td className="sticky left-0 z-20 bg-slate-50/90 backdrop-blur-sm border-b border-r p-2.5 pl-14">
                              <div className="flex items-center gap-2 text-slate-500">
                                <Tag className="w-3 h-3" />
                                <span className="text-[11px] font-bold uppercase tracking-tight truncate">{plan.name}</span>
                              </div>
                            </td>
                            {dates.map((date, i) => {
                              const dateStr = formatDate(date);
                              const planKey = `${room.id}-${plan.id}-${dateStr}`;
                              const roomKey = `${room.id}-${dateStr}`;
                              const cell = gridData[planKey] || { rate: 0, closed: false };
                              const roomOpen = gridData[roomKey]?.available ?? true;

                              return (
                                <td key={i} className={`border-b border-r p-0 relative group ${!roomOpen || cell.closed ? 'bg-slate-100/50' : ''}`}>
                                  <div className="flex flex-col h-full min-h-[60px]">
                                    <input
                                      type="number"
                                      disabled={!roomOpen}
                                      value={cell.rate}
                                      onChange={(e) => handleDataChange(planKey, 'rate', e.target.value)}
                                      className={`w-full text-center text-sm font-black p-3 bg-transparent outline-none focus:bg-white focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed ${!roomOpen || cell.closed ? 'text-slate-300' : 'text-slate-800'}`}
                                    />

                                    <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button
                                        onClick={() => handleDataChange(planKey, 'closed', !cell.closed)}
                                        className={`p-1 rounded-md shadow-sm border bg-white ${cell.closed ? 'text-emerald-500' : 'text-rose-500'}`}
                                        title={cell.closed ? "Open Rate Plan" : "Close Rate Plan"}
                                      >
                                        {cell.closed ? <Unlock className="w-2.5 h-2.5" /> : <Lock className="w-2.5 h-2.5" />}
                                      </button>
                                    </div>

                                    {cell.closed && roomOpen && (
                                      <div className="absolute bottom-1 w-full text-center">
                                        <span className="text-[7px] font-black bg-rose-500 text-white px-1.5 py-0.5 rounded uppercase">Stop</span>
                                      </div>
                                    )}
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </React.Fragment>
                    ))}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bulk Update Modal */}
      {isBulkOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden">
            <div className="p-8 border-b bg-gradient-to-r from-blue-50 to-indigo-50 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                  <Zap className="w-6 h-6 text-blue-600" />
                  Smart Bulk Manager
                </h2>
                <p className="text-xs font-bold text-slate-500 mt-1 uppercase tracking-widest">Apply changes across the property</p>
              </div>
              <button onClick={() => setIsBulkOpen(false)} className="bg-white p-2 rounded-full border shadow-sm hover:bg-slate-50">✕</button>
            </div>

            <div className="p-10 space-y-8">
              <div className="grid grid-cols-2 gap-8">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Timeline Start</label>
                  <input type="date" className="w-full border-2 border-slate-100 rounded-2xl p-4 bg-slate-50 outline-none focus:border-blue-500 focus:bg-white transition-all font-bold" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Timeline End</label>
                  <input type="date" className="w-full border-2 border-slate-100 rounded-2xl p-4 bg-slate-50 outline-none focus:border-blue-500 focus:bg-white transition-all font-bold" />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Target Rate Plans</label>
                <div className="flex flex-wrap gap-2">
                  <button className="px-5 py-2.5 rounded-xl border-2 border-blue-600 text-sm font-black text-white bg-blue-600 shadow-lg shadow-blue-100">All Plans</button>
                  <button className="px-5 py-2.5 rounded-xl border-2 border-slate-100 text-sm font-bold text-slate-500 bg-slate-50 hover:border-blue-200 transition">Standard</button>
                  <button className="px-5 py-2.5 rounded-xl border-2 border-slate-100 text-sm font-bold text-slate-500 bg-slate-50 hover:border-blue-200 transition">Non-Refundable</button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-6 pt-6">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">New Rate</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                    <input type="number" className="w-full border-2 border-slate-100 rounded-2xl p-4 pl-8 font-black outline-none focus:border-blue-500" placeholder="0.00" />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Min. Stay</label>
                  <input type="number" className="w-full border-2 border-slate-100 rounded-2xl p-4 font-black outline-none focus:border-blue-500" placeholder="1" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Operation</label>
                  <select className="w-full border-2 border-slate-100 rounded-2xl p-4 font-black outline-none appearance-none bg-white focus:border-blue-500">
                    <option>Set Value</option>
                    <option>Increase %</option>
                    <option>Decrease %</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="p-8 bg-slate-50 border-t flex justify-end gap-4">
              <button onClick={() => setIsBulkOpen(false)} className="px-8 py-3 rounded-2xl font-bold text-slate-500 hover:bg-slate-200 transition">Discard</button>
              <button className="bg-slate-900 text-white px-10 py-3 rounded-2xl font-black shadow-xl hover:bg-black transition transform active:scale-95">
                Apply to Selection
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="bg-white border-t px-6 py-3 flex items-center justify-between text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] shrink-0">
        <div className="flex gap-6">
          <span className="flex items-center gap-2"><div className="w-3 h-3 rounded-md bg-emerald-500 shadow-sm" /> Inventory Open</span>
          <span className="flex items-center gap-2"><div className="w-3 h-3 rounded-md bg-rose-500 shadow-sm" /> Plan Stopped</span>
          <span className="flex items-center gap-2"><div className="w-3 h-3 rounded-md bg-slate-200 shadow-sm" /> Unit Locked</span>
        </div>
        <div className="flex items-center gap-2">
          <CreditCard className="w-3 h-3" /> Currency: USD ($)
        </div>
      </footer>
    </div>
  );
}
