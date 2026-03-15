"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format, differenceInDays, startOfDay } from "date-fns";
import { toDate } from '@/lib/dateUtils';
import type { DateRange } from "react-day-picker";
import { useAuth } from '@/contexts/auth-context';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, serverTimestamp, doc, updateDoc, Timestamp, setDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

import type { RoomType } from '@/types/roomType';
import type { Room } from '@/types/room';
import type { Reservation, SelectedExtra, ReservationRoom } from '@/components/calendar/types';
import type { RatePlan } from '@/types/ratePlan';
import type { Promotion } from '@/types/promotion';
import type { AvailabilitySetting } from '@/types/availabilityOverride';
import type { Service } from '@/types/service';
import type { MealPlan } from '@/types/mealPlan';
import { useTranslation } from 'react-i18next';
import { countries } from '@/lib/countries';
import { Combobox } from '../ui/combobox';
import { PhoneInput } from '../ui/phone-input';
import { Checkbox } from "@/components/ui/checkbox";
import {
  X, ArrowRight, Trash2, Tag, User, Mail, Phone, MapPin, CreditCard, Calendar,
  Box, Utensils, Globe, ChevronDown, ChevronUp, Plus, Check, Info, Wallet
} from 'lucide-react';

interface ReservationFormProps {
  onClose: () => void;
  initialData?: Reservation | null;
}

type PricingMode = 'rate_plan' | 'manual';

export default function ReservationForm({ onClose, initialData }: ReservationFormProps) {
  const { user, property } = useAuth();
  const { t } = useTranslation(['pages/dashboard/reservation-form', 'country']);
  const [propertyId, setPropertyId] = useState<string | null>(null);

  // Brand Configuration
  const THEME_COLOR = '#003166';
  const BORDER_RADIUS = 'rounded-md';

  // Data states
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [allPropertyRooms, setAllPropertyRooms] = useState<Room[]>([]);
  const [allRatePlans, setAllRatePlans] = useState<RatePlan[]>([]);
  const [allReservations, setAllReservations] = useState<Reservation[]>([]);
  const [allServices, setAllServices] = useState<Service[]>([]);
  const [allMealPlans, setAllMealPlans] = useState<MealPlan[]>([]);
  const [availabilitySettings, setAvailabilitySettings] = useState<AvailabilitySetting[]>([]);
  const [allPromotions, setAllPromotions] = useState<Promotion[]>([]);
  
  // Room selections
  const [rooms, setRooms] = useState<ReservationRoom[]>([]);
  const [expandedRooms, setExpandedRooms] = useState<Set<string>>(new Set());
  
  // Current room being added
  const [currentRoom, setCurrentRoom] = useState({
    adults: 1,
    children: 0,
    roomTypeId: '',
    roomId: '',
    pricingMode: 'rate-plan' as 'rate-plan' | 'manual',
    ratePlanId: '',
    manualPrice: 0,
    extras: [] as string[],
  });

  // Guest details
  const [guestDetails, setGuestDetails] = useState({
    fullName: '',
    email: '',
    phone: '',
    country: 'Morocco',
    passportOrId: '',
  });

  // Booking details
  const [dateRange, setDateRange] = useState<DateRange | undefined>(
    initialData ? { from: toDate(initialData.startDate) as Date, to: toDate(initialData.endDate) as Date } : undefined
  );
  
  // Status and source
  const [source, setSource] = useState('Direct');
  const [resStatus, setResStatus] = useState<'pending' | 'confirmed' | 'Canceled' | 'No-show'>('pending');
  const [payStatus, setPayStatus] = useState<'pending' | 'partial' | 'paid' | 'refunded'>('pending');
  const [payMethod, setPayMethod] = useState('Cash');
  const [partialPaymentAmount, setPartialPaymentAmount] = useState<number | ''>(initialData?.partialPaymentAmount || '');
  const [refundTypeLocal, setRefundTypeLocal] = useState<'full' | 'partial'>('full');
  const [refundedAmountLocal, setRefundedAmountLocal] = useState<number | ''>(initialData && (initialData as any).refundedAmount ? (initialData as any).refundedAmount : '');

  // Pricing
  const [appliedPromotion, setAppliedPromotion] = useState<Promotion | null>(null);
  const [coupon, setCoupon] = useState('');
  const [promotion, setPromotion] = useState('none');
  
  const currencySymbol = property?.currency || '$';
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  // Calculate extra total
  const calculateExtraItemTotal = useCallback((extra: SelectedExtra, nights: number, roomGuests: {adults: number, children: number}) => {
    if (nights <= 0) return 0;
    const totalGuests = Number(roomGuests.adults) + Number(roomGuests.children);
    let itemTotal = 0;
    switch(extra.unit) {
        case 'one_time':
        case 'per_booking':
        case 'one_time_per_room':
            itemTotal = extra.price * extra.quantity; break;
        case 'per_night':
        case 'per_night_per_room':
            itemTotal = extra.price * nights * extra.quantity; break;
        case 'per_guest':
        case 'one_time_per_guest':
            itemTotal = extra.price * totalGuests * extra.quantity; break;
        case 'per_night_per_guest':
            itemTotal = extra.price * nights * totalGuests * extra.quantity; break;
        default: itemTotal = extra.price * extra.quantity;
    }
    return itemTotal;
  }, []);

  // Calculate nights
  const nights = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return 0;
    return differenceInDays(dateRange.to, dateRange.from);
  }, [dateRange]);

  // Extra categories
  const extraCategories = useMemo(() => [
    {
      label: 'Services',
      icon: <Box size={16} style={{ color: THEME_COLOR }} />,
      items: allServices.map(s => ({ id: s.id, name: s.name, price: s.price, unit: s.unit }))
    },
    {
      label: 'Meal Plans',
      icon: <Utensils size={16} style={{ color: THEME_COLOR }} />,
      items: allMealPlans.map(m => ({ id: m.id, name: m.name, price: m.price, unit: m.unit }))
    }
  ], [allServices, allMealPlans, THEME_COLOR]);

  // Handle add room
  const handleAddRoom = () => {
    const typeObj = roomTypes.find(t => t.id === currentRoom.roomTypeId);
    const roomObj = allPropertyRooms.find(r => r.id === currentRoom.roomId);
    const planObj = allRatePlans.find(p => p.id === currentRoom.ratePlanId);

    if (!typeObj || !roomObj) {
      toast({ 
        title: "Incomplete Selection", 
        description: "Please select both room type and specific room.", 
        variant: "destructive" 
      });
      return;
    }

    let pricePerNight = 0;
    if (currentRoom.pricingMode === 'manual') {
      pricePerNight = Number(currentRoom.manualPrice);
    } else {
      if (!planObj) {
        toast({ 
          title: "Rate Plan Required", 
          description: "Please select a rate plan.", 
          variant: "destructive" 
        });
        return;
      }
      if (planObj.pricingMethod === 'per_night') {
        pricePerNight = planObj.basePrice ?? typeObj.baseRate ?? 0;
      } else {
        const guestCount = currentRoom.adults;
        pricePerNight = planObj.pricingPerGuest?.[guestCount.toString()] || planObj.pricingPerGuest?.['1'] || typeObj.baseRate || 0;
      }
    }

    // Create selectedExtras from currentRoom.extras
    const selectedExtras: SelectedExtra[] = [];
    currentRoom.extras.forEach(extraId => {
      extraCategories.forEach(cat => {
        const item = cat.items.find(i => i.id === extraId);
        if (item) {
          const type = cat.label === 'Services' ? 'service' : 'meal_plan';
          selectedExtras.push({
            id: item.id,
            name: item.name,
            price: item.price,
            quantity: 1,
            unit: item.unit,
            type: type as 'service' | 'meal_plan',
            total: 0
          });
        }
      });
    });

    const newRoom: ReservationRoom = {
      roomId: roomObj.id,
      roomName: roomObj.name,
      roomTypeId: typeObj.id,
      roomTypeName: typeObj.name,
      ratePlanId: planObj?.id || '',
      ratePlanName: planObj?.planName || 'Manual Price',
      price: pricePerNight * nights,
      adults: currentRoom.adults,
      children: currentRoom.children,
      selectedExtras: selectedExtras,
      pricingMode: currentRoom.pricingMode === 'rate-plan' ? 'rate_plan' : 'manual',
      manualPrice: currentRoom.pricingMode === 'manual' ? Number(currentRoom.manualPrice) : undefined,
    };

    setRooms([...rooms, newRoom]);

    // Reset current room form
    setCurrentRoom({
      adults: 1,
      children: 0,
      roomTypeId: '',
      roomId: '',
      pricingMode: 'rate-plan',
      ratePlanId: '',
      manualPrice: 0,
      extras: []
    });
  };

  const removeRoom = (roomId: string) => setRooms(rooms.filter(r => r.roomId !== roomId));

  const toggleExtra = (itemId: string) => {
    setCurrentRoom(prev => ({
      ...prev,
      extras: prev.extras.includes(itemId)
        ? prev.extras.filter(id => id !== itemId)
        : [...prev.extras, itemId]
    }));
  };

  // Available rooms for current selection
  const availableRoomsForCurrentType = useMemo(() => {
    if (!currentRoom.roomTypeId) return [];
    
    const roomsForType = allPropertyRooms.filter(room => room.roomTypeId === currentRoom.roomTypeId);
    
    if (!dateRange?.from || !dateRange?.to) {
      return roomsForType.map(r => ({ ...r, isAvailable: true, reason: '' }));
    }

    const alreadySelectedRoomIds = new Set(rooms.map(s => s.roomId));
    
    return roomsForType.map(room => {
      if (alreadySelectedRoomIds.has(room.id)) {
        return { ...room, isAvailable: false, reason: 'Already selected' };
      }
      
      const hasConflict = allReservations.some(res => 
        res.id !== initialData?.id && 
        (res.rooms ? res.rooms.some(r => r.roomId === room.id) : res.roomId === room.id) &&
        res.status !== 'Canceled' && res.status !== 'No-Show' &&
        startOfDay(toDate(dateRange.from!) as Date) < startOfDay(toDate(res.endDate) as Date) && 
        startOfDay(toDate(dateRange.to!) as Date) > startOfDay(toDate(res.startDate) as Date)
      );

      if (hasConflict) {
        return { ...room, isAvailable: false, reason: 'Occupied' };
      }
      
      return { ...room, isAvailable: true, reason: '' };
    });
  }, [currentRoom.roomTypeId, allPropertyRooms, dateRange, allReservations, initialData?.id, rooms]);

  // Available promotions
  const { availableAutomaticPromos, hasCouponPromos } = useMemo(() => {
    if (allPromotions.length === 0 || rooms.length === 0 || !dateRange?.from || !dateRange?.to) {
      return { availableAutomaticPromos: [], hasCouponPromos: false };
    }

    const applicableRatePlanIds = new Set(rooms.map(s => s.ratePlanId));
    const checkInDate = startOfDay(toDate(dateRange.from) as Date);

    const autoPromos = allPromotions.filter(p => {
      if (p.couponCode) return false;

      const promoStart = startOfDay(toDate(p.startDate) as Date);
      const promoEnd = p.endDate ? startOfDay(toDate(p.endDate) as Date) : new Date('9999-12-31');
      
      const dateValid = checkInDate >= promoStart && checkInDate <= promoEnd;
      if (!dateValid) return false;
      
      const ratePlanValid = p.ratePlanIds.some(id => applicableRatePlanIds.has(id));
      return ratePlanValid;
    });

    const couponPromos = allPromotions.some(p => !!p.couponCode);

    return { availableAutomaticPromos: autoPromos, hasCouponPromos: couponPromos };
  }, [allPromotions, rooms, dateRange]);

  // Apply coupon
  const handleApplyCoupon = () => {
    if (!coupon.trim() || !dateRange?.from || !dateRange?.to) return;

    const promo = allPromotions.find(p => p.couponCode?.toUpperCase() === coupon.trim().toUpperCase());
    
    if (!promo) {
      toast({ title: "Invalid Coupon", description: "Coupon code not found.", variant: "destructive" });
      return;
    }
    
    const checkInDate = startOfDay(toDate(dateRange.from) as Date);
    const promoStart = startOfDay(toDate(promo.startDate) as Date);
    const promoEnd = promo.endDate ? startOfDay(toDate(promo.endDate) as Date) : new Date('9999-12-31');

    const isDateValid = checkInDate >= promoStart && checkInDate <= promoEnd;

    if (!isDateValid) {
      toast({ title: "Invalid Coupon", description: "Coupon is not valid for selected dates.", variant: "destructive" });
      return;
    }

    const appliesToSelection = rooms.some(sel => promo.ratePlanIds.includes(sel.ratePlanId));

    if (!appliesToSelection) {
      toast({ title: "Invalid Coupon", description: "Coupon doesn't apply to selected rate plans.", variant: "destructive" });
      return;
    }
    
    setAppliedPromotion({ ...promo });
    setPromotion('coupon');
    toast({ title: "Coupon Applied", description: `${promo.name} has been applied.` });
  };

  // Select auto promotion
  const handleAutoPromoSelect = (promoId: string) => {
    if (promoId === 'none') {
      setAppliedPromotion(null);
      setPromotion('none');
    } else {
      const promo = availableAutomaticPromos.find(p => p.id === promoId);
      setAppliedPromotion(promo ? { ...promo } : null);
      setPromotion(promoId);
    }
    setCoupon('');
  };

  // Calculate totals
  const summary = useMemo(() => {
    let roomsTotal = 0;
    let extrasTotal = 0;

    rooms.forEach(room => {
      roomsTotal += room.price || 0;
      
      (room.selectedExtras || []).forEach(extra => {
        extrasTotal += calculateExtraItemTotal(extra, nights, {adults: room.adults, children: room.children});
      });
    });

    const subtotal = roomsTotal + extrasTotal;
    
    let promoDiscount = 0;
    if (appliedPromotion) {
      if (appliedPromotion.discountType === 'percentage') {
        promoDiscount = subtotal * (appliedPromotion.discountValue / 100);
      } else {
        promoDiscount = appliedPromotion.discountValue * nights;
      }
    }

    const taxableAmount = subtotal - promoDiscount;
    const tax = property?.taxSettings?.enabled ? taxableAmount * ((property.taxSettings.rate || 0) / 100) : 0;
    const grandTotal = taxableAmount + tax;

    return { roomsTotal, extrasTotal, subtotal, tax, grandTotal, promoDiscount };
  }, [rooms, nights, appliedPromotion, property, calculateExtraItemTotal]);

  // Form submission
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    
    if (!propertyId || !guestDetails.fullName || rooms.length === 0 || !dateRange?.from || !dateRange?.to) {
      toast({ 
        title: "Missing Information", 
        description: "Please fill in all required fields and add at least one room.", 
        variant: "destructive" 
      });
      setIsSaving(false);
      return;
    }

    const startDate = dateRange.from;
    const endDate = dateRange.to;

      const reservationPayload: any = {
      propertyId: propertyId || null,
      guestId: null,
      guestName: guestDetails.fullName || '',
      guestEmail: guestDetails.email?.trim() || null,
      guestPhone: guestDetails.phone?.trim() || null,
      guestPassportOrId: guestDetails.passportOrId?.trim() || null,
      guestCountry: guestDetails.country || null,
      rooms: rooms.map(s => ({
        roomId: s.roomId || '',
        roomName: s.roomName || '',
        roomTypeId: s.roomTypeId || '',
        roomTypeName: s.roomTypeName || '',
        ratePlanId: s.ratePlanId || null,
        ratePlanName: s.ratePlanName || null,
        price: s.price ?? 0,
        adults: s.adults || 1,
        children: s.children || 0,
        pricingMode: s.pricingMode === 'manual' ? 'manual' : 'rate_plan',
        manualPrice: s.manualPrice ?? null,
        selectedExtras: (s.selectedExtras || []).map(e => ({
          id: e.id || '',
          name: e.name || '',
          price: e.price ?? 0,
          quantity: e.quantity ?? 1,
          unit: e.unit || '',
          type: e.type || 'service',
          total: calculateExtraItemTotal(e, nights, {adults: s.adults, children: s.children})
        })),
      })),
      startDate: Timestamp.fromDate(startDate),
      endDate: Timestamp.fromDate(endDate),
      status: resStatus === 'pending' ? 'Pending' : resStatus === 'confirmed' ? 'Confirmed' : resStatus === 'Canceled' ? 'Canceled' : 'No-Show',
      // Map local payStatus + refundTypeLocal into Firestore paymentStatus and refundedAmount
      paymentStatus: payStatus === 'pending' ? 'Pending' : payStatus === 'partial' ? 'Partial' : payStatus === 'paid' ? 'Paid' : (refundTypeLocal === 'partial' ? 'Partial-Refund' : 'Refunded'),
      refundedAmount: payStatus === 'refunded' ? (refundTypeLocal === 'partial' ? (Number(refundedAmountLocal) || 0) : (summary.netAmount ?? summary.grandTotal ?? 0)) : null,
      source: source || 'Direct',
      totalPrice: summary.grandTotal ?? 0,
      roomsTotal: summary.roomsTotal ?? 0,
      extrasTotal: summary.extrasTotal ?? 0,
      subtotal: summary.subtotal ?? 0,
      discountAmount: summary.promoDiscount ?? 0,
      netAmount: (summary.subtotal ?? 0) - (summary.promoDiscount ?? 0),
      taxAmount: summary.tax ?? 0,
      notes: '',
      partialPaymentAmount: payStatus === 'partial' ? (partialPaymentAmount || 0) : 0,
      paymentMethod: (payStatus === 'partial' || payStatus === 'paid') ? payMethod : null,
      promotionApplied: appliedPromotion ? {
        id: appliedPromotion.id || '',
        name: appliedPromotion.name || '',
        discountAmount: summary.promoDiscount ?? 0,
        discountType: appliedPromotion.discountType || 'percentage',
        discountValue: appliedPromotion.discountValue ?? 0
      } : null,
    };

    try {
      if (initialData?.id) {
        const resDocRef = doc(db, "reservations", initialData.id);
        await updateDoc(resDocRef, { ...reservationPayload, updatedAt: serverTimestamp() });
        toast({ title: "Success", description: "Reservation updated successfully." });
      } else {
        const newReservationRef = doc(collection(db, 'reservations'));
        await setDoc(newReservationRef, { ...reservationPayload, createdAt: serverTimestamp() });
        toast({ title: "Success", description: "Reservation created successfully." });
      }
      onClose();
    } catch (error) {
      toast({ 
        title: "Error", 
        description: `Failed to save reservation: ${(error as Error).message}`, 
        variant: "destructive" 
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Load property ID
  useEffect(() => {
    if (user?.propertyId) {
      setPropertyId(user.propertyId);
    }
  }, [user]);

  // Load prefilled guest data from sessionStorage (when creating reservation from guest list)
  useEffect(() => {
    if (typeof window !== 'undefined' && !initialData) {
      const prefilled = sessionStorage.getItem('prefilledGuestData');
      if (prefilled) {
        try {
          const guestData = JSON.parse(prefilled);
          setGuestDetails({
            fullName: guestData.fullName || '',
            email: guestData.email || '',
            phone: guestData.phone || '',
            country: guestData.country || 'Morocco',
            passportOrId: guestData.passportOrId || '',
          });
          // Clear from sessionStorage after loading
          sessionStorage.removeItem('prefilledGuestData');
        } catch (error) {
          console.error('Error loading prefilled guest data:', error);
        }
      }
    }
  }, [initialData]);

  // Load initial data
  useEffect(() => {
    if (initialData) {
      setGuestDetails({
        fullName: initialData.guestName || '',
        email: initialData.guestEmail || '',
        phone: initialData.guestPhone || '',
        country: initialData.guestCountry || 'Morocco',
        passportOrId: initialData.guestPassportOrId || '',
      });
      
      const startDate = initialData.startDate instanceof Date ? initialData.startDate : (initialData.startDate as Timestamp).toDate();
      const endDate = initialData.endDate instanceof Date ? initialData.endDate : (initialData.endDate as Timestamp).toDate();
      
      setDateRange({
        from: startDate,
        to: endDate
      });
      
      // Map various paymentStatus values into local payStatus and refund fields
      const ps = initialData.paymentStatus || '';
      if (ps === 'Pending') setPayStatus('pending');
      else if (ps === 'Paid') setPayStatus('paid');
      else if (ps === 'Partial') setPayStatus('partial');
      else if (ps === 'Partial-Refund' || ps === 'Partial-Refunded' || ps === 'PartialRefund') {
        setPayStatus('refunded');
        setRefundTypeLocal('partial');
      } else if (ps === 'Refunded') {
        setPayStatus('refunded');
        setRefundTypeLocal('full');
      } else {
        setPayStatus('pending');
      }
      setPartialPaymentAmount(initialData.partialPaymentAmount || '');
      setRefundedAmountLocal((initialData as any).refundedAmount ?? '');
      setPartialPaymentAmount(initialData.partialPaymentAmount || '');
      setResStatus(initialData.status === 'Pending' ? 'pending' : initialData.status === 'Confirmed' ? 'confirmed' : initialData.status === 'Canceled' ? 'Canceled' : 'No-show');
      
      setSource(initialData.source || 'Direct');
      
      if (initialData.rooms && initialData.rooms.length > 0) {
        // Auto-select default rate plan for each room if not set
        const filledRooms = (initialData.rooms as ReservationRoom[]).map(room => {
          if (!room.ratePlanId) {
            // Find default rate plan for this room type
            const defaultPlan = allRatePlans.find(rp => rp.roomTypeId === room.roomTypeId && rp.default);
            if (defaultPlan) {
              return {
                ...room,
                ratePlanId: defaultPlan.id,
                ratePlanName: defaultPlan.planName,
              };
            }
          }
          return room;
        });
        setRooms(filledRooms);
        // Force a re-render to ensure summary recalculates after rooms are set
        setTimeout(() => {
          // No-op: just to trigger a re-render if needed
        }, 0);
      }
    }
  }, [initialData]);

  // Recalculate prices for pre-filled rooms when rate plans data is loaded
  useEffect(() => {
    if (!initialData || !dateRange?.from || !dateRange?.to || allRatePlans.length === 0 || roomTypes.length === 0) return;
    
    // Only recalculate if we have rooms with price = 0 (from drag selection)
    const needsRecalc = rooms.some(room => room.price === 0 && room.ratePlanId);
    if (!needsRecalc) return;

    const recalculatedRooms = rooms.map(room => {
      // Skip if already has a price
      if (room.price !== 0) return room;
      
      const planObj = allRatePlans.find(p => p.id === room.ratePlanId);
      const typeObj = roomTypes.find(t => t.id === room.roomTypeId);
      
      if (!planObj || !typeObj) return room;
      
      let pricePerNight = 0;
      if (room.pricingMode === 'manual' && room.manualPrice) {
        pricePerNight = room.manualPrice;
      } else {
        if (planObj.pricingMethod === 'per_night') {
          pricePerNight = planObj.basePrice ?? typeObj.baseRate ?? 0;
        } else {
          const guestCount = room.adults || 1;
          pricePerNight = planObj.pricingPerGuest?.[guestCount.toString()] || planObj.pricingPerGuest?.['1'] || typeObj.baseRate || 0;
        }
      }
      
      return {
        ...room,
        price: pricePerNight * nights,
      };
    });
    
    setRooms(recalculatedRooms);
  }, [allRatePlans, roomTypes, dateRange, nights]);

  // Load data from Firestore
  useEffect(() => {
    if (!propertyId) return;

    const dataFetchers = [
      { query: query(collection(db, 'roomTypes'), where('propertyId', '==', propertyId)), setter: setRoomTypes },
      { query: query(collection(db, 'rooms'), where('propertyId', '==', propertyId)), setter: setAllPropertyRooms },
      { query: query(collection(db, 'ratePlans'), where('propertyId', '==', propertyId)), setter: setAllRatePlans },
      { 
        query: query(collection(db, 'reservations'), where('propertyId', '==', propertyId)), 
        setter: setAllReservations, 
        process: (d: any) => ({...d, startDate: d.startDate.toDate(), endDate: d.endDate.toDate()}) 
      },
      { query: query(collection(db, 'services'), where('propertyId', '==', propertyId)), setter: setAllServices },
      { query: query(collection(db, 'mealPlans'), where('propertyId', '==', propertyId)), setter: setAllMealPlans },
      { query: query(collection(db, 'availability'), where('propertyId', '==', propertyId)), setter: setAvailabilitySettings },
      { 
        query: query(collection(db, 'promotions'), where('propertyId', '==', propertyId), where('active', '==', true)), 
        setter: setAllPromotions, 
        process: (d:any) => ({...d, startDate: d.startDate.toDate(), endDate: d.endDate ? d.endDate.toDate() : null}) 
      },
    ];
    
    const unsubscribers = dataFetchers.map(({ query: q, setter, process }) => 
      onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ 
          id: doc.id, 
          ...doc.data(), 
          ...(process ? process(doc.data()) : {}) 
        }));
        setter(data as any);
      }, (err) => { console.error(`Error fetching`, err);})
    );
    
    return () => unsubscribers.forEach(unsub => unsub());
  }, [propertyId]);

  const filteredRoomTypes = roomTypes.filter(rt => rt.maxGuests >= (currentRoom.adults + currentRoom.children));
  const availableRatePlans = allRatePlans.filter(rp => rp.roomTypeId === currentRoom.roomTypeId);

  return (
    <div className="fixed flex items-center rounded-md justify-center ">
      <div className="bg-slate-50 rounded-md p-4 shadow-2xl w-full max-w-7xl h-[90vh]  ">
        <div className="h-full grid grid-cols-1 lg:grid-cols-12 ">

          {/* Title and Description */}
          <div className="lg:col-span-12 p-4">
            <h1 className="text-2xl font-bold text-slate-800">Create New Reservation</h1>
            <p className="text-sm text-slate-600">Fill in the details below to create a new booking.</p>
          </div>

          {/* LEFT COLUMN: FORM (SCROLLABLE) */}
          <div className="lg:col-span-8 overflow-y-auto">
            <div className="p-4 space-y-4">

          {/* 1. GUEST DETAILS */}
          <section className={`bg-white ${BORDER_RADIUS} border border-slate-200 shadow-sm overflow-hidden`}>
            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
              <User size={18} style={{ color: THEME_COLOR }} />
              <h2 className="font-bold text-slate-700">Guest Details</h2>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500">Full Name</label>
                <input 
                  type="text" 
                  value={guestDetails.fullName}
                  onChange={e => setGuestDetails(prev => ({ ...prev, fullName: e.target.value }))}
                  className={`w-full p-2.5 bg-slate-50 border border-slate-200 ${BORDER_RADIUS} text-sm outline-none focus:border-slate-400`} 
                  placeholder="Guest full name" 
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500">Email Address</label>
                <input 
                  type="email" 
                  value={guestDetails.email}
                  onChange={e => setGuestDetails(prev => ({ ...prev, email: e.target.value }))}
                  className={`w-full p-2.5 bg-slate-50 border border-slate-200 ${BORDER_RADIUS} text-sm outline-none focus:border-slate-400`} 
                  placeholder="email@address.com" 
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500">Phone Number</label>
                <PhoneInput 
                  value={guestDetails.phone} 
                  onChange={phone => setGuestDetails(prev => ({ ...prev, phone }))} 
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500">Country</label>
                <Combobox
                  options={countries.map(c => ({ value: c.name, label: t(`country:countries.${c.code}`) }))}
                  value={guestDetails.country}
                  onChange={country => setGuestDetails(prev => ({ ...prev, country }))}
                  placeholder="Select country"
                  searchPlaceholder="Search country..."
                  emptyText="No country found"
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <label className="text-xs font-semibold text-slate-500">Passport / ID Number</label>
                <input 
                  type="text" 
                  value={guestDetails.passportOrId}
                  onChange={e => setGuestDetails(prev => ({ ...prev, passportOrId: e.target.value }))}
                  className={`w-full p-2.5 bg-slate-50 border border-slate-200 ${BORDER_RADIUS} text-sm outline-none focus:border-slate-400`} 
                  placeholder="Identification Details" 
                />
              </div>
            </div>
          </section>

          {/* 2. DATES & SOURCE */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className={`bg-white ${BORDER_RADIUS} border border-slate-200 shadow-sm p-6`}>
              <div className="flex items-center gap-2 mb-4">
                <Calendar size={18} style={{ color: THEME_COLOR }} />
                <h2 className="font-bold text-slate-700">Booking Dates</h2>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Check-in & Check-out</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className={cn(
                        "w-full justify-start text-left font-normal border-2 p-2.5 bg-slate-50 border-slate-200 rounded-md text-sm flex items-center gap-2",
                        !dateRange && "text-slate-400"
                      )}
                    >
                      <Calendar size={16} style={{ color: THEME_COLOR }} />
                      {dateRange?.from ? (
                        dateRange.to ? (
                          <>
                            {format(dateRange.from, "MMM dd, yyyy")} 
                            <ArrowRight size={14} className="mx-1" />
                            {format(dateRange.to, "MMM dd, yyyy")}
                            <span className="ml-auto text-xs font-bold px-2 py-0.5 rounded" style={{ backgroundColor: `${THEME_COLOR}15`, color: THEME_COLOR }}>
                              {nights} {nights === 1 ? 'night' : 'nights'}
                            </span>
                          </>
                        ) : (
                          format(dateRange.from, "MMM dd, yyyy")
                        )
                      ) : (
                        <span>Select dates</span>
                      )}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarPicker 
                      initialFocus 
                      mode="range" 
                      defaultMonth={dateRange?.from} 
                      selected={dateRange} 
                      onSelect={setDateRange} 
                      numberOfMonths={2} 
                      disabled={{ before: startOfDay(new Date()) }} 
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className={`bg-white ${BORDER_RADIUS} border border-slate-200 shadow-sm p-6`}>
              <div className="flex items-center gap-2 mb-4">
                <MapPin size={18} style={{ color: THEME_COLOR }} />
                <h2 className="font-bold text-slate-700">Booking Source</h2>
              </div>
              <div className="flex gap-4 mt-2">
                {['Direct', 'Walk-in', 'OTA'].map(s => (
                  <label key={s} className="flex items-center gap-2 cursor-pointer group">
                    <div
                      onClick={() => setSource(s)}
                      className={`w-5 h-5 rounded-sm border flex items-center justify-center transition-all ${source === s ? 'bg-slate-800 border-slate-800' : 'bg-white border-slate-300 group-hover:border-slate-400'}`}
                    >
                      {source === s && <Check size={14} className="text-white" />}
                    </div>
                    <span className="text-sm font-medium text-slate-600">{s}</span>
                  </label>
                ))}
              </div>
            </div>
          </section>

          {/* 3. ROOM SELECTION (MULTI-ROOM) */}
          <section className={`bg-white ${BORDER_RADIUS} border border-slate-200 shadow-sm overflow-hidden`}>
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Box size={18} style={{ color: THEME_COLOR }} />
                <h2 className="font-bold text-slate-700">Room Selection</h2>
              </div>
              <span className="text-[10px] font-bold bg-slate-100 px-2 py-1 rounded text-slate-500 uppercase">{rooms.length} Rooms added</span>
            </div>

            <div className="p-6 space-y-4">
              {/* Saved Rooms (Expandable List) */}
              {rooms.map((room, idx) => {
                const isExpanded = expandedRooms.has(room.roomId);
                const roomTotal = (room.price || 0) + (room.selectedExtras || []).reduce((acc, extra) => acc + calculateExtraItemTotal(extra, nights, {adults: room.adults, children: room.children}), 0);
                
                return (
                  <div key={room.roomId} className={`border-2 border-slate-200 ${BORDER_RADIUS} overflow-hidden bg-white`}>
                    {/* Room Header */}
                    <div 
                      className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 transition-colors"
                      onClick={() => {
                        const newExpanded = new Set(expandedRooms);
                        if (newExpanded.has(room.roomId)) {
                          newExpanded.delete(room.roomId);
                        } else {
                          newExpanded.add(room.roomId);
                        }
                        setExpandedRooms(newExpanded);
                      }}
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <span className="text-xs font-bold text-white px-1.5 py-0.5 rounded" style={{ backgroundColor: THEME_COLOR }}>#{idx + 1}</span>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-sm">{room.roomTypeName}</h3>
                            <span className="text-xs text-slate-400">• Room: {room.roomName || 'Auto-assign'}</span>
                          </div>
                          <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider font-semibold">
                            {room.adults} Adults, {room.children} Children • {room.ratePlanName} • {(room.selectedExtras || []).length} Extras
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="font-bold text-sm">{currencySymbol}{roomTotal.toFixed(2)}</span>
                        {isExpanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                      </div>
                    </div>

                    {/* Expanded Content */}
                    {isExpanded && (
                      <div className="border-t border-slate-200 p-4 bg-slate-50/50 space-y-4">
                        {/* Guest Count */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-400 uppercase">Adults</label>
                            <input 
                              type="number" 
                              min="1"
                              value={room.adults}
                              onChange={e => {
                                const newRooms = rooms.map(r => 
                                  r.roomId === room.roomId ? { ...r, adults: Number(e.target.value) || 1 } : r
                                );
                                setRooms(newRooms);
                              }}
                              className={`w-full p-2 bg-white border border-slate-200 ${BORDER_RADIUS} text-sm outline-none`}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-400 uppercase">Children</label>
                            <input 
                              type="number" 
                              min="0"
                              value={room.children}
                              onChange={e => {
                                const newRooms = rooms.map(r => 
                                  r.roomId === room.roomId ? { ...r, children: Number(e.target.value) || 0 } : r
                                );
                                setRooms(newRooms);
                              }}
                              className={`w-full p-2 bg-white border border-slate-200 ${BORDER_RADIUS} text-sm outline-none`}
                            />
                          </div>
                        </div>

                        {/* Pricing Mode */}
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-400 uppercase">Pricing Mode</label>
                          <div className="flex bg-slate-100 p-1 rounded-md">
                            {['rate_plan', 'manual'].map(m => (
                              <button
                                key={m}
                                type="button"
                                onClick={() => {
                                  const newRooms = rooms.map(r => 
                                    r.roomId === room.roomId ? { ...r, pricingMode: m as PricingMode } : r
                                  );
                                  setRooms(newRooms);
                                }}
                                className={`flex-1 py-1.5 text-[10px] font-bold rounded uppercase transition-all ${(room.pricingMode || 'rate_plan') === m ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                              >
                                {m === 'rate_plan' ? 'Rate Plan' : 'Manual'}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Rate Plan or Manual Price */}
                        {(room.pricingMode || 'rate_plan') === 'rate_plan' ? (
                          <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-400 uppercase">Rate Plan</label>
                            <select
                              className={`w-full p-2 bg-white border border-slate-200 ${BORDER_RADIUS} text-sm outline-none`}
                              value={room.ratePlanId}
                              onChange={e => {
                                const ratePlan = allRatePlans.find(rp => rp.id === e.target.value);
                                const newRooms = rooms.map(r => 
                                  r.roomId === room.roomId ? { ...r, ratePlanId: e.target.value, ratePlanName: ratePlan?.planName || '' } : r
                                );
                                setRooms(newRooms);
                              }}
                            >
                              {allRatePlans.filter(rp => rp.roomTypeId === room.roomTypeId).map(p => (
                                <option key={p.id} value={p.id}>{p.planName}</option>
                              ))}
                            </select>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-400 uppercase">Manual Price ({currencySymbol})</label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={room.manualPrice || 0}
                              onChange={e => {
                                const newRooms = rooms.map(r => 
                                  r.roomId === room.roomId ? { ...r, manualPrice: Number(e.target.value) || 0 } : r
                                );
                                setRooms(newRooms);
                              }}
                              className={`w-full p-2 bg-white border border-slate-200 ${BORDER_RADIUS} text-sm outline-none`}
                              placeholder="Enter price"
                            />
                          </div>
                        )}

                        {/* Extras */}
                        {extraCategories.some(cat => cat.items.length > 0) && (
                          <div className="pt-4 border-t border-slate-200">
                            <h4 className="text-xs font-bold text-slate-400 uppercase mb-3">Extras & Add-ons</h4>
                            {extraCategories.map((cat, catIdx) => (
                              cat.items.length > 0 && (
                                <div key={catIdx} className="mb-4 last:mb-0">
                                  <div className="flex items-center gap-2 mb-2">
                                    {cat.icon}
                                    <h5 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{cat.label}</h5>
                                  </div>
                                  <div className="space-y-2">
                                    {cat.items.map(item => {
                                      const isSelected = room.selectedExtras?.some(e => e.id === item.id);
                                      return (
                                        <div
                                          key={item.id}
                                          onClick={() => {
                                            const newRooms = rooms.map(r => {
                                              if (r.roomId === room.roomId) {
                                                const existingExtras = r.selectedExtras || [];
                                                const exists = existingExtras.find(e => e.id === item.id);
                                                let newExtras;
                                                if (exists) {
                                                  newExtras = existingExtras.filter(e => e.id !== item.id);
                                                } else {
                                                  const type = cat.label === 'Services' ? 'service' : 'meal_plan';
                                                  newExtras = [...existingExtras, {
                                                    id: item.id,
                                                    name: item.name,
                                                    price: item.price,
                                                    quantity: 1,
                                                    unit: item.unit,
                                                    type: type as 'service' | 'meal_plan',
                                                    total: 0
                                                  }];
                                                }
                                                return { ...r, selectedExtras: newExtras };
                                              }
                                              return r;
                                            });
                                            setRooms(newRooms);
                                          }}
                                          className={`flex items-center justify-between p-3 bg-white border border-slate-200 ${BORDER_RADIUS} cursor-pointer hover:bg-slate-50 transition-all select-none group`}
                                        >
                                          <div className="flex items-center gap-3">
                                            <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${isSelected ? 'bg-[#003166] border-[#003166]' : 'bg-white border-slate-300 group-hover:border-slate-400'}`}>
                                              {isSelected && <Check size={14} className="text-white" />}
                                            </div>
                                            <span className="text-sm font-medium text-slate-700">{item.name}</span>
                                          </div>
                                          <span className="text-xs font-bold text-slate-300">+{currencySymbol}{item.price}</span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )
                            ))}
                          </div>
                        )}

                        {/* Delete Button */}
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            removeRoom(room.roomId);
                          }}
                          className="w-full py-2 px-4 bg-red-50 text-red-600 hover:bg-red-100 transition-colors rounded-md text-sm font-bold uppercase tracking-wider flex items-center justify-center gap-2"
                        >
                          <Trash2 size={14} />
                          Remove Room
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Active Room Adder */}
              <div className={`border-2 border-dashed border-slate-200 p-6 ${BORDER_RADIUS} space-y-6 bg-slate-50/40 mt-4`}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase">Room Type</label>
                    <select
                      className={`w-full p-2 bg-white border border-slate-200 ${BORDER_RADIUS} text-sm outline-none focus:border-slate-400`}
                      value={currentRoom.roomTypeId}
                      onChange={e => {
                        const roomTypeId = e.target.value;
                        const availableRatePlansForType = allRatePlans.filter(rp => rp.roomTypeId === roomTypeId);
                        const defaultPlan = availableRatePlansForType.find(rp => rp.default);
                        setCurrentRoom({ 
                          ...currentRoom, 
                          roomTypeId,
                          roomId: '',
                          ratePlanId: availableRatePlansForType.length === 1 ? availableRatePlansForType[0].id : (defaultPlan?.id || '')
                        });
                      }}
                    >
                      <option value="">Select Type</option>
                      {filteredRoomTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase">Specific Room #</label>
                    <select
                      className={`w-full p-2 bg-white border border-slate-200 ${BORDER_RADIUS} text-sm outline-none focus:border-slate-400`}
                      value={currentRoom.roomId}
                      onChange={e => setCurrentRoom({ ...currentRoom, roomId: e.target.value })}
                      disabled={!currentRoom.roomTypeId}
                    >
                      <option value="">Select Room</option>
                      {availableRoomsForCurrentType.map(r => (
                        <option key={r.id} value={r.id} disabled={!r.isAvailable}>
                          {r.name} {!r.isAvailable && `(${r.reason})`}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-400 uppercase">Adults</label>
                      <input 
                        type="number" 
                        min="1"
                        className={`w-full p-2 bg-white border border-slate-200 ${BORDER_RADIUS} text-sm outline-none`} 
                        value={currentRoom.adults} 
                        onChange={e => setCurrentRoom({ ...currentRoom, adults: Number(e.target.value) || 1 })} 
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-400 uppercase">Children</label>
                      <input 
                        type="number" 
                        min="0"
                        className={`w-full p-2 bg-white border border-slate-200 ${BORDER_RADIUS} text-sm outline-none`} 
                        value={currentRoom.children} 
                        onChange={e => setCurrentRoom({ ...currentRoom, children: Number(e.target.value) || 0 })} 
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase">Pricing Mode</label>
                    <div className="flex bg-slate-100 p-1 rounded-md">
                      {['rate-plan', 'manual'].map(m => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setCurrentRoom({ ...currentRoom, pricingMode: m as 'rate-plan' | 'manual' })}
                          className={`flex-1 py-1.5 text-[10px] font-bold rounded uppercase transition-all ${currentRoom.pricingMode === m ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                          {m.replace('-', ' ')}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1">
                    {currentRoom.pricingMode === 'rate-plan' ? (
                      <>
                        <label className="text-xs font-bold text-slate-400 uppercase">Rate Plan</label>
                        <select
                          className={`w-full p-2 bg-white border border-slate-200 ${BORDER_RADIUS} text-sm outline-none`}
                          value={currentRoom.ratePlanId}
                          onChange={e => setCurrentRoom({ ...currentRoom, ratePlanId: e.target.value })}
                          disabled={!currentRoom.roomTypeId}
                        >
                          <option value="">Select Plan</option>
                          {availableRatePlans.map(p => <option key={p.id} value={p.id}>{p.planName}</option>)}
                        </select>
                      </>
                    ) : (
                      <>
                        <label className="text-xs font-bold text-slate-400 uppercase">Manual Price ({currencySymbol})</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className={`w-full p-2 bg-white border border-slate-200 ${BORDER_RADIUS} text-sm outline-none`}
                          value={currentRoom.manualPrice}
                          onChange={e => setCurrentRoom({ ...currentRoom, manualPrice: Number(e.target.value) || 0 })}
                          placeholder="Enter price"
                        />
                      </>
                    )}
                  </div>
                </div>

                {/* EXTRAS (REPLICATED SCREENSHOT DESIGN) */}
                <div className="pt-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Box size={18} style={{ color: THEME_COLOR }} />
                    <h3 className="text-sm font-bold text-slate-800">Extras & Add-ons</h3>
                  </div>

                  {extraCategories.map((cat, idx) => (
                    cat.items.length > 0 && (
                      <div key={idx} className="mb-6 last:mb-0">
                        <div className="flex items-center gap-2 mb-3">
                          {cat.icon}
                          <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">{cat.label}</h4>
                        </div>
                        <div className="space-y-2">
                          {cat.items.map(item => (
                            <div
                              key={item.id}
                              onClick={() => toggleExtra(item.id)}
                              className={`flex items-center justify-between p-3.5 bg-white border border-slate-200 ${BORDER_RADIUS} cursor-pointer hover:bg-slate-50 transition-all select-none group`}
                            >
                              <div className="flex items-center gap-4">
                                <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${currentRoom.extras.includes(item.id) ? 'bg-[#003166] border-[#003166]' : 'bg-white border-slate-300 group-hover:border-slate-400'}`}>
                                  {currentRoom.extras.includes(item.id) && <Check size={14} className="text-white" />}
                                </div>
                                <span className="text-sm font-medium text-slate-700">{item.name}</span>
                              </div>
                              <span className="text-xs font-bold text-slate-300">+{currencySymbol}{item.price}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleAddRoom}
                  className={`w-full py-4 mt-6 text-white font-bold text-xs uppercase tracking-widest shadow-lg active:scale-[0.99] transition-all flex items-center justify-center gap-2 ${BORDER_RADIUS}`}
                  style={{ backgroundColor: THEME_COLOR }}
                >
                  <Plus size={16} /> Save & Add Room
                </button>
              </div>
            </div>
          </section>

          {/* 4. STATUS & PAYMENT METHOD */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className={`bg-white ${BORDER_RADIUS} border border-slate-200 shadow-sm p-6`}>
              <h2 className="text-xs font-bold text-slate-400 uppercase mb-4 tracking-widest">Reservation Status</h2>
              <div className="flex flex-wrap gap-2">
                {['pending', 'confirmed', 'Canceled', 'No-show'].map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setResStatus(s as typeof resStatus)}
                    className={`px-3 py-2 text-[10px] font-bold uppercase rounded-md border transition-all ${resStatus === s ? 'text-white border-transparent' : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'}`}
                    style={{ backgroundColor: resStatus === s ? THEME_COLOR : '' }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div className={`bg-white ${BORDER_RADIUS} border border-slate-200 shadow-sm p-6`}>
              <h2 className="text-xs font-bold text-slate-400 uppercase mb-4 tracking-widest">Payment Status</h2>
              <div className="flex flex-wrap gap-2">
                {['pending', 'partial', 'paid', 'refunded'].map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setPayStatus(s as typeof payStatus)}
                    className={`px-3 py-2 text-[10px] font-bold uppercase rounded-md border transition-all ${payStatus === s ? 'text-white border-transparent' : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'}`}
                    style={{ backgroundColor: payStatus === s ? THEME_COLOR : '' }}
                  >
                    {s}
                  </button>
                ))}
              </div>

              {payStatus === 'partial' && (
                <div className="mt-4">
                  <label className="text-xs font-semibold text-slate-500 mb-1 block">Partial Amount</label>
                  <input 
                    type="number" 
                    min="0"
                    step="0.01"
                    value={partialPaymentAmount}
                    onChange={e => setPartialPaymentAmount(Number(e.target.value) || '')}
                    className={`w-full p-2 bg-slate-50 border border-slate-200 ${BORDER_RADIUS} text-sm outline-none focus:border-slate-400`} 
                    placeholder="Enter partial amount" 
                  />
                </div>
              )}

              {payStatus === 'refunded' && (
                <div className="mt-4 space-y-3">
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2">
                      <input type="radio" name="refundType" checked={refundTypeLocal === 'full'} onChange={() => setRefundTypeLocal('full')} />
                      <span className="text-sm">Full refund</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="radio" name="refundType" checked={refundTypeLocal === 'partial'} onChange={() => setRefundTypeLocal('partial')} />
                      <span className="text-sm">Partial refund</span>
                    </label>
                  </div>
                  {refundTypeLocal === 'partial' && (
                    <div>
                      <label className="text-xs font-semibold text-slate-500 mb-1 block">Refunded Amount</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={refundedAmountLocal}
                        onChange={e => setRefundedAmountLocal(Number(e.target.value) || '')}
                        className={`w-full p-2 bg-slate-50 border border-slate-200 ${BORDER_RADIUS} text-sm outline-none focus:border-slate-400`}
                        placeholder="Enter refunded amount"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {(payStatus === 'partial' || payStatus === 'paid') && (
              <div className={`bg-white ${BORDER_RADIUS} border border-slate-200 shadow-sm p-6 md:col-span-2`}>
                <div className="flex items-center gap-2 mb-4">
                  <Wallet size={16} style={{ color: THEME_COLOR }} />
                  <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Payment Method</h2>
                </div>
                <div className="flex flex-wrap gap-3">
                  {['Cash', 'Credit Card', 'Check', 'Bank Transfer'].map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setPayMethod(m)}
                      className={`flex-1 min-w-[120px] p-3 text-xs font-bold uppercase rounded-md border text-center transition-all ${payMethod === m ? 'border-transparent text-white shadow-md shadow-slate-200' : 'border-slate-200 text-slate-400 bg-white hover:border-slate-300'}`}
                      style={{ backgroundColor: payMethod === m ? THEME_COLOR : '' }}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>

            </div>
          </div>

          {/* RIGHT COLUMN: BOOKING SUMMARY (FIXED) */}
          <div className="lg:col-span-4 lg:mt-4 lg:mb-4 bg-white border rounded-lg border-slate-200 overflow-y-auto mr-4">
              <div className="h-full flex flex-col">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
                <h2 className="font-bold text-slate-800">Booking Summary</h2>
                <CreditCard size={18} style={{ color: THEME_COLOR }} />
              </div>

              <div className="p-6 space-y-5 flex-1 overflow-y-auto">
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Rooms Total</span>
                  <span className="font-bold text-slate-800">{currencySymbol}{summary.roomsTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Extras Total</span>
                  <span className="font-bold text-slate-800">{currencySymbol}{summary.extrasTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm pt-2 border-t border-slate-50">
                  <span className="font-bold text-slate-800">Subtotal</span>
                  <span className="font-bold text-slate-800">{currencySymbol}{summary.subtotal.toFixed(2)}</span>
                </div>
              </div>

              {/* PROMO SECTION */}
              <div className="space-y-4 pt-4 border-t border-slate-100">
                {hasCouponPromos && (
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Coupon Code</label>
                    <div className={`flex bg-slate-50 border border-slate-200 ${BORDER_RADIUS} overflow-hidden`}>
                      <input
                        type="text"
                        value={coupon}
                        onChange={e => setCoupon(e.target.value)}
                        placeholder="ENTER CODE"
                        className="bg-transparent flex-1 px-3 py-2 text-xs font-bold outline-none uppercase placeholder:text-slate-300"
                      />
                      <button 
                        type="button"
                        onClick={handleApplyCoupon}
                        className="px-4 bg-slate-200 text-slate-600 text-[10px] font-bold hover:bg-slate-300 transition-colors"
                      >
                        APPLY
                      </button>
                    </div>
                  </div>
                )}

                {availableAutomaticPromos.length > 0 && (
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Auto-applied Promotions</label>
                    <select
                      value={promotion}
                      onChange={e => handleAutoPromoSelect(e.target.value)}
                      className={`w-full p-2.5 bg-slate-50 border border-slate-200 ${BORDER_RADIUS} text-xs font-medium outline-none text-slate-600`}
                    >
                      <option value="none">No promotion applied</option>
                      {availableAutomaticPromos.map(promo => (
                        <option key={promo.id} value={promo.id}>
                          {promo.name} ({promo.discountType === 'percentage' ? `${promo.discountValue}%` : `${currencySymbol}${promo.discountValue}`})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* FINAL TOTALS */}
              <div className="space-y-3 pt-6 border-t border-slate-100">
                {summary.promoDiscount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-emerald-600 font-semibold flex items-center gap-1.5">
                      <Tag size={12} /> Discount
                    </span>
                    <span className="text-emerald-600 font-bold">-{currencySymbol}{summary.promoDiscount.toFixed(2)}</span>
                  </div>
                )}
                {property?.taxSettings?.enabled && summary.tax > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">{property.taxSettings.name || 'Tax'} ({property.taxSettings.rate}%)</span>
                    <span className="font-bold text-slate-800">{currencySymbol}{summary.tax.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between items-end pt-2">
                  <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] mb-1">Grand Total</span>
                  <span className="text-4xl font-black tracking-tighter" style={{ color: THEME_COLOR }}>
                    {currencySymbol}{summary.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              <div className="pt-6">
                <button
                  type="submit"
                  onClick={handleSubmit}
                  disabled={isSaving}
                  className={`w-full py-4 text-white font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-900/10 active:scale-[0.98] transition-all ${BORDER_RADIUS} disabled:opacity-50 disabled:cursor-not-allowed`}
                  style={{ backgroundColor: THEME_COLOR }}
                >
                  {isSaving ? 'Saving...' : (initialData ? 'Update Reservation' : 'Confirm Reservation')}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full mt-2 py-3 text-slate-600 font-bold text-xs uppercase tracking-widest hover:bg-slate-50 transition-all rounded-md"
                >
                  Cancel
                </button>
                <div className="flex items-center justify-center gap-2 py-4">
                  <Info size={14} className="text-slate-300" />
                  <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">Prices exclude local tourism fee</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    </div>
  );
}
