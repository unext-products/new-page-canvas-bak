import { supabase } from "@/integrations/supabase/client";

/**
 * Target resolution logic for multi-vertical faculty.
 * 
 * Rules:
 * - Each faculty can have a custom target per vertical (stored in user_settings)
 * - Primary vertical (from user_roles.vertical_id) defaults to org default (usually 8h)
 * - Non-primary verticals default to 0 hours (to avoid inflating total)
 * - Total daily target = sum of all vertical targets
 */

export interface VerticalTarget {
  verticalId: string;
  targetMinutes: number;
  isPrimary: boolean;
  isCustom: boolean;
}

/** @deprecated Use VerticalTarget instead */
export type DepartmentTarget = VerticalTarget;

export interface UserTargetBreakdown {
  userId: string;
  totalDailyTargetMinutes: number;
  orgDefaultMinutes: number;
  primaryVerticalId: string | null;
  /** @deprecated Use primaryVerticalId instead */
  primaryDepartmentId: string | null;
  verticalTargets: VerticalTarget[];
  /** @deprecated Use verticalTargets instead */
  departmentTargets: VerticalTarget[];
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
 * Fetch user's primary vertical ID from user_roles
 */
export async function fetchUserPrimaryVerticalId(userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("user_roles")
    .select("vertical_id, department_id")
    .eq("user_id", userId)
    .maybeSingle();
  
  return data?.vertical_id || data?.department_id || null;
}

/** @deprecated Use fetchUserPrimaryVerticalId instead */
export const fetchUserPrimaryDepartmentId = fetchUserPrimaryVerticalId;

/**
 * Fetch all vertical IDs the user belongs to from user_verticals junction table
 */
export async function fetchUserVerticalIds(userId: string): Promise<string[]> {
  const { data } = await supabase
    .from("user_verticals")
    .select("vertical_id")
    .eq("user_id", userId);
  
  // Fallback to user_departments if no user_verticals entries
  if (!data || data.length === 0) {
    const { data: deptData } = await supabase
      .from("user_departments")
      .select("department_id")
      .eq("user_id", userId);
    
    return deptData?.map(d => d.department_id) || [];
  }
  
  return data.map(d => d.vertical_id);
}

/** @deprecated Use fetchUserVerticalIds instead */
export const fetchUserDepartmentIds = fetchUserVerticalIds;

/**
 * Fetch user's custom target settings per vertical from user_settings
 * Returns a map of verticalId -> targetMinutes
 */
export async function fetchUserVerticalTargetMinutesMap(
  userId: string
): Promise<Record<string, number>> {
  const { data } = await supabase
    .from("user_settings")
    .select("vertical_id, department_id, value")
    .eq("user_id", userId)
    .eq("key", "daily_target_minutes");
  
  const map: Record<string, number> = {};
  data?.forEach(item => {
    const vertId = item.vertical_id || item.department_id;
    if (vertId && item.value) {
      map[vertId] = parseInt(item.value);
    }
  });
  
  return map;
}

/** @deprecated Use fetchUserVerticalTargetMinutesMap instead */
export const fetchUserDepartmentTargetMinutesMap = fetchUserVerticalTargetMinutesMap;

/**
 * Calculate effective target for a single department
 */
/**
 * Calculate effective target for a single vertical
 */
export function calculateEffectiveVerticalTargetMinutes(params: {
  verticalId: string;
  primaryVerticalId: string | null;
  customTargetMap: Record<string, number>;
  orgDefaultMinutes: number;
}): { minutes: number; isCustom: boolean } {
  const { verticalId, primaryVerticalId, customTargetMap, orgDefaultMinutes } = params;
  
  // If there's a custom setting for this vertical, use it
  if (customTargetMap[verticalId] !== undefined) {
    return { minutes: customTargetMap[verticalId], isCustom: true };
  }
  
  // If this is the primary vertical, use org default
  if (verticalId === primaryVerticalId) {
    return { minutes: orgDefaultMinutes, isCustom: false };
  }
  
  // Non-primary verticals without custom setting default to 0
  return { minutes: 0, isCustom: false };
}

/** @deprecated Use calculateEffectiveVerticalTargetMinutes instead */
export const calculateEffectiveDepartmentTargetMinutes = calculateEffectiveVerticalTargetMinutes;

/**
 * Calculate user's total daily target minutes across all their verticals
 * This is the main function to use for dashboards, reports, calendars
 */
export async function calculateUserTotalDailyTargetMinutes(
  userId: string
): Promise<UserTargetBreakdown> {
  // Fetch all required data in parallel
  const [orgDefaultMinutes, primaryVerticalId, verticalIds, customTargetMap] = await Promise.all([
    fetchOrgDefaultDailyTargetMinutes(),
    fetchUserPrimaryVerticalId(userId),
    fetchUserVerticalIds(userId),
    fetchUserVerticalTargetMinutesMap(userId),
  ]);
  
  // If user has no verticals, fallback to primary from user_roles or org default
  const effectiveVertIds = verticalIds.length > 0 
    ? verticalIds 
    : (primaryVerticalId ? [primaryVerticalId] : []);
  
  // Calculate target for each vertical
  const verticalTargets: VerticalTarget[] = effectiveVertIds.map(vertId => {
    const { minutes, isCustom } = calculateEffectiveVerticalTargetMinutes({
      verticalId: vertId,
      primaryVerticalId,
      customTargetMap,
      orgDefaultMinutes,
    });
    
    return {
      verticalId: vertId,
      targetMinutes: minutes,
      isPrimary: vertId === primaryVerticalId,
      isCustom,
    };
  });
  
  // Sum all vertical targets
  const totalDailyTargetMinutes = verticalTargets.reduce(
    (sum, vt) => sum + vt.targetMinutes, 
    0
  );
  
  // If no verticals at all, fallback to org default
  const finalTotal = effectiveVertIds.length === 0 ? orgDefaultMinutes : totalDailyTargetMinutes;
  
  return {
    userId,
    totalDailyTargetMinutes: finalTotal,
    orgDefaultMinutes,
    primaryVerticalId,
    primaryDepartmentId: primaryVerticalId, // backward compatibility
    verticalTargets,
    departmentTargets: verticalTargets, // backward compatibility
  };
}

/**
 * Calculate effective target for a user in a specific vertical context
 * Used in MemberTargetsSettings to show correct default per vertical
 */
export async function calculateUserVerticalTargetMinutes(
  userId: string,
  verticalId: string
): Promise<{ minutes: number; isCustom: boolean; isPrimary: boolean }> {
  const [orgDefaultMinutes, primaryVerticalId, customTargetMap] = await Promise.all([
    fetchOrgDefaultDailyTargetMinutes(),
    fetchUserPrimaryVerticalId(userId),
    fetchUserVerticalTargetMinutesMap(userId),
  ]);
  
  const { minutes, isCustom } = calculateEffectiveVerticalTargetMinutes({
    verticalId,
    primaryVerticalId,
    customTargetMap,
    orgDefaultMinutes,
  });
  
  return {
    minutes,
    isCustom,
    isPrimary: verticalId === primaryVerticalId,
  };
}

/** @deprecated Use calculateUserVerticalTargetMinutes instead */
export const calculateUserDepartmentTargetMinutes = calculateUserVerticalTargetMinutes;
