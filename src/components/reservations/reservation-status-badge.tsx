
"use client";

import { Badge } from "@/components/ui/badge";
import { Icons } from "@/components/icons"; 
import { cn } from "@/lib/utils";
import type { Reservation } from "@/components/calendar/types"; // Import the main Reservation type
import { useTranslation } from "react-i18next";

// Use the status types directly from the Reservation type
export type ReservationDisplayStatus = Reservation['status'];

interface ReservationStatusBadgeProps {
  status: ReservationDisplayStatus;
  className?: string;
}

export default function ReservationStatusBadge({ status, className }: ReservationStatusBadgeProps) {
  const { t } = useTranslation('status/status_content');
  let badgeVariant: "default" | "secondary" | "outline" | "destructive" = "default";
  let IconComponent = null;
  let specificColorClass = "";

  switch (status) {
    case "Pending":
      badgeVariant = "default";
      IconComponent = Icons.Hourglass; 
      specificColorClass = "bg-orange-100 text-orange-700 border border-orange-300";
      break;
    case "Confirmed":
      badgeVariant = "default";
      IconComponent = Icons.CalendarCheck;
      specificColorClass = "bg-green-100 text-green-700 border border-green-300";
      break;
    case "Canceled":
      badgeVariant = "destructive";
      IconComponent = Icons.XCircle;
      specificColorClass = "bg-red-100 text-red-700 border border-red-300";
      break;
    case "No-Show":
      badgeVariant = "default";
      IconComponent = Icons.XCircle;
      specificColorClass = "bg-amber-100 text-amber-700 border border-amber-300";
      break;
    case "Checked-in":
      badgeVariant = "default";
      IconComponent = Icons.LogIn;
      specificColorClass = "bg-blue-100 text-blue-700 border border-blue-300";
      break;
    case "Completed":
      badgeVariant = "secondary";
      IconComponent = Icons.CheckCircle2;
      break;
    default: // Fallback for any unexpected status
      IconComponent = Icons.HelpCircle; 
      specificColorClass = "bg-muted text-muted-foreground";
      badgeVariant = "outline";
      break;
  }

  const translationKey = `reservation.${status.toLowerCase().replace(/-/g, '_')}`;
  const displayStatus = t(translationKey, { defaultValue: status });

  return (
    <Badge variant={badgeVariant} className={cn("capitalize text-xs whitespace-nowrap py-1 px-2", specificColorClass, className)}>
      {IconComponent && <IconComponent className="mr-1 h-3.5 w-3.5" />}
      {displayStatus}
    </Badge>
  );
}
