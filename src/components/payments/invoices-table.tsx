

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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { MoreHorizontal, Edit, Trash2 } from "lucide-react";
import { generateInvoicePdf } from "@/lib/pdfGenerator";
import type { Invoice } from "@/app/(app)/payments/page";
import { parseISO, format } from "date-fns";
import type { Property } from '@/types/property';
import { db, app } from '@/lib/firebase';
import { doc, getDoc, type Timestamp, query, collection, where, limit, getDocs } from 'firebase/firestore';
import type { Reservation } from '@/components/calendar/types';
import { toast } from '@/hooks/use-toast';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useTranslation } from 'react-i18next';


interface InvoicesTableProps {
  invoices: Invoice[];
  isLoading: boolean;
  onViewInvoice: (invoice: Invoice) => void;
  onEditInvoice: (invoice: Invoice) => void;
  onDeleteInvoice: (invoiceId: string) => void;
  // Pagination
  currentPage: number;
  totalPages: number;
  itemsPerPage: number;
  onNextPage: () => void;
  onPreviousPage: () => void;
  onItemsPerPageChange: (value: string) => void;
  // Sorting
  sortBy: string;
  sortDirection: 'asc' | 'desc';
  onSortChange: (value: string) => void;
  // Filtering
  filterStatus: string | null;
  filterSearch: string;
  onFilterChange: (filterType: 'status' | 'search', value: string | null) => void;
  propertySettings: Property | null;
  // Bulk actions
  onBulkDelete: (invoiceIds: string[]) => void;
  onBulkStatusChange: (invoiceIds: string[], status: Invoice['paymentStatus']) => void;
  canManage?: boolean;
}

export default function InvoicesTable({ 
    invoices, 
    isLoading, 
    onViewInvoice, 
    onEditInvoice, 
    onDeleteInvoice, 
    currentPage, 
    totalPages,
    itemsPerPage,
    onNextPage, 
    onPreviousPage,
    onItemsPerPageChange,
    sortBy, 
    sortDirection, 
    onSortChange, 
    filterStatus, 
    filterSearch, 
    onFilterChange, 
    propertySettings,
    onBulkDelete,
    onBulkStatusChange,
    canManage
}: InvoicesTableProps) {
  
  const [selectedRowIds, setSelectedRowIds] = React.useState<Set<string>>(new Set());
  const [isProcessingEmail, setIsProcessingEmail] = React.useState<string | null>(null);
  const [isProcessingPdf, setIsProcessingPdf] = React.useState<string | null>(null);
  const { t } = useTranslation('pages/payments/invoices/content');

  React.useEffect(() => {
    setSelectedRowIds(new Set());
  }, [invoices]);
  
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = new Set(invoices.map(r => r.id));
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
  const isAllSelectedOnPage = numSelected > 0 && numSelected === invoices.length;

   const handleDownloadPdf = async (invoice: Invoice) => {
    if (!propertySettings) return;
    setIsProcessingPdf(invoice.id);
    try {
        let reservationData: Reservation | null = null;
        if (invoice.reservationId) {
            const resDocRef = doc(db, "reservations", invoice.reservationId);
            const resDocSnap = await getDoc(resDocRef);
            if (resDocSnap.exists()) {
                const data = resDocSnap.data();
                reservationData = {
                    id: resDocSnap.id,
                    ...data,
                    startDate: (data.startDate as Timestamp).toDate(),
                    endDate: (data.endDate as Timestamp).toDate(),
                } as Reservation;
            }
        }
        
        const pdf = await generateInvoicePdf(invoice, propertySettings, reservationData);
        pdf.save(`invoice-${invoice.invoiceNumber}.pdf`);
    } catch (error) {
        console.error("Error generating PDF:", error);
        toast({title: "Error", description: "Could not generate invoice PDF.", variant: "destructive"});
    } finally {
      setIsProcessingPdf(null);
    }
  };
  
  const handleSendEmail = async (invoice: Invoice) => {
    if (!invoice || !propertySettings) {
      toast({ title: t('toasts.error_title'), description: t('toasts.send_email_missing_data'), variant: "destructive" });
      return;
    }
    
    setIsProcessingEmail(invoice.id);

    let recipientEmail = '';
    let reservationData: Reservation | null = null;

    try {
        if (invoice.reservationId) {
            const resDocSnap = await getDoc(doc(db, 'reservations', invoice.reservationId));
            if (resDocSnap.exists()) {
                const data = resDocSnap.data();
                reservationData = { ...data, id: resDocSnap.id, startDate: (data.startDate as Timestamp).toDate(), endDate: (data.endDate as Timestamp).toDate() } as Reservation;
            }
        }

        if (reservationData?.guestEmail) {
            recipientEmail = reservationData.guestEmail;
        } else if (invoice.guestId) {
            const guestDocSnap = await getDoc(doc(db, 'guests', invoice.guestId));
            if (guestDocSnap.exists() && guestDocSnap.data().email) {
                recipientEmail = guestDocSnap.data().email;
            }
        }

        if (!recipientEmail) {
            throw new Error(t('toasts.guest_email_not_found'));
        }
      
        const pdf = await generateInvoicePdf(invoice, propertySettings, reservationData);
        const pdfDataUri = pdf.output('datauristring');
        
        const functions = getFunctions(app, 'europe-west1');
        const sendInvoiceByEmail = httpsCallable(functions, 'sendInvoiceByEmail');
        
        const result: any = await sendInvoiceByEmail({
            propertyId: propertySettings.id,
            invoice,
            recipientEmail,
            pdfDataUri,
        });

        if (result.data.success) {
          toast({
              title: "Email Sent",
              description: `Invoice has been successfully sent to ${recipientEmail}.`,
          });
        } else {
            throw new Error(result.data.message || 'An unknown error occurred while sending the email.');
        }

    } catch (error: any) {
        console.error("Error sending email:", error);
        toast({
            title: "Failed to Send Email",
            description: error.message || "An unexpected error occurred.",
            variant: "destructive",
        });
    } finally {
        setIsProcessingEmail(null);
    }
  };

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
                                    <DropdownMenuItem onClick={() => onBulkStatusChange(Array.from(selectedRowIds), 'Draft')}>{t('table.bulk_actions.mark_as_draft')}</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => onBulkStatusChange(Array.from(selectedRowIds), 'Pending')}>{t('table.bulk_actions.mark_as_pending')}</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => onBulkStatusChange(Array.from(selectedRowIds), 'Paid')}>{t('table.bulk_actions.mark_as_paid')}</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => onBulkStatusChange(Array.from(selectedRowIds), 'Overdue')}>{t('table.bulk_actions.mark_as_overdue')}</DropdownMenuItem>
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
                    <TableHead>{t('table.headers.invoice_no')}</TableHead>
                    <TableHead>{t('table.headers.date_issued')}</TableHead>
                    <TableHead>{t('table.headers.guest_company')}</TableHead>
                    <TableHead className="text-right">{t('table.headers.amount')}</TableHead>
                    <TableHead>{t('table.headers.status')}</TableHead>
                    <TableHead>{t('table.headers.due_date')}</TableHead>
                    <TableHead className="text-right">{t('table.headers.actions')}</TableHead>
                </TableRow>
                </TableHeader>
                <TableBody>
                {isLoading && (
                    <TableRow><TableCell colSpan={8} className="h-24 text-center"><Icons.Spinner className="mx-auto h-6 w-6 animate-spin" /></TableCell></TableRow>
                )}
                {!isLoading && invoices.map((invoice) => (
                    <TableRow key={invoice.id} data-state={selectedRowIds.has(invoice.id) && "selected"}>
                    <TableCell>
                        <Checkbox
                            checked={selectedRowIds.has(invoice.id)}
                            onCheckedChange={() => handleRowSelect(invoice.id)}
                            aria-label={t('table.select_row_aria_label', { name: invoice.guestOrCompany })}
                            disabled={!canManage}
                        />
                    </TableCell>
                    <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                    <TableCell>{format(parseISO(invoice.dateIssued), 'PP')}</TableCell>
                    <TableCell>{invoice.guestOrCompany}</TableCell>
                    <TableCell className="text-right">{propertySettings?.currency || '$'}{invoice.amount.toFixed(2)}</TableCell>
                    <TableCell>
                        <PaymentStatusBadge status={invoice.paymentStatus} />
                    </TableCell>
                    <TableCell>{format(parseISO(invoice.dueDate), 'PP')}</TableCell>
                    <TableCell className="text-right">
                        <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onViewInvoice(invoice)}>
                            <Icons.Eye className="mr-2 h-4 w-4" /> {t('table.actions_menu.view')}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onEditInvoice(invoice)} disabled={!canManage}>
                            <Edit className="mr-2 h-4 w-4" /> {t('table.actions_menu.edit')}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDownloadPdf(invoice)} disabled={isProcessingPdf === invoice.id}>
                                {isProcessingPdf === invoice.id ? <Icons.Spinner className="mr-2 h-4 w-4 animate-spin"/> : <Icons.Download className="mr-2 h-4 w-4" />}
                                {t('table.actions_menu.download_pdf')}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleSendEmail(invoice)} disabled={isProcessingEmail === invoice.id}>
                                {isProcessingEmail === invoice.id ? <Icons.Spinner className="mr-2 h-4 w-4 animate-spin" /> : <Icons.Mail className="mr-2 h-4 w-4" />}
                                {t('table.actions_menu.send_email')}
                            </DropdownMenuItem>
                            {canManage && <DropdownMenuSeparator />}
                            <DropdownMenuItem 
                            className="text-destructive hover:!text-destructive-foreground focus:!text-destructive-foreground"
                            onClick={() => onDeleteInvoice(invoice.id)}
                            disabled={!canManage}
                            >
                            <Trash2 className="mr-2 h-4 w-4" /> {t('table.actions_menu.delete')}
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                        </DropdownMenu>
                    </TableCell>
                    </TableRow>
                ))}
                {!isLoading && invoices.length === 0 && (
                    <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center">
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
