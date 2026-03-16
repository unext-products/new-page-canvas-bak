/**
 * Shared utilities for half-day leave logic.
 *
 * The work window midpoint is calculated dynamically from thresholds
 * (default 08:30–17:30 → midpoint 13:00).
 */

// ---------- type helpers ----------

export type LeaveType =
  | "casual"
  | "sick"
  | "earned"
  | "half_day"        // legacy
  | "half_day_first"
  | "half_day_second"
  | "comp_off"
  | "other";

export function isHalfDayLeave(leaveType: string): boolean {
  return (
    leaveType === "half_day_first" ||
    leaveType === "half_day_second" ||
    leaveType === "half_day" // legacy treated as first-half
  );
}

/** Returns 0.5 for half-day leaves, 1.0 for full-day leaves. */
export function getLeaveWeight(leaveType: string): number {
  return isHalfDayLeave(leaveType) ? 0.5 : 1.0;
}

// ---------- time boundary helpers ----------

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

/**
 * Get the midpoint of the work window in "HH:MM" format.
 * Default work window: 08:30–17:30 → midpoint 13:00.
 */
export function getWorkWindowMidpoint(
  workStart = "08:30",
  workEnd = "17:30"
): string {
  const startMins = timeToMinutes(workStart.slice(0, 5));
  const endMins = timeToMinutes(workEnd.slice(0, 5));
  return minutesToTime(Math.floor((startMins + endMins) / 2));
}

export interface HalfDayBlockedRange {
  blockedStart: string; // "HH:MM"
  blockedEnd: string;   // "HH:MM"
}

/**
 * Returns the blocked time range for a half-day leave.
 * - half_day_first / half_day (legacy) → work_start – midpoint
 * - half_day_second → midpoint – work_end
 * Returns null for full-day leaves.
 */
export function getHalfDayBlockedRange(
  leaveType: string,
  workStart = "08:30",
  workEnd = "17:30"
): HalfDayBlockedRange | null {
  if (!isHalfDayLeave(leaveType)) return null;

  const mid = getWorkWindowMidpoint(workStart, workEnd);
  const ws = workStart.slice(0, 5);
  const we = workEnd.slice(0, 5);

  if (leaveType === "half_day_second") {
    return { blockedStart: mid, blockedEnd: we };
  }
  // half_day_first or legacy half_day
  return { blockedStart: ws, blockedEnd: mid };
}

/**
 * Check whether a proposed timesheet entry time range overlaps with
 * the blocked half of a half-day leave.
 * Returns true if the entry is blocked.
 */
export function isTimeBlockedByHalfDayLeave(
  entryStart: string,
  entryEnd: string,
  leaveType: string,
  workStart = "08:30",
  workEnd = "17:30"
): boolean {
  const range = getHalfDayBlockedRange(leaveType, workStart, workEnd);
  if (!range) return true; // full-day leave blocks everything

  const eStart = timeToMinutes(entryStart.slice(0, 5));
  const eEnd = timeToMinutes(entryEnd.slice(0, 5));
  const bStart = timeToMinutes(range.blockedStart);
  const bEnd = timeToMinutes(range.blockedEnd);

  // Overlap check
  return eStart < bEnd && eEnd > bStart;
}

// ---------- display helpers ----------

/** Single source of truth for leave type display labels. */
export function formatLeaveType(type: string): string {
  const labels: Record<string, string> = {
    casual: "Casual Leave",
    sick: "Sick Leave",
    earned: "Earned Leave",
    half_day: "Half Day (Legacy)",
    half_day_first: "Half Day - First Half",
    half_day_second: "Half Day - Second Half",
    comp_off: "Compensatory Off",
    other: "Other Leave",
  };
  return labels[type] || type;
}

/** Short labels for calendar / badge display. */
export function formatLeaveTypeShort(type: string): string {
  const labels: Record<string, string> = {
    casual: "CL",
    sick: "SL",
    earned: "EL",
    half_day: "HD",
    half_day_first: "HD-1",
    half_day_second: "HD-2",
    comp_off: "CO",
    other: "OL",
  };
  return labels[type] || type;
}
