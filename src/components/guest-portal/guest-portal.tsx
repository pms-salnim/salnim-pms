"use client";

import React, { useState, useCallback, useMemo } from 'react';
import { format } from 'date-fns';
import { GuestPortalProps } from './types';
import Dashboard from './Dashboard';
import ChatTab from './ChatTab';
import BillTab from './BillTab';
import ReviewsTab from './ReviewsTab';
import ProfileTab from './ProfileTab';
import AllExtrasView from './AllExtrasView';

const GuestPortal: React.FC<GuestPortalProps> = ({ data, onLogout }) => {
  const [activeTab, setActiveTab] = useState('home');
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [showAllExtras, setShowAllExtras] = useState(false);

  const { property, reservation, rooms } = data;

  // Theme Colors
  const colors = useMemo(() => ({
    primary: property?.primaryColor || "#003166",
    secondary: property?.secondaryColor || "#ea580c",
  }), [property?.primaryColor, property?.secondaryColor]);

  // Computed values
  const guestName = useMemo(() => reservation.guestName || 'Guest', [reservation.guestName]);
  const roomName = useMemo(() => rooms.length > 0 ? rooms[0].name : 'Room', [rooms]);
  const stayDates = useMemo(() => `${format(new Date(reservation.startDate), 'dd MMM')} – ${format(new Date(reservation.endDate), 'dd MMM yyyy')}`, [reservation.startDate, reservation.endDate]);
  const isCheckedIn = useMemo(() => !!reservation.actualCheckInTime, [reservation.actualCheckInTime]);

  const triggerToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  }, []);

  // Render content based on active view
  const renderContent = () => {
    if (showAllExtras) {
      return (
        <AllExtrasView
          data={data}
          setShowAllExtras={setShowAllExtras}
          colors={colors}
          triggerToast={triggerToast}
          showToast={showToast}
          toastMessage={toastMessage}
        />
      );
    }

    if (activeTab === 'home') {
      return (
        <Dashboard
          data={data}
          onLogout={onLogout}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          setShowAllExtras={setShowAllExtras}
          colors={colors}
          triggerToast={triggerToast}
          showToast={showToast}
          toastMessage={toastMessage}
        />
      );
    }

    // For other tabs, render within Dashboard layout but replace main content
    return (
      <Dashboard
        data={data}
        onLogout={onLogout}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        setShowAllExtras={setShowAllExtras}
        colors={colors}
        triggerToast={triggerToast}
        showToast={showToast}
        toastMessage={toastMessage}
        customContent={
          <>
            {activeTab === 'chat' && (
              <ChatTab
                data={data}
                colors={colors}
                guestName={guestName}
                triggerToast={triggerToast}
              />
            )}
            {activeTab === 'bill' && (
              <BillTab
                data={data}
                colors={colors}
                triggerToast={triggerToast}
              />
            )}
            {activeTab === 'reviews' && (
              <ReviewsTab
                data={data}
                colors={colors}
                guestName={guestName}
                triggerToast={triggerToast}
              />
            )}
            {activeTab === 'profile' && (
              <ProfileTab
                data={data}
                colors={colors}
                guestName={guestName}
                roomName={roomName}
                stayDates={stayDates}
                isCheckedIn={isCheckedIn}
                triggerToast={triggerToast}
              />
            )}
          </>
        }
      />
    );
  };

  return renderContent();
};

export default GuestPortal;