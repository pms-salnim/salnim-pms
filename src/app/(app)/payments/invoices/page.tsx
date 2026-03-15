

"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/icons";
import InvoicesTable from "@/components/payments/invoices-table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, where, orderBy, writeBatch, getDocs, limit, Timestamp } from 'firebase/firestore';
import type { Invoice } from '@/app/(app)/payments/page';
import { useAuth } from '@/contexts/auth-context';
import type { Property } from '@/types/property';
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { parseISO, format, subDays, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, X, DollarSign, Clock, AlertCircle, RotateCcw, TrendingUp, Zap, Activity, CheckCircle2 } from 'lucide-react';
import type { DateRange } from 'react-day-picker';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Calendar } from 'lucide-react';
import { enUS, fr } from 'date-fns/locale';

const InvoiceForm = dynamic(() => import('@/components/payments/invoice-form'), {
  loading: () => <div className="h-48 flex items-center justify-center"><Icons.Spinner className="h-6 w-6 animate-spin" /></div>,
});
const InvoiceViewModal = dynamic(() => import('@/components/payments/invoice-view-modal'), {
  loading: () => <div className="h-48 flex items-center justify-center"><Icons.Spinner className="h-6 w-6 animate-spin" /></div>,
});

export default function InvoicesPage() {
  const { user, isLoadingAuth } = useAuth();
  const searchParams = useSearchParams();
  const { t } = useTranslation('pages/payments/invoices/content');

  const [propertyId, setPropertyId] = useState<string | null>(null);
  const [propertySettings, setPropertySettings] = useState<Property | null>(null);

  const [allInvoices, setAllInvoices] = useState<Invoice[]>([]);
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(true);

  const [isInvoiceFormModalOpen, setIsInvoiceFormModalOpen] = useState(false);
  const [isViewInvoiceModalOpen, setIsViewInvoiceModalOpen] = useState(false);

  // Date range state
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfDay(subDays(new Date(), 29)),
    to: endOfDay(new Date()),
  });

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(15);

  // Sorting state
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Filtering state
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [filterSearch, setFilterSearch] = useState('');
  
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  // Bulk action states
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [invoicesToDelete, setInvoicesToDelete] = useState<string[]>([]);
  const [isStatusChangeDialogOpen, setIsStatusChangeDialogOpen] = useState(false);
  const [statusChangeInfo, setStatusChangeInfo] = useState<{ ids: string[]; status: Invoice['paymentStatus'] } | null>(null);
  
  const currencySymbol = propertySettings?.currency || '$';
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

  const canManage = user?.permissions?.finance;

  useEffect(() => {
    if (user?.propertyId) {
      setPropertyId(user.propertyId);
    }
  }, [user]);

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
        toast({ title: "Warning", description: "Property details not found for invoices." });
      }
    });

    return () => unsubProp();
  }, [propertyId]);

  useEffect(() => {
    if (!propertyId) {
      setAllInvoices([]);
      setIsLoadingInvoices(false);
      return;
    }

    setIsLoadingInvoices(true);
    const invoicesColRef = collection(db, "invoices");
    const iq = query(
      invoicesColRef, 
      where("propertyId", "==", propertyId)
    );
    
    const unsubInvoices = onSnapshot(iq, (snapshot) => {
      const fetchedInvoices = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Invoice));
      setAllInvoices(fetchedInvoices);
      setIsLoadingInvoices(false);
    }, (err) => {
      console.error("Error fetching invoices:", err);
      toast({ title: "Error", description: "Could not fetch invoices.", variant: "destructive" });
      setAllInvoices([]);
      setIsLoadingInvoices(false);
    });

    return () => unsubInvoices();
  }, [propertyId]);
  
  const reservationIdToView = searchParams.get('view_res');
  // Effect to handle opening the modal from a URL query parameter
  useEffect(() => {
      if (reservationIdToView && !isLoadingInvoices) {
          const fetchAndShowInvoice = async () => {
              const invoicesQuery = query(collection(db, "invoices"), where("reservationId", "==", reservationIdToView), limit(1));
              const querySnapshot = await getDocs(invoicesQuery);
              if (!querySnapshot.empty) {
                  const invoiceDoc = querySnapshot.docs[0];
                  setSelectedInvoice({ id: invoiceDoc.id, ...invoiceDoc.data() } as Invoice);
                  setIsViewInvoiceModalOpen(true);
              } else {
                  toast({ title: t('toasts.not_found_title'), description: t('toasts.not_found_description'), variant: "destructive" });
              }
          };
          fetchAndShowInvoice();
      }
  }, [reservationIdToView, allInvoices, isLoadingInvoices, t]);

  const filteredAndSortedInvoices = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return [];

    const rangeStart = startOfDay(dateRange.from);
    const rangeEnd = endOfDay(dateRange.to);

    return allInvoices
      .filter(inv => {
        // Date range filter
        const invoiceDate = inv.dateIssued ? parseISO(inv.dateIssued) : new Date();
        const inDateRange = invoiceDate >= rangeStart && invoiceDate <= rangeEnd;
        if (!inDateRange) return false;

        // Status filter
        if (filterStatus && inv.paymentStatus !== filterStatus) return false;

        // Search filter
        if (filterSearch) {
          const searchTermLower = filterSearch.toLowerCase();
          return (
            inv.guestOrCompany.toLowerCase().includes(searchTermLower) ||
            inv.invoiceNumber.toLowerCase().includes(searchTermLower) ||
            inv.reservationId?.toLowerCase().includes(searchTermLower)
          );
        }
        return true;
      })
      .sort((a, b) => {
        const valA = (a as any)[sortBy];
        const valB = (b as any)[sortBy];

        if (sortBy === 'createdAt') {
          const dateA = valA?.toDate ? valA.toDate().getTime() : 0;
          const dateB = valB?.toDate ? valB.toDate().getTime() : 0;
          return sortDirection === 'asc' ? dateA - dateB : dateB - dateA;
        }

        if (sortBy === 'dateIssued' || sortBy === 'dueDate') {
          try {
            const dateA = parseISO(valA).getTime();
            const dateB = parseISO(valB).getTime();
            return sortDirection === 'asc' ? dateA - dateB : dateB - dateA;
          } catch(e) {
            return 0; // Fallback for invalid date strings
          }
        }

        if (valA === undefined || valA === null) return 1;
        if (valB === undefined || valB === null) return -1;
        
        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
  }, [allInvoices, filterStatus, filterSearch, sortBy, sortDirection, dateRange]);

  const paginatedInvoices = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredAndSortedInvoices.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredAndSortedInvoices, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredAndSortedInvoices.length / itemsPerPage);

  const handleOpenInvoiceForm = (invoice: Invoice | null = null) => {
    if (!canManage) return;
    setEditingInvoice(invoice);
    setIsInvoiceFormModalOpen(true);
  };

  const handleSaveInvoice = async (invoiceData: Omit<Invoice, 'id' | 'propertyId' | 'createdAt' | 'updatedAt'>) => {
    if (!propertyId || !canManage) {
      toast({ title: "Error", description: "Permission denied or property not found.", variant: "destructive" });
      return;
    }
    const dataToSave = { ...invoiceData, propertyId };
    try {
      if (editingInvoice) {
        const docRef = doc(db, "invoices", editingInvoice.id);
        await updateDoc(docRef, { ...dataToSave, updatedAt: serverTimestamp() });
        toast({ title: t('toasts.success'), description: t('toasts.update_success') });
      } else {
        await addDoc(collection(db, "invoices"), { ...dataToSave, createdAt: serverTimestamp() });
        toast({ title: t('toasts.success'), description: t('toasts.create_success') });
      }
      setIsInvoiceFormModalOpen(false);
      setEditingInvoice(null);
    } catch (error) {
      console.error("Error saving invoice:", error);
      toast({ title: "Error", description: "Could not save invoice.", variant: "destructive" });
    }
  };

  const handleDeleteInvoice = (invoiceId: string) => {
    if (!canManage) return;
    setInvoicesToDelete([invoiceId]);
    setIsDeleteDialogOpen(true);
  };
  
  const handleBulkDelete = (invoiceIds: string[]) => {
    if (!canManage) return;
    setInvoicesToDelete(invoiceIds);
    setIsDeleteDialogOpen(true);
  };
  
  const confirmDelete = async () => {
    if (invoicesToDelete.length === 0 || !canManage) return;
    setIsLoadingInvoices(true);
    try {
      const batch = writeBatch(db);
      invoicesToDelete.forEach(id => {
        batch.delete(doc(db, "invoices", id));
      });
      await batch.commit();
      toast({ title: t('toasts.success'), description: t('toasts.delete_success', { count: invoicesToDelete.length }) });
    } catch (err) {
      console.error("Bulk delete error:", err);
      toast({ title: "Error", description: "Could not delete all selected invoices.", variant: "destructive" });
    } finally {
      setIsLoadingInvoices(false);
      setIsDeleteDialogOpen(false);
      setInvoicesToDelete([]);
    }
  };

  const handleBulkStatusChange = (invoiceIds: string[], status: Invoice['paymentStatus']) => {
    if (!canManage) return;
    setStatusChangeInfo({ ids: invoiceIds, status });
    setIsStatusChangeDialogOpen(true);
  };

  const confirmStatusChange = async () => {
    if (!statusChangeInfo || !canManage) return;
    setIsLoadingInvoices(true);
    try {
      const batch = writeBatch(db);
      statusChangeInfo.ids.forEach(id => {
        batch.update(doc(db, "invoices", id), { paymentStatus: statusChangeInfo.status, updatedAt: serverTimestamp() });
      });
      await batch.commit();
      toast({ title: t('toasts.success'), description: t('toasts.status_change_success', { count: statusChangeInfo.ids.length, status: statusChangeInfo.status }) });
    } catch (err) {
      console.error("Bulk status change error:", err);
      toast({ title: "Error", description: "Could not update all selected invoices.", variant: "destructive" });
    } finally {
      setIsLoadingInvoices(false);
      setIsStatusChangeDialogOpen(false);
      setStatusChangeInfo(null);
    }
  };

  const handleViewInvoice = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setIsViewInvoiceModalOpen(true);
  };
  
  const handleSortChange = (value: string) => {
    const [newSortBy, newSortDir] = value.split('-');
    setSortBy(newSortBy);
    setSortDirection(newSortDir as 'asc' | 'desc');
    setCurrentPage(1); 
  };

  const handleFilterChange = (filterType: 'status' | 'search', value: string | null) => {
    if (filterType === 'status') setFilterStatus(value);
    if (filterType === 'search') setFilterSearch(value || ''); 
    setCurrentPage(1); 
  };

  // Calculate metrics from filtered invoices
  const metrics = useMemo(() => {
    const invoices = filteredAndSortedInvoices;
    const totalInvoices = invoices.length;
    const totalAmount = invoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);
    const paidInvoices = invoices.filter(inv => inv.paymentStatus === 'Paid').length;
    const pendingInvoices = invoices.filter(inv => inv.paymentStatus === 'Pending').length;
    const partialInvoices = invoices.filter(inv => inv.paymentStatus === 'Partial').length;
    const overdueInvoices = invoices.filter(inv => inv.paymentStatus === 'Overdue').length;
    
    return {
      totalInvoices,
      totalAmount,
      paidInvoices,
      pendingInvoices,
      partialInvoices,
      overdueInvoices,
      avgAmount: totalInvoices > 0 ? totalAmount / totalInvoices : 0,
      paidPercentage: totalInvoices > 0 ? Math.round((paidInvoices / totalInvoices) * 100) : 0,
    };
  }, [filteredAndSortedInvoices]);

  if (isLoadingAuth) {
    return <div className="flex h-full items-center justify-center"><Icons.Spinner className="h-8 w-8 animate-spin" /></div>;
  }

  if (!user?.permissions?.finance) {
    return (
      <Alert variant="destructive">
        <Icons.AlertCircle className="h-4 w-4" />
        <AlertTitle>{t('access_denied_title')}</AlertTitle>
        <AlertDescription>
          {t('access_denied_description')}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-4">
      <main className="p-2 w-full mx-auto space-y-4">
        {/* 1. Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground font-headline">
              {t('title')}
            </h1>
            <p className="text-muted-foreground">
              {t('description')}
            </p>
          </div>
          <div className="flex gap-2">
            <Dialog open={isInvoiceFormModalOpen} onOpenChange={(isOpen) => { setIsInvoiceFormModalOpen(isOpen); if (!isOpen) setEditingInvoice(null); }}>
              <DialogTrigger asChild>
                <Button onClick={() => handleOpenInvoiceForm()} disabled={!propertyId || !canManage}>
                  <Icons.PlusCircle className="mr-2 h-4 w-4" /> {t('create_invoice_button')}
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-3xl">
                <DialogHeader>
                  <DialogTitle>{editingInvoice ? t('edit_invoice_modal.title') : t('create_invoice_modal.title')}</DialogTitle>
                  <DialogDescription>
                    {editingInvoice ? t('edit_invoice_modal.description') : t('create_invoice_modal.description')}
                  </DialogDescription>
                </DialogHeader>
                <InvoiceForm 
                  onClose={() => { setIsInvoiceFormModalOpen(false); setEditingInvoice(null); }} 
                  initialData={editingInvoice} 
                  onSave={handleSaveInvoice}
                  propertySettings={propertySettings}
                />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* 2. Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Total Invoices */}
          <div className="bg-white rounded-xl p-5 shadow-sm border-l-4 border-emerald-500 transition-transform hover:-translate-y-1">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Invoices</p>
                <h3 className="text-3xl font-bold mt-2 text-slate-900">{metrics.totalInvoices}</h3>
              </div>
              <div className="p-2 rounded-lg bg-emerald-50">
                <DollarSign className="h-5 w-5 text-emerald-600" />
              </div>
            </div>
          </div>

          {/* Paid Invoices */}
          <div className="bg-white rounded-xl p-5 shadow-sm border-l-4 border-emerald-600 transition-transform hover:-translate-y-1">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Paid</p>
                <h3 className="text-3xl font-bold mt-2 text-slate-900">{metrics.paidInvoices}</h3>
              </div>
              <div className="p-2 rounded-lg bg-green-50">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </div>

          {/* Pending Invoices */}
          <div className="bg-white rounded-xl p-5 shadow-sm border-l-4 border-amber-500 transition-transform hover:-translate-y-1">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Pending</p>
                <h3 className="text-3xl font-bold mt-2 text-slate-900">{metrics.pendingInvoices}</h3>
              </div>
              <div className="p-2 rounded-lg bg-amber-50">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
            </div>
          </div>

          {/* Overdue Invoices */}
          <div className="bg-white rounded-xl p-5 shadow-sm border-l-4 border-rose-500 transition-transform hover:-translate-y-1">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Overdue</p>
                <h3 className="text-3xl font-bold mt-2 text-slate-900">{metrics.overdueInvoices}</h3>
              </div>
              <div className="p-2 rounded-lg bg-rose-50">
                <AlertCircle className="h-5 w-5 text-rose-600" />
              </div>
            </div>
          </div>

          {/* Total Amount */}
          <div className="bg-white rounded-xl p-5 shadow-sm border-l-4 border-blue-500 transition-transform hover:-translate-y-1">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Amount</p>
                <h3 className="text-3xl font-bold mt-2 text-slate-900">{currencySymbol}{metrics.totalAmount.toLocaleString('en-US', { maximumFractionDigits: 0 })}</h3>
              </div>
              <div className="p-2 rounded-lg bg-blue-50">
                <TrendingUp className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </div>

          
        </div>

        {/* 3. Control Toolbar */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            {/* Left: Search Bar */}
            <div className="relative flex-1 max-w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by guest, invoice number..."
                value={filterSearch}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {filterSearch && (
                <button
                  onClick={() => handleFilterChange('search', '')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Status Filter */}
            <Select value={filterStatus || 'all'} onValueChange={(value) => handleFilterChange('status', value === 'all' ? null : value)}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="Paid">Paid</SelectItem>
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="Partial">Partial</SelectItem>
                <SelectItem value="Overdue">Overdue</SelectItem>
              </SelectContent>
            </Select>

            {/* Sort By Filter */}
            <Select value={`${sortBy}-${sortDirection}`} onValueChange={(value) => {
              const [newSortBy, newSortDir] = value.split('-');
              setSortBy(newSortBy);
              setSortDirection(newSortDir as 'asc' | 'desc');
              setCurrentPage(1);
            }}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Sort By" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="createdAt-desc">Date (Newest)</SelectItem>
                <SelectItem value="createdAt-asc">Date (Oldest)</SelectItem>
                <SelectItem value="amount-desc">Amount (High to Low)</SelectItem>
                <SelectItem value="amount-asc">Amount (Low to High)</SelectItem>
                <SelectItem value="guestOrCompany-asc">Guest (A-Z)</SelectItem>
                <SelectItem value="guestOrCompany-desc">Guest (Z-A)</SelectItem>
              </SelectContent>
            </Select>

            {/* Date Range Picker */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full sm:w-auto gap-2">
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

        {/* 4. Data Table */}
        <InvoicesTable 
          invoices={paginatedInvoices}
          isLoading={isLoadingInvoices}
          onViewInvoice={handleViewInvoice}
          onEditInvoice={handleOpenInvoiceForm}
          onDeleteInvoice={handleDeleteInvoice}
          currentPage={currentPage}
          totalPages={totalPages}
          itemsPerPage={itemsPerPage}
          onNextPage={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
          onPreviousPage={() => setCurrentPage(p => Math.max(1, p - 1))}
          onItemsPerPageChange={(value) => { setItemsPerPage(Number(value)); setCurrentPage(1); }}
          sortBy={sortBy}
          sortDirection={sortDirection}
          onSortChange={handleSortChange}
          filterStatus={filterStatus}
          filterSearch={filterSearch}
          onFilterChange={handleFilterChange}
          propertySettings={propertySettings}
          onBulkDelete={handleBulkDelete}
          onBulkStatusChange={handleBulkStatusChange}
          canManage={canManage}
        />

        {isViewInvoiceModalOpen && (
          <InvoiceViewModal
            isOpen={isViewInvoiceModalOpen}
            onClose={() => setIsViewInvoiceModalOpen(false)}
            invoice={selectedInvoice}
            propertySettings={propertySettings}
            onEdit={handleOpenInvoiceForm}
            canManage={canManage}
          />
        )}

        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('delete_dialog.title')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('delete_dialog.description', { count: invoicesToDelete.length })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setInvoicesToDelete([])}>{t('delete_dialog.cancel_button')}</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDelete} disabled={isLoadingInvoices}>
                {isLoadingInvoices && <Icons.Spinner className="mr-2 h-4 w-4 animate-spin" />}
                {t('delete_dialog.continue_button')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        
        <AlertDialog open={isStatusChangeDialogOpen} onOpenChange={setIsStatusChangeDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('status_change_dialog.title')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('status_change_dialog.description', { count: statusChangeInfo?.ids.length, status: statusChangeInfo?.status })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setStatusChangeInfo(null)}>{t('status_change_dialog.cancel_button')}</AlertDialogCancel>
              <AlertDialogAction onClick={confirmStatusChange} disabled={isLoadingInvoices}>
                {isLoadingInvoices && <Icons.Spinner className="mr-2 h-4 w-4 animate-spin" />}
                {t('status_change_dialog.confirm_button')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </div>
  );
}
