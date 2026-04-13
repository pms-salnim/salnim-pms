'use client';

import React, { useState, useEffect } from 'react';
import { fetchRoomTypes, fetchRooms } from '@/lib/supabase-queries';
import { ChevronDown } from 'lucide-react';

interface ScopeOption {
  level: 'property' | 'room_type' | 'room';
  propertyId: string;
  roomTypeId?: string;
  roomId?: string;
  roomTypeName?: string;
  roomName?: string;
}

interface ScopeSelectorProps {
  propertyId: string;
  currentScope: ScopeOption;
  onScopeChange: (scope: ScopeOption) => void;
}

export function ScopeSelector({ propertyId, currentScope, onScopeChange }: ScopeSelectorProps) {
  const [roomTypes, setRoomTypes] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [selectedRoomType, setSelectedRoomType] = useState<string | undefined>(currentScope.roomTypeId);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetchRoomTypes(propertyId as string).then(data => {
      setRoomTypes(data || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [propertyId]);

  useEffect(() => {
    if (selectedRoomType) {
      setLoading(true);
      fetchRooms(propertyId as string).then(data => {
        const filtered = (data || []).filter((r: any) => r.room_type_id === selectedRoomType);
        setRooms(filtered);
        setLoading(false);
      }).catch(() => setLoading(false));
    }
  }, [selectedRoomType, propertyId]);

  const handlePropertyWide = () => {
    onScopeChange({
      level: 'property',
      propertyId,
    });
    setSelectedRoomType(undefined);
  };

  const handleRoomTypeChange = (roomTypeId: string) => {
    const roomType = roomTypes.find(rt => rt.id === roomTypeId);
    setSelectedRoomType(roomTypeId);
    onScopeChange({
      level: 'room_type',
      propertyId,
      roomTypeId,
      roomTypeName: roomType?.name,
    });
  };

  const handleRoomChange = (roomId: string) => {
    const room = rooms.find(r => r.id === roomId);
    const roomType = roomTypes.find(rt => rt.id === selectedRoomType);
    onScopeChange({
      level: 'room',
      propertyId,
      roomTypeId: selectedRoomType,
      roomId,
      roomTypeName: roomType?.name,
      roomName: room?.name,
    });
  };

  return (
    <div className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center gap-4">
        {/* Property-Wide Option */}
        <button
          onClick={handlePropertyWide}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            currentScope.level === 'property'
              ? 'bg-blue-100 text-blue-700'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          🏠 Property-Wide
        </button>

        {/* Room Type Selector */}
        <div className="relative">
          <select
            value={selectedRoomType || ''}
            onChange={(e) => e.target.value ? handleRoomTypeChange(e.target.value) : handlePropertyWide()}
            disabled={loading}
            className={`appearance-none px-4 py-2 rounded-lg font-medium border transition-colors ${
              currentScope.level === 'room_type'
                ? 'bg-blue-100 text-blue-700 border-blue-300'
                : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200'
            } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <option value="">🛏️ Select Room Type...</option>
            {roomTypes.map((rt) => (
              <option key={rt.id} value={rt.id}>
                {rt.name}
                {rt.numberOfRoomsAvailable ? ` (${rt.numberOfRoomsAvailable} rooms)` : ''}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-2.5 w-4 h-4 pointer-events-none" />
        </div>

        {/* Room Selector (shown only when room type is selected) */}
        {selectedRoomType && (
          <div className="relative">
            <select
              onChange={(e) => e.target.value && handleRoomChange(e.target.value)}
              disabled={loading || rooms.length === 0}
              className={`appearance-none px-4 py-2 rounded-lg font-medium border transition-colors ${
                currentScope.level === 'room'
                  ? 'bg-blue-100 text-blue-700 border-blue-300'
                  : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200'
              } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <option value="">🚪 Select Specific Room...</option>
              {rooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.name} {room.floor ? `(Floor ${room.floor})` : ''}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-2.5 w-4 h-4 pointer-events-none" />
          </div>
        )}

        {/* Scope Display */}
        <div className="ml-auto text-sm text-gray-600">
          {currentScope.level === 'property' && <span>📊 Applies to all rooms</span>}
          {currentScope.level === 'room_type' && (
            <span>📋 Applies to: <strong>{currentScope.roomTypeName}</strong></span>
          )}
          {currentScope.level === 'room' && (
            <span>🚪 Applies to: <strong>{currentScope.roomName}</strong> ({currentScope.roomTypeName})</span>
          )}
        </div>
      </div>

      {/* Inheritance Note */}
      <div className="mt-3 text-xs text-gray-500 bg-gray-50 p-2 rounded">
        💡 <strong>Inheritance:</strong> Room settings override room type | Room type settings override property-wide | Property-wide is the default
      </div>
    </div>
  );
}
