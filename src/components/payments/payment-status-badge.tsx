
"use client";

import { Badge } from "@/components/ui/badge";
import { Icons } from "@/components/icons"; 
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

export type PaymentStatusType = "Paid" | "Pending" | "Refunded" | "Failed" | "Overdue" | "Draft" | "Partial";

interface PaymentStatusBadgeProps {
  status: PaymentStatusType;
  className?: string;
}

export default function PaymentStatusBadge({ status, className }: PaymentStatusBadgeProps) {
  const { t } = useTranslation('status/status_content');
  let badgeVariant: "default" | "secondary" | "outline" | "destructive" = "default";
  let IconComponent = null;
  let specificColorClass = ""; // For more granular control beyond variants

  switch (status) {
    case "Paid":
      badgeVariant = "default";
      IconComponent = Icons.CheckCircle2;
      specificColorClass = "bg-green-100 text-green-700 border-green-300";
      break;
    case "Pending":
      badgeVariant = "outline";
      IconComponent = Icons.Hourglass;
      specificColorClass = "border-yellow-500 text-yellow-700";
      break;
    case "Refunded":
      badgeVariant = "secondary";
      IconComponent = Icons.Undo2;
      specificColorClass = "bg-gray-500 hover:bg-gray-600 text-white";
      break;
    case "Failed":
      badgeVariant = "destructive";
      IconComponent = Icons.XCircle;
      break;
    case "Overdue":
      badgeVariant = "destructive";
      IconComponent = Icons.AlertCircle; 
      specificColorClass = "bg-orange-500 hover:bg-orange-600 text-white border-orange-500";
      break;
    case "Draft":
      badgeVariant = "outline";
      IconComponent = Icons.Edit; 
      specificColorClass = "border-blue-400 text-blue-600";
      break;
    case "Partial":
      badgeVariant = "outline";
      IconComponent = Icons.PieChart;
      specificColorClass = "border-blue-500 text-blue-700";
      break;
    default:
      IconComponent = Icons.HelpCircle; 
      specificColorClass = "bg-muted text-muted-foreground";
      badgeVariant = "outline";
      break;
  }

  const translationKey = `payment.${status.toLowerCase()}`;
  const displayStatus = t(translationKey, { defaultValue: status });

  return (
    <Badge variant={badgeVariant} className={cn("capitalize text-xs whitespace-nowrap py-1 px-2", specificColorClass, className)}>
      {IconComponent && <IconComponent className="mr-1.5 h-3.5 w-3.5" />}
      {displayStatus}
    </Badge>
  );
}
