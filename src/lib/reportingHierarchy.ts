import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/reportQueries";
import { usesExpandedReportingScope } from "./reportingScopeMode";

/**
 * Fetch direct reportee IDs for a manager from the reporting_hierarchy table.
 */
export async function fetchDirectReportees(managerId: string): Promise<string[]> {
  const data = await fetchAllRows<{ user_id: string }>(supabase
    .from("reporting_hierarchy")
    .select("user_id")
    .eq("manager_id", managerId));
  return [...new Set(data.map((r) => r.user_id))];
}

/**
 * Fetch transitive reportees: direct reportees + their reportees (one level deep).
 * For L3: gets direct L2 reportees + the L1s that report to those L2s.
 */
export async function fetchAllReportees(managerId: string): Promise<string[]> {
  const directReportees = await fetchDirectReportees(managerId);
  if (directReportees.length === 0) return [];

  // Get reportees of direct reportees (transitive)
  const { data: transitiveData } = await supabase
    .from("reporting_hierarchy")
    .select("user_id")
    .in("manager_id", directReportees);

  const transitiveIds = transitiveData?.map((r) => r.user_id) || [];
  return [...new Set([...directReportees, ...transitiveIds])];
}

/**
 * Check if a manager has any reporting hierarchy configured.
 */
export async function hasReportingHierarchy(managerId: string): Promise<boolean> {
  const { count, error } = await supabase
    .from("reporting_hierarchy")
    .select("id", { count: "exact", head: true })
    .eq("manager_id", managerId);

  if (error) return false;
  return (count || 0) > 0;
}

/**
 * Approval and dashboard views remain direct-only, without membership fallback.
 */
export async function getVisibleUserIds(
  managerId: string,
  _role: string
): Promise<string[]> {
  return fetchDirectReportees(managerId);
}

/** Reports and Team include mapped L1s beneath an L3's directly mapped L2s. */
export async function getReportingUserIds(managerId: string, role: string): Promise<string[]> {
  if (!usesExpandedReportingScope(role)) return fetchDirectReportees(managerId);
  const { data, error } = await supabase.rpc("get_reporting_scope", { p_manager_id: managerId });
  if (error) throw error;
  return data || [];
}

/**
 * Save reportee assignments for a manager. Replaces all existing assignments.
 */
export async function saveReporteeAssignments(
  managerId: string,
  reporteeIds: string[]
): Promise<void> {
  // Delete existing
  const { error: deleteError } = await supabase
    .from("reporting_hierarchy")
    .delete()
    .eq("manager_id", managerId);

  if (deleteError) throw deleteError;

  // Insert new
  if (reporteeIds.length > 0) {
    const inserts = reporteeIds.map((userId) => ({
      user_id: userId,
      manager_id: managerId,
    }));

    const { error: insertError } = await supabase
      .from("reporting_hierarchy")
      .insert(inserts);

    if (insertError) throw insertError;
  }
}
