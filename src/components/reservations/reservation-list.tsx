
"use client";

import React from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
} from "@/components/ui/dropdown-menu";
import { Icons } from "@/components/icons";
import ReservationStatusBadge from "./reservation-status-badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { generateInvoicePdf } from "@/lib/pdfGenerator";
import type { Invoice, Payment } from '@/app/(app)/payments/page';
import { parseISO, format } from "date-fns";
import { toDate } from '@/lib/dateUtils';
import { enUS, fr } from 'date-fns/locale';
import type { Property } from '@/types/property';
import { db, app } from '@/lib/firebase';
import { doc, getDoc, type Timestamp, query, collection, where, limit, getDocs } from 'firebase/firestore';
import type { Reservation, ReservationStatus } from '@/components/calendar/types';
import { toast } from '@/hooks/use-toast';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useTranslation } from 'react-i18next';
import SendEmailDialog from './send-email-dialog';
import PaymentStatusBadge from '../payments/payment-status-badge';

interface ReservationListProps {
  reservations: Reservation[];
  payments?: Payment[];
  isLoading: boolean;
  onEditReservation: (reservation: Reservation) => void;
  onViewReservation: (reservation: Reservation) => void;
  onDeleteReservation: (reservationId: string) => void;
  onCheckIn: (reservationId: string) => void;
  onCheckOut: (reservation: Reservation) => void;
  onAddPayment?: (reservation: Reservation) => void;
  onViewInvoice?: (reservation: Reservation) => void;
  onCancelReservation?: (reservationId: string) => void;
  canManage?: boolean;
  propertyCurrency?: string;
  currentPropertyId?: string | null;
  // Pagination props
  currentPage: number;
  totalPages: number;
  totalFilteredCount: number;
  onNextPage: () => void;
  onPrevPage: () => void;
  reservationsPerPage: number;
  onReservationsPerPageChange: (value: string) => void;
  // Bulk actions
  bulkActions?: ('delete' | 'changeStatus')[];
  onBulkDelete?: (reservationIds: string[]) => void;
  onBulkStatusChange?: (reservationIds: string[], status: ReservationStatus) => void;
  propertySettings: Property | null;
  onRefundReservation?: (reservationId: string) => void;
  onRestoreReservation?: (reservation: Reservation) => void;
  onOpenRefundDialog?: (reservation: Reservation) => void;
  showRefundTotal?: boolean;
  hideCreateGuest?: boolean;
}

export default function ReservationList({ 
  reservations, 
  payments,
  isLoading, 
  onEditReservation, 
  onViewReservation,
  onDeleteReservation,
  onCheckIn,
  onCheckOut,
  onAddPayment,
  onViewInvoice,
  onCancelReservation,
  canManage,
  propertyCurrency = "$",
  currentPropertyId,
  currentPage,
  totalPages,
  totalFilteredCount,
  onNextPage,
  onPrevPage,
  reservationsPerPage,
  onReservationsPerPageChange,
  bulkActions,
  onBulkDelete,
  onBulkStatusChange,
  propertySettings,
  onRefundReservation,
  onRestoreReservation,
  onOpenRefundDialog,
  showRefundTotal,
  hideCreateGuest,
}: ReservationListProps) {
  
  const [selectedRowIds, setSelectedRowIds] = React.useState<Set<string>>(new Set());
  const [isSendEmailModalOpen, setIsSendEmailModalOpen] = React.useState(false);
  const [reservationForEmail, setReservationForEmail] = React.useState<Reservation | null>(null);
  const [isCreatingGuest, setIsCreatingGuest] = React.useState<string | null>(null);
  const { t, i18n } = useTranslation('pages/reservations/all/content');
  const [locale, setLocale] = React.useState(enUS);

  React.useEffect(() => {
    setLocale(i18n.language === 'fr' ? fr : enUS);
  }, [i18n.language]);

  React.useEffect(() => {
    setSelectedRowIds(new Set());
  }, [reservations]);
  
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = new Set(reservations.map(r => r.id));
      setSelectedRowIds(allIds);
    } else {
      setSelectedRowIds(new Set());
    }
  };

  const handleRowSelect = (rowId: string) => {
    const newSelectedRowIds = new Set(selectedRowIds);
    if (newSelectedRowIds.has(rowId)) {
      newSelectedRowIds.delete(rowId);
    } else {
      newSelectedRowIds.add(rowId);
    }
    setSelectedRowIds(newSelectedRowIds);
  };
  
  const numSelected = selectedRowIds.size;
  const isAllSelectedOnPage = numSelected > 0 && reservations.length > 0 && numSelected === reservations.length;

  const handleOpenSendEmail = (reservation: Reservation) => {
    if (!reservation.guestEmail) {
      toast({
        title: "No Email Address",
        description: "This guest does not have an email address recorded.",
        variant: "destructive",
      });
      return;
    }
    setReservationForEmail(reservation);
    setIsSendEmailModalOpen(true);
  };

  const statusOptions: ReservationStatus[] = ['Pending', 'Confirmed', 'Canceled', 'No-Show'];

   const handleCreateGuest = async (reservationId: string) => {
    if (!canManage) return;
    setIsCreatingGuest(reservationId);
    try {
        const functions = getFunctions(app, 'europe-west1');
        const createGuestFn = httpsCallable(functions, 'createGuestFromReservation');
        const result: any = await createGuestFn({ reservationId });
        if (result.data.success) {
            toast({ title: "Success", description: "Guest profile created and linked successfully." });
        } else {
            throw new Error(result.data.error || "Failed to create guest profile.");
        }
    } catch (error: any) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
        setIsCreatingGuest(null);
    }
  };
  
  const calculateTotalPaid = (reservationId: string) => {
    const list = payments || [];
    return list
      .filter(p => p.reservationId === reservationId && p.status === 'Paid')
      .reduce((sum, p) => sum + (typeof p.amountPaid === 'number' ? p.amountPaid : Number(p.amountPaid || 0)), 0);
  };

  const calculateRefundTotalFromPayments = (reservationId: string) => {
    const list = payments || [];
    return list
      .filter(p => p.reservationId === reservationId && (p.status === 'Refunded' || p.status === 'Partial-Refund'))
      .reduce((sum, p) => sum + (typeof p.amountPaid === 'number' ? p.amountPaid : Number(p.amountPaid || 0)), 0);
  };
  

  return (
    <>
      <div className="space-y-4">
        {numSelected > 0 && canManage && (
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border animate-in fade-in-50">
              <p className="text-sm font-medium">{t('list.bulk_actions.selected_text', { count: numSelected })}</p>
              <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">{t('list.bulk_actions.button_text')} <Icons.DropdownArrow className="ml-2 h-4 w-4" /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                      {bulkActions?.includes('changeStatus') && onBulkStatusChange && (
                          <DropdownMenuSub>
                              <DropdownMenuSubTrigger>
                                  <Icons.Edit className="mr-2 h-4 w-4" /> {t('list.bulk_actions.change_status_option')}
                              </DropdownMenuSubTrigger>
                              <DropdownMenuPortal>
                                  <DropdownMenuSubContent>
                                      {statusOptions.map(status => (
                                        <DropdownMenuItem key={status} onClick={() => onBulkStatusChange(Array.from(selectedRowIds), status)}>
                                          {t('list.bulk_actions.mark_as_status', { status })}
                                        </DropdownMenuItem>
                                      ))}
                                  </DropdownMenuSubContent>
                              </DropdownMenuPortal>
                          </DropdownMenuSub>
                      )}
                      {bulkActions?.includes('delete') && onBulkDelete && (
                          <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-destructive" onClick={() => onBulkDelete(Array.from(selectedRowIds))}>
                                  <Icons.Trash className="mr-2 h-4 w-4" /> {t('list.bulk_actions.delete_option')}
                              </DropdownMenuItem>
                          </>
                      )}
                  </DropdownMenuContent>
              </DropdownMenu>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-slate-400 font-medium border-b border-slate-200 bg-slate-50/30">
                <th className="w-12 py-3 px-4 border-r border-slate-50">
                  <Checkbox
                    checked={isAllSelectedOnPage ? true : numSelected > 0 ? 'indeterminate' : false}
                    onCheckedChange={(checked) => handleSelectAll(Boolean(checked))}
                    aria-label={t('list.headers.select_all')}
                    disabled={!canManage}
                  />
                </th>
                <th className="py-3 px-4 border-r border-slate-50">Res No.</th>
                <th className="py-3 px-4 border-r border-slate-50">Guest</th>
                <th className="py-3 px-4 border-r border-slate-50">Date Booked</th>
                <th className="py-3 px-4 border-r border-slate-50">Room</th>
                <th className="py-3 px-4 border-r border-slate-50">Check-in</th>
                <th className="py-3 px-4 border-r border-slate-50">Check-out</th>
                <th className="py-3 px-4 border-r border-slate-50">Nights</th>
                <th className="py-3 px-4 border-r border-slate-50">Total Price</th>
                <th className="py-3 px-4 border-r border-slate-50">Status</th>
                <th className="py-3 px-4 border-r border-slate-50">Source</th>
                <th className="py-3 px-4 text-right">More</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading && (
                <tr><td colSpan={12} className="h-48 text-center"><Icons.Spinner className="mx-auto h-6 w-6 animate-spin" /></td></tr>
              )}
              {!isLoading && reservations.map((reservation) => {
                const totalPaid = calculateTotalPaid(reservation.id);
                const totalGuests = Array.isArray(reservation.rooms) ? reservation.rooms.reduce((sum, r) => sum + (r.adults || 0) + (r.children || 0), 0) : 0;
                const nights = (toDate(reservation.endDate) && toDate(reservation.startDate)) ? Math.ceil((toDate(reservation.endDate) as any - toDate(reservation.startDate) as any) / (1000 * 60 * 60 * 24)) : 0;
                const checkInDate = toDate(reservation.startDate) ? format(toDate(reservation.startDate) as Date, "dd/MM/yy") : '';
                const checkOutDate = toDate(reservation.endDate) ? format(toDate(reservation.endDate) as Date, "dd/MM/yy") : '';
                const bookingDate = reservation.createdAt ? format(toDate(reservation.createdAt) as Date, "dd/MM/yy") : '';
                const bookingTime = reservation.createdAt ? format(toDate(reservation.createdAt) as Date, "HH:mm") : '';
                const source = (reservation as any).source || 'Direct';
                
                return (
                  <tr key={reservation.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-4 border-r border-slate-200">
                      <Checkbox
                        checked={selectedRowIds.has(reservation.id)}
                        onCheckedChange={() => handleRowSelect(reservation.id)}
                        aria-label={`Select reservation for ${reservation.guestName}`}
                        disabled={!canManage}
                      />
                    </td>
                    <td className="py-3 px-4 border-r border-slate-50">
                      <div className="font-medium text-slate-800 font-mono text-xs">{reservation.reservationNumber || 'N/A'}</div>
                    </td>
                    <td className="py-3 px-4 border-r border-slate-50">
                      <div className="font-bold text-slate-800">{reservation.guestName}</div>
                      <div className="text-[10px] text-slate-400">{totalGuests} guest{totalGuests !== 1 ? 's' : ''}</div>
                    </td>
                    <td className="py-3 px-4 border-r border-slate-50">
                      <div className="text-sm text-slate-800 font-medium">{bookingDate}</div>
                      <div className="text-xs text-slate-500">{bookingTime}</div>
                    </td>
                    <td className="py-3 px-4 border-r border-slate-50">
                      <div className="font-medium text-slate-800">{Array.isArray(reservation.rooms) && reservation.rooms[0] ? reservation.rooms[0].roomName : 'N/A'}</div>
                      <div className="text-xs text-slate-500">{Array.isArray(reservation.rooms) && reservation.rooms[0] ? reservation.rooms[0].roomTypeName : ''}</div>
                    </td>
                    <td className="py-3 px-4 border-r border-slate-50">
                      <div className="text-sm text-slate-800">{checkInDate}</div>
                    </td>
                    <td className="py-3 px-4 border-r border-slate-50">
                      <div className="text-sm text-slate-800">{checkOutDate}</div>
                    </td>
                    <td className="py-3 px-4 border-r border-slate-50">
                      <div className="text-sm text-slate-800">{nights} night{nights !== 1 ? 's' : ''}</div>
                    </td>
                    <td className="py-3 px-4 border-r border-slate-50">
                      <div className="text-sm font-semibold text-slate-800">{propertyCurrency}{(reservation.totalPrice || 0).toFixed(2)}</div>
                    </td>
                    <td className="py-3 px-4 border-r border-slate-50">
                      {reservation.status === 'Completed' ? (
                        <ReservationStatusBadge status={reservation.status} />
                      ) : reservation.status === 'Checked-in' ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <div className="cursor-pointer flex items-center gap-1">
                              <ReservationStatusBadge status={reservation.status} />
                              <Icons.DropdownArrow className="h-3 w-3 text-slate-400" />
                            </div>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="w-40">
                            <DropdownMenuItem 
                              onClick={() => onBulkStatusChange?.([reservation.id], 'Canceled')}
                              className="bg-red-50 text-red-700 font-semibold"
                            >
                              Cancel
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <div className="cursor-pointer flex items-center gap-1">
                              <ReservationStatusBadge status={reservation.status} />
                              <Icons.DropdownArrow className="h-3 w-3 text-slate-400" />
                            </div>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="w-40">
                            {/* Check if check-in date is today */}
                            {(() => {
                              const today = new Date();
                              const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
                              const checkInDate = toDate(reservation.startDate);
                              const checkInDateOnly = checkInDate ? new Date(checkInDate.getFullYear(), checkInDate.getMonth(), checkInDate.getDate()) : null;
                              const isCheckInToday = checkInDateOnly && checkInDateOnly.getTime() === todayStart.getTime();
                              
                              return isCheckInToday && reservation.status !== 'Checked-in' && reservation.status !== 'Canceled' && (
                                <>
                                  <DropdownMenuItem 
                                    onClick={() => onBulkStatusChange?.([reservation.id], 'Checked-in')}
                                    className="bg-green-50 text-green-700 font-semibold"
                                  >
                                    Check-in
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                </>
                              );
                            })()}
                            
                            {/* Check if check-out date is today */}
                            {(() => {
                              const today = new Date();
                              const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
                              const checkOutDate = toDate(reservation.endDate);
                              const checkOutDateOnly = checkOutDate ? new Date(checkOutDate.getFullYear(), checkOutDate.getMonth(), checkOutDate.getDate()) : null;
                              const isCheckOutToday = checkOutDateOnly && checkOutDateOnly.getTime() === todayStart.getTime();
                              
                              return isCheckOutToday && reservation.status !== 'Completed' && (
                                <>
                                  <DropdownMenuItem 
                                    onClick={() => onBulkStatusChange?.([reservation.id], 'Completed')}
                                    className="bg-blue-50 text-blue-700 font-semibold"
                                  >
                                    Complete
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                </>
                              );
                            })()}
                            
                            <DropdownMenuItem 
                              onClick={() => onBulkStatusChange?.([reservation.id], 'Pending')}
                              className={reservation.status === 'Pending' ? 'bg-blue-50' : ''}
                            >
                              Pending
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => onBulkStatusChange?.([reservation.id], 'Confirmed')}
                              className={reservation.status === 'Confirmed' ? 'bg-blue-50' : ''}
                            >
                              Confirmed
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => onBulkStatusChange?.([reservation.id], 'No-Show')}
                              className={reservation.status === 'No-Show' ? 'bg-orange-50' : ''}
                            >
                              No-Show
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              onClick={() => onBulkStatusChange?.([reservation.id], 'Canceled')}
                              className={reservation.status === 'Canceled' ? 'bg-red-50 text-red-700' : 'text-red-600'}
                            >
                              Cancel
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </td>
                    <td className="py-3 px-4 border-r border-slate-50">
                      <div className="text-sm text-slate-800">{source}</div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="text-slate-400 hover:text-slate-600">
                            <Icons.MoreVertical size={18} />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem onClick={() => onViewReservation(reservation)}>
                            <Icons.Eye className="mr-2 h-4 w-4" /> View Details
                          </DropdownMenuItem>
                          {canManage && (
                            <>
                              <DropdownMenuItem onClick={() => onEditReservation(reservation)}>
                                <Icons.Edit className="mr-2 h-4 w-4" /> Edit
                              </DropdownMenuItem>
                              
                              {onAddPayment && (reservation.paymentStatus === 'Pending' || reservation.paymentStatus === 'Partial') && (
                                <DropdownMenuItem onClick={() => onAddPayment(reservation)}>
                                  <Icons.CreditCard className="mr-2 h-4 w-4" /> Add Payment
                                </DropdownMenuItem>
                              )}
                              
                              {onViewInvoice && reservation.invoiceId && (
                                <DropdownMenuItem onClick={() => onViewInvoice(reservation)}>
                                  <Icons.FileText className="mr-2 h-4 w-4" /> View Invoice
                                </DropdownMenuItem>
                              )}
                              
                              {!hideCreateGuest && !reservation.guestId && (
                                <DropdownMenuItem onClick={() => handleCreateGuest(reservation.id)} disabled={isCreatingGuest === reservation.id}>
                                  {isCreatingGuest === reservation.id ? <Icons.Spinner className="mr-2 h-4 w-4 animate-spin"/> : <Icons.User className="mr-2 h-4 w-4" />}
                                  Create Guest Profile
                                </DropdownMenuItem>
                              )}
                              
                              <DropdownMenuItem onClick={() => handleOpenSendEmail(reservation)}>
                                <Icons.Mail className="mr-2 h-4 w-4" /> Send Email
                              </DropdownMenuItem>
                              
                              <DropdownMenuSeparator />
                              
                              <DropdownMenuItem className="text-destructive" onClick={() => onDeleteReservation(reservation.id)}>
                                <Icons.Trash className="mr-2 h-4 w-4" /> Delete
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                )
              })}
              {!isLoading && totalFilteredCount === 0 && (
                  <tr>
                    <td colSpan={12} className="h-24 text-center text-slate-500">
                      {t('list.no_reservations_message')}
                    </td>
                  </tr>
              )}
            </tbody>
          </table>
        </div>
        {!isLoading && totalPages > 0 && (
            <div className="flex items-center justify-end space-x-6 p-4">
                <div className="flex items-center space-x-2">
                    <p className="text-sm font-medium">{t('table.pagination.rows_per_page')}</p>
                    <Select
                        value={`${reservationsPerPage}`}
                        onValueChange={onReservationsPerPageChange}
                    >
                        <SelectTrigger className="h-8 w-[70px]">
                            <SelectValue placeholder={`${reservationsPerPage}`} />
                        </SelectTrigger>
                        <SelectContent side="top">
                            {[10, 25, 50, 100, 500].map((pageSize) => (
                                <SelectItem key={pageSize} value={`${pageSize}`}>
                                    {pageSize}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <span className="text-sm text-muted-foreground">
                    {t('table.pagination.page_of', { currentPage: currentPage, totalPages: totalPages })}
                </span>
                <div className="flex items-center space-x-2">
                    <Button variant="outline" size="sm" onClick={onPrevPage} disabled={currentPage === 1}>{t('table.pagination.previous_button')}</Button>
                    <Button variant="outline" size="sm" onClick={onNextPage} disabled={currentPage >= totalPages}>{t('table.pagination.next_button')}</Button>
                </div>
            </div>
        )}
      </div>
      
       {isSendEmailModalOpen && reservationForEmail && (
          <SendEmailDialog
              isOpen={isSendEmailModalOpen}
              onClose={() => setIsSendEmailModalOpen(false)}
              reservation={reservationForEmail}
              propertySettings={propertySettings}
          />
       )}
    </>
  );
}
