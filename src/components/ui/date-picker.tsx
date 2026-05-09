"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addDays,
  setMonth as dfSetMonth,
  setYear as dfSetYear,
  getYear,
  getMonth,
  isToday,
  startOfToday,
} from "date-fns";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  X,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DatePickerProps {
  value?: Date;
  onChange?: (date: Date) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  dateFormat?: string;
  id?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTH_ABBRS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

const PRESETS: Array<{ label: string; getValue: () => Date }> = [
  { label: "Today", getValue: () => startOfToday() },
  { label: "Next Week", getValue: () => addDays(startOfToday(), 7) },
  { label: "In 30 Days", getValue: () => addDays(startOfToday(), 30) },
  { label: "This Month", getValue: () => startOfMonth(startOfToday()) },
  { label: "Next Month", getValue: () => startOfMonth(addMonths(startOfToday(), 1)) },
];

// ─── Single-month CalendarPanel ───────────────────────────────────────────────

interface CalendarPanelProps {
  month: Date;
  onMonthChange: (m: Date) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  selected: Date | null;
  onDayClick: (d: Date) => void;
}

function CalendarPanel({
  month,
  onMonthChange,
  onPrevMonth,
  onNextMonth,
  selected,
  onDayClick,
}: CalendarPanelProps) {
  const [overlay, setOverlay] = useState<"month" | "year" | null>(null);
  const [decadeStart, setDecadeStart] = useState(getYear(month) - 4);

  const currentYear = getYear(month);
  const currentMonthIdx = getMonth(month);

  const gridStart = startOfWeek(startOfMonth(month), { weekStartsOn: 0 });
  const gridEnd = endOfWeek(endOfMonth(month), { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  return (
    <div className="w-[252px] select-none">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={onPrevMonth}
          aria-label="Previous month"
          className="p-1.5 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors active:scale-90"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => setOverlay((o) => (o === "month" ? null : "month"))}
            className={cn(
              "flex items-center gap-0.5 px-2 py-1 rounded-md text-sm font-semibold hover:bg-accent transition-colors active:scale-[0.97]",
              overlay === "month" && "bg-accent"
            )}
          >
            {MONTH_NAMES[currentMonthIdx]}
            <ChevronDown className="h-3 w-3 opacity-50" />
          </button>
          <button
            type="button"
            onClick={() => setOverlay((o) => (o === "year" ? null : "year"))}
            className={cn(
              "flex items-center gap-0.5 px-2 py-1 rounded-md text-sm font-semibold hover:bg-accent transition-colors active:scale-[0.97]",
              overlay === "year" && "bg-accent"
            )}
          >
            {currentYear}
            <ChevronDown className="h-3 w-3 opacity-50" />
          </button>
        </div>

        <button
          type="button"
          onClick={onNextMonth}
          aria-label="Next month"
          className="p-1.5 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors active:scale-90"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Month overlay */}
      {overlay === "month" && (
        <div className="grid grid-cols-3 gap-1.5 py-1 animate-in fade-in-0 zoom-in-95 duration-100">
          {MONTH_ABBRS.map((m, idx) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                onMonthChange(startOfMonth(dfSetMonth(month, idx)));
                setOverlay(null);
              }}
              className={cn(
                "py-2.5 rounded-lg text-sm transition-all hover:bg-accent active:scale-[0.97]",
                idx === currentMonthIdx
                  ? "bg-primary text-primary-foreground font-semibold hover:bg-primary/90"
                  : "text-foreground"
              )}
            >
              {m}
            </button>
          ))}
        </div>
      )}

      {/* Year overlay */}
      {overlay === "year" && (
        <div className="animate-in fade-in-0 zoom-in-95 duration-100">
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={() => setDecadeStart((d) => d - 12)}
              className="p-1.5 rounded-md hover:bg-accent transition-colors active:scale-90"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="text-xs text-muted-foreground">
              {decadeStart} – {decadeStart + 11}
            </span>
            <button
              type="button"
              onClick={() => setDecadeStart((d) => d + 12)}
              className="p-1.5 rounded-md hover:bg-accent transition-colors active:scale-90"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {Array.from({ length: 12 }, (_, i) => decadeStart + i).map((year) => (
              <button
                key={year}
                type="button"
                onClick={() => {
                  onMonthChange(startOfMonth(dfSetYear(month, year)));
                  setOverlay(null);
                }}
                className={cn(
                  "py-2 rounded-lg text-sm transition-all hover:bg-accent active:scale-[0.97]",
                  year === currentYear
                    ? "bg-primary text-primary-foreground font-semibold hover:bg-primary/90"
                    : "text-foreground"
                )}
              >
                {year}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Calendar grid */}
      {!overlay && (
        <>
          <div className="grid grid-cols-7 mb-1">
            {DAY_LABELS.map((d) => (
              <div
                key={d}
                className="flex items-center justify-center h-8 text-xs font-medium text-muted-foreground"
              >
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((day, idx) => {
              const inCurrentMonth = isSameMonth(day, month);
              const isSelected = selected != null && isSameDay(day, selected);
              const isTodayDay = isToday(day);

              return (
                <div
                  key={idx}
                  className="relative flex items-center justify-center h-8"
                >
                  <button
                    type="button"
                    onClick={() => inCurrentMonth && onDayClick(day)}
                    className={cn(
                      "relative z-10 flex items-center justify-center h-8 w-8 rounded-full text-sm transition-all duration-100",
                      !inCurrentMonth && "text-muted-foreground/25 cursor-default",
                      inCurrentMonth && !isSelected && "hover:bg-accent cursor-pointer",
                      isSelected && "bg-primary text-primary-foreground font-semibold shadow-sm cursor-pointer",
                      isTodayDay && !isSelected && "ring-1 ring-primary/60 ring-offset-0"
                    )}
                  >
                    {format(day, "d")}
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ─── DatePicker ───────────────────────────────────────────────────────────────

export function DatePicker({
  value,
  onChange,
  placeholder = "Pick date",
  disabled = false,
  className,
  dateFormat = "MMM dd, yyyy",
  id,
}: DatePickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState<Date | null>(value ?? null);
  const [month, setMonth] = useState<Date>(() =>
    startOfMonth(value ?? new Date())
  );

  // Sync draft when controlled value changes
  useEffect(() => {
    setDraft(value ?? null);
  }, [value]);

  // Close on click-outside
  useEffect(() => {
    if (!isOpen) return;
    const onMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen]);

  const handlePreset = (preset: (typeof PRESETS)[0]) => {
    const date = preset.getValue();
    setDraft(date);
    setMonth(startOfMonth(date));
    onChange?.(date);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDraft(null);
    onChange?.(undefined as any);
  };

  const displayText = value ? format(value, dateFormat) : null;

  return (
    <div ref={containerRef} className={cn("relative inline-block", className)}>
      {/* Trigger */}
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((o) => !o)}
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-md border border-input bg-background text-sm text-left",
          "hover:bg-accent/40 transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          isOpen && "ring-2 ring-ring ring-offset-2",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className={cn("truncate", !displayText && "text-muted-foreground")}>
          {displayText ?? placeholder}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200",
            isOpen && "rotate-180"
          )}
        />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          className={cn(
            "absolute z-50 top-full mt-1 right-0",
            "bg-background border border-border rounded-xl shadow-2xl",
            "animate-in fade-in-0 slide-in-from-top-2 duration-150"
          )}
        >
          <div className="flex">
            {/* Sidebar: Quick Ranges */}
            <div className="flex flex-col gap-0.5 w-[120px] shrink-0 border-r border-border p-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-1 mb-2">
                Quick Jump
              </p>
              {PRESETS.map((preset) => {
                const presetDate = preset.getValue();
                const isActive = draft != null && isSameDay(draft, presetDate);
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => handlePreset(preset)}
                    className={cn(
                      "w-full text-left px-2.5 py-2 rounded-lg text-sm transition-all duration-100",
                      "hover:bg-accent active:scale-[0.97]",
                      isActive && "bg-primary/10 text-primary font-medium"
                    )}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>

            {/* Calendar */}
            <div className="p-4">
              <CalendarPanel
                month={month}
                onMonthChange={(m) => setMonth(startOfMonth(m))}
                onPrevMonth={() => setMonth((m) => subMonths(m, 1))}
                onNextMonth={() => setMonth((m) => addMonths(m, 1))}
                selected={draft}
                onDayClick={(date) => {
                  setDraft(date);
                  onChange?.(date);
                  setIsOpen(false);
                }}
              />
            </div>
          </div>


        </div>
      )}
    </div>
  );
}

export default DatePicker;

