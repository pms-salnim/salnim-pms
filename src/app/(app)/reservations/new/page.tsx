"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { addDays, differenceInDays, format, isAfter, startOfDay } from "date-fns";
import { useAuth } from "@/contexts/auth-context";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSidebar } from "@/components/ui/sidebar";
import { toast } from "@/hooks/use-toast";
import {
  CalendarRange,
  Check,
  CircleDollarSign,
  CreditCard,
  ShieldCheck,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { countries as countriesList } from "countries-list";
import type { RoomType } from "@/types/roomType";
import type { Room } from "@/types/room";
import type { RatePlan } from "@/types/ratePlan";
import type { Service } from "@/types/service";
import type { MealPlan } from "@/types/mealPlan";
import type { Promotion } from "@/types/promotion";

const STEPS = [
  "Availability",
  "Guest",
  "Extras",
  "Payment",
] as const;

const BLOCKED_AVAILABILITY_STATUSES = new Set(["blocked", "stop_sell", "full", "closed", "not_available", "unavailable"]);
const normalizeAvailabilityStatus = (value: unknown) =>
  String(value || "")
    .toLowerCase()
    .replace(/[-\s]+/g, "_");

type StepKey = (typeof STEPS)[number];

interface RoomSelection {
  id: string;
  roomTypeId: string;
  roomId: string;
  ratePlanId: string;
  adults: number;
  children: number;
}

interface StayForm {
  checkIn: string;
  checkOut: string;
  source: "Direct" | "Walk-in" | "OTA";
  adults: number;
  children: number;
}

interface GuestForm {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  mobile: string;
  mobileCountryCode: string;
  gender: string;
  birthDate: string;
  country: string;
  city: string;
  zipCode: string;
  address: string;
  idType: string;
  nationalId: string;
  roomAssignment: string;
  estimatedArrivalTime: string;
  guestPhoto: string | null;
}

interface PaymentForm {
  reservationStatus: "Pending" | "Confirmed";
  paymentMethod: string;
  partialPaymentAmount: number;
}

interface ReservationLite {
  id: string;
  status: string;
  startDate: Date;
  endDate: Date;
  rooms: Array<{ roomId: string }>;
}

interface CalendarAvailabilityRow {
  room_id: string;
  date: string;
  end_date: string | null;
  status: string;
  min_nights?: number | null;
  max_nights?: number | null;
  close_to_arrival?: boolean;
  applied_days?: number[] | null;
}

interface SplitSegment {
  id: string;
  roomTypeId: string;
  ratePlanId: string;
  startDate: string;
  endDate: string;
}

interface SplitAnchor {
  roomTypeId: string;
  date: string;
}

interface CalendarReservationPrefillPayload {
  source: "calendar-drag";
  checkIn: string;
  checkOut: string;
  roomTypeId: string;
  roomTypeName: string;
  roomId: string;
  roomName: string;
  ratePlanId?: string;
  ratePlanName?: string;
  adults?: number;
  children?: number;
}

type ExtraUnit =
  | "one_time"
  | "per_booking"
  | "per_night"
  | "per_guest"
  | "per_night_per_guest"
  | "per_night_per_room"
  | "one_time_per_guest"
  | "one_time_per_room";

// Helper to convert country code to Unicode flag emoji
const countryCodeToFlag = (countryCode: string): string => {
  const codePoints = countryCode
    .toUpperCase()
    .split("")
    .map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
};

// Helper to get countries with phone codes and flags
const getCountriesData = () => {
  return Object.entries(countriesList).map(([code, data]: [string, any]) => ({
    code,
    name: data.name,
    phone: data.phone || "",
    flag: countryCodeToFlag(code),
  })).sort((a, b) => a.name.localeCompare(b.name));
};

export default function NewReservationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, property, isLoadingAuth } = useAuth();
  const { state: sidebarState, isMobile } = useSidebar();
  const propertyId = (property as any)?.id ?? user?.propertyId ?? null;

  const [stepIndex, setStepIndex] = useState(0);
  const [skippedSteps, setSkippedSteps] = useState<Set<string>>(new Set());
  const [checkInOnComplete, setCheckInOnComplete] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isSearchingAvailability, setIsSearchingAvailability] = useState(false);
  const [hasAvailabilitySearched, setHasAvailabilitySearched] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFinalValidating, setIsFinalValidating] = useState(false);
  const [finalValidationErrors, setFinalValidationErrors] = useState<string[]>([]);

  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [ratePlans, setRatePlans] = useState<RatePlan[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [allReservations, setAllReservations] = useState<ReservationLite[]>([]);
  const [availabilityWindow, setAvailabilityWindow] = useState<CalendarAvailabilityRow[]>([]);
  const [baseRatesList, setBaseRatesList] = useState<any[]>([]);
  const [rateOverrides, setRateOverrides] = useState<any[]>([]);

  const [stay, setStay] = useState<StayForm>({
    checkIn: format(startOfDay(new Date()), "yyyy-MM-dd"),
    checkOut: format(addDays(startOfDay(new Date()), 1), "yyyy-MM-dd"),
    source: "Direct",
    adults: 1,
    children: 0,
  });

  const [guest, setGuest] = useState<GuestForm>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    mobile: "",
    mobileCountryCode: "+212",
    gender: "",
    birthDate: "",
    country: "Morocco",
    city: "",
    zipCode: "",
    address: "",
    idType: "Passport",
    nationalId: "",
    roomAssignment: "",
    estimatedArrivalTime: "",
    guestPhoto: null,
  });

  const [payment, setPayment] = useState<PaymentForm>({
    reservationStatus: "Pending",
    paymentMethod: "Cash",
    partialPaymentAmount: 0,
  });

  const [roomSelections, setRoomSelections] = useState<RoomSelection[]>([]);
  const [availabilityRoomTypeFilter, setAvailabilityRoomTypeFilter] = useState<string>("all");
  const [availabilityViewMode, setAvailabilityViewMode] = useState<"simple" | "split">("simple");
  const [availabilityDisplayMode, setAvailabilityDisplayMode] = useState<"base-rates" | "default-rate-plan">("base-rates");
  const [availabilityPromoCode, setAvailabilityPromoCode] = useState<string>("");
  const [availabilityQtyByType, setAvailabilityQtyByType] = useState<Record<string, number>>({});
  const [availabilitySelectedRoomByType, setAvailabilitySelectedRoomByType] = useState<Record<string, string>>({});
  const [availabilityAdultsByType, setAvailabilityAdultsByType] = useState<Record<string, number>>({});
  const [availabilityChildrenByType, setAvailabilityChildrenByType] = useState<Record<string, number>>({});
  const [splitSegments, setSplitSegments] = useState<SplitSegment[]>([]);
  const [splitAnchor, setSplitAnchor] = useState<SplitAnchor | null>(null);
  const [splitHoverDate, setSplitHoverDate] = useState<string | null>(null);
  const [splitInlineError, setSplitInlineError] = useState<string | null>(null);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [selectedMealPlanIds, setSelectedMealPlanIds] = useState<string[]>([]);
  const [selectedPromotionId, setSelectedPromotionId] = useState<string>("none");
  const [couponCode, setCouponCode] = useState("");
  const [countryCodeSearch, setCountryCodeSearch] = useState("");
  const [countryCodeOpen, setCountryCodeOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");
  const [countryOpen, setCountryOpen] = useState(false);
  const [calendarPrefill, setCalendarPrefill] = useState<CalendarReservationPrefillPayload | null>(null);
  const [hasAppliedCalendarPrefill, setHasAppliedCalendarPrefill] = useState(false);
  const [isCalendarPrefillHydrating, setIsCalendarPrefillHydrating] = useState(false);
  const [isGuestCountPromptOpen, setIsGuestCountPromptOpen] = useState(false);
  const [prefillAdults, setPrefillAdults] = useState(1);
  const [prefillChildren, setPrefillChildren] = useState(0);

  const getServiceUnit = (service: Service): ExtraUnit => {
    const candidate = (service as any).unit as string | undefined;
    if (
      candidate === "one_time" ||
      candidate === "per_booking" ||
      candidate === "per_night" ||
      candidate === "per_guest"
    ) {
      return candidate;
    }
    return (service as any).perNight ? "per_night" : "one_time";
  };

  const getMealPlanUnit = (mealPlan: MealPlan): ExtraUnit => {
    const candidate = (mealPlan as any).unit as string | undefined;
    if (
      candidate === "per_night_per_guest" ||
      candidate === "per_night_per_room" ||
      candidate === "one_time_per_guest" ||
      candidate === "one_time_per_room"
    ) {
      return candidate;
    }
    return "one_time_per_room";
  };

  const calculateExtraAmount = (
    unit: ExtraUnit,
    price: number,
    quantity: number,
    nightsCount: number,
    adults: number,
    children: number
  ) => {
    const safeQty = quantity > 0 ? quantity : 1;
    const guests = Math.max(1, adults + children);

    switch (unit) {
      case "one_time":
      case "per_booking":
      case "one_time_per_room":
        return price * safeQty;
      case "per_night":
      case "per_night_per_room":
        return price * nightsCount * safeQty;
      case "per_guest":
      case "one_time_per_guest":
        return price * guests * safeQty;
      case "per_night_per_guest":
        return price * nightsCount * guests * safeQty;
      default:
        return price * safeQty;
    }
  };

  const getAuthHeaders = useCallback(async (): Promise<Record<string, string> | null> => {
    const supabase = createClient();
    let sessionData = null;
    for (let i = 0; i < 3; i++) {
      const result = await supabase.auth.getSession();
      if (result.data?.session) {
        sessionData = result.data;
        break;
      }
      if (i < 2) await new Promise((resolve) => setTimeout(resolve, 100));
    }
    if (!sessionData?.session) return null;
    return { Authorization: `Bearer ${sessionData.session.access_token}` };
  }, []);

  useEffect(() => {
    const prefillRef = searchParams.get("prefillRef");
    if (!prefillRef) {
      setIsCalendarPrefillHydrating(false);
      return;
    }

    setIsCalendarPrefillHydrating(true);

    try {
      const storageKey = `reservation-prefill:${prefillRef}`;
      const raw = window.sessionStorage.getItem(storageKey);
      if (!raw) {
        setIsCalendarPrefillHydrating(false);
        return;
      }

      window.sessionStorage.removeItem(storageKey);
      const parsed = JSON.parse(raw) as CalendarReservationPrefillPayload;
      if (!parsed?.roomId || !parsed?.roomTypeId || !parsed?.checkIn || !parsed?.checkOut) {
        setIsCalendarPrefillHydrating(false);
        return;
      }

      setCalendarPrefill(parsed);
      setHasAppliedCalendarPrefill(false);
      setStepIndex(0);
      setAvailabilityViewMode("simple");
      setAvailabilityRoomTypeFilter(parsed.roomTypeId);
      setStay((prev) => ({
        ...prev,
        checkIn: parsed.checkIn,
        checkOut: parsed.checkOut,
      }));
      setPrefillAdults(Math.max(1, parsed.adults ?? 1));
      setPrefillChildren(Math.max(0, parsed.children ?? 0));
    } catch (error) {
      console.error("[new-reservation] failed to parse calendar prefill payload", error);
      setIsCalendarPrefillHydrating(false);
    }
  }, [searchParams]);

  useEffect(() => {
    let active = true;

    const loadBookingData = async () => {
      if (!propertyId) {
        if (!active) return;
        setIsLoadingData(false);
        return;
      }

      setIsLoadingData(true);
      try {
        const headers = await getAuthHeaders();
        if (!headers) {
          throw new Error("Authentication session expired. Please sign in again.");
        }

        const [
          roomTypesRes,
          roomsRes,
          ratePlansRes,
          servicesRes,
          mealPlansRes,
          promotionsRes,
          baseRatesRes,
        ] = await Promise.all([
          fetch(`/api/rooms/room-types/list?propertyId=${propertyId}`, { headers }),
          fetch(`/api/rooms/list?propertyId=${propertyId}`, { headers }),
          fetch(`/api/rate-plans/list?propertyId=${propertyId}`, { headers }),
          fetch(`/api/services/list?propertyId=${propertyId}`, { headers }),
          fetch(`/api/meal-plans/list?property_id=${propertyId}`),
          fetch(`/api/promotions/list?propertyId=${propertyId}`, { headers }),
          fetch(`/api/pricing/base-rates?propertyId=${propertyId}`, { headers }),
        ]);

        const failedResponse = [
          roomTypesRes,
          roomsRes,
          ratePlansRes,
          servicesRes,
          mealPlansRes,
          promotionsRes,
        ].find((res) => !res.ok);

        if (failedResponse) {
          throw new Error("Failed to load reservation dependencies.");
        }

        const [
          roomTypesData,
          roomsData,
          ratePlansData,
          servicesData,
          mealPlansData,
          promotionsData,
          baseRatesData,
        ] = await Promise.all([
          roomTypesRes.json(),
          roomsRes.json(),
          ratePlansRes.json(),
          servicesRes.json(),
          mealPlansRes.json(),
          promotionsRes.json(),
          baseRatesRes.ok ? baseRatesRes.json() : Promise.resolve({ baseRates: [] }),
        ]);

        if (!active) return;

        setRoomTypes(Array.isArray(roomTypesData.roomTypes) ? roomTypesData.roomTypes : []);
        setRooms(Array.isArray(roomsData.rooms) ? roomsData.rooms : []);
        setRatePlans(Array.isArray(ratePlansData.ratePlans) ? ratePlansData.ratePlans : []);
        setServices(Array.isArray(servicesData.services) ? servicesData.services : []);
        setMealPlans(Array.isArray(mealPlansData) ? mealPlansData : (Array.isArray(mealPlansData.mealPlans) ? mealPlansData.mealPlans : []));
        setPromotions(Array.isArray(promotionsData.promotions) ? promotionsData.promotions : []);
        setBaseRatesList(Array.isArray(baseRatesData.baseRates) ? baseRatesData.baseRates : []);
      } catch (error: any) {
        if (!active) return;
        console.error("[new-reservation] bootstrap error", error);
        toast({
          title: "Error",
          description: error?.message || "Failed to load reservation data.",
          variant: "destructive",
        });
      } finally {
        if (active) {
          setIsLoadingData(false);
        }
      }
    };

    loadBookingData();

    return () => {
      active = false;
    };
  }, [propertyId, getAuthHeaders]);

  const handleSearchAvailability = useCallback(async () => {
    if (!propertyId) return;

    setHasAvailabilitySearched(true);
    setIsSearchingAvailability(true);
    try {
      const headers = await getAuthHeaders();
      if (!headers) {
        throw new Error("Authentication session expired. Please sign in again.");
      }

      const params = new URLSearchParams({
        propertyId,
        minDate: stay.checkIn,
        maxDate: stay.checkOut,
      });

      const [availabilityRes, reservationsRes] = await Promise.all([
        fetch(`/api/property-settings/rates-availability/calendar?${params.toString()}`),
        fetch(`/api/reservations/list?propertyId=${propertyId}`, { headers }),
      ]);

      if (!availabilityRes.ok || !reservationsRes.ok) {
        throw new Error("Could not load availability for selected dates.");
      }

      const availabilityData = await availabilityRes.json();
      const reservationsData = await reservationsRes.json();

      const latestAvailability: CalendarAvailabilityRow[] = Array.isArray(availabilityData.availability)
        ? availabilityData.availability
        : [];

      const latestRateOverrides: any[] = Array.isArray(availabilityData.rateOverrides)
        ? availabilityData.rateOverrides
        : [];

      const latestReservations: ReservationLite[] = (reservationsData.reservations || []).map((r: any) => ({
        id: r.id,
        status: r.status,
        startDate: new Date(r.startDate),
        endDate: new Date(r.endDate),
        rooms: Array.isArray(r.rooms) ? r.rooms : [],
      }));

      setAvailabilityWindow(latestAvailability);
      setRateOverrides(latestRateOverrides);
      setAllReservations(latestReservations);
      setFinalValidationErrors([]);
    } catch (error: any) {
      console.error("[new-reservation] search availability error", error);
      toast({
        title: "Search failed",
        description: error?.message || "Failed to load availability.",
        variant: "destructive",
      });
    } finally {
      setIsSearchingAvailability(false);
    }
  }, [propertyId, stay.checkIn, stay.checkOut, getAuthHeaders]);

  useEffect(() => {
    setHasAvailabilitySearched(false);
    setAvailabilityWindow([]);
    setAllReservations([]);
    setRoomSelections([]);
    setSplitSegments([]);
    setSplitAnchor(null);
    setSplitHoverDate(null);
    setSplitInlineError(null);
  }, [stay.checkIn, stay.checkOut]);

  const nights = useMemo(() => {
    const inDate = new Date(stay.checkIn);
    const outDate = new Date(stay.checkOut);
    if (!stay.checkIn || !stay.checkOut || !isAfter(outDate, inDate)) return 0;
    return differenceInDays(outDate, inDate);
  }, [stay.checkIn, stay.checkOut]);

  const selectedRatePlanIds = useMemo(
    () => {
      const source = availabilityViewMode === "split"
        ? splitSegments.map((segment) => segment.ratePlanId)
        : roomSelections.map((selection) => selection.ratePlanId);
      return Array.from(new Set(source.filter(Boolean)));
    },
    [availabilityViewMode, splitSegments, roomSelections]
  );

  const requestedGuestCount = useMemo(() => Math.max(1, stay.adults + stay.children), [stay.adults, stay.children]);

  const capacityEligibleRoomTypes = useMemo(() => {
    return roomTypes.filter((rt) => {
      const maxGuests = Number(rt.maxGuests || 0);
      if (!Number.isFinite(maxGuests) || maxGuests <= 0) return true;
      return requestedGuestCount <= maxGuests;
    });
  }, [roomTypes, requestedGuestCount]);

  const filteredRoomTypes = useMemo(() => {
    if (availabilityRoomTypeFilter === "all") return capacityEligibleRoomTypes;
    return capacityEligibleRoomTypes.filter((rt) => rt.id === availabilityRoomTypeFilter);
  }, [capacityEligibleRoomTypes, availabilityRoomTypeFilter]);

  useEffect(() => {
    if (availabilityRoomTypeFilter === "all") return;
    const stillEligible = capacityEligibleRoomTypes.some((rt) => rt.id === availabilityRoomTypeFilter);
    if (!stillEligible) {
      setAvailabilityRoomTypeFilter("all");
    }
  }, [availabilityRoomTypeFilter, capacityEligibleRoomTypes]);

  const stayDates = useMemo(() => {
    if (!stay.checkIn || nights <= 0) return [] as string[];
    const start = new Date(stay.checkIn);
    return Array.from({ length: nights }, (_, index) => format(addDays(start, index), "yyyy-MM-dd"));
  }, [stay.checkIn, nights]);

  const dateInSegment = useCallback((date: string, startDate: string, endDate: string) => {
    return date >= startDate && date < endDate;
  }, []);

  const availabilityByTypeDate = useMemo(() => {
    const result: Record<string, Record<string, { total: number; available: number; state: "available" | "limited" | "full" }>> = {};

    if (stayDates.length === 0) return result;

    const stayStart = stayDates[0];
    const stayEnd = stayDates[stayDates.length - 1];
    const activeReservations = allReservations.filter((r) => r.status !== "Canceled" && r.status !== "No-Show");

    const blockedRoomDates = new Set<string>();
    for (const row of availabilityWindow) {
      if (!row.room_id) continue;
      const status = normalizeAvailabilityStatus(row.status);
      if (!BLOCKED_AVAILABILITY_STATUSES.has(status)) continue;

      const rowStart = row.date;
      const rowEnd = row.end_date || row.date;
      const from = rowStart > stayStart ? rowStart : stayStart;
      const to = rowEnd < stayEnd ? rowEnd : stayEnd;
      if (from > to) continue;

      const fromDate = new Date(from);
      const toDate = new Date(to);
      for (let day = fromDate; day <= toDate; day = addDays(day, 1)) {
        blockedRoomDates.add(`${row.room_id}|${format(day, "yyyy-MM-dd")}`);
      }
    }

    const busyRoomDates = new Set<string>();
    for (const reservation of activeReservations) {
      const start = startOfDay(reservation.startDate);
      const end = startOfDay(reservation.endDate);
      for (let day = start; day < end; day = addDays(day, 1)) {
        const dayKey = format(day, "yyyy-MM-dd");
        for (const rr of reservation.rooms || []) {
          busyRoomDates.add(`${rr.roomId}|${dayKey}`);
        }
      }
    }

    for (const roomType of roomTypes) {
      const typeRooms = rooms.filter((r) => r.roomTypeId === roomType.id);
      const total = typeRooms.length;
      result[roomType.id] = {};

      for (const date of stayDates) {
        let available = 0;

        for (const room of typeRooms) {
          const key = `${room.id}|${date}`;
          if (blockedRoomDates.has(key) || busyRoomDates.has(key)) {
            continue;
          }
          available += 1;
        }

        const limitedThreshold = Math.max(1, Math.floor(total * 0.3));
        const state: "available" | "limited" | "full" =
          available <= 0 ? "full" : available <= limitedThreshold ? "limited" : "available";

        result[roomType.id][date] = { total, available, state };
      }
    }

    return result;
  }, [roomTypes, rooms, stayDates, availabilityWindow, allReservations]);

  // Effective base rate per room type: uses base_rates table (fetched on bootstrap),
  // then applies any matching rate override from the calendar API for the selected stay dates.
  const effectiveBaseRateByType = useMemo(() => {
    const result: Record<string, number> = {};
    for (const rt of roomTypes) {
      // 1. Find the most applicable base rate record from the base_rates table
      const applicableBaseRates = baseRatesList.filter((br) => {
        if (br.room_type_id !== rt.id) return false;
        if (br.is_active === false) return false;
        // Must start on or before check-in
        if (br.start_date > stay.checkIn) return false;
        // Must not have ended before check-in
        if (br.end_date && br.end_date < stay.checkIn) return false;
        return true;
      });
      // Sort by start_date descending to pick the most recent match
      applicableBaseRates.sort((a, b) => (b.start_date > a.start_date ? 1 : -1));
      const bestBaseRate = applicableBaseRates[0];
      let price: number = bestBaseRate?.base_price ?? rt.baseRate ?? 0;

      // 2. Check for a rate override covering the stay's check-in date
      const applicableOverrides = rateOverrides.filter((ro) => {
        if (ro.room_type_id !== rt.id) return false;
        // Override must start on or before check-in
        if (ro.date > stay.checkIn) return false;
        // Override must not have ended before check-in
        if (ro.end_date && ro.end_date < stay.checkIn) return false;
        return true;
      });
      if (applicableOverrides.length > 0) {
        // Pick the most recent (first in array since calendar API orders by id desc)
        const override = applicableOverrides[0];
        if (override.override_type === "fixed" && override.override_value != null) {
          price = override.override_value;
        } else if (override.override_type === "percentage" && override.override_value != null) {
          price = price * (1 + override.override_value / 100);
        }
      }

      result[rt.id] = price;
    }
    return result;
  }, [roomTypes, baseRatesList, rateOverrides, stay.checkIn]);

  const resolveNightlyRate = useCallback((roomTypeId: string, ratePlanId: string, adults: number, children: number) => {
    const roomType = roomTypes.find((t) => t.id === roomTypeId);
    const plan = ratePlans.find((p) => p.id === ratePlanId);

    // Start from the effective base rate (base_rates table + overrides) rather than the room type's static baseRate
    let nightly = effectiveBaseRateByType[roomTypeId] ?? roomType?.baseRate ?? 0;

    if (plan) {
      if (plan.pricingMethod === "per_guest" && plan.pricingPerGuest) {
        const guests = Math.max(1, adults + children);
        const direct = plan.pricingPerGuest[String(guests)];
        if (typeof direct === "number") {
          nightly = direct;
        }
      } else if (typeof plan.basePrice === "number") {
        nightly = plan.basePrice;
      }

      if (plan.is_derived_from_base && plan.adjustment_type && typeof plan.adjustment_value === "number") {
        if (plan.adjustment_type === "fixed") {
          nightly = nightly + plan.adjustment_value;
        }
        if (plan.adjustment_type === "percentage") {
          nightly = nightly + nightly * (plan.adjustment_value / 100);
        }
      }
    }

    return Math.max(0, nightly);
  }, [roomTypes, ratePlans, effectiveBaseRateByType]);

  const getGridRateForRoomType = useCallback((roomTypeId: string) => {
    const roomType = roomTypes.find((type) => type.id === roomTypeId);
    if (!roomType) return 0;

    if (availabilityDisplayMode === "base-rates") {
      return effectiveBaseRateByType[roomTypeId] ?? roomType.baseRate ?? 0;
    }

    const typePlans = ratePlans.filter((plan) => plan.roomTypeId === roomTypeId);
    const defaultPlan = typePlans.find((plan) => plan.default) || typePlans[0];
    if (!defaultPlan) {
      return effectiveBaseRateByType[roomTypeId] ?? roomType.baseRate ?? 0;
    }

    return resolveNightlyRate(roomTypeId, defaultPlan.id, stay.adults, stay.children);
  }, [roomTypes, ratePlans, availabilityDisplayMode, effectiveBaseRateByType, resolveNightlyRate, stay.adults, stay.children]);

  const isPromotionEligible = useCallback(
    (promo: Promotion) => {
      if (!promo.active) return false;
      if (!stay.checkIn || !stay.checkOut) return false;

      const stayStart = startOfDay(new Date(stay.checkIn));
      const stayEnd = startOfDay(new Date(stay.checkOut));
      const promoStart = startOfDay(new Date(promo.startDate));
      const promoEnd = startOfDay(new Date(promo.endDate));

      const overlapsPromoWindow = stayStart <= promoEnd && stayEnd >= promoStart;
      if (!overlapsPromoWindow) return false;

      if (!promo.ratePlanIds || promo.ratePlanIds.length === 0) return true;
      return promo.ratePlanIds.some((id) => selectedRatePlanIds.includes(id));
    },
    [stay.checkIn, stay.checkOut, selectedRatePlanIds]
  );

  const availableAutomaticPromos = useMemo(
    () => promotions.filter((p) => !p.couponCode && isPromotionEligible(p)),
    [promotions, isPromotionEligible]
  );

  const selectedPromotion = useMemo(() => {
    const promo = promotions.find((p) => p.id === selectedPromotionId) || null;
    if (!promo) return null;
    return isPromotionEligible(promo) ? promo : null;
  }, [promotions, selectedPromotionId, isPromotionEligible]);

  useEffect(() => {
    if (selectedPromotionId === "none") return;
    if (!selectedPromotion) {
      setSelectedPromotionId("none");
    }
  }, [selectedPromotionId, selectedPromotion]);

  const roomsTotal = useMemo(() => {
    if (availabilityViewMode === "split") {
      return splitSegments.reduce((sum, segment) => {
        const segmentNights = Math.max(0, differenceInDays(new Date(segment.endDate), new Date(segment.startDate)));
        const nightly = resolveNightlyRate(segment.roomTypeId, segment.ratePlanId, stay.adults, stay.children);
        return sum + nightly * segmentNights;
      }, 0);
    }

    return roomSelections.reduce((sum, selection) => {
      const nightly = resolveNightlyRate(selection.roomTypeId, selection.ratePlanId, selection.adults, selection.children);
      return sum + nightly * nights;
    }, 0);
  }, [availabilityViewMode, splitSegments, roomSelections, nights, resolveNightlyRate, stay.adults, stay.children]);

  const extrasTotal = useMemo(() => {
    const selectedServices = services.filter((s) => selectedServiceIds.includes(s.id));
    const selectedMealPlans = mealPlans.filter((m) => selectedMealPlanIds.includes(m.id));

    if (availabilityViewMode === "split") {
      return splitSegments.reduce((total, segment) => {
        const segmentNights = Math.max(0, differenceInDays(new Date(segment.endDate), new Date(segment.startDate)));
        const segmentAdults = stay.adults;
        const segmentChildren = stay.children;

        const serviceTotal = selectedServices.reduce((sum, s) => {
          const unit = getServiceUnit(s);
          return sum + calculateExtraAmount(unit, s.price || 0, 1, segmentNights, segmentAdults, segmentChildren);
        }, 0);

        const mealTotal = selectedMealPlans.reduce((sum, m: any) => {
          const unit = getMealPlanUnit(m);
          const price = m.price || m.basePrice || m.pricePerNight || 0;
          return sum + calculateExtraAmount(unit, price, 1, segmentNights, segmentAdults, segmentChildren);
        }, 0);

        return total + serviceTotal + mealTotal;
      }, 0);
    }

    return roomSelections.reduce((total, roomSel) => {
      const serviceTotal = selectedServices.reduce((sum, s) => {
        const unit = getServiceUnit(s);
        return sum + calculateExtraAmount(unit, s.price || 0, 1, nights, roomSel.adults, roomSel.children);
      }, 0);

      const mealTotal = selectedMealPlans.reduce((sum, m: any) => {
        const unit = getMealPlanUnit(m);
        const price = m.price || m.basePrice || m.pricePerNight || 0;
        return sum + calculateExtraAmount(unit, price, 1, nights, roomSel.adults, roomSel.children);
      }, 0);

      return total + serviceTotal + mealTotal;
    }, 0);
  }, [services, mealPlans, selectedServiceIds, selectedMealPlanIds, availabilityViewMode, splitSegments, roomSelections, nights, stay.adults, stay.children]);

  const subtotal = roomsTotal + extrasTotal;

  const discountAmount = useMemo(() => {
    if (!selectedPromotion) return 0;
    if (selectedPromotion.discountType === "percentage") {
      return subtotal * ((selectedPromotion.discountValue || 0) / 100);
    }
    return selectedPromotion.discountValue || 0;
  }, [selectedPromotion, subtotal]);

  const taxAmount = useMemo(() => {
    const rate = property?.taxSettings?.enabled ? property?.taxSettings?.rate || 0 : 0;
    return (subtotal - discountAmount) * (rate / 100);
  }, [subtotal, discountAmount, property]);

  const totalPrice = subtotal - discountAmount + taxAmount;

  const handleApplyCoupon = (inputCode?: string) => {
    const normalized = (inputCode ?? couponCode).trim().toUpperCase();
    if (!normalized) {
      toast({ title: "Coupon", description: "Enter a coupon code.", variant: "destructive" });
      return;
    }

    const promo = promotions.find(
      (p) => (p.couponCode || "").trim().toUpperCase() === normalized
    );

    if (!promo) {
      toast({ title: "Coupon", description: "Coupon not found.", variant: "destructive" });
      return;
    }

    if (!isPromotionEligible(promo)) {
      toast({
        title: "Coupon",
        description: "Coupon is not valid for selected dates or rate plans.",
        variant: "destructive",
      });
      return;
    }

    setCouponCode(normalized);
    setSelectedPromotionId(promo.id);
    toast({ title: "Coupon applied", description: `${promo.name} is now active.` });
  };

  const evaluateSelectedRoomsAgainstLatest = useCallback(
    (latestAvailability: CalendarAvailabilityRow[], latestReservations: ReservationLite[]) => {
      const checkInDate = stay.checkIn;
      const checkOutDate = stay.checkOut;

      const dateInRange = (date: string, start: string, end?: string | null) => {
        const rangeEnd = end || start;
        return date >= start && date <= rangeEnd;
      };

      const roomBlockedByAvailability = new Set<string>();
      const roomClosedToArrival = new Set<string>();
      const roomNightRestricted = new Set<string>();

      for (const row of latestAvailability) {
        const rowEnd = row.end_date || row.date;
        const overlaps = !(row.date > checkOutDate || rowEnd < checkInDate);
        if (!row.room_id || !overlaps) continue;

        const rowStatus = normalizeAvailabilityStatus(row.status);
        if (BLOCKED_AVAILABILITY_STATUSES.has(rowStatus)) {
          roomBlockedByAvailability.add(row.room_id);
        }

        if (row.close_to_arrival && dateInRange(checkInDate, row.date, row.end_date)) {
          roomClosedToArrival.add(row.room_id);
        }

        const minNights = row.min_nights ?? null;
        const maxNights = row.max_nights ?? null;
        const restrictionAppliesOnCheckIn = dateInRange(checkInDate, row.date, row.end_date);
        if (restrictionAppliesOnCheckIn) {
          if ((minNights != null && nights < minNights) || (maxNights != null && nights > maxNights)) {
            roomNightRestricted.add(row.room_id);
          }
        }
      }

      const activeReservations = latestReservations.filter(
        (r) => r.status !== "Canceled" && r.status !== "No-Show"
      );
      const checkInObj = new Date(stay.checkIn);
      const checkOutObj = new Date(stay.checkOut);

      const roomStatusById: Record<string, { available: boolean; reason: string }> = {};
      for (const room of rooms) {
        if (roomBlockedByAvailability.has(room.id)) {
          roomStatusById[room.id] = { available: false, reason: "Blocked" };
          continue;
        }
        if (roomClosedToArrival.has(room.id)) {
          roomStatusById[room.id] = { available: false, reason: "Closed to arrival" };
          continue;
        }
        if (roomNightRestricted.has(room.id)) {
          roomStatusById[room.id] = { available: false, reason: "Stay length restricted" };
          continue;
        }

        const hasConflict = activeReservations.some((res) => {
          const includesRoom = (res.rooms || []).some((rr) => rr.roomId === room.id);
          if (!includesRoom) return false;
          return checkInObj < res.endDate && checkOutObj > res.startDate;
        });

        if (hasConflict) {
          roomStatusById[room.id] = { available: false, reason: "Occupied" };
          continue;
        }

        roomStatusById[room.id] = { available: true, reason: "Available" };
      }

      const selectedRoomErrors = roomSelections.flatMap((selection) => {
        if (!selection.roomId) {
          return [`Selection ${selection.id}: missing room assignment.`];
        }
        const roomName = rooms.find((r) => r.id === selection.roomId)?.name || selection.roomId;
        const status = roomStatusById[selection.roomId] || { available: false, reason: "Unavailable" };
        if (!status.available) {
          return [`${roomName}: ${status.reason}`];
        }
        return [];
      });

      return {
        roomStatusById,
        selectedRoomErrors,
      };
    },
    [stay.checkIn, stay.checkOut, nights, rooms, roomSelections]
  );

  const runFinalPreSubmitValidation = useCallback(async () => {
    if (!propertyId) return false;

    const blockingErrors: string[] = [];
    const usingSplitMode = availabilityViewMode === "split";

    if (!stay.checkIn || !stay.checkOut || nights <= 0) {
      blockingErrors.push("Invalid stay dates.");
    }

    if (usingSplitMode && splitSegments.length === 0) {
      blockingErrors.push("No segment selected.");
    }

    if (!usingSplitMode && roomSelections.length === 0) {
      blockingErrors.push("No room selected.");
    }

    if (!usingSplitMode) {
      const selectedRoomIds = roomSelections.map((s) => s.roomId).filter(Boolean);
      const hasDuplicates = new Set(selectedRoomIds).size !== selectedRoomIds.length;
      if (hasDuplicates) {
        blockingErrors.push("Duplicate room assignments are not allowed.");
      }
    }

    const hasSplitCoverageGap = (() => {
      if (!usingSplitMode || splitSegments.length === 0) return false;
      const sorted = [...splitSegments].sort((a, b) => a.startDate.localeCompare(b.startDate));
      let expectedStart = stay.checkIn;

      for (let index = 0; index < sorted.length; index += 1) {
        const segment = sorted[index];
        if (segment.startDate !== expectedStart || segment.startDate >= segment.endDate) {
          return true;
        }
        const next = sorted[index + 1];
        if (next && next.startDate < segment.endDate) {
          return true;
        }
        expectedStart = segment.endDate;
      }

      return expectedStart !== stay.checkOut;
    })();

    if (hasSplitCoverageGap) {
      blockingErrors.push("Selected segments must cover the full stay without gaps.");
    }

    if (blockingErrors.length > 0) {
      setFinalValidationErrors(blockingErrors);
      toast({
        title: "Cannot create reservation",
        description: blockingErrors[0],
        variant: "destructive",
      });
      return false;
    }

    setIsFinalValidating(true);
    try {
      const headers = await getAuthHeaders();
      if (!headers) {
        setFinalValidationErrors(["Authentication session expired. Please sign in again."]);
        return false;
      }

      const params = new URLSearchParams({
        propertyId,
        minDate: stay.checkIn,
        maxDate: stay.checkOut,
      });

      const [availabilityRes, reservationsRes] = await Promise.all([
        fetch(`/api/property-settings/rates-availability/calendar?${params.toString()}`),
        fetch(`/api/reservations/list?propertyId=${propertyId}`, { headers }),
      ]);

      if (!availabilityRes.ok || !reservationsRes.ok) {
        setFinalValidationErrors(["Could not run final availability check. Please retry."]);
        return false;
      }

      const availabilityData = await availabilityRes.json();
      const reservationsData = await reservationsRes.json();

      const latestAvailability: CalendarAvailabilityRow[] = Array.isArray(availabilityData.availability)
        ? availabilityData.availability
        : [];

      const latestReservations: ReservationLite[] = (reservationsData.reservations || []).map((r: any) => ({
        id: r.id,
        status: r.status,
        startDate: new Date(r.startDate),
        endDate: new Date(r.endDate),
        rooms: Array.isArray(r.rooms) ? r.rooms : [],
      }));

      const { selectedRoomErrors } = evaluateSelectedRoomsAgainstLatest(latestAvailability, latestReservations);
      const effectiveErrors = usingSplitMode ? [] : selectedRoomErrors;

      if (effectiveErrors.length > 0) {
        setFinalValidationErrors(effectiveErrors);
        setAvailabilityWindow(latestAvailability);
        setAllReservations(latestReservations);
        toast({
          title: "Availability changed",
          description: effectiveErrors[0],
          variant: "destructive",
        });
        return false;
      }

      setFinalValidationErrors([]);
      setAvailabilityWindow(latestAvailability);
      setAllReservations(latestReservations);
      return true;
    } catch (error) {
      console.error("[new-reservation] final validation error", error);
      setFinalValidationErrors(["Final validation failed due to a network/server error."]);
      return false;
    } finally {
      setIsFinalValidating(false);
    }
  }, [propertyId, availabilityViewMode, splitSegments, stay.checkIn, stay.checkOut, nights, roomSelections, getAuthHeaders, evaluateSelectedRoomsAgainstLatest]);

  const stayDiagnostics = useMemo(() => {
    const hasDates = !!stay.checkIn && !!stay.checkOut;
    const datesValid = hasDates && isAfter(new Date(stay.checkOut), new Date(stay.checkIn));
    const hasInventory = roomTypes.length > 0 && rooms.length > 0;
    const hasRates = ratePlans.length > 0;

    const checkInDate = stay.checkIn;
    const checkOutDate = stay.checkOut;

    const dateInRange = (date: string, start: string, end?: string | null) => {
      const e = end || start;
      return date >= start && date <= e;
    };

    const roomBlockedByAvailability = new Set<string>();
    const roomClosedToArrival = new Set<string>();
    const roomNightRestricted = new Set<string>();

    for (const row of availabilityWindow) {
      const rowEnd = row.end_date || row.date;
      const overlaps = !(row.date > checkOutDate || rowEnd < checkInDate);
      if (!row.room_id || !overlaps) continue;

      const rowStatus = normalizeAvailabilityStatus(row.status);
      if (BLOCKED_AVAILABILITY_STATUSES.has(rowStatus)) {
        roomBlockedByAvailability.add(row.room_id);
      }

      if (row.close_to_arrival && dateInRange(checkInDate, row.date, row.end_date)) {
        roomClosedToArrival.add(row.room_id);
      }

      const minNights = row.min_nights ?? null;
      const maxNights = row.max_nights ?? null;
      const restrictionAppliesOnCheckIn = dateInRange(checkInDate, row.date, row.end_date);
      if (restrictionAppliesOnCheckIn) {
        if ((minNights != null && nights < minNights) || (maxNights != null && nights > maxNights)) {
          roomNightRestricted.add(row.room_id);
        }
      }
    }

    const activeReservations = allReservations.filter(
      (r) => r.status !== "Canceled" && r.status !== "No-Show"
    );
    const checkInObj = new Date(stay.checkIn);
    const checkOutObj = new Date(stay.checkOut);

    const roomStatusById: Record<string, { available: boolean; reason: string }> = {};

    const availableRooms = rooms.filter((room) => {
      if (roomBlockedByAvailability.has(room.id)) {
        roomStatusById[room.id] = { available: false, reason: "Blocked" };
        return false;
      }
      if (roomClosedToArrival.has(room.id)) {
        roomStatusById[room.id] = { available: false, reason: "Closed to arrival" };
        return false;
      }
      if (roomNightRestricted.has(room.id)) {
        roomStatusById[room.id] = { available: false, reason: "Stay length restricted" };
        return false;
      }

      const hasConflict = activeReservations.some((res) => {
        const includesRoom = (res.rooms || []).some((rr) => rr.roomId === room.id);
        if (!includesRoom) return false;
        return checkInObj < res.endDate && checkOutObj > res.startDate;
      });

      if (hasConflict) {
        roomStatusById[room.id] = { available: false, reason: "Occupied" };
        return false;
      }

      roomStatusById[room.id] = { available: true, reason: "Available" };
      return true;
    });

    for (const room of rooms) {
      if (!roomStatusById[room.id]) {
        roomStatusById[room.id] = { available: false, reason: "Unavailable" };
      }
    }

    const hasAtLeastOneAvailableRoom = availableRooms.length > 0;
    const allRoomsClosedToArrival = rooms.length > 0 && roomClosedToArrival.size >= rooms.length;
    const allRoomsNightRestricted = rooms.length > 0 && roomNightRestricted.size >= rooms.length;

    const checks = [
      {
        key: "dates",
        title: "Dates",
        pass: datesValid,
        message: datesValid ? "Dates are valid." : "Check-out must be after check-in.",
      },
      {
        key: "inventory",
        title: "Inventory",
        pass: hasInventory,
        message: hasInventory ? "Room types and rooms are configured." : "Missing room types or rooms setup.",
      },
      {
        key: "rates",
        title: "Rates",
        pass: hasRates,
        message: hasRates ? "Rate plans are available." : "No rate plans found for this property.",
      },
      {
        key: "restrictions",
        title: "Restrictions",
        pass: !allRoomsClosedToArrival && !allRoomsNightRestricted,
        message:
          allRoomsClosedToArrival
            ? "All rooms are closed to arrival on check-in date."
            : allRoomsNightRestricted
              ? "Stay length violates min/max nights restrictions for all rooms."
              : "No blocking restrictions for this stay.",
      },
      {
        key: "availability",
        title: "Availability",
        pass: hasAtLeastOneAvailableRoom,
        message: hasAtLeastOneAvailableRoom
          ? `${availableRooms.length} room(s) available for these dates.`
          : "No available rooms for selected dates (blocked or occupied).",
      },
    ];

    return {
      checks,
      pass: checks.every((c) => c.pass),
      availableRoomsCount: availableRooms.length,
      roomStatusById,
    };
  }, [stay.checkIn, stay.checkOut, nights, roomTypes.length, rooms, ratePlans.length, availabilityWindow, allReservations]);

  useEffect(() => {
    if (!calendarPrefill || hasAppliedCalendarPrefill) return;
    if (isLoadingData || isSearchingAvailability) return;
    if (!propertyId) return;
    if (stay.checkIn !== calendarPrefill.checkIn || stay.checkOut !== calendarPrefill.checkOut) return;

    if (!hasAvailabilitySearched) {
      void handleSearchAvailability();
      return;
    }

    const targetRoom = rooms.find((room) => room.id === calendarPrefill.roomId);
    const targetRoomType = roomTypes.find((rt) => rt.id === calendarPrefill.roomTypeId);

    if (!targetRoom || !targetRoomType) {
      toast({
        title: "Prefill unavailable",
        description: "The selected room could not be loaded. Please select a room manually.",
        variant: "destructive",
      });
      setHasAppliedCalendarPrefill(true);
      setIsCalendarPrefillHydrating(false);
      return;
    }

    const roomAvailability = stayDiagnostics.roomStatusById?.[targetRoom.id];
    if (!roomAvailability?.available) {
      toast({
        title: "Room no longer available",
        description: `${targetRoom.name} is no longer available for the selected dates.`,
        variant: "destructive",
      });
      setHasAppliedCalendarPrefill(true);
      setIsCalendarPrefillHydrating(false);
      return;
    }

    const roomTypeRatePlans = ratePlans.filter((rp) => rp.roomTypeId === targetRoom.roomTypeId);
    const preferredRatePlan = calendarPrefill.ratePlanId
      ? roomTypeRatePlans.find((rp) => rp.id === calendarPrefill.ratePlanId)
      : null;
    const defaultRatePlan = preferredRatePlan || roomTypeRatePlans.find((rp) => rp.default) || roomTypeRatePlans[0];
    const maxGuestsForType = Math.max(1, targetRoomType.maxGuests ?? 10);
    const normalizedAdults = Math.min(Math.max(prefillAdults, 1), maxGuestsForType);
    const normalizedChildren = Math.min(Math.max(prefillChildren, 0), Math.max(0, maxGuestsForType - normalizedAdults));

    setRoomSelections([
      {
        id: `prefill-${targetRoom.id}-${Date.now()}`,
        roomTypeId: targetRoom.roomTypeId,
        roomId: targetRoom.id,
        ratePlanId: defaultRatePlan?.id || "",
        adults: normalizedAdults,
        children: normalizedChildren,
      },
    ]);
    setAvailabilityQtyByType((prev) => ({ ...prev, [targetRoom.roomTypeId]: 1 }));
    setAvailabilityAdultsByType((prev) => ({ ...prev, [targetRoom.roomTypeId]: normalizedAdults }));
    setAvailabilityChildrenByType((prev) => ({ ...prev, [targetRoom.roomTypeId]: normalizedChildren }));
    setPrefillAdults(normalizedAdults);
    setPrefillChildren(normalizedChildren);
    setIsGuestCountPromptOpen(true);
    setHasAppliedCalendarPrefill(true);
    setIsCalendarPrefillHydrating(false);
  }, [
    calendarPrefill,
    hasAppliedCalendarPrefill,
    isLoadingData,
    isSearchingAvailability,
    propertyId,
    stay.checkIn,
    stay.checkOut,
    hasAvailabilitySearched,
    handleSearchAvailability,
    rooms,
    roomTypes,
    ratePlans,
    stayDiagnostics.roomStatusById,
    prefillAdults,
    prefillChildren,
  ]);
  const isCurrentStepValid = useMemo(() => {
    const currentStep = STEPS[stepIndex];

    if (currentStep === "Availability") {
      if (!hasAvailabilitySearched) return false;

      const hasDates = !!stay.checkIn && !!stay.checkOut;
      const datesValid = hasDates && isAfter(new Date(stay.checkOut), new Date(stay.checkIn));
      if (!datesValid) return false;

      if (availabilityViewMode === "split") {
        if (splitSegments.length === 0) return false;

        const sorted = [...splitSegments].sort((a, b) => a.startDate.localeCompare(b.startDate));
        let expectedStart = stay.checkIn;

        for (let index = 0; index < sorted.length; index += 1) {
          const segment = sorted[index];
          if (!segment.roomTypeId || !segment.startDate || !segment.endDate) return false;
          if (segment.startDate >= segment.endDate) return false;
          if (segment.startDate !== expectedStart) return false;

          const segmentDates = stayDates.filter((d) => d >= segment.startDate && d < segment.endDate);
          const allDatesAvailable = segmentDates.every((date) => {
            const cell = availabilityByTypeDate[segment.roomTypeId]?.[date];
            return !!cell && cell.available > 0;
          });
          if (!allDatesAvailable) return false;

          expectedStart = segment.endDate;

          const next = sorted[index + 1];
          if (next && next.startDate < segment.endDate) return false;
        }

        return expectedStart === stay.checkOut;
      }

      if (roomSelections.length === 0) return false;
      const selectedRoomIds = roomSelections.map((s) => s.roomId).filter(Boolean);
      const hasDuplicates = new Set(selectedRoomIds).size !== selectedRoomIds.length;
      if (hasDuplicates) return false;

      return roomSelections.every((s) => {
        if (!s.roomTypeId || !s.roomId) return false;
        // In demo mode, just check the selection has required fields filled
        return true;
      });
    }

    if (currentStep === "Guest") {
      return guest.firstName.trim().length > 0 && guest.lastName.trim().length > 0;
    }

    if (currentStep === "Extras") {
      return true;
    }

    if (currentStep === "Payment") {
      // Auto-detect payment status: if partial amount is set and valid, it's valid
      if (payment.partialPaymentAmount > 0 && payment.partialPaymentAmount < totalPrice) {
        return payment.partialPaymentAmount > 0;
      }
      return true;
    }

    return true;
  }, [stepIndex, hasAvailabilitySearched, stay.checkIn, stay.checkOut, availabilityViewMode, splitSegments, stayDates, availabilityByTypeDate, roomSelections, guest.firstName, guest.lastName, payment, totalPrice]);

  // Auto-detect payment status based on payment method and amount
  const computedPaymentStatus = useMemo(() => {
    if (payment.paymentMethod === "Do not collect payment") {
      return "Unpaid";
    }
    if (payment.partialPaymentAmount > 0 && payment.partialPaymentAmount < totalPrice) {
      return "Partially Paid";
    }
    if (payment.paymentMethod !== "Do not collect payment") {
      return "Paid";
    }
    return "Unpaid";
  }, [payment.paymentMethod, payment.partialPaymentAmount, totalPrice]);

  const splitCoverageError = useMemo(() => {
    if (availabilityViewMode !== "split") return null;
    if (!stay.checkIn || !stay.checkOut || nights <= 0) return null;
    if (splitSegments.length === 0) return null;

    const sorted = [...splitSegments].sort((a, b) => a.startDate.localeCompare(b.startDate));
    let expectedStart = stay.checkIn;

    for (let index = 0; index < sorted.length; index += 1) {
      const segment = sorted[index];
      if (segment.startDate !== expectedStart) {
        return "Selected segments must cover the full stay without gaps.";
      }
      if (segment.startDate >= segment.endDate) {
        return "Selected segments must cover the full stay without gaps.";
      }
      const next = sorted[index + 1];
      if (next && next.startDate < segment.endDate) {
        return "Selected segments must cover the full stay without gaps.";
      }
      expectedStart = segment.endDate;
    }

    if (expectedStart !== stay.checkOut) {
      return "Selected segments must cover the full stay without gaps.";
    }

    return null;
  }, [availabilityViewMode, splitSegments, stay.checkIn, stay.checkOut, nights]);

  const getSegmentPreviewRange = useCallback((roomTypeId: string) => {
    if (!splitAnchor || splitAnchor.roomTypeId !== roomTypeId || !splitHoverDate) {
      return null as { startDate: string; endDate: string } | null;
    }

    const startDate = splitAnchor.date <= splitHoverDate ? splitAnchor.date : splitHoverDate;
    const inclusiveEnd = splitAnchor.date <= splitHoverDate ? splitHoverDate : splitAnchor.date;
    const endDate = format(addDays(new Date(inclusiveEnd), 1), "yyyy-MM-dd");

    return { startDate, endDate };
  }, [splitAnchor, splitHoverDate]);

  const tryCreateSplitSegment = useCallback((roomTypeId: string, startDate: string, endDate: string) => {
    const hasOverlap = splitSegments.some((segment) => !(endDate <= segment.startDate || startDate >= segment.endDate));
    if (hasOverlap) {
      setSplitInlineError("Selected segments must cover the full stay without gaps.");
      return;
    }

    const segmentDates = stayDates.filter((d) => d >= startDate && d < endDate);
    const hasUnavailableDate = segmentDates.some((date) => {
      const cell = availabilityByTypeDate[roomTypeId]?.[date];
      return !cell || cell.available <= 0;
    });

    if (hasUnavailableDate) {
      setSplitInlineError("Selected segments must cover the full stay without gaps.");
      return;
    }

    const roomTypeRatePlans = ratePlans.filter((rp) => rp.roomTypeId === roomTypeId);
    const defaultRatePlan = roomTypeRatePlans.find((rp) => rp.default) || roomTypeRatePlans[0];
    const defaultRatePlanId = defaultRatePlan?.id ?? "";

    setSplitSegments((prev) => {
      const connectedSegments = prev.filter((segment) => {
        if (segment.roomTypeId !== roomTypeId || segment.ratePlanId !== defaultRatePlanId) {
          return false;
        }

        // Treat touching boundaries as one continuous range (exclusive endDate).
        return !(endDate < segment.startDate || startDate > segment.endDate);
      });

      if (connectedSegments.length === 0) {
        return [
          ...prev,
          {
            id: `${Date.now()}-${roomTypeId}-${startDate}`,
            roomTypeId,
            ratePlanId: defaultRatePlanId,
            startDate,
            endDate,
          },
        ];
      }

      const mergedStartDate = connectedSegments.reduce((minDate, segment) => (segment.startDate < minDate ? segment.startDate : minDate), startDate);
      const mergedEndDate = connectedSegments.reduce((maxDate, segment) => (segment.endDate > maxDate ? segment.endDate : maxDate), endDate);
      const mergedId = connectedSegments[0].id;

      const remainingSegments = prev.filter((segment) => !connectedSegments.some((connected) => connected.id === segment.id));

      return [
        ...remainingSegments,
        {
          id: mergedId,
          roomTypeId,
          ratePlanId: defaultRatePlanId,
          startDate: mergedStartDate,
          endDate: mergedEndDate,
        },
      ];
    });
    setSplitAnchor(null);
    setSplitHoverDate(null);
    setSplitInlineError(null);
  }, [splitSegments, stayDates, availabilityByTypeDate, ratePlans]);

  const onSplitCellClick = useCallback((roomTypeId: string, date: string) => {
    const cell = availabilityByTypeDate[roomTypeId]?.[date];
    if (!cell || cell.available <= 0) {
      return;
    }

    if (!splitAnchor) {
      const endDate = format(addDays(new Date(date), 1), "yyyy-MM-dd");
      tryCreateSplitSegment(roomTypeId, date, endDate);
      return;
    }

    if (splitAnchor.roomTypeId !== roomTypeId) {
      setSplitAnchor(null);
      setSplitHoverDate(null);
      const endDate = format(addDays(new Date(date), 1), "yyyy-MM-dd");
      tryCreateSplitSegment(roomTypeId, date, endDate);
      return;
    }

    const startDate = splitAnchor.date <= date ? splitAnchor.date : date;
    const inclusiveEnd = splitAnchor.date <= date ? date : splitAnchor.date;
    const endDate = format(addDays(new Date(inclusiveEnd), 1), "yyyy-MM-dd");
    tryCreateSplitSegment(roomTypeId, startDate, endDate);
  }, [availabilityByTypeDate, splitAnchor, tryCreateSplitSegment]);

  const removeSplitSegment = useCallback((segmentId: string) => {
    setSplitSegments((prev) => prev.filter((segment) => segment.id !== segmentId));
  }, []);

  const removeSplitSegmentByDate = useCallback((roomTypeId: string, date: string) => {
    setSplitSegments((prev) => prev.filter((segment) => {
      const containsDate = segment.roomTypeId === roomTypeId && date >= segment.startDate && date < segment.endDate;
      return !containsDate;
    }));
  }, []);

  const editSplitSegment = useCallback((segmentId: string) => {
    setSplitSegments((prev) => {
      const target = prev.find((segment) => segment.id === segmentId);
      if (!target) return prev;
      setSplitAnchor({ roomTypeId: target.roomTypeId, date: target.startDate });
      setSplitHoverDate(target.startDate);
      return prev.filter((segment) => segment.id !== segmentId);
    });
  }, []);

  useEffect(() => {
    if (availabilityViewMode !== "split") {
      setSplitInlineError(null);
      return;
    }

    setSplitInlineError(splitCoverageError);
  }, [availabilityViewMode, splitCoverageError]);

  useEffect(() => {
    if (availabilityViewMode !== "split") return;

    setSplitSegments((prev) => prev.filter((segment) => segment.startDate >= stay.checkIn && segment.endDate <= stay.checkOut));
    setSplitAnchor(null);
    setSplitHoverDate(null);
  }, [availabilityViewMode, stay.checkIn, stay.checkOut]);

  const removeRoomSelection = (id: string) => {
    setRoomSelections((prev) => prev.filter((row) => row.id !== id));
  };

  const addRoomSelectionFromType = (roomTypeId: string) => {
    const qty = Math.max(1, availabilityQtyByType[roomTypeId] || 1);
    const roomType = roomTypes.find((rt) => rt.id === roomTypeId);
    const maxGuestsForType = Math.max(1, roomType?.maxGuests ?? 10);
    const rawAdults = availabilityAdultsByType[roomTypeId] ?? stay.adults ?? 1;
    const rawChildren = availabilityChildrenByType[roomTypeId] ?? stay.children ?? 0;
    const selectedAdults = Math.min(Math.max(rawAdults, 1), maxGuestsForType);
    const selectedChildren = Math.min(Math.max(rawChildren, 0), Math.max(0, maxGuestsForType - selectedAdults));
    const selectedRoomIds = new Set(roomSelections.map((selection) => selection.roomId));
    const availableRooms = rooms
      .filter((room) => room.roomTypeId === roomTypeId)
      .filter((room) => !!stayDiagnostics.roomStatusById?.[room.id]?.available)
      .filter((room) => !selectedRoomIds.has(room.id))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

    const preferredRoomIdValue = availabilitySelectedRoomByType[roomTypeId];
    const preferredRoomId = preferredRoomIdValue && preferredRoomIdValue !== "auto" ? preferredRoomIdValue : null;
    const prioritizedAvailableRooms = preferredRoomId
      ? [
          ...availableRooms.filter((room) => room.id === preferredRoomId),
          ...availableRooms.filter((room) => room.id !== preferredRoomId),
        ]
      : availableRooms;

    const roomTypeRatePlans = ratePlans.filter((rp) => rp.roomTypeId === roomTypeId);
    const defaultRatePlan = roomTypeRatePlans.find((rp) => rp.default) || roomTypeRatePlans[0];
    const defaultRatePlanId = defaultRatePlan?.id ?? "";

    if (availableRooms.length === 0) {
      toast({
        title: "No availability",
        description: "No available room can be assigned for this accommodation type.",
        variant: "destructive",
      });
      return;
    }

    const rowsToAdd = prioritizedAvailableRooms.slice(0, qty).map((room, idx) => ({
      id: `${Date.now()}-${roomTypeId}-${idx}`,
      roomTypeId,
      roomId: room.id,
      ratePlanId: defaultRatePlanId,
      adults: selectedAdults,
      children: selectedChildren,
    }));

    if (rowsToAdd.length < qty) {
      toast({
        title: "Limited availability",
        description: `Only ${rowsToAdd.length} room(s) could be added for this accommodation type.`,
      });
    }

    setRoomSelections((prev) => [...prev, ...rowsToAdd]);
  };

  const toggleId = (items: string[], id: string) => {
    return items.includes(id) ? items.filter((x) => x !== id) : [...items, id];
  };

  const prefillMaxGuests = useMemo(() => {
    if (!calendarPrefill?.roomTypeId) return 10;
    const roomType = roomTypes.find((rt) => rt.id === calendarPrefill.roomTypeId);
    return Math.max(1, roomType?.maxGuests ?? 10);
  }, [calendarPrefill?.roomTypeId, roomTypes]);

  const prefillAdultOptions = useMemo(
    () => Array.from({ length: prefillMaxGuests }, (_, idx) => idx + 1),
    [prefillMaxGuests]
  );

  const prefillChildOptions = useMemo(
    () => Array.from({ length: Math.max(0, prefillMaxGuests - prefillAdults) + 1 }, (_, idx) => idx),
    [prefillMaxGuests, prefillAdults]
  );

  const applyPrefillGuestCount = useCallback(() => {
    if (!calendarPrefill) {
      setIsGuestCountPromptOpen(false);
      return;
    }

    const adults = Math.min(Math.max(prefillAdults, 1), prefillMaxGuests);
    const children = Math.min(Math.max(prefillChildren, 0), Math.max(0, prefillMaxGuests - adults));

    setStay((prev) => ({ ...prev, adults, children }));
    setRoomSelections((prev) => prev.map((selection) => (
      selection.roomId === calendarPrefill.roomId
        ? { ...selection, adults, children }
        : selection
    )));
    setAvailabilityAdultsByType((prev) => ({ ...prev, [calendarPrefill.roomTypeId]: adults }));
    setAvailabilityChildrenByType((prev) => ({ ...prev, [calendarPrefill.roomTypeId]: children }));
    setIsGuestCountPromptOpen(false);
    setStepIndex(STEPS.indexOf("Guest"));
  }, [calendarPrefill, prefillAdults, prefillChildren, prefillMaxGuests]);

  const goNext = () => {
    if (!isCurrentStepValid) return;
    setStepIndex((prev) => Math.min(prev + 1, STEPS.length - 1));
  };

  const goBack = () => {
    setStepIndex((prev) => Math.max(prev - 1, 0));
  };

  const goToExtras = () => {
    if (!isCurrentStepValid) return;
    setStepIndex(STEPS.indexOf("Extras"));
  };

  const goToPayment = () => {
    if (!isCurrentStepValid) return;
    // Mark Extras as skipped if jumping from Guest
    if (currentStep === "Guest") {
      setSkippedSteps((prev) => new Set([...prev, "Extras"]));
    }
    setStepIndex(STEPS.indexOf("Payment"));
  };

  const buildSelectedExtras = useCallback((nightsCount: number, adults: number, children: number) => {
    const serviceExtras = services
      .filter((service) => selectedServiceIds.includes(service.id))
      .map((service) => {
        const unit = getServiceUnit(service);
        return {
          id: service.id,
          name: service.name,
          price: service.price || 0,
          quantity: 1,
          unit,
          type: "service",
          total: calculateExtraAmount(unit, service.price || 0, 1, nightsCount, adults, children),
        };
      });

    const mealExtras = mealPlans
      .filter((mealPlan) => selectedMealPlanIds.includes(mealPlan.id))
      .map((mealPlan: any) => {
        const unit = getMealPlanUnit(mealPlan);
        const price = mealPlan.price || mealPlan.basePrice || mealPlan.pricePerNight || 0;
        return {
          id: mealPlan.id,
          name: mealPlan.name,
          price,
          quantity: 1,
          unit,
          type: "meal_plan",
          total: calculateExtraAmount(unit, price, 1, nightsCount, adults, children),
        };
      });

    return [...serviceExtras, ...mealExtras];
  }, [services, mealPlans, selectedServiceIds, selectedMealPlanIds]);

  const handleCreateReservation = async () => {
    if (!propertyId) return;
    setIsSubmitting(true);

    try {
      const passedFinalValidation = await runFinalPreSubmitValidation();
      if (!passedFinalValidation) {
        return;
      }

      const headers = await getAuthHeaders();
      if (!headers) {
        throw new Error("Authentication session expired. Please sign in again.");
      }

      const guestName = `${guest.firstName} ${guest.lastName}`.trim();
      const phoneValue = guest.mobile?.trim() || guest.phone?.trim() || null;
      const mappedPaymentStatus = payment.paymentMethod === "Do not collect payment"
        ? "Pending"
        : (payment.partialPaymentAmount > 0 && payment.partialPaymentAmount < totalPrice)
          ? "Partial"
          : "Paid";

      const roomsPayload = availabilityViewMode === "split"
        ? [...splitSegments]
            .sort((a, b) => a.startDate.localeCompare(b.startDate))
            .map((segment) => {
              const roomType = roomTypes.find((roomTypeItem) => roomTypeItem.id === segment.roomTypeId);
              const ratePlan = ratePlans.find((ratePlanItem) => ratePlanItem.id === segment.ratePlanId);
              const segmentNights = Math.max(0, differenceInDays(new Date(segment.endDate), new Date(segment.startDate)));
              const nightly = resolveNightlyRate(segment.roomTypeId, segment.ratePlanId, stay.adults, stay.children);

              return {
                roomId: "",
                roomName: roomType?.name || "Unassigned",
                roomTypeId: segment.roomTypeId,
                roomTypeName: roomType?.name || "Accommodation",
                ratePlanId: segment.ratePlanId,
                ratePlanName: ratePlan?.planName || "Base Rate",
                price: nightly * segmentNights,
                adults: stay.adults,
                children: stay.children,
                pricingMode: segment.ratePlanId ? "rate_plan" : "base_rate",
                manualPrice: null,
                selectedExtras: buildSelectedExtras(segmentNights, stay.adults, stay.children),
                segmentStartDate: segment.startDate,
                segmentEndDate: segment.endDate,
              };
            })
        : roomSelections.map((selection) => {
            const roomType = roomTypes.find((roomTypeItem) => roomTypeItem.id === selection.roomTypeId);
            const room = rooms.find((roomItem) => roomItem.id === selection.roomId);
            const ratePlan = ratePlans.find((ratePlanItem) => ratePlanItem.id === selection.ratePlanId);
            const nightly = resolveNightlyRate(selection.roomTypeId, selection.ratePlanId, selection.adults, selection.children);

            return {
              roomId: selection.roomId,
              roomName: room?.name || "",
              roomTypeId: selection.roomTypeId,
              roomTypeName: roomType?.name || "Accommodation",
              ratePlanId: selection.ratePlanId,
              ratePlanName: ratePlan?.planName || "Base Rate",
              price: nightly * nights,
              adults: selection.adults,
              children: selection.children,
              pricingMode: selection.ratePlanId ? "rate_plan" : "base_rate",
              manualPrice: null,
              selectedExtras: buildSelectedExtras(nights, selection.adults, selection.children),
            };
          });

      if (roomsPayload.length === 0) {
        throw new Error("At least one accommodation selection is required.");
      }

      const promotionPayload = selectedPromotion
        ? {
            id: selectedPromotion.id,
            name: selectedPromotion.name,
            discountAmount,
            discountType: selectedPromotion.discountType,
            discountValue: selectedPromotion.discountValue || 0,
          }
        : null;

      const payload = {
        action: "create",
        propertyId,
        guestId: null,
        guestName,
        guestEmail: guest.email?.trim() || null,
        guestPhone: phoneValue,
        guestCountry: guest.country || null,
        guestPassportOrId: guest.nationalId?.trim() || null,
        startDate: stay.checkIn,
        endDate: stay.checkOut,
        status: payment.reservationStatus,
        paymentStatus: mappedPaymentStatus,
        partialPaymentAmount: mappedPaymentStatus === "Partial" ? payment.partialPaymentAmount || 0 : 0,
        source: stay.source,
        rooms: roomsPayload,
        roomsTotal,
        extrasTotal,
        subtotal,
        discountAmount,
        taxAmount,
        totalPrice,
        notes: availabilityViewMode === "split"
          ? `Split view booking with ${splitSegments.length} segment(s).`
          : null,
        promotionApplied: promotionPayload,
      };

      const response = await fetch("/api/reservations/crud", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to create reservation.");
      }

      toast({ title: "Success", description: "Reservation created successfully." });
      router.push("/reservations/all");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create reservation",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const currency = property?.currency || "$";
  const currentStep = STEPS[stepIndex];
  const showBottomPriceBreakdown = currentStep !== "Payment";
  const feesAmount = taxAmount;
  const suggestedDeposit = 0;
  const balanceDue = Math.max(0, subtotal - feesAmount);
  const stickyFooterLeft = isMobile
    ? "0px"
    : sidebarState === "collapsed"
      ? "var(--sidebar-width-icon)"
      : "var(--sidebar-width)";

  const stepMeta: Record<StepKey, { icon: LucideIcon; hint: string }> = {
    Availability: { icon: CalendarRange, hint: "Search dates and assign accommodations from live availability" },
    Guest: { icon: UserRound, hint: "Capture primary guest identity and contact" },
    Extras: { icon: CircleDollarSign, hint: "Add services, meal plans, and apply promotions" },
    Payment: { icon: CreditCard, hint: "Payment method and reservation status" },
  };

  const StepIcon = stepMeta[currentStep].icon;

  if (isLoadingAuth || isLoadingData || isCalendarPrefillHydrating) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
      </div>
    );
  }

  return (
    <div className="relative h-full w-full overflow-auto font-body">
      <div className="relative z-10 mx-auto max-w-full space-y-5 p-4 md:p-6 lg:p-2">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <h1 className="font-headline text-2xl font-semibold tracking-tight text-foreground md:text-3xl">New Reservation</h1>

          <div className="flex flex-wrap items-center gap-4 lg:justify-end">
            {STEPS.map((step, index) => (
              <div key={step} className="flex items-center gap-2">
                {skippedSteps.has(step) ? (
                  <span className="text-xl font-bold text-muted-foreground">✕</span>
                ) : (
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-full border text-lg font-semibold ${
                      index < stepIndex
                        ? "border-primary text-primary"
                        : index === stepIndex
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-muted text-muted-foreground"
                    }`}
                  >
                    {index < stepIndex ? <Check className="h-6 w-6" /> : index + 1}
                  </div>
                )}
                <span className={`text-sm font-semibold ${index <= stepIndex ? "text-primary" : "text-foreground"}`}>{step}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-12">
            {currentStep === "Availability" ? (
              <div className="space-y-4">
                {isLoadingData ? <p className="text-sm text-muted-foreground">Loading booking data...</p> : null}

                <Card className="rounded-lg border-border bg-white">
                  <CardContent className="grid grid-cols-1 gap-3 pt-4 lg:grid-cols-6">
                    <div className="space-y-2">
                      <Label>Guests</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full justify-start text-left font-normal">
                            {stay.adults} adult{stay.adults !== 1 ? 's' : ''}, {stay.children} child{stay.children !== 1 ? 'ren' : ''}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-64 p-4" align="start">
                          <div className="space-y-3">
                            <div className="space-y-2">
                              <Label>Adults</Label>
                              <Select value={String(stay.adults)} onValueChange={(v) => setStay((p) => ({ ...p, adults: Number(v) }))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {[1, 2, 3, 4, 5, 6, 7, 8].map((num) => (
                                    <SelectItem key={num} value={String(num)}>{num}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label>Children</Label>
                              <Select value={String(stay.children)} onValueChange={(v) => setStay((p) => ({ ...p, children: Number(v) }))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {[0, 1, 2, 3, 4, 5].map((num) => (
                                    <SelectItem key={num} value={String(num)}>{num}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="space-y-2">
                      <Label>Select Source</Label>
                      <Select value={stay.source} onValueChange={(v: "Direct" | "Walk-in" | "OTA") => setStay((p) => ({ ...p, source: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Direct">Direct</SelectItem>
                          <SelectItem value="Walk-in">Walk-in</SelectItem>
                          <SelectItem value="OTA">OTA</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Check-In</Label>
                      <Input type="date" value={stay.checkIn} onChange={(e) => setStay((p) => ({ ...p, checkIn: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Check-Out</Label>
                      <Input type="date" value={stay.checkOut} onChange={(e) => setStay((p) => ({ ...p, checkOut: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Promo code</Label>
                      <Input value={availabilityPromoCode} onChange={(e) => setAvailabilityPromoCode(e.target.value)} placeholder="Enter promo code" />
                    </div>
                    <div className="space-y-2">
                      <Label className="opacity-0">Search</Label>
                      <Button
                        type="button"
                        className="w-full"
                        disabled={isSearchingAvailability || !propertyId}
                        onClick={async () => {
                          await handleSearchAvailability();
                          if (availabilityPromoCode.trim()) {
                            handleApplyCoupon(availabilityPromoCode);
                          }
                        }}
                      >
                        {isSearchingAvailability ? "Searching..." : "Search"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card className="overflow-hidden rounded-lg border-border bg-card">
                  <div className="grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)]">
                    <aside className="border-b border-border bg-muted/20 lg:border-b-0 lg:border-r">
                      <div className="border-b border-border px-4 py-3">
                        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                          {availabilityViewMode === "split" ? "Selected Segments" : "Accommodations"}
                        </h3>
                      </div>
                      <div className="max-h-[680px] space-y-2 overflow-y-auto p-3">
                        {availabilityViewMode === "split" ? (
                          splitSegments.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No segments selected yet.</p>
                          ) : (
                            [...splitSegments]
                              .sort((a, b) => a.startDate.localeCompare(b.startDate))
                              .map((segment) => {
                                const type = roomTypes.find((rt) => rt.id === segment.roomTypeId);
                                const segmentNights = Math.max(0, differenceInDays(new Date(segment.endDate), new Date(segment.startDate)));
                                const nightly = resolveNightlyRate(segment.roomTypeId, segment.ratePlanId, stay.adults, stay.children);
                                const segmentTotal = nightly * segmentNights;
                                const typeRatePlans = ratePlans.filter((rp) => rp.roomTypeId === segment.roomTypeId);

                                return (
                                  <div key={segment.id} className="rounded-md border border-border bg-card p-3 text-sm">
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                      <div className="min-w-0 flex-1">
                                        <p className="font-semibold text-foreground">{type?.name || "Accommodation"}</p>
                                      </div>
                                      <Button type="button" variant="ghost" size="sm" onClick={() => removeSplitSegment(segment.id)} className="h-5 w-5 p-0">×</Button>
                                    </div>
                                    <div className="space-y-1 text-muted-foreground">
                                      <p className="font-medium text-foreground">{currency}{segmentTotal.toFixed(2)}</p>
                                      <p>{segment.startDate} - {segment.endDate}</p>
                                      <p>{stay.adults} Adult{stay.adults !== 1 ? "s" : ""}, {stay.children} Children, {segmentNights} night{segmentNights !== 1 ? "s" : ""}</p>
                                    </div>
                                  </div>
                                );
                              })
                          )
                        ) : roomSelections.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No accommodations selected yet.</p>
                        ) : (
                          roomSelections.map((selection) => {
                            const type = roomTypes.find((rt) => rt.id === selection.roomTypeId);
                            const nightly = resolveNightlyRate(selection.roomTypeId, selection.ratePlanId, selection.adults, selection.children);
                            const roomTotal = nightly * nights;
                            return (
                              <div key={selection.id} className="rounded-md border border-border bg-card p-3 text-sm">
                                <div className="flex items-start justify-between gap-2 mb-2">
                                  <div className="min-w-0 flex-1">
                                    <p className="font-semibold text-foreground">{type?.name || "Accommodation"}</p>
                                  </div>
                                  <Button type="button" variant="ghost" size="sm" onClick={() => removeRoomSelection(selection.id)} className="h-5 w-5 p-0">×</Button>
                                </div>
                                <div className="space-y-1 text-muted-foreground">
                                  <p className="font-medium text-foreground">{currency}{roomTotal.toFixed(2)}</p>
                                  <p>{stay.checkIn} - {stay.checkOut}</p>
                                  <p>{selection.adults} Adult{selection.adults !== 1 ? "s" : ""}, {selection.children} Children, {nights} night{nights !== 1 ? "s" : ""}</p>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </aside>

                    <section className="min-w-0">
                      <div className="border-b border-border px-4 py-4">
                        <div className="flex flex-wrap items-end gap-4">
                          <div className="space-y-2 w-32">
                            <Label>View</Label>
                            <Select
                              value={availabilityViewMode}
                              onValueChange={(value: "simple" | "split") => {
                                setAvailabilityViewMode(value);
                                setSplitAnchor(null);
                                setSplitHoverDate(null);
                                setSplitInlineError(null);
                              }}
                            >
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="simple">Simple</SelectItem>
                                <SelectItem value="split">Split</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2 w-40">
                            <Label>Display</Label>
                            <Select value={availabilityDisplayMode} onValueChange={(value: "base-rates" | "default-rate-plan") => setAvailabilityDisplayMode(value)}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="base-rates">Base rates</SelectItem>
                                <SelectItem value="default-rate-plan">Default rate plan</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2 w-56">
                            <Label>Select accommodations</Label>
                            <Select value={availabilityRoomTypeFilter} onValueChange={setAvailabilityRoomTypeFilter}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">All room types</SelectItem>
                                {capacityEligibleRoomTypes.map((rt) => (
                                  <SelectItem key={rt.id} value={rt.id}>{rt.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSplitSegments([]);
                              setSplitAnchor(null);
                              setSplitHoverDate(null);
                              setSplitInlineError(null);
                            }}
                            className="ml-auto h-8"
                          >
                            Clear dates
                          </Button>
                        </div>
                      </div>

                      <div className="border-t border-border">
                        <div className="border-b border-border px-4 py-3">
                          <div className="flex items-center justify-between gap-4">
                            <h3 className="text-lg font-semibold text-foreground">Availability</h3>
                            {availabilityViewMode === "split" && splitAnchor ? (
                              <p className="text-xs text-muted-foreground">Select an end date on {roomTypes.find((rt) => rt.id === splitAnchor.roomTypeId)?.name || "the selected room type"} row.</p>
                            ) : null}
                          </div>
                        </div>
                        {!hasAvailabilitySearched ? (
                          <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                            Set stay dates and click Search to load availability.
                          </div>
                        ) : isSearchingAvailability ? (
                          <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                            Loading availability...
                          </div>
                        ) : availabilityViewMode === "simple" ? (
                          <div className="overflow-x-auto">
                            <table className="w-full min-w-[1040px] text-sm">
                              <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                                <tr>
                                  <th className="px-3 py-2">Type</th>
                                  <th className="px-3 py-2">Starting from</th>
                                  <th className="px-3 py-2">Stay</th>
                                  <th className="px-3 py-2">Available</th>
                                  <th className="px-3 py-2">Room</th>
                                  <th className="px-3 py-2">Adult</th>
                                  <th className="px-3 py-2">Child</th>
                                  <th className="px-3 py-2">Quantity</th>
                                  <th className="px-3 py-2 text-right">Action</th>
                                </tr>
                              </thead>
                              <tbody>
                                {filteredRoomTypes.map((rt) => {
                                  const typeRooms = rooms.filter((r) => r.roomTypeId === rt.id);
                                  const availableRooms = typeRooms
                                    .filter((r) => !!stayDiagnostics.roomStatusById?.[r.id]?.available)
                                    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
                                  const availableCount = availableRooms.length;
                                  const maxGuestsForType = Math.max(1, rt.maxGuests ?? 10);
                                  const defaultAdults = stay.adults ?? 1;
                                  const defaultChildren = stay.children ?? 0;
                                  const adults = Math.min(
                                    Math.max(availabilityAdultsByType[rt.id] ?? defaultAdults, 1),
                                    maxGuestsForType
                                  );
                                  const children = Math.min(
                                    Math.max(availabilityChildrenByType[rt.id] ?? defaultChildren, 0),
                                    Math.max(0, maxGuestsForType - adults)
                                  );
                                  const adultOptions = Array.from({ length: maxGuestsForType }, (_, idx) => idx + 1);
                                  const childOptions = Array.from({ length: Math.max(0, maxGuestsForType - adults) + 1 }, (_, idx) => idx);
                                  const quantity = availableCount > 0
                                    ? Math.min(Math.max(1, availabilityQtyByType[rt.id] || 1), availableCount)
                                    : 0;
                                  const quantityOptions = availableCount > 0
                                    ? Array.from({ length: availableCount }, (_, idx) => idx + 1)
                                    : [0];
                                  const selectedRoom = availabilitySelectedRoomByType[rt.id] || "auto";

                                  return (
                                    <tr key={rt.id} className="border-t border-border">
                                      <td className="px-3 py-2 font-medium text-foreground">{rt.name}</td>
                                      <td className="px-3 py-2 text-foreground">{currency}{(effectiveBaseRateByType[rt.id] ?? rt.baseRate ?? 0).toFixed(2)}</td>
                                      <td className="px-3 py-2 text-foreground whitespace-nowrap">{stay.checkIn} - {stay.checkOut}</td>
                                      <td className="px-3 py-2 text-foreground">{availableCount}</td>
                                      <td className="px-3 py-2">
                                        <Select
                                          value={selectedRoom}
                                          onValueChange={(value) => {
                                            setAvailabilitySelectedRoomByType((prev) => ({ ...prev, [rt.id]: value }));
                                          }}
                                          disabled={availableCount === 0}
                                        >
                                          <SelectTrigger className="h-9 w-[132px]"><SelectValue /></SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="auto">Auto assign</SelectItem>
                                            {availableRooms.map((room) => (
                                              <SelectItem key={room.id} value={room.id}>{room.name}</SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </td>
                                      <td className="px-3 py-2">
                                        <Select
                                          value={String(adults)}
                                          onValueChange={(value) => {
                                            const parsed = Number(value);
                                            const nextAdults = Number.isFinite(parsed)
                                              ? Math.min(Math.max(parsed, 1), maxGuestsForType)
                                              : 1;
                                            setAvailabilityAdultsByType((prev) => ({ ...prev, [rt.id]: nextAdults }));
                                            setAvailabilityChildrenByType((prev) => {
                                              const currentChildren = prev[rt.id] ?? defaultChildren;
                                              const maxChildren = Math.max(0, maxGuestsForType - nextAdults);
                                              return { ...prev, [rt.id]: Math.min(Math.max(currentChildren, 0), maxChildren) };
                                            });
                                          }}
                                        >
                                          <SelectTrigger className="h-9 w-[88px]"><SelectValue /></SelectTrigger>
                                          <SelectContent>
                                            {adultOptions.map((count) => (
                                              <SelectItem key={count} value={String(count)}>{count}</SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </td>
                                      <td className="px-3 py-2">
                                        <Select
                                          value={String(children)}
                                          onValueChange={(value) => {
                                            const parsed = Number(value);
                                            const nextChildren = Number.isFinite(parsed)
                                              ? Math.min(Math.max(parsed, 0), Math.max(0, maxGuestsForType - adults))
                                              : 0;
                                            setAvailabilityChildrenByType((prev) => ({ ...prev, [rt.id]: nextChildren }));
                                          }}
                                        >
                                          <SelectTrigger className="h-9 w-[88px]"><SelectValue /></SelectTrigger>
                                          <SelectContent>
                                            {childOptions.map((count) => (
                                              <SelectItem key={count} value={String(count)}>{count}</SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </td>
                                      <td className="px-3 py-2">
                                        <Select
                                          value={String(quantity)}
                                          onValueChange={(value) => {
                                            const parsed = Number(value);
                                            const nextQty = Number.isFinite(parsed)
                                              ? Math.min(Math.max(parsed, 1), Math.max(availableCount, 1))
                                              : 1;
                                            setAvailabilityQtyByType((prev) => ({ ...prev, [rt.id]: nextQty }));
                                          }}
                                          disabled={availableCount === 0}
                                        >
                                          <SelectTrigger className="h-9 w-[88px]"><SelectValue /></SelectTrigger>
                                          <SelectContent>
                                            {quantityOptions.map((qty) => (
                                              <SelectItem key={qty} value={String(qty)}>{qty}</SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </td>
                                      <td className="px-3 py-2 text-right">
                                        <Button type="button" size="sm" onClick={() => addRoomSelectionFromType(rt.id)} disabled={availableCount === 0}>Add</Button>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full min-w-[980px] text-sm">
                              <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                                <tr>
                                  <th className="sticky left-0 z-10 bg-muted/40 px-3 py-2">Room Type</th>
                                  {stayDates.map((date) => (
                                    <th key={date} className="px-2 py-2 text-center min-w-[86px]">{format(new Date(date), "dd MMM")}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {filteredRoomTypes.map((rt) => {
                                  const preview = getSegmentPreviewRange(rt.id);
                                  return (
                                    <tr key={rt.id} className="border-t border-border">
                                      <td className="sticky left-0 z-10 bg-card px-3 py-2 font-medium text-foreground whitespace-nowrap">{rt.name}</td>
                                      {stayDates.map((date) => {
                                        const cell = availabilityByTypeDate[rt.id]?.[date];
                                        const committed = splitSegments.some((segment) => segment.roomTypeId === rt.id && dateInSegment(date, segment.startDate, segment.endDate));
                                        const previewed = !!preview && dateInSegment(date, preview.startDate, preview.endDate);
                                        const state = cell?.state || "full";
                                        const displayRate = getGridRateForRoomType(rt.id);
                                        const isDisabled = !cell || cell.available <= 0;

                                        let stateClass = "bg-card hover:bg-primary/5";
                                        if (committed) stateClass = "bg-primary/20 ring-1 ring-primary";
                                        if (!committed && previewed) stateClass = "bg-accent/20 ring-1 ring-accent";

                                        return (
                                          <td
                                            key={`${rt.id}-${date}`}
                                            className={`px-2 py-2 text-center border-l border-border align-middle transition-colors ${stateClass} ${isDisabled ? "cursor-not-allowed opacity-70" : "cursor-pointer"}`}
                                            onMouseEnter={() => {
                                              if (splitAnchor?.roomTypeId === rt.id) {
                                                setSplitHoverDate(date);
                                              }
                                            }}
                                            onClick={() => {
                                              if (isDisabled) return;
                                              if (committed) {
                                                removeSplitSegmentByDate(rt.id, date);
                                                return;
                                              }
                                              onSplitCellClick(rt.id, date);
                                            }}
                                          >
                                            <div className="leading-tight space-y-1">
                                              <p className="font-semibold">{cell?.available ?? 0}</p>
                                              <p className="text-[11px] text-muted-foreground">{currency}{displayRate.toFixed(2)}</p>
                                              <div className="flex items-center justify-center">
                                                <input
                                                  type="checkbox"
                                                  checked={committed}
                                                  disabled={isDisabled}
                                                  className="h-4 w-4 rounded border-border accent-primary"
                                                  onClick={(event) => event.stopPropagation()}
                                                  onChange={(event) => {
                                                    if (event.target.checked) {
                                                      onSplitCellClick(rt.id, date);
                                                      return;
                                                    }
                                                    removeSplitSegmentByDate(rt.id, date);
                                                  }}
                                                />
                                              </div>
                                            </div>
                                          </td>
                                        );
                                      })}
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                        {hasAvailabilitySearched && availabilityViewMode === "split" && splitInlineError ? (
                          <div className="border-t border-border px-4 py-3 text-sm text-destructive">
                            Selected segments must cover the full stay without gaps.
                          </div>
                        ) : null}
                      </div>
                    </section>
                  </div>
                </Card>
              </div>
            ) : STEPS[stepIndex] === "Payment" ? (
              <div className="grid grid-cols-3 gap-6">
                {/* Left Column - Summaries (3/4 width) */}
                <div className="col-span-2 space-y-5">
                  {/* Reservation Summary */}
                  <div className="rounded-lg overflow-hidden border border-border">
                    <div className="bg-muted/60 border-b border-border px-4 py-2.5 flex items-center gap-2">
                      <span className="w-1 h-4 rounded-full bg-primary inline-block"></span>
                      <span className="font-semibold text-sm text-foreground">Reservation Summary</span>
                    </div>
                    <div className="bg-white">
                      <div className="grid grid-cols-5 gap-x-4 gap-y-3 px-4 py-3 text-xs border-b border-border">
                        <div>
                          <p className="text-muted-foreground mb-0.5">Check-In</p>
                          <p className="font-medium text-foreground">{format(stay.checkIn, 'MM/dd/yyyy')}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground mb-0.5">Check-Out</p>
                          <p className="font-medium text-foreground">{format(stay.checkOut, 'MM/dd/yyyy')}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground mb-0.5">Nights</p>
                          <p className="font-medium text-foreground">{differenceInDays(stay.checkOut, stay.checkIn)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground mb-0.5">Reservation Date</p>
                          <p className="font-medium text-foreground">{format(new Date(), 'MM/dd/yyyy')}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground mb-0.5">Source</p>
                          <p className="font-medium text-foreground">{stay.source}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-x-4 gap-y-3 px-4 py-3 text-xs border-b border-border">
                        <div>
                          <p className="text-muted-foreground mb-0.5">Guest</p>
                          <p className="font-medium text-foreground">{guest.firstName} {guest.lastName}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground mb-0.5">Email</p>
                          <p className="font-medium text-foreground">{guest.email || '-'}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground mb-0.5">Phone</p>
                          <p className="font-medium text-foreground">{guest.phone || guest.mobile || '-'}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-x-4 gap-y-3 px-4 py-3 text-xs border-b border-border">
                        <div>
                          <p className="text-muted-foreground mb-0.5">Country</p>
                          <p className="font-medium text-foreground">{guest.country || '-'}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground mb-0.5">Street Address</p>
                          <p className="font-medium text-foreground">{guest.address || '-'}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground mb-0.5">Apt, suite, floor etc.</p>
                          <p className="font-medium text-foreground">-</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-x-4 gap-y-3 px-4 py-3 text-xs border-b border-border">
                        <div>
                          <p className="text-muted-foreground mb-0.5">City</p>
                          <p className="font-medium text-foreground">{guest.city || '-'}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground mb-0.5">State/Region</p>
                          <p className="font-medium text-foreground">-</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground mb-0.5">Postal Code</p>
                          <p className="font-medium text-foreground">{guest.zipCode || '-'}</p>
                        </div>
                      </div>
                      <div className="px-4 py-3 text-xs">
                        <p className="text-muted-foreground mb-0.5">Estimated Arrival Time</p>
                        <p className="font-medium text-foreground">{guest.estimatedArrivalTime || '-'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Accommodations Summary */}
                  <div className="rounded-lg overflow-hidden border border-border">
                    <div className="bg-muted/60 border-b border-border px-4 py-2.5 flex items-center gap-2">
                      <span className="w-1 h-4 rounded-full bg-primary inline-block"></span>
                      <span className="font-semibold text-sm text-foreground">Accommodations Summary</span>
                    </div>
                    <div className="bg-white overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-border bg-muted/30">
                            <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground uppercase tracking-wide">Type</th>
                            <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground uppercase tracking-wide">Guest</th>
                            <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground uppercase tracking-wide">Arrival/Departure</th>
                            <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground uppercase tracking-wide">Guests</th>
                            <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground uppercase tracking-wide">Nights</th>
                            <th className="text-right px-4 py-2.5 font-semibold text-muted-foreground uppercase tracking-wide">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {availabilityViewMode === "split"
                            ? [...splitSegments]
                                .sort((a, b) => a.startDate.localeCompare(b.startDate))
                                .map((segment) => {
                                  const roomType = roomTypes.find((rt) => rt.id === segment.roomTypeId);
                                  const segmentNights = differenceInDays(new Date(segment.endDate), new Date(segment.startDate));
                                  const nightly = resolveNightlyRate(segment.roomTypeId, segment.ratePlanId, stay.adults, stay.children);
                                  const segmentTotal = nightly * segmentNights;
                                  return (
                                    <tr key={segment.id} className="border-b border-border last:border-0">
                                      <td className="px-4 py-3 text-muted-foreground">{roomType?.name || "Room"}</td>
                                      <td className="px-4 py-3 text-muted-foreground">{guest.firstName} {guest.lastName}</td>
                                      <td className="px-4 py-3 text-muted-foreground">{format(new Date(segment.startDate), "MM/dd/yyyy")} - {format(new Date(segment.endDate), "MM/dd/yyyy")}</td>
                                      <td className="px-4 py-3 text-muted-foreground">{stay.adults}</td>
                                      <td className="px-4 py-3 text-muted-foreground">{segmentNights}</td>
                                      <td className="px-4 py-3 text-right font-semibold text-foreground">{currency}{segmentTotal.toFixed(2)}</td>
                                    </tr>
                                  );
                                })
                            : roomSelections.map((selection) => {
                                const roomType = roomTypes.find((rt) => rt.id === selection.roomTypeId);
                                const assignedRoom = rooms.find((room) => room.id === selection.roomId);
                                const nights = differenceInDays(stay.checkOut, stay.checkIn);
                                const nightly = resolveNightlyRate(selection.roomTypeId, selection.ratePlanId, selection.adults, selection.children);
                                const roomTotal = nightly * nights;
                                return (
                                  <tr key={selection.id} className="border-b border-border last:border-0">
                                    <td className="px-4 py-3 text-muted-foreground">
                                      <p>{roomType?.name || "Room"}</p>
                                      {assignedRoom?.name ? (
                                        <p className="text-foreground">Room: {assignedRoom.name}</p>
                                      ) : null}
                                    </td>
                                    <td className="px-4 py-3 text-muted-foreground">{guest.firstName} {guest.lastName}</td>
                                    <td className="px-4 py-3 text-muted-foreground">{format(stay.checkIn, "MM/dd/yyyy")} - {format(stay.checkOut, "MM/dd/yyyy")}</td>
                                    <td className="px-4 py-3 text-muted-foreground">{stay.adults}</td>
                                    <td className="px-4 py-3 text-muted-foreground">{nights}</td>
                                    <td className="px-4 py-3 text-right font-semibold text-foreground">{currency}{roomTotal.toFixed(2)}</td>
                                  </tr>
                                );
                              })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Right Column - Total and Payment Info */}
                <div className="col-span-1 space-y-4">
                  {/* Total section */}
                  <div className="rounded-lg overflow-hidden border border-border bg-white">
                    <div className="bg-muted/60 border-b border-border px-4 py-2.5 flex items-center gap-2">
                      <span className="w-1 h-4 rounded-full bg-primary inline-block"></span>
                      <span className="font-semibold text-sm text-foreground">Price Breakdown</span>
                    </div>
                    <div className="divide-y divide-border text-sm">
                      <div className="flex justify-between items-center px-4 py-2.5">
                        <span className="text-muted-foreground">Subtotal</span>
                        <span className="text-foreground">{currency}{subtotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center px-4 py-2.5">
                        <span className="text-muted-foreground">Fees</span>
                        <span className="text-foreground">{currency}{feesAmount.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center px-4 py-2.5">
                        <span className="text-foreground">Grand Total</span>
                        <span className="text-foreground">{currency}{totalPrice.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center px-4 py-2.5">
                        <span className="text-muted-foreground">Suggested Deposit</span>
                        <span className="text-foreground">{currency}{suggestedDeposit.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center px-4 py-2.5 bg-muted/60">
                        <span className="font-semibold text-foreground">Balance Due</span>
                        <span className="font-bold text-foreground">{currency}{balanceDue.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Payment Information */}
                  <div className="rounded-lg overflow-hidden border border-border">
                    <div className="bg-primary text-primary-foreground px-4 py-2.5 font-bold text-sm">Payment Information</div>
                    <div className="bg-white p-4 space-y-3">
                      <div className="space-y-1.5">
                        <Label className="text-foreground text-sm">Payment Type</Label>
                        <Select value={payment.paymentMethod} onValueChange={(v) => setPayment((p) => ({ ...p, paymentMethod: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Do not collect payment">Do not collect payment</SelectItem>
                            <SelectItem value="Cash">Cash</SelectItem>
                            <SelectItem value="Card">Card</SelectItem>
                            <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-foreground text-sm">Reservation Status</Label>
                        <Select value={payment.reservationStatus} onValueChange={(v: "Pending" | "Confirmed") => setPayment((p) => ({ ...p, reservationStatus: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Pending">Pending</SelectItem>
                            <SelectItem value="Confirmed">Confirmed</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {payment.paymentMethod !== "Do not collect payment" && (
                        <div className="space-y-1.5">
                          <Label className="text-foreground text-sm">Partial Payment Amount</Label>
                          <div className="text-xs text-muted-foreground mb-1.5">Leave as 0 for full payment, or enter amount for partial payment</div>
                          <Input
                            type="number"
                            min={0}
                            max={totalPrice}
                            step="0.01"
                            value={payment.partialPaymentAmount}
                            onChange={(e) => setPayment((p) => ({ ...p, partialPaymentAmount: Number(e.target.value) || 0 }))}
                          />
                          <div className="text-xs text-muted-foreground mt-1">
                            Payment Status: <span className="font-semibold text-foreground">{computedPaymentStatus}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
            <Card className="rounded-lg border-border bg-card shadow-sm">
              <CardHeader className="border-b border-border pb-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-foreground">
                      <StepIcon className="h-5 w-5 text-primary" />
                      {currentStep}
                    </CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">{stepMeta[currentStep].hint}</p>
                  </div>
                  <Button variant="outline" onClick={() => router.push("/reservations/all")}>Exit</Button>
                </div>
            </CardHeader>
              <CardContent className="space-y-5 pt-5">
              {isLoadingData ? <p className="text-sm text-muted-foreground">Loading booking data...</p> : null}

              {STEPS[stepIndex] === "Guest" && (
                <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-6">
                  <aside className="space-y-3">
                    <div className="w-full aspect-square bg-muted rounded-lg flex items-center justify-center overflow-hidden">
                      {guest.guestPhoto ? (
                        <img src={guest.guestPhoto} alt="Guest photo" className="w-full h-full object-cover" />
                      ) : (
                        <div className="flex flex-col items-center justify-center w-full h-full">
                          <svg className="w-16 h-16 text-muted-foreground" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                        </div>
                      )}
                    </div>
                    <Button type="button" variant="outline" className="w-full">Take Photo</Button>
                    <Button type="button" variant="outline" className="w-full">Upload</Button>
                    <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded text-center">
                      <p className="font-medium">Image Dimensions:</p>
                      <p>180px × 180px</p>
                    </div>
                  </aside>
                  <section className="space-y-5">
                    <div>
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">Reservation Information</h3>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label>Estimated Arrival Time</Label>
                          <Input type="time" value={guest.estimatedArrivalTime} onChange={(e) => setGuest((p) => ({ ...p, estimatedArrivalTime: e.target.value }))} />
                        </div>
                        <div className="space-y-2">
                          <Label>Assignment</Label>
                          <Select value={guest.roomAssignment} onValueChange={(v) => setGuest((p) => ({ ...p, roomAssignment: v }))}>
                            <SelectTrigger><SelectValue placeholder="Room Number" /></SelectTrigger>
                            <SelectContent>
                              {availabilityViewMode === "split"
                                ? splitSegments.map((segment) => {
                                    const roomType = roomTypes.find((rt) => rt.id === segment.roomTypeId);
                                    const value = `segment:${segment.id}`;
                                    return (
                                      <SelectItem key={segment.id} value={value}>
                                        {roomType?.name || "Segment"} ({segment.startDate} - {segment.endDate})
                                      </SelectItem>
                                    );
                                  })
                                : roomSelections.map((sel) => {
                                    const room = rooms.find((r) => r.id === sel.roomId);
                                    return <SelectItem key={sel.id} value={sel.roomId}>{room?.roomNumber || `Room ${sel.roomId}`}</SelectItem>;
                                  })}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                    <Separator />
                    <div>
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">Primary Guest Information</h3>
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label>First Name</Label>
                            <Input value={guest.firstName} onChange={(e) => setGuest((p) => ({ ...p, firstName: e.target.value }))} />
                          </div>
                          <div className="space-y-2">
                            <Label>Last Name</Label>
                            <Input value={guest.lastName} onChange={(e) => setGuest((p) => ({ ...p, lastName: e.target.value }))} />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label>Gender</Label>
                            <Select value={guest.gender} onValueChange={(v) => setGuest((p) => ({ ...p, gender: v }))}>
                              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="male">Male</SelectItem>
                                <SelectItem value="female">Female</SelectItem>
                                <SelectItem value="other">Other</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Birth Date</Label>
                            <Input type="date" value={guest.birthDate} onChange={(e) => setGuest((p) => ({ ...p, birthDate: e.target.value }))} />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Email</Label>
                          <Input type="email" value={guest.email} onChange={(e) => setGuest((p) => ({ ...p, email: e.target.value }))} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label>Phone</Label>
                            <Input value={guest.phone} onChange={(e) => setGuest((p) => ({ ...p, phone: e.target.value }))} />
                          </div>
                          <div className="space-y-2">
                            <Label>Mobile</Label>
                            <div className="flex gap-2">
                              <Popover open={countryCodeOpen} onOpenChange={setCountryCodeOpen}>
                                <PopoverTrigger asChild>
                                  <Button variant="outline" className="w-24 justify-start text-left font-normal">
                                    {getCountriesData().find((c) => c.phone === guest.mobileCountryCode)?.flag || "🌍"} {guest.mobileCountryCode}
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-64 p-3" align="start">
                                  <div className="space-y-2">
                                    <Input
                                      placeholder="Search by country or code..."
                                      value={countryCodeSearch}
                                      onChange={(e) => setCountryCodeSearch(e.target.value)}
                                      className="mb-2"
                                    />
                                    <div className="max-h-64 overflow-y-auto space-y-1">
                                      {getCountriesData()
                                        .filter(
                                          (country) =>
                                            country.name.toLowerCase().includes(countryCodeSearch.toLowerCase()) ||
                                            country.phone.includes(countryCodeSearch) ||
                                            country.code.toLowerCase().includes(countryCodeSearch.toLowerCase())
                                        )
                                        .map((country) => (
                                          <button
                                            key={country.code}
                                            onClick={() => {
                                              setGuest((p) => ({ ...p, mobileCountryCode: country.phone }));
                                              setCountryCodeOpen(false);
                                              setCountryCodeSearch("");
                                            }}
                                            className="w-full text-left px-2 py-1.5 rounded hover:bg-muted text-sm flex items-center gap-2"
                                          >
                                            <span>{country.flag}</span>
                                            <span className="flex-1 truncate">{country.name}</span>
                                            <span className="text-xs text-muted-foreground">{country.phone}</span>
                                          </button>
                                        ))}
                                    </div>
                                  </div>
                                </PopoverContent>
                              </Popover>
                              <Input value={guest.mobile} onChange={(e) => setGuest((p) => ({ ...p, mobile: e.target.value }))} placeholder="Phone number" />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <Separator />
                    <div>
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">Address Information</h3>
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <Label>Address</Label>
                          <Input value={guest.address} onChange={(e) => setGuest((p) => ({ ...p, address: e.target.value }))} />
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="space-y-2">
                            <Label>City</Label>
                            <Input value={guest.city} onChange={(e) => setGuest((p) => ({ ...p, city: e.target.value }))} />
                          </div>
                          <div className="space-y-2">
                            <Label>Country</Label>
                            <Popover open={countryOpen} onOpenChange={setCountryOpen}>
                              <PopoverTrigger asChild>
                                <Button variant="outline" className="w-full justify-start text-left font-normal">
                                  {getCountriesData().find((c) => c.name === guest.country)?.flag || "🌍"} {guest.country}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-64 p-3" align="start">
                                <div className="space-y-2">
                                  <Input
                                    placeholder="Search by country or code..."
                                    value={countrySearch}
                                    onChange={(e) => setCountrySearch(e.target.value)}
                                    className="mb-2"
                                  />
                                  <div className="max-h-64 overflow-y-auto space-y-1">
                                    {getCountriesData()
                                      .filter(
                                        (country) =>
                                          country.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
                                          country.code.toLowerCase().includes(countrySearch.toLowerCase())
                                      )
                                      .map((country) => (
                                        <button
                                          key={country.code}
                                          onClick={() => {
                                            setGuest((p) => ({ ...p, country: country.name }));
                                            setCountryOpen(false);
                                            setCountrySearch("");
                                          }}
                                          className="w-full text-left px-2 py-1.5 rounded hover:bg-muted text-sm flex items-center gap-2"
                                        >
                                          <span>{country.flag}</span>
                                          <span className="flex-1 truncate">{country.name}</span>
                                          <span className="text-xs text-muted-foreground">{country.code}</span>
                                        </button>
                                      ))}
                                  </div>
                                </div>
                              </PopoverContent>
                            </Popover>
                          </div>
                          <div className="space-y-2">
                            <Label>ZIP Code</Label>
                            <Input value={guest.zipCode} onChange={(e) => setGuest((p) => ({ ...p, zipCode: e.target.value }))} />
                          </div>
                        </div>
                      </div>
                    </div>
                    <Separator />
                    <div>
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">Identity Information</h3>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label>ID Type</Label>
                          <Select value={guest.idType} onValueChange={(v) => setGuest((p) => ({ ...p, idType: v }))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Passport">Passport</SelectItem>
                              <SelectItem value="National ID">National ID</SelectItem>
                              <SelectItem value="Driving License">Driving License</SelectItem>
                              <SelectItem value="Other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>ID Number</Label>
                          <Input value={guest.nationalId} onChange={(e) => setGuest((p) => ({ ...p, nationalId: e.target.value }))} />
                        </div>
                      </div>
                    </div>
                  </section>
                </div>
              )}

              {STEPS[stepIndex] === "Extras" && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Automatic Promotion</Label>
                    <Select value={selectedPromotionId} onValueChange={setSelectedPromotionId}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {availableAutomaticPromos.map((promo) => (
                          <SelectItem key={promo.id} value={promo.id}>{promo.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Coupon Code</Label>
                    <div className="flex items-center gap-2">
                      <Input value={couponCode} onChange={(e) => setCouponCode(e.target.value)} placeholder="Optional coupon" />
                      <Button type="button" variant="outline" onClick={() => handleApplyCoupon()}>Apply</Button>
                    </div>
                  </div>

                  <Separator />

                  <div className="rounded border bg-muted/30 p-3 text-sm space-y-1">
                    <p><span className="font-medium">Promotion status:</span> {selectedPromotion ? selectedPromotion.name : "No promotion active"}</p>
                    <p className="text-muted-foreground">Promotions are validated by check-in date and selected rate plans.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Services</Label>
                      <div className="max-h-48 overflow-auto border rounded p-2 space-y-1">
                        {services.map((s) => (
                          <label key={s.id} className="flex items-center justify-between text-sm">
                            <span>{s.name}</span>
                            <input
                              type="checkbox"
                              checked={selectedServiceIds.includes(s.id)}
                              onChange={() => setSelectedServiceIds((prev) => toggleId(prev, s.id))}
                            />
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Meal Plans</Label>
                      <div className="max-h-48 overflow-auto border rounded p-2 space-y-1">
                        {mealPlans.map((m: any) => (
                          <label key={m.id} className="flex items-center justify-between text-sm">
                            <span>{m.name}</span>
                            <input
                              type="checkbox"
                              checked={selectedMealPlanIds.includes(m.id)}
                              onChange={() => setSelectedMealPlanIds((prev) => toggleId(prev, m.id))}
                            />
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <Label>Per Room Pricing Preview</Label>
                    <div className="space-y-2">
                      {(availabilityViewMode === "split" ? splitSegments.length === 0 : roomSelections.length === 0) ? (
                        <p className="text-sm text-muted-foreground">Add room selections to see pricing details.</p>
                      ) : (
                        (availabilityViewMode === "split" ? splitSegments : roomSelections).map((selection: any) => {
                          const isSplit = availabilityViewMode === "split";
                          const room = !isSplit ? rooms.find((r) => r.id === selection.roomId) : null;
                          const roomTypeId = selection.roomTypeId;
                          const roomType = roomTypes.find((t) => t.id === roomTypeId);
                          const previewNights = isSplit
                            ? Math.max(0, differenceInDays(new Date(selection.endDate), new Date(selection.startDate)))
                            : nights;
                          const adults = isSplit ? stay.adults : selection.adults;
                          const children = isSplit ? stay.children : selection.children;
                          const nightly = resolveNightlyRate(roomTypeId, selection.ratePlanId, adults, children);

                          const selectedServices = services.filter((s) => selectedServiceIds.includes(s.id));
                          const selectedMealPlans = mealPlans.filter((m) => selectedMealPlanIds.includes(m.id));

                          const roomExtras = [
                            ...selectedServices.map((s) => {
                              const unit = getServiceUnit(s);
                              return calculateExtraAmount(unit, s.price || 0, 1, previewNights, adults, children);
                            }),
                            ...selectedMealPlans.map((m: any) => {
                              const unit = getMealPlanUnit(m);
                              const price = m.price || m.basePrice || m.pricePerNight || 0;
                              return calculateExtraAmount(unit, price, 1, previewNights, adults, children);
                            }),
                          ].reduce((a, b) => a + b, 0);

                          const roomTotal = nightly * previewNights + roomExtras;

                          return (
                            <div key={selection.id} className="rounded border p-3 text-sm flex items-center justify-between">
                              <div>
                                <p className="font-medium">{room?.name || roomType?.name || "Room"} - {roomType?.name || "Type"}</p>
                                <p className="text-muted-foreground">{previewNights} night(s) x {currency}{nightly.toFixed(2)} + extras</p>
                              </div>
                              <p className="font-semibold">{currency}{roomTotal.toFixed(2)}</p>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              )}


            </CardContent>
          </Card>
            )}

      </div>
    </div>
    </div>

      <Dialog open={isGuestCountPromptOpen} onOpenChange={setIsGuestCountPromptOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Guests for Selected Room</DialogTitle>
            <DialogDescription>
              The room and dates were preselected from calendar drag. Set guest count to continue.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Adults</Label>
                <Select
                  value={String(prefillAdults)}
                  onValueChange={(value) => {
                    const parsed = Number(value);
                    const nextAdults = Number.isFinite(parsed)
                      ? Math.min(Math.max(parsed, 1), prefillMaxGuests)
                      : 1;
                    setPrefillAdults(nextAdults);
                    setPrefillChildren((prev) => Math.min(prev, Math.max(0, prefillMaxGuests - nextAdults)));
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {prefillAdultOptions.map((count) => (
                      <SelectItem key={count} value={String(count)}>{count}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Children</Label>
                <Select
                  value={String(Math.min(prefillChildren, Math.max(0, prefillMaxGuests - prefillAdults)))}
                  onValueChange={(value) => {
                    const parsed = Number(value);
                    const nextChildren = Number.isFinite(parsed)
                      ? Math.min(Math.max(parsed, 0), Math.max(0, prefillMaxGuests - prefillAdults))
                      : 0;
                    setPrefillChildren(nextChildren);
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {prefillChildOptions.map((count) => (
                      <SelectItem key={count} value={String(count)}>{count}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Max guests for this room type: {prefillMaxGuests}
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsGuestCountPromptOpen(false)}>
              Later
            </Button>
            <Button type="button" onClick={applyPrefillGuestCount}>
              Confirm Guests
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    {/* Sticky footer: price breakdown (non-payment steps) + navigation */}
    <div
      className="fixed bottom-0 right-0 z-50 border-t border-border bg-card shadow-lg transition-[left] duration-200 ease-linear"
      style={{ left: stickyFooterLeft }}
    >
      {showBottomPriceBreakdown ? (
        <div className="border-b border-border bg-muted/40">
          <div className="mx-auto flex max-w-[1600px] items-center gap-2 overflow-x-auto px-4 py-2 text-xs md:gap-4 md:px-6 lg:px-8">
            <div className="min-w-[120px]">
              <p className="font-medium text-muted-foreground">Subtotal</p>
              <p className="font-semibold text-foreground">{currency}{subtotal.toFixed(2)}</p>
            </div>
            <div className="min-w-[120px]">
              <p className="flex items-center gap-1 font-medium text-muted-foreground">
                <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border border-muted-foreground/40 text-[9px]">i</span>
                Fees
              </p>
              <p className="font-semibold text-foreground">{currency}{feesAmount.toFixed(2)}</p>
            </div>
            <div className="min-w-[130px]">
              <p className="font-medium text-muted-foreground">Grand Total</p>
              <p className="font-semibold text-foreground">{currency}{totalPrice.toFixed(2)}</p>
            </div>
            <div className="min-w-[140px]">
              <p className="font-medium text-muted-foreground">Suggested Deposit</p>
              <p className="font-semibold text-foreground">{currency}{suggestedDeposit.toFixed(2)}</p>
            </div>
            <div className="ml-auto min-w-[140px] rounded-md bg-muted px-3 py-1.5">
              <p className="font-semibold text-foreground">Balance Due</p>
              <p className="text-sm font-bold text-foreground">{currency}{balanceDue.toFixed(2)}</p>
            </div>
          </div>
        </div>
      ) : null}
      <div className="mx-auto max-w-[1600px] flex items-center justify-between gap-3 px-4 py-4 md:px-6 lg:px-8">
        {currentStep !== "Availability" && (
          <Button 
            variant="outline" 
            onClick={goBack} 
            className="min-w-[140px]"
          >
            &lt; {currentStep === "Guest" ? "Availability" : currentStep === "Extras" ? "Guest" : "Add-ons"}
          </Button>
        )}
        
        <div className="flex-1" />

        {currentStep === "Guest" ? (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={goToExtras}
              disabled={!isCurrentStepValid}
              className="min-w-[140px]"
            >
              Add Extras &gt;
            </Button>
            <Button
              onClick={goToPayment}
              disabled={!isCurrentStepValid}
              className="min-w-[160px] bg-primary hover:bg-primary/90"
            >
              Confirm &amp; Pay &gt;
            </Button>
          </div>
        ) : stepIndex < STEPS.length - 1 ? (
          <Button 
            onClick={goNext} 
            disabled={!isCurrentStepValid}
            className="min-w-[120px] bg-primary hover:bg-primary/90"
          >
            {currentStep === "Availability" ? "Guest Details >" : currentStep === "Extras" ? "Confirm & Pay >" : "Next"}
          </Button>
        ) : (
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer select-none">
              <input
                type="checkbox"
                checked={checkInOnComplete}
                onChange={(e) => setCheckInOnComplete(e.target.checked)}
                className="h-4 w-4 rounded border-border accent-primary"
              />
              Check guest in upon completing reservation
            </label>
            <Button 
              onClick={handleCreateReservation} 
              disabled={!isCurrentStepValid || isSubmitting || isFinalValidating}
              className="min-w-[200px] bg-primary hover:bg-primary/90 text-primary-foreground font-semibold uppercase tracking-wide"
            >
              {isFinalValidating ? "Validating..." : isSubmitting ? "Creating..." : "Confirm Reservation >"}
            </Button>
          </div>
        )}
      </div>
    </div>

    {/* Spacer to prevent content from being hidden behind sticky footer */}
    <div className="h-24" />
  </div>
);
}
