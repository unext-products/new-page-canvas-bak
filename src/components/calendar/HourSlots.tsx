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
