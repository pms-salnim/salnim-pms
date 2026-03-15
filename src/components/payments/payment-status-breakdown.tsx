"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface PaymentStatusBreakdownProps {
  data: {
    paid: { count: number; amount: number };
    pending: { count: number; amount: number };
    failed: { count: number; amount: number };
  };
  currencySymbol: string;
}

export function PaymentStatusBreakdown({ data, currencySymbol }: PaymentStatusBreakdownProps) {
  const statusCards = [
    {
      title: "Paid Payments",
      count: data.paid.count,
      amount: data.paid.amount,
      variant: "default" as const,
      color: "bg-green-50 dark:bg-green-950 border-l-4 border-green-500",
    },
    {
      title: "Pending Payments",
      count: data.pending.count,
      amount: data.pending.amount,
      variant: "secondary" as const,
      color: "bg-blue-50 dark:bg-blue-950 border-l-4 border-blue-500",
    },
    {
      title: "Failed/Refunded",
      count: data.failed.count,
      amount: data.failed.amount,
      variant: "destructive" as const,
      color: "bg-red-50 dark:bg-red-950 border-l-4 border-red-500",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {statusCards.map((card, index) => (
        <Card key={index} className={card.color}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-foreground">
              {card.title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Count:</span>
                <Badge variant={card.variant} className="text-lg px-3 py-1">
                  {card.count}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Amount:</span>
                <span className="text-lg font-bold">
                  {currencySymbol}{card.amount.toFixed(2)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
