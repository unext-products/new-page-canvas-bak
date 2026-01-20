import { cn } from "@/lib/utils";
import { calculateDurationMinutes } from "@/lib/timesheetUtils";

// Define hour slots from 8:30 to 17:30 (9 slots)
export const HOUR_SLOTS = [
  { start: "08:30", end: "09:30", label: "8:30" },
  { start: "09:30", end: "10:30", label: "9:30" },
  { start: "10:30", end: "11:30", label: "10:30" },
  { start: "11:30", end: "12:30", label: "11:30" },
  { start: "12:30", end: "13:30", label: "12:30" },
  { start: "13:30", end: "14:30", label: "13:30" },
  { start: "14:30", end: "15:30", label: "14:30" },
  { start: "15:30", end: "16:30", label: "15:30" },
  { start: "16:30", end: "17:30", label: "16:30" },
];

// Define 15-minute slots from 8:30 to 17:30 (36 slots)
export const QUARTER_HOUR_SLOTS = [
  { start: "08:30", end: "08:45", label: "8:30" },
  { start: "08:45", end: "09:00", label: "8:45" },
  { start: "09:00", end: "09:15", label: "9:00" },
  { start: "09:15", end: "09:30", label: "9:15" },
  { start: "09:30", end: "09:45", label: "9:30" },
  { start: "09:45", end: "10:00", label: "9:45" },
  { start: "10:00", end: "10:15", label: "10:00" },
  { start: "10:15", end: "10:30", label: "10:15" },
  { start: "10:30", end: "10:45", label: "10:30" },
  { start: "10:45", end: "11:00", label: "10:45" },
  { start: "11:00", end: "11:15", label: "11:00" },
  { start: "11:15", end: "11:30", label: "11:15" },
  { start: "11:30", end: "11:45", label: "11:30" },
  { start: "11:45", end: "12:00", label: "11:45" },
  { start: "12:00", end: "12:15", label: "12:00" },
  { start: "12:15", end: "12:30", label: "12:15" },
  { start: "12:30", end: "12:45", label: "12:30" },
  { start: "12:45", end: "13:00", label: "12:45" },
  { start: "13:00", end: "13:15", label: "13:00" },
  { start: "13:15", end: "13:30", label: "13:15" },
  { start: "13:30", end: "13:45", label: "13:30" },
  { start: "13:45", end: "14:00", label: "13:45" },
  { start: "14:00", end: "14:15", label: "14:00" },
  { start: "14:15", end: "14:30", label: "14:15" },
  { start: "14:30", end: "14:45", label: "14:30" },
  { start: "14:45", end: "15:00", label: "14:45" },
  { start: "15:00", end: "15:15", label: "15:00" },
  { start: "15:15", end: "15:30", label: "15:15" },
  { start: "15:30", end: "15:45", label: "15:30" },
  { start: "15:45", end: "16:00", label: "15:45" },
  { start: "16:00", end: "16:15", label: "16:00" },
  { start: "16:15", end: "16:30", label: "16:15" },
  { start: "16:30", end: "16:45", label: "16:30" },
  { start: "16:45", end: "17:00", label: "16:45" },
  { start: "17:00", end: "17:15", label: "17:00" },
  { start: "17:15", end: "17:30", label: "17:15" },
];

// Convert time string to minutes from midnight
export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

// Calculate what percentage of a slot an entry covers
export function calculateSlotCoverage(
  entryStart: string,
  entryEnd: string,
  slotStart: string,
  slotEnd: string
): { covered: boolean; percentage: number } {
  const entryStartMins = timeToMinutes(entryStart);
  const entryEndMins = timeToMinutes(entryEnd);
  const slotStartMins = timeToMinutes(slotStart);
  const slotEndMins = timeToMinutes(slotEnd);

  // Check if there's any overlap
  const overlapStart = Math.max(entryStartMins, slotStartMins);
  const overlapEnd = Math.min(entryEndMins, slotEndMins);

  if (overlapStart >= overlapEnd) {
    return { covered: false, percentage: 0 };
  }

  const slotDuration = slotEndMins - slotStartMins;
  const overlapDuration = overlapEnd - overlapStart;
  const percentage = (overlapDuration / slotDuration) * 100;

  return { covered: true, percentage };
}

// Get status color classes
export function getStatusColor(status: string): string {
  switch (status) {
    case "approved":
      return "bg-green-500";
    case "submitted":
      return "bg-yellow-500";
    case "draft":
      return "bg-gray-400";
    case "rejected":
      return "bg-red-500";
    default:
      return "bg-gray-300";
  }
}

export function getStatusBorderColor(status: string): string {
  switch (status) {
    case "approved":
      return "border-green-600";
    case "submitted":
      return "border-yellow-600";
    case "draft":
      return "border-gray-500";
    case "rejected":
      return "border-red-600";
    default:
      return "border-gray-400";
  }
}

export function getStatusBgColor(status: string): string {
  switch (status) {
    case "approved":
      return "bg-green-500/20";
    case "submitted":
      return "bg-yellow-500/20";
    case "draft":
      return "bg-gray-400/20";
    case "rejected":
      return "bg-red-500/20";
    default:
      return "bg-gray-200";
  }
}
