import { supabase } from "@/integrations/supabase/client";
import { differenceInCalendarDays, eachDayOfInterval, format, isWeekend } from "date-fns";
import { calculateDurationMinutes } from "./timesheetUtils";
import { calculateUserTotalDailyTargetMinutes } from "./targets";

/**
 * Paginated fetch helper to overcome the default 1,000-row limit.
 * Accepts a Supabase query builder (before .range() is called) and
 * fetches all matching rows in PAGE_SIZE batches.
 */
export async function fetchAllRows<T = any>(
  queryBuilder: any,
  pageSize = 1000
): Promise<T[]> {
  const allData: T[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await queryBuilder.range(offset, offset + pageSize - 1);
    if (error) throw error;
    allData.push(...(data || []));
    if (!data || data.length < pageSize) break;
    offset += pageSize;
  }
  return allData;
}

export interface ReportFilters {
  dateFrom?: string;
  dateTo?: string;
  departmentId?: string;
  userId?: string;
  status?: string;
  activityType?: string;
}

export type PeriodType = "daily" | "weekly" | "monthly";

export interface ReportPeriod {
  type: PeriodType;
  dateFrom: Date;
  dateTo: Date;
}

export interface ActivityBreakdown {
  activityType: string;
  hours: number;
  percentage: number;
  count: number;
}

export interface FacultyReportData {
  userId: string;
  facultyName: string;
  email?: string;
  department: string;
  totalHours: number;
  expectedHours: number;
  completionRate: number;
  activityBreakdown: ActivityBreakdown[];
  entries: any[];
  averageDailyHours: number;
  approvedCount: number;
  pendingCount: number;
}

export interface VerticalReportData {
  verticalId: string;
  verticalName: string;
  totalFaculty: number;
  totalHours: number;
  expectedHours: number;
  completionRate: number;
  activityBreakdown: ActivityBreakdown[];
  facultyBreakdown: FacultyBreakdown[];
  averageDailyHours: number;
}

/** @deprecated Use VerticalReportData instead */
export type DepartmentReportData = VerticalReportData;

export interface FacultyBreakdown {
  userId: string;
  facultyName: string;
  totalHours: number;
  completionRate: number;
  entryCount: number;
  approvedCount: number;
  pendingCount: number;
}

// Helper function to get duration from an entry
const getEntryDuration = (entry: { start_time: string; end_time: string }) =>
  calculateDurationMinutes(entry.start_time, entry.end_time);

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
  if (filters.userId && filters.userId !== "all") {
    query = query.eq("user_id", filters.userId);
  }
  if (filters.status && filters.status !== "all") {
    query = query.eq("status", filters.status as any);
  }
  if (filters.activityType && filters.activityType !== "all") {
    query = query.eq("activity_type", filters.activityType as any);
  }

  // Use paginated fetch to avoid 1,000-row truncation
  const data = await fetchAllRows(query);
  return { data, error: null };
}

export async function calculateSummaryStats(entries: any[]) {
  const totalHours = entries.reduce((sum, e) => sum + getEntryDuration(e), 0) / 60;
  const approvedHours = entries
    .filter(e => e.status === "approved")
    .reduce((sum, e) => sum + getEntryDuration(e), 0) / 60;
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
  // Note: timesheet_entries doesn't have department_id column
  // This function groups by user_id instead
  const grouped = entries.reduce((acc, entry) => {
    const userId = entry.user_id;
    if (!acc[userId]) {
      acc[userId] = {
        entries: [],
        totalHours: 0,
      };
    }
    acc[userId].entries.push(entry);
    acc[userId].totalHours += getEntryDuration(entry) / 60;
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
    acc[type].totalHours += getEntryDuration(entry) / 60;
    return acc;
  }, {} as Record<string, { count: number; totalHours: number }>);

  return grouped;
}

export async function fetchFacultyReport(
  userId: string,
  period: ReportPeriod
): Promise<FacultyReportData> {
  const dateFrom = format(period.dateFrom, "yyyy-MM-dd");
  const dateTo = format(period.dateTo, "yyyy-MM-dd");

  // Fetch user's resolved daily target (sum across all departments)
  const targetBreakdown = await calculateUserTotalDailyTargetMinutes(userId);
  const userDailyTargetMinutes = targetBreakdown.totalDailyTargetMinutes;

  // Fetch entries, leave days, and profile (including deactivation date) in parallel
  const [entriesRes, leavesRes, profileRes] = await Promise.all([
    supabase
      .from("timesheet_entries")
      .select("*")
      .eq("user_id", userId)
      .gte("entry_date", dateFrom)
      .lte("entry_date", dateTo)
      .order("entry_date", { ascending: false }),
    supabase
      .from("leave_days")
      .select("leave_date, leave_type")
      .eq("user_id", userId)
      .gte("leave_date", dateFrom)
      .lte("leave_date", dateTo),
    supabase
      .from("profiles")
      .select("full_name, is_active, deactivated_at")
      .eq("id", userId)
      .single(),
  ]);

  if (entriesRes.error) throw entriesRes.error;
  const entries = entriesRes.data;
  const leaveMap = new Map<string, string>();
  leavesRes.data?.forEach(l => leaveMap.set(l.leave_date, (l as any).leave_type || 'other'));
  const leaveDates = new Set(leaveMap.keys());
  const profile = profileRes.data;

  // Get ALL verticals for the user from user_verticals junction table
  const { data: userVerts } = await supabase
    .from("user_verticals")
    .select("vertical_id")
    .eq("user_id", userId);

  // Fallback to user_departments for backward compatibility
  let vertIds = userVerts?.map(uv => uv.vertical_id) || [];
  if (vertIds.length === 0) {
    const { data: userDepts } = await supabase
      .from("user_departments")
      .select("department_id")
      .eq("user_id", userId);
    vertIds = userDepts?.map(ud => ud.department_id) || [];
  }

  const { data: verticals } = vertIds.length > 0
    ? await supabase
        .from("verticals")
        .select("name")
        .in("id", vertIds)
    : { data: [] };

  // Join vertical names for display (e.g., "Banking, Mathematics")
  const verticalNames = verticals?.map(v => v.name).join(", ") || "N/A";

  const totalMinutes = entries?.reduce((sum, e) => sum + getEntryDuration(e), 0) || 0;
  const totalHours = totalMinutes / 60;
  
  // Cap period end at deactivated_at for inactive users
  let effectivePeriodEnd = period.dateTo;
  if (profile && !profile.is_active && profile.deactivated_at) {
    const deactivatedDate = new Date(profile.deactivated_at);
    if (deactivatedDate < effectivePeriodEnd) {
      effectivePeriodEnd = deactivatedDate;
    }
  }
  // If effective end is before period start, no working days expected
  const effectiveStart = period.dateFrom > effectivePeriodEnd ? effectivePeriodEnd : period.dateFrom;
  
  // Calculate working days excluding weekends and leave days, capped at deactivation
  const workingDays = effectivePeriodEnd >= period.dateFrom 
    ? countWorkingDays(effectiveStart, effectivePeriodEnd, leaveDates, leaveMap)
    : 0;
  
  // Use user's resolved daily target for expected hours calculation
  const expectedHours = (workingDays * userDailyTargetMinutes) / 60;
  const completionRate = calculateCompletionRate(totalMinutes, expectedHours * 60);
  const activityBreakdown = generateActivityBreakdown(entries || []);
  
  const averageDailyHours = workingDays > 0 ? totalHours / workingDays : 0;

  // Calculate status counts
  const approvedCount = entries?.filter(e => e.status === "approved").length || 0;
  const pendingCount = entries?.filter(e => e.status === "submitted").length || 0;

  return {
    userId,
    facultyName: profile?.full_name || "Unknown",
    department: verticalNames,
    totalHours,
    expectedHours,
    completionRate,
    activityBreakdown,
    entries: entries || [],
    averageDailyHours,
    approvedCount,
    pendingCount,
  };
}

export async function fetchVerticalReport(
  verticalId: string,
  period: ReportPeriod
): Promise<VerticalReportData> {
  const dateFrom = format(period.dateFrom, "yyyy-MM-dd");
  const dateTo = format(period.dateTo, "yyyy-MM-dd");

  // Get vertical code if a specific vertical is selected (for filtering entries)
  let verticalCode: string | null = null;
  if (verticalId !== "all") {
    const { data: vert } = await supabase
      .from("verticals")
      .select("code")
      .eq("id", verticalId)
      .single();
    verticalCode = vert?.code || null;
  }

  // Get users from user_verticals junction table (with fallback to user_departments)
  let currentUserIds: string[] = [];
  
  if (verticalId !== "all") {
    const { data: vertUsers } = await supabase
      .from("user_verticals")
      .select("user_id")
      .eq("vertical_id", verticalId);
    
    currentUserIds = [...new Set(vertUsers?.map(u => u.user_id) || [])];
    
    // Fallback to user_departments if no user_verticals entries
    if (currentUserIds.length === 0) {
      const { data: deptUsers } = await supabase
        .from("user_departments")
        .select("user_id")
        .eq("department_id", verticalId);
      currentUserIds = [...new Set(deptUsers?.map(u => u.user_id) || [])];
    }
  } else {
    // Get all users from user_verticals
    const { data: allVertUsers } = await supabase
      .from("user_verticals")
      .select("user_id");
    currentUserIds = [...new Set(allVertUsers?.map(u => u.user_id) || [])];
    
    // Also include users from user_departments for backward compatibility
    if (currentUserIds.length === 0) {
      const { data: allDeptUsers } = await supabase
        .from("user_departments")
        .select("user_id");
      currentUserIds = [...new Set(allDeptUsers?.map(u => u.user_id) || [])];
    }
  }

  // Also discover historical users from timesheet_entries with matching vertical_code
  // This catches users who have been reassigned/moved to a dummy vertical
  let historicalUserIds: string[] = [];
  if (verticalCode) {
    const historicalQuery = supabase
      .from("timesheet_entries")
      .select("user_id")
      .or(`vertical_code.eq.${verticalCode},department_code.eq.${verticalCode}`)
      .gte("entry_date", dateFrom)
      .lte("entry_date", dateTo);
    const historicalEntries = await fetchAllRows(historicalQuery);
    historicalUserIds = [...new Set(historicalEntries.map(e => e.user_id))];
  }

  // Merge current + historical user IDs
  const userIds = [...new Set([...currentUserIds, ...historicalUserIds])];

  let entries: any[] = [];
  if (userIds.length > 0) {
    let entriesQuery = supabase
      .from("timesheet_entries")
      .select("*")
      .in("user_id", userIds)
      .gte("entry_date", dateFrom)
      .lte("entry_date", dateTo)
      .order("entry_date", { ascending: false });

    // Filter by vertical_code when a specific vertical is selected
    if (verticalCode) {
      entriesQuery = entriesQuery.or(`vertical_code.eq.${verticalCode},department_code.eq.${verticalCode}`);
    }

    // Use paginated fetch to avoid 1,000-row truncation
    entries = await fetchAllRows(entriesQuery);
  }

  const { data: vertical } = verticalId !== "all"
    ? await supabase
        .from("verticals")
        .select("name")
        .eq("id", verticalId)
        .single()
    : { data: { name: "All Verticals" } };

  const uniqueFacultyIds = Array.from(new Set(entries?.map(e => e.user_id) || []));
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, is_active, deactivated_at")
    .in("id", uniqueFacultyIds.length > 0 ? uniqueFacultyIds : ["no-id"]);

  const profileMap = new Map(profiles?.map(p => [p.id, p.full_name]) || []);
  const profileDataMap = new Map(profiles?.map(p => [p.id, p]) || []);

  const totalMinutes = entries?.reduce((sum, e) => sum + getEntryDuration(e), 0) || 0;
  const totalHours = totalMinutes / 60;
  
  // Calculate expected hours per faculty, capping at deactivation date for inactive users
  let totalExpectedHours = 0;
  const facultyBreakdown: FacultyBreakdown[] = uniqueFacultyIds.map(userId => {
    const userEntries = entries?.filter(e => e.user_id === userId) || [];
    const userMinutes = userEntries.reduce((sum, e) => sum + getEntryDuration(e), 0);
    
    // Cap period end at deactivation date for inactive users
    const profileData = profileDataMap.get(userId);
    let effectiveEnd = period.dateTo;
    if (profileData && !profileData.is_active && profileData.deactivated_at) {
      const deactivatedDate = new Date(profileData.deactivated_at);
      if (deactivatedDate < effectiveEnd) {
        effectiveEnd = deactivatedDate;
      }
    }
    const userExpectedHours = effectiveEnd >= period.dateFrom 
      ? calculateExpectedHours({ ...period, dateTo: effectiveEnd })
      : 0;
    const userExpectedMinutes = userExpectedHours * 60;
    totalExpectedHours += userExpectedHours;
    
    return {
      userId,
      facultyName: profileMap.get(userId) || "Unknown",
      totalHours: userMinutes / 60,
      completionRate: calculateCompletionRate(userMinutes, userExpectedMinutes),
      entryCount: userEntries.length,
      approvedCount: userEntries.filter(e => e.status === "approved").length,
      pendingCount: userEntries.filter(e => e.status === "submitted").length,
    };
  });

  const completionRate = calculateCompletionRate(totalMinutes, totalExpectedHours * 60);
  const activityBreakdown = generateActivityBreakdown(entries || []);

  const workingDays = differenceInCalendarDays(period.dateTo, period.dateFrom) + 1;
  const averageDailyHours = workingDays > 0 ? totalHours / workingDays : 0;

  return {
    verticalId,
    verticalName: vertical?.name || "Unknown",
    totalFaculty: uniqueFacultyIds.length,
    totalHours,
    expectedHours: totalExpectedHours,
    completionRate,
    activityBreakdown,
    facultyBreakdown,
    averageDailyHours,
  };
}

/** @deprecated Use fetchVerticalReport instead */
export const fetchDepartmentReport = fetchVerticalReport;

// Helper to count working days (excluding weekends and leave days, with half-day support)
export function countWorkingDays(
  dateFrom: Date, 
  dateTo: Date, 
  leaveDates: Set<string> = new Set(),
  leaveTypeMap?: Map<string, string>
): number {
  const { getLeaveWeight } = require("@/lib/leaveUtils");
  const allDays = eachDayOfInterval({ start: dateFrom, end: dateTo });
  let count = 0;
  for (const day of allDays) {
    if (isWeekend(day)) continue;
    const dateStr = format(day, "yyyy-MM-dd");
    if (leaveDates.has(dateStr)) {
      if (leaveTypeMap) {
        const leaveType = leaveTypeMap.get(dateStr) || "other";
        count += 1 - getLeaveWeight(leaveType); // half-day = +0.5, full-day = +0
      }
      // If no leaveTypeMap, treat as full-day leave (skip entirely)
      continue;
    }
    count += 1;
  }
  return count;
}

export function calculateExpectedHours(period: ReportPeriod, dailyTargetMinutes: number = 480): number {
  // This function is now mainly used for department reports where we don't have per-user leave data
  // For faculty reports, we calculate expected hours directly using countWorkingDays
  const allDays = eachDayOfInterval({ start: period.dateFrom, end: period.dateTo });
  const workingDays = allDays.filter(day => !isWeekend(day)).length;
  return (workingDays * dailyTargetMinutes) / 60;
}

export function calculateCompletionRate(actualMinutes: number, expectedMinutes: number): number {
  if (expectedMinutes === 0) return 0;
  return (actualMinutes / expectedMinutes) * 100;
}

export function generateActivityBreakdown(entries: any[]): ActivityBreakdown[] {
  if (entries.length === 0) return [];

  const totalMinutes = entries.reduce((sum, e) => sum + getEntryDuration(e), 0);
  const grouped = groupEntriesByActivityType(entries);

  return Object.entries(grouped).map(([activityType, data]) => {
    const typedData = data as { count: number; totalHours: number };
    return {
      activityType,
      hours: typedData.totalHours,
      percentage: totalMinutes > 0 ? (typedData.totalHours * 60 / totalMinutes) * 100 : 0,
      count: typedData.count,
    };
  });
}

export function groupEntriesByPeriod(
  entries: any[],
  periodType: PeriodType
): Record<string, any[]> {
  return entries.reduce((acc, entry) => {
    let key: string;
    const date = new Date(entry.entry_date);

    switch (periodType) {
      case "daily":
        key = format(date, "yyyy-MM-dd");
        break;
      case "weekly":
        key = format(date, "'Week' w, yyyy");
        break;
      case "monthly":
        key = format(date, "MMMM yyyy");
        break;
      default:
        key = format(date, "yyyy-MM-dd");
    }

    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(entry);
    return acc;
  }, {} as Record<string, any[]>);
}

export async function fetchFacultyList(includeInactive = false) {
  let query = supabase
    .from("profiles")
    .select("id, full_name, is_active")
    .order("full_name");

  if (!includeInactive) {
    query = query.eq("is_active", true);
  }

  const { data: profiles, error: profilesError } = await query;

  if (profilesError) throw profilesError;

  const userIds = profiles?.map(p => p.id) || [];
  const { data: roles, error: rolesError } = await supabase
    .from("user_roles")
    .select("user_id")
    .in("user_id", userIds)
    .in("role", ["l1", "l2", "faculty", "program_manager"]);

  if (rolesError) throw rolesError;

  const facultyIds = new Set(roles?.map(r => r.user_id) || []);
  return profiles?.filter(p => facultyIds.has(p.id)) || [];
}
