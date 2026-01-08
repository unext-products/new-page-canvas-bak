import { supabase } from "@/integrations/supabase/client";

/**
 * Target resolution logic for multi-department faculty.
 * 
 * Rules:
 * - Each faculty can have a custom target per department (stored in user_settings)
 * - Primary department (from user_roles.department_id) defaults to org default (usually 8h)
 * - Non-primary departments default to 0 hours (to avoid inflating total)
 * - Total daily target = sum of all department targets
 */

export interface DepartmentTarget {
  departmentId: string;
  targetMinutes: number;
  isPrimary: boolean;
  isCustom: boolean;
}

export interface UserTargetBreakdown {
  userId: string;
  totalDailyTargetMinutes: number;
  orgDefaultMinutes: number;
  primaryDepartmentId: string | null;
  departmentTargets: DepartmentTarget[];
}

/**
 * Fetch the organization-level default daily target minutes
 */
export async function fetchOrgDefaultDailyTargetMinutes(): Promise<number> {
  const { data } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "daily_target_minutes")
    .maybeSingle();
  
  return data?.value ? parseInt(data.value) : 480; // Default 8 hours
}

/**
 * Fetch user's primary department ID from user_roles
 */
export async function fetchUserPrimaryDepartmentId(userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("user_roles")
    .select("department_id")
    .eq("user_id", userId)
    .maybeSingle();
  
  return data?.department_id || null;
}

/**
 * Fetch all department IDs the user belongs to from user_departments junction table
 */
export async function fetchUserDepartmentIds(userId: string): Promise<string[]> {
  const { data } = await supabase
    .from("user_departments")
    .select("department_id")
    .eq("user_id", userId);
  
  return data?.map(d => d.department_id) || [];
}

/**
 * Fetch user's custom target settings per department from user_settings
 * Returns a map of departmentId -> targetMinutes
 */
export async function fetchUserDepartmentTargetMinutesMap(
  userId: string
): Promise<Record<string, number>> {
  const { data } = await supabase
    .from("user_settings")
    .select("department_id, value")
    .eq("user_id", userId)
    .eq("key", "daily_target_minutes");
  
  const map: Record<string, number> = {};
  data?.forEach(item => {
    if (item.department_id && item.value) {
      map[item.department_id] = parseInt(item.value);
    }
  });
  
  return map;
}

/**
 * Calculate effective target for a single department
 */
export function calculateEffectiveDepartmentTargetMinutes(params: {
  departmentId: string;
  primaryDepartmentId: string | null;
  customTargetMap: Record<string, number>;
  orgDefaultMinutes: number;
}): { minutes: number; isCustom: boolean } {
  const { departmentId, primaryDepartmentId, customTargetMap, orgDefaultMinutes } = params;
  
  // If there's a custom setting for this department, use it
  if (customTargetMap[departmentId] !== undefined) {
    return { minutes: customTargetMap[departmentId], isCustom: true };
  }
  
  // If this is the primary department, use org default
  if (departmentId === primaryDepartmentId) {
    return { minutes: orgDefaultMinutes, isCustom: false };
  }
  
  // Non-primary departments without custom setting default to 0
  return { minutes: 0, isCustom: false };
}

/**
 * Calculate user's total daily target minutes across all their departments
 * This is the main function to use for dashboards, reports, calendars
 */
export async function calculateUserTotalDailyTargetMinutes(
  userId: string
): Promise<UserTargetBreakdown> {
  // Fetch all required data in parallel
  const [orgDefaultMinutes, primaryDepartmentId, departmentIds, customTargetMap] = await Promise.all([
    fetchOrgDefaultDailyTargetMinutes(),
    fetchUserPrimaryDepartmentId(userId),
    fetchUserDepartmentIds(userId),
    fetchUserDepartmentTargetMinutesMap(userId),
  ]);
  
  // If user has no departments, fallback to primary from user_roles or org default
  const effectiveDeptIds = departmentIds.length > 0 
    ? departmentIds 
    : (primaryDepartmentId ? [primaryDepartmentId] : []);
  
  // Calculate target for each department
  const departmentTargets: DepartmentTarget[] = effectiveDeptIds.map(deptId => {
    const { minutes, isCustom } = calculateEffectiveDepartmentTargetMinutes({
      departmentId: deptId,
      primaryDepartmentId,
      customTargetMap,
      orgDefaultMinutes,
    });
    
    return {
      departmentId: deptId,
      targetMinutes: minutes,
      isPrimary: deptId === primaryDepartmentId,
      isCustom,
    };
  });
  
  // Sum all department targets
  const totalDailyTargetMinutes = departmentTargets.reduce(
    (sum, dt) => sum + dt.targetMinutes, 
    0
  );
  
  // If no departments at all, fallback to org default
  const finalTotal = effectiveDeptIds.length === 0 ? orgDefaultMinutes : totalDailyTargetMinutes;
  
  return {
    userId,
    totalDailyTargetMinutes: finalTotal,
    orgDefaultMinutes,
    primaryDepartmentId,
    departmentTargets,
  };
}

/**
 * Calculate effective target for a user in a specific department context
 * Used in MemberTargetsSettings to show correct default per department
 */
export async function calculateUserDepartmentTargetMinutes(
  userId: string,
  departmentId: string
): Promise<{ minutes: number; isCustom: boolean; isPrimary: boolean }> {
  const [orgDefaultMinutes, primaryDepartmentId, customTargetMap] = await Promise.all([
    fetchOrgDefaultDailyTargetMinutes(),
    fetchUserPrimaryDepartmentId(userId),
    fetchUserDepartmentTargetMinutesMap(userId),
  ]);
  
  const { minutes, isCustom } = calculateEffectiveDepartmentTargetMinutes({
    departmentId,
    primaryDepartmentId,
    customTargetMap,
    orgDefaultMinutes,
  });
  
  return {
    minutes,
    isCustom,
    isPrimary: departmentId === primaryDepartmentId,
  };
}
