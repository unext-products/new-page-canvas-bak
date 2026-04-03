import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { isRole } from "@/lib/roleMapping";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/reportQueries";
import { getVisibleUserIds } from "@/lib/reportingHierarchy";
import { Button } from "@/components/ui/button";
import {
  Plus,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Users,
  Building2,
  TrendingUp,
  Activity,
  CalendarDays,
  UserCheck,
  Target,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { StatusBadge } from "@/components/StatusBadge";
import { ActivityBreakdownChart } from "@/components/reports/ActivityBreakdownChart";
import { EnhancedCompletionCard } from "@/components/dashboard/EnhancedCompletionCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { calculateDurationMinutes } from "@/lib/timesheetUtils";
import { calculateUserTotalDailyTargetMinutes } from "@/lib/targets";
import { formatLocalDate } from "@/lib/dateUtils";

// Helper to get duration from entry
const getEntryDuration = (e: { start_time: string; end_time: string }) =>
  calculateDurationMinutes(e.start_time, e.end_time);

export default function Dashboard() {
  const { userWithRole } = useAuth();
  const { impersonatedUser } = useImpersonation();
  const navigate = useNavigate();
  const effectiveUserId = impersonatedUser?.userId || userWithRole?.user?.id;
  const [stats, setStats] = useState({
    todayMinutes: 0,
    targetMinutes: 480,
    pending: 0,
    approved: 0,
    leavesThisMonth: 0,
    weeklyActualMinutes: 0,
    expectedWeeklyMinutes: 2400,
    weeklyCompletionRate: 0,
  });
  const [recentEntries, setRecentEntries] = useState<any[]>([]);
  const [userDepartments, setUserDepartments] = useState<string[]>([]);
  const [adminStats, setAdminStats] = useState({
    totalUsers: 0,
    totalDepartments: 0,
    pendingApprovals: 0,
    weeklyHours: 0,
    expectedWeeklyHours: 0,
    completionRate: 0,
    topDepartments: [] as any[],
    strugglingDepartments: [] as any[],
    activityBreakdown: [] as any[],
    recentActivity: [] as any[],
  });
  const [superAdminStats, setSuperAdminStats] = useState({
    totalOrganizations: 0,
    totalUsers: 0,
    organizationMetrics: [] as any[],
  });
  const [hodStats, setHodStats] = useState({
    teamMembers: 0,
    pendingApprovals: 0,
    weeklyHours: 0,
    expectedWeeklyHours: 0,
    completionRate: 0,
    activityBreakdown: [] as any[],
    teamPerformance: [] as any[],
    recentActivity: [] as any[],
    todayLeaves: [] as any[],
    todayWorking: 0,
  });
  const [loading, setLoading] = useState(true);
  const hasLoadedRef = useRef(false);
  const prevEffectiveUserId = useRef<string | undefined>(undefined);
  
  const isSuperAdmin = isRole(userWithRole?.role, "super_admin");

  // Reset load guard on sign-out so re-login works
  useEffect(() => {
    if (!userWithRole) {
      hasLoadedRef.current = false;
      prevEffectiveUserId.current = undefined;
    }
  }, [userWithRole]);

  useEffect(() => {
    if (!userWithRole || !effectiveUserId) return;
    // Reload when effectiveUserId changes (impersonation start/stop)
    if (prevEffectiveUserId.current === effectiveUserId && hasLoadedRef.current) return;
    prevEffectiveUserId.current = effectiveUserId;
    hasLoadedRef.current = true;
    loadDashboardData();
  }, [userWithRole, effectiveUserId]);

  const loadDashboardData = async () => {
    if (!userWithRole) return;

    setLoading(true);
    const today = formatLocalDate(new Date());

    // Load Super Admin specific dashboard
    if (isSuperAdmin) {
      await loadSuperAdminDashboardData();
      setLoading(false);
      return;
    }

    // Load org admin dashboard data
    if (isRole(userWithRole.role, "admin", "org_admin")) {
      await loadAdminDashboardData();
      setLoading(false);
      return;
    }

    // Load HOD/Manager dashboard data (L3, L2)
    if (isRole(userWithRole.role, "l3", "l2", "manager", "program_manager")) {
      await loadHodDashboardData(effectiveUserId!);
      setLoading(false);
      return;
    }

    // Load today's total minutes for members (L1)
    if (isRole(userWithRole.role, "l1", "member", "faculty")) {
      // Fetch user's resolved daily target (sum across all departments)
      const targetBreakdown = await calculateUserTotalDailyTargetMinutes(effectiveUserId!);
      const resolvedDailyTargetMinutes = targetBreakdown.totalDailyTargetMinutes;
      
      // Calculate this week's date range
      const weekStartDate = new Date();
      weekStartDate.setDate(weekStartDate.getDate() - weekStartDate.getDay() + 1); // Monday
      const weekEndDate = new Date(weekStartDate);
      weekEndDate.setDate(weekEndDate.getDate() + 4); // Friday (working days only)

      // Fetch user's org for holiday lookup
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("organization_id")
        .eq("user_id", effectiveUserId!)
        .single();
      const userOrgId = roleData?.organization_id;
      
      // Fetch leave days and holidays for current week in parallel
      const [weekLeavesRes, weekHolidaysRes] = await Promise.all([
        supabase
          .from("leave_days")
          .select("leave_date, leave_type")
          .eq("user_id", effectiveUserId!)
          .gte("leave_date", formatLocalDate(weekStartDate))
          .lte("leave_date", formatLocalDate(weekEndDate)),
        userOrgId
          ? supabase
              .from("holidays")
              .select("holiday_date")
              .eq("organization_id", userOrgId)
              .gte("holiday_date", formatLocalDate(weekStartDate))
              .lte("holiday_date", formatLocalDate(weekEndDate))
          : Promise.resolve({ data: [] }),
      ]);

      const weekLeaves = weekLeavesRes.data;
      const weekHolidays = weekHolidaysRes.data;
      
      const { getLeaveWeight } = await import("@/lib/leaveUtils");
      const leaveDaysThisWeek = weekLeaves?.reduce((sum, l) => sum + getLeaveWeight((l as any).leave_type || 'other'), 0) || 0;
      const holidayCountThisWeek = weekHolidays?.length || 0;
      const workingDaysThisWeek = Math.max(0, 5 - holidayCountThisWeek - leaveDaysThisWeek);
      const expectedWeeklyMinutes = resolvedDailyTargetMinutes * workingDaysThisWeek;

      // Fetch user's departments from BOTH user_departments AND user_verticals tables
      const [userDepsRes, userVertsRes] = await Promise.all([
        supabase.from("user_departments").select("department_id").eq("user_id", effectiveUserId!),
        supabase.from("user_verticals").select("vertical_id").eq("user_id", effectiveUserId!),
      ]);

      let deptIds: string[] = userDepsRes.data?.map((ud) => ud.department_id) || [];
      let vertIds: string[] = userVertsRes.data?.map((uv) => uv.vertical_id) || [];

      // Fallback to user_roles.department_id if both are empty
      if (deptIds.length === 0 && vertIds.length === 0 && userWithRole.departmentId) {
        deptIds = [userWithRole.departmentId];
      }

      let displayDepartments: string[] = [];

      // Fetch department names
      if (deptIds.length > 0) {
        const { data: deptDetails } = await supabase.from("departments").select("name, code").in("id", deptIds);
        displayDepartments.push(...(deptDetails?.map((d) => `${d.name} (${d.code})`) || []));
      }

      // Fetch vertical names
      if (vertIds.length > 0) {
        const { data: vertDetails } = await supabase.from("verticals").select("name, code").in("id", vertIds);
        displayDepartments.push(...(vertDetails?.map((v) => `${v.name} (${v.code})`) || []));
      }

      setUserDepartments(displayDepartments);

      const { data: entries } = await supabase
        .from("timesheet_entries")
        .select("start_time, end_time, status")
        .eq("user_id", effectiveUserId!)
        .eq("entry_date", today);

      // Fetch leaves for this month
      const monthStart = new Date();
      monthStart.setDate(1);
      const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
      const monthStartStr = formatLocalDate(monthStart);
      const monthEndStr = formatLocalDate(monthEnd);

      const { data: leavesData } = await supabase
        .from("leave_days")
        .select("id")
        .eq("user_id", effectiveUserId!)
        .gte("leave_date", monthStartStr)
        .lte("leave_date", monthEndStr);

      // Fetch ALL pending entries (not just today's)
      const { data: allPendingEntries } = await supabase
        .from("timesheet_entries")
        .select("id")
        .eq("user_id", effectiveUserId!)
        .eq("status", "submitted");

      if (entries) {
        const todayTotal = entries
          .filter((e) => e.status === "approved" || e.status === "submitted")
          .reduce((sum, e) => sum + getEntryDuration(e), 0);

        setStats((prev) => ({
          ...prev,
          todayMinutes: todayTotal,
          targetMinutes: resolvedDailyTargetMinutes,
          pending: allPendingEntries?.length || 0,
          approved: entries.filter((e) => e.status === "approved").length,
          leavesThisMonth: leavesData?.length || 0,
        }));
      } else {
        // Still update target even if no entries
        setStats((prev) => ({
          ...prev,
          targetMinutes: resolvedDailyTargetMinutes,
          pending: allPendingEntries?.length || 0,
          leavesThisMonth: leavesData?.length || 0,
        }));
      }

      // Calculate weekly completion for faculty
      const startOfWeek = new Date();
      startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay() + 1); // Monday
      const weekStart = formatLocalDate(startOfWeek);

      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(endOfWeek.getDate() + 6); // Sunday
      const weekEnd = formatLocalDate(endOfWeek);

      const { data: weekEntries } = await supabase
        .from("timesheet_entries")
        .select("start_time, end_time, status")
        .eq("user_id", effectiveUserId!)
        .gte("entry_date", weekStart)
        .lte("entry_date", weekEnd);

      if (weekEntries) {
        const weeklyActualMinutes = weekEntries
          .filter((e) => e.status === "approved" || e.status === "submitted")
          .reduce((sum, e) => sum + getEntryDuration(e), 0);

        const weeklyCompletionRate =
          expectedWeeklyMinutes > 0 ? (weeklyActualMinutes / expectedWeeklyMinutes) * 100 : 0;

        setStats((prev) => ({
          ...prev,
          weeklyActualMinutes,
          expectedWeeklyMinutes,
          weeklyCompletionRate,
        }));
      }

      // Load recent entries
      const { data: recent } = await supabase
        .from("timesheet_entries")
        .select("*")
        .eq("user_id", effectiveUserId!)
        .order("entry_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(5);

      setRecentEntries(recent || []);
    }

    setLoading(false);
  };

  const loadHodDashboardData = async (hodUserId: string) => {
    // Fetch HOD's verticals from user_verticals junction table (primary)
    const { data: hodVerticals } = await supabase
      .from("user_verticals")
      .select("vertical_id")
      .eq("user_id", hodUserId);

    let hodVerticalIds = hodVerticals?.map((v) => v.vertical_id) || [];

    // Fallback to user_departments if no user_verticals entries
    if (hodVerticalIds.length === 0) {
      const { data: hodDepartments } = await supabase
        .from("user_departments")
        .select("department_id")
        .eq("user_id", hodUserId);
      hodVerticalIds = hodDepartments?.map((d) => d.department_id) || [];
    }

    if (hodVerticalIds.length === 0) {
      // No verticals assigned
      setUserDepartments([]);
      setHodStats({
        teamMembers: 0,
        pendingApprovals: 0,
        weeklyHours: 0,
        expectedWeeklyHours: 0,
        completionRate: 0,
        activityBreakdown: [],
        teamPerformance: [],
        recentActivity: [],
        todayLeaves: [],
        todayWorking: 0,
      });
      return;
    }

    // Fetch vertical names for display (try verticals first, fallback to departments)
    let vertData = null;
    const { data: verticalsData } = await supabase.from("verticals").select("name, code").in("id", hodVerticalIds);
    if (verticalsData && verticalsData.length > 0) {
      vertData = verticalsData;
    } else {
      const { data: deptsData } = await supabase.from("departments").select("name, code").in("id", hodVerticalIds);
      vertData = deptsData;
    }

    if (vertData && vertData.length > 0) {
      setUserDepartments(vertData.map((d) => `${d.name} (${d.code})`));
    }

    const today = formatLocalDate(new Date());
    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay() + 1); // Monday
    const weekStart = formatLocalDate(startOfWeek);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 6);
    const weekEnd = formatLocalDate(endOfWeek);

    // Fetch week's holidays for the HOD's org
    const { data: hodRoleData } = await supabase
      .from("user_roles")
      .select("organization_id")
      .eq("user_id", hodUserId)
      .single();
    const hodOrgId = hodRoleData?.organization_id;
    const weekFriday = new Date(startOfWeek);
    weekFriday.setDate(weekFriday.getDate() + 4);
    const { data: hodWeekHolidays } = hodOrgId
      ? await supabase
          .from("holidays")
          .select("holiday_date")
          .eq("organization_id", hodOrgId)
          .gte("holiday_date", weekStart)
          .lte("holiday_date", formatLocalDate(weekFriday))
      : { data: [] };
    const hodHolidayCount = hodWeekHolidays?.length || 0;
    const hodWorkingDaysThisWeek = Math.max(0, 5 - hodHolidayCount);

    // Check reporting hierarchy first
    const currentRole = userWithRole?.role || "";
    const hierarchyUsers = await getVisibleUserIds(hodUserId, currentRole);
    
    let teamUserIds: string[] = [];

    if (hierarchyUsers !== null && hierarchyUsers.length > 0) {
      // Use hierarchy-based team
      const { data: facultyRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("role", ["l1", "l2", "faculty", "program_manager"])
        .in("user_id", hierarchyUsers);
      teamUserIds = (facultyRoles?.map((r) => r.user_id) || []).filter((id) => id !== hodUserId);
    } else {
      // Fallback: legacy vertical-based logic
      let allVertUserIds: string[] = [];
      const { data: vertUsers } = await supabase
        .from("user_verticals")
        .select("user_id")
        .in("vertical_id", hodVerticalIds);

      if (vertUsers && vertUsers.length > 0) {
        allVertUserIds = [...new Set(vertUsers.map((v) => v.user_id))];
      } else {
        const { data: deptUsers } = await supabase
          .from("user_departments")
          .select("user_id")
          .in("department_id", hodVerticalIds);
        allVertUserIds = [...new Set(deptUsers?.map((d) => d.user_id) || [])];
      }

      const { data: facultyRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("role", ["l1", "faculty"])
        .in("user_id", allVertUserIds.length > 0 ? allVertUserIds : [hodUserId]);
      teamUserIds = (facultyRoles?.map((r) => r.user_id) || []).filter((id) => id !== hodUserId);
    }

    // Fetch team profiles
    const { data: teamProfiles } = await supabase
      .from("profiles")
      .select("id, full_name, is_active")
      .in("id", teamUserIds.length > 0 ? teamUserIds : [hodUserId])
      .eq("is_active", true);

    // Use only active team member IDs for dashboard queries
    const activeTeamUserIds = teamProfiles?.map(p => p.id) || [];

    // Fetch pending approvals - get entries from active users in the department (paginated)
    const pendingEntries = await fetchAllRows(
      supabase
        .from("timesheet_entries")
        .select("id, start_time, end_time, user_id")
        .in("user_id", activeTeamUserIds.length > 0 ? activeTeamUserIds : ["no-id"])
        .eq("status", "submitted")
    );

    // Fetch this week's entries for team members (paginated)
    const weekEntries = await fetchAllRows(
      supabase
        .from("timesheet_entries")
        .select("id, start_time, end_time, user_id, activity_type")
        .in("user_id", activeTeamUserIds.length > 0 ? activeTeamUserIds : ["no-id"])
        .gte("entry_date", weekStart)
        .lte("entry_date", weekEnd)
    );

    // Fetch today's leaves for active team members
    const { data: todayLeavesRaw } = await supabase
      .from("leave_days")
      .select("*")
      .in("user_id", activeTeamUserIds.length > 0 ? activeTeamUserIds : ["no-id"])
      .eq("leave_date", today);

    // Get profiles for leave users
    const leaveUserIds = todayLeavesRaw?.map((l) => l.user_id) || [];
    const { data: leaveProfiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", leaveUserIds.length > 0 ? leaveUserIds : [hodUserId]);

    const leaveProfileMap = new Map(leaveProfiles?.map((p) => [p.id, p.full_name]) || []);

    // Calculate weekly hours using start_time/end_time
    const totalWeeklyMinutes = weekEntries.reduce((sum, e) => sum + getEntryDuration(e), 0);
    const teamCount = activeTeamUserIds.length;
    const expectedMinutes = teamCount * hodWorkingDaysThisWeek * 480; // working days * 8 hours per team member
    const completionRate = expectedMinutes > 0 ? (totalWeeklyMinutes / expectedMinutes) * 100 : 0;

    // Activity breakdown
    const activityMap = new Map();
    weekEntries.forEach((entry) => {
      const type = entry.activity_type;
      if (!type) return;
      if (!activityMap.has(type)) {
        activityMap.set(type, { minutes: 0, count: 0 });
      }
      const current = activityMap.get(type);
      const entryMinutes = getEntryDuration(entry);
      activityMap.set(type, {
        minutes: current.minutes + entryMinutes,
        count: current.count + 1,
      });
    });

    const activityBreakdown = Array.from(activityMap.entries()).map(([type, data]) => ({
      activityType: type,
      hours: data.minutes / 60,
      percentage: totalWeeklyMinutes > 0 ? (data.minutes / totalWeeklyMinutes) * 100 : 0,
      count: data.count,
    }));

    // Team performance - per member stats
    const memberStatsMap = new Map();
    teamProfiles?.forEach((profile) => {
      memberStatsMap.set(profile.id, {
        id: profile.id,
        name: profile.full_name,
        isActive: profile.is_active,
        minutes: 0,
        entryCount: 0,
      });
    });

    weekEntries.forEach((entry) => {
      const userId = entry.user_id;
      if (memberStatsMap.has(userId)) {
        const current = memberStatsMap.get(userId);
        const entryMinutes = getEntryDuration(entry);
        memberStatsMap.set(userId, {
          ...current,
          minutes: current.minutes + entryMinutes,
          entryCount: current.entryCount + 1,
        });
      }
    });

    const hodExpectedHoursPerMember = hodWorkingDaysThisWeek * 8;
    const hodExpectedMinutesPerMember = hodWorkingDaysThisWeek * 480;
    const teamPerformance = Array.from(memberStatsMap.values())
      .map((member) => ({
        ...member,
        hours: member.minutes / 60,
        expectedHours: hodExpectedHoursPerMember,
        completionRate: hodExpectedMinutesPerMember > 0 ? (member.minutes / hodExpectedMinutesPerMember) * 100 : 0,
      }))
      .sort((a, b) => b.completionRate - a.completionRate);

    // Recent activity (last 10 entries from team)
    const { data: recentActivity } = await supabase
      .from("timesheet_entries")
      .select(
        `
        id, start_time, end_time, user_id, activity_type, entry_date, status, created_at,
        profiles:user_id(full_name)
      `,
      )
      .in("user_id", activeTeamUserIds.length > 0 ? activeTeamUserIds : ["no-id"])
      .order("created_at", { ascending: false })
      .limit(10);

    // Calculate today working (team members not on leave)
    const onLeaveIds = new Set(todayLeavesRaw?.map((l) => l.user_id) || []);
    const todayWorking = teamCount - onLeaveIds.size;

    setHodStats({
      teamMembers: teamCount,
      pendingApprovals: pendingEntries.length,
      weeklyHours: totalWeeklyMinutes / 60,
      expectedWeeklyHours: expectedMinutes / 60,
      completionRate: Math.round(completionRate),
      activityBreakdown,
      teamPerformance,
      recentActivity: recentActivity || [],
      todayLeaves:
        todayLeavesRaw?.map((l) => ({
          ...l,
          userName: leaveProfileMap.get(l.user_id) || "Unknown",
        })) || [],
      todayWorking,
    });
  };

  const loadSuperAdminDashboardData = async () => {
    try {
      // Fetch all organizations
      const { data: allOrgs, error: orgsError } = await supabase
        .from("organizations")
        .select("id, name, code");

      if (orgsError) throw orgsError;

      // Fetch all users with org info
      const { data: allUserRoles, error: usersError } = await supabase
        .from("user_roles")
        .select("user_id, organization_id, role");

      if (usersError) throw usersError;

      // Calculate metrics per organization
      const orgMetricsMap = new Map<string, { name: string; code: string; userCount: number }>();
      
      allOrgs?.forEach(org => {
        orgMetricsMap.set(org.id, {
          name: org.name,
          code: org.code,
          userCount: 0,
        });
      });

      allUserRoles?.forEach(ur => {
        if (ur.organization_id && orgMetricsMap.has(ur.organization_id)) {
          const metrics = orgMetricsMap.get(ur.organization_id)!;
          metrics.userCount += 1;
        }
      });

      const organizationMetrics = Array.from(orgMetricsMap.entries()).map(([id, data]) => ({
        id,
        ...data,
      })).sort((a, b) => b.userCount - a.userCount);

      setSuperAdminStats({
        totalOrganizations: allOrgs?.length || 0,
        totalUsers: allUserRoles?.length || 0,
        organizationMetrics,
      });
    } catch (error) {
      console.error("Error loading super admin dashboard:", error);
    }
  };

  const loadAdminDashboardData = async () => {
    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    const weekStart = formatLocalDate(startOfWeek);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 6);
    const weekEnd = formatLocalDate(endOfWeek);

    // Fetch total user count (L1, L2, L3, and legacy roles)
    const { data: users } = await supabase
      .from("user_roles")
      .select("user_id, vertical_id")
      .in("role", ["l1", "l2", "l3", "faculty", "hod", "program_manager"]);

    // Create user to vertical mapping
    const userVertMap = new Map<string, string>();
    users?.forEach((u) => {
      if (u.vertical_id) userVertMap.set(u.user_id, u.vertical_id);
    });

    // Fetch total verticals (not departments)
    const { data: verticals } = await supabase.from("verticals").select("id, name");

    // Create vertical id to name mapping
    const vertNameMap = new Map<string, string>();
    verticals?.forEach((v) => vertNameMap.set(v.id, v.name));

    // Fetch pending approvals org-wide (paginated)
    const pendingEntries = await fetchAllRows(
      supabase.from("timesheet_entries").select("id").eq("status", "submitted")
    );

    // Fetch this week's entries (paginated)
    const weekEntries = await fetchAllRows(
      supabase
        .from("timesheet_entries")
        .select("id, start_time, end_time, user_id, activity_type")
        .gte("entry_date", weekStart)
        .lte("entry_date", weekEnd)
    );

    // Calculate weekly hours and activity breakdown
    const totalWeeklyMinutes = weekEntries.reduce((sum, e) => sum + getEntryDuration(e), 0);
    const expectedMinutes = (users?.length || 0) * 5 * 480; // 5 days * 8 hours
    const completionRate = expectedMinutes > 0 ? (totalWeeklyMinutes / expectedMinutes) * 100 : 0;

    // Activity breakdown
    const activityMap = new Map();
    weekEntries.forEach((entry) => {
      const type = entry.activity_type;
      if (!type) return; // Skip entries without activity type
      if (!activityMap.has(type)) {
        activityMap.set(type, { minutes: 0, count: 0 });
      }
      const current = activityMap.get(type);
      const entryMinutes = getEntryDuration(entry);
      activityMap.set(type, {
        minutes: current.minutes + entryMinutes,
        count: current.count + 1,
      });
    });

    const activityBreakdown = Array.from(activityMap.entries()).map(([type, data]) => ({
      activityType: type,
      hours: data.minutes / 60,
      percentage: totalWeeklyMinutes > 0 ? (data.minutes / totalWeeklyMinutes) * 100 : 0,
      count: data.count,
    }));

    // Vertical performance - get vertical from user_roles mapping
    const vertMap = new Map();
    weekEntries.forEach((entry) => {
      const vertId = userVertMap.get(entry.user_id);
      if (!vertId) return; // Skip if user has no vertical
      const vertName = vertNameMap.get(vertId) || "Unknown";
      if (!vertMap.has(vertId)) {
        vertMap.set(vertId, { name: vertName, minutes: 0, facultyCount: new Set() });
      }
      const current = vertMap.get(vertId);
      const entryMinutes = getEntryDuration(entry);
      current.minutes += entryMinutes;
      current.facultyCount.add(entry.user_id);
    });

    const vertPerformance = Array.from(vertMap.entries())
      .map(([id, data]) => {
        const facultyCount = data.facultyCount.size;
        const expectedVertMinutes = facultyCount * 5 * 480;
        const completionRate = expectedVertMinutes > 0 ? (data.minutes / expectedVertMinutes) * 100 : 0;
        return {
          id,
          name: data.name,
          minutes: data.minutes,
          completionRate,
          facultyCount,
        };
      })
      .sort((a, b) => b.completionRate - a.completionRate);

    const topDepartments = vertPerformance.filter((d) => d.completionRate >= 70).slice(0, 3);
    const strugglingDepartments = vertPerformance.filter((d) => d.completionRate < 70);

    // Recent activity (last 10 entries)
    const { data: recentActivity } = await supabase
      .from("timesheet_entries")
      .select(
        `
        id, start_time, end_time, user_id, activity_type, entry_date, status, vertical_code, created_at,
        profiles:user_id(full_name)
      `,
      )
      .order("created_at", { ascending: false })
      .limit(10);

    setAdminStats({
      totalUsers: users?.length || 0,
      totalDepartments: verticals?.length || 0,
      pendingApprovals: pendingEntries.length,
      weeklyHours: totalWeeklyMinutes / 60,
      expectedWeeklyHours: expectedMinutes / 60,
      completionRate: Math.round(completionRate),
      topDepartments,
      strugglingDepartments,
      activityBreakdown,
      recentActivity: recentActivity || [],
    });
  };

  const formatMinutes = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const getWelcomeMessage = () => {
    const name = userWithRole?.profile?.full_name || "User";
    const role = userWithRole?.role;
    return `Hello ${name}${role ? ` (${role.toUpperCase()})` : ""}`;
  };

  if (!userWithRole?.role) {
    return (
      <Layout>
        <Card>
          <CardHeader>
            <CardTitle>Setup Required</CardTitle>
            <CardDescription>
              Your account is not yet configured. Please contact your administrator to assign you a role and department.
            </CardDescription>
          </CardHeader>
        </Card>
      </Layout>
    );
  }

  const getRoleDescription = () => {
    if (isRole(userWithRole.role, "l1", "member", "faculty")) {
      return "Track your working hours and submit timesheets";
    }
    if (isRole(userWithRole.role, "l2", "program_manager")) {
      return "Review L1 entries and manage programs";
    }
    if (isRole(userWithRole.role, "l3", "manager", "hod")) {
      return "Review and approve team timesheets";
    }
    if (isRole(userWithRole.role, "admin", "org_admin")) {
      return "Manage users, departments, and reports";
    }
    if (isRole(userWithRole.role, "super_admin")) {
      return "System administration across organizations";
    }
    return "";
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <Clock className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{getWelcomeMessage()}</h1>
            <p className="text-sm text-muted-foreground">{getRoleDescription()}</p>
            {(isRole(userWithRole.role, "l1", "l2", "l3", "member", "manager")) && userDepartments.length > 0 && (
              <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                <Building2 className="h-3.5 w-3.5" />
                <span>Department: {userDepartments.join(", ")}</span>
              </p>
            )}
          </div>
        </div>

        {isRole(userWithRole.role, "l1", "member", "faculty") && (
          <>
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Today's Hours</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatMinutes(stats.todayMinutes)}</div>
                  <p className="text-xs text-muted-foreground mt-1">Target: {formatMinutes(stats.targetMinutes)}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
                  <AlertCircle className="h-4 w-4 text-warning" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-warning">{stats.pending}</div>
                  <p className="text-xs text-muted-foreground mt-1">Total awaiting approval</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Approved</CardTitle>
                  <CheckCircle className="h-4 w-4 text-success" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-success">{stats.approved}</div>
                  <p className="text-xs text-muted-foreground mt-1">This week</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Leaves</CardTitle>
                  <CalendarDays className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.leavesThisMonth}</div>
                  <p className="text-xs text-muted-foreground mt-1">This month</p>
                </CardContent>
              </Card>
            </div>

            <EnhancedCompletionCard userId={effectiveUserId!} />

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Quick Actions</CardTitle>
                    <CardDescription>Add a new timesheet entry</CardDescription>
                  </div>
                  <Button onClick={() => navigate("/timesheet")}>
                    <Plus className="mr-2 h-4 w-4" />
                    New Entry
                  </Button>
                </div>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Entries</CardTitle>
                <CardDescription>Your latest timesheet submissions</CardDescription>
              </CardHeader>
              <CardContent>
                {recentEntries.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No entries yet. Start by creating your first timesheet entry.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {recentEntries.map((entry) => (
                      <div key={entry.id} className="flex items-center justify-between py-2 border-b last:border-0">
                        <div className="flex-1">
                          <p className="font-medium text-sm">{new Date(entry.entry_date).toLocaleDateString()}</p>
                          <p className="text-sm text-muted-foreground">
                            {entry.activity_type} • {formatMinutes(getEntryDuration(entry))}
                          </p>
                        </div>
                        <StatusBadge status={entry.status} />
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {isRole(userWithRole.role, "l2", "l3", "manager", "program_manager") && (
          <>
            {loading ? (
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                {[1, 2, 3, 4].map((i) => (
                  <Card key={i}>
                    <CardHeader className="pb-2">
                      <Skeleton className="h-4 w-24" />
                    </CardHeader>
                    <CardContent>
                      <Skeleton className="h-8 w-20" />
                      <Skeleton className="h-3 w-32 mt-2" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <>
                {/* Key Metrics Cards */}
                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Team Members</CardTitle>
                      <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{hodStats.teamMembers}</div>
                      <p className="text-xs text-muted-foreground mt-1">In your department</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Pending Approvals</CardTitle>
                      <AlertCircle
                        className={`h-4 w-4 ${hodStats.pendingApprovals > 0 ? "text-warning" : "text-muted-foreground"}`}
                      />
                    </CardHeader>
                    <CardContent>
                      <div className={`text-2xl font-bold ${hodStats.pendingApprovals > 0 ? "text-warning" : ""}`}>
                        {hodStats.pendingApprovals}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">Awaiting your review</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Weekly Hours</CardTitle>
                      <Clock className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-success">{Math.round(hodStats.weeklyHours)}h</div>
                      <p className="text-xs text-muted-foreground mt-1">
                        / {Math.round(hodStats.expectedWeeklyHours)}h expected
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Today's Status</CardTitle>
                      <UserCheck className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{hodStats.todayWorking}</div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Working • {hodStats.todayLeaves.length} on leave
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Department Health Card */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Target className="h-5 w-5" />
                      Department Performance
                    </CardTitle>
                    <CardDescription>Weekly completion overview</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Completion Rate</p>
                        <p
                          className={`text-4xl font-bold ${hodStats.completionRate >= 90 ? "text-success" : hodStats.completionRate >= 70 ? "text-warning" : "text-destructive"}`}
                        >
                          {hodStats.completionRate}%
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Status</p>
                        <p className="text-lg font-semibold">
                          {hodStats.completionRate >= 90
                            ? "✓ On Track"
                            : hodStats.completionRate >= 70
                              ? "⚠ Good"
                              : "⚠ Needs Attention"}
                        </p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Actual: {Math.round(hodStats.weeklyHours)}h</span>
                        <span>Expected: {Math.round(hodStats.expectedWeeklyHours)}h</span>
                      </div>
                      <Progress value={hodStats.completionRate} className="h-2" />
                    </div>
                  </CardContent>
                </Card>

                <div className="grid gap-4 md:grid-cols-2">
                  {/* Team Performance Table */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        Team Performance
                      </CardTitle>
                      <CardDescription>Weekly hours by team member</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {hodStats.teamPerformance.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No team members found.</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead className="text-right">Hours</TableHead>
                                <TableHead className="text-right">Progress</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {hodStats.teamPerformance.slice(0, 5).map((member) => (
                                <TableRow key={member.id}>
                                  <TableCell className="font-medium">
                                    <div className="flex items-center gap-2">
                                      {member.completionRate >= 90 && (
                                        <span className="text-xs bg-success/10 text-success px-1.5 py-0.5 rounded">
                                          ★
                                        </span>
                                      )}
                                      {member.name}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-right">{member.hours.toFixed(1)}h</TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-2">
                                      <Progress value={Math.min(member.completionRate, 100)} className="h-2 w-16" />
                                      <span
                                        className={`text-xs font-medium ${member.completionRate >= 90 ? "text-success" : member.completionRate >= 70 ? "text-warning" : "text-muted-foreground"}`}
                                      >
                                        {Math.round(member.completionRate)}%
                                      </span>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Activity Breakdown */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Activity Distribution</CardTitle>
                      <CardDescription>This week's activity breakdown</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {hodStats.activityBreakdown.length > 0 ? (
                        <ActivityBreakdownChart data={hodStats.activityBreakdown} />
                      ) : (
                        <p className="text-sm text-muted-foreground">No activity data available yet.</p>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Today's Leave & Recent Activity */}
                <div className="grid gap-4 md:grid-cols-2">
                  {/* Today's Leave */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <CalendarDays className="h-5 w-5" />
                        Today's Attendance
                      </CardTitle>
                      <CardDescription>Team availability for today</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {hodStats.todayLeaves.length === 0 ? (
                        <div className="text-center py-4">
                          <CheckCircle className="h-8 w-8 text-success mx-auto mb-2" />
                          <p className="text-sm text-muted-foreground">All team members available today!</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {hodStats.todayLeaves.map((leave: any) => (
                            <div
                              key={leave.id}
                              className="flex items-center justify-between py-2 border-b last:border-0"
                            >
                              <div>
                                <p className="font-medium text-sm">{leave.userName}</p>
                                <p className="text-xs text-muted-foreground capitalize">
                                  {leave.leave_type.replace("_", " ")}
                                </p>
                              </div>
                              <span className="text-xs bg-warning/10 text-warning px-2 py-1 rounded">On Leave</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                </div>

                {/* Quick Actions */}
                <Card>
                  <CardHeader>
                    <CardTitle>Quick Actions</CardTitle>
                    <CardDescription>Manage your department</CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-wrap gap-2">
                    {hodStats.pendingApprovals > 0 && (
                      <Button onClick={() => navigate("/approvals")}>
                        <AlertCircle className="mr-2 h-4 w-4" />
                        Review Approvals ({hodStats.pendingApprovals})
                      </Button>
                    )}
                    <Button
                      variant={hodStats.pendingApprovals > 0 ? "outline" : "default"}
                      onClick={() => navigate("/reports")}
                    >
                      <TrendingUp className="mr-2 h-4 w-4" />
                      View Reports
                    </Button>
                    <Button variant="outline" onClick={() => navigate("/timesheet")}>
                      <Plus className="mr-2 h-4 w-4" />
                      My Timesheet
                    </Button>
                  </CardContent>
                </Card>
              </>
            )}
          </>
        )}

        {/* Super Admin Dashboard */}
        {isSuperAdmin && (
          <>
            {loading ? (
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <Card key={i}>
                    <CardHeader className="pb-2">
                      <Skeleton className="h-4 w-24" />
                    </CardHeader>
                    <CardContent>
                      <Skeleton className="h-8 w-20" />
                      <Skeleton className="h-3 w-32 mt-2" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <>
                {/* Super Admin Key Metrics */}
                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Organizations</CardTitle>
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{superAdminStats.totalOrganizations}</div>
                      <p className="text-xs text-muted-foreground mt-1">Active organizations</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Total Users</CardTitle>
                      <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{superAdminStats.totalUsers}</div>
                      <p className="text-xs text-muted-foreground mt-1">Across all organizations</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Avg Users/Org</CardTitle>
                      <Target className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {superAdminStats.totalOrganizations > 0 
                          ? Math.round(superAdminStats.totalUsers / superAdminStats.totalOrganizations)
                          : 0}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">Average per organization</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Organization Performance Table */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Building2 className="h-5 w-5" />
                      Organization Overview
                    </CardTitle>
                    <CardDescription>Users by organization</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {superAdminStats.organizationMetrics.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No organizations found.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Organization</TableHead>
                              <TableHead>Code</TableHead>
                              <TableHead className="text-right">Users</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {superAdminStats.organizationMetrics.map((org) => (
                              <TableRow key={org.id}>
                                <TableCell className="font-medium">{org.name}</TableCell>
                                <TableCell className="text-muted-foreground font-mono">{org.code}</TableCell>
                                <TableCell className="text-right">{org.userCount}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Quick Actions */}
                <Card>
                  <CardHeader>
                    <CardTitle>Quick Actions</CardTitle>
                    <CardDescription>System-wide management</CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-wrap gap-2">
                    <Button onClick={() => navigate("/organizations")}>
                      <Building2 className="mr-2 h-4 w-4" />
                      Manage Organizations
                    </Button>
                    <Button variant="outline" onClick={() => navigate("/users")}>
                      <Users className="mr-2 h-4 w-4" />
                      Manage Users
                    </Button>
                    <Button variant="outline" onClick={() => navigate("/reports")}>
                      <TrendingUp className="mr-2 h-4 w-4" />
                      View Reports
                    </Button>
                    <Button variant="outline" onClick={() => navigate("/settings")}>
                      <Activity className="mr-2 h-4 w-4" />
                      Settings
                    </Button>
                  </CardContent>
                </Card>
              </>
            )}
          </>
        )}

        {/* Org Admin Dashboard */}
        {isRole(userWithRole.role, "admin", "org_admin") && !isSuperAdmin && (
          <>
            {loading ? (
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                {[1, 2, 3, 4].map((i) => (
                  <Card key={i}>
                    <CardHeader className="pb-2">
                      <Skeleton className="h-4 w-24" />
                    </CardHeader>
                    <CardContent>
                      <Skeleton className="h-8 w-20" />
                      <Skeleton className="h-3 w-32 mt-2" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <>
                {/* Key Metrics Cards */}
                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Total Faculty</CardTitle>
                      <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{adminStats.totalUsers}</div>
                      <p className="text-xs text-muted-foreground mt-1">Active users</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Departments</CardTitle>
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{adminStats.totalDepartments}</div>
                      <p className="text-xs text-muted-foreground mt-1">Total departments</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Pending Approvals</CardTitle>
                      <AlertCircle
                        className={`h-4 w-4 ${adminStats.pendingApprovals > 0 ? "text-warning" : "text-muted-foreground"}`}
                      />
                    </CardHeader>
                    <CardContent>
                      <div className={`text-2xl font-bold ${adminStats.pendingApprovals > 0 ? "text-warning" : ""}`}>
                        {adminStats.pendingApprovals}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">Awaiting review</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">This Week</CardTitle>
                      <Clock className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-success">{Math.round(adminStats.weeklyHours)}h</div>
                      <p className="text-xs text-muted-foreground mt-1">
                        / {Math.round(adminStats.expectedWeeklyHours)}h expected
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Organization Health Card */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5" />
                      Organization Health
                    </CardTitle>
                    <CardDescription>Weekly performance overview</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Completion Rate</p>
                        <p
                          className={`text-4xl font-bold ${adminStats.completionRate >= 90 ? "text-success" : adminStats.completionRate >= 70 ? "text-warning" : "text-destructive"}`}
                        >
                          {adminStats.completionRate}%
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Status</p>
                        <p className="text-lg font-semibold">
                          {adminStats.completionRate >= 90
                            ? "✓ Excellent"
                            : adminStats.completionRate >= 70
                              ? "⚠ Good"
                              : "⚠ Needs Attention"}
                        </p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Actual: {Math.round(adminStats.weeklyHours)}h</span>
                        <span>Expected: {Math.round(adminStats.expectedWeeklyHours)}h</span>
                      </div>
                      <Progress value={adminStats.completionRate} className="h-2" />
                    </div>
                  </CardContent>
                </Card>

                <div className="grid gap-4 md:grid-cols-2">
                  {/* Department Performance */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Department Performance</CardTitle>
                      <CardDescription>Top and struggling departments</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {adminStats.topDepartments.length > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold mb-2 text-success flex items-center gap-2">
                            <CheckCircle className="h-4 w-4" />
                            Top Performers
                          </h4>
                          <div className="space-y-2">
                            {adminStats.topDepartments.map((dept) => (
                              <div key={dept.id} className="flex items-center justify-between text-sm">
                                <span>{dept.name}</span>
                                <span className="font-semibold text-success">{Math.round(dept.completionRate)}%</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {adminStats.strugglingDepartments.length > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold mb-2 text-warning flex items-center gap-2">
                            <AlertCircle className="h-4 w-4" />
                            Needs Attention
                          </h4>
                          <div className="space-y-2">
                            {adminStats.strugglingDepartments.slice(0, 3).map((dept) => (
                              <div key={dept.id} className="flex items-center justify-between text-sm">
                                <span>{dept.name}</span>
                                <span className="font-semibold text-warning">{Math.round(dept.completionRate)}%</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {adminStats.topDepartments.length === 0 && adminStats.strugglingDepartments.length === 0 && (
                        <p className="text-sm text-muted-foreground">No department data available yet.</p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Activity Breakdown */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Activity Distribution</CardTitle>
                      <CardDescription>This week's activity breakdown</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {adminStats.activityBreakdown.length > 0 ? (
                        <ActivityBreakdownChart data={adminStats.activityBreakdown} />
                      ) : (
                        <p className="text-sm text-muted-foreground">No activity data available yet.</p>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Quick Actions */}
                <Card>
                  <CardHeader>
                    <CardTitle>Quick Actions</CardTitle>
                    <CardDescription>Manage system settings and data</CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-wrap gap-2">
                    <Button onClick={() => navigate("/users")}>
                      <Users className="mr-2 h-4 w-4" />
                      Manage Users
                    </Button>
                    <Button variant="outline" onClick={() => navigate("/departments")}>
                      <Building2 className="mr-2 h-4 w-4" />
                      Manage Departments
                    </Button>
                    <Button variant="outline" onClick={() => navigate("/reports")}>
                      <TrendingUp className="mr-2 h-4 w-4" />
                      View Reports
                    </Button>
                    {adminStats.pendingApprovals > 0 && (
                      <Button variant="outline" onClick={() => navigate("/approvals")}>
                        <AlertCircle className="mr-2 h-4 w-4" />
                        Review Approvals ({adminStats.pendingApprovals})
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
