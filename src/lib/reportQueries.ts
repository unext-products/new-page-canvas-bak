import { supabase } from "@/integrations/supabase/client";
import { differenceInCalendarDays, eachDayOfInterval, format, isWeekend } from "date-fns";
import { calculateDurationMinutes } from "./timesheetUtils";
import { calculateUserTotalDailyTargetMinutes } from "./targets";
import { getLeaveWeight } from "./leaveUtils";

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

export interface ExpectedHoursBreakdown {
  totalDays: number;
  leaveDays: number;
  holidayDays: number;
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
  expectedHoursBreakdown?: ExpectedHoursBreakdown;
}

export interface NonStarterEntry {
  userId: string;
  facultyName: string;
  email: string;
  verticalName: string;
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
  nonStarters: NonStarterEntry[];
  averageDailyHours: number;
}

/** @deprecated Use VerticalReportData instead */
export type DepartmentReportData = VerticalReportData;

export interface FacultyBreakdown {
  userId: string;
  facultyName: string;
  email: string;
  verticalName: string;
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

function normalizeActivityType(type: string): string {
  return type
    .replace(/_/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function groupEntriesByActivityType(entries: any[]) {
  const grouped = entries.reduce((acc, entry) => {
    const rawType = entry.activity_type || '';
    const type = normalizeActivityType(rawType);
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

  // Fetch entries, leave days, profile, and org holidays in parallel
  const [entriesRes, leavesRes, profileRes, orgIdRes] = await Promise.all([
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
    supabase
      .from("user_roles")
      .select("organization_id")
      .eq("user_id", userId)
      .single(),
  ]);

  if (entriesRes.error) throw entriesRes.error;
  const entries = entriesRes.data;
  const leaveMap = new Map<string, string>();
  leavesRes.data?.forEach(l => leaveMap.set(l.leave_date, (l as any).leave_type || 'other'));
  const leaveDates = new Set(leaveMap.keys());
  const profile = profileRes.data;

  // Fetch holidays for user's org
  const orgId = orgIdRes.data?.organization_id;
  let holidayDates = new Set<string>();
  if (orgId) {
    const { data: holidays } = await supabase
      .from("holidays")
      .select("holiday_date")
      .eq("organization_id", orgId)
      .gte("holiday_date", dateFrom)
      .lte("holiday_date", dateTo);
    holidayDates = new Set(holidays?.map(h => h.holiday_date) || []);
  }

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
  
  // Calculate working days excluding weekends, holidays, and leave days
  const workingDays = effectivePeriodEnd >= period.dateFrom 
    ? countWorkingDays(effectiveStart, effectivePeriodEnd, leaveDates, leaveMap, holidayDates)
    : 0;

  // Calculate breakdown for expected hours display
  const allPeriodDays = effectivePeriodEnd >= period.dateFrom
    ? eachDayOfInterval({ start: effectiveStart, end: effectivePeriodEnd })
    : [];
  const weekdaysInPeriod = allPeriodDays.filter(day => !isWeekend(day));
  const holidayCount = weekdaysInPeriod.filter(day => holidayDates.has(format(day, "yyyy-MM-dd"))).length;
  const leaveCount = weekdaysInPeriod.filter(day => {
    const dateStr = format(day, "yyyy-MM-dd");
    return !holidayDates.has(dateStr) && leaveDates.has(dateStr);
  }).reduce((sum, day) => {
    const dateStr = format(day, "yyyy-MM-dd");
    const leaveType = leaveMap.get(dateStr) || "other";
    return sum + getLeaveWeight(leaveType);
  }, 0);
  
  // Use user's resolved daily target for expected hours calculation
  const expectedHours = (workingDays * userDailyTargetMinutes) / 60;
  const completionRate = calculateCompletionRate(totalMinutes, expectedHours * 60);
  const activityBreakdown = generateActivityBreakdown(entries || []);
  
  const averageDailyHours = workingDays > 0 ? totalHours / workingDays : 0;

  // Calculate status counts
  const approvedCount = entries?.filter(e => e.status === "approved").length || 0;
  const pendingCount = entries?.filter(e => e.status === "submitted").length || 0;

  // Resolve program, vertical, and approver names for entries
  const programIds = [...new Set((entries || []).map(e => e.program_id).filter(Boolean))];
  const verticalIds = [...new Set((entries || []).map(e => e.vertical_id).filter(Boolean))];
  const approverIds = [...new Set((entries || []).map(e => e.approved_by).filter(Boolean))];

  const [programsRes, verticalsRes, approversRes] = await Promise.all([
    programIds.length > 0
      ? supabase.from("programs").select("id, name").in("id", programIds)
      : Promise.resolve({ data: [] }),
    verticalIds.length > 0
      ? supabase.from("verticals").select("id, name").in("id", verticalIds)
      : Promise.resolve({ data: [] }),
    approverIds.length > 0
      ? supabase.from("profiles").select("id, full_name").in("id", approverIds)
      : Promise.resolve({ data: [] }),
  ]);

  const programMap = new Map((programsRes.data || []).map(p => [p.id, p.name]));
  const verticalMap = new Map((verticalsRes.data || []).map(v => [v.id, v.name]));
  const approverMap = new Map((approversRes.data || []).map(a => [a.id, a.full_name]));

  const enrichedEntries = (entries || []).map(e => ({
    ...e,
    _programName: e.program_id ? (programMap.get(e.program_id) || "N/A") : "N/A",
    _verticalName: e.vertical_id ? (verticalMap.get(e.vertical_id) || "N/A") : "N/A",
    _approvedByName: e.approved_by ? (approverMap.get(e.approved_by) || "") : "",
  }));

  return {
    userId,
    facultyName: profile?.full_name || "Unknown",
    department: verticalNames,
    totalHours,
    expectedHours,
    completionRate,
    activityBreakdown,
    entries: enrichedEntries,
    averageDailyHours,
    approvedCount,
    pendingCount,
    expectedHoursBreakdown: {
      totalDays: weekdaysInPeriod.length,
      leaveDays: leaveCount,
      holidayDays: holidayCount,
    },
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

  // Identify non-starters: users in userIds but not in uniqueFacultyIds (no entries)
  const facultyIdSet = new Set(uniqueFacultyIds);
  const nonStarterIds = userIds.filter(id => !facultyIdSet.has(id));

  // Fetch profiles for non-starters (only active users)
  const { data: nonStarterProfiles } = nonStarterIds.length > 0
    ? await supabase.from("profiles").select("id, full_name, email, is_active").in("id", nonStarterIds).eq("is_active", true)
    : { data: [] };

  // Exclude admin/super_admin roles from non-starters (they don't submit timesheets)
  let filteredNonStarterProfiles = nonStarterProfiles || [];
  if (filteredNonStarterProfiles.length > 0) {
    const { data: nonStarterRoles } = await supabase
      .from("user_roles")
      .select("user_id, role")
      .in("user_id", filteredNonStarterProfiles.map(p => p.id));
    const adminUserIds = new Set(
      (nonStarterRoles || [])
        .filter(r => r.role === 'org_admin' || r.role === 'super_admin')
        .map(r => r.user_id)
    );
    filteredNonStarterProfiles = filteredNonStarterProfiles.filter(p => !adminUserIds.has(p.id));
  }

  // Fetch vertical names for non-starters
  const { data: nonStarterVertData } = nonStarterIds.length > 0
    ? await supabase.from("user_verticals").select("user_id, vertical_id, verticals(name)").in("user_id", nonStarterIds)
    : { data: [] };

  const nonStarterVertNameMap = new Map<string, string>();
  (nonStarterVertData || []).forEach((uv: any) => {
    const vName = uv.verticals?.name || "";
    const existing = nonStarterVertNameMap.get(uv.user_id);
    nonStarterVertNameMap.set(uv.user_id, existing ? `${existing}, ${vName}` : vName);
  });

  const nonStarters: NonStarterEntry[] = (filteredNonStarterProfiles || []).map(p => ({
    userId: p.id,
    facultyName: p.full_name,
    email: p.email || "",
    verticalName: nonStarterVertNameMap.get(p.id) || "",
  }));

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, email, is_active, deactivated_at")
    .in("id", uniqueFacultyIds.length > 0 ? uniqueFacultyIds : ["no-id"]);

  const profileMap = new Map(profiles?.map(p => [p.id, p.full_name]) || []);
  const profileEmailMap = new Map(profiles?.map(p => [p.id, p.email || ""]) || []);
  const profileDataMap = new Map(profiles?.map(p => [p.id, p]) || []);

  // Fetch vertical names for each faculty
  const { data: userVerticalData } = await supabase
    .from("user_verticals")
    .select("user_id, vertical_id, verticals(name)")
    .in("user_id", uniqueFacultyIds.length > 0 ? uniqueFacultyIds : ["no-id"]);

  const userVerticalNameMap = new Map<string, string>();
  userVerticalData?.forEach((uv: any) => {
    const vName = uv.verticals?.name || "";
    const existing = userVerticalNameMap.get(uv.user_id);
    userVerticalNameMap.set(uv.user_id, existing ? `${existing}, ${vName}` : vName);
  });

  const totalMinutes = entries?.reduce((sum, e) => sum + getEntryDuration(e), 0) || 0;
  const totalHours = totalMinutes / 60;

  // Fetch org holidays once for all faculty
  let orgHolidayDates = new Set<string>();
  if (uniqueFacultyIds.length > 0) {
    const { data: orgIdData } = await supabase
      .from("user_roles")
      .select("organization_id")
      .eq("user_id", uniqueFacultyIds[0])
      .single();
    if (orgIdData?.organization_id) {
      const { data: holidays } = await supabase
        .from("holidays")
        .select("holiday_date")
        .eq("organization_id", orgIdData.organization_id)
        .gte("holiday_date", dateFrom)
        .lte("holiday_date", dateTo);
      orgHolidayDates = new Set(holidays?.map(h => h.holiday_date) || []);
    }
  }

  // Fetch per-user daily targets and leaves in parallel
  const [userTargets, userLeaves] = await Promise.all([
    Promise.all(uniqueFacultyIds.map(uid => calculateUserTotalDailyTargetMinutes(uid))),
    Promise.all(uniqueFacultyIds.map(uid =>
      supabase
        .from("leave_days")
        .select("leave_date, leave_type")
        .eq("user_id", uid)
        .gte("leave_date", dateFrom)
        .lte("leave_date", dateTo)
        .then(res => res.data || [])
    )),
  ]);

  const userTargetMap = new Map(uniqueFacultyIds.map((uid, i) => [uid, userTargets[i].totalDailyTargetMinutes]));
  const userLeaveMap = new Map(uniqueFacultyIds.map((uid, i) => {
    const leaveTypeMap = new Map<string, string>();
    const leaveDateSet = new Set<string>();
    userLeaves[i].forEach((l: any) => {
      leaveTypeMap.set(l.leave_date, l.leave_type || 'other');
      leaveDateSet.add(l.leave_date);
    });
    return [uid, { leaveDates: leaveDateSet, leaveTypeMap }] as const;
  }));
  
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

    const userDailyTarget = userTargetMap.get(userId) || 480;
    const userLeaveData = userLeaveMap.get(userId) || { leaveDates: new Set<string>(), leaveTypeMap: new Map<string, string>() };
    
    const workingDays = effectiveEnd >= period.dateFrom
      ? countWorkingDays(period.dateFrom, effectiveEnd, userLeaveData.leaveDates, userLeaveData.leaveTypeMap, orgHolidayDates)
      : 0;
    const userExpectedHours = (workingDays * userDailyTarget) / 60;
    const userExpectedMinutes = userExpectedHours * 60;
    totalExpectedHours += userExpectedHours;
    
    return {
      userId,
      facultyName: profileMap.get(userId) || "Unknown",
      email: profileEmailMap.get(userId) || "",
      verticalName: userVerticalNameMap.get(userId) || "",
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
    totalFaculty: uniqueFacultyIds.length + nonStarters.length,
    totalHours,
    expectedHours: totalExpectedHours,
    completionRate,
    activityBreakdown,
    facultyBreakdown,
    nonStarters,
    averageDailyHours,
  };
}

/** @deprecated Use fetchVerticalReport instead */
export const fetchDepartmentReport = fetchVerticalReport;

/**
 * Fetch aggregated report for ALL members (used when "All Members" is selected in member view).
 * Returns a FacultyReportData with all entries combined.
 */
export async function fetchAllMembersReport(
  period: ReportPeriod
): Promise<FacultyReportData> {
  const dateFrom = format(period.dateFrom, "yyyy-MM-dd");
  const dateTo = format(period.dateTo, "yyyy-MM-dd");

  // Fetch all entries for the period
  const entriesQuery = supabase
    .from("timesheet_entries")
    .select("*")
    .gte("entry_date", dateFrom)
    .lte("entry_date", dateTo)
    .order("entry_date", { ascending: false });

  const entries = await fetchAllRows(entriesQuery);

  const uniqueUserIds = [...new Set(entries.map(e => e.user_id))];

  // Fetch profiles for all users
  const { data: profiles } = uniqueUserIds.length > 0
    ? await supabase.from("profiles").select("id, full_name, email, is_active, deactivated_at").in("id", uniqueUserIds)
    : { data: [] };

  const profileMap = new Map((profiles || []).map(p => [p.id, p]));

  // Resolve program, vertical, and approver names
  const programIds = [...new Set(entries.map(e => e.program_id).filter(Boolean))];
  const verticalIds = [...new Set(entries.map(e => e.vertical_id).filter(Boolean))];
  const approverIds = [...new Set(entries.map(e => e.approved_by).filter(Boolean))];

  const [programsRes, verticalsRes, approversRes] = await Promise.all([
    programIds.length > 0
      ? supabase.from("programs").select("id, name").in("id", programIds)
      : Promise.resolve({ data: [] }),
    verticalIds.length > 0
      ? supabase.from("verticals").select("id, name").in("id", verticalIds)
      : Promise.resolve({ data: [] }),
    approverIds.length > 0
      ? supabase.from("profiles").select("id, full_name").in("id", approverIds)
      : Promise.resolve({ data: [] }),
  ]);

  const programNameMap = new Map((programsRes.data || []).map(p => [p.id, p.name]));
  const verticalNameMap = new Map((verticalsRes.data || []).map(v => [v.id, v.name]));
  const approverNameMap = new Map((approversRes.data || []).map(a => [a.id, a.full_name]));

  const enrichedEntries = entries.map(e => ({
    ...e,
    _programName: e.program_id ? (programNameMap.get(e.program_id) || "N/A") : "N/A",
    _verticalName: e.vertical_id ? (verticalNameMap.get(e.vertical_id) || "N/A") : "N/A",
    _approvedByName: e.approved_by ? (approverNameMap.get(e.approved_by) || "") : "",
    _facultyName: profileMap.get(e.user_id)?.full_name || "Unknown",
  }));

  const totalMinutes = entries.reduce((sum, e) => sum + getEntryDuration(e), 0);
  const totalHours = totalMinutes / 60;

  // Calculate expected hours: sum across all unique users
  let totalExpectedMinutes = 0;
  for (const userId of uniqueUserIds) {
    const targetBreakdown = await calculateUserTotalDailyTargetMinutes(userId);
    const userDailyTarget = targetBreakdown.totalDailyTargetMinutes;

    const profile = profileMap.get(userId);
    let effectiveEnd = period.dateTo;
    if (profile && !profile.is_active && profile.deactivated_at) {
      const deactivatedDate = new Date(profile.deactivated_at);
      if (deactivatedDate < effectiveEnd) effectiveEnd = deactivatedDate;
    }

    const { data: userLeaves } = await supabase
      .from("leave_days")
      .select("leave_date, leave_type")
      .eq("user_id", userId)
      .gte("leave_date", dateFrom)
      .lte("leave_date", dateTo);

    const leaveMap = new Map<string, string>();
    const leaveDates = new Set<string>();
    (userLeaves || []).forEach((l: any) => {
      leaveMap.set(l.leave_date, l.leave_type || "other");
      leaveDates.add(l.leave_date);
    });

    // Get org holidays (use first user's org for simplicity since all are typically same org)
    let holidayDates = new Set<string>();
    if (userId === uniqueUserIds[0]) {
      const { data: orgData } = await supabase
        .from("user_roles")
        .select("organization_id")
        .eq("user_id", userId)
        .single();
      if (orgData?.organization_id) {
        const { data: holidays } = await supabase
          .from("holidays")
          .select("holiday_date")
          .eq("organization_id", orgData.organization_id)
          .gte("holiday_date", dateFrom)
          .lte("holiday_date", dateTo);
        holidayDates = new Set(holidays?.map(h => h.holiday_date) || []);
        // Store for reuse
        (fetchAllMembersReport as any)._cachedHolidays = holidayDates;
      }
    } else {
      holidayDates = (fetchAllMembersReport as any)._cachedHolidays || new Set<string>();
    }

    const effectiveStart = period.dateFrom > effectiveEnd ? effectiveEnd : period.dateFrom;
    const workingDays = effectiveEnd >= period.dateFrom
      ? countWorkingDays(effectiveStart, effectiveEnd, leaveDates, leaveMap, holidayDates)
      : 0;
    totalExpectedMinutes += workingDays * userDailyTarget;
  }

  // Clean up cached holidays
  delete (fetchAllMembersReport as any)._cachedHolidays;

  const expectedHours = totalExpectedMinutes / 60;
  const completionRate = calculateCompletionRate(totalMinutes, totalExpectedMinutes);
  const activityBreakdown = generateActivityBreakdown(entries);
  const approvedCount = entries.filter(e => e.status === "approved").length;
  const pendingCount = entries.filter(e => e.status === "submitted").length;

  const workingDayCount = differenceInCalendarDays(period.dateTo, period.dateFrom) + 1;
  const averageDailyHours = workingDayCount > 0 ? totalHours / workingDayCount : 0;

  return {
    userId: "all",
    facultyName: "All Members",
    department: "All",
    totalHours,
    expectedHours,
    completionRate,
    activityBreakdown,
    entries: enrichedEntries,
    averageDailyHours,
    approvedCount,
    pendingCount,
  };
}

// Helper to count working days (excluding weekends, holidays, and leave days, with half-day support)
export function countWorkingDays(
  dateFrom: Date, 
  dateTo: Date, 
  leaveDates: Set<string> = new Set(),
  leaveTypeMap?: Map<string, string>,
  holidayDates: Set<string> = new Set()
): number {
  // getLeaveWeight is imported at the top of the file
  const allDays = eachDayOfInterval({ start: dateFrom, end: dateTo });
  let count = 0;
  for (const day of allDays) {
    if (isWeekend(day)) continue;
    const dateStr = format(day, "yyyy-MM-dd");
    if (holidayDates.has(dateStr)) continue; // skip holidays
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

export function calculateExpectedHours(period: ReportPeriod, dailyTargetMinutes: number = 480, holidayDates: Set<string> = new Set()): number {
  // This function is now mainly used for department reports where we don't have per-user leave data
  // For faculty reports, we calculate expected hours directly using countWorkingDays
  const allDays = eachDayOfInterval({ start: period.dateFrom, end: period.dateTo });
  const workingDays = allDays.filter(day => {
    if (isWeekend(day)) return false;
    if (holidayDates.has(format(day, "yyyy-MM-dd"))) return false;
    return true;
  }).length;
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
