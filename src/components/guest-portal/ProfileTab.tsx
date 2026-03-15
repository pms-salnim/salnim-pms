"use client";

import React from 'react';
import { 
  User, 
  MapPin, 
  Calendar, 
  Clock, 
  BadgeInfo, 
  Edit2 as EditIcon,
  Mail,
  Phone,
  Globe,
  CreditCard,
  Home,
  Users,
  Moon,
  CheckCircle,
  XCircle,
  Sparkles,
  Save,
  X
} from 'lucide-react';
import { format } from 'date-fns';
import { GuestPortalData } from './types';

interface ProfileTabProps {
  data: GuestPortalData;
  colors: {
    primary: string;
    secondary: string;
  };
  guestName: string;
  roomName: string;
  stayDates: string;
  isCheckedIn: boolean;
  triggerToast: (msg: string) => void;
  onSaveGuestData?: (payload: { guestName?: string; guestEmail?: string; guestPhone?: string; guestCountry?: string; guestPassportOrId?: string }) => void;
}

const ProfileTab: React.FC<ProfileTabProps> = ({ 
  data, 
  colors, 
  guestName: initialGuestName, 
  roomName, 
  stayDates, 
  isCheckedIn,
  triggerToast,
  onSaveGuestData,
}) => {
  const { reservation } = data;

  const [guestName, setGuestName] = React.useState<string>(reservation.guestName || initialGuestName || '');
  const [guestEmail, setGuestEmail] = React.useState<string>(reservation.guestEmail || '');
  const [guestPhone, setGuestPhone] = React.useState<string>(reservation.guestPhone || '');
  const [guestCountry, setGuestCountry] = React.useState<string>(reservation.guestCountry || '');
  const [guestPassportOrId, setGuestPassportOrId] = React.useState<string>(reservation.guestPassportOrId || '');
  const [editingField, setEditingField] = React.useState<string | null>(null);
  const roomTypeName = (() => {
    // Try common places where room type may be present
    // 1) data.rooms[0].type
    // 2) data.roomTypes[0].name
    // 3) reservation.roomType
    const r0: any = (data as any).rooms && (data as any).rooms.length > 0 ? (data as any).rooms[0] : null;
    if (r0 && r0.type) return r0.type;
    if ((data as any)?.roomTypes && (data as any).roomTypes.length > 0) return (data as any).roomTypes[0].name;
    if ((reservation as any)?.roomType) return (reservation as any).roomType;
    return '';
  })();

  // Helper to call the server-side profile update function when no prop handler is provided
  async function doSaveUpdates(updates: Record<string, any>, singleField?: string) {
    try {
      const base = process.env.NEXT_PUBLIC_FUNCTIONS_BASE || 'https://europe-west1-protrack-hub.cloudfunctions.net';
      const url = `${base}/guestPortalProfileUpdate`;
      const body = {
        propertySlug: (data as any)?.property?.slug || (data as any)?.property?.id,
        reservationNumber: reservation.reservationNumber || reservation.id,
        updates
      };

      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const json = await resp.json();

      if (!resp.ok || !json.success) {
        triggerToast(json.error || 'Failed to save profile data');
        // if there are rejected fields, revert local state for them
        if (json.result?.rejectedFields) {
          const rejected = json.result.rejectedFields as Record<string,string>;
          Object.keys(rejected).forEach(k => {
            if (k === 'guestName') setGuestName(reservation.guestName || initialGuestName || '');
            if (k === 'guestEmail') setGuestEmail(reservation.guestEmail || '');
            if (k === 'guestPhone') setGuestPhone(reservation.guestPhone || '');
            if (k === 'guestCountry') setGuestCountry(reservation.guestCountry || '');
            if (k === 'guestPassportOrId') setGuestPassportOrId(reservation.guestPassportOrId || '');
          });
        }
        return;
      }

      const result = json.result || {};
      const updated: string[] = result.updatedFields || [];
      const rejected: Record<string,string> = result.rejectedFields || {};

      if (updated.length) {
        triggerToast(`Saved: ${updated.join(', ')}`);
      }
      if (Object.keys(rejected).length) {
        triggerToast(`Some fields were rejected: ${Object.keys(rejected).join(', ')}`);
        // revert rejected fields
        Object.keys(rejected).forEach(k => {
          if (k === 'guestName') setGuestName(reservation.guestName || initialGuestName || '');
          if (k === 'guestEmail') setGuestEmail(reservation.guestEmail || '');
          if (k === 'guestPhone') setGuestPhone(reservation.guestPhone || '');
          if (k === 'guestCountry') setGuestCountry(reservation.guestCountry || '');
          if (k === 'guestPassportOrId') setGuestPassportOrId(reservation.guestPassportOrId || '');
        });
      }
    } catch (error) {
      console.error('Error saving guest profile:', error);
      triggerToast('Failed to save profile (network error)');
      // revert single field if applicable
      if (singleField) {
        if (singleField === 'name') setGuestName(reservation.guestName || initialGuestName || '');
        if (singleField === 'email') setGuestEmail(reservation.guestEmail || '');
        if (singleField === 'phone') setGuestPhone(reservation.guestPhone || '');
        if (singleField === 'country') setGuestCountry(reservation.guestCountry || '');
        if (singleField === 'passport') setGuestPassportOrId(reservation.guestPassportOrId || '');
      }
    }
  }

  // Reservation-derived helpers
  const reservationDate: Date | null = (() => {
    const c = (reservation as any)?.createdAt || (reservation as any)?.created || (reservation as any)?.createdOn || (reservation as any)?.createdAtTimestamp;
    try {
      return c ? new Date(c) : null;
    } catch (e) {
      return null;
    }
  })();

  const roomsCount: number = Array.isArray((reservation as any).rooms)
    ? (reservation as any).rooms.length
    : (reservation as any).roomCount || (reservation as any).numberOfRooms || 1;

  const guestsCount: number = (reservation as any).guestCount || (reservation as any).numberOfGuests || (((reservation as any).adults ? (reservation as any).adults : 0) + ((reservation as any).children ? (reservation as any).children : 0)) || 1;

  const nights: number | null = (() => {
    try {
      if (reservation.startDate && reservation.endDate) {
        const sd = new Date(reservation.startDate);
        const ed = new Date(reservation.endDate);
        const diff = Math.round((ed.getTime() - sd.getTime()) / (1000 * 60 * 60 * 24));
        return diff > 0 ? diff : 0;
      }
    } catch (e) {
      // ignore
    }
    return null;
  })();

  const handleSave = () => {
    // generic save: close any editor and send values (address removed)
    setEditingField(null);
    triggerToast('Profile saved locally');
    const payload = { guestName, guestEmail, guestPhone, guestCountry, guestPassportOrId };
    if (onSaveGuestData) {
      onSaveGuestData(payload);
    } else {
      doSaveUpdates(payload);
    }
  };

  const handleSaveField = (field: string) => {
    setEditingField(null);
    triggerToast('Field saved');
    const payload: any = {};
    if (field === 'name') payload.guestName = guestName;
    if (field === 'email') payload.guestEmail = guestEmail;
    if (field === 'phone') payload.guestPhone = guestPhone;
    if (field === 'country') payload.guestCountry = guestCountry;
    if (field === 'passport') payload.guestPassportOrId = guestPassportOrId;
    if (onSaveGuestData) {
      onSaveGuestData(payload);
    } else {
      doSaveUpdates(payload, field);
    }
  };

  const handleCancelField = (field: string) => {
    setEditingField(null);
    if (field === 'name') setGuestName(reservation.guestName || initialGuestName || '');
    if (field === 'email') setGuestEmail(reservation.guestEmail || '');
    if (field === 'phone') setGuestPhone(reservation.guestPhone || '');
    if (field === 'country') setGuestCountry(reservation.guestCountry || '');
    if (field === 'passport') setGuestPassportOrId(reservation.guestPassportOrId || '');
  };

  return (
    <section className="space-y-6 animate-in fade-in">
      {/* Floating Header Card */}
      <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl shadow-slate-900/5 border border-white/20 overflow-hidden">
        <div className="px-6 py-5 flex items-center justify-between border-b border-slate-200/50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-gradient-to-br from-blue-600 to-blue-500 shadow-lg shadow-blue-500/30">
              <User className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-lg bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 bg-clip-text text-transparent">
                Your Profile
              </h2>
              <p className="text-sm text-slate-500 flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                Guest information & reservation details
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Profile Hero Card */}
      <div className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-3xl p-8 shadow-2xl shadow-slate-900/20 overflow-hidden">
        {/* Decorative Background */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-gradient-to-tr from-cyan-500/20 to-blue-500/20 rounded-full blur-3xl" />
        
        <div className="relative z-10">
          {/* Profile Header */}
          <div className="flex items-start gap-6 mb-8">
            <div className="relative">
              <div className="w-24 h-24 rounded-3xl flex items-center justify-center text-white text-4xl font-bold bg-gradient-to-br from-blue-600 to-blue-500 shadow-2xl shadow-blue-500/30">
                {(reservation.guestName || guestName)[0]?.toUpperCase() || 'G'}
              </div>
              {isCheckedIn && (
                <div className="absolute -bottom-1 -right-1 p-1.5 bg-emerald-500 rounded-full border-4 border-slate-900">
                  <CheckCircle className="w-4 h-4 text-white" />
                </div>
              )}
            </div>
            <div className="flex-1">
              <p className="text-slate-400 text-sm font-medium mb-1 uppercase tracking-wide">Guest Name</p>
              {editingField === 'name' ? (
                <div className="flex items-center gap-3">
                  <input 
                    value={guestName} 
                    onChange={e => setGuestName(e.target.value)} 
                    className="flex-1 px-4 py-2.5 bg-white/10 border-2 border-white/20 rounded-xl text-white outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-500/20 transition-all"
                    placeholder="Enter your name"
                  />
                  <button 
                    onClick={() => handleSaveField('name')} 
                    className="p-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition-all hover:scale-110 active:scale-95"
                  >
                    <Save className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={() => handleCancelField('name')} 
                    className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all hover:scale-110 active:scale-95"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <h3 className="text-3xl font-bold text-white">
                    {reservation.guestName || guestName || 'Guest'}
                  </h3>
                  {!reservation.guestName && (
                    <button 
                      onClick={() => setEditingField('name')} 
                      className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all hover:scale-110 active:scale-95"
                      title="Edit name"
                    >
                      <EditIcon className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}
              <p className="text-slate-400 text-sm mt-2">Reservation #{reservation.reservationNumber || reservation.id}</p>
            </div>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-xl bg-blue-500/20">
                  <MapPin className="w-5 h-5 text-blue-400" />
                </div>
                <span className="text-slate-300 text-sm font-medium">Room</span>
              </div>
              <p className="text-2xl font-bold text-white">{roomName || '—'}</p>
              {roomTypeName && <p className="text-slate-400 text-xs mt-1">{roomTypeName}</p>}
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-xl bg-purple-500/20">
                  <Calendar className="w-5 h-5 text-purple-400" />
                </div>
                <span className="text-slate-300 text-sm font-medium">Duration</span>
              </div>
              <p className="text-2xl font-bold text-white">{nights !== null ? nights : '—'}</p>
              <p className="text-slate-400 text-xs mt-1">{nights === 1 ? 'night' : 'nights'}</p>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-xl bg-emerald-500/20">
                  <Users className="w-5 h-5 text-emerald-400" />
                </div>
                <span className="text-slate-300 text-sm font-medium">Guests</span>
              </div>
              <p className="text-2xl font-bold text-white">{guestsCount}</p>
              <p className="text-slate-400 text-xs mt-1">{guestsCount === 1 ? 'person' : 'people'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Contact Information Card */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-lg shadow-slate-900/5">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 rounded-xl bg-blue-100">
            <Mail className="w-5 h-5 text-blue-600" />
          </div>
          <h4 className="text-lg font-bold text-slate-900">Contact Information</h4>
        </div>

        <div className="space-y-4">
          {/* Email */}
          <div className="group relative bg-slate-50 rounded-2xl p-5 border border-slate-200 hover:border-blue-300 transition-all">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4 flex-1">
                <div className="p-2.5 rounded-xl bg-blue-100">
                  <Mail className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide mb-1">Email Address</p>
                  {editingField === 'email' ? (
                    <div className="flex items-center gap-2">
                      <input 
                        type="email"
                        value={guestEmail} 
                        onChange={e => setGuestEmail(e.target.value)} 
                        className="flex-1 px-3 py-2 border-2 border-blue-300 rounded-xl outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                        placeholder="your@email.com"
                      />
                      <button onClick={() => handleSaveField('email')} className="p-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition-all">
                        <Save className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleCancelField('email')} className="p-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 transition-all">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <p className="font-bold text-slate-900">{reservation.guestEmail || guestEmail || 'Not provided'}</p>
                  )}
                </div>
              </div>
              {!reservation.guestEmail && editingField !== 'email' && (
                <button 
                  onClick={() => setEditingField('email')} 
                  className="p-2.5 rounded-xl bg-blue-100 hover:bg-blue-200 text-blue-600 transition-all hover:scale-110 active:scale-95"
                  title="Edit email"
                >
                  <EditIcon className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Phone */}
          <div className="group relative bg-slate-50 rounded-2xl p-5 border border-slate-200 hover:border-emerald-300 transition-all">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4 flex-1">
                <div className="p-2.5 rounded-xl bg-emerald-100">
                  <Phone className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide mb-1">Phone Number</p>
                  {editingField === 'phone' ? (
                    <div className="flex items-center gap-2">
                      <input 
                        type="tel"
                        value={guestPhone} 
                        onChange={e => setGuestPhone(e.target.value)} 
                        className="flex-1 px-3 py-2 border-2 border-emerald-300 rounded-xl outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
                        placeholder="+1 234 567 8900"
                      />
                      <button onClick={() => handleSaveField('phone')} className="p-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition-all">
                        <Save className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleCancelField('phone')} className="p-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 transition-all">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <p className="font-bold text-slate-900">{reservation.guestPhone || guestPhone || 'Not provided'}</p>
                  )}
                </div>
              </div>
              {!reservation.guestPhone && editingField !== 'phone' && (
                <button 
                  onClick={() => setEditingField('phone')} 
                  className="p-2.5 rounded-xl bg-emerald-100 hover:bg-emerald-200 text-emerald-600 transition-all hover:scale-110 active:scale-95"
                  title="Edit phone"
                >
                  <EditIcon className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Country */}
          <div className="group relative bg-slate-50 rounded-2xl p-5 border border-slate-200 hover:border-purple-300 transition-all">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4 flex-1">
                <div className="p-2.5 rounded-xl bg-purple-100">
                  <Globe className="w-5 h-5 text-purple-600" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide mb-1">Country</p>
                  {editingField === 'country' ? (
                    <div className="flex items-center gap-2">
                      <input 
                        value={guestCountry} 
                        onChange={e => setGuestCountry(e.target.value)} 
                        className="flex-1 px-3 py-2 border-2 border-purple-300 rounded-xl outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10"
                        placeholder="Country name"
                      />
                      <button onClick={() => handleSaveField('country')} className="p-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition-all">
                        <Save className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleCancelField('country')} className="p-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 transition-all">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <p className="font-bold text-slate-900">{reservation.guestCountry || guestCountry || 'Not provided'}</p>
                  )}
                </div>
              </div>
              {!reservation.guestCountry && editingField !== 'country' && (
                <button 
                  onClick={() => setEditingField('country')} 
                  className="p-2.5 rounded-xl bg-purple-100 hover:bg-purple-200 text-purple-600 transition-all hover:scale-110 active:scale-95"
                  title="Edit country"
                >
                  <EditIcon className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* ID/Passport */}
          <div className="group relative bg-slate-50 rounded-2xl p-5 border border-slate-200 hover:border-amber-300 transition-all">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4 flex-1">
                <div className="p-2.5 rounded-xl bg-amber-100">
                  <CreditCard className="w-5 h-5 text-amber-600" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide mb-1">ID / Passport Number</p>
                  {editingField === 'passport' ? (
                    <div className="flex items-center gap-2">
                      <input 
                        value={guestPassportOrId} 
                        onChange={e => setGuestPassportOrId(e.target.value)} 
                        className="flex-1 px-3 py-2 border-2 border-amber-300 rounded-xl outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10"
                        placeholder="ID or passport number"
                      />
                      <button onClick={() => handleSaveField('passport')} className="p-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition-all">
                        <Save className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleCancelField('passport')} className="p-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 transition-all">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <p className="font-bold text-slate-900">{reservation.guestPassportOrId || guestPassportOrId || 'Not provided'}</p>
                  )}
                </div>
              </div>
              {!reservation.guestPassportOrId && editingField !== 'passport' && (
                <button 
                  onClick={() => setEditingField('passport')} 
                  className="p-2.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-600 transition-all hover:scale-110 active:scale-95"
                  title="Edit ID/Passport"
                >
                  <EditIcon className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Reservation Details Card */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-lg shadow-slate-900/5">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 rounded-xl bg-purple-100">
            <Calendar className="w-5 h-5 text-purple-600" />
          </div>
          <h4 className="text-lg font-bold text-slate-900">Reservation Details</h4>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Reservation Date */}
          <div className="bg-gradient-to-br from-slate-50 to-slate-100/50 rounded-2xl p-4 border border-slate-200">
            <div className="flex items-center gap-3 mb-2">
              <Calendar className="w-5 h-5 text-slate-500" />
              <span className="text-xs text-slate-500 font-semibold uppercase tracking-wide">Reservation Date</span>
            </div>
            <p className="font-bold text-slate-900 text-lg">
              {reservationDate ? format(reservationDate, 'MMM dd, yyyy') : '—'}
            </p>
            {reservationDate && (
              <p className="text-slate-500 text-xs mt-1">
                {format(reservationDate, 'HH:mm')}
              </p>
            )}
          </div>

          {/* Check-in Date */}
          <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-2xl p-4 border border-blue-200">
            <div className="flex items-center gap-3 mb-2">
              <CheckCircle className="w-5 h-5 text-blue-600" />
              <span className="text-xs text-blue-600 font-semibold uppercase tracking-wide">Check-in</span>
            </div>
            <p className="font-bold text-slate-900 text-lg">
              {reservation.startDate ? format(new Date(reservation.startDate), 'MMM dd, yyyy') : '—'}
            </p>
            {reservation.actualCheckInTime && (
              <p className="text-blue-600 text-xs mt-1 font-semibold">
                Actual: {format(new Date(reservation.actualCheckInTime), 'HH:mm')}
              </p>
            )}
          </div>

          {/* Check-out Date */}
          <div className="bg-gradient-to-br from-rose-50 to-rose-100/50 rounded-2xl p-4 border border-rose-200">
            <div className="flex items-center gap-3 mb-2">
              <XCircle className="w-5 h-5 text-rose-600" />
              <span className="text-xs text-rose-600 font-semibold uppercase tracking-wide">Check-out</span>
            </div>
            <p className="font-bold text-slate-900 text-lg">
              {reservation.endDate ? format(new Date(reservation.endDate), 'MMM dd, yyyy') : '—'}
            </p>
            {reservation.actualCheckOutTime && (
              <p className="text-rose-600 text-xs mt-1 font-semibold">
                Actual: {format(new Date(reservation.actualCheckOutTime), 'HH:mm')}
              </p>
            )}
          </div>

          {/* Room Info */}
          <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 rounded-2xl p-4 border border-emerald-200">
            <div className="flex items-center gap-3 mb-2">
              <Home className="w-5 h-5 text-emerald-600" />
              <span className="text-xs text-emerald-600 font-semibold uppercase tracking-wide">Accommodation</span>
            </div>
            <p className="font-bold text-slate-900 text-lg">{roomsCount} {roomsCount === 1 ? 'Room' : 'Rooms'}</p>
            <p className="text-emerald-600 text-xs mt-1 font-semibold">
              {guestsCount} {guestsCount === 1 ? 'Guest' : 'Guests'}
            </p>
          </div>
        </div>

        {/* Additional Info */}
        <div className="mt-4 pt-4 border-t border-slate-200">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-600">Status</span>
            <span className={`px-3 py-1 rounded-full font-semibold ${
              reservation.status === 'confirmed' || reservation.status === 'active'
                ? 'bg-emerald-100 text-emerald-700'
                : reservation.status === 'pending'
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-slate-100 text-slate-700'
            }`}>
              {reservation.status || 'Active'}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ProfileTab;