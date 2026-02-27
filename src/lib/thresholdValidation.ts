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
export async function fetchUserThresholds(userId: string, entryVerticalId?: string | null): Promise<Thresholds | null> {
  // Get user's organization (and vertical as fallback)
  const { data: userRole } = await supabase
    .from("user_roles")
    .select("organization_id, vertical_id")
    .eq("user_id", userId)
    .limit(1);

  const role = userRole?.[0];
  if (!role?.organization_id) return null;

  // Use entry's vertical if provided, otherwise fall back to user's primary vertical
  const verticalId = entryVerticalId || role.vertical_id;

  // If we have a vertical, check vertical-specific thresholds first
  if (verticalId) {
    const { data: verticalThresholds } = await supabase
      .from("timesheet_thresholds")
      .select("*")
      .eq("organization_id", role.organization_id)
      .eq("vertical_id", verticalId)
      .order("updated_at", { ascending: false })
      .limit(1);

    const vt = verticalThresholds?.[0];
    if (vt) {
      return {
        work_hours_enabled: vt.work_hours_enabled,
        work_start_time: vt.work_start_time || "08:30:00",
        work_end_time: vt.work_end_time || "17:30:00",
        max_hours_enabled: vt.max_hours_enabled,
        max_hours_minutes: vt.max_hours_minutes || 480,
      };
    }
  }

  // Fall back to org-wide thresholds
  const { data: orgThresholds } = await supabase
    .from("timesheet_thresholds")
    .select("*")
    .eq("organization_id", role.organization_id)
    .is("vertical_id", null)
    .order("updated_at", { ascending: false })
    .limit(1);

  const ot = orgThresholds?.[0];
  if (!ot) return null;

  return {
    work_hours_enabled: ot.work_hours_enabled,
    work_start_time: ot.work_start_time || "08:30:00",
    work_end_time: ot.work_end_time || "17:30:00",
    max_hours_enabled: ot.max_hours_enabled,
    max_hours_minutes: ot.max_hours_minutes || 480,
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
    .order("updated_at", { ascending: false })
    .limit(1);

  const t = thresholds?.[0];
  if (!t) return null;

  return {
    work_hours_enabled: t.work_hours_enabled,
    work_start_time: t.work_start_time || "08:30:00",
    work_end_time: t.work_end_time || "17:30:00",
    max_hours_enabled: t.max_hours_enabled,
    max_hours_minutes: t.max_hours_minutes || 480,
  };
}

/**
 * Fetch extended validation context for bulk import
 */
export async function fetchExtendedValidationContext(userId: string): Promise<ExtendedValidationContext> {
  // Get user's organization AND vertical
  const { data: userRoles } = await supabase
    .from("user_roles")
    .select("organization_id, vertical_id")
    .eq("user_id", userId)
    .limit(1);
  const userRole = userRoles?.[0] || null;

  const organizationId = userRole?.organization_id;
  const verticalId = userRole?.vertical_id;

  if (!organizationId) {
    return {
      thresholds: null,
      holidays: [],
      workingDays: defaultWorkingDays,
      activityTypes: [],
    };
  }

  // Build base queries
  const orgThresholdsQuery = supabase
    .from("timesheet_thresholds")
    .select("*")
    .eq("organization_id", organizationId)
    .is("vertical_id", null)
    .order("updated_at", { ascending: false })
    .limit(1);

  const orgHolidaysQuery = supabase
    .from("holidays")
    .select("holiday_date, name")
    .eq("organization_id", organizationId)
    .is("vertical_id", null);

  const orgWorkingDaysQuery = supabase
    .from("working_days")
    .select("*")
    .eq("organization_id", organizationId)
    .is("vertical_id", null)
    .order("updated_at", { ascending: false })
    .limit(1);

  const activityCategoriesQuery = supabase
    .from("activity_categories")
    .select("name")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .not("parent_id", "is", null);

  // Fetch all in parallel (including vertical-specific if applicable)
  const [orgThresholdsRes, orgHolidaysRes, orgWorkingDaysRes, activityCategoriesRes,
         verticalThresholdsRes, verticalHolidaysRes, verticalWorkingDaysRes] = await Promise.all([
    orgThresholdsQuery,
    orgHolidaysQuery,
    orgWorkingDaysQuery,
    activityCategoriesQuery,
    verticalId
      ? supabase.from("timesheet_thresholds").select("*").eq("organization_id", organizationId).eq("vertical_id", verticalId).order("updated_at", { ascending: false }).limit(1)
      : Promise.resolve({ data: null }),
    verticalId
      ? supabase.from("holidays").select("holiday_date, name").eq("organization_id", organizationId).eq("vertical_id", verticalId)
      : Promise.resolve({ data: null }),
    verticalId
      ? supabase.from("working_days").select("*").eq("organization_id", organizationId).eq("vertical_id", verticalId).order("updated_at", { ascending: false }).limit(1)
      : Promise.resolve({ data: null }),
  ]);

  // Process thresholds: vertical-specific first, fall back to org-wide
  const vtData = Array.isArray(verticalThresholdsRes?.data) ? verticalThresholdsRes.data[0] : verticalThresholdsRes?.data;
  const otData = Array.isArray(orgThresholdsRes.data) ? orgThresholdsRes.data[0] : orgThresholdsRes.data;
  const thresholdsData = vtData || otData;
  const thresholds = thresholdsData ? {
    work_hours_enabled: thresholdsData.work_hours_enabled,
    work_start_time: thresholdsData.work_start_time || "08:30:00",
    work_end_time: thresholdsData.work_end_time || "17:30:00",
    max_hours_enabled: thresholdsData.max_hours_enabled,
    max_hours_minutes: thresholdsData.max_hours_minutes || 480,
  } : null;

  // Process holidays: merge org-wide + vertical-specific (union)
  const orgHolidays: Holiday[] = orgHolidaysRes.data || [];
  const verticalHolidays: Holiday[] = verticalHolidaysRes?.data || [];
  const holidays = [...orgHolidays, ...verticalHolidays];

  // Process working days: vertical-specific first, fall back to org-wide
  const vwData = Array.isArray(verticalWorkingDaysRes?.data) ? verticalWorkingDaysRes.data[0] : verticalWorkingDaysRes?.data;
  const owData = Array.isArray(orgWorkingDaysRes.data) ? orgWorkingDaysRes.data[0] : orgWorkingDaysRes.data;
  const workingDaysData = vwData || owData;
  const workingDays: WorkingDaysConfig = workingDaysData ? {
    monday: workingDaysData.monday,
    tuesday: workingDaysData.tuesday,
    wednesday: workingDaysData.wednesday,
    thursday: workingDaysData.thursday,
    friday: workingDaysData.friday,
    saturday: workingDaysData.saturday,
    sunday: workingDaysData.sunday,
  } : defaultWorkingDays;

  // Process activity types
  let activityTypes = activityCategoriesRes.data?.map((c: any) => c.name.toLowerCase()) || [];
  
  if (activityTypes.length === 0) {
    const { data: allCategories } = await supabase
      .from("activity_categories")
      .select("name")
      .eq("organization_id", organizationId)
      .eq("is_active", true);
    activityTypes = allCategories?.map((c: any) => c.name.toLowerCase()) || [];
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
