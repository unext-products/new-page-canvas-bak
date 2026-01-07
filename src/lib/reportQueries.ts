import { supabase } from "@/integrations/supabase/client";
import { differenceInDays, differenceInCalendarDays, eachDayOfInterval, format } from "date-fns";
import { calculateDurationMinutes } from "./timesheetUtils";

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

export interface DepartmentReportData {
  departmentId: string;
  departmentName: string;
  totalFaculty: number;
  totalHours: number;
  expectedHours: number;
  completionRate: number;
  activityBreakdown: ActivityBreakdown[];
  facultyBreakdown: FacultyBreakdown[];
  averageDailyHours: number;
}

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

  return query;
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

  const { data: entries, error } = await supabase
    .from("timesheet_entries")
    .select("*")
    .eq("user_id", userId)
    .gte("entry_date", dateFrom)
    .lte("entry_date", dateTo)
    .order("entry_date", { ascending: false });

  if (error) throw error;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", userId)
    .single();

  // Get ALL departments for the user from user_departments junction table
  const { data: userDepts } = await supabase
    .from("user_departments")
    .select("department_id")
    .eq("user_id", userId);

  const deptIds = userDepts?.map(ud => ud.department_id) || [];

  const { data: departments } = deptIds.length > 0
    ? await supabase
        .from("departments")
        .select("name")
        .in("id", deptIds)
    : { data: [] };

  // Join department names for display (e.g., "Banking, Mathematics")
  const departmentNames = departments?.map(d => d.name).join(", ") || "N/A";

  const totalMinutes = entries?.reduce((sum, e) => sum + getEntryDuration(e), 0) || 0;
  const totalHours = totalMinutes / 60;
  const expectedHours = calculateExpectedHours(period);
  const completionRate = calculateCompletionRate(totalMinutes, expectedHours * 60);
  const activityBreakdown = generateActivityBreakdown(entries || []);
  
  const workingDays = differenceInCalendarDays(period.dateTo, period.dateFrom) + 1;
  const averageDailyHours = workingDays > 0 ? totalHours / workingDays : 0;

  // Calculate status counts
  const approvedCount = entries?.filter(e => e.status === "approved").length || 0;
  const pendingCount = entries?.filter(e => e.status === "submitted").length || 0;

  return {
    userId,
    facultyName: profile?.full_name || "Unknown",
    department: departmentNames,
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

export async function fetchDepartmentReport(
  departmentId: string,
  period: ReportPeriod
): Promise<DepartmentReportData> {
  const dateFrom = format(period.dateFrom, "yyyy-MM-dd");
  const dateTo = format(period.dateTo, "yyyy-MM-dd");

  // Get department code if a specific department is selected (for filtering entries)
  let departmentCode: string | null = null;
  if (departmentId !== "all") {
    const { data: dept } = await supabase
      .from("departments")
      .select("code")
      .eq("id", departmentId)
      .single();
    departmentCode = dept?.code || null;
  }

  // Get users from user_departments junction table (not user_roles)
  let deptUsersQuery = supabase.from("user_departments").select("user_id");
  
  if (departmentId !== "all") {
    deptUsersQuery = deptUsersQuery.eq("department_id", departmentId);
  }
  
  const { data: deptUsers } = await deptUsersQuery;

  // Get unique user IDs (a user might appear multiple times if in multiple departments)
  const userIds = Array.from(new Set(deptUsers?.map(u => u.user_id) || []));

  let entries: any[] = [];
  if (userIds.length > 0) {
    let entriesQuery = supabase
      .from("timesheet_entries")
      .select("*")
      .in("user_id", userIds)
      .gte("entry_date", dateFrom)
      .lte("entry_date", dateTo)
      .order("entry_date", { ascending: false });

    // Filter by department_code when a specific department is selected
    if (departmentCode) {
      entriesQuery = entriesQuery.eq("department_code", departmentCode);
    }

    const { data, error } = await entriesQuery;

    if (error) throw error;
    entries = data || [];
  }

  const { data: department } = departmentId !== "all"
    ? await supabase
        .from("departments")
        .select("name")
        .eq("id", departmentId)
        .single()
    : { data: { name: "All Departments" } };

  const uniqueFacultyIds = Array.from(new Set(entries?.map(e => e.user_id) || []));
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", uniqueFacultyIds.length > 0 ? uniqueFacultyIds : ["no-id"]);

  const profileMap = new Map(profiles?.map(p => [p.id, p.full_name]) || []);

  const totalMinutes = entries?.reduce((sum, e) => sum + getEntryDuration(e), 0) || 0;
  const totalHours = totalMinutes / 60;
  const expectedHours = calculateExpectedHours(period) * uniqueFacultyIds.length;
  const completionRate = calculateCompletionRate(totalMinutes, expectedHours * 60);
  const activityBreakdown = generateActivityBreakdown(entries || []);

  const facultyBreakdown: FacultyBreakdown[] = uniqueFacultyIds.map(userId => {
    const userEntries = entries?.filter(e => e.user_id === userId) || [];
    const userMinutes = userEntries.reduce((sum, e) => sum + getEntryDuration(e), 0);
    const userExpectedMinutes = calculateExpectedHours(period) * 60;
    
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

  const workingDays = differenceInCalendarDays(period.dateTo, period.dateFrom) + 1;
  const averageDailyHours = workingDays > 0 ? totalHours / workingDays : 0;

  return {
    departmentId,
    departmentName: department?.name || "Unknown",
    totalFaculty: uniqueFacultyIds.length,
    totalHours,
    expectedHours,
    completionRate,
    activityBreakdown,
    facultyBreakdown,
    averageDailyHours,
  };
}

export function calculateExpectedHours(period: ReportPeriod, dailyTargetMinutes: number = 480): number {
  const workingDays = differenceInCalendarDays(period.dateTo, period.dateFrom) + 1;
  
  switch (period.type) {
    case "daily":
      return dailyTargetMinutes / 60;
    case "weekly":
      return Math.min(workingDays, 5) * (dailyTargetMinutes / 60);
    case "monthly":
      return Math.min(workingDays, 20) * (dailyTargetMinutes / 60);
    default:
      return workingDays * (dailyTargetMinutes / 60);
  }
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

export async function fetchFacultyList() {
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("is_active", true)
    .order("full_name");

  if (profilesError) throw profilesError;

  const userIds = profiles?.map(p => p.id) || [];
  const { data: roles, error: rolesError } = await supabase
    .from("user_roles")
    .select("user_id")
    .in("user_id", userIds)
    .eq("role", "faculty");

  if (rolesError) throw rolesError;

  const facultyIds = new Set(roles?.map(r => r.user_id) || []);
  return profiles?.filter(p => facultyIds.has(p.id)) || [];
}
