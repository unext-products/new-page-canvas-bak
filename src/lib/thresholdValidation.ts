import { supabase } from "@/integrations/supabase/client";

export interface ThresholdValidationResult {
  valid: boolean;
  error?: string;
}

export interface Thresholds {
  work_hours_enabled: boolean;
  work_start_time: string;
  work_end_time: string;
  max_hours_enabled: boolean;
  max_hours_minutes: number;
}

/**
 * Fetch thresholds for a user's organization
 */
export async function fetchUserThresholds(userId: string): Promise<Thresholds | null> {
  // Get user's organization
  const { data: userRole } = await supabase
    .from("user_roles")
    .select("organization_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (!userRole?.organization_id) return null;

  // Fetch org-wide thresholds
  const { data: thresholds } = await supabase
    .from("timesheet_thresholds")
    .select("*")
    .eq("organization_id", userRole.organization_id)
    .is("vertical_id", null)
    .maybeSingle();

  if (!thresholds) return null;

  return {
    work_hours_enabled: thresholds.work_hours_enabled,
    work_start_time: thresholds.work_start_time || "08:30:00",
    work_end_time: thresholds.work_end_time || "17:30:00",
    max_hours_enabled: thresholds.max_hours_enabled,
    max_hours_minutes: thresholds.max_hours_minutes || 480,
  };
}

/**
 * Fetch thresholds for an organization by ID
 */
export async function fetchOrgThresholds(organizationId: string): Promise<Thresholds | null> {
  const { data: thresholds } = await supabase
    .from("timesheet_thresholds")
    .select("*")
    .eq("organization_id", organizationId)
    .is("vertical_id", null)
    .maybeSingle();

  if (!thresholds) return null;

  return {
    work_hours_enabled: thresholds.work_hours_enabled,
    work_start_time: thresholds.work_start_time || "08:30:00",
    work_end_time: thresholds.work_end_time || "17:30:00",
    max_hours_enabled: thresholds.max_hours_enabled,
    max_hours_minutes: thresholds.max_hours_minutes || 480,
  };
}

/**
 * Validate a timesheet entry against thresholds
 */
export function validateAgainstThresholds(
  startTime: string,
  endTime: string,
  thresholds: Thresholds | null
): ThresholdValidationResult {
  if (!thresholds) return { valid: true };

  // Check work hour window
  if (thresholds.work_hours_enabled) {
    const workStart = thresholds.work_start_time.slice(0, 5);
    const workEnd = thresholds.work_end_time.slice(0, 5);

    // Normalize times to HH:MM for comparison
    const normalizedStart = startTime.padStart(5, '0');
    const normalizedEnd = endTime.padStart(5, '0');

    if (normalizedStart < workStart || normalizedEnd > workEnd) {
      return {
        valid: false,
        error: `Entry must be within work hours (${workStart} - ${workEnd}). Your entry: ${startTime} - ${endTime}`,
      };
    }
  }

  // Check max hours per entry if needed
  if (thresholds.max_hours_enabled) {
    const [startH, startM] = startTime.split(":").map(Number);
    const [endH, endM] = endTime.split(":").map(Number);
    const durationMinutes = (endH * 60 + endM) - (startH * 60 + startM);
    
    if (durationMinutes > thresholds.max_hours_minutes) {
      const maxHours = Math.floor(thresholds.max_hours_minutes / 60);
      const maxMins = thresholds.max_hours_minutes % 60;
      return {
        valid: false,
        error: `Single entry cannot exceed ${maxHours}h ${maxMins}m. Your entry: ${Math.floor(durationMinutes / 60)}h ${durationMinutes % 60}m`,
      };
    }
  }

  return { valid: true };
}
