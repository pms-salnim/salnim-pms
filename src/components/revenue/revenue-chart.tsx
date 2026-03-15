
"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Icons } from "@/components/icons";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { useTranslation } from 'react-i18next';

interface RevenueChartProps {
  chartData: any[];
  currency: string;
}

const chartConfig = {
  revenue: {
    label: "Revenue",
    color: "#003166",
  },
} satisfies ChartConfig;


export default function RevenueChart({ chartData, currency }: RevenueChartProps) {
  const { t } = useTranslation('pages/revenue/overview/content');

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div>
            <CardTitle>{t('chart.title')}</CardTitle>
            <CardDescription>
              {t('chart.description')}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {chartData.length > 0 ? (
          <ChartContainer config={chartConfig} className="h-[350px] w-full">
            <ResponsiveContainer>
              <AreaChart
                data={chartData}
                margin={{
                  top: 10,
                  right: 30,
                  left: 10,
                  bottom: 0,
                }}
              >
                 <defs>
                  <linearGradient id="fillRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor="var(--color-revenue)"
                      stopOpacity={0.3}
                    />
                    <stop
                      offset="95%"
                      stopColor="var(--color-revenue)"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={{ stroke: "hsl(var(--border))" }}
                  tickMargin={10}
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={5}
                  tickFormatter={(value) => `${currency || '$'}${value}`}
                  domain={[0, 'auto']}
                />
                <ChartTooltip
                  cursor={{ stroke: "hsl(var(--primary))", strokeDasharray: "5 5" }}
                  content={
                    <ChartTooltipContent
                      labelFormatter={(label) => `${t('chart.tooltip_date_label')}: ${label}`}
                      formatter={(value) => `${currency || '$'}${typeof value === 'number' ? value.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) : value}`}
                      indicator="dot"
                    />
                  }
                />
                <Area
                  dataKey="revenue"
                  type="monotone"
                  fill="url(#fillRevenue)"
                  stroke="var(--color-revenue)"
                  strokeWidth={2}
                  dot={{
                    r: 4,
                    fill: "var(--color-revenue)",
                    strokeWidth: 0,
                  }}
                   activeDot={{
                    r: 7,
                    stroke: "hsl(var(--background))",
                    strokeWidth: 2,
                    fill: "var(--color-revenue)",
                  }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </ChartContainer>
        ) : (
          <div className="h-[350px] flex items-center justify-center bg-muted/30 rounded-md">
            <div className="text-center">
              <Icons.LineChart className="w-16 h-16 text-muted-foreground" data-ai-hint="line chart analytics" />
              <p className="text-muted-foreground">
                {t('chart.empty_state')}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
