"use client";

import React from 'react';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Edit, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { Icons } from "@/components/icons";
import type { RoomType } from '@/types/roomType';
import type { Property } from '@/types/property';
import { useAuth } from '@/contexts/auth-context';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { BaseRate } from '@/app/(app)/property-settings/rates-discounts/base-rates/page';

interface BaseRateListProps {
  baseRates: BaseRate[];
  roomTypes: RoomType[];
  onEditBaseRate: (baseRate: BaseRate) => void;
  onDeleteBaseRate: (baseRate: BaseRate) => void;
  isLoading: boolean;
  propertySettings: Property | null;
  canManage?: boolean;
}

export default function BaseRateList({
  baseRates,
  roomTypes,
  onEditBaseRate,
  onDeleteBaseRate,
  isLoading,
  propertySettings,
  canManage,
}: BaseRateListProps) {
  const { property } = useAuth();
  const currencySymbol = property?.currency || '$';
  const [expandedRoomTypes, setExpandedRoomTypes] = React.useState<Set<string>>(
    new Set(roomTypes.map(rt => rt.id))
  );

  const toggleRoomType = (roomTypeId: string) => {
    setExpandedRoomTypes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(roomTypeId)) {
        newSet.delete(roomTypeId);
      } else {
        newSet.add(roomTypeId);
      }
      return newSet;
    });
  };

  const baseRatesByRoomType = React.useMemo(() => {
    const grouped = new Map<string, BaseRate[]>();

    baseRates.forEach(rate => {
      if (!grouped.has(rate.room_type_id)) {
        grouped.set(rate.room_type_id, []);
      }
      grouped.get(rate.room_type_id)?.push(rate);
    });

    return grouped;
  }, [baseRates]);

  const getRoomTypeName = (roomTypeId: string): string => {
    return roomTypes.find(rt => rt.id === roomTypeId)?.name || "Unknown Type";
  };

  const getStatus = (rate: BaseRate): { text: string; className: string } => {
    if (!rate.is_active) {
      return { text: 'Inactive', className: 'bg-gray-100 text-gray-700 border-gray-300' };
    }

    const now = new Date();
    const startDate = new Date(rate.start_date);
    const endDate = rate.end_date ? new Date(rate.end_date) : null;

    if (now >= startDate && (!endDate || now <= endDate)) {
      return { text: 'Active', className: 'bg-green-100 text-green-700 border-green-300' };
    }

    if (now < startDate) {
      return { text: 'Upcoming', className: 'bg-blue-100 text-blue-700 border-blue-300' };
    }

    return { text: 'Expired', className: 'bg-red-100 text-red-700 border-red-300' };
  };

  return (
    <div className="space-y-4">
      {isLoading && (
        <div className="rounded-md border shadow-sm bg-card p-12 text-center">
          <Icons.Spinner className="mx-auto h-8 w-8 animate-spin" />
        </div>
      )}

      {!isLoading && baseRates.length === 0 && (
        <div className="rounded-md border shadow-sm bg-card p-12 text-center text-muted-foreground">
          No base rates created yet. Create one to get started.
        </div>
      )}

      {!isLoading &&
        roomTypes.map(roomType => {
          const rates = baseRatesByRoomType.get(roomType.id) || [];
          if (rates.length === 0) return null;

          const isExpanded = expandedRoomTypes.has(roomType.id);

          return (
            <Card key={roomType.id} className="overflow-hidden">
              <CardHeader
                className="cursor-pointer hover:bg-muted/50 transition-colors border-b"
                onClick={() => toggleRoomType(roomType.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {isExpanded ? (
                      <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    )}
                    <CardTitle className="text-xl">{roomType.name}</CardTitle>
                    <Badge variant="outline" className="ml-2">
                      {rates.length} {rates.length === 1 ? 'rate' : 'rates'}
                    </Badge>
                  </div>
                </div>
              </CardHeader>

              {isExpanded && (
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Price</TableHead>
                        <TableHead>Start Date</TableHead>
                        <TableHead>End Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rates.map(rate => {
                        const status = getStatus(rate);
                        const startDate = format(
                          new Date(rate.start_date),
                          'PP'
                        );
                        const endDate = rate.end_date
                          ? format(new Date(rate.end_date), 'PP')
                          : 'Open-ended';

                        return (
                          <TableRow key={rate.id}>
                            <TableCell className="font-medium">
                              {currencySymbol}
                              {rate.base_price.toFixed(2)}
                            </TableCell>
                            <TableCell>{startDate}</TableCell>
                            <TableCell>{endDate}</TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={status.className}
                              >
                                {status.text}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              {canManage && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      className="h-8 w-8 p-0"
                                    >
                                      <span className="sr-only">
                                        Open menu
                                      </span>
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem
                                      onClick={() =>
                                        onEditBaseRate(rate)
                                      }
                                    >
                                      <Edit className="mr-2 h-4 w-4" />
                                      <span>Edit</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      className="text-destructive hover:!text-destructive-foreground focus:!text-destructive-foreground"
                                      onClick={() =>
                                        onDeleteBaseRate(rate)
                                      }
                                    >
                                      <Trash2 className="mr-2 h-4 w-4" />
                                      <span>Delete</span>
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              )}
            </Card>
          );
        })}
    </div>
  );
}
