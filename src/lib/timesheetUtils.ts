/**
 * Calculate duration in minutes from start and end time strings
 * @param startTime - Time string in "HH:mm" or "HH:mm:ss" format
 * @param endTime - Time string in "HH:mm" or "HH:mm:ss" format
 * @returns Duration in minutes
 */
export function calculateDurationMinutes(startTime: string, endTime: string): number {
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);
  return (endH * 60 + endM) - (startH * 60 + startM);
}

/**
 * Format duration from minutes to a readable string
 * @param minutes - Duration in minutes
 * @returns Formatted string like "2h 30m"
 */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

/**
 * Format duration from minutes to hours (decimal)
 * @param minutes - Duration in minutes
 * @returns Hours as decimal number
 */
export function minutesToHours(minutes: number): number {
  return minutes / 60;
}

/**
 * Get duration from a timesheet entry that has start_time and end_time
 */
export function getEntryDuration(entry: { start_time: string; end_time: string }): number {
  return calculateDurationMinutes(entry.start_time, entry.end_time);
}
