import { format, parse } from "date-fns";

/**
 * Format a date string from ISO format (YYYY-MM-DD) to display format (DD/MM/YYYY)
 */
export function formatDisplayDate(isoDate: string): string {
  if (!isoDate) return "";
  try {
    const date = new Date(isoDate);
    return format(date, "dd/MM/yyyy");
  } catch {
    return isoDate;
  }
}

/**
 * Parse a date string from display format (DD/MM/YYYY) to ISO format (YYYY-MM-DD)
 */
export function parseDisplayDate(displayDate: string): string {
  if (!displayDate) return "";
  try {
    // Try DD/MM/YYYY format
    const ddmmyyyy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
    const match = displayDate.match(ddmmyyyy);
    if (match) {
      const day = match[1].padStart(2, "0");
      const month = match[2].padStart(2, "0");
      const year = match[3];
      return `${year}-${month}-${day}`;
    }
    // If already in ISO format, return as is
    if (/^\d{4}-\d{2}-\d{2}$/.test(displayDate)) {
      return displayDate;
    }
    return displayDate;
  } catch {
    return displayDate;
  }
}

/**
 * Validate that a date string is in DD/MM/YYYY format
 */
export function isValidDisplayDate(dateStr: string): boolean {
  const ddmmyyyy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
  const match = dateStr.match(ddmmyyyy);
  if (!match) return false;
  
  const day = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const year = parseInt(match[3], 10);
  
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  if (year < 1900 || year > 2100) return false;
  
  // Check for valid day in month
  const daysInMonth = new Date(year, month, 0).getDate();
  return day <= daysInMonth;
}

/**
 * Get today's date in ISO format
 */
export function getTodayISO(): string {
  return new Date().toISOString().split("T")[0];
}

/**
 * Get today's date in display format
 */
export function getTodayDisplay(): string {
  return format(new Date(), "dd/MM/yyyy");
}

/**
 * Get start of week (Monday) in ISO format
 */
export function getWeekStartISO(): string {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
  const monday = new Date(today.setDate(diff));
  return monday.toISOString().split("T")[0];
}

/**
 * Get end of week (Sunday) in ISO format
 */
export function getWeekEndISO(): string {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? 0 : 7);
  const sunday = new Date(today.setDate(diff));
  return sunday.toISOString().split("T")[0];
}

/**
 * Get start of month in ISO format
 */
export function getMonthStartISO(): string {
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split("T")[0];
}

/**
 * Get end of month in ISO format
 */
export function getMonthEndISO(): string {
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split("T")[0];
}
