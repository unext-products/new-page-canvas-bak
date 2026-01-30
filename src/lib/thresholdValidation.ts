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

export interface WorkingDaysConfig {
  monday: boolean;
  tuesday: boolean;
  wednesday: boolean;
  thursday: boolean;
  friday: boolean;
  saturday: boolean;
  sunday: boolean;
}

export interface Holiday {
  holiday_date: string;
  name: string;
}

export interface ExtendedValidationContext {
  thresholds: Thresholds | null;
  holidays: Holiday[];
  workingDays: WorkingDaysConfig;
  activityTypes: string[];
  userLeaveDays?: Set<string>;
}

/**
 * Fetch leave days for a user
 */
export async function fetchUserLeaveDays(userId: string): Promise<Set<string>> {
  const { data } = await supabase
    .from('leave_days')
    .select('leave_date')
    .eq('user_id', userId);
  
  return new Set(data?.map(d => d.leave_date) || []);
}

const defaultWorkingDays: WorkingDaysConfig = {
  monday: true,
  tuesday: true,
  wednesday: true,
  thursday: true,
  friday: true,
  saturday: false,
  sunday: false,
};

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
 * Fetch extended validation context for bulk import
 */
export async function fetchExtendedValidationContext(userId: string): Promise<ExtendedValidationContext> {
  // Get user's organization
  const { data: userRole } = await supabase
    .from("user_roles")
    .select("organization_id")
    .eq("user_id", userId)
    .maybeSingle();

  const organizationId = userRole?.organization_id;

  if (!organizationId) {
    return {
      thresholds: null,
      holidays: [],
      workingDays: defaultWorkingDays,
      activityTypes: [],
    };
  }

  // Fetch all validation data in parallel
  const [thresholdsRes, holidaysRes, workingDaysRes, activityCategoriesRes] = await Promise.all([
    supabase
      .from("timesheet_thresholds")
      .select("*")
      .eq("organization_id", organizationId)
      .is("vertical_id", null)
      .maybeSingle(),
    supabase
      .from("holidays")
      .select("holiday_date, name")
      .eq("organization_id", organizationId),
    supabase
      .from("working_days")
      .select("*")
      .eq("organization_id", organizationId)
      .is("vertical_id", null)
      .maybeSingle(),
    supabase
      .from("activity_categories")
      .select("name")
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .not("parent_id", "is", null), // Only selectable (child) activities
  ]);

  // Process thresholds
  const thresholds = thresholdsRes.data ? {
    work_hours_enabled: thresholdsRes.data.work_hours_enabled,
    work_start_time: thresholdsRes.data.work_start_time || "08:30:00",
    work_end_time: thresholdsRes.data.work_end_time || "17:30:00",
    max_hours_enabled: thresholdsRes.data.max_hours_enabled,
    max_hours_minutes: thresholdsRes.data.max_hours_minutes || 480,
  } : null;

  // Process holidays
  const holidays: Holiday[] = holidaysRes.data || [];

  // Process working days
  const workingDays: WorkingDaysConfig = workingDaysRes.data ? {
    monday: workingDaysRes.data.monday,
    tuesday: workingDaysRes.data.tuesday,
    wednesday: workingDaysRes.data.wednesday,
    thursday: workingDaysRes.data.thursday,
    friday: workingDaysRes.data.friday,
    saturday: workingDaysRes.data.saturday,
    sunday: workingDaysRes.data.sunday,
  } : defaultWorkingDays;

  // Process activity types - get all activity names (case-insensitive)
  let activityTypes = activityCategoriesRes.data?.map(c => c.name.toLowerCase()) || [];
  
  // If no child activities, fetch all active categories
  if (activityTypes.length === 0) {
    const { data: allCategories } = await supabase
      .from("activity_categories")
      .select("name")
      .eq("organization_id", organizationId)
      .eq("is_active", true);
    activityTypes = allCategories?.map(c => c.name.toLowerCase()) || [];
  }

  return {
    thresholds,
    holidays,
    workingDays,
    activityTypes,
  };
}

/**
 * Check if a date is a holiday
 */
export function isHolidayDate(dateStr: string, holidays: Holiday[]): Holiday | null {
  return holidays.find(h => h.holiday_date === dateStr) || null;
}

/**
 * Check if a date is a working day
 */
export function isWorkingDayDate(dateStr: string, workingDays: WorkingDaysConfig): boolean {
  const date = new Date(dateStr);
  const dayIndex = date.getDay(); // 0=Sunday, 1=Monday, ...
  const dayMap: Record<number, keyof WorkingDaysConfig> = {
    0: 'sunday',
    1: 'monday',
    2: 'tuesday',
    3: 'wednesday',
    4: 'thursday',
    5: 'friday',
    6: 'saturday',
  };
  return workingDays[dayMap[dayIndex]];
}

/**
 * Validate entry date against holidays and working days
 */
export function validateDateAgainstHolidaysAndWorkingDays(
  entryDate: string,
  holidays: Holiday[],
  workingDays: WorkingDaysConfig
): ThresholdValidationResult {
  // Check holiday
  const holiday = isHolidayDate(entryDate, holidays);
  if (holiday) {
    return {
      valid: false,
      error: `Cannot create entries on holidays (${holiday.name})`,
    };
  }

  // Check working day
  if (!isWorkingDayDate(entryDate, workingDays)) {
    const date = new Date(entryDate);
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return {
      valid: false,
      error: `Cannot create entries on non-working days (${dayNames[date.getDay()]})`,
    };
  }

  return { valid: true };
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
