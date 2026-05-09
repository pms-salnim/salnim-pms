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
  isWithinInterval,
  isBefore,
  differenceInDays,
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

export interface DateRange {
  startDate: Date | null;
  endDate: Date | null;
}

export interface DateRangePickerProps {
  /** Current selected range */
  value?: DateRange;
  /** Fired on Apply with the confirmed range */
  onChange?: (range: DateRange) => void;
  /** Placeholder when no dates are selected */
  placeholder?: string;
  /** Disables the picker */
  disabled?: boolean;
  /** Extra CSS classes on the trigger wrapper */
  className?: string;
  /** date-fns format string for display (default: "MMM dd, yyyy") */
  dateFormat?: string;
  /** HTML id for the trigger button */
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

const PRESETS: Array<{ label: string; getValue: () => DateRange }> = [
  {
    label: "Today",
    getValue: () => {
      const today = startOfToday();
      return { startDate: today, endDate: addDays(today, 1) };
    },
  },
  {
    label: "Next 7 Days",
    getValue: () => {
      const today = startOfToday();
      return { startDate: today, endDate: addDays(today, 7) };
    },
  },
  {
    label: "Next 30 Days",
    getValue: () => {
      const today = startOfToday();
      return { startDate: today, endDate: addDays(today, 30) };
    },
  },
  {
    label: "This Month",
    getValue: () => {
      const today = startOfToday();
      return { startDate: today, endDate: endOfMonth(today) };
    },
  },
  {
    label: "Next Month",
    getValue: () => {
      const next = addMonths(startOfToday(), 1);
      return { startDate: startOfMonth(next), endDate: endOfMonth(next) };
    },
  },
];

// ─── CalendarPanel ────────────────────────────────────────────────────────────

interface CalendarPanelProps {
  month: Date;
  onMonthChange: (m: Date) => void;
  showPrevNav: boolean;
  showNextNav: boolean;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  startDate: Date | null;
  endDate: Date | null;
  hoverDate: Date | null;
  onDayClick: (d: Date) => void;
  onDayHover: (d: Date | null) => void;
  rangeMin: Date | null;
  rangeMax: Date | null;
}

function CalendarPanel({
  month,
  onMonthChange,
  showPrevNav,
  showNextNav,
  onPrevMonth,
  onNextMonth,
  startDate,
  endDate,
  hoverDate,
  onDayClick,
  onDayHover,
  rangeMin,
  rangeMax,
}: CalendarPanelProps) {
  const [overlay, setOverlay] = useState<"month" | "year" | null>(null);
  const [decadeStart, setDecadeStart] = useState(getYear(month) - 4);

  const currentYear = getYear(month);
  const currentMonthIdx = getMonth(month);

  // Build the full calendar grid (may include days from adjacent months)
  const gridStart = startOfWeek(startOfMonth(month), { weekStartsOn: 0 });
  const gridEnd = endOfWeek(endOfMonth(month), { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const hasRange =
    rangeMin != null && rangeMax != null && !isSameDay(rangeMin, rangeMax);
  const isHoverMode = !endDate && hoverDate != null;

  return (
    <div className="w-[252px] select-none">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-3">
        {/* Prev arrow */}
        <button
          type="button"
          onClick={onPrevMonth}
          aria-label="Previous month"
          className={cn(
            "p-1.5 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors active:scale-90",
            !showPrevNav && "invisible pointer-events-none"
          )}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {/* Clickable Month + Year */}
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => setOverlay((o) => (o === "month" ? null : "month"))}
            className={cn(
              "flex items-center gap-0.5 px-2 py-1 rounded-md text-sm font-semibold",
              "hover:bg-accent transition-colors active:scale-[0.97]",
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
              "flex items-center gap-0.5 px-2 py-1 rounded-md text-sm font-semibold",
              "hover:bg-accent transition-colors active:scale-[0.97]",
              overlay === "year" && "bg-accent"
            )}
          >
            {currentYear}
            <ChevronDown className="h-3 w-3 opacity-50" />
          </button>
        </div>

        {/* Next arrow */}
        <button
          type="button"
          onClick={onNextMonth}
          aria-label="Next month"
          className={cn(
            "p-1.5 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors active:scale-90",
            !showNextNav && "invisible pointer-events-none"
          )}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* ── Month Overlay (3×4 grid) ── */}
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

      {/* ── Year Overlay (4×3 grid) ── */}
      {overlay === "year" && (
        <div className="animate-in fade-in-0 zoom-in-95 duration-100">
          {/* Decade navigation */}
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

      {/* ── Calendar Grid ── */}
      {!overlay && (
        <>
          {/* Day-of-week labels */}
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

          {/* Day cells */}
          <div className="grid grid-cols-7">
            {days.map((day, idx) => {
              const inCurrentMonth = isSameMonth(day, month);

              // Determine visual state
              const isStartDay = startDate != null && isSameDay(day, startDate);
              const isEndDay = endDate != null && isSameDay(day, endDate);
              const isPrimaryCircle = isStartDay || isEndDay;

              // Hover preview circle (no endDate yet, hovering a different day)
              const isHoverCircle =
                !endDate &&
                hoverDate != null &&
                startDate != null &&
                isSameDay(day, hoverDate) &&
                !isSameDay(day, startDate);

              // Range fill
              const isRangeLeftEdge =
                hasRange && rangeMin != null && isSameDay(day, rangeMin);
              const isRangeRightEdge =
                hasRange && rangeMax != null && isSameDay(day, rangeMax);
              const isInMiddle =
                hasRange &&
                rangeMin != null &&
                rangeMax != null &&
                isWithinInterval(day, { start: rangeMin, end: rangeMax }) &&
                !isSameDay(day, rangeMin) &&
                !isSameDay(day, rangeMax);

              const isTodayDay = isToday(day);

              // Strip opacity differs between confirmed range and hover preview
              const stripClass = isHoverMode
                ? "bg-primary/10"
                : "bg-primary/15";

              return (
                <div
                  key={idx}
                  className="relative flex items-center justify-center h-8"
                >
                  {/* ── Range fill strips (behind the circle) ── */}
                  {isInMiddle && (
                    <div className={cn("absolute inset-0", stripClass)} />
                  )}
                  {/* Half-strip on left-edge (right half only) */}
                  {isRangeLeftEdge && (
                    <div
                      className={cn(
                        "absolute inset-y-0 left-1/2 right-0",
                        stripClass
                      )}
                    />
                  )}
                  {/* Half-strip on right-edge (left half only) */}
                  {isRangeRightEdge && (
                    <div
                      className={cn(
                        "absolute inset-y-0 left-0 right-1/2",
                        stripClass
                      )}
                    />
                  )}

                  {/* ── Day button ── */}
                  <button
                    type="button"
                    onClick={() => inCurrentMonth && onDayClick(day)}
                    onMouseEnter={() => inCurrentMonth && onDayHover(day)}
                    className={cn(
                      "relative z-10 flex items-center justify-center h-8 w-8 rounded-full text-sm",
                      "transition-all duration-100",
                      // Outside current month – ghost style
                      !inCurrentMonth && "text-muted-foreground/25 cursor-default",
                      // Normal hoverable day
                      inCurrentMonth &&
                        !isPrimaryCircle &&
                        !isHoverCircle &&
                        "hover:bg-accent cursor-pointer",
                      // Confirmed selected (start or end)
                      isPrimaryCircle &&
                        "bg-primary text-primary-foreground font-semibold shadow-sm cursor-pointer",
                      // Hover preview circle
                      isHoverCircle &&
                        "bg-primary/50 text-primary-foreground cursor-pointer",
                      // Today marker (ring, unless selected)
                      isTodayDay &&
                        !isPrimaryCircle &&
                        !isHoverCircle &&
                        "ring-1 ring-primary/60 ring-offset-0",
                      // In-range hover
                      isInMiddle && !isPrimaryCircle && "hover:bg-primary/25"
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

// ─── DateRangePicker ──────────────────────────────────────────────────────────

export function DateRangePicker({
  value,
  onChange,
  placeholder = "Check-in — Check-out",
  disabled = false,
  className,
  dateFormat = "MMM dd, yyyy",
  id,
}: DateRangePickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  // Draft state (committed only on Apply)
  const [startDate, setStartDate] = useState<Date | null>(
    value?.startDate ?? null
  );
  const [endDate, setEndDate] = useState<Date | null>(value?.endDate ?? null);
  const [hoverDate, setHoverDate] = useState<Date | null>(null);

  // Left panel month; right panel is always leftMonth + 1
  const [leftMonth, setLeftMonth] = useState<Date>(() =>
    startOfMonth(value?.startDate ?? new Date())
  );
  const rightMonth = addMonths(leftMonth, 1);

  // Keep draft in sync when controlled value changes externally
  useEffect(() => {
    setStartDate(value?.startDate ?? null);
    setEndDate(value?.endDate ?? null);
  }, [value?.startDate, value?.endDate]);

  // Close on click-outside
  useEffect(() => {
    if (!isOpen) return;
    const onMouseDown = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
        setHoverDate(null);
      }
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
        setHoverDate(null);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen]);

  // ── Day click: elastic range logic ──
  const handleDayClick = (date: Date) => {
    if (!startDate || endDate) {
      // Fresh selection
      setStartDate(date);
      setEndDate(null);
    } else if (isSameDay(date, startDate)) {
      // Single-day range
      setEndDate(date);
    } else if (isBefore(date, startDate)) {
      // Before start → elastic reset
      setStartDate(date);
      setEndDate(null);
    } else {
      // After start → confirm end
      setEndDate(date);
      setHoverDate(null);
    }
  };

  // ── Effective range for highlighting (includes hover preview) ──
  const effectiveEnd =
    endDate ?? (startDate && hoverDate ? hoverDate : null);

  const rangeMin =
    startDate && effectiveEnd
      ? isBefore(startDate, effectiveEnd)
        ? startDate
        : effectiveEnd
      : null;

  const rangeMax =
    startDate && effectiveEnd
      ? isBefore(startDate, effectiveEnd)
        ? effectiveEnd
        : startDate
      : null;

  // ── Nights count ──
  const nightsCount =
    startDate && endDate
      ? Math.abs(differenceInDays(endDate, startDate))
      : 0;

  // ── Preset helpers ──
  const handlePreset = (preset: (typeof PRESETS)[0]) => {
    const range = preset.getValue();
    setStartDate(range.startDate);
    setEndDate(range.endDate);
    if (range.startDate) setLeftMonth(startOfMonth(range.startDate));
    setHoverDate(null);
  };

  const isPresetActive = (preset: (typeof PRESETS)[0]) => {
    const range = preset.getValue();
    return (
      startDate != null &&
      endDate != null &&
      range.startDate != null &&
      range.endDate != null &&
      isSameDay(startDate, range.startDate) &&
      isSameDay(endDate, range.endDate)
    );
  };

  // ── Apply / Cancel / Clear ──
  const handleApply = () => {
    onChange?.({ startDate, endDate });
    setIsOpen(false);
    setHoverDate(null);
  };

  const handleCancel = () => {
    // Revert draft to last committed value
    setStartDate(value?.startDate ?? null);
    setEndDate(value?.endDate ?? null);
    setHoverDate(null);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setStartDate(null);
    setEndDate(null);
    setHoverDate(null);
    onChange?.({ startDate: null, endDate: null });
  };

  // ── Trigger display text ──
  const displayText = startDate
    ? `${format(startDate, dateFormat)}${
        endDate ? ` — ${format(endDate, dateFormat)}` : ""
      }`
    : null;
  const hasSelection = !!(startDate || endDate);

  return (
    <div
      ref={containerRef}
      className={cn("relative inline-block w-full", className)}
    >
      {/* ── Trigger Button ── */}
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((o) => !o)}
        className={cn(
          "w-full flex items-center gap-2 px-3 py-2 rounded-md border border-input bg-background text-sm text-left",
          "hover:bg-accent/40 transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          isOpen && "ring-2 ring-ring ring-offset-2",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
        <span
          className={cn(
            "flex-1 truncate",
            !displayText && "text-muted-foreground"
          )}
        >
          {displayText ?? placeholder}
        </span>

        {/* Clear button or chevron */}
        {hasSelection && !disabled ? (
          <button
            type="button"
            onClick={handleClear}
            aria-label="Clear dates"
            className="shrink-0 p-0.5 rounded hover:bg-destructive/10 hover:text-destructive transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : (
          <ChevronDown
            className={cn(
              "h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200",
              isOpen && "rotate-180"
            )}
          />
        )}
      </button>

      {/* ── Dropdown Panel ── */}
      {isOpen && (
        <div
          className={cn(
            "absolute z-50 top-full mt-1 left-0",
            "bg-background border border-border rounded-xl shadow-2xl",
            "animate-in fade-in-0 slide-in-from-top-2 duration-150"
          )}
          onMouseLeave={() => setHoverDate(null)}
        >
          <div className="flex">
            {/* ── Sidebar: Quick Ranges ── */}
            <div className="flex flex-col gap-0.5 w-[120px] shrink-0 border-r border-border p-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-1 mb-2">
                Quick Ranges
              </p>
              {PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => handlePreset(preset)}
                  className={cn(
                    "w-full text-left px-2.5 py-2 rounded-lg text-sm transition-all duration-100",
                    "hover:bg-accent active:scale-[0.97]",
                    isPresetActive(preset) &&
                      "bg-primary/10 text-primary font-medium"
                  )}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* ── Dual Calendars ── */}
            <div className="flex items-start p-4 gap-4">
              {/* Left Calendar */}
              <CalendarPanel
                month={leftMonth}
                onMonthChange={(m) => setLeftMonth(startOfMonth(m))}
                showPrevNav
                showNextNav={false}
                onPrevMonth={() =>
                  setLeftMonth((m) => subMonths(m, 1))
                }
                onNextMonth={() =>
                  setLeftMonth((m) => addMonths(m, 1))
                }
                startDate={startDate}
                endDate={endDate}
                hoverDate={hoverDate}
                onDayClick={handleDayClick}
                onDayHover={setHoverDate}
                rangeMin={rangeMin}
                rangeMax={rangeMax}
              />

              {/* Divider */}
              <div className="w-px self-stretch bg-border" />

              {/* Right Calendar */}
              <CalendarPanel
                month={rightMonth}
                onMonthChange={(m) =>
                  setLeftMonth(startOfMonth(subMonths(m, 1)))
                }
                showPrevNav={false}
                showNextNav
                onPrevMonth={() =>
                  setLeftMonth((m) => subMonths(m, 1))
                }
                onNextMonth={() =>
                  setLeftMonth((m) => addMonths(m, 1))
                }
                startDate={startDate}
                endDate={endDate}
                hoverDate={hoverDate}
                onDayClick={handleDayClick}
                onDayHover={setHoverDate}
                rangeMin={rangeMin}
                rangeMax={rangeMax}
              />
            </div>
          </div>

          {/* ── Footer ── */}
          <div className="flex items-center justify-between border-t border-border px-4 py-3">
            {/* Nights feedback */}
            <div className="text-sm min-h-[20px]">
              {nightsCount > 0 ? (
                <span>
                  <span className="font-semibold text-foreground">
                    {nightsCount}
                  </span>
                  <span className="text-muted-foreground">
                    {" "}
                    night{nightsCount !== 1 ? "s" : ""} selected
                  </span>
                </span>
              ) : startDate && !endDate ? (
                <span className="text-muted-foreground">
                  Select check-out date
                </span>
              ) : (
                <span className="text-muted-foreground">Select your dates</span>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCancel}
                className={cn(
                  "px-4 py-1.5 rounded-md border border-border text-sm",
                  "hover:bg-accent transition-colors active:scale-[0.97]"
                )}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApply}
                disabled={!startDate}
                className={cn(
                  "px-4 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium",
                  "hover:bg-primary/90 transition-all active:scale-[0.97]",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DateRangePicker;

// ─── SplitDateRangePicker ─────────────────────────────────────────────────────
// Two separate trigger fields ("Start Date" / "End Date") that share one
// underlying dual-calendar panel. Each field can carry its own label, error
// styling, and error message while the selection state is unified.

export interface SplitDateRangePickerProps {
  value?: DateRange;
  onChange?: (range: DateRange) => void;
  /** Label rendered above the start-date field */
  startLabel?: string;
  /** Label rendered above the end-date field */
  endLabel?: string;
  startPlaceholder?: string;
  endPlaceholder?: string;
  disabled?: boolean;
  className?: string;
  dateFormat?: string;
  startId?: string;
  endId?: string;
  startError?: boolean;
  startErrorMessage?: string;
  endError?: boolean;
  endErrorMessage?: string;
}

export function SplitDateRangePicker({
  value,
  onChange,
  startLabel,
  endLabel,
  startPlaceholder = "Start date",
  endPlaceholder = "End date",
  disabled = false,
  className,
  dateFormat = "MMM dd, yyyy",
  startId,
  endId,
  startError = false,
  startErrorMessage,
  endError = false,
  endErrorMessage,
}: SplitDateRangePickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  // Which field was clicked to open the panel
  const [activeField, setActiveField] = useState<"start" | "end">("start");

  const [startDate, setStartDate] = useState<Date | null>(value?.startDate ?? null);
  const [endDate, setEndDate] = useState<Date | null>(value?.endDate ?? null);
  const [hoverDate, setHoverDate] = useState<Date | null>(null);

  const [leftMonth, setLeftMonth] = useState<Date>(() =>
    startOfMonth(value?.startDate ?? new Date())
  );
  const rightMonth = addMonths(leftMonth, 1);

  // Sync controlled value
  useEffect(() => {
    setStartDate(value?.startDate ?? null);
    setEndDate(value?.endDate ?? null);
  }, [value?.startDate, value?.endDate]);

  // Click-outside
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setHoverDate(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  // Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setIsOpen(false); setHoverDate(null); }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen]);

  const openFor = (field: "start" | "end") => {
    if (disabled) return;
    setActiveField(field);
    // Scroll left calendar to the relevant month
    if (field === "start" && startDate) setLeftMonth(startOfMonth(startDate));
    else if (field === "end" && endDate) {
      // Show the month that contains the end date; put it on the right panel
      const targetLeft = startOfMonth(subMonths(endDate, 1));
      setLeftMonth(targetLeft);
    }
    setIsOpen(true);
  };

  // Day-click logic varies by activeField
  const handleDayClick = (date: Date) => {
    if (activeField === "start") {
      setStartDate(date);
      // Clear end date if it's now before the new start
      if (endDate && isBefore(endDate, date)) setEndDate(null);
      setActiveField("end");
    } else {
      // activeField === 'end'
      if (!startDate) {
        // No start yet — treat as start selection
        setStartDate(date);
        setActiveField("end");
      } else if (isBefore(date, startDate) || isSameDay(date, startDate)) {
        // Elastic: clicked before/on start → reset start, clear end
        setStartDate(date);
        setEndDate(null);
        setActiveField("end");
      } else {
        setEndDate(date);
        setHoverDate(null);
      }
    }
  };

  // Effective range for highlighting
  const effectiveEnd = endDate ?? (startDate && hoverDate ? hoverDate : null);
  const rangeMin =
    startDate && effectiveEnd
      ? isBefore(startDate, effectiveEnd) ? startDate : effectiveEnd
      : null;
  const rangeMax =
    startDate && effectiveEnd
      ? isBefore(startDate, effectiveEnd) ? effectiveEnd : startDate
      : null;

  const nightsCount =
    startDate && endDate ? Math.abs(differenceInDays(endDate, startDate)) : 0;

  // Presets
  const handlePreset = (preset: (typeof PRESETS)[0]) => {
    const range = preset.getValue();
    setStartDate(range.startDate);
    setEndDate(range.endDate);
    if (range.startDate) setLeftMonth(startOfMonth(range.startDate));
    setHoverDate(null);
  };
  const isPresetActive = (preset: (typeof PRESETS)[0]) => {
    const range = preset.getValue();
    return (
      startDate != null && endDate != null &&
      range.startDate != null && range.endDate != null &&
      isSameDay(startDate, range.startDate) &&
      isSameDay(endDate, range.endDate)
    );
  };

  // Apply / Cancel / Clear
  const handleApply = () => {
    onChange?.({ startDate, endDate });
    setIsOpen(false);
    setHoverDate(null);
  };
  const handleCancel = () => {
    setStartDate(value?.startDate ?? null);
    setEndDate(value?.endDate ?? null);
    setHoverDate(null);
    setIsOpen(false);
  };

  const clearStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    setStartDate(null);
    setEndDate(null);
    onChange?.({ startDate: null, endDate: null });
  };
  const clearEnd = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEndDate(null);
    onChange?.({ startDate, endDate: null });
  };

  // Highlight the active field's trigger when open
  const startActive = isOpen && activeField === "start";
  const endActive = isOpen && activeField === "end";

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {/* ── Two trigger fields ── */}
      <div className="grid grid-cols-2 gap-3">
        {/* Start Date */}
        <div className="space-y-1.5">
          {startLabel && (
            <label
              htmlFor={startId}
              className="text-sm font-medium leading-none"
            >
              {startLabel}
            </label>
          )}
          <button
            id={startId}
            type="button"
            disabled={disabled}
            onClick={() => openFor("start")}
            className={cn(
              "w-full flex items-center gap-2 px-3 py-2 rounded-md border bg-background text-sm text-left",
              "hover:bg-accent/40 transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              startActive && "ring-2 ring-ring ring-offset-2",
              startError && !startActive && "border-destructive",
              disabled && "opacity-50 cursor-not-allowed"
            )}
          >
            <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className={cn("flex-1 truncate", !startDate && "text-muted-foreground")}>
              {startDate ? format(startDate, dateFormat) : startPlaceholder}
            </span>
            {startDate && !disabled && (
              <button
                type="button"
                onClick={clearStart}
                aria-label="Clear start date"
                className="shrink-0 p-0.5 rounded hover:bg-destructive/10 hover:text-destructive transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </button>
          {startErrorMessage && (
            <p className="text-xs text-destructive">{startErrorMessage}</p>
          )}
        </div>

        {/* End Date */}
        <div className="space-y-1.5">
          {endLabel && (
            <label
              htmlFor={endId}
              className="text-sm font-medium leading-none"
            >
              {endLabel}
            </label>
          )}
          <button
            id={endId}
            type="button"
            disabled={disabled}
            onClick={() => openFor("end")}
            className={cn(
              "w-full flex items-center gap-2 px-3 py-2 rounded-md border bg-background text-sm text-left",
              "hover:bg-accent/40 transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              endActive && "ring-2 ring-ring ring-offset-2",
              endError && !endActive && "border-destructive",
              disabled && "opacity-50 cursor-not-allowed"
            )}
          >
            <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className={cn("flex-1 truncate", !endDate && "text-muted-foreground")}>
              {endDate ? format(endDate, dateFormat) : endPlaceholder}
            </span>
            {endDate && !disabled && (
              <button
                type="button"
                onClick={clearEnd}
                aria-label="Clear end date"
                className="shrink-0 p-0.5 rounded hover:bg-destructive/10 hover:text-destructive transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </button>
          {endErrorMessage && (
            <p className="text-xs text-destructive">{endErrorMessage}</p>
          )}
        </div>
      </div>

      {/* ── Dropdown Panel ── */}
      {isOpen && (
        <div
          className={cn(
            "absolute z-50 top-full mt-1 left-0",
            "bg-background border border-border rounded-xl shadow-2xl",
            "animate-in fade-in-0 slide-in-from-top-2 duration-150"
          )}
          onMouseLeave={() => setHoverDate(null)}
        >
          <div className="flex">
            {/* Sidebar */}
            <div className="flex flex-col gap-0.5 w-[120px] shrink-0 border-r border-border p-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-1 mb-2">
                Quick Ranges
              </p>
              {PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => handlePreset(preset)}
                  className={cn(
                    "w-full text-left px-2.5 py-2 rounded-lg text-sm transition-all duration-100",
                    "hover:bg-accent active:scale-[0.97]",
                    isPresetActive(preset) && "bg-primary/10 text-primary font-medium"
                  )}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Dual Calendars */}
            <div className="flex items-start p-4 gap-4">
              {/* Active-field hint */}
              <div className="absolute top-3 left-[132px] right-4 flex justify-center pointer-events-none">
                <span className="text-[11px] text-muted-foreground">
                  {activeField === "start"
                    ? "Select check-in date"
                    : startDate
                    ? "Select check-out date"
                    : "Select check-in date"}
                </span>
              </div>

              <CalendarPanel
                month={leftMonth}
                onMonthChange={(m) => setLeftMonth(startOfMonth(m))}
                showPrevNav
                showNextNav={false}
                onPrevMonth={() => setLeftMonth((m) => subMonths(m, 1))}
                onNextMonth={() => setLeftMonth((m) => addMonths(m, 1))}
                startDate={startDate}
                endDate={endDate}
                hoverDate={hoverDate}
                onDayClick={handleDayClick}
                onDayHover={setHoverDate}
                rangeMin={rangeMin}
                rangeMax={rangeMax}
              />

              <div className="w-px self-stretch bg-border" />

              <CalendarPanel
                month={rightMonth}
                onMonthChange={(m) => setLeftMonth(startOfMonth(subMonths(m, 1)))}
                showPrevNav={false}
                showNextNav
                onPrevMonth={() => setLeftMonth((m) => subMonths(m, 1))}
                onNextMonth={() => setLeftMonth((m) => addMonths(m, 1))}
                startDate={startDate}
                endDate={endDate}
                hoverDate={hoverDate}
                onDayClick={handleDayClick}
                onDayHover={setHoverDate}
                rangeMin={rangeMin}
                rangeMax={rangeMax}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-border px-4 py-3">
            <div className="text-sm min-h-[20px]">
              {nightsCount > 0 ? (
                <span>
                  <span className="font-semibold text-foreground">{nightsCount}</span>
                  <span className="text-muted-foreground"> night{nightsCount !== 1 ? "s" : ""} selected</span>
                </span>
              ) : startDate && !endDate ? (
                <span className="text-muted-foreground">Select check-out date</span>
              ) : (
                <span className="text-muted-foreground">Select your dates</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCancel}
                className={cn(
                  "px-4 py-1.5 rounded-md border border-border text-sm",
                  "hover:bg-accent transition-colors active:scale-[0.97]"
                )}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApply}
                disabled={!startDate}
                className={cn(
                  "px-4 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium",
                  "hover:bg-primary/90 transition-all active:scale-[0.97]",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
