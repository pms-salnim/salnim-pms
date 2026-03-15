
"use client";

import React from 'react';
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar as CalendarIconPicker } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Icons } from "@/components/icons";
import { cn } from "@/lib/utils";
import { format, addDays, subDays } from "date-fns";

interface CalendarToolbarProps {
  currentDate: Date;
  setCurrentDate: (date: Date) => void;
  viewMode: 7 | 14 | 30;
  setViewMode: (mode: 7 | 14 | 30) => void;
  onRoomTypeFilterChange: (type: string) => void;
  onRoomStatusFilterChange: (status: string) => void;
}

export default function CalendarToolbar({
  currentDate,
  setCurrentDate,
  viewMode,
  setViewMode,
  onRoomTypeFilterChange,
  onRoomStatusFilterChange,
}: CalendarToolbarProps) {

  const handlePrevious = () => {
    setCurrentDate(subDays(currentDate, viewMode === 7 ? 7 : viewMode === 14 ? 7 : 15));
  };

  const handleNext = () => {
    setCurrentDate(addDays(currentDate, viewMode === 7 ? 7 : viewMode === 14 ? 7 : 15));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  return (
    <div className="flex flex-col gap-4 p-4 border rounded-lg shadow-sm bg-card">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2 md:gap-4">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button variant="outline" onClick={handleToday} className="flex-shrink-0">Today</Button>
          <Button variant="outline" size="icon" onClick={handlePrevious} className="flex-shrink-0">
            <Icons.DropdownArrow className="h-4 w-4 transform rotate-90" />
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={"outline"}
                className={cn(
                  "w-full sm:w-[180px] justify-start text-left font-normal",
                  !currentDate && "text-muted-foreground"
                )}
              >
                <Icons.CalendarDays className="mr-2 h-4 w-4 flex-shrink-0" />
                {currentDate ? format(currentDate, "MMM dd, yyyy") : <span>Pick a date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <CalendarIconPicker
                mode="single"
                selected={currentDate}
                onSelect={(date) => date && setCurrentDate(date)}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          <Button variant="outline" size="icon" onClick={handleNext} className="flex-shrink-0">
            <Icons.DropdownArrow className="h-4 w-4 transform -rotate-90" />
          </Button>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Select onValueChange={onRoomTypeFilterChange} defaultValue="all">
            <SelectTrigger className="w-full sm:w-[150px]">
              <SelectValue placeholder="Filter Room Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Room Types</SelectItem>
            </SelectContent>
          </Select>
          <Select onValueChange={onRoomStatusFilterChange} defaultValue="all">
            <SelectTrigger className="w-full sm:w-[150px]">
              <SelectValue placeholder="Filter Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="flex items-center gap-1 rounded-md bg-muted p-0.5 flex-shrink-0">
          {[7, 14, 30].map((days) => (
              <Button
                  key={days}
                  variant={viewMode === days ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode(days as 7 | 14 | 30)}
                  className={cn(
                      "px-3 py-1.5 h-auto text-xs",
                      viewMode === days ? "bg-primary text-primary-foreground shadow-sm" : "hover:bg-background/80"
                  )}
              >
                  {days} Days
              </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
