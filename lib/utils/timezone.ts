import { format, parseISO } from 'date-fns';
import { formatInTimeZone, toZonedTime } from 'date-fns-tz';

export function formatInUserTimezone(
  date: Date | string,
  timezone: string,
  formatStr: string = 'PPpp'
): string {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return formatInTimeZone(dateObj, timezone, formatStr);
}

export function toUserTimezone(date: Date | string, timezone: string): Date {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return toZonedTime(dateObj, timezone);
}

export function getCurrentTimeInTimezone(timezone: string): Date {
  return toZonedTime(new Date(), timezone);
}

export function isAfterCutoff(timezone: string, cutoffTime: string = '09:15'): boolean {
  const now = getCurrentTimeInTimezone(timezone);
  const [hours, minutes] = cutoffTime.split(':').map(Number);
  
  const cutoff = new Date(now);
  cutoff.setHours(hours, minutes, 0, 0);
  
  return now > cutoff;
}
