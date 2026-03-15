
"use client";

import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useTranslation } from 'react-i18next';

interface RoomBreakdown {
  name: string;
  occupancy: number;
  adr: number;
  revenue: number;
}

interface RoomTypeBreakdown {
  roomTypeName: string;
  occupancy: number;
  adr: number;
  revenue: number;
  rooms: RoomBreakdown[];
}

interface RoomTypeBreakdownTableProps {
  data: RoomTypeBreakdown[];
  currency: string;
}

export default function RoomTypeBreakdownTable({ data, currency }: RoomTypeBreakdownTableProps) {
  const { t } = useTranslation('performance-report-pdf');

  const totalRevenue = React.useMemo(() => {
    return data.reduce((sum, group) => sum + group.revenue, 0);
  }, [data]);

  if (!data || data.length === 0) {
    return <p className="text-muted-foreground text-center col-span-full">{t('no_room_data')}</p>;
  }

  return (
    <div>
        <h3 className="text-xl font-bold mb-2">{t('room_breakdown_title')}</h3>
        <div className="rounded-md border">
            <Accordion type="single" collapsible className="w-full">
                {data.map((group) => (
                    <AccordionItem value={group.roomTypeName} key={group.roomTypeName}>
                        <AccordionTrigger className="px-4 hover:no-underline">
                            <div className="flex justify-between items-center w-full">
                                <span className="font-semibold text-lg">{group.roomTypeName}</span>
                                <div className="flex gap-4 text-right text-sm">
                                    <div>
                                        <p className="text-muted-foreground text-xs">{t('table_headers.occupancy')}</p>
                                        <p className="font-bold">{group.occupancy.toFixed(1)}%</p>
                                    </div>
                                    <div>
                                        <p className="text-muted-foreground text-xs">{t('table_headers.adr')}</p>
                                        <p className="font-bold">{currency}{group.adr.toFixed(2)}</p>
                                    </div>
                                    <div>
                                        <p className="text-muted-foreground text-xs">{t('table_headers.total_revenue')}</p>
                                        <p className="font-bold">{currency}{group.revenue.toFixed(2)}</p>
                                    </div>
                                </div>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent className="border-t">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="pl-8">{t('table_headers.room')}</TableHead>
                                        <TableHead className="text-right">{t('table_headers.occupancy')}</TableHead>
                                        <TableHead className="text-right">{t('table_headers.adr')}</TableHead>
                                        <TableHead className="text-right">{t('table_headers.total_revenue')}</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {group.rooms.map((room) => (
                                        <TableRow key={room.name}>
                                            <TableCell className="pl-8">{room.name}</TableCell>
                                            <TableCell className="text-right">{room.occupancy.toFixed(1)}%</TableCell>
                                            <TableCell className="text-right">{currency}{room.adr.toFixed(2)}</TableCell>
                                            <TableCell className="text-right">{currency}{room.revenue.toFixed(2)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </AccordionContent>
                    </AccordionItem>
                ))}
            </Accordion>
            <div className="flex justify-end items-center p-4 font-bold text-lg border-t bg-muted/50">
              <span className="mr-4">{t('table_headers.total_label')}:</span>
              <span>{currency}{totalRevenue.toFixed(2)}</span>
            </div>
        </div>
    </div>
  );
}
