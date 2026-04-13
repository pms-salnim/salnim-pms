// Utility functions for calendar operations

export function generateMonthDates(year: number, month: number): Date[] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const dates: Date[] = [];

  // Add padding for start of month
  const startPadding = firstDay.getDay();
  for (let i = startPadding - 1; i >= 0; i--) {
    dates.push(new Date(firstDay.getTime() - (i + 1) * 24 * 60 * 60 * 1000));
  }

  // Add all days of the month
  for (let day = 1; day <= lastDay.getDate(); day++) {
    dates.push(new Date(year, month, day));
  }

  // Add padding for end of month
  const endPadding = 6 - lastDay.getDay();
  for (let i = 1; i <= endPadding; i++) {
    dates.push(new Date(lastDay.getTime() + i * 24 * 60 * 60 * 1000));
  }

  return dates;
}

export function generateDateRange(start: Date, end: Date): Date[] {
  const dates: Date[] = [];
  const current = new Date(start);

  while (current <= end) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function formatDateWithDay(date: Date): string {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return `${days[date.getDay()]} ${date.getDate()}`;
}

export function formatMonthYear(date: Date): string {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return `${months[date.getMonth()]} ${date.getFullYear()}`;
}

export function getDayName(dayIndex: number): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[dayIndex];
}

export function getDayAbbr(dayIndex: number): string {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return days[dayIndex];
}

export function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

export function isToday(date: Date): boolean {
  const today = new Date();
  return date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();
}

export function isInPast(date: Date): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return date < today;
}

export function isInFuture(date: Date): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return date > today;
}

export function isSameMonth(date1: Date, date2: Date): boolean {
  return date1.getMonth() === date2.getMonth() &&
    date1.getFullYear() === date2.getFullYear();
}

export function isSameDay(date1: Date, date2: Date): boolean {
  return date1.getDate() === date2.getDate() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getFullYear() === date2.getFullYear();
}

export function getDateBefore(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() - days);
  return result;
}

export function getDateAfter(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function getMonthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function getMonthEnd(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

export function getQuarterStart(date: Date): Date {
  const quarter = Math.floor(date.getMonth() / 3);
  return new Date(date.getFullYear(), quarter * 3, 1);
}

export function getYearStart(date: Date): Date {
  return new Date(date.getFullYear(), 0, 1);
}

export function getYearEnd(date: Date): Date {
  return new Date(date.getFullYear(), 11, 31);
}

export function getDaysBetween(start: Date, end: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((end.getTime() - start.getTime()) / msPerDay);
}

export function getWeekBoundaries(date: Date): { start: Date; end: Date } {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);

  const start = new Date(d.setDate(diff));
  const end = new Date(start);
  end.setDate(end.getDate() + 6);

  return { start, end };
}

export function parseISODate(dateString: string): Date {
  return new Date(dateString + 'T00:00:00Z');
}

export function stringToDate(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function getSeasonedDates(startDate: Date, endDate: Date, daysOfWeek: string[]): Date[] {
  const dayMap: Record<string, number> = {
    SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6
  };

  const dates = generateDateRange(startDate, endDate);
  return dates.filter(d => {
    const dayIndex = d.getDay();
    const dayNames = Object.entries(dayMap)
      .filter(([_, idx]) => idx === dayIndex)
      .map(([name, _]) => name);
    return dayNames.some(name => daysOfWeek.includes(name));
  });
}

export function calculateOccupancyPercentage(bookings: any[], startDate: Date, endDate: Date): number {
  const totalDays = getDaysBetween(startDate, endDate) + 1;
  const bookedDays = new Set();

  bookings.forEach(booking => {
    const bookStart = new Date(booking.checkIn);
    const bookEnd = new Date(booking.checkOut);
    const current = new Date(bookStart);

    while (current <= bookEnd) {
      bookedDays.add(formatDate(current));
      current.setDate(current.getDate() + 1);
    }
  });

  return Math.round((bookedDays.size / totalDays) * 100);
}

export function getConsecutiveDates(dates: Date[]): Date[][] {
  if (dates.length === 0) return [];

  const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime());
  const groups: Date[][] = [];
  let currentGroup = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const prevDate = currentGroup[currentGroup.length - 1];
    const currentDate = sorted[i];
    const daysDiff = getDaysBetween(prevDate, currentDate);

    if (daysDiff === 1) {
      currentGroup.push(currentDate);
    } else {
      groups.push(currentGroup);
      currentGroup = [currentDate];
    }
  }

  groups.push(currentGroup);
  return groups;
}

export function mergeDateRanges(ranges: Array<[Date, Date]>): Array<[Date, Date]> {
  if (ranges.length === 0) return [];

  const sorted = [...ranges].sort((a, b) => a[0].getTime() - b[0].getTime());
  const merged: Array<[Date, Date]> = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const lastMerged = merged[merged.length - 1];
    const current = sorted[i];

    if (current[0].getTime() <= lastMerged[1].getTime()) {
      lastMerged[1] = new Date(Math.max(lastMerged[1].getTime(), current[1].getTime()));
    } else {
      merged.push(current);
    }
  }

  return merged;
}

export function getNextNMonths(n: number, fromDate: Date = new Date()): Date[] {
  const months: Date[] = [];
  const current = new Date(fromDate);

  for (let i = 0; i < n; i++) {
    months.push(new Date(current.getFullYear(), current.getMonth(), 1));
    current.setMonth(current.getMonth() + 1);
  }

  return months;
}

export function getNextN90Days(fromDate: Date = new Date()): Date[] {
  return generateDateRange(fromDate, getDateAfter(fromDate, 89));
}
