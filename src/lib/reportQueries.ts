import { supabase } from "@/integrations/supabase/client";

export interface ReportFilters {
  dateFrom?: string;
  dateTo?: string;
  departmentId?: string;
  userId?: string;
  status?: string;
  activityType?: string;
}

export async function fetchTimesheetEntries(filters: ReportFilters) {
  let query = supabase
    .from("timesheet_entries")
    .select("*")
    .order("entry_date", { ascending: false });

  if (filters.dateFrom) {
    query = query.gte("entry_date", filters.dateFrom);
  }
  if (filters.dateTo) {
    query = query.lte("entry_date", filters.dateTo);
  }
  if (filters.departmentId && filters.departmentId !== "all") {
    query = query.eq("department_id", filters.departmentId);
  }
  if (filters.userId && filters.userId !== "all") {
    query = query.eq("user_id", filters.userId);
  }
  if (filters.status && filters.status !== "all") {
    query = query.eq("status", filters.status as any);
  }
  if (filters.activityType && filters.activityType !== "all") {
    query = query.eq("activity_type", filters.activityType as any);
  }

  return query;
}

export async function calculateSummaryStats(entries: any[]) {
  const totalHours = entries.reduce((sum, e) => sum + e.duration_minutes, 0) / 60;
  const approvedHours = entries
    .filter(e => e.status === "approved")
    .reduce((sum, e) => sum + e.duration_minutes, 0) / 60;
  const pendingCount = entries.filter(e => e.status === "submitted").length;
  const rejectedCount = entries.filter(e => e.status === "rejected").length;

  return {
    totalEntries: entries.length,
    totalHours,
    approvedHours,
    pendingCount,
    rejectedCount,
  };
}

export function groupEntriesByDepartment(entries: any[]) {
  const grouped = entries.reduce((acc, entry) => {
    const deptId = entry.department_id;
    if (!acc[deptId]) {
      acc[deptId] = {
        entries: [],
        totalHours: 0,
      };
    }
    acc[deptId].entries.push(entry);
    acc[deptId].totalHours += entry.duration_minutes / 60;
    return acc;
  }, {} as Record<string, { entries: any[]; totalHours: number }>);

  return grouped;
}

export function groupEntriesByActivityType(entries: any[]) {
  const grouped = entries.reduce((acc, entry) => {
    const type = entry.activity_type;
    if (!acc[type]) {
      acc[type] = {
        count: 0,
        totalHours: 0,
      };
    }
    acc[type].count += 1;
    acc[type].totalHours += entry.duration_minutes / 60;
    return acc;
  }, {} as Record<string, { count: number; totalHours: number }>);

  return grouped;
}
