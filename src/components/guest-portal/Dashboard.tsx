"use client";

import React, { useMemo, useEffect, useState } from 'react';
import { format, differenceInDays } from 'date-fns';
import { 
  Waves, 
  User, 
  MapIn, 
  Calendar, 
  MessageSquare, 
  CreditCard, 
  CheckCircle2, 
  PlaneLanding, 
  Key, 
  FileText, 
  LogOut, 
  ChevronRight, 
  Bell,
  Utensils as UtensilsIcon,
  Sparkles,
  Clock,
  Phone,
  Mail,
  Home,
  Users,
  Bed,
  ArrowRight,
  Star,
  Gift,
  Coffee,
  Wifi,
  Wind,
  Sunrise,
  Sunset,
  DollarSign,
  Package as PackageIcon,
  X,
  Trash2,
  Building2,
  Upload,
  MapPin,
  MessageCircle,
  Check,
  ChevronLeft,
  Image as ImageIcon
} from 'lucide-react';
import { GuestPortalData } from './types';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface DashboardProps {
  data: GuestPortalData;
  onLogout: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  setShowAllExtras: (show: boolean) => void;
  colors: {
    primary: string;
    secondary: string;
  };
  triggerToast: (message: string) => void;
  showToast: boolean;
  toastMessage: string;
  customContent?: React.ReactNode;
}

const Dashboard: React.FC<DashboardProps> = ({ 
  data, 
  onLogout, 
  activeTab, 
  setActiveTab, 
  setShowAllExtras, 
  colors, 
  triggerToast, 
  showToast, 
  toastMessage,
  customContent
}) => {
  const { property, reservation, rooms, services, mealPlans, packages, summary } = data;

  const [fetchedLogoUrl, setFetchedLogoUrl] = useState<string | null | undefined>(undefined);
  const [fetchedPhone, setFetchedPhone] = useState<string | null | undefined>(undefined);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [roomTypeImages, setRoomTypeImages] = useState<string[]>([]);
  const [roomImagesMap, setRoomImagesMap] = useState<{ [roomIndex: number]: string[] }>({});
  const [roomImageIndices, setRoomImageIndices] = useState<{ [roomIndex: number]: number }>({});
  const [checkInProgress, setCheckInProgress] = useState({
    idVerified: false,
    paymentConfirmed: false,
    keyIssued: false,
  });
  const [guestIdDocuments, setGuestIdDocuments] = useState<{ 
    [guestIndex: number]: { 
      guestName?: string;
      type: string; 
      files: Array<{ file: File | null; preview: string | null; side: 'front' | 'back' }>
    } 
  }>({});

  // Load documents from sessionStorage on mount
  useEffect(() => {
    try {
      const savedDocs = sessionStorage.getItem('guestCheckInDocs');
      if (savedDocs) {
        const parsed = JSON.parse(savedDocs);
        // Note: Files cannot be restored from sessionStorage, only file info
        setGuestIdDocuments(parsed);
      }
    } catch (err) {
      console.error('Failed to load check-in documents from session', err);
    }
  }, [showCheckInModal]);

  useEffect(() => {
    let mounted = true;
    const fetchLogo = async () => {
      try {
        if (!property?.id) return;
        const propDoc = await getDoc(doc(db, 'properties', property.id));
        if (!mounted) return;
        if (!propDoc.exists()) {
          setFetchedLogoUrl(undefined);
          return;
        }
        const d: any = propDoc.data();
        // accept either camelCase or PascalCase keys
        const logoFromDoc = d?.bookingPageSettings?.logoUrl ?? d?.BookingPageSettings?.logoUrl ?? undefined;
        const phoneFromDoc = d?.phone ?? undefined;
        // Firestore may store explicit null for logo; keep null to mean "use app default"
        if (logoFromDoc === undefined) {
          setFetchedLogoUrl(undefined);
        } else {
          setFetchedLogoUrl(logoFromDoc);
        }
        // Treat explicit null as undefined for phone (use property.phone fallback)
        if (phoneFromDoc === null || phoneFromDoc === undefined) {
          setFetchedPhone(undefined);
        } else {
          setFetchedPhone(phoneFromDoc);
        }
      } catch (err) {
        // don't block UI on fetch errors
         
        console.error('Failed to fetch property bookingPageSettings.logoUrl', err);
        if (mounted) setFetchedLogoUrl(undefined);
      }
    };
    fetchLogo();
    return () => { mounted = false; };
  }, [property?.id]);

  // Fetch room type images for check-in modal
  useEffect(() => {
    let mounted = true;
    const fetchCheckInRoomImages = async () => {
      if (!showCheckInModal) return;
      
      const rooms = (reservation as any)?.rooms || [];
      const newRoomImagesMap: { [roomIndex: number]: string[] } = {};
      
      for (let idx = 0; idx < rooms.length; idx++) {
        const room = rooms[idx];
        if (!room?.roomTypeId) continue;
        
        try {
          const roomTypeDoc = await getDoc(doc(db, 'roomTypes', room.roomTypeId));
          if (!mounted) return;
          if (!roomTypeDoc.exists()) continue;
          
          const roomTypeData: any = roomTypeDoc.data();
          const imagesArray: string[] = [];
          
          // Add thumbnail as the first/default image
          if (roomTypeData?.thumbnailImageUrl) {
            imagesArray.push(roomTypeData.thumbnailImageUrl);
          }
          
          // Add gallery images after the thumbnail
          const galleryImages = roomTypeData?.galleryImageUrls || [];
          if (Array.isArray(galleryImages) && galleryImages.length > 0) {
            imagesArray.push(...galleryImages);
          }
          
          if (imagesArray.length > 0) {
            newRoomImagesMap[idx] = imagesArray;
          }
        } catch (err) {
          console.error(`Failed to fetch images for room ${idx}:`, err);
        }
      }
      
      if (mounted) {
        setRoomImagesMap(newRoomImagesMap);
        // Initialize image indices for each room to 0 (showing thumbnail/first image)
        const newIndices: { [roomIndex: number]: number } = {};
        Object.keys(newRoomImagesMap).forEach(idx => {
          newIndices[parseInt(idx)] = 0;
        });
        setRoomImageIndices(newIndices);
      }
    };
    
    fetchCheckInRoomImages();
    return () => { mounted = false; };
  }, [showCheckInModal, reservation]);

  const effectiveLogo = (() => {
    // If Firestore explicitly returned null -> use app default `/logo.webp`
    if (fetchedLogoUrl === null) return '/logo.webp';
    // Prefer Firestore value when present, otherwise fall back to property fields, finally app default
    return fetchedLogoUrl || property?.bookingPageSettings?.logoUrl || property?.logoUrl || property?.logo || '/logo.webp';
  })();

  const effectivePhone = fetchedPhone ?? property?.phone ?? '';

  // Computed values
  const guestName = useMemo(() => reservation.guestName || 'Guest', [reservation.guestName]);
  const roomName = useMemo(() => rooms.length > 0 ? rooms[0].name : 'Room', [rooms]);
  const roomTypeName = useMemo(() => {
    // Try common places where room type may be present
    // 1) rooms[0].type
    // 2) data.roomTypes[0].name (sometimes provided from API)
    // 3) reservation.roomType
    const r0: any = rooms && rooms.length > 0 ? rooms[0] : null;
    if (r0 && r0.type) return r0.type;
    // @ts-ignore
    if ((data as any)?.roomTypes && (data as any).roomTypes.length > 0) return (data as any).roomTypes[0].name;
    // @ts-ignore
    if ((reservation as any)?.roomType) return (reservation as any).roomType;
    return '';
  }, [rooms, data, reservation]);
  const stayDates = useMemo(() => `${format(new Date(reservation.startDate), 'dd MMM')} – ${format(new Date(reservation.endDate), 'dd MMM yyyy')}`, [reservation.startDate, reservation.endDate]);
  const isCheckedIn = useMemo(() => !!reservation.actualCheckInTime, [reservation.actualCheckInTime]);
  
  // Debug logging
  useEffect(() => {
    console.log('Dashboard received reservation:', reservation);
    console.log('Reservation.adults:', reservation.adults);
    console.log('Reservation.children:', reservation.children);
    console.log('Reservation.additionalGuests:', reservation.additionalGuests);
  }, [reservation]);
  
  // Get the real-time reservation status
  const reservationStatus = useMemo(() => {
    // Use the actual reservation status from Firestore
    const status = reservation.status?.toLowerCase() || 'confirmed';
    
    // Map status to display info
    const statusMap: Record<string, { label: string; icon: 'check' | 'clock' | 'plane' | 'cancel'; color: 'emerald' | 'amber' | 'blue' | 'rose' }> = {
      'confirmed': { label: 'Confirmed', icon: 'check', color: 'blue' },
      'checked-in': { label: 'Checked In', icon: 'check', color: 'emerald' },
      'checkedin': { label: 'Checked In', icon: 'check', color: 'emerald' },
      'checked_in': { label: 'Checked In', icon: 'check', color: 'emerald' },
      'active': { label: 'Checked In', icon: 'check', color: 'emerald' },
      'in-house': { label: 'Checked In', icon: 'check', color: 'emerald' },
      'checked-out': { label: 'Checked Out', icon: 'check', color: 'amber' },
      'checkedout': { label: 'Checked Out', icon: 'check', color: 'amber' },
      'checked_out': { label: 'Checked Out', icon: 'check', color: 'amber' },
      'pending': { label: 'Pending', icon: 'clock', color: 'amber' },
      'arriving': { label: 'Arriving Soon', icon: 'plane', color: 'blue' },
      'cancelled': { label: 'Cancelled', icon: 'cancel', color: 'rose' },
      'canceled': { label: 'Cancelled', icon: 'cancel', color: 'rose' },
      'no-show': { label: 'No Show', icon: 'cancel', color: 'rose' },
      'noshow': { label: 'No Show', icon: 'cancel', color: 'rose' }
    };
    
    return statusMap[status] || { label: status.charAt(0).toUpperCase() + status.slice(1), icon: 'clock' as const, color: 'amber' as const };
  }, [reservation.status]);
  
  // Calculate days until check-in or days remaining
  const stayInfo = useMemo(() => {
    const today = new Date();
    const checkIn = new Date(reservation.startDate);
    const checkOut = new Date(reservation.endDate);
    const daysUntilCheckIn = differenceInDays(checkIn, today);
    const daysRemaining = differenceInDays(checkOut, today);
    const totalNights = differenceInDays(checkOut, checkIn);
    
    return {
      daysUntilCheckIn,
      daysRemaining,
      totalNights,
      isBeforeCheckIn: daysUntilCheckIn > 0,
      isDuringStay: daysUntilCheckIn <= 0 && daysRemaining >= 0,
      isAfterCheckOut: daysRemaining < 0,
    };
  }, [reservation.startDate, reservation.endDate]);

  const openDetailsModal = (extra: any) => {
    // For Dashboard, we'll just show all extras view instead of modal
    setShowAllExtras(true);
  };

  // Combine all extras (services, meal plans, packages)
  const allExtras = [
    ...(services || []).map((s: any) => ({ ...s, type: 'service' })),
    ...(mealPlans || []).map((m: any) => ({ ...m, type: 'mealPlan' })),
    ...(packages || []).map((p: any) => ({ ...p, type: 'package' })),
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 pb-24">
      {/* Floating Header */}
      <header className="fixed top-0 left-0 right-0 z-50">
        <div className="w-full px-3 sm:px-6 py-2 sm:py-3">
          <div className="bg-white/90 backdrop-blur-xl border border-white/20 shadow-lg shadow-black/5 rounded-xl sm:rounded-2xl px-3 sm:px-6 py-2.5 sm:py-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
                <div className="relative flex-shrink-0">
                  <img
                    src={effectiveLogo}
                    alt={property?.name || 'Logo'}
                    className="h-10 sm:h-12 object-contain"
                  />
                </div>
                <div className="hidden sm:block border-l border-slate-200 pl-3 sm:pl-4 min-w-0">
                  <p className="text-xs sm:text-sm font-bold text-slate-900 truncate">{property?.name || 'Property'}</p>
                  <p className="text-xs text-slate-500 truncate">{property?.address || 'Address'}</p>
                </div>
              </div>
              <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                {effectivePhone && (
                  <>
                    <a 
                      href={`tel:${effectivePhone}`}
                      className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors"
                    >
                      <Phone className="w-3.5 h-3.5 text-slate-600" />
                      <span className="text-xs font-medium text-slate-700">{effectivePhone}</span>
                    </a>
                    <a 
                      href={`tel:${effectivePhone}`}
                      className="sm:hidden p-2 rounded-lg hover:bg-slate-100 transition-all group"
                      title={`Call ${effectivePhone}`}
                    >
                      <Phone className="w-4 h-4 text-slate-600 group-hover:text-slate-900 transition-colors" />
                    </a>
                  </>
                )}
                <button 
                  onClick={onLogout}
                  className="p-2 rounded-lg hover:bg-slate-100 transition-all group"
                  title="Logout"
                >
                  <LogOut className="w-4 h-4 text-slate-400 group-hover:text-slate-700 transition-colors" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="w-full px-3 sm:px-6 pt-20 sm:pt-24 pb-6">
        {customContent ? (
          customContent
        ) : (
          <div className="space-y-3 sm:space-y-4">
            {/* Hero Banner with Room Images */}
            {roomTypeImages.length > 0 && (
              <section className="relative overflow-hidden rounded-2xl sm:rounded-3xl shadow-lg h-64 sm:h-80 lg:h-96 bg-slate-200">
                {/* Main Image */}
                <img 
                  src={roomTypeImages[currentImageIndex]} 
                  alt="Room"
                  className="w-full h-full object-cover transition-opacity duration-500"
                />
                
                {/* Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                
                {/* Navigation Controls */}
                {roomTypeImages.length > 1 && (
                  <>
                    <button
                      onClick={() => setCurrentImageIndex(prev => (prev - 1 + roomTypeImages.length) % roomTypeImages.length)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 z-10 p-2 sm:p-3 rounded-full bg-white/80 hover:bg-white shadow-lg transition-all hover:scale-110"
                    >
                      <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5 text-slate-900" />
                    </button>
                    
                    <button
                      onClick={() => setCurrentImageIndex(prev => (prev + 1) % roomTypeImages.length)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 z-10 p-2 sm:p-3 rounded-full bg-white/80 hover:bg-white shadow-lg transition-all hover:scale-110"
                    >
                      <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-slate-900" />
                    </button>
                    
                    {/* Image Indicators */}
                    <div className="absolute bottom-3 sm:bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 sm:gap-2 z-10">
                      {roomTypeImages.map((_, idx) => (
                        <button
                          key={idx}
                          onClick={() => setCurrentImageIndex(idx)}
                          className={`h-2 rounded-full transition-all ${
                            idx === currentImageIndex 
                              ? 'bg-white w-6 sm:w-8' 
                              : 'bg-white/50 hover:bg-white/70 w-2'
                          }`}
                        />
                      ))}
                    </div>
                  </>
                )}
              </section>
            )}
            
            {/* Hero Welcome Section */}
            <section className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 sm:p-6 shadow-lg">
              {/* Decorative background elements - hidden on mobile */}
              <div className="hidden sm:block absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-full blur-3xl" />
              <div className="hidden sm:block absolute bottom-0 left-0 w-64 h-64 bg-gradient-to-tr from-emerald-500/10 to-cyan-500/10 rounded-full blur-3xl" />
              
              <div className="relative z-10 space-y-3 sm:space-y-4">
                {/* Reservation Badge */}
                <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-3 py-1.5">
                  <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                  <span className="text-xs font-mono text-white/90">
                    #{reservation?.reservationNumber || reservation?.id}
                  </span>
                </div>

                {/* Welcome Message */}
                <div>
                  <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-1">
                    Welcome to your stay<br />
                    <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                      {guestName}
                    </span>
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-300 line-clamp-2">
                    {stayInfo.isBeforeCheckIn && `Your stay begins in ${stayInfo.daysUntilCheckIn} days. We can't wait to welcome you!`}
                    {stayInfo.isDuringStay && `You have ${stayInfo.daysRemaining} wonderful days remaining with us.`}
                    {stayInfo.isAfterCheckOut && `Thank you for staying with us! We hope to see you again soon.`}
                  </p>
                </div>

                {/* Check-in / Check-out */}
                <div className="flex items-center justify-between">
                  <div className="text-left">
                    <p className="text-xs text-white/60 uppercase tracking-wider font-semibold">Check-in</p>
                    <p className="text-lg sm:text-2xl font-bold text-white">{format(new Date(reservation.startDate), 'MMM dd')}</p>
                    <p className="text-xs text-white/70">{format(new Date(reservation.startDate), 'EEEE')}</p>
                  </div>
                  
                  <div className="flex flex-col items-center gap-1">
                    <ArrowRight className="w-5 h-5 text-white/40" />
                  </div>
                  
                  <div className="text-right">
                    <p className="text-xs text-white/60 uppercase tracking-wider font-semibold">Check-out</p>
                    <p className="text-lg sm:text-2xl font-bold text-white">{format(new Date(reservation.endDate), 'MMM dd')}</p>
                    <p className="text-xs text-white/70">{format(new Date(reservation.endDate), 'EEEE')}</p>
                  </div>
                </div>

                {/* Online Check-in Button */}
                <button 
                  onClick={() => setShowCheckInModal(true)}
                  className="w-full bg-white/90 hover:bg-white text-slate-900 font-semibold py-2.5 px-4 rounded-full transition-all"
                >
                  Online Check-in
                </button>

                {/* Room Details - Flat Layout - Display all rooms */}
                <div className="pt-2 border-t border-white/10 space-y-3">
                  {((reservation as any).rooms || []).map((reservationRoom: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between gap-3 p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                      <div className="flex-1">
                        <p className="text-sm sm:text-base font-bold text-white">
                          {reservationRoom.roomTypeName || 'Room'} - {reservationRoom.roomName}
                        </p>
                        <div className="flex items-center gap-3 mt-1.5 text-white/70">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-4 h-4" />
                            <span className="text-xs font-semibold">{stayInfo.totalNights}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Users className="w-4 h-4" />
                            <span className="text-xs font-semibold">{reservationRoom.adults || 0}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Users className="w-4 h-4 opacity-60" />
                            <span className="text-xs font-semibold">{reservationRoom.children || 0}</span>
                          </div>
                        </div>
                      </div>
                      <button 
                        onClick={() => setShowEditModal(true)}
                        className="p-2.5 rounded-lg hover:bg-white/20 transition-colors flex-shrink-0"
                      >
                        <FileText className="w-5 h-5 text-white/70 hover:text-white" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* Quick Actions Grid */}
            <section className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
              {/* View Bill */}
              <button 
                onClick={() => setActiveTab('bill')}
                className="group relative overflow-hidden bg-gradient-to-br from-white to-slate-50 border border-slate-200 rounded-xl sm:rounded-2xl p-3 sm:p-5 shadow-sm hover:shadow-md transition-all duration-300 text-left"
              >
                <div className="hidden sm:block absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500" />
                <div className="relative z-10">
                  <div className="inline-flex p-2 sm:p-3 rounded-lg sm:rounded-xl bg-emerald-100 group-hover:bg-emerald-200 transition-colors mb-2 sm:mb-3">
                    <CreditCard className="w-4 h-4 sm:w-6 sm:h-6 text-emerald-600" />
                  </div>
                  <h4 className="font-bold text-slate-900 mb-0.5 sm:mb-1 text-xs sm:text-sm">Bill</h4>
                  <p className="text-sm sm:text-lg font-black bg-gradient-to-r from-emerald-600 to-cyan-600 bg-clip-text text-transparent line-clamp-1">
                    {property?.currency || '$'}{(summary?.totalAmount || 0).toFixed(0)}
                  </p>
                  <div className="hidden sm:flex items-center gap-1 mt-1.5 text-xs text-slate-500 group-hover:text-slate-700 transition-colors">
                    <span>Details</span>
                    <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              </button>

              {/* Chat */}
              <button 
                onClick={() => setActiveTab('chat')}
                className="group relative overflow-hidden bg-gradient-to-br from-white to-slate-50 border border-slate-200 rounded-xl sm:rounded-2xl p-3 sm:p-5 shadow-sm hover:shadow-md transition-all duration-300 text-left"
              >
                <div className="hidden sm:block absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500" />
                <div className="relative z-10">
                  <div className="inline-flex p-2 sm:p-3 rounded-lg sm:rounded-xl bg-blue-100 group-hover:bg-blue-200 transition-colors mb-2 sm:mb-3">
                    <MessageSquare className="w-4 h-4 sm:w-6 sm:h-6 text-blue-600" />
                  </div>
                  <h4 className="font-bold text-slate-900 mb-0.5 sm:mb-1 text-xs sm:text-sm">Chat</h4>
                  <p className="text-xs text-slate-600">Message</p>
                  <div className="hidden sm:flex items-center gap-1 mt-1.5 text-xs text-slate-500 group-hover:text-slate-700 transition-colors">
                    <span>Start chat</span>
                    <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              </button>

              {/* Housekeeping */}
              <button 
                onClick={() => triggerToast('Housekeeping request sent!')}
                className="group relative overflow-hidden bg-gradient-to-br from-white to-slate-50 border border-slate-200 rounded-xl sm:rounded-2xl p-3 sm:p-5 shadow-sm hover:shadow-md transition-all duration-300 text-left"
              >
                <div className="hidden sm:block absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-amber-500/10 to-orange-500/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500" />
                <div className="relative z-10">
                  <div className="inline-flex p-2 sm:p-3 rounded-lg sm:rounded-xl bg-amber-100 group-hover:bg-amber-200 transition-colors mb-2 sm:mb-3">
                    <Bell className="w-4 h-4 sm:w-6 sm:h-6 text-amber-600" />
                  </div>
                  <h4 className="font-bold text-slate-900 mb-0.5 sm:mb-1 text-xs sm:text-sm">Service</h4>
                  <p className="text-xs text-slate-600">Request</p>
                  <div className="hidden sm:flex items-center gap-1 mt-1.5 text-xs text-slate-500 group-hover:text-slate-700 transition-colors">
                    <span>Request</span>
                    <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              </button>

              {/* Profile */}
              <button 
                onClick={() => setActiveTab('profile')}
                className="group relative overflow-hidden bg-gradient-to-br from-white to-slate-50 border border-slate-200 rounded-xl sm:rounded-2xl p-3 sm:p-5 shadow-sm hover:shadow-md transition-all duration-300 text-left"
              >
                <div className="hidden sm:block absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500" />
                <div className="relative z-10">
                  <div className="inline-flex p-2 sm:p-3 rounded-lg sm:rounded-xl bg-purple-100 group-hover:bg-purple-200 transition-colors mb-2 sm:mb-3">
                    <User className="w-4 h-4 sm:w-6 sm:h-6 text-purple-600" />
                  </div>
                  <h4 className="font-bold text-slate-900 mb-0.5 sm:mb-1 text-xs sm:text-sm">Profile</h4>
                  <p className="text-xs text-slate-600">Info</p>
                  <div className="hidden sm:flex items-center gap-1 mt-1.5 text-xs text-slate-500 group-hover:text-slate-700 transition-colors">
                    <span>Manage</span>
                    <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              </button>
            </section>

            {/* Experiences Section */}
            {allExtras.length > 0 && (
              <section className="space-y-2 sm:space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h3 className="text-base sm:text-xl font-bold text-slate-900">Enhance Stay</h3>
                    <p className="text-xs sm:text-xs text-slate-600 hidden sm:block">Discover experiences</p>
                  </div>
                  <button
                    onClick={() => setShowAllExtras(true)}
                    className="flex items-center gap-1 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg sm:rounded-xl bg-slate-900 text-white text-xs sm:text-sm font-semibold hover:bg-slate-800 transition-colors flex-shrink-0"
                  >
                    <span>All</span>
                    <ArrowRight className="w-3 h-3 hidden sm:block" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                  {allExtras.slice(0, 4).map((extra, index) => (
                    <div 
                      key={index} 
                      className="group relative overflow-hidden bg-white rounded-lg sm:rounded-2xl border border-slate-200 shadow-sm hover:shadow-lg transition-all duration-300"
                    >
                      {extra.imageUrl ? (
                        <div className="relative h-40 sm:h-48 overflow-hidden">
                          <img 
                            src={extra.imageUrl} 
                            alt={extra.name}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                          />
                          {/* Gradient Overlay */}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                          
                          {/* Category Badge */}
                          <div className="absolute top-2 sm:top-3 left-2 sm:left-4">
                            <div className="inline-flex items-center gap-1 bg-white/95 backdrop-blur-sm px-2 py-1 sm:px-3 sm:py-1.5 rounded-full">
                              {extra.type === 'service' ? (
                                <Sparkles className="w-3 h-3 text-blue-600" />
                              ) : extra.type === 'mealPlan' ? (
                                <UtensilsIcon className="w-3 h-3 text-orange-600" />
                              ) : (
                                <PackageIcon className="w-3 h-3 text-purple-600" />
                              )}
                              <span className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                                {extra.type === 'service' ? 'Service' : extra.type === 'mealPlan' ? 'Dining' : 'Package'}
                              </span>
                            </div>
                          </div>

                          {/* Content Overlay */}
                          <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-4">
                            <h4 className="text-sm sm:text-lg font-bold text-white mb-1 line-clamp-1">{extra.name}</h4>
                            <p className="text-xs text-white/90 mb-2 line-clamp-1">{extra.description}</p>
                            
                            <div className="flex items-center justify-between">
                              <div>
                                <span className="text-lg sm:text-xl font-black text-white">
                                  {property?.currency || '$'}{extra.price || 0}
                                </span>
                              </div>
                              <button
                                onClick={() => triggerToast(`Added!`)}
                                className="px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg sm:rounded-xl bg-white text-slate-900 text-xs sm:text-sm font-bold hover:bg-slate-100 transition-colors shadow-md"
                              >
                                Add
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="p-3 sm:p-4">
                          <div className="flex items-start gap-3">
                            <div className={`p-2.5 sm:p-3 rounded-lg sm:rounded-xl flex-shrink-0 ${
                              extra.type === 'service' ? 'bg-blue-100' :
                              extra.type === 'mealPlan' ? 'bg-orange-100' :
                              'bg-purple-100'
                            }`}>
                              {extra.type === 'service' ? (
                                <Sparkles className="w-5 h-5 text-blue-600" />
                              ) : extra.type === 'mealPlan' ? (
                                <UtensilsIcon className="w-5 h-5 text-orange-600" />
                              ) : (
                                <PackageIcon className="w-5 h-5 text-purple-600" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2 mb-1">
                                <h4 className="text-sm sm:text-base font-bold text-slate-900 line-clamp-1">{extra.name}</h4>
                                <span className="text-sm sm:text-base font-black text-slate-900 flex-shrink-0">
                                  {property?.currency || '$'}{extra.price || 0}
                                </span>
                              </div>
                              <p className="text-sm text-slate-600 mb-4 line-clamp-2">{extra.description}</p>
                              <button
                                onClick={() => triggerToast(`${extra.name} added!`)}
                                className="w-full py-2.5 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition-colors"
                              >
                                Add to Stay
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Property Amenities Highlight - Hidden on mobile to save space */}
            <section className="hidden sm:block bg-gradient-to-br from-blue-50 via-white to-purple-50 rounded-2xl border border-slate-200 p-6 sm:p-8">
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 mb-5 sm:mb-6">Property Amenities</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
                {[
                  { icon: Wifi, label: 'WiFi', color: 'text-blue-600', bg: 'bg-blue-100' },
                  { icon: Coffee, label: 'Breakfast', color: 'text-amber-600', bg: 'bg-amber-100' },
                  { icon: Wind, label: 'AC', color: 'text-cyan-600', bg: 'bg-cyan-100' },
                  { icon: Star, label: 'Premium', color: 'text-purple-600', bg: 'bg-purple-100' },
                ].map((amenity, index) => (
                  <div key={index} className="flex flex-col items-center text-center gap-2 sm:gap-3">
                    <div className={`p-2.5 sm:p-4 rounded-lg sm:rounded-2xl ${amenity.bg}`}>
                      <amenity.icon className={`w-5 h-5 sm:w-6 sm:h-6 ${amenity.color}`} />
                    </div>
                    <span className="text-xs sm:text-sm font-semibold text-slate-700 line-clamp-1">{amenity.label}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </main>

      {/* Modern Bottom Navigation - Fully Responsive */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 pb-safe">
        <div className="w-full px-2 sm:px-4 pb-3 sm:pb-4">
          <div className="bg-slate-900/95 backdrop-blur-2xl border border-white/10 shadow-xl rounded-xl sm:rounded-2xl px-2 py-2 sm:py-3">
            <div className="flex items-center justify-between w-full gap-0.5 sm:gap-2">
              {[
                { id: 'home', icon: Home, label: 'Home' },
                { id: 'chat', icon: MessageSquare, label: 'Chat' },
                { id: 'bill', icon: DollarSign, label: 'Bill' },
                { id: 'reviews', icon: Star, label: 'Reviews' },
                { id: 'profile', icon: User, label: 'Profile' },
              ].map(tab => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`relative flex-1 flex flex-col items-center justify-center gap-0.5 px-1 py-1.5 sm:py-2.5 rounded-lg transition-all duration-300 ${
                      isActive 
                        ? 'bg-white/15 scale-105' 
                        : 'hover:bg-white/5'
                    }`}
                  >
                    <Icon className={`w-4 h-4 sm:w-5 sm:h-5 transition-colors flex-shrink-0 ${
                      isActive ? 'text-white' : 'text-white/60'
                    }`} />
                    <span className={`text-xs font-semibold transition-colors line-clamp-1 leading-tight ${
                      isActive ? 'text-white' : 'text-white/60'
                    }`}>
                      {tab.label}
                    </span>
                    {isActive && (
                      <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-white rounded-full" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </nav>

      {/* Enhanced Toast Notification */}
      {showToast && (
        <div className="fixed top-32 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-top-4 duration-300">
          <div className="bg-slate-900 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 border border-white/10">
            <div className="p-2 rounded-xl bg-emerald-500/20">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            </div>
            <span className="text-sm font-semibold">{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Check-in Form Modal */}
      {showCheckInModal && (
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowCheckInModal(false)}
          />
          
          {/* Modal */}
          <div className="relative bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-200 sticky top-0 bg-white rounded-t-3xl">
              <div className="flex items-center gap-3">
                <Key className="w-5 h-5 text-slate-700" />
                <h2 className="text-lg font-bold text-slate-900">Check-in Form</h2>
              </div>
              <button
                onClick={() => setShowCheckInModal(false)}
                className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-600" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Progress Bar */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wide">Check-in Progress</h3>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-500 transition-all duration-300"
                        style={{ width: `${(Object.values(checkInProgress).filter(Boolean).length / 3) * 100}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-slate-600">
                    {Object.values(checkInProgress).filter(Boolean).length}/3
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { key: 'idVerified', label: 'ID Verified' },
                    { key: 'paymentConfirmed', label: 'Payment Confirmed' },
                    { key: 'keyIssued', label: 'Key Issued' }
                  ].map((item) => (
                    <div key={item.key} className="flex items-center gap-2">
                      {checkInProgress[item.key as keyof typeof checkInProgress] ? (
                        <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border border-slate-300 flex-shrink-0" />
                      )}
                      <span className="text-xs font-semibold text-slate-600">{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Room Cards - Multiple rooms support */}
              <div className="space-y-3">
                {((reservation as any).rooms || []).map((reservationRoom: any, idx: number) => {
                  const roomImages = roomImagesMap[idx] || [];
                  const currentIdx = roomImageIndices[idx] || 0;
                  
                  return (
                    <div key={idx} className="rounded-xl border border-slate-200 overflow-hidden">
                      {roomImages.length > 0 ? (
                        <div className="relative overflow-hidden bg-slate-200 h-40 sm:h-48 group">
                          <img 
                            src={roomImages[currentIdx]} 
                            alt="Room" 
                            className="w-full h-full object-cover transition-opacity duration-500"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                          
                          {roomImages.length > 1 && (
                            <>
                              {/* Previous button */}
                              <button
                                onClick={() => setRoomImageIndices(prev => ({
                                  ...prev,
                                  [idx]: (currentIdx - 1 + roomImages.length) % roomImages.length
                                }))}
                                className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-white/80 hover:bg-white rounded-lg transition-colors opacity-0 group-hover:opacity-100 z-10"
                              >
                                <ChevronLeft className="w-5 h-5 text-slate-700" />
                              </button>
                              
                              {/* Next button */}
                              <button
                                onClick={() => setRoomImageIndices(prev => ({
                                  ...prev,
                                  [idx]: (currentIdx + 1) % roomImages.length
                                }))}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-white/80 hover:bg-white rounded-lg transition-colors opacity-0 group-hover:opacity-100 z-10"
                              >
                                <ChevronRight className="w-5 h-5 text-slate-700" />
                              </button>
                              
                              {/* Image indicators */}
                              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
                                {roomImages.map((_, imgIdx) => (
                                  <button
                                    key={imgIdx}
                                    onClick={() => setRoomImageIndices(prev => ({ ...prev, [idx]: imgIdx }))}
                                    className={`h-1.5 rounded-full transition-all ${
                                      imgIdx === currentIdx ? 'bg-white w-4' : 'bg-white/60 w-1.5'
                                    }`}
                                  />
                                ))}
                              </div>
                            </>
                          )}
                        </div>
                      ) : (
                        <div className="bg-gradient-to-br from-blue-100 to-slate-100 h-40 sm:h-48 flex items-center justify-center">
                          <Bed className="w-12 h-12 text-slate-400" />
                        </div>
                      )}
                      
                      <div className="p-4">
                        <p className="text-sm font-semibold text-slate-600">
                          {reservationRoom.roomTypeName || 'Room'} - {reservationRoom.roomName}
                        </p>
                        <p className="text-sm text-slate-600 mt-1">
                          Your home for the next {stayInfo.totalNights} {stayInfo.totalNights === 1 ? 'night' : 'nights'}.
                        </p>
                        {reservationRoom.price && (
                          <p className="text-xs text-slate-500 mt-2">
                            Price: {property?.currency || 'USD'} {reservationRoom.price}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ID Upload Section */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">Guest ID Verification</h3>
                <p className="text-xs text-slate-600">Please upload ID documents for all adult guests on the reservation.</p>
                
                {/* Get only adult guests in order */}
                {[
                  { 
                    index: 0, 
                    name: guestIdDocuments[0]?.guestName || reservation.guestName || 'Main Guest', 
                    isMain: true,
                    displayName: reservation.guestName || 'Main Guest'
                  },
                  ...((reservation as any).additionalGuests || [])
                    .map((guest: any, idx: number) => ({
                      index: idx + 1,
                      name: guestIdDocuments[idx + 1]?.guestName || guest.name || `Adult Guest ${idx + 1}`,
                      isMain: false,
                      displayName: guest.name || `Adult Guest ${idx + 1}`
                    }))
                ].map((guest) => (
                  <div key={guest.index} className="space-y-4 p-4 rounded-lg bg-slate-50 border border-slate-200">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-slate-600 block">Guest Name {guest.isMain ? '(Main Guest)' : ''}</label>
                      <input 
                        type="text"
                        value={guestIdDocuments[guest.index]?.guestName || guest.displayName}
                        onChange={(e) => {
                          const updated = {
                            ...guestIdDocuments,
                            [guest.index]: {
                              guestName: e.target.value,
                              type: guestIdDocuments[guest.index]?.type || '',
                              files: guestIdDocuments[guest.index]?.files || [{ file: null, preview: null, side: 'front' }, { file: null, preview: null, side: 'back' }]
                            }
                          };
                          setGuestIdDocuments(updated);
                          sessionStorage.setItem('guestCheckInDocs', JSON.stringify(updated));
                        }}
                        placeholder={guest.displayName}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-slate-600 block">ID Type</label>
                      <select 
                        value={guestIdDocuments[guest.index]?.type || ''}
                        onChange={(e) => {
                          const updated = {
                            ...guestIdDocuments,
                            [guest.index]: { 
                              guestName: guestIdDocuments[guest.index]?.guestName || guest.displayName,
                              type: e.target.value, 
                              files: guestIdDocuments[guest.index]?.files || [{ file: null, preview: null, side: 'front' }, { file: null, preview: null, side: 'back' }]
                            }
                          };
                          setGuestIdDocuments(updated);
                          sessionStorage.setItem('guestCheckInDocs', JSON.stringify(updated));
                        }}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select ID Type</option>
                        <option value="passport">Passport</option>
                        <option value="driver-license">Driver's License</option>
                        <option value="national-id">National ID</option>
                        <option value="visa">Visa</option>
                      </select>
                    </div>

                    {/* Document Upload - Front & Back */}
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { side: 'front' as const, label: 'Front Side' },
                        { side: 'back' as const, label: 'Back Side' }
                      ].map((doc) => {
                        const fileData = guestIdDocuments[guest.index]?.files?.find(f => f.side === doc.side);
                        return (
                          <div key={doc.side} className="space-y-2">
                            <label className="text-xs font-semibold text-slate-600 block">{doc.label}</label>
                            
                            {/* Preview Thumbnail */}
                            {fileData?.preview && (
                              <div className="relative rounded-lg overflow-hidden border border-slate-300 bg-white h-24">
                                {fileData.preview.startsWith('data:image') ? (
                                  <img src={fileData.preview} alt={`${guest.name} ${doc.side}`} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center bg-slate-100">
                                    <FileText className="w-6 h-6 text-slate-400" />
                                  </div>
                                )}
                                <button
                                  onClick={() => {
                                    const updated = {
                                      ...guestIdDocuments,
                                      [guest.index]: {
                                        guestName: guestIdDocuments[guest.index]?.guestName || guest.displayName,
                                        type: guestIdDocuments[guest.index]?.type || '',
                                        files: (guestIdDocuments[guest.index]?.files || []).map(f =>
                                          f.side === doc.side ? { file: null, preview: null, side: doc.side } : f
                                        )
                                      }
                                    };
                                    setGuestIdDocuments(updated);
                                    sessionStorage.setItem('guestCheckInDocs', JSON.stringify(updated));
                                  }}
                                  className="absolute top-1 right-1 p-1 bg-red-500 hover:bg-red-600 rounded text-white"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                            
                            {/* Upload Area */}
                            {!fileData?.preview && (
                              <div className="relative border-2 border-dashed border-slate-300 rounded-lg p-3 text-center hover:border-blue-500 transition-colors cursor-pointer">
                                <input 
                                  type="file"
                                  accept="image/*,.pdf"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      const reader = new FileReader();
                                      reader.onloadend = () => {
                                        const preview = reader.result as string;
                                        const updated = {
                                          ...guestIdDocuments,
                                          [guest.index]: {
                                            guestName: guestIdDocuments[guest.index]?.guestName || guest.displayName,
                                            type: guestIdDocuments[guest.index]?.type || '',
                                            files: (guestIdDocuments[guest.index]?.files || []).map(f =>
                                              f.side === doc.side ? { file, preview, side: doc.side } : f
                                            )
                                          }
                                        };
                                        setGuestIdDocuments(updated);
                                        // Save to sessionStorage (without File objects)
                                        const toStore = {
                                          ...updated,
                                          [guest.index]: {
                                            ...updated[guest.index],
                                            files: updated[guest.index].files.map(f => ({
                                              preview: f.preview,
                                              side: f.side
                                            }))
                                          }
                                        };
                                        sessionStorage.setItem('guestCheckInDocs', JSON.stringify(toStore));
                                      };
                                      reader.readAsDataURL(file);
                                    }
                                  }}
                                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                />
                                <div className="flex flex-col items-center gap-1">
                                  <Upload className="w-4 h-4 text-slate-400" />
                                  <p className="text-xs font-semibold text-slate-600">Click to upload</p>
                                  <p className="text-xs text-slate-500">PNG, JPG, PDF</p>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button 
                  onClick={() => {
                    // Validate that all guests have uploaded documents
                    const allGuestIndices = [
                      0,
                      ...((reservation as any).additionalGuests || []).map((_: any, idx: number) => idx + 1)
                    ];
                    
                    const allDocumentsUploaded = allGuestIndices.every(idx => {
                      const docs = guestIdDocuments[idx]?.files || [];
                      return docs.every(d => d.preview !== null);
                    });

                    if (!allDocumentsUploaded) {
                      triggerToast('Please upload all ID documents (front & back) for all guests');
                      return;
                    }

                    setCheckInProgress(prev => ({ ...prev, idVerified: true, paymentConfirmed: true, keyIssued: true }));
                    triggerToast('Check-in completed!');
                    
                    // Clear session storage after successful check-in
                    sessionStorage.removeItem('guestCheckInDocs');
                    
                    setTimeout(() => setShowCheckInModal(false), 500);
                  }}
                  className="flex-1 py-3 px-4 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-colors disabled:opacity-50"
                >
                  Complete Check-in
                </button>
                <button 
                  onClick={() => triggerToast('Digital key sent to your phone')}
                  className="flex-1 py-3 px-4 rounded-full border border-slate-300 hover:bg-slate-50 text-slate-900 font-semibold transition-colors"
                >
                  View Digital Key
                </button>
              </div>

              {/* Help Center */}
              <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-200">
                <button className="flex items-center justify-center gap-2 py-3 px-4 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-900 font-semibold text-sm transition-colors">
                  <MessageCircle className="w-4 h-4" />
                  Chat with Front Desk
                </button>
                <button className="flex items-center justify-center gap-2 py-3 px-4 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-900 font-semibold text-sm transition-colors">
                  <MapPin className="w-4 h-4" />
                  Map to Property
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Reservation Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowEditModal(false)}
          />
          
          {/* Modal */}
          <div className="relative bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-200 sticky top-0 bg-white rounded-t-3xl">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-slate-700" />
                <h2 className="text-lg font-bold text-slate-900">Edit Reservation</h2>
              </div>
              <button
                onClick={() => setShowEditModal(false)}
                className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-600" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              {/* Dates */}
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <Calendar className="w-5 h-5 text-slate-600" />
                  <span className="text-sm font-semibold text-slate-600 uppercase tracking-wide">Dates</span>
                </div>
                <p className="text-slate-900 font-semibold">
                  {format(new Date(reservation.startDate), 'MM/dd/yyyy')} - {format(new Date(reservation.endDate), 'MM/dd/yyyy')}
                </p>
              </div>

              {/* Accommodation Type */}
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <Building2 className="w-5 h-5 text-slate-600" />
                  <span className="text-sm font-semibold text-slate-600 uppercase tracking-wide">Accommodation Type</span>
                </div>
                <p className="text-slate-900 font-semibold">
                  {rooms.map((room: any) => `${room.type || ''} - ${room.name || ''}`).join(', ')}
                </p>
              </div>

              {/* Guests */}
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <Users className="w-5 h-5 text-slate-600" />
                  <span className="text-sm font-semibold text-slate-600 uppercase tracking-wide">Guests</span>
                </div>
                <p className="text-slate-900 font-semibold">
                  {(reservation as any).adults || 1} Adults - {(reservation as any).children || 0} children
                </p>
              </div>

              {/* Cancel Reservation Button */}
              <button
                onClick={() => {
                  triggerToast('Cancellation requested');
                  setShowEditModal(false);
                }}
                className="w-full mt-6 py-3 px-4 rounded-full bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 font-semibold flex items-center justify-center gap-2 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Cancel reservation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;