

"use client";

import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import ReservationStatusBadge from "./reservation-status-badge";
import type { Reservation } from '@/components/calendar/types';
import { Icons } from "@/components/icons";
import { format } from 'date-fns';
import { toDate } from '@/lib/dateUtils';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge'; // Added for payment status

interface ReservationCardProps {
  reservation: Reservation;
  propertyCurrency?: string;
  onEdit?: (reservation: Reservation) => void;
  onDelete?: (reservationId: string) => void;
  onViewDetails?: (reservation: Reservation) => void;
  currentPropertyId?: string | null; 
  canManage?: boolean;
}

export default function ReservationCard({
  reservation,
  propertyCurrency = "$",
  onEdit,
  onDelete,
  onViewDetails,
  currentPropertyId,
  canManage,
}: ReservationCardProps) {
  
  const displayCurrency = propertyCurrency || "$";
  const checkInDisplay = format(toDate(reservation.startDate) as Date, "dd/MM/yyyy");
  const checkOutDisplay = format(toDate(reservation.endDate) as Date, "dd/MM/yyyy");

  const paymentStatusDisplay = reservation.paymentStatus || "Pending";

  return (
    <Card className="shadow-md hover:shadow-lg transition-shadow duration-200 w-full">
      <CardContent className="p-4 space-y-3">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-lg font-semibold text-foreground">{reservation.guestName || "N/A"}</h3>
            <p className="text-xs text-muted-foreground">
              Booking ID: {reservation.reservationNumber || reservation.id.substring(0, 8)}...
            </p>
          </div>
          <ReservationStatusBadge status={reservation.status} />
        </div>

        <div className="flex flex-wrap items-start gap-x-6 gap-y-3 text-sm pt-2">
          <div className="flex items-start">
            <Icons.BedDouble className="h-4 w-4 mr-2 mt-0.5 text-muted-foreground flex-shrink-0" />
            <div>
              <p className="font-medium text-foreground">Room</p>
              <p className="text-muted-foreground truncate" title={`${reservation.roomName || "N/A"} (${reservation.roomTypeName || "N/A"})`}>
                {reservation.roomName || "N/A"} ({reservation.roomTypeName || "N/A"})
              </p>
            </div>
          </div>
          <div className="flex items-start">
            <Icons.CalendarDays className="h-4 w-4 mr-2 mt-0.5 text-muted-foreground flex-shrink-0" />
            <div>
              <p className="font-medium text-foreground">Check-in</p>
              <p className="text-muted-foreground">
                {checkInDisplay}
              </p>
            </div>
          </div>
          <div className="flex items-start">
            <Icons.CalendarDays className="h-4 w-4 mr-2 mt-0.5 text-muted-foreground flex-shrink-0" />
            <div>
              <p className="font-medium text-foreground">Check-out</p>
               <p className="text-muted-foreground">
                {checkOutDisplay}
              </p>
            </div>
          </div>
          <div className="flex items-start">
            <Icons.CreditCard className="h-4 w-4 mr-2 mt-0.5 text-muted-foreground flex-shrink-0" />
            <div>
              <p className="font-medium text-foreground">Payment</p>
              <Badge 
                variant={paymentStatusDisplay === "Paid" ? "default" : "outline"}
                className={cn(
                    "capitalize text-xs",
                    paymentStatusDisplay === "Paid" ? "bg-green-100 text-green-700 border-green-300" : 
                    paymentStatusDisplay === "Pending" ? "border-yellow-500 text-yellow-700" :
                    paymentStatusDisplay === "Partial" ? "border-blue-500 text-blue-700" : ""
                )}
                >
                {paymentStatusDisplay}
              </Badge>
            </div>
          </div>
          <div className="flex items-start">
            <Icons.User className="h-4 w-4 mr-2 mt-0.5 text-muted-foreground flex-shrink-0" />
            <div>
              <p className="font-medium text-foreground">Guests</p>
              <p className="text-muted-foreground">
                {Number(reservation.adults || 0) + Number(reservation.children || 0)}
              </p>
            </div>
          </div>
          <div className="flex items-start">
            <Icons.Mail className="h-4 w-4 mr-2 mt-0.5 text-muted-foreground flex-shrink-0" />
            <div>
              <p className="font-medium text-foreground">Email</p>
              <p className="text-muted-foreground truncate" title={reservation.guestEmail || "N/A"}>
                {reservation.guestEmail || "N/A"}
              </p>
            </div>
          </div>
          <div className="flex items-start">
            <Icons.Phone className="h-4 w-4 mr-2 mt-0.5 text-muted-foreground flex-shrink-0" />
            <div>
              <p className="font-medium text-foreground">Phone</p>
              <p className="text-muted-foreground">{reservation.guestPhone || "N/A"}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-end pt-3 mt-2 border-t border-border/50">
          <div className="mb-2 sm:mb-0">
            <p className="text-xl font-bold text-green-600">
              {displayCurrency}{(reservation.totalPrice || 0).toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground">
              Booked: {reservation.createdAt ? format(toDate(reservation.createdAt) as Date, "dd/MM/yyyy HH:mm") : "N/A"}
            </p>
          </div>
          <div className="flex gap-1.5 flex-wrap sm:flex-nowrap w-full sm:w-auto justify-end">
            {onViewDetails && (
                <Button
                    size="icon"
                    variant="outline"
                    onClick={() => onViewDetails(reservation)}
                    className="flex-grow-0"
                    title="View Details"
                  >
                    <Icons.Eye className="h-4 w-4" />
                    <span className="sr-only">View Details</span>
                  </Button>
            )}
            {onEdit && canManage && (
                 <Button
                    size="icon"
                    variant="outline"
                    onClick={() => onEdit(reservation)}
                    className="flex-grow-0"
                    title="Edit Reservation"
                  >
                    <Icons.Edit className="h-4 w-4" />
                    <span className="sr-only">Edit Reservation</span>
                  </Button>
            )}
            {onDelete && canManage && (
              <Button
                size="icon"
                variant="outline" 
                className="text-destructive border-destructive hover:bg-destructive/10 hover:text-destructive flex-grow-0"
                onClick={() => onDelete(reservation.id)}
                title="Delete Reservation"
              >
                <Icons.Trash className="h-4 w-4" />
                <span className="sr-only">Delete Reservation</span>
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
