
"use client";

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { Reservation } from './types';
import { Badge } from '@/components/ui/badge';

interface ReservationDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  reservation: Reservation | null;
}

export default function ReservationDetailModal({ isOpen, onClose, reservation }: ReservationDetailModalProps) {
  if (!reservation) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reservation Details</DialogTitle>
          <DialogDescription>
            Viewing details for reservation ID: {reservation.id}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <h3 className="font-semibold text-foreground">Guest Information</h3>
            <p>Name: <span className="text-muted-foreground">{reservation.guestName}</span></p>
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Booking Details</h3>
            <p>Room ID: <span className="text-muted-foreground">{reservation.roomId}</span></p>
            <p>Check-in: <span className="text-muted-foreground">{reservation.startDate.toLocaleDateString()}</span></p>
            <p>Check-out: <span className="text-muted-foreground">{reservation.endDate.toLocaleDateString()}</span></p>
            <div className="flex items-center">
              <span className="mr-1.5">Status:</span>
              <Badge variant={reservation.status === 'Confirmed' ? 'default' : reservation.status === 'Checked-in' ? 'default' : 'secondary'}
                     className={reservation.status === 'Checked-in' ? 'bg-green-500 text-white hover:bg-green-600' : reservation.status === 'Tentative' ? 'bg-yellow-500 text-white hover:bg-yellow-600' : ''}>
                {reservation.status}
              </Badge>
            </div>
          </div>
          {/* Add more details as needed */}
        </div>
        <DialogFooter className="sm:justify-end">
          <Button type="button" variant="outline" onClick={() => alert('Edit reservation (placeholder)')}>Edit</Button>
          <DialogClose asChild>
            <Button type="button" variant="secondary">Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
