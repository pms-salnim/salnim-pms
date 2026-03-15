
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import RevenueFilters from '@/components/revenue/revenue-filters';
import { useAuth } from '@/contexts/auth-context';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, Timestamp, doc } from 'firebase/firestore';
import type { Reservation, SelectedExtra, ReservationRoom } from '@/components/calendar/types';
import type { Property } from '@/types/property';
import type { Room } from '@/types/room';
import type { RoomType } from '@/types/roomType';
import type { AvailabilitySetting } from '@/types/availabilityOverride';
import {
  differenceInDays,
  startOfDay,
  endOfDay,
  format,
  eachDayOfInterval,
  isWithinInterval,
  addDays,
  parseISO,
  subDays,
  endOfMonth,
  startOfMonth,
} from 'date-fns';
import { Icons } from '@/components/icons';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useTranslation } from 'react-i18next';
import type { Payment } from '@/app/(app)/payments/page';
import { generatePerformanceReportPdf, type ReportData } from '@/lib/performanceReportGenerator';
import { toast } from '@/hooks/use-toast';
import type { RatePlan } from '@/types/ratePlan';
import type { Promotion } from '@/types/promotion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import RoomTypeBreakdownTable from '@/components/revenue/room-type-breakdown-table';
import ExtrasBreakdownTable from '@/components/revenue/extras-breakdown-table';
import { Separator } from '@/components/ui/separator';
import FinancialSummaryTable from '@/components/revenue/financial-summary-table';
import PropertyOverviewTable from '@/components/revenue/property-overview-table'; // New Import
import type { SeasonalRate } from '@/types/seasonalRate';
import type { Expense } from '@/types/expense'; // Import Expense type
import ExpenseList from '@/components/revenue/expense-list'; // Import ExpenseList component
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import * as XLSX from 'xlsx-js-style';

export default function PerformanceReportsPage() {
  const { user, isLoadingAuth } = useAuth();
  const { t, i18n } = useTranslation(['pages/revenue/performance-reports', 'performance-report-pdf']);
  const [propertyId, setPropertyId] = useState<string | null>(null);
  const [propertySettings, setPropertySettings] = useState<Property | null>(null);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [allRooms, setAllRooms] = useState<Room[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [availabilitySettings, setAvailabilitySettings] = useState<AvailabilitySetting[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [allRatePlans, setAllRatePlans] = useState<RatePlan[]>([]);
  const [allPromotions, setAllPromotions] = useState<Promotion[]>([]);
  const [allSeasonalRates, setAllSeasonalRates] = useState<SeasonalRate[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]); // New state for expenses
  const [isLoading, setIsLoading] = useState(true);
  const [activeFilters, setActiveFilters] = useState<any>({
    dateRange: { from: subDays(new Date(), 29), to: new Date() },
    bookingSource: 'all',
    roomType: 'all',
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [reportData, setReportData] = useState<ReportData | null>(null);

  const currencySymbol = propertySettings?.currency || '$';

  useEffect(() => {
    if (user?.propertyId) {
      setPropertyId(user.propertyId);
    }
  }, [user]);

  useEffect(() => {
    if (!propertyId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);

    const dataSources = [
      { col: "properties", id: propertyId, setter: setPropertySettings, isDoc: true },
      { col: "reservations", setter: setReservations, process: (d: any) => ({ ...d, startDate: d.startDate.toDate(), endDate: d.endDate.toDate(), createdAt: d.createdAt && typeof d.createdAt.toDate === 'function' ? d.createdAt.toDate() : new Date() }) },
      { col: "rooms", setter: setAllRooms },
      { col: "roomTypes", setter: setRoomTypes },
      { col: "availability", setter: setAvailabilitySettings },
      { col: "payments", setter: setPayments },
      { col: "ratePlans", setter: setAllRatePlans },
      { col: "promotions", setter: setAllPromotions },
      { col: "seasonalRates", setter: (data: any) => setAllSeasonalRates(data.map((r:any) => ({...r, startDate: r.startDate.toDate(), endDate: r.endDate.toDate()})))},
      { col: "expenses", setter: setExpenses }, // Fetch expenses
    ];

    let listenersCount = dataSources.length;
    const doneLoading = () => {
        listenersCount--;
        if (listenersCount <= 0) setIsLoading(false);
    }

    const unsubscribers = dataSources.map(source => {
      const q = source.isDoc 
        ? doc(db, source.col, source.id!)
        : query(collection(db, source.col), where("propertyId", "==", propertyId));
      
      return onSnapshot(q as any, (snapshot: any) => {
        if (source.isDoc) {
          source.setter(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } as any : null);
        } else {
          source.setter(snapshot.docs.map((d: any) => ({ id: d.id, ...d.data(), ...(source.process ? source.process(d.data()) : {}) } as any)));
        }
        if(listenersCount > 0) doneLoading();
      }, (err) => {
          console.error(`Error fetching ${source.col}:`, err);
          if(listenersCount > 0) doneLoading();
      });
    });

    return () => unsubscribers.forEach(unsub => unsub());
  }, [propertyId]);

  const uniqueRoomTypes = useMemo(() => {
    if (!roomTypes) return [];
    return roomTypes.map(rt => rt.name).sort();
  }, [roomTypes]);

  const uniqueBookingSources = useMemo(() => {
    if (!reservations) return [];
    const sources = reservations.map(res => res.source).filter((s): s is 'Direct' | 'Walk-in' | 'OTA' => !!s);
    return [...new Set(sources)].sort();
  }, [reservations]);
  
  const calculateExtrasTotal = useCallback((reservation: Reservation): { total: number; breakdown: Record<string, { quantity: number; total: number; name: string }> } => {
    const breakdown: Record<string, { quantity: number; total: number; name: string }> = {};
    if (!reservation.rooms || reservation.rooms.length === 0) return { total: 0, breakdown };
    
    const nights = differenceInDays(reservation.endDate, reservation.startDate);
    if (nights <= 0) return { total: 0, breakdown };
  
    let totalExtras = 0;
  
    reservation.rooms.forEach(room => {
        const totalGuests = (room.adults || 0) + (room.children || 0);
        (room.selectedExtras || []).forEach(extra => {
            let itemTotal = 0;
            let effectiveQuantity = 0;
            const { price: unitPrice, quantity, unit } = extra;
            
            switch(unit) {
                case 'one_time':
                case 'per_booking':
                case 'one_time_per_room':
                    effectiveQuantity = quantity;
                    break;
                case 'per_night':
                case 'per_night_per_room':
                    effectiveQuantity = quantity * nights;
                    break;
                case 'per_guest':
                case 'one_time_per_guest':
                    effectiveQuantity = quantity * totalGuests;
                    break;
                case 'per_night_per_guest':
                    effectiveQuantity = quantity * nights * totalGuests;
                    break;
                default:
                    effectiveQuantity = quantity;
            }
            itemTotal = unitPrice * effectiveQuantity;
            
            if (breakdown[extra.id]) {
                breakdown[extra.id].quantity += effectiveQuantity;
                breakdown[extra.id].total += itemTotal;
            } else {
                breakdown[extra.id] = { name: extra.name, quantity: effectiveQuantity, total: itemTotal };
            }
            totalExtras += itemTotal;
        });
    });
  
    return { total: totalExtras, breakdown };
  }, []);
  
  const handleFilterChange = useCallback((newFilters: any) => {
    setActiveFilters(prev => ({ ...prev, ...newFilters }));
  }, []);

  const handleGenerateReport = useCallback(() => {
    if (!activeFilters.dateRange?.from || !activeFilters.dateRange.to) {
        toast({ title: "Date Range Required", description: "Please select a valid date range to generate the report.", variant: "destructive" });
        return;
    }
    setIsGenerating(true);

    const filterStart = startOfDay(activeFilters.dateRange.from);
    const filterEnd = endOfDay(activeFilters.dateRange.to);

    const filteredReservations = reservations.filter(res => {
        const resStart = startOfDay(res.startDate);
        const resEnd = startOfDay(res.endDate);
        const dateOverlap = resStart <= filterEnd && resEnd > filterStart;
        if (!dateOverlap) return false;
        
        const isRevenueGenerating = res.status !== 'Canceled' && res.status !== 'No-Show';
        if (!isRevenueGenerating) return false;

        const roomTypeMatch = activeFilters.roomType === 'all' || res.rooms.some(room => roomTypes.find(rt => rt.id === room.roomTypeId)?.name === activeFilters.roomType);
        if (!roomTypeMatch) return false;

        const sourceMatch = activeFilters.bookingSource === 'all' || res.source === activeFilters.bookingSource;
        if (!sourceMatch) return false;

        return true;
    });
    
    const filteredExpenses = expenses.filter(exp => {
      const expenseDate = parseISO(exp.date);
      return isWithinInterval(expenseDate, { start: filterStart, end: filterEnd });
    });
    
    let totalRevenueForStays = 0;
    let totalNightsBookedInPeriod = 0;
    let totalRoomsRevenue = 0;
    let totalExtrasRevenue = 0;
    let totalDiscounts = 0;
    let totalTaxes = 0;
    
    const paidWithPointsValue = reservations.filter(res => {
        const resStart = startOfDay(res.startDate);
        const resEnd = startOfDay(res.endDate);
        const dateOverlap = resStart <= filterEnd && resEnd > filterStart;
        return dateOverlap && res.paidWithPoints;
    }).reduce((sum, res) => sum + (res.totalPrice || 0), 0);
    
    const extrasBreakdownMap = new Map<string, { name: string; quantity: number; total: number }>();

    filteredReservations.forEach(res => {
        const resStart = startOfDay(res.startDate);
        const resEnd = startOfDay(res.endDate);

        const totalResNights = differenceInDays(resEnd, resStart);
        if (totalResNights <= 0) return;

        const { total: extrasTotalForRes, breakdown: extrasBreakdownForRes } = calculateExtrasTotal(res);
        const roomsTotalForRes = res.roomsTotal || 0;
        const subtotal = roomsTotalForRes + extrasTotalForRes;

        const discount = res.promotionApplied 
          ? (res.promotionApplied.discountType === 'percentage' 
              ? subtotal * (res.promotionApplied.discountValue / 100) 
              : res.promotionApplied.discountValue * totalResNights)
          : (res.discountAmount || 0);

        const netAmount = subtotal - discount;
        const taxRate = propertySettings?.taxSettings?.enabled ? (propertySettings.taxSettings.rate || 0) / 100 : 0;
        const taxAmount = netAmount * taxRate;
        
        const netRevenueForRes = netAmount;
        const revenuePerNight = netRevenueForRes / totalResNights;
        
        const daysInStay = eachDayOfInterval({ start: resStart, end: addDays(resEnd, -1) });
        let nightsInPeriod = 0;
        daysInStay.forEach(dayOfStay => {
            if (isWithinInterval(dayOfStay, { start: filterStart, end: filterEnd })) {
                totalRevenueForStays += revenuePerNight;
                nightsInPeriod++;
            }
        });

        if (nightsInPeriod > 0) {
            const roomRevenuePerNight = roomsTotalForRes / totalResNights;
            totalRoomsRevenue += roomRevenuePerNight * nightsInPeriod;
            
            res.rooms.forEach(room => {
                totalNightsBookedInPeriod += nightsInPeriod; // Count each room-night
            });
            
            totalExtrasRevenue += extrasTotalForRes;
            totalDiscounts += discount;
            totalTaxes += taxAmount;

            Object.entries(extrasBreakdownForRes).forEach(([id, data]) => {
                const existing = extrasBreakdownMap.get(id);
                if (existing) {
                    existing.quantity += data.quantity;
                    existing.total += data.total;
                } else {
                    extrasBreakdownMap.set(id, { ...data });
                }
            });
        }
    });

    const totalExpenses = filteredExpenses.reduce((sum, exp) => sum + exp.amount, 0);
    const totalStayNights = filteredReservations.reduce((acc, res) => acc + (differenceInDays(res.endDate, res.startDate) * res.rooms.length), 0);

    let totalSellableRoomNights = 0;
    const totalRooms = allRooms.length;
    if (totalRooms > 0) {
        const daysInFilterInterval = differenceInDays(filterEnd, filterStart) + 1;
        const totalAvailableRoomNights = totalRooms * daysInFilterInterval;

        let blockedRoomNights = 0;
        availabilitySettings.forEach(setting => {
          if (setting.status === 'blocked') {
            const blockStart = startOfDay(parseISO(setting.startDate));
            const blockEnd = startOfDay(parseISO(setting.endDate));
            const overlapStart = blockStart > filterStart ? blockStart : filterStart;
            const overlapEnd = blockEnd < filterEnd ? blockEnd : filterEnd;
            if (overlapEnd >= overlapStart) {
                const blockedNights = differenceInDays(overlapEnd, overlapStart) + 1;
                const numRoomsAffected = setting.roomId ? 1 : allRooms.filter(r => r.roomTypeId === setting.roomTypeId).length;
                blockedRoomNights += blockedNights * numRoomsAffected;
            }
          }
        });

        totalSellableRoomNights = totalAvailableRoomNights - blockedRoomNights;
    }
    
    const occupancyRate = totalSellableRoomNights > 0 ? (totalNightsBookedInPeriod / totalSellableRoomNights) * 100 : 0;
    const revPAR = totalSellableRoomNights > 0 ? totalRoomsRevenue / totalSellableRoomNights : 0;
    const averageDailyRate = totalNightsBookedInPeriod > 0 ? totalRoomsRevenue / totalNightsBookedInPeriod : 0;
    const avgStayLength = filteredReservations.length > 0 ? totalStayNights / filteredReservations.length : 0;
    
    const roomMetrics: { [roomId: string]: { revenue: number, nights: number } } = {};
    filteredReservations.forEach(res => {
        const nightsInPeriod = differenceInDays(
            res.endDate > filterEnd ? addDays(filterEnd, 1) : res.endDate,
            res.startDate < filterStart ? filterStart : res.startDate
        );
        if (nightsInPeriod <= 0) return;

        const totalResNights = differenceInDays(res.endDate, res.startDate);
        const roomsTotalForRes = res.roomsTotal || 0;
        const roomRevenuePerNight = totalResNights > 0 ? roomsTotalForRes / totalResNights : 0;
        
        const numRoomsInBooking = res.rooms.length || 1;
        const pricePerRoomPerNight = roomRevenuePerNight / numRoomsInBooking;

        res.rooms.forEach(room => {
            if (!roomMetrics[room.roomId]) roomMetrics[room.roomId] = { revenue: 0, nights: 0 };
            roomMetrics[room.roomId].revenue += pricePerRoomPerNight * nightsInPeriod;
            roomMetrics[room.roomId].nights += nightsInPeriod;
        });
    });

    const breakdownByRoomAndType = roomTypes.map(rt => {
        const roomsInType = allRooms.filter(r => r.roomTypeId === rt.id);
        const roomBreakdowns = roomsInType.map(room => {
            const metrics = roomMetrics[room.id] || { revenue: 0, nights: 0 };
            const totalNightsInRange = differenceInDays(filterEnd, filterStart) + 1;
            
            return {
                name: room.name,
                occupancy: totalNightsInRange > 0 ? (metrics.nights / totalNightsInRange) * 100 : 0,
                adr: metrics.nights > 0 ? metrics.revenue / metrics.nights : 0,
                revenue: metrics.revenue
            };
        });

        const totalRevenueForType = roomBreakdowns.reduce((sum, r) => sum + r.revenue, 0);
        const totalNightsSoldForType = roomsInType.reduce((sum, r) => sum + (roomMetrics[r.id]?.nights || 0), 0);
        const totalAvailableNightsForType = roomsInType.length * (differenceInDays(filterEnd, filterStart) + 1);

        return {
            roomTypeName: rt.name,
            occupancy: totalAvailableNightsForType > 0 ? (totalNightsSoldForType / totalAvailableNightsForType) * 100 : 0,
            adr: totalNightsSoldForType > 0 ? totalRevenueForType / totalNightsSoldForType : 0,
            revenue: totalRevenueForType,
            rooms: roomBreakdowns.filter(rb => rb.revenue > 0)
        };
    }).filter(group => group.revenue > 0);
    
    const pendingReservations = reservations.filter(
        res => (res.paymentStatus === 'Pending' || res.paymentStatus === 'Partial') && !res.paidWithPoints
    );
    
    const pendingRevenue = pendingReservations.reduce((totalDue, res) => {
        const totalPaid = payments
            .filter(p => p.reservationId === res.id && p.status === 'Paid')
            .reduce((sum, p) => sum + p.amountPaid, 0);
        const due = (res.totalPrice || 0) - totalPaid;
        return totalDue + (due > 0 ? due : 0);
    }, 0);
    
    setReportData({
      metrics: {
        totalRevenue: totalRevenueForStays,
        roomsRevenue: totalRoomsRevenue,
        extrasRevenue: totalExtrasRevenue,
        totalBookings: filteredReservations.length,
        averageDailyRate,
        occupancyRate,
        revPAR,
        avgStayLength,
        totalRevenueGross: totalRoomsRevenue + totalExtrasRevenue,
        totalDiscounts,
        totalTaxes,
        totalExpenses: totalExpenses,
        netRevenue: totalRoomsRevenue + totalExtrasRevenue - totalDiscounts,
        netProfit: totalRoomsRevenue + totalExtrasRevenue - totalDiscounts - totalExpenses,
        paidWithPointsValue,
      },
      reservations: filteredReservations.sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0)),
      dateRange: { from: activeFilters.dateRange.from, to: activeFilters.dateRange.to },
      filters: { roomType: activeFilters.roomType, bookingSource: activeFilters.bookingSource },
      breakdownByRoomAndType,
      extrasBreakdown: Array.from(extrasBreakdownMap.values()),
      expenses: filteredExpenses, 
    });

    setIsGenerating(false);
  }, [activeFilters.dateRange, activeFilters.roomType, activeFilters.bookingSource, reservations, allRooms, roomTypes, availabilitySettings, calculateExtrasTotal, payments, allPromotions, allSeasonalRates, expenses, propertySettings]);

  const handleDownloadPdf = async () => {
    if (!reportData) return;

    const translatedLabels = {
        performanceReportTitle: t('performance-report-pdf:performance_report_title'),
        periodLabel: t('performance-report-pdf:period_label'),
        propertyOverviewTitle: t('performance-report-pdf:property_overview.title'),
        metricLabel: t('performance-report-pdf:table_headers.metric'),
        valueLabel: t('performance-report-pdf:table_headers.value'),
        totalBookingsLabel: t('performance-report-pdf:property_overview.total_bookings'),
        occupancyRateLabel: t('performance-report-pdf:property_overview.occupancy_rate'),
        avgStayLabel: t('performance-report-pdf:property_overview.avg_stay'),
        adrLabel: t('performance-report-pdf:property_overview.adr'),
        revparLabel: t('performance-report-pdf:property_overview.revpar'),
        roomBreakdownTitle: t('performance-report-pdf:room_breakdown_title'),
        roomHeader: t('performance-report-pdf:table_headers.room'),
        roomTypeHeader: t('performance-report-pdf:table_headers.room_type'),
        occupancyHeader: t('performance-report-pdf:table_headers.occupancy'),
        adrHeader: t('performance-report-pdf:table_headers.adr'),
        totalRevenueHeader: t('performance-report-pdf:table_headers.total_revenue'),
        totalLabel: t('performance-report-pdf:table_headers.total_label'),
        extrasBreakdownTitle: t('performance-report-pdf:extras_breakdown_title'),
        extraNameHeader: t('performance-report-pdf:table_headers.extra_name'),
        quantitySoldHeader: t('performance-report-pdf:table_headers.quantity_sold'),
        expensesTitle: t('performance-report-pdf:expenses_title'),
        dateHeader: t('performance-report-pdf:table_headers.date'),
        expenseNameHeader: t('performance-report-pdf:table_headers.expense_name'),
        categoryHeader: t('performance-report-pdf:table_headers.category'),
        amountHeader: t('performance-report-pdf:table_headers.amount'),
        descriptionHeader: t('performance-report-pdf:table_headers.description'),
        financialSummaryTitle: t('performance-report-pdf:financial_summary.title'),
        roomsRevenueLabel: t('performance-report-pdf:financial_summary.rooms_revenue'),
        extrasRevenueLabel: t('performance-report-pdf:financial_summary.extras_revenue'),
        totalRevenueGrossLabel: t('performance-report-pdf:financial_summary.total_revenue_gross'),
        discountsAppliedLabel: t('performance-report-pdf:financial_summary.discounts_applied'),
        netRevenueLabel: t('performance-report-pdf:financial_summary.net_revenue'),
        totalExpensesLabel: t('performance-report-pdf:financial_summary.total_expenses'),
        netProfitLabel: t('performance-report-pdf:financial_summary.net_profit'),
        benefitLabel: t('performance-report-pdf:financial_summary.benefit'),
        lossLabel: t('performance-report-pdf:financial_summary.loss'),
        taxesAndFeesLabel: t('performance-report-pdf:financial_summary.taxes_and_fees'),
        paidWithLoyaltyLabel: t('performance-report-pdf:financial_summary.paid_with_loyalty'),
        pageLabel: t('performance-report-pdf:page_label'),
        ofLabel: t('performance-report-pdf:of_label'),
        nightsLabel: t('performance-report-pdf:nights'),
    };
    
    setIsGenerating(true);
    try {
        const pdf = await generatePerformanceReportPdf(reportData, propertySettings, i18n.language as 'en' | 'fr', translatedLabels);
        pdf.save(`performance-report-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    } catch(error) {
        toast({title: "Error", description: "Failed to generate PDF.", variant: "destructive"});
        console.error(error);
    } finally {
        setIsGenerating(false);
    }
  };

  const handleExportXLSX = () => {
    if (!reportData) return;

    const wb = XLSX.utils.book_new();

    const headerStyle = {
      font: { bold: true },
      border: {
        bottom: { style: "thick", color: { rgb: "FF000000" } },
      },
      alignment: { horizontal: "center" },
    };
    
    const defaultCellStyle = {
      alignment: { horizontal: "left" }
    };

    const addSheetWithStyles = (data: any[][], sheetName: string) => {
        const ws = XLSX.utils.aoa_to_sheet(data);
        
        const colWidths = data[0].map((_, colIndex) => {
            let maxWidth = 0;
            for (let rowIndex = 0; rowIndex < data.length; rowIndex++) {
                const cellValue = data[rowIndex][colIndex];
                const cellWidth = cellValue != null ? String(cellValue).length : 10;
                if (cellWidth > maxWidth) {
                    maxWidth = cellWidth;
                }
            }
            return { wch: maxWidth + 2 };
        });
        ws['!cols'] = colWidths;
        
        const range = XLSX.utils.decode_range(ws['!ref']!);
        for (let R = range.s.r; R <= range.e.r; ++R) {
          for (let C = range.s.c; C <= range.e.c; ++C) {
            const cell_address = { c: C, r: R };
            const cell_ref = XLSX.utils.encode_cell(cell_address);
            if (!ws[cell_ref]) continue;

            let cellStyle = {...defaultCellStyle};

            if (R === 0) {
              cellStyle = {...cellStyle, ...headerStyle};
            }

            if (sheetName === t('performance-report-pdf:financial_summary.title')) {
                const netProfitRowIndex = data.findIndex(row => row[0] === `${t('performance-report-pdf:financial_summary.net_profit')} (${reportData.metrics.netProfit >= 0 ? t('performance-report-pdf:financial_summary.benefit') : t('performance-report-pdf:financial_summary.loss')})`);
                if (R === netProfitRowIndex) {
                    cellStyle = {
                        ...cellStyle,
                        font: { bold: true },
                        fill: { fgColor: { rgb: "FFC6EFCE" } },
                        border: { top: { style: "thin" }, bottom: { style: "thin" } }
                    };
                }
            }
            
            ws[cell_ref].s = cellStyle;
          }
        }
        
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
    };

    // Overview Data
    const overviewHeaders = [t('performance-report-pdf:table_headers.metric'), t('performance-report-pdf:table_headers.value')];
    const overviewData = [
      overviewHeaders,
      [t('performance-report-pdf:property_overview.total_bookings'), reportData.metrics.totalBookings],
      [t('performance-report-pdf:property_overview.occupancy_rate'), `${reportData.metrics.occupancyRate.toFixed(1)}%`],
      [t('performance-report-pdf:property_overview.avg_stay'), `${reportData.metrics.avgStayLength.toFixed(1)} ${t('performance-report-pdf:nights', { count: reportData.metrics.avgStayLength })}`],
      [t('performance-report-pdf:property_overview.adr'), `${currencySymbol}${reportData.metrics.averageDailyRate.toFixed(2)}`],
      [t('performance-report-pdf:property_overview.revpar'), `${currencySymbol}${reportData.metrics.revPAR.toFixed(2)}`],
    ];
    addSheetWithStyles(overviewData, t('performance-report-pdf:property_overview.title'));
    
    // Financial Summary Data
    const financialHeaders = [t('performance-report-pdf:financial_summary.item'), t('performance-report-pdf:financial_summary.amount')];
    const financialData = [
      financialHeaders,
      [t('performance-report-pdf:financial_summary.rooms_revenue'), reportData.metrics.roomsRevenue],
      [t('performance-report-pdf:financial_summary.extras_revenue'), reportData.metrics.extrasRevenue],
      [t('performance-report-pdf:financial_summary.total_revenue_gross'), reportData.metrics.totalRevenueGross],
      [t('performance-report-pdf:financial_summary.discounts_applied'), -reportData.metrics.totalDiscounts],
      [t('performance-report-pdf:financial_summary.paid_with_loyalty'), -reportData.metrics.paidWithPointsValue],
      [t('performance-report-pdf:financial_summary.net_revenue'), reportData.metrics.netRevenue],
      [t('performance-report-pdf:financial_summary.total_expenses'), -reportData.metrics.totalExpenses],
      [`${t('performance-report-pdf:financial_summary.net_profit')} (${reportData.metrics.netProfit >= 0 ? t('performance-report-pdf:financial_summary.benefit') : t('performance-report-pdf:financial_summary.loss')})`, reportData.metrics.netProfit],
      [t('performance-report-pdf:financial_summary.taxes_and_fees'), reportData.metrics.totalTaxes],
    ];
    addSheetWithStyles(financialData, t('performance-report-pdf:financial_summary.title'));
    
    // Room Breakdown Data
    const roomBreakdownHeaders = [t('performance-report-pdf:table_headers.room_type'), t('performance-report-pdf:table_headers.occupancy'), t('performance-report-pdf:table_headers.adr'), t('performance-report-pdf:table_headers.total_revenue')];
    const roomBreakdownData = [
      roomBreakdownHeaders,
      ...reportData.breakdownByRoomAndType.flatMap(group => ([
        [group.roomTypeName, `${group.occupancy.toFixed(1)}%`, group.adr, group.revenue],
        ...group.rooms.map(room => [`    ${room.name}`, `${room.occupancy.toFixed(1)}%`, room.adr, room.revenue])
      ]))
    ];
    addSheetWithStyles(roomBreakdownData, t('performance-report-pdf:room_breakdown_title'));

    // Extras Breakdown Data
    const extrasBreakdownHeaders = [t('performance-report-pdf:table_headers.extra_name'), t('performance-report-pdf:table_headers.quantity_sold'), t('performance-report-pdf:table_headers.total_revenue')];
    const extrasBreakdownData = [
      extrasBreakdownHeaders,
      ...reportData.extrasBreakdown.map(item => ([item.name, item.quantity, item.total]))
    ];
    addSheetWithStyles(extrasBreakdownData, t('performance-report-pdf:extras_breakdown_title'));
    
    // Expenses Data
    const expensesHeaders = [t('performance-report-pdf:table_headers.date'), t('performance-report-pdf:table_headers.expense_name'), t('performance-report-pdf:table_headers.category'), t('performance-report-pdf:table_headers.amount')];
    const expensesData = [
      expensesHeaders,
      ...reportData.expenses.map(exp => ([format(parseISO(exp.date), 'PP'), exp.expenseName, exp.category, exp.amount]))
    ];
    addSheetWithStyles(expensesData, t('performance-report-pdf:expenses_title'));
    
    XLSX.writeFile(wb, `Performance-Report-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  const handleExportCSV = () => {
    if (!reportData) return;

    let csvContent = "\uFEFF";
    const nl = "\r\n";

    const jsonToCsv = (data: any[], headers: string[]) => {
      let csv = headers.join(",") + nl;
      data.forEach(row => {
        csv += headers.map(header => JSON.stringify(row[header] || '', (_, value) => value === null ? '' : value)).join(",") + nl;
      });
      return csv;
    };

    const overviewHeaders = [t('performance-report-pdf:table_headers.metric'), t('performance-report-pdf:table_headers.value')];
    const overviewData = [
      { [overviewHeaders[0]]: t('performance-report-pdf:property_overview.total_bookings'), [overviewHeaders[1]]: reportData.metrics.totalBookings },
      { [overviewHeaders[0]]: t('performance-report-pdf:property_overview.occupancy_rate'), [overviewHeaders[1]]: `${reportData.metrics.occupancyRate.toFixed(1)}%` },
      { [overviewHeaders[0]]: t('performance-report-pdf:property_overview.avg_stay'), [overviewHeaders[1]]: `${reportData.metrics.avgStayLength.toFixed(1)} ${t('performance-report-pdf:nights', { count: reportData.metrics.avgStayLength })}` },
      { [overviewHeaders[0]]: t('performance-report-pdf:property_overview.adr'), [overviewHeaders[1]]: `${currencySymbol}${reportData.metrics.averageDailyRate.toFixed(2)}` },
      { [overviewHeaders[0]]: t('performance-report-pdf:property_overview.revpar'), [overviewHeaders[1]]: `${currencySymbol}${reportData.metrics.revPAR.toFixed(2)}` },
    ];
    csvContent += t('performance-report-pdf:property_overview.title').toUpperCase() + nl;
    csvContent += jsonToCsv(overviewData, overviewHeaders) + nl;

    const financialHeaders = [t('performance-report-pdf:financial_summary.item'), t('performance-report-pdf:financial_summary.amount')];
    const financialData = [
      { [financialHeaders[0]]: t('performance-report-pdf:financial_summary.rooms_revenue'), [financialHeaders[1]]: reportData.metrics.roomsRevenue },
      { [financialHeaders[0]]: t('performance-report-pdf:financial_summary.extras_revenue'), [financialHeaders[1]]: reportData.metrics.extrasRevenue },
      { [financialHeaders[0]]: t('performance-report-pdf:financial_summary.total_revenue_gross'), [financialHeaders[1]]: reportData.metrics.totalRevenueGross },
      { [financialHeaders[0]]: t('performance-report-pdf:financial_summary.discounts_applied'), [financialHeaders[1]]: -reportData.metrics.totalDiscounts },
      { [financialHeaders[0]]: t('performance-report-pdf:financial_summary.paid_with_loyalty'), [financialHeaders[1]]: -reportData.metrics.paidWithPointsValue },
      { [financialHeaders[0]]: t('performance-report-pdf:financial_summary.net_revenue'), [financialHeaders[1]]: reportData.metrics.netRevenue },
      { [financialHeaders[0]]: t('performance-report-pdf:financial_summary.total_expenses'), [financialHeaders[1]]: -reportData.metrics.totalExpenses },
      { [financialHeaders[0]]: t('performance-report-pdf:financial_summary.net_profit'), [financialHeaders[1]]: reportData.metrics.netProfit },
      { [financialHeaders[0]]: t('performance-report-pdf:financial_summary.taxes_and_fees'), [financialHeaders[1]]: reportData.metrics.totalTaxes },
    ];
    csvContent += t('performance-report-pdf:financial_summary.title').toUpperCase() + nl;
    csvContent += jsonToCsv(financialData, financialHeaders) + nl;

    const roomBreakdownHeaders = [t('performance-report-pdf:table_headers.room_type'), t('performance-report-pdf:table_headers.occupancy'), t('performance-report-pdf:table_headers.adr'), t('performance-report-pdf:table_headers.total_revenue')];
    const roomBreakdownData = reportData.breakdownByRoomAndType.flatMap(group => ([
        { [roomBreakdownHeaders[0]]: group.roomTypeName, [roomBreakdownHeaders[1]]: `${group.occupancy.toFixed(1)}%`, [roomBreakdownHeaders[2]]: group.adr, [roomBreakdownHeaders[3]]: group.revenue },
        ...group.rooms.map(room => ({ [roomBreakdownHeaders[0]]: `    ${room.name}`, [roomBreakdownHeaders[1]]: `${room.occupancy.toFixed(1)}%`, [roomBreakdownHeaders[2]]: room.adr, [roomBreakdownHeaders[3]]: room.revenue }))
    ]));
    csvContent += t('performance-report-pdf:room_breakdown_title').toUpperCase() + nl;
    csvContent += jsonToCsv(roomBreakdownData, roomBreakdownHeaders) + nl;

    const extrasBreakdownHeaders = [t('performance-report-pdf:table_headers.extra_name'), t('performance-report-pdf:table_headers.quantity_sold'), t('performance-report-pdf:table_headers.total_revenue')];
    const extrasBreakdownData = reportData.extrasBreakdown.map(item => ({ [extrasBreakdownHeaders[0]]: item.name, [extrasBreakdownHeaders[1]]: item.quantity, [extrasBreakdownHeaders[2]]: item.total }));
    csvContent += t('performance-report-pdf:extras_breakdown_title').toUpperCase() + nl;
    csvContent += jsonToCsv(extrasBreakdownData, extrasBreakdownHeaders) + nl;
    
    const expensesHeaders = [t('performance-report-pdf:table_headers.date'), t('performance-report-pdf:table_headers.expense_name'), t('performance-report-pdf:table_headers.category'), t('performance-report-pdf:table_headers.amount')];
    const expensesData = reportData.expenses.map(exp => ({ [expensesHeaders[0]]: format(parseISO(exp.date), 'PP'), [expensesHeaders[1]]: exp.expenseName, [expensesHeaders[2]]: exp.category, [expensesHeaders[3]]: exp.amount }));
    csvContent += t('performance-report-pdf:expenses_title').toUpperCase() + nl;
    csvContent += jsonToCsv(expensesData, expensesHeaders) + nl;
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `Performance-Report-${format(new Date(), 'yyyy-MM-dd')}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  if (isLoadingAuth || (isLoading && !propertyId)) {
    return <div className="flex h-full items-center justify-center"><Icons.Spinner className="h-8 w-8 animate-spin text-primary" /> <p className="ml-2 text-muted-foreground">{t('loading')}</p></div>;
  }
  
  if (!user?.permissions?.reports) {
    return (
      <Alert variant="destructive">
        <Icons.AlertCircle className="h-4 w-4" />
        <AlertTitle>{t('access_denied.title')}</AlertTitle>
        <AlertDescription>
          {t('access_denied.description')}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>{t('card_generate.title')}</CardTitle>
          <CardDescription>{t('card_generate.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <RevenueFilters 
            onApplyFilters={handleFilterChange} 
            roomTypes={uniqueRoomTypes}
            bookingSources={uniqueBookingSources}
          />
        </CardContent>
        <CardFooter>
          <Button onClick={handleGenerateReport} disabled={isGenerating}>
            {isGenerating ? <><Icons.Spinner className="mr-2 h-4 w-4 animate-spin" />{t('buttons.generating')}</> : <><Icons.BarChart className="mr-2 h-4 w-4" />{t('buttons.generate')}</>}
          </Button>
        </CardFooter>
      </Card>

      {reportData && (
        <Card className="shadow-sm animate-in fade-in-50">
          <CardHeader className="flex flex-row justify-between items-start">
            <div>
              <CardTitle>{t('card_results.title')}</CardTitle>
              <CardDescription>
                {t('card_results.description', { from: format(reportData.dateRange.from, "PP"), to: format(reportData.dateRange.to, "PP") })}<br/>
                <span className="text-xs">{t('card_results.filters_info', { roomType: reportData.filters.roomType === 'all' ? 'All' : roomTypes.find(rt => rt.name === reportData.filters.roomType)?.name, bookingSource: reportData.filters.bookingSource })}</span>
              </CardDescription>
            </div>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline">
                        <Icons.Download className="mr-2 h-4 w-4" />{t('card_results.export')}
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                    <DropdownMenuItem onClick={handleDownloadPdf}>
                       <Icons.FileText className="mr-2 h-4 w-4"/> {t('card_results.download_pdf')}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleExportXLSX}>
                        <Icons.FileText className="mr-2 h-4 w-4" /> {t('card_results.export_xlsx')}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleExportCSV}>
                        <Icons.FileText className="mr-2 h-4 w-4" /> {t('card_results.export_csv')}
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
          </CardHeader>
          <CardContent className="space-y-8">
            <PropertyOverviewTable data={reportData.metrics} currency={currencySymbol} />
            <Separator />
            <div className="grid grid-cols-1 gap-8">
                <RoomTypeBreakdownTable data={reportData.breakdownByRoomAndType} currency={currencySymbol} />
                <ExtrasBreakdownTable data={reportData.extrasBreakdown} currency={currencySymbol} />
            </div>
            <Separator />
            <ExpenseList expenses={reportData.expenses} isLoading={isLoading} onEdit={() => {}} />
            <Separator />
            <FinancialSummaryTable data={reportData.metrics} currency={currencySymbol} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
