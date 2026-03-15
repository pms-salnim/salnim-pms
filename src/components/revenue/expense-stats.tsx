
"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Icons } from "@/components/icons";
import { useTranslation } from 'react-i18next';

interface ExpenseStatsProps {
  total: number;
  fixed: number;
  variable: number;
  currency: string;
}

export default function ExpenseStats({ total, fixed, variable, currency }: ExpenseStatsProps) {
  const { t } = useTranslation('pages/revenue/expenses');

  const stats = [
    { title: t('stats.total'), value: `${currency}${total.toFixed(2)}`, icon: Icons.DollarSign, dataAiHint: "total expenses" },
    { title: t('stats.fixed'), value: `${currency}${fixed.toFixed(2)}`, icon: Icons.DollarSign, dataAiHint: "fixed expenses" },
    { title: t('stats.variable'), value: `${currency}${variable.toFixed(2)}`, icon: Icons.DollarSign, dataAiHint: "variable expenses" },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {stats.map((stat, index) => {
        const IconComponent = stat.icon;
        return (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <IconComponent className="h-4 w-4 text-muted-foreground" data-ai-hint={stat.dataAiHint} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
