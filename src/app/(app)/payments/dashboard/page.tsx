"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc, getDoc, orderBy, limit } from 'firebase/firestore';
import { Icons } from "@/components/icons";
import { useTranslation } from 'react-i18next';
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, DollarSign, FileText, RotateCcw, Mail, Calendar, MoreHorizontal, ArrowRight, TrendingUp, AlertTriangle } from 'lucide-react';
import { 
  LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell
} from 'recharts';
import { format, subDays, parseISO, isWithinInterval, differenceInDays, addDays, startOfYear, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { enUS, fr } from 'date-fns/locale';
import type { DateRange } from 'react-day-picker';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import dynamic from 'next/dynamic';
import type { Payment } from '@/types/payment';
import type { Property } from '@/types/property';

import { AlertBanner } from "@/components/payments/alert-banner";
import { HeroMetric } from "@/components/payments/hero-metric";
import { StatusCard } from "@/components/payments/status-card";
import { ActionButton } from "@/components/payments/action-button";
import { ActivityFeed } from "@/components/payments/activity-feed";
import { PaymentMethodsBreakdown } from "@/components/payments/payment-methods-breakdown";
import { OutstandingRisk } from "@/components/payments/outstanding-risk";
import { Button } from "@/components/ui/button";

const PaymentForm = dynamic(() => import('@/components/payments/payment-form').then(mod => mod.PaymentForm), {
  loading: () => <div className="flex h-48 items-center justify-center"><Icons.Spinner className="h-6 w-6 animate-spin" /></div>,
  ssr: false,
});

const RefundForm = dynamic(() => import('@/components/payments/refund-form').then(mod => mod.RefundForm), {
  loading: () => <div className="flex h-48 items-center justify-center"><Icons.Spinner className="h-6 w-6 animate-spin" /></div>,
  ssr: false,
});

interface PaymentWithId extends Payment {
  id: string;
}

interface ActivityItem {
  id: string;
  type: 'payment' | 'refund' | 'invoice';
  title: string;
  ref: string;
  amount: number;
  time: string;
  icon: React.ReactNode;
}

interface PaymentMethod {
  method: string;
  amount: number;
  count: number;
}

const COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444'];

export default function PaymentsDashboardPage() {
  const { user, property } = useAuth();
  const { t } = useTranslation();
  const [propertyId, setPropertyId] = useState<string | null>(null);
  const [propertySettings, setPropertySettings] = useState<Property | null>(null);
  const [allPayments, setAllPayments] = useState<PaymentWithId[]>([]);
  const [allReservations, setAllReservations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPayment, setSelectedPayment] = useState<PaymentWithId | null>(null);
  const [isProcessingRefund, setIsProcessingRefund] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [showRefundForm, setShowRefundForm] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfDay(subDays(new Date(), 29)),
    to: endOfDay(new Date()),
  });
  const [dismissedAlerts, setDismissedAlerts] = useState<string[]>([]);

  const currencySymbol = property?.currency || '$';
  const { i18n } = useTranslation();
  const locale = i18n.language === 'fr' ? fr : enUS;

  const setPresetRange = (preset: 'today' | 'this_week' | 'this_month' | 'last_7_days' | 'last_30_days') => {
    const today = new Date();
    switch (preset) {
      case 'today':
        setDateRange({ from: startOfDay(today), to: endOfDay(today) });
        break;
      case 'this_week':
        setDateRange({ from: startOfWeek(today, { weekStartsOn: 1 }), to: endOfWeek(today, { weekStartsOn: 1 }) });
        break;
      case 'this_month':
        setDateRange({ from: startOfMonth(today), to: endOfMonth(today) });
        break;
      case 'last_7_days':
        setDateRange({ from: startOfDay(subDays(today, 6)), to: endOfDay(today) });
        break;
      case 'last_30_days':
        setDateRange({ from: startOfDay(subDays(today, 29)), to: endOfDay(today) });
        break;
    }
  };

  // Fetch property ID
  useEffect(() => {
    if (user?.propertyId) {
      setPropertyId(user.propertyId);
    }
  }, [user]);

  // Fetch payments and property data
  useEffect(() => {
    if (!propertyId) {
      setAllPayments([]);
      setAllReservations([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    const propDocRef = doc(db, "properties", propertyId);
    const unsubProp = onSnapshot(propDocRef, (docSnap) => {
      if (docSnap.exists()) {
        setPropertySettings(docSnap.data() as Property);
      }
    });

    const paymentsColRef = collection(db, `properties/${propertyId}/payments`);
    const pq = query(
      paymentsColRef,
      where("propertyId", "==", propertyId),
      orderBy("date", "desc"),
      limit(500)
    );

    const unsubPayments = onSnapshot(pq, (snapshot) => {
      const fetchedPayments = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data(),
      } as PaymentWithId));
      setAllPayments(fetchedPayments);
    }, (error) => {
      console.error("Error fetching payments:", error);
    });

    // Fetch reservations
    const reservationsColRef = collection(db, "reservations");
    const rq = query(
      reservationsColRef,
      where("propertyId", "==", propertyId),
      orderBy("startDate", "desc"),
      limit(1000)
    );

    const unsubReservations = onSnapshot(rq, (snapshot) => {
      const fetchedReservations = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));
      setAllReservations(fetchedReservations);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching reservations:", error);
      setIsLoading(false);
    });

    return () => {
      unsubPayments();
      unsubReservations();
      unsubProp();
    };
  }, [propertyId]);

  // Calculate metrics from reservations and payments
  const metrics = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) {
      return {
        totalRevenue: 0,
        totalCollected: 0,
        pendingAmount: 0,
        overdueAmount: 0,
        refundsIssued: 0,
        netRevenue: 0,
        trend: 0,
        collectionRate: 0,
      };
    }

    const rangeStart = startOfDay(dateRange.from);
    const rangeEnd = endOfDay(dateRange.to);
    
    // Paid: payments with status 'Paid'
    const paidPayments = allPayments.filter(p => {
      const paymentDate = parseISO(p.date);
      return isWithinInterval(paymentDate, { start: rangeStart, end: rangeEnd }) && p.status === 'Paid' && !p.isRefund;
    });
    const paidReservations = allReservations.filter(r => {
      const endDate = r.endDate instanceof Date ? r.endDate : r.endDate?.toDate?.() || new Date(r.endDate);
      return isWithinInterval(endDate, { start: rangeStart, end: rangeEnd }) && r.paymentStatus === 'Paid';
    });
    
    const totalFromPayments = paidPayments.reduce((sum, p) => sum + (p.amountPaid || 0), 0);
    const totalFromReservations = paidReservations.reduce((sum, r) => sum + (r.totalPrice || 0), 0);
    const totalCollected = totalFromPayments + totalFromReservations;

    // Outstanding: Pending payments or unpaid reservations
    const pendingPayments = allPayments.filter(p => {
      const paymentDate = parseISO(p.date);
      return isWithinInterval(paymentDate, { start: rangeStart, end: rangeEnd }) && p.status === 'Pending';
    });
    const unpaidReservations = allReservations.filter(r => {
      const startDateRes = r.startDate instanceof Date ? r.startDate : r.startDate?.toDate?.() || new Date(r.startDate);
      return isWithinInterval(startDateRes, { start: rangeStart, end: rangeEnd }) && (r.paymentStatus === 'Pending' || r.paymentStatus === 'Partial');
    });
    
    // For partially paid reservations, calculate remaining unpaid balance
    const pendingAmount = pendingPayments.reduce((sum, p) => sum + (p.amountPaid || 0), 0) +
                         unpaidReservations.reduce((sum, r) => {
                           if (r.paymentStatus === 'Partial') {
                             // Unpaid balance = total price - partial payment amount
                             const unpaidBalance = (r.totalPrice || 0) - (r.partialPaymentAmount || 0);
                             return sum + Math.max(0, unpaidBalance);
                           }
                           // For Pending, count full amount
                           return sum + (r.totalPrice || 0);
                         }, 0);

    // Overdue: unpaid items with end date before today
    const today = new Date();
    
    const overduePayments = pendingPayments.filter(p => {
      const paymentDate = parseISO(p.date);
      return paymentDate < startOfDay(today);
    });
    
    const overdueReservations = unpaidReservations.filter(r => {
      const endDate = r.endDate instanceof Date ? r.endDate : r.endDate?.toDate?.() || new Date(r.endDate);
      return endDate < startOfDay(today);
    });

    // For overdue, calculate unpaid balance including partial payments
    const overdueAmount = overduePayments.reduce((sum, p) => sum + (p.amountPaid || 0), 0) +
                         overdueReservations.reduce((sum, r) => {
                           if (r.paymentStatus === 'Partial') {
                             // Unpaid balance = total price - partial payment amount
                             const unpaidBalance = (r.totalPrice || 0) - (r.partialPaymentAmount || 0);
                             return sum + Math.max(0, unpaidBalance);
                           }
                           // For Pending, count full amount
                           return sum + (r.totalPrice || 0);
                         }, 0);

    // Refunded
    const refunds = allPayments.filter(p => p.isRefund);
    const refundsFromPayments = refunds.reduce((sum, p) => sum + (p.amountPaid || 0), 0);
    
    // Refunded reservations
    const refundedReservations = allReservations.filter(r => {
      const endDate = r.endDate instanceof Date ? r.endDate : r.endDate?.toDate?.() || new Date(r.endDate);
      return isWithinInterval(endDate, { start: rangeStart, end: rangeEnd }) && r.paymentStatus === 'Refunded';
    });
    const refundsFromReservations = refundedReservations.reduce((sum, r) => sum + (r.totalPrice || 0), 0);
    
    const refundsIssued = refundsFromPayments + refundsFromReservations;
    const netRevenue = totalCollected - refundsIssued;
    const trend = totalCollected > 0 ? 12 : 0;

    return {
      totalRevenue: totalCollected,
      totalCollected,
      pendingAmount,
      overdueAmount,
      refundsIssued,
      netRevenue,
      trend,
      collectionRate: pendingAmount + totalCollected > 0 ? Math.round((totalCollected / (pendingAmount + totalCollected)) * 100) : 0,
    };
  }, [allPayments, allReservations, dateRange]);

  // Status breakdown data
  const statusBreakdownData = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return [
      { label: 'Paid', value: 0, color: '#10b981' },
      { label: 'Pending', value: 0, color: '#f59e0b' },
      { label: 'Refunded', value: 0, color: '#6366f1' },
      { label: 'Failed', value: 0, color: '#ef4444' },
    ];

    const rangeStart = startOfDay(dateRange.from);
    const rangeEnd = endOfDay(dateRange.to);

    const paidPayments = allPayments.filter(p => {
      const paymentDate = parseISO(p.date);
      return isWithinInterval(paymentDate, { start: rangeStart, end: rangeEnd }) && p.status === 'Paid' && !p.isRefund;
    }).length;
    const paidReservations = allReservations.filter(r => {
      const endDate = r.endDate instanceof Date ? r.endDate : r.endDate?.toDate?.() || new Date(r.endDate);
      return isWithinInterval(endDate, { start: rangeStart, end: rangeEnd }) && r.paymentStatus === 'Paid';
    }).length;
    
    const pendingPayments = allPayments.filter(p => {
      const paymentDate = parseISO(p.date);
      return isWithinInterval(paymentDate, { start: rangeStart, end: rangeEnd }) && p.status === 'Pending';
    }).length;
    const pendingReservations = allReservations.filter(r => {
      const startDateRes = r.startDate instanceof Date ? r.startDate : r.startDate?.toDate?.() || new Date(r.startDate);
      return isWithinInterval(startDateRes, { start: rangeStart, end: rangeEnd }) && (r.paymentStatus === 'Pending' || r.paymentStatus === 'Partial');
    }).length;
    
    const refundedPayments = allPayments.filter(p => {
      const paymentDate = parseISO(p.date);
      return isWithinInterval(paymentDate, { start: rangeStart, end: rangeEnd }) && p.isRefund;
    }).length;
    const refundedReservations = allReservations.filter(r => {
      const endDate = r.endDate instanceof Date ? r.endDate : r.endDate?.toDate?.() || new Date(r.endDate);
      return isWithinInterval(endDate, { start: rangeStart, end: rangeEnd }) && r.paymentStatus === 'Refunded';
    }).length;
    
    const failedPayments = allPayments.filter(p => {
      const paymentDate = parseISO(p.date);
      return isWithinInterval(paymentDate, { start: rangeStart, end: rangeEnd }) && (p.status === 'Failed' || p.status === 'Refunded');
    }).length;

    return [
      { label: 'Paid', value: paidPayments + paidReservations, color: '#10b981' },
      { label: 'Pending', value: pendingPayments + pendingReservations, color: '#f59e0b' },
      { label: 'Refunded', value: refundedPayments + refundedReservations, color: '#6366f1' },
      { label: 'Failed', value: failedPayments, color: '#ef4444' },
    ];
  }, [allPayments, allReservations, dateRange]);

  // Revenue trend data
  const trendData = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return [];
    
    const rangeStart = startOfDay(dateRange.from);
    const rangeEnd = endOfDay(dateRange.to);
    const data = [];
    
    // Calculate number of days to iterate
    const daysCount = Math.ceil((rangeEnd.getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    
    for (let i = 0; i < daysCount; i++) {
      const date = addDays(rangeStart, i);
      const dateStr = format(date, 'EEE');
      const dateFormatted = format(date, 'yyyy-MM-dd');
      
      // Paid revenue from payments
      const paidFromPayments = allPayments
        .filter(p => {
          const paymentDate = parseISO(p.date);
          return format(paymentDate, 'yyyy-MM-dd') === dateFormatted && p.status === 'Paid' && !p.isRefund;
        })
        .reduce((sum, p) => sum + (p.amountPaid || 0), 0);

      // Paid revenue from reservations
      const paidFromReservations = allReservations
        .filter(r => {
          const endDate = r.endDate instanceof Date ? r.endDate : r.endDate?.toDate?.() || new Date(r.endDate);
          return format(endDate, 'yyyy-MM-dd') === dateFormatted && r.paymentStatus === 'Paid';
        })
        .reduce((sum, r) => sum + (r.totalPrice || 0), 0);

      const paidAmount = paidFromPayments + paidFromReservations;

      // Unpaid revenue from payments
      const unpaidFromPayments = allPayments
        .filter(p => {
          const paymentDate = parseISO(p.date);
          return format(paymentDate, 'yyyy-MM-dd') === dateFormatted && p.status === 'Pending' && !p.isRefund;
        })
        .reduce((sum, p) => sum + (p.amountPaid || 0), 0);

      // Unpaid revenue from reservations
      const unpaidFromReservations = allReservations
        .filter(r => {
          const startDate = r.startDate instanceof Date ? r.startDate : r.startDate?.toDate?.() || new Date(r.startDate);
          return format(startDate, 'yyyy-MM-dd') === dateFormatted && (r.paymentStatus === 'Pending' || r.paymentStatus === 'Partial');
        })
        .reduce((sum, r) => {
          if (r.paymentStatus === 'Partial') {
            // Count only the unpaid balance for partial payments
            const unpaidBalance = (r.totalPrice || 0) - (r.partialPaymentAmount || 0);
            return sum + Math.max(0, unpaidBalance);
          }
          // For Pending, count full amount
          return sum + (r.totalPrice || 0);
        }, 0);

      const unpaidAmount = unpaidFromPayments + unpaidFromReservations;

      // Refunded revenue from payments
      const refundedFromPayments = allPayments
        .filter(p => {
          const paymentDate = parseISO(p.date);
          return format(paymentDate, 'yyyy-MM-dd') === dateFormatted && p.isRefund;
        })
        .reduce((sum, p) => sum + (p.amountPaid || 0), 0);

      // Refunded revenue from reservations
      const refundedFromReservations = allReservations
        .filter(r => {
          const endDate = r.endDate instanceof Date ? r.endDate : r.endDate?.toDate?.() || new Date(r.endDate);
          return format(endDate, 'yyyy-MM-dd') === dateFormatted && r.paymentStatus === 'Refunded';
        })
        .reduce((sum, r) => sum + (r.totalPrice || 0), 0);

      const refundedAmount = refundedFromPayments + refundedFromReservations;

      // Previous period amount
      const prevDate = subDays(date, 30);
      const prevDateFormatted = format(prevDate, 'yyyy-MM-dd');
      
      const prevFromPayments = allPayments
        .filter(p => {
          const paymentDate = parseISO(p.date);
          return format(paymentDate, 'yyyy-MM-dd') === prevDateFormatted && p.status === 'Paid' && !p.isRefund;
        })
        .reduce((sum, p) => sum + (p.amountPaid || 0), 0);

      const prevFromReservations = allReservations
        .filter(r => {
          const endDate = r.endDate instanceof Date ? r.endDate : r.endDate?.toDate?.() || new Date(r.endDate);
          return format(endDate, 'yyyy-MM-dd') === prevDateFormatted && r.paymentStatus === 'Paid';
        })
        .reduce((sum, r) => sum + (r.totalPrice || 0), 0);

      const prevAmount = prevFromPayments + prevFromReservations;

      data.push({
        date: dateStr,
        paid: paidAmount,
        unpaid: unpaidAmount,
        prev: prevAmount,
      });
    }
    return data;
  }, [allPayments, allReservations, dateRange]);

  // Payment methods data
  const paymentMethods = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return [];

    const rangeStart = startOfDay(dateRange.from);
    const rangeEnd = endOfDay(dateRange.to);
    const methods = new Map<string, { amount: number; count: number }>();
    
    // Count payments by method from the payments collection
    const paidPayments = allPayments.filter(p => {
      const paymentDate = parseISO(p.date);
      return isWithinInterval(paymentDate, { start: rangeStart, end: rangeEnd }) && p.status === 'Paid' && !p.isRefund;
    });

    paidPayments.forEach(p => {
      const method = p.paymentMethod || 'Other';
      const current = methods.get(method) || { amount: 0, count: 0 };
      methods.set(method, {
        amount: current.amount + (p.amountPaid || 0),
        count: current.count + 1,
      });
    });

    // Add reservation payments that weren't tracked in payments collection
    const paidReservations = allReservations
      .filter(r => {
        const endDate = r.endDate instanceof Date ? r.endDate : r.endDate?.toDate?.() || new Date(r.endDate);
        return isWithinInterval(endDate, { start: rangeStart, end: rangeEnd }) && r.paymentStatus === 'Paid';
      });
    
    // Check if these reservations have corresponding payments already counted
    const reservationIdsWithPayments = new Set(
      paidPayments
        .filter(p => p.reservationId)
        .map(p => p.reservationId)
    );

    paidReservations.forEach(r => {
      // Only count if not already in payments collection
      if (!reservationIdsWithPayments.has(r.id)) {
        const method = 'Direct Booking'; // Default method for direct bookings without payment records
        const current = methods.get(method) || { amount: 0, count: 0 };
        methods.set(method, {
          amount: current.amount + (r.totalPrice || 0),
          count: current.count + 1,
        });
      }
    });

    return Array.from(methods.entries()).map(([name, data]) => ({
      method: name,
      amount: data.amount,
      count: data.count,
    }));
  }, [allPayments, allReservations, dateRange]);

  // Outstanding/overdue data
  const overduePayments = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return { oldestUnpaidDays: 0, topUnpaid: [] };
    
    const rangeStart = startOfDay(dateRange.from);
    const rangeEnd = endOfDay(dateRange.to);
    const today = new Date();
    
    // Unpaid payments
    const pendingPayments = allPayments
      .filter(p => {
        const paymentDate = parseISO(p.date);
        return isWithinInterval(paymentDate, { start: rangeStart, end: rangeEnd }) && p.status === 'Pending' && !p.isRefund;
      })
      .map(p => ({
        id: p.id,
        type: 'payment' as const,
        guestName: p.guestName || 'Unknown',
        amount: p.amountPaid || 0,
        date: parseISO(p.date),
        daysOverdue: differenceInDays(today, parseISO(p.date)),
      }));

    // Unpaid reservations
    const unpaidReservations = allReservations
      .filter(r => {
        const startDateRes = r.startDate instanceof Date ? r.startDate : r.startDate?.toDate?.() || new Date(r.startDate);
        return isWithinInterval(startDateRes, { start: rangeStart, end: rangeEnd }) && (r.paymentStatus === 'Pending' || r.paymentStatus === 'Partial');
      })
      .map(r => {
        const endDate = r.endDate instanceof Date ? r.endDate : r.endDate?.toDate?.() || new Date(r.endDate);
        // Calculate unpaid amount for partial payments
        let unpaidAmount = r.totalPrice || 0;
        if (r.paymentStatus === 'Partial') {
          unpaidAmount = (r.totalPrice || 0) - (r.partialPaymentAmount || 0);
          unpaidAmount = Math.max(0, unpaidAmount);
        }
        return {
          id: r.id,
          type: 'reservation' as const,
          guestName: r.guestName || 'Unknown',
          amount: unpaidAmount,
          date: endDate,
          daysOverdue: differenceInDays(today, endDate),
        };
      });

    const allOverdue = [...pendingPayments, ...unpaidReservations]
      .sort((a, b) => b.daysOverdue - a.daysOverdue);

    const oldestUnpaidDays = allOverdue.length > 0 ? allOverdue[0].daysOverdue : 0;
    const topUnpaid = allOverdue.slice(0, 3).map(item => ({
      id: item.id,
      name: item.guestName,
      amount: item.amount,
      age: `${item.daysOverdue} days old`,
    }));

    return { oldestUnpaidDays, topUnpaid };
  }, [allPayments, allReservations, dateRange]);

  // Recent activity
  const recentActivity = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return [];
    
    const rangeStart = startOfDay(dateRange.from);
    const rangeEnd = endOfDay(dateRange.to);
    
    // Combine recent payments and reservations
    const paymentActivities = allPayments
      .filter(p => {
        const paymentDate = parseISO(p.date);
        return isWithinInterval(paymentDate, { start: rangeStart, end: rangeEnd }) && !p.isRefund;
      })
      .map(p => ({
        id: p.id,
        type: p.status === 'Paid' ? 'payment' : 'invoice' as const,
        title: p.status === 'Paid' ? `Payment from ${p.guestName}` : `Invoice to ${p.guestName}`,
        ref: p.paymentNumber || p.invoiceId || 'N/A',
        amount: p.amountPaid || 0,
        time: format(parseISO(p.date), 'MMM dd, HH:mm'),
        icon: <DollarSign className="w-4 h-4" />,
      } as ActivityItem));

    const reservationActivities = allReservations
      .filter(r => {
        const endDate = r.endDate instanceof Date ? r.endDate : r.endDate?.toDate?.() || new Date(r.endDate);
        return isWithinInterval(endDate, { start: rangeStart, end: rangeEnd }) && r.paymentStatus === 'Paid';
      })
      .map(r => ({
        id: r.id,
        type: 'payment' as const,
        title: `Booking paid by ${r.guestName}`,
        ref: r.reservationNumber || r.invoiceId || 'N/A',
        amount: r.totalPrice || 0,
        time: format(r.endDate instanceof Date ? r.endDate : r.endDate?.toDate?.() || new Date(r.endDate), 'MMM dd, HH:mm'),
        icon: <FileText className="w-4 h-4" />,
      } as ActivityItem));

    const refundActivities = allPayments
      .filter(p => {
        const paymentDate = parseISO(p.date);
        return isWithinInterval(paymentDate, { start: rangeStart, end: rangeEnd }) && p.isRefund;
      })
      .map(p => ({
        id: p.id,
        type: 'refund' as const,
        title: `Refund to ${p.guestName}`,
        ref: p.paymentNumber || 'N/A',
        amount: -(p.amountPaid || 0),
        time: format(parseISO(p.date), 'MMM dd, HH:mm'),
        icon: <RotateCcw className="w-4 h-4" />,
      } as ActivityItem));

    return [...paymentActivities, ...reservationActivities, ...refundActivities]
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
      .slice(0, 10);
  }, [allPayments, allReservations, dateRange]);

  if (isLoading && !propertyId) {
    return <div className="flex h-full items-center justify-center"><Icons.Spinner className="h-8 w-8 animate-spin" /></div>;
  }

  if (!user?.permissions?.finance) {
    return (
      <Alert variant="destructive">
        <Icons.AlertCircle className="h-4 w-4" />
        <AlertTitle>Access Denied</AlertTitle>
        <AlertDescription>
          You don't have permission to access the payments module.
        </AlertDescription>
      </Alert>
    );
  }

  // Check for overdue invoices
  const hasOverdueAlerts = overduePayments.oldestUnpaidDays > 7;

  return (
    <div className="space-y-4 pb-4">
      {/* Alert Banner */}
      {hasOverdueAlerts && !dismissedAlerts.includes('overdue') && (
        <AlertBanner
          type="warning"
          message={`You have ${overduePayments.topUnpaid.length} overdue invoices`}
          count={overduePayments.topUnpaid.length}
          onDismiss={() => setDismissedAlerts([...dismissedAlerts, 'overdue'])}
        />
      )}

      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-foreground font-headline">
              Payments Snapshot
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Financial overview and transaction history
            </p>
          </div>
          
          {/* Date Range Picker */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                id="date"
                variant={"outline"}
                className={cn(
                  "justify-start text-left font-normal",
                  !dateRange && "text-muted-foreground"
                )}
              >
                <Calendar className="mr-2 h-4 w-4" />
                {dateRange?.from ? (
                  dateRange.to ? (
                    <>
                      {format(dateRange.from, "MMM dd, y", { locale })} -{" "}
                      {format(dateRange.to, "MMM dd, y", { locale })}
                    </>
                  ) : (
                    format(dateRange.from, "MMM dd, y", { locale })
                  )
                ) : (
                  <span>Pick a date range</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 flex flex-col sm:flex-row" align="start">
              <div className="flex flex-col space-y-1 border-b sm:border-b-0 sm:border-r p-2">
                <Button variant="ghost" size="sm" className="justify-start" onClick={() => setPresetRange("today")}>Today</Button>
                <Button variant="ghost" size="sm" className="justify-start" onClick={() => setPresetRange("this_week")}>This Week</Button>
                <Button variant="ghost" size="sm" className="justify-start" onClick={() => setPresetRange("this_month")}>This Month</Button>
                <Button variant="ghost" size="sm" className="justify-start" onClick={() => setPresetRange("last_7_days")}>Last 7 Days</Button>
                <Button variant="ghost" size="sm" className="justify-start" onClick={() => setPresetRange("last_30_days")}>Last 30 Days</Button>
              </div>
              <CalendarComponent
                initialFocus
                mode="range"
                defaultMonth={dateRange?.from}
                selected={dateRange}
                onSelect={setDateRange}
                numberOfMonths={1}
                locale={locale}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Hero Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <HeroMetric
          title="Total Revenue"
          value={`${currencySymbol}${metrics.totalRevenue.toLocaleString('en-US', { maximumFractionDigits: 2 })}`}
          trend={metrics.trend}
          status="paid"
          isHighlighted={true}
        />
        <HeroMetric
          title="Amount Collected"
          value={`${currencySymbol}${metrics.totalCollected.toLocaleString('en-US', { maximumFractionDigits: 2 })}`}
          status="paid"
        />
        <HeroMetric
          title="Outstanding"
          value={`${currencySymbol}${metrics.pendingAmount.toLocaleString('en-US', { maximumFractionDigits: 2 })}`}
          status="pending"
        />
        <HeroMetric
          title="Overdue"
          value={`${currencySymbol}${metrics.overdueAmount.toLocaleString('en-US', { maximumFractionDigits: 2 })}`}
          status="overdue"
        />
        <HeroMetric
          title="Refunded"
          value={`${currencySymbol}${metrics.refundsIssued.toLocaleString('en-US', { maximumFractionDigits: 2 })}`}
          status="refund"
        />
      </div>

      {/* Revenue Trend and Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Trend Chart */}
        <div className="lg:col-span-2 bg-white rounded-lg border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Payments Trend</h3>
              <p className="text-xs text-slate-400">Paid vs Unpaid collections</p>
            </div>
            <div className="flex items-center gap-4 text-xs font-medium">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                Paid
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-slate-200" />
                Unpaid
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 border-t-2 border-dashed border-slate-300" />
                Prev. Period
              </div>
            </div>
          </div>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="colorPaid" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="date" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                />
                <Tooltip />
                <Area 
                  type="monotone" 
                  dataKey="paid" 
                  stroke="#3b82f6" 
                  strokeWidth={2} 
                  fillOpacity={1} 
                  fill="url(#colorPaid)"
                />
                <Area 
                  type="monotone" 
                  dataKey="unpaid" 
                  stroke="#cbd5e1" 
                  strokeWidth={2} 
                  fill="transparent"
                />
                <Line 
                  type="monotone" 
                  dataKey="prev" 
                  stroke="#cbd5e1" 
                  strokeWidth={1} 
                  strokeDasharray="5 5" 
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-primary text-white rounded-lg p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
            <div className="space-y-3 mb-4">
              <ActionButton icon={<FileText className="h-4 w-4" />} label="Create Invoice" />
              <ActionButton icon={<DollarSign className="h-4 w-4" />} label="Record Payment" />
              <ActionButton icon={<Mail className="h-4 w-4" />} label="Send Reminder" />
              <ActionButton icon={<RotateCcw className="h-4 w-4" />} label="Process Refund" />
              <ActionButton icon={<FileText className="h-4 w-4" />} label="Export Reports" />
            </div>
          </div>
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <StatusCard
          title="Payment Status"
          data={statusBreakdownData}
        />
        <StatusCard
          title="Invoice Status"
          data={[
            { label: 'Paid', value: 45, color: '#10b981' },
            { label: 'Pending', value: 28, color: '#f59e0b' },
            { label: 'Overdue', value: 12, color: '#ef4444' },
          ]}
        />
        <div className="lg:col-span-2">
          <OutstandingRisk
            oldestUnpaidDays={overduePayments.oldestUnpaidDays}
            topUnpaid={overduePayments.topUnpaid}
          />
        </div>
      </div>

      {/* Activity Feed and Payment Methods */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ActivityFeed items={recentActivity} />
        </div>
        {paymentMethods.length > 0 && (
          <PaymentMethodsBreakdown
            methods={paymentMethods}
            total={paymentMethods.reduce((sum, m) => sum + m.amount, 0)}
          />
        )}
      </div>
    </div>
  );
}
