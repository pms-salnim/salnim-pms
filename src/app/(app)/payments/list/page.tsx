"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { db, app } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc, addDoc, serverTimestamp, deleteDoc, updateDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { Icons } from "@/components/icons";
import { useTranslation } from 'react-i18next';
import { format, subDays, parseISO, isWithinInterval, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { enUS, fr } from 'date-fns/locale';
import type { DateRange } from 'react-day-picker';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Calendar, MoreHorizontal, ArrowUpDown, Plus, Download, FileText, DollarSign, TrendingUp, Search, X, AlertCircle, Clock, Activity, CheckCircle2, RotateCcw, Zap, MessageCircle, Globe, Trash2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type { Payment } from '@/types/payment';
import type { Property } from '@/types/property';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface PaymentWithId extends Payment {
  id: string;
}

export default function PaymentsListPage() {
  const { user, property } = useAuth();
  const { t } = useTranslation();
  const [propertyId, setPropertyId] = useState<string | null>(null);
  const [propertySettings, setPropertySettings] = useState<Property | null>(null);
  const [allPayments, setAllPayments] = useState<PaymentWithId[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfDay(subDays(new Date(), 29)),
    to: endOfDay(new Date()),
  });
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [methodFilter, setMethodFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'createdAt' | 'date' | 'amount' | 'guest' | 'status'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<PaymentWithId | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(15);
  const [paymentToDelete, setPaymentToDelete] = useState<PaymentWithId | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedPaymentIds, setSelectedPaymentIds] = useState<Set<string>>(new Set());
  const [isPerformingBulkAction, setIsPerformingBulkAction] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [showRefundDialog, setShowRefundDialog] = useState(false);
  const [paymentForRefund, setPaymentForRefund] = useState<PaymentWithId | null>(null);
  const [refundData, setRefundData] = useState({ reason: '', amount: '' });
  const [showRefunds, setShowRefunds] = useState(true);  // Toggle to show/hide refunds

  // Form state for manual payment entry
  const [formData, setFormData] = useState({
    guestName: '',
    reservationNumber: '',
    amountPaid: '',
    paymentMethod: 'Credit Card',
    paymentDate: new Date().toISOString().split('T')[0],
    status: 'Paid',
    notes: ''
  });

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
        setDateRange({ from: startOfWeek(today), to: endOfWeek(today) });
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

  const exportToCSV = () => {
    const csv = [
      ['Date', 'Guest', 'Payment #', 'Reservation', 'Method', 'Amount', 'Status'].join(',')
    ];
    filteredPayments.forEach(p => {
      csv.push([
        format(parseISO(p.date), 'MMM dd, yyyy HH:mm'),
        `"${p.guestName || 'Unknown'}"`,
        p.paymentNumber || p.id.slice(0, 8),
        p.reservationNumber || '-',
        p.paymentMethod || '-',
        p.amountPaid || 0,
        p.isRefund ? 'Refunded' : p.status || 'Pending'
      ].join(','));
    });
    downloadFile(csv.join('\n'), `payments-${format(new Date(), 'yyyy-MM-dd')}.csv`, 'text/csv');
  };

  const exportToExcel = () => {
    const headers = ['Date', 'Guest', 'Payment #', 'Reservation', 'Method', 'Amount', 'Status'];
    const rows = filteredPayments.map(p => [
      format(parseISO(p.date), 'MMM dd, yyyy HH:mm'),
      p.guestName || 'Unknown',
      p.paymentNumber || p.id.slice(0, 8),
      p.reservationNumber || '-',
      p.paymentMethod || '-',
      p.amountPaid || 0,
      p.isRefund ? 'Refunded' : p.status || 'Pending'
    ]);
    
    // Create Excel-compatible CSV
    const csv = [headers.join(','), ...rows.map(r => r.map(cell => `"${cell}"`).join(','))].join('\n');
    downloadFile(csv, `payments-${format(new Date(), 'yyyy-MM-dd')}.xlsx`, 'application/vnd.ms-excel');
  };

  const exportToPDF = () => {
    // Basic PDF export - would need html2pdf or similar library
    const content = `Payments Report\n${format(new Date(), 'MMM dd, yyyy')}\n\nTotal: ${filteredPayments.length} payments\n`;
    downloadFile(content, `payments-${format(new Date(), 'yyyy-MM-dd')}.pdf`, 'application/pdf');
  };

  const downloadFile = (content: string, filename: string, type: string) => {
    const element = document.createElement('a');
    element.setAttribute('href', `data:${type};charset=utf-8,${encodeURIComponent(content)}`);
    element.setAttribute('download', filename);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!propertyId || !formData.guestName || !formData.amountPaid) {
      alert('Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);
    try {
      const paymentsRef = collection(db, `properties/${propertyId}/payments`);
      await addDoc(paymentsRef, {
        guestName: formData.guestName,
        reservationNumber: formData.reservationNumber || null,
        amountPaid: parseFloat(formData.amountPaid),
        paymentMethod: formData.paymentMethod,
        date: formData.paymentDate,
        status: formData.status,
        notes: formData.notes || null,
        isRefund: false,
        createdAt: serverTimestamp(),
        paymentNumber: `MAN-${format(new Date(), 'yyyyMMdd')}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`
      });

      // Reset form
      setFormData({
        guestName: '',
        reservationNumber: '',
        amountPaid: '',
        paymentMethod: 'Credit Card',
        paymentDate: new Date().toISOString().split('T')[0],
        status: 'Paid',
        notes: ''
      });
      setShowPaymentForm(false);
    } catch (error) {
      console.error('Error adding payment:', error);
      alert('Failed to save payment. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePayment = async () => {
    if (!paymentToDelete || !propertyId) {
      console.error('Missing data:', { paymentToDelete: !!paymentToDelete, propertyId });
      alert('Error: Missing required data. Please try again.');
      return;
    }

    setIsDeleting(true);
    try {
      const paymentRef = doc(db, `properties/${propertyId}/payments/${paymentToDelete.id}`);
      console.log('Deleting payment from path:', `properties/${propertyId}/payments/${paymentToDelete.id}`);
      await deleteDoc(paymentRef);
      console.log('Payment deleted successfully');
      
      // Remove from local state
      setAllPayments(prev => prev.filter(p => p.id !== paymentToDelete.id));
      setPaymentToDelete(null);
    } catch (error) {
      console.error('Error deleting payment:', error);
      alert(`Failed to delete payment: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const togglePaymentSelection = (paymentId: string) => {
    const newSelected = new Set(selectedPaymentIds);
    if (newSelected.has(paymentId)) {
      newSelected.delete(paymentId);
    } else {
      newSelected.add(paymentId);
    }
    setSelectedPaymentIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedPaymentIds.size === paginatedData.length) {
      setSelectedPaymentIds(new Set());
    } else {
      setSelectedPaymentIds(new Set(paginatedData.map(p => p.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedPaymentIds.size === 0 || !propertyId) {
      console.error('Missing data:', { selectedCount: selectedPaymentIds.size, propertyId });
      alert('Error: Missing required data. Please try again.');
      return;
    }
    
    setIsPerformingBulkAction(true);
    try {
      let successCount = 0;
      for (const paymentId of selectedPaymentIds) {
        try {
          const paymentRef = doc(db, `properties/${propertyId}/payments/${paymentId}`);
          console.log('Deleting payment from path:', `properties/${propertyId}/payments/${paymentId}`);
          await deleteDoc(paymentRef);
          successCount++;
          console.log(`Deleted ${successCount}/${selectedPaymentIds.size}`);
        } catch (error) {
          console.error(`Failed to delete payment ${paymentId}:`, error);
        }
      }
      
      console.log(`Successfully deleted ${successCount} out of ${selectedPaymentIds.size} payments`);
      
      // Remove from local state
      setAllPayments(prev => prev.filter(p => !selectedPaymentIds.has(p.id)));
      setSelectedPaymentIds(new Set());
      setShowBulkDeleteConfirm(false);
      
      if (successCount < selectedPaymentIds.size) {
        alert(`Deleted ${successCount}/${selectedPaymentIds.size} payments. Some failed.`);
      }
    } catch (error) {
      console.error('Error deleting payments:', error);
      alert(`Failed to delete payments: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsPerformingBulkAction(false);
    }
  };

  const handleBulkMarkAsPaid = async () => {
    if (selectedPaymentIds.size === 0 || !propertyId) return;
    
    setIsPerformingBulkAction(true);
    try {
      for (const paymentId of selectedPaymentIds) {
        const paymentRef = doc(db, `properties/${propertyId}/payments/${paymentId}`);
        await updateDoc(paymentRef, { status: 'Paid' });
      }
      
      // Update local state
      setAllPayments(prev => prev.map(p => 
        selectedPaymentIds.has(p.id) ? { ...p, status: 'Paid' } : p
      ));
      setSelectedPaymentIds(new Set());
    } catch (error) {
      console.error('Error updating payments:', error);
      alert('Failed to update some payments. Please try again.');
    } finally {
      setIsPerformingBulkAction(false);
    }
  };

  const handleBulkExport = () => {
    if (selectedPaymentIds.size === 0) return;
    
    const selectedPayments = filteredPayments.filter(p => selectedPaymentIds.has(p.id));
    const csv = [
      ['Date', 'Guest', 'Payment #', 'Reservation', 'Method', 'Amount', 'Status'].join(',')
    ];
    
    selectedPayments.forEach(p => {
      csv.push([
        format(parseISO(p.date), 'MMM dd, yyyy HH:mm'),
        `"${p.guestName || 'Unknown'}"`,
        p.paymentNumber || p.id.slice(0, 8),
        p.reservationNumber || '-',
        p.paymentMethod || '-',
        p.amountPaid || 0,
        p.isRefund ? 'Refunded' : p.status || 'Pending'
      ].join(','));
    });
    
    const downloadFile = (content: string, filename: string, type: string) => {
      const element = document.createElement('a');
      element.setAttribute('href', `data:${type};charset=utf-8,${encodeURIComponent(content)}`);
      element.setAttribute('download', filename);
      element.style.display = 'none';
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
    };
    
    downloadFile(csv.join('\n'), `payments-selected-${format(new Date(), 'yyyy-MM-dd')}.csv`, 'text/csv');
  };

  const handleIssueRefund = async () => {
    if (!paymentForRefund || !propertyId || !refundData.amount || !refundData.reason) {
      alert('Please fill in all refund details.');
      return;
    }

    setIsSubmitting(true);
    try {
      const functions = getFunctions(app, 'us-central1');
      const createRefund = httpsCallable(functions, 'createRefund');
      
      await createRefund({
        originalPaymentId: paymentForRefund.id,
        propertyId: propertyId,
        refundAmount: parseFloat(refundData.amount),
        reason: refundData.reason,
      });

      // Clear the refund form
      setShowRefundDialog(false);
      setPaymentForRefund(null);
      setRefundData({ reason: '', amount: '' });
      
      // Toast notification
      alert('Refund issued successfully!');
    } catch (error) {
      console.error('Error issuing refund:', error);
      alert(`Failed to issue refund: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const printPayment = (payment: PaymentWithId) => {
    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Payment Receipt - ${payment.paymentNumber || payment.id.slice(0, 8)}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: white; }
            .receipt { max-width: 600px; margin: 0 auto; border: 1px solid #ccc; padding: 30px; }
            .header { text-align: center; margin-bottom: 30px; }
            .header h1 { margin: 0; font-size: 24px; }
            .header p { margin: 5px 0; color: #666; }
            .section { margin: 20px 0; }
            .section-title { font-weight: bold; font-size: 14px; color: #333; margin-bottom: 10px; text-transform: uppercase; }
            .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
            .row-label { color: #666; }
            .row-value { font-weight: 500; }
            .amount-section { background: #f0f4ff; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; }
            .amount { font-size: 32px; font-weight: bold; color: #1e40af; margin: 10px 0; }
            .footer { text-align: center; margin-top: 30px; color: #999; font-size: 12px; }
            @media print { body { margin: 0; padding: 0; } }
          </style>
        </head>
        <body>
          <div class="receipt">
            <div class="header">
              <h1>Payment Receipt</h1>
              <p>${format(new Date(), 'MMMM dd, yyyy HH:mm')}</p>
            </div>
            
            <div class="amount-section">
              <div style="color: #666; font-size: 14px;">Payment Amount</div>
              <div class="amount">${currencySymbol}${(payment.amountPaid || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}</div>
            </div>
            
            <div class="section">
              <div class="section-title">Payment Details</div>
              <div class="row">
                <span class="row-label">Payment #</span>
                <span class="row-value">${payment.paymentNumber || payment.id.slice(0, 8)}</span>
              </div>
              <div class="row">
                <span class="row-label">Date & Time</span>
                <span class="row-value">${payment.date ? format(parseISO(payment.date), 'MMM dd, yyyy HH:mm') : '-'}</span>
              </div>
              <div class="row">
                <span class="row-label">Status</span>
                <span class="row-value">${payment.isRefund ? 'Refunded' : payment.status || 'Pending'}</span>
              </div>
              <div class="row">
                <span class="row-label">Payment Method</span>
                <span class="row-value">${payment.paymentMethod || '-'}</span>
              </div>
            </div>
            
            <div class="section">
              <div class="section-title">Guest Information</div>
              <div class="row">
                <span class="row-label">Guest Name</span>
                <span class="row-value">${payment.guestName || 'Unknown'}</span>
              </div>
              <div class="row">
                <span class="row-label">Reservation #</span>
                <span class="row-value">${payment.reservationNumber || '-'}</span>
              </div>
            </div>
            
            ${payment.notes ? `<div class="section">
              <div class="section-title">Notes</div>
              <div class="row" style="border-bottom: none;">
                <span class="row-value">${payment.notes}</span>
              </div>
            </div>` : ''}
            
            <div class="footer">
              <p>Thank you for your payment!</p>
            </div>
          </div>
        </body>
      </html>
    `;
    
    const printWindow = window.open('', '', 'height=600,width=800');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.print();
    }
  };

  // Set property ID
  useEffect(() => {
    if (user?.propertyId) {
      setPropertyId(user.propertyId);
    }
  }, [user]);

  // Fetch property settings
  useEffect(() => {
    if (!propertyId) {
      setPropertySettings(null);
      return;
    }
    const propDocRef = doc(db, "properties", propertyId);
    const unsubProp = onSnapshot(propDocRef, (docSnap) => {
      if (docSnap.exists()) {
        setPropertySettings({ id: docSnap.id, ...docSnap.data() } as Property);
      } else {
        setPropertySettings(null);
      }
    });

    return () => unsubProp();
  }, [propertyId]);

  // Fetch payments
  useEffect(() => {
    if (!propertyId) {
      setAllPayments([]);
      setIsLoading(true);
      return;
    }

    setIsLoading(true);
    const paymentsColRef = collection(db, `properties/${propertyId}/payments`);
    const paymentsQuery = query(paymentsColRef);

    const unsubPayments = onSnapshot(paymentsQuery, (snapshot) => {
      const fetchedPayments = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data(),
      } as PaymentWithId));
      setAllPayments(fetchedPayments);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching payments:", error);
      setIsLoading(false);
    });

    return () => unsubPayments();
  }, [propertyId]);

  // Filter and sort payments
  const filteredPayments = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return [];

    const rangeStart = startOfDay(dateRange.from);
    const rangeEnd = endOfDay(dateRange.to);

    let filtered = allPayments.filter(p => {
      const paymentDate = parseISO(p.date);
      const inDateRange = isWithinInterval(paymentDate, { start: rangeStart, end: rangeEnd });
      
      if (!inDateRange) return false;

      // Hide refunds if toggle is off
      if (!showRefunds && p.isRefund) return false;

      // Status filter
      if (statusFilter !== 'all') {
        if (statusFilter === 'refunded' && !p.isRefund) return false;
        if (statusFilter !== 'refunded' && (p.status !== statusFilter || p.isRefund)) return false;
      }

      // Payment method filter
      if (methodFilter !== 'all' && p.paymentMethod !== methodFilter) return false;

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          p.guestName?.toLowerCase().includes(query) ||
          p.paymentNumber?.toLowerCase().includes(query) ||
          p.invoiceId?.toLowerCase().includes(query)
        );
      }

      return true;
    });

    // Sort
    filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'createdAt':
          const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.date).getTime();
          const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.date).getTime();
          comparison = sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
          break;
        case 'date':
          comparison = sortOrder === 'desc' 
            ? new Date(b.date).getTime() - new Date(a.date).getTime()
            : new Date(a.date).getTime() - new Date(b.date).getTime();
          break;
        case 'amount':
          comparison = sortOrder === 'desc'
            ? (b.amountPaid || 0) - (a.amountPaid || 0)
            : (a.amountPaid || 0) - (b.amountPaid || 0);
          break;
        case 'guest':
          comparison = (a.guestName || '').localeCompare(b.guestName || '');
          if (sortOrder === 'desc') comparison = -comparison;
          break;
        case 'status':
          comparison = (a.status || '').localeCompare(b.status || '');
          if (sortOrder === 'desc') comparison = -comparison;
          break;
      }
      return comparison;
    });

    return filtered;
  }, [allPayments, dateRange, statusFilter, methodFilter, searchQuery, sortBy, sortOrder]);

  // Summary stats
  const stats = useMemo(() => {
    return {
      total: filteredPayments.length,
      totalAmount: filteredPayments.reduce((sum, p) => sum + (p.amountPaid || 0), 0),
      average: filteredPayments.length > 0 
        ? filteredPayments.reduce((sum, p) => sum + (p.amountPaid || 0), 0) / filteredPayments.length 
        : 0,
    };
  }, [filteredPayments]);

  // Pagination calculations
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredPayments.slice(startIndex, endIndex);
  }, [filteredPayments, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredPayments.length / itemsPerPage);

  // Get unique payment methods
  const paymentMethods = useMemo(() => {
    const methods = new Set(allPayments.map(p => p.paymentMethod).filter(Boolean));
    return Array.from(methods);
  }, [allPayments]);

  // Get status badge color
  const getStatusColor = (status: string, isRefund: boolean) => {
    if (isRefund) return 'bg-indigo-100 text-indigo-800';
    switch (status) {
      case 'Paid':
        return 'bg-emerald-100 text-emerald-800';
      case 'Pending':
        return 'bg-amber-100 text-amber-800';
      case 'Failed':
        return 'bg-rose-100 text-rose-800';
      default:
        return 'bg-slate-100 text-slate-800';
    }
  };

  if (isLoading && !propertyId) {
    return <div className="flex h-full items-center justify-center"><Icons.Spinner className="h-8 w-8 animate-spin" /></div>;
  }

  // Calculate all metrics
  const paymentsCount = filteredPayments.length;
  const pendingPaymentsCount = filteredPayments.filter(p => p.status === 'Pending').length;
  const failedPaymentsCount = filteredPayments.filter(p => p.status === 'Failed').length;
  const refundActivityCount = filteredPayments.filter(p => p.isRefund).length;
  
  const avgPayment = filteredPayments.length > 0 
    ? filteredPayments.reduce((sum, p) => sum + (p.amountPaid || 0), 0) / filteredPayments.length 
    : 0;
  
  // Payment Methods Mix - count unique methods
  const methodCounts = filteredPayments.reduce((acc, p) => {
    const method = p.paymentMethod || 'Other';
    acc[method] = (acc[method] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const mostCommonMethod = Object.entries(methodCounts).length > 0
    ? Object.entries(methodCounts).sort((a, b) => b[1] - a[1])[0][0]
    : 'None';
  
  // Processing Time - average days from first payment to last
  const processingTime = filteredPayments.length > 1
    ? Math.round((new Date(filteredPayments[0].date).getTime() - new Date(filteredPayments[filteredPayments.length - 1].date).getTime()) / (1000 * 60 * 60 * 24) / filteredPayments.length)
    : 0;
  
  // Latest Payment
  const latestPayment = filteredPayments.length > 0 ? filteredPayments[0] : null;

  return (
    // 1. Global Page Wrapper
    <div className="min-h-screen p-4">
      <div className="w-full mx-auto">
        
        {/* 2. Header & Global Actions */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
            <div className="flex-1">
              <h1 className="text-4xl font-bold tracking-tight text-slate-900">Payments</h1>
              <p className="text-slate-600 text-sm mt-2">Complete ledger of all financial transactions and payment history</p>
            </div>
            
            {/* Right Column: Primary Action Buttons */}
            <div className="flex gap-2 flex-wrap sm:flex-nowrap">
              <Button onClick={() => setShowPaymentForm(true)} className="bg-blue-600 hover:bg-blue-700 text-white gap-2 whitespace-nowrap">
                <Plus className="h-4 w-4" />
                Manual Entry
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="gap-2 whitespace-nowrap">
                    <Download className="h-4 w-4" />
                    Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={exportToPDF} className="cursor-pointer gap-2">
                    <FileText className="h-4 w-4" />
                    <span>PDF</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={exportToCSV} className="cursor-pointer gap-2">
                    <FileText className="h-4 w-4" />
                    <span>CSV</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={exportToExcel} className="cursor-pointer gap-2">
                    <FileText className="h-4 w-4" />
                    <span>Excel</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* 3. Financial KPI Dashboard - Enhanced Metrics */}
        {/* Row 1: Actionable Metrics */}
        <div className="mb-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {/* Payments Count */}
            <div className="bg-white rounded-xl p-5 shadow-sm border-l-4 border-emerald-500 transition-transform hover:-translate-y-1">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Payments Count</p>
                  <h3 className="text-3xl font-bold mt-2 text-slate-900">{paymentsCount}</h3>
                </div>
                <div className="p-2 rounded-lg bg-emerald-50">
                  <DollarSign className="h-5 w-5 text-emerald-600" />
                </div>
              </div>
            </div>

            {/* Pending Payments */}
            <div className="bg-white rounded-xl p-5 shadow-sm border-l-4 border-amber-500 transition-transform hover:-translate-y-1">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Pending Payments</p>
                  <h3 className="text-3xl font-bold mt-2 text-slate-900">{pendingPaymentsCount}</h3>
                </div>
                <div className="p-2 rounded-lg bg-amber-50">
                  <Clock className="h-5 w-5 text-amber-600" />
                </div>
              </div>
            </div>

            {/* Failed Payments */}
            <div className="bg-white rounded-xl p-5 shadow-sm border-l-4 border-rose-500 transition-transform hover:-translate-y-1">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Failed Payments</p>
                  <h3 className="text-3xl font-bold mt-2 text-slate-900">{failedPaymentsCount}</h3>
                </div>
                <div className="p-2 rounded-lg bg-rose-50">
                  <AlertCircle className="h-5 w-5 text-rose-600" />
                </div>
              </div>
            </div>

            {/* Refund Activity */}
            <div className="bg-white rounded-xl p-5 shadow-sm border-l-4 border-indigo-500 transition-transform hover:-translate-y-1">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Refund Activity</p>
                  <h3 className="text-3xl font-bold mt-2 text-slate-900">{refundActivityCount}</h3>
                </div>
                <div className="p-2 rounded-lg bg-indigo-50">
                  <RotateCcw className="h-5 w-5 text-indigo-600" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 4. Control Toolbar */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-8">
          <div className="flex flex-col sm:flex-row sm:justify-between gap-4">
            {/* Left: Search Bar */}
            <div className="relative flex-1 max-w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by guest, invoice, or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Right: Filter Actions */}
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="Paid">Paid</SelectItem>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="Failed">Failed</SelectItem>
                  <SelectItem value="refunded">Refunded</SelectItem>
                </SelectContent>
              </Select>

              <Select value={methodFilter} onValueChange={setMethodFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Payment Method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Methods</SelectItem>
                  <SelectItem value="Credit Card">Credit Card</SelectItem>
                  <SelectItem value="Debit Card">Debit Card</SelectItem>
                  <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                  <SelectItem value="PayPal">PayPal</SelectItem>
                  <SelectItem value="Cash">Cash</SelectItem>
                  <SelectItem value="Check">Check</SelectItem>
                </SelectContent>
              </Select>

              <Button 
                variant={showRefunds ? "default" : "outline"}
                className="gap-2"
                onClick={() => setShowRefunds(!showRefunds)}
              >
                <RotateCcw className="h-4 w-4" />
                {showRefunds ? 'Hide' : 'Show'} Refunds
              </Button>

              <Select value={`${sortBy}-${sortOrder}`} onValueChange={(value) => {
                const [newSortBy, newSortOrder] = value.split('-') as [typeof sortBy, typeof sortOrder];
                setSortBy(newSortBy);
                setSortOrder(newSortOrder);
              }}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Sort By" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date-desc">Date (Newest)</SelectItem>
                  <SelectItem value="date-asc">Date (Oldest)</SelectItem>
                  <SelectItem value="amount-desc">Amount (High to Low)</SelectItem>
                  <SelectItem value="amount-asc">Amount (Low to High)</SelectItem>
                  <SelectItem value="guest-asc">Guest (A-Z)</SelectItem>
                  <SelectItem value="guest-desc">Guest (Z-A)</SelectItem>
                  <SelectItem value="status-asc">Status (A-Z)</SelectItem>
                </SelectContent>
              </Select>

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <Calendar className="h-4 w-4" />
                    {dateRange?.from ? format(dateRange.from, 'MMM dd') : 'Date Range'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 flex flex-col sm:flex-row" align="end">
                  <div className="flex flex-col space-y-1 border-b sm:border-b-0 sm:border-r p-2">
                    <Button variant="ghost" size="sm" className="justify-start text-xs" onClick={() => setPresetRange("today")}>Today</Button>
                    <Button variant="ghost" size="sm" className="justify-start text-xs" onClick={() => setPresetRange("this_week")}>This Week</Button>
                    <Button variant="ghost" size="sm" className="justify-start text-xs" onClick={() => setPresetRange("this_month")}>This Month</Button>
                    <Button variant="ghost" size="sm" className="justify-start text-xs" onClick={() => setPresetRange("last_7_days")}>Last 7 Days</Button>
                    <Button variant="ghost" size="sm" className="justify-start text-xs" onClick={() => setPresetRange("last_30_days")}>Last 30 Days</Button>
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
        </div>

        {/* 5. Data Table & Ledger */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-8">
          {/* Bulk Actions Toolbar */}
          {selectedPaymentIds.size > 0 && (
            <div className="bg-blue-50 border-b border-blue-200 px-6 py-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-blue-900">
                  {selectedPaymentIds.size} payment{selectedPaymentIds.size !== 1 ? 's' : ''} selected
                </span>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button 
                  size="sm"
                  variant="outline"
                  onClick={handleBulkMarkAsPaid}
                  disabled={isPerformingBulkAction}
                  className="gap-2"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Mark as Paid
                </Button>
                <Button 
                  size="sm"
                  variant="outline"
                  onClick={handleBulkExport}
                  disabled={isPerformingBulkAction}
                  className="gap-2"
                >
                  <Download className="h-4 w-4" />
                  Export
                </Button>
                <Button 
                  size="sm"
                  variant="outline"
                  onClick={() => setShowBulkDeleteConfirm(true)}
                  disabled={isPerformingBulkAction}
                  className="gap-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
                <Button 
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelectedPaymentIds(new Set())}
                  disabled={isPerformingBulkAction}
                >
                  Clear
                </Button>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50 border-b border-slate-200">
                <TableRow>
                  <TableHead className="w-10">
                    <input
                      type="checkbox"
                      checked={selectedPaymentIds.size === paginatedData.length && paginatedData.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                  </TableHead>
                  <TableHead className="text-xs font-semibold text-slate-700 uppercase cursor-pointer" onClick={() => setSortBy('createdAt')}>
                    <div className="flex items-center gap-2">
                      Date {sortBy === 'createdAt' && <ArrowUpDown className="h-3 w-3" />}
                    </div>
                  </TableHead>
                  <TableHead className="text-xs font-semibold text-slate-700 uppercase cursor-pointer" onClick={() => setSortBy('guest')}>
                    <div className="flex items-center gap-2">
                      Guest {sortBy === 'guest' && <ArrowUpDown className="h-3 w-3" />}
                    </div>
                  </TableHead>
                  <TableHead className="text-xs font-semibold text-slate-700 uppercase">Payment #</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-700 uppercase">Reservation</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-700 uppercase">Method</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-700 uppercase text-right cursor-pointer" onClick={() => setSortBy('amount')}>
                    <div className="flex items-center justify-end gap-2">
                      Amount {sortBy === 'amount' && <ArrowUpDown className="h-3 w-3" />}
                    </div>
                  </TableHead>
                  <TableHead className="text-xs font-semibold text-slate-700 uppercase cursor-pointer" onClick={() => setSortBy('status')}>
                    <div className="flex items-center gap-2">
                      Status {sortBy === 'status' && <ArrowUpDown className="h-3 w-3" />}
                    </div>
                  </TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedData.length > 0 ? (
                  paginatedData.map((payment) => (
                    <TableRow key={payment.id} className={`border-b border-slate-100 transition-colors group ${payment.isRefund ? 'bg-indigo-25 hover:bg-indigo-50' : selectedPaymentIds.has(payment.id) ? 'bg-blue-50' : 'hover:bg-slate-50'} ${payment.isRefund ? 'pl-4' : ''}`}>
                      <TableCell className="w-10">
                        <input
                          type="checkbox"
                          checked={selectedPaymentIds.has(payment.id)}
                          onChange={() => togglePaymentSelection(payment.id)}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      </TableCell>
                      <TableCell className="text-sm text-slate-700">
                        {payment.isRefund && <span className="text-indigo-600 font-medium mr-1">↳</span>}
                        {format(parseISO(payment.date), 'MMM dd, yyyy')}
                      </TableCell>
                      <TableCell className={`text-sm font-medium ${payment.isRefund ? 'text-indigo-700' : 'text-slate-900'}`}>
                        {payment.isRefund && <RotateCcw className="h-3 w-3 inline mr-1 text-indigo-600" />}
                        {payment.guestName || 'Unknown'}
                      </TableCell>
                      <TableCell className="text-sm text-slate-600 font-mono">
                        {payment.paymentNumber || payment.id.slice(0, 8)}
                      </TableCell>
                      <TableCell className="text-sm text-slate-600 font-mono">
                        {payment.reservationNumber || '-'}
                      </TableCell>
                      <TableCell className="text-sm text-slate-600">
                        {payment.paymentMethod || '-'}
                      </TableCell>
                      <TableCell className={`text-sm font-semibold text-right ${payment.isRefund ? 'text-indigo-600' : 'text-slate-900'}`}>
                        {payment.isRefund ? '-' : ''}{currencySymbol}{Math.abs(payment.amountPaid || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className={getStatusColor(payment.status || 'Pending', payment.isRefund || false)}>
                          {payment.isRefund ? 'Refunded' : payment.status || 'Pending'}
                        </Badge>
                      </TableCell>
                      <TableCell className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="p-1 hover:bg-slate-200 rounded-lg transition-colors">
                              <MoreHorizontal className="h-4 w-4 text-slate-400" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56">
                            {/* View Details */}
                            <DropdownMenuItem onClick={() => setSelectedPayment(payment)} className="cursor-pointer gap-2">
                              <AlertCircle className="h-4 w-4" />
                              <span>View Details</span>
                            </DropdownMenuItem>
                            
                            {/* Edit Payment */}
                            <DropdownMenuItem className="cursor-pointer gap-2">
                              <DollarSign className="h-4 w-4" />
                              <span>Edit Payment</span>
                            </DropdownMenuItem>
                            
                            {/* Download Receipt */}
                            <DropdownMenuItem className="cursor-pointer gap-2">
                              <Download className="h-4 w-4" />
                              <span>Download Receipt</span>
                            </DropdownMenuItem>
                            
                            {/* Print */}
                            <DropdownMenuItem onClick={() => printPayment(payment)} className="cursor-pointer gap-2">
                              <FileText className="h-4 w-4" />
                              <span>Print</span>
                            </DropdownMenuItem>

                            {/* Send to Guest - Submenu */}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <div className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-slate-100">
                                  <Zap className="h-4 w-4 mr-2" />
                                  <span>Send to Guest</span>
                                  <span className="ml-auto text-slate-400">→</span>
                                </div>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="start" side="right" className="w-48">
                                <DropdownMenuItem className="cursor-pointer gap-2">
                                  <FileText className="h-4 w-4" />
                                  <span>Email</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem className="cursor-pointer gap-2">
                                  <MessageCircle className="h-4 w-4" />
                                  <span>WhatsApp</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem className="cursor-pointer gap-2">
                                  <Globe className="h-4 w-4" />
                                  <span>Guest Portal</span>
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>

                            {/* Mark as Paid - Only if pending */}
                            {payment.status === 'Pending' && (
                              <DropdownMenuItem className="cursor-pointer gap-2">
                                <CheckCircle2 className="h-4 w-4" />
                                <span>Mark as Paid</span>
                              </DropdownMenuItem>
                            )}
                            
                            {/* Issue Refund */}
                            {payment.status === 'Paid' && !payment.isRefund && (
                              <DropdownMenuItem 
                                onClick={() => {
                                  setPaymentForRefund(payment);
                                  setShowRefundDialog(true);
                                }} 
                                className="cursor-pointer gap-2"
                              >
                                <RotateCcw className="h-4 w-4" />
                                <span>Issue Refund</span>
                              </DropdownMenuItem>
                            )}
                            
                            {/* View Reservation */}
                            <DropdownMenuItem className="cursor-pointer gap-2">
                              <Calendar className="h-4 w-4" />
                              <span>View Reservation</span>
                            </DropdownMenuItem>

                            {/* Delete */}
                            <DropdownMenuItem onClick={() => setPaymentToDelete(payment)} className="cursor-pointer gap-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50">
                              <Trash2 className="h-4 w-4" />
                              <span>Delete</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12">
                      <AlertCircle className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                      <p className="text-slate-500 text-sm font-medium">No payments found</p>
                      <p className="text-slate-400 text-xs mt-1">Try adjusting your filters or date range</p>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* 6. Footer & Pagination */}
          <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <div className="flex items-center gap-4">
              <div className="text-sm text-slate-600">
                Showing <span className="font-semibold text-slate-900">{paginatedData.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0}</span> to <span className="font-semibold text-slate-900">{Math.min(currentPage * itemsPerPage, filteredPayments.length)}</span> of <span className="font-semibold text-slate-900">{filteredPayments.length}</span> payments
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-600">Per page:</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="px-2 py-1 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value={15}>15</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <div className="flex items-center gap-2 px-3">
                <span className="text-sm text-slate-600">
                  Page <span className="font-semibold">{currentPage}</span> of <span className="font-semibold">{totalPages || 1}</span>
                </span>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        </div>

        {/* Add Payment Dialog */}
        <Dialog open={showPaymentForm} onOpenChange={setShowPaymentForm}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Record Manual Payment</DialogTitle>
              <DialogDescription>Add a new payment transaction to the ledger</DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleSubmitPayment} className="space-y-6">
              {/* Guest Information */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-900">Guest Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-2">Guest Name *</label>
                    <input
                      type="text"
                      required
                      value={formData.guestName}
                      onChange={(e) => setFormData({...formData, guestName: e.target.value})}
                      placeholder="Enter guest name"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-2">Reservation #</label>
                    <input
                      type="text"
                      value={formData.reservationNumber}
                      onChange={(e) => setFormData({...formData, reservationNumber: e.target.value})}
                      placeholder="Reservation number"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Payment Information */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-900">Payment Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-2">Amount *</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">{currencySymbol}</span>
                      <input
                        type="number"
                        required
                        step="0.01"
                        min="0"
                        value={formData.amountPaid}
                        onChange={(e) => setFormData({...formData, amountPaid: e.target.value})}
                        placeholder="0.00"
                        className="w-full pl-7 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-2">Payment Method *</label>
                    <select
                      value={formData.paymentMethod}
                      onChange={(e) => setFormData({...formData, paymentMethod: e.target.value})}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="Credit Card">Credit Card</option>
                      <option value="Debit Card">Debit Card</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                      <option value="PayPal">PayPal</option>
                      <option value="Cash">Cash</option>
                      <option value="Check">Check</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-2">Payment Date *</label>
                    <input
                      type="date"
                      required
                      value={formData.paymentDate}
                      onChange={(e) => setFormData({...formData, paymentDate: e.target.value})}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-2">Status *</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({...formData, status: e.target.value})}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="Paid">Paid</option>
                      <option value="Pending">Pending</option>
                      <option value="Failed">Failed</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-700">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  placeholder="Add any additional notes..."
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t border-slate-200">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowPaymentForm(false)}
                  disabled={isSubmitting}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  {isSubmitting ? 'Saving...' : 'Save Payment'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* 7. Payment Details Modal */}
        <Dialog open={!!selectedPayment} onOpenChange={(open) => !open && setSelectedPayment(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl">Payment Details</DialogTitle>
              <DialogDescription>
                Complete information for this transaction
              </DialogDescription>
            </DialogHeader>

            {selectedPayment && (
              <div className="space-y-6">
                {/* Amount Highlight */}
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-6 border border-blue-200">
                  <p className="text-sm text-blue-600 font-medium mb-2">Payment Amount</p>
                  <p className="text-4xl font-bold text-blue-900">{currencySymbol}{(selectedPayment.amountPaid || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}</p>
                </div>

                {/* Metadata Grid */}
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Date & Time</p>
                    <p className="text-sm font-medium text-slate-900">{selectedPayment.date ? format(parseISO(selectedPayment.date), 'MMM dd, yyyy HH:mm') : '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Guest Name</p>
                    <p className="text-sm font-medium text-slate-900">{selectedPayment.guestName || 'Unknown'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Payment #</p>
                    <p className="text-sm font-mono text-slate-900">{selectedPayment.paymentNumber || selectedPayment.id.slice(0, 8)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Reservation #</p>
                    <p className="text-sm font-mono text-slate-900">{selectedPayment.reservationNumber || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Payment Method</p>
                    <p className="text-sm font-medium text-slate-900">{selectedPayment.paymentMethod || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Status</p>
                    <Badge className={getStatusColor(selectedPayment.status || 'Pending', selectedPayment.isRefund || false)}>
                      {selectedPayment.isRefund ? 'Refunded' : selectedPayment.status || 'Pending'}
                    </Badge>
                  </div>
                  {selectedPayment.notes && (
                    <div className="col-span-2">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Notes</p>
                      <p className="text-sm text-slate-900">{selectedPayment.notes}</p>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4 border-t border-slate-200">
                  <Button onClick={() => selectedPayment && printPayment(selectedPayment)} variant="outline" className="flex-1 gap-2">
                    <FileText className="h-4 w-4" />
                    Print
                  </Button>
                  <Button className="flex-1 bg-blue-600 hover:bg-blue-700 gap-2">
                    <Download className="h-4 w-4" />
                    Download Receipt
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Bulk Delete Confirmation Dialog */}
        <Dialog open={showBulkDeleteConfirm} onOpenChange={setShowBulkDeleteConfirm}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete {selectedPaymentIds.size} Payment{selectedPaymentIds.size !== 1 ? 's' : ''}</DialogTitle>
              <DialogDescription>
                Are you sure you want to permanently delete {selectedPaymentIds.size} selected payment{selectedPaymentIds.size !== 1 ? 's' : ''}? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>

            <div className="bg-rose-50 border border-rose-200 rounded-lg p-4 mb-6">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-slate-600">Total Amount</span>
                  <span className="text-lg font-bold text-rose-600">
                    {currencySymbol}{filteredPayments
                      .filter(p => selectedPaymentIds.has(p.id))
                      .reduce((sum, p) => sum + (p.amountPaid || 0), 0)
                      .toLocaleString('en-US', { maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="text-sm text-slate-600">
                  {selectedPaymentIds.size} payment{selectedPaymentIds.size !== 1 ? 's' : ''} will be deleted
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setShowBulkDeleteConfirm(false)}
                disabled={isPerformingBulkAction}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleBulkDelete}
                disabled={isPerformingBulkAction}
                className="flex-1 bg-rose-600 hover:bg-rose-700"
              >
                {isPerformingBulkAction ? 'Deleting...' : 'Delete Payments'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={!!paymentToDelete} onOpenChange={(open) => !open && setPaymentToDelete(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Payment</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this payment? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>

            {paymentToDelete && (
              <div className="bg-rose-50 border border-rose-200 rounded-lg p-4 mb-6">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-600">Payment #</span>
                    <span className="text-sm font-medium text-slate-900">{paymentToDelete.paymentNumber || paymentToDelete.id.slice(0, 8)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-600">Guest</span>
                    <span className="text-sm font-medium text-slate-900">{paymentToDelete.guestName || 'Unknown'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-600">Amount</span>
                    <span className="text-sm font-medium text-rose-600">{currencySymbol}{(paymentToDelete.amountPaid || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setPaymentToDelete(null)}
                disabled={isDeleting}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleDeletePayment}
                disabled={isDeleting}
                className="flex-1 bg-rose-600 hover:bg-rose-700"
              >
                {isDeleting ? 'Deleting...' : 'Delete Payment'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Refund Dialog */}
        <Dialog open={showRefundDialog} onOpenChange={(open) => !open && (setShowRefundDialog(false), setPaymentForRefund(null), setRefundData({ reason: '', amount: '' }))}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Issue Refund</DialogTitle>
              <DialogDescription>
                Process a refund for this payment
              </DialogDescription>
            </DialogHeader>

            {paymentForRefund && (
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-slate-600">Payment #</span>
                      <span className="text-sm font-medium text-slate-900">{paymentForRefund.paymentNumber || paymentForRefund.id.slice(0, 8)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-slate-600">Guest</span>
                      <span className="text-sm font-medium text-slate-900">{paymentForRefund.guestName || 'Unknown'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-slate-600">Original Amount</span>
                      <span className="text-sm font-medium text-slate-900">{currencySymbol}{paymentForRefund.amountPaid || 0}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Refund Amount</label>
                  <input
                    type="number"
                    value={refundData.amount}
                    onChange={(e) => setRefundData({ ...refundData, amount: e.target.value })}
                    placeholder={`Max: ${paymentForRefund.amountPaid || 0}`}
                    max={paymentForRefund.amountPaid || 0}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Reason for Refund</label>
                  <textarea
                    value={refundData.reason}
                    onChange={(e) => setRefundData({ ...refundData, reason: e.target.value })}
                    placeholder="Enter reason for refund..."
                    rows={3}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>

                <div className="flex gap-3 justify-end">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowRefundDialog(false);
                      setPaymentForRefund(null);
                      setRefundData({ reason: '', amount: '' });
                    }}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleIssueRefund}
                    disabled={isSubmitting || !refundData.amount || !refundData.reason}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {isSubmitting ? 'Processing...' : 'Issue Refund'}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
