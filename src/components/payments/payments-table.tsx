

"use client";

import React from 'react';
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icons } from "@/components/icons";
import PaymentStatusBadge from "./payment-status-badge";
import type { Payment, Invoice } from "@/app/(app)/payments/page"; 
import { MoreHorizontal, Edit, Trash2 } from "lucide-react";
import { generateInvoicePdf } from "@/lib/pdfGenerator";
import { parseISO, format } from "date-fns";
import type { Property } from '@/types/property';
import { db, app } from '@/lib/firebase';
import { doc, getDoc, Timestamp, query, collection, where, limit, getDocs } from 'firebase/firestore';
import type { Reservation } from '@/components/calendar/types';
import { toast } from '@/hooks/use-toast';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useTranslation } from 'react-i18next';
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";


interface PaymentsTableProps {
  payments: Payment[];
  invoices: Invoice[];
  isLoading: boolean;
  onViewPayment: (payment: Payment) => void;
  onDeletePayment: (paymentId: string) => void;
  onRefundPayment: (payment: Payment) => void; // New prop for initiating refund
  currentPage: number;
  itemsPerPage: number;
  totalPages: number;
  onItemsPerPageChange: (value: string) => void;
  onNextPage: () => void;
  onPreviousPage: () => void;
  onSortChange: (column: string) => void;
  sortBy: string;
  sortDirection: 'asc' | 'desc';
  propertySettings: Property | null;
  onBulkDelete: (paymentIds: string[]) => void;
  onBulkStatusChange: (paymentIds: string[], status: Payment['status']) => void;
  canManage?: boolean;
}

export default function PaymentsTable({ 
    payments,
    invoices, 
    isLoading, 
    onViewPayment, 
    onDeletePayment,
    onRefundPayment, // New prop
    currentPage, 
    itemsPerPage, 
    totalPages,
    onItemsPerPageChange,
    onNextPage, 
    onPreviousPage, 
    onSortChange, 
    sortBy, 
    sortDirection, 
    propertySettings,
    onBulkDelete,
    onBulkStatusChange,
    canManage
}: PaymentsTableProps) {
  
  const { t } = useTranslation('pages/payments/list/content');
  const [selectedRowIds, setSelectedRowIds] = React.useState<Set<string>>(new Set());
  const [isProcessingEmail, setIsProcessingEmail] = React.useState<string | null>(null);

  React.useEffect(() => {
    setSelectedRowIds(new Set());
  }, [payments]);
  
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = new Set(payments.map(p => p.id));
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
  const isAllSelectedOnPage = numSelected > 0 && numSelected === payments.length;

  const handleResendReceipt = (paymentId: string) => alert(`Resend receipt for payment ${paymentId} (Placeholder)`);
  const currencySymbol = propertySettings?.currency || '$';
  
  const paymentStatusOptions: Payment['status'][] = ['Paid', 'Pending', 'Refunded', 'Failed'];

  return (
    <div className="space-y-4">
      {numSelected > 0 && canManage && (
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border animate-in fade-in-50">
          <p className="text-sm font-medium">{t('table.bulk_actions.selected_text', { count: numSelected })}</p>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">{t('table.bulk_actions.button_text')} <Icons.DropdownArrow className="ml-2 h-4 w-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <Icons.Edit className="mr-2 h-4 w-4" /> {t('table.bulk_actions.change_status_option')}
                </DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuSubContent>
                    {paymentStatusOptions.map(status => (
                      <DropdownMenuItem key={status} onClick={() => onBulkStatusChange(Array.from(selectedRowIds), status)}>{t('table.bulk_actions.mark_as_status', { status })}</DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuPortal>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive" onClick={() => onBulkDelete(Array.from(selectedRowIds))}>
                <Icons.Trash className="mr-2 h-4 w-4" /> {t('table.bulk_actions.delete_option')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      <div className="rounded-lg border shadow-sm bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={isAllSelectedOnPage ? true : numSelected > 0 ? 'indeterminate' : false}
                  onCheckedChange={(checked) => handleSelectAll(Boolean(checked))}
                  aria-label={t('table.select_all_aria_label')}
                  disabled={!canManage}
                />
              </TableHead>
              <TableHead className="cursor-pointer hover:text-foreground" onClick={() => onSortChange('paymentNumber')}>
                {t('table.headers.payment_id')} {sortBy === 'paymentNumber' && (sortDirection === 'asc' ? <Icons.ChevronRight className="ml-1 inline h-3 w-3 transform rotate-[-90deg]" /> : <Icons.ChevronRight className="ml-1 inline h-3 w-3 transform rotate-90" />)}
              </TableHead>
              <TableHead className="cursor-pointer hover:text-foreground" onClick={() => onSortChange('date')}>
                {t('table.headers.date')} {sortBy === 'date' && (sortDirection === 'asc' ? <Icons.ChevronRight className="ml-1 inline h-3 w-3 transform rotate-[-90deg]" /> : <Icons.ChevronRight className="ml-1 inline h-3 w-3 transform rotate-90" />)}
              </TableHead>
              <TableHead className="cursor-pointer hover:text-foreground" onClick={() => onSortChange('guestName')}>
                {t('table.headers.guest_name')} {sortBy === 'guestName' && (sortDirection === 'asc' ? <Icons.ChevronRight className="ml-1 inline h-3 w-3 transform rotate-[-90deg]" /> : <Icons.ChevronRight className="ml-1 inline h-3 w-3 transform rotate-90" />)}
              </TableHead>
              <TableHead className="cursor-pointer hover:text-foreground" onClick={() => onSortChange('paymentMethod')}>
                {t('table.headers.method')} {sortBy === 'paymentMethod' && (sortDirection === 'asc' ? <Icons.ChevronRight className="ml-1 inline h-3 w-3 transform rotate-[-90deg]" /> : <Icons.ChevronRight className="ml-1 inline h-3 w-3 transform rotate-90" />)}
              </TableHead>
              <TableHead className="text-right cursor-pointer hover:text-foreground" onClick={() => onSortChange('amountPaid')}>
                {t('table.headers.amount')} {sortBy === 'amountPaid' && (sortDirection === 'asc' ? <Icons.ChevronRight className="ml-1 inline h-3 w-3 transform rotate-[-90deg]" /> : <Icons.ChevronRight className="ml-1 inline h-3 w-3 transform rotate-90" />)}
              </TableHead>
              <TableHead className="cursor-pointer hover:text-foreground" onClick={() => onSortChange('status')}>
                {t('table.headers.status')} {sortBy === 'status' && (sortDirection === 'asc' ? <Icons.ChevronRight className="ml-1 inline h-3 w-3 transform rotate-[-90deg]" /> : <Icons.ChevronRight className="ml-1 inline h-3 w-3 transform rotate-90" />)}
              </TableHead>
              <TableHead className="cursor-pointer hover:text-foreground" onClick={() => onSortChange('invoiceId')}>
                {t('table.headers.invoice_no')} {sortBy === 'invoiceId' && (sortDirection === 'asc' ? <Icons.ChevronRight className="ml-1 inline h-3 w-3 transform rotate-[-90deg]" /> : <Icons.ChevronRight className="ml-1 inline h-3 w-3 transform rotate-90" />)}
              </TableHead>
              <TableHead className="text-right">{t('table.headers.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={9} className="h-24 text-center"><Icons.Spinner className="mx-auto h-6 w-6 animate-spin" /></TableCell></TableRow>
            )}
            {!isLoading && payments.map((payment) => {
              const invoice = invoices.find(inv => inv.id === payment.invoiceId);
              return (
              <TableRow key={payment.id} data-state={selectedRowIds.has(payment.id) && "selected"}>
                <TableCell>
                  <Checkbox
                    checked={selectedRowIds.has(payment.id)}
                    onCheckedChange={() => handleRowSelect(payment.id)}
                    aria-label="Select row"
                    disabled={!canManage}
                  />
                </TableCell>
                <TableCell className="font-medium truncate max-w-[100px]">{payment.paymentNumber || payment.id}</TableCell>
                <TableCell>{format(parseISO(payment.date), 'PP')}</TableCell>
                <TableCell>{payment.guestName}</TableCell>
                <TableCell>{payment.paymentMethod}</TableCell>
                <TableCell className="text-right">{currencySymbol}{payment.amountPaid.toFixed(2)}</TableCell>
                <TableCell>
                  <PaymentStatusBadge status={payment.status} />
                </TableCell>
                <TableCell>{invoice ? invoice.invoiceNumber : payment.invoiceId || "-"}</TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <span className="sr-only">Open menu</span>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onViewPayment(payment)}>
                        <Icons.Eye className="mr-2 h-4 w-4" /> {t('table.actions_menu.view_details')}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onRefundPayment(payment)} disabled={payment.status !== 'Paid' || !canManage}>
                        <Icons.Undo2 className="mr-2 h-4 w-4" /> {t('table.actions_menu.refund')}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleResendReceipt(payment.id)} disabled={!canManage}>
                        <Icons.Mail className="mr-2 h-4 w-4" /> {t('table.actions_menu.resend_receipt')}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive" onClick={() => onDeletePayment(payment.id)} disabled={!canManage}>
                          <Icons.Trash className="mr-2 h-4 w-4" /> {t('table.actions_menu.delete')}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
              )
            })}
            {!isLoading && payments.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="h-24 text-center">
                  {t('table.empty_state')}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        {!isLoading && totalPages > 0 && (
            <div className="flex items-center justify-end space-x-6 p-4 border-t">
                <div className="flex items-center space-x-2">
                    <p className="text-sm font-medium">{t('table.pagination.rows_per_page')}</p>
                    <Select
                        value={`${itemsPerPage}`}
                        onValueChange={onItemsPerPageChange}
                    >
                        <SelectTrigger className="h-8 w-[70px]">
                            <SelectValue placeholder={`${itemsPerPage}`} />
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
                    <Button variant="outline" size="sm" onClick={onPreviousPage} disabled={currentPage === 1}>{t('table.pagination.previous_button')}</Button>
                    <Button variant="outline" size="sm" onClick={onNextPage} disabled={currentPage >= totalPages}>{t('table.pagination.next_button')}</Button>
                </div>
            </div>
        )}
      </div>
    </div>
  );
}
