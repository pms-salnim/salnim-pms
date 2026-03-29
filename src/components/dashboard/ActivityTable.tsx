"use client";

import React, { useState } from "react";
import { useTranslation } from 'react-i18next';
import { differenceInDays, format } from "date-fns";
import { toDate } from '@/lib/dateUtils';
import type { Reservation } from "@/components/calendar/types";
import type { Property } from '@/types/property';
import { Users, Moon } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger } from "@/components/ui/dropdown-menu";
import { Icons } from "@/components/icons";
import { OccupancyDonutCard } from "./OccupancyDonutCard";
import { ChannelMixCard } from "./ChannelMixCard";

interface ActivityTableProps {
  todaysArrivals: Reservation[];
  todaysDepartures: Reservation[];
  activityTab: 'checkins' | 'checkouts';
  setActivityTab: (tab: 'checkins' | 'checkouts') => void;
  onViewDetails: (reservation: Reservation) => void;
  onCheckIn: (reservation: Reservation) => void;
  onCheckOut: (reservation: Reservation) => void;
  onCancel: (reservation: Reservation) => void;
  propertySettings: Property | null;
  occupancyPercent: number;
  bookedUnits: number;
  availableUnits: number;
  outOfService: number;
  blockedDates: number;
  channelDirect: number;
  channelOta: number;
  channelWalkIn: number;
}

export function ActivityTable({ 
  todaysArrivals, 
  todaysDepartures, 
  activityTab, 
  setActivityTab, 
  onViewDetails, 
  onCheckIn,
  onCheckOut,
  onCancel,
  propertySettings,
  occupancyPercent,
  bookedUnits,
  availableUnits,
  outOfService,
  blockedDates,
  channelDirect,
  channelOta,
  channelWalkIn
}: ActivityTableProps) {
  const { t } = useTranslation('pages/dashboard/content');
  const [completedCheckIns, setCompletedCheckIns] = useState<Set<string>>(new Set());
  const [completedCheckOuts, setCompletedCheckOuts] = useState<Set<string>>(new Set());

  const handleCheckIn = (reservation: Reservation) => {
    onCheckIn(reservation);
    setCompletedCheckIns(prev => new Set(prev).add(reservation.id));
  };

  const handleCheckOut = (reservation: Reservation) => {
    onCheckOut(reservation);
    setCompletedCheckOuts(prev => new Set(prev).add(reservation.id));
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-6 gap-4 items-start">
      {/* Left Column - Occupancy & Channel Mix - 1/6 width */}
      <div className="lg:col-span-1 flex flex-col gap-4" id="left-column">
        <OccupancyDonutCard 
          occupancyPercent={occupancyPercent}
          bookedUnits={bookedUnits}
          availableUnits={availableUnits}
          outOfService={outOfService}
          blockedDates={blockedDates}
        />
        <ChannelMixCard 
          direct={channelDirect}
          ota={channelOta}
          walkIn={channelWalkIn}
        />
      </div>

      {/* Activity Table - 5/6 width */}
      <div className="lg:col-span-5 w-full">
        <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[485px]">
      <div className="flex border-b border-slate-100 bg-slate-50/30">
        <button onClick={() => setActivityTab('checkins')} className={`px-6 py-4 text-sm font-bold transition-all relative ${activityTab === 'checkins' ? 'text-[#003166]' : 'text-slate-400 hover:text-slate-600'}`}>
          {t('todays_activity.check_ins.title')} ({todaysArrivals.length}){activityTab === 'checkins' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#003166]"></div>}
        </button>
        <button onClick={() => setActivityTab('checkouts')} className={`px-6 py-4 text-sm font-bold transition-all relative ${activityTab === 'checkouts' ? 'text-[#003166]' : 'text-slate-400 hover:text-slate-600'}`}>
          {t('todays_activity.check_outs.title')} ({todaysDepartures.length}){activityTab === 'checkouts' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#003166]"></div>}
        </button>
      </div>

      <div className="overflow-x-auto flex-1 overflow-y-auto">
        {activityTab === 'checkins' ? (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-slate-400 font-medium border-b border-slate-50">
                <th className="py-4 px-6">Guest</th>
                <th className="py-4 px-6">Room</th>
                <th className="py-4 px-6">Stay</th>
                <th className="py-4 px-6">Status</th>
                <th className="py-4 px-6">Action</th>
                <th className="py-4 px-6 text-right">More</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {todaysArrivals.slice(0, 10).map((item) => {
                const nights = (toDate(item.endDate) && toDate(item.startDate)) ? differenceInDays(toDate(item.endDate) as Date, toDate(item.startDate) as Date) : 0;
                const totalGuests = Array.isArray(item.rooms) ? item.rooms.reduce((sum, r) => sum + (r.adults || 0) + (r.children || 0), 0) : 0;
                const startDateStr = toDate(item.startDate) ? format(toDate(item.startDate) as Date, 'MMM dd') : '';
                const endDateStr = toDate(item.endDate) ? format(toDate(item.endDate) as Date, 'MMM dd') : '';
                
                return (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-4 px-6">
                      <div className="font-bold text-slate-800">{item.guestName}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{item.reservationNumber || item.id}</div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="font-medium text-slate-800">{Array.isArray(item.rooms) && item.rooms[0] ? item.rooms[0].roomName : 'N/A'}</div>
                      <div className="text-xs text-slate-500">{Array.isArray(item.rooms) && item.rooms[0] ? item.rooms[0].roomTypeName : ''}</div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="text-sm text-slate-800 font-medium">{startDateStr} - {endDateStr}</div>
                      <div className="flex gap-3 mt-1 text-xs text-slate-600">
                        <div className="flex items-center gap-1">
                          <Users size={14} className="text-slate-400" />
                          <span>{totalGuests} guest{totalGuests !== 1 ? 's' : ''}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Moon size={14} className="text-slate-400" />
                          <span>{nights} night{nights !== 1 ? 's' : ''}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className={`${String(item.status) === 'Confirmed' ? 'bg-green-100 text-green-700' : String(item.status) === 'Checked-in' ? 'bg-blue-100 text-blue-700' : String(item.status) === 'Canceled' ? 'bg-red-100 text-red-700' : String(item.status) === 'Pending' ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-700'} px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider whitespace-nowrap`}>{item.status}</span>
                    </td>
                    <td className="py-4 px-6">
                      {!completedCheckIns.has(item.id) && item.status !== 'Checked-in' && item.status !== 'Canceled' && (
                        <Button 
                          size="sm" 
                          onClick={() => handleCheckIn(item)}
                          className="bg-[#003166] hover:bg-[#002147] text-white font-semibold"
                        >
                          Check In
                        </Button>
                      )}
                    </td>
                    <td className="py-4 px-6 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="text-slate-400 hover:text-slate-600">
                            <Icons.MoreVertical size={18} />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem onClick={() => onViewDetails(item)}>
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSub>
                            <DropdownMenuSubTrigger>
                              Contact
                            </DropdownMenuSubTrigger>
                            <DropdownMenuSubContent>
                              <DropdownMenuItem>Email</DropdownMenuItem>
                              <DropdownMenuItem>WhatsApp</DropdownMenuItem>
                              <DropdownMenuItem>Guest Portal</DropdownMenuItem>
                            </DropdownMenuSubContent>
                          </DropdownMenuSub>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem>
                            Mark as No-Show
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onCancel(item)} className="text-red-600">
                            Cancel
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-red-600">
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-slate-400 font-medium border-b border-slate-50">
                <th className="py-4 px-6">Guest</th>
                <th className="py-4 px-6">Room</th>
                <th className="py-4 px-6">Stay</th>
                <th className="py-4 px-6">Status</th>
                <th className="py-4 px-6">Action</th>
                <th className="py-4 px-6 text-right">More</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {todaysDepartures.slice(0, 10).map((item) => {
                const nights = (toDate(item.endDate) && toDate(item.startDate)) ? differenceInDays(toDate(item.endDate) as Date, toDate(item.startDate) as Date) : 0;
                const totalGuests = Array.isArray(item.rooms) ? item.rooms.reduce((sum, r) => sum + (r.adults || 0) + (r.children || 0), 0) : 0;
                const startDateStr = toDate(item.startDate) ? format(toDate(item.startDate) as Date, 'MMM dd') : '';
                const endDateStr = toDate(item.endDate) ? format(toDate(item.endDate) as Date, 'MMM dd') : '';
                
                return (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-4 px-6">
                      <div className="font-bold text-slate-800">{item.guestName}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{item.reservationNumber || item.id}</div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="font-medium text-slate-800">{Array.isArray(item.rooms) && item.rooms[0] ? item.rooms[0].roomName : 'N/A'}</div>
                      <div className="text-xs text-slate-500">{Array.isArray(item.rooms) && item.rooms[0] ? item.rooms[0].roomTypeName : ''}</div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="text-sm text-slate-800 font-medium">{startDateStr} - {endDateStr}</div>
                      <div className="flex gap-3 mt-1 text-xs text-slate-600">
                        <div className="flex items-center gap-1">
                          <Users size={14} className="text-slate-400" />
                          <span>{totalGuests} guest{totalGuests !== 1 ? 's' : ''}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Moon size={14} className="text-slate-400" />
                          <span>{nights} night{nights !== 1 ? 's' : ''}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className={`${item.status === 'Completed' ? 'bg-slate-200 text-slate-600' : item.status === 'Pending' ? 'bg-orange-100 text-orange-700' : item.status === 'Confirmed' ? 'bg-green-100 text-green-700' : item.status === 'Checked-in' ? 'bg-blue-100 text-blue-700' : item.status === 'No-Show' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'} px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider whitespace-nowrap`}>{item.status || 'Pending'}</span>
                    </td>
                    <td className="py-4 px-6">
                      {!completedCheckOuts.has(item.id) && item.status !== 'Completed' && (
                        <Button 
                          size="sm" 
                          onClick={() => handleCheckOut(item)}
                          className="bg-[#003166] hover:bg-[#002147] text-white font-semibold"
                        >
                          Check Out
                        </Button>
                      )}
                    </td>
                    <td className="py-4 px-6 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="text-slate-400 hover:text-slate-600">
                            <Icons.MoreVertical size={18} />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem onClick={() => onViewDetails(item)}>
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSub>
                            <DropdownMenuSubTrigger>
                              Contact
                            </DropdownMenuSubTrigger>
                            <DropdownMenuSubContent>
                              <DropdownMenuItem>Email</DropdownMenuItem>
                              <DropdownMenuItem>WhatsApp</DropdownMenuItem>
                              <DropdownMenuItem>Guest Portal</DropdownMenuItem>
                            </DropdownMenuSubContent>
                          </DropdownMenuSub>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem>
                            Mark as No-Show
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onCancel(item)} className="text-red-600">
                            Cancel
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-red-600">
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </section>
      </div>
    </div>
  );
}
