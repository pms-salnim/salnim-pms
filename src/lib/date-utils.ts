/**
 * Date utilities for consistent handling of dates in YYYY-MM-DD format
 * All dates are handled in local timezone without UTC conversion
 */

/**
 * Convert a Date object to YYYY-MM-DD string using LOCAL timezone (no UTC conversion)
 * @param date The Date object to convert
 * @returns Date string in YYYY-MM-DD format
 */
export const dateToString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Convert a YYYY-MM-DD string to a Date object (creates date at midnight local time)
 * @param dateStr Date string in YYYY-MM-DD format
 * @returns Date object set to midnight of that day in local timezone
 */
export const stringToDate = (dateStr: string): Date => {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
};

/**
 * Add days to a Date object and return as YYYY-MM-DD string
 * @param date The starting Date
 * @param days Number of days to add (can be negative)
 * @returns Date string in YYYY-MM-DD format
 */
export const addDays = (date: Date, days: number): string => {
  const newDate = new Date(date);
  newDate.setDate(newDate.getDate() + days);
  return dateToString(newDate);
};

/**
 * Get date string for today in YYYY-MM-DD format
 * @returns Today's date as YYYY-MM-DD string
 */
export const getTodayString = (): string => {
  return dateToString(new Date());
};

/**
 * Compare two date strings
 * @param dateStr1 First date in YYYY-MM-DD format
 * @param dateStr2 Second date in YYYY-MM-DD format
 * @returns -1 if dateStr1 < dateStr2, 0 if equal, 1 if dateStr1 > dateStr2
 */
export const compareDateStrings = (dateStr1: string, dateStr2: string): number => {
  if (dateStr1 < dateStr2) return -1;
  if (dateStr1 > dateStr2) return 1;
  return 0;
};

/**
 * Check if a date string is within a range (inclusive)
 * @param dateStr The date to check in YYYY-MM-DD format
 * @param startStr Start date in YYYY-MM-DD format
 * @param endStr End date in YYYY-MM-DD format (inclusive)
 * @returns true if dateStr is within the range
 */
export const isDateInRange = (dateStr: string, startStr: string, endStr: string): boolean => {
  return dateStr >= startStr && dateStr <= endStr;
};

/**
 * Generate an array of date strings from start to end (inclusive)
 * @param startStr Start date in YYYY-MM-DD format
 * @param endStr End date in YYYY-MM-DD format
 * @returns Array of date strings in YYYY-MM-DD format
 */
export const generateDateRangeStrings = (startStr: string, endStr: string): string[] => {
  const dates: string[] = [];
  let currentDate = stringToDate(startStr);
  const endDate = stringToDate(endStr);

  while (dateToString(currentDate) <= endStr) {
    dates.push(dateToString(currentDate));
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return dates;
};

/**
 * Expand a date range with optional end_date into individual date entries
 * This is used for handling rate overrides and restrictions that apply to a range
 * @param startStr Start date in YYYY-MM-DD format
 * @param endStr Optional end date in YYYY-MM-DD format
 * @returns Array of date strings in YYYY-MM-DD format
 */
export const expandDateRange = (startStr: string, endStr?: string | null): string[] => {
  if (!endStr || endStr === startStr) {
    return [startStr];
  }

  return generateDateRangeStrings(startStr, endStr);
};
