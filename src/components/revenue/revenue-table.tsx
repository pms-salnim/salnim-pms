
"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Icons } from "@/components/icons";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import type { Reservation } from "@/components/calendar/types"; // Use Reservation type
import { format } from 'date-fns';
import { toDate } from '@/lib/dateUtils';
import ReservationStatusBadge from '@/components/reservations/reservation-status-badge'; // Re-use existing badge
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTranslation } from "react-i18next";

interface RevenueTableProps {
  data: Reservation[];
  currency: string;
  isLoading: boolean;
  currentPage: number;
  totalPages: number;
  onNextPage: () => void;
  onPrevPage: () => void;
  itemsPerPage: number;
  onItemsPerPageChange: (value: string) => void;
}

export default function RevenueTable({ 
  data, 
  currency, 
  isLoading,
  currentPage,
  totalPages,
  onNextPage,
  onPrevPage,
  itemsPerPage,
  onItemsPerPageChange
}: RevenueTableProps) {
  const { t } = useTranslation('pages/revenue/revenue-log/content');

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="rounded-md border-b">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('table.headers.booking_date')}</TableHead>
                <TableHead>{t('table.headers.guest_name')}</TableHead>
                <TableHead>{t('table.headers.room_type')}</TableHead>
                <TableHead>{t('table.headers.check_in')}</TableHead>
                <TableHead>{t('table.headers.check_out')}</TableHead>
                <TableHead className="text-right">{t('table.headers.amount')}</TableHead>
                <TableHead>{t('table.headers.status')}</TableHead>
                <TableHead>{t('table.headers.payment_status')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center">
                    <Icons.Spinner className="mx-auto h-6 w-6 animate-spin" />
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && data.map((reservation) => (
                <TableRow key={reservation.id}>
                  <TableCell className="font-medium">
                    {reservation.createdAt ? format(toDate(reservation.createdAt) as Date, "PP") : 'N/A'}
                  </TableCell>
                  <TableCell>{reservation.guestName || 'N/A'}</TableCell>
                  <TableCell>{reservation.roomTypeName || 'N/A'}</TableCell>
                  <TableCell>{format(toDate(reservation.startDate) as Date, "PP")}</TableCell>
                  <TableCell>{format(toDate(reservation.endDate) as Date, "PP")}</TableCell>
                  <TableCell className="text-right font-semibold">
                    {currency}{(reservation.totalPrice || 0).toFixed(2)}
                  </TableCell>
                  <TableCell>
                    <ReservationStatusBadge status={reservation.status} />
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant={reservation.paymentStatus === "Paid" ? "default" : "outline"}
                      className={reservation.paymentStatus === "Paid" ? "bg-green-100 text-green-700 border-green-300" : "border-yellow-500 text-yellow-700"}
                    >
                      {reservation.paymentStatus || "Pending"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {!isLoading && data.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center">
                    {t('table.empty_state')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
      {!isLoading && totalPages > 0 && (
        <CardFooter className="flex items-center justify-end space-x-6 p-4">
            <div className="flex items-center space-x-2">
                <p className="text-sm font-medium">{t('pagination.rows_per_page')}</p>
                <Select
                    value={`${itemsPerPage}`}
                    onValueChange={onItemsPerPageChange}
                >
                    <SelectTrigger className="h-8 w-[70px]">
                        <SelectValue placeholder={`${itemsPerPage}`} />
                    </SelectTrigger>
                    <SelectContent side="top">
                        {[10, 25, 50, 100].map((pageSize) => (
                            <SelectItem key={pageSize} value={`${pageSize}`}>
                                {pageSize}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <span className="text-sm text-muted-foreground">
                {t('pagination.page_of', { currentPage, totalPages })}
            </span>
            <div className="flex items-center space-x-2">
                <Button variant="outline" size="sm" onClick={onPrevPage} disabled={currentPage === 1}>{t('pagination.previous_button')}</Button>
                <Button variant="outline" size="sm" onClick={onNextPage} disabled={currentPage >= totalPages}>{t('pagination.next_button')}</Button>
            </div>
        </CardFooter>
      )}
    </Card>
  );
}
