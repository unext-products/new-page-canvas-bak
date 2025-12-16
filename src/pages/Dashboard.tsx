import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus, Clock, CheckCircle, XCircle, AlertCircle, Users, Building2, TrendingUp, Activity, CalendarDays, UserCheck, Target } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { StatusBadge } from "@/components/StatusBadge";
import { ActivityBreakdownChart } from "@/components/reports/ActivityBreakdownChart";
import { EnhancedCompletionCard } from "@/components/dashboard/EnhancedCompletionCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { calculateDurationMinutes } from "@/lib/timesheetUtils";

// Helper to get duration from entry
const getEntryDuration = (e: { start_time: string; end_time: string }) => 
  calculateDurationMinutes(e.start_time, e.end_time);

export default function Dashboard() {
  const { userWithRole } = useAuth();
  const navigate = useNavigate();
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

  useEffect(() => {
    loadDashboardData();
  }, [userWithRole]);

  const loadDashboardData = async () => {
    if (!userWithRole) return;
    
    setLoading(true);
    const today = new Date().toISOString().split("T")[0];

    // Load org admin dashboard data
    if (userWithRole.role === "org_admin") {
      await loadAdminDashboardData();
      setLoading(false);
      return;
    }

    // Load today's total minutes for members
    if (userWithRole.role === "member") {
      // Fetch user's departments from user_departments table
      const { data: userDepts } = await supabase
        .from("user_departments")
        .select("department_id")
        .eq("user_id", userWithRole.user.id);

      let deptIds: string[] = [];
      
      if (userDepts && userDepts.length > 0) {
        deptIds = userDepts.map(ud => ud.department_id);
      } else if (userWithRole.departmentId) {
        // Fallback to user_roles.department_id if user_departments is empty
        deptIds = [userWithRole.departmentId];
      }

      if (deptIds.length > 0) {
        const { data: deptDetails } = await supabase
          .from("departments")
          .select("name, code")
          .in("id", deptIds);
        
        setUserDepartments(deptDetails?.map(d => `${d.name} (${d.code})`) || []);
      }

      const { data: entries } = await supabase
        .from("timesheet_entries")
        .select("start_time, end_time, status")
        .eq("user_id", userWithRole.user.id)
        .eq("entry_date", today);

      // Fetch leaves for this month
      const monthStart = new Date();
      monthStart.setDate(1);
      const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
      const monthStartStr = monthStart.toISOString().split("T")[0];
      const monthEndStr = monthEnd.toISOString().split("T")[0];

      const { data: leavesData } = await supabase
        .from("leave_days")
        .select("id")
        .eq("user_id", userWithRole.user.id)
        .gte("leave_date", monthStartStr)
        .lte("leave_date", monthEndStr);

      // Fetch ALL pending entries (not just today's)
      const { data: allPendingEntries } = await supabase
        .from("timesheet_entries")
        .select("id")
        .eq("user_id", userWithRole.user.id)
        .eq("status", "submitted");

      if (entries) {
        const todayTotal = entries
          .filter((e) => e.status === "approved" || e.status === "submitted")
          .reduce((sum, e) => sum + getEntryDuration(e), 0);
        
        setStats((prev) => ({
          ...prev,
          todayMinutes: todayTotal,
          pending: allPendingEntries?.length || 0,
          approved: entries.filter((e) => e.status === "approved").length,
          leavesThisMonth: leavesData?.length || 0,
        }));
      }

      // Calculate weekly completion for faculty
      const startOfWeek = new Date();
      startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay() + 1); // Monday
      const weekStart = startOfWeek.toISOString().split("T")[0];

      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(endOfWeek.getDate() + 6); // Sunday
      const weekEnd = endOfWeek.toISOString().split("T")[0];

      const { data: weekEntries } = await supabase
        .from("timesheet_entries")
        .select("start_time, end_time, status")
        .eq("user_id", userWithRole.user.id)
        .gte("entry_date", weekStart)
        .lte("entry_date", weekEnd);

      if (weekEntries) {
        const weeklyActualMinutes = weekEntries
          .filter((e) => e.status === "approved" || e.status === "submitted")
          .reduce((sum, e) => sum + getEntryDuration(e), 0);
        
        // Expected: 8 hours/day * 5 working days = 40 hours = 2400 minutes
        const expectedWeeklyMinutes = 2400;
        const weeklyCompletionRate = (weeklyActualMinutes / expectedWeeklyMinutes) * 100;
        
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
        .eq("user_id", userWithRole.user.id)
        .order("entry_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(5);

      setRecentEntries(recent || []);
    }

    // Load HOD/Manager dashboard data
    if (userWithRole.role === "manager") {
      await loadHodDashboardData(userWithRole.user.id);
      setLoading(false);
      return;
    }
    
    setLoading(false);
  };

  const loadHodDashboardData = async (hodUserId: string) => {
    // Fetch HOD's departments from user_departments junction table
    const { data: hodDepartments } = await supabase
      .from("user_departments")
      .select("department_id")
      .eq("user_id", hodUserId);

    const hodDeptIds = hodDepartments?.map(d => d.department_id) || [];

    if (hodDeptIds.length === 0) {
      // No departments assigned
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

    // Fetch department names for display
    const { data: deptData } = await supabase
      .from("departments")
      .select("name, code")
      .in("id", hodDeptIds);
    
    if (deptData && deptData.length > 0) {
      setUserDepartments(deptData.map(d => `${d.name} (${d.code})`));
    }

    const today = new Date().toISOString().split("T")[0];
    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay() + 1); // Monday
    const weekStart = startOfWeek.toISOString().split("T")[0];
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 6);
    const weekEnd = endOfWeek.toISOString().split("T")[0];

    // Fetch all users in HOD's departments from user_departments
    const { data: deptUsers } = await supabase
      .from("user_departments")
      .select("user_id")
      .in("department_id", hodDeptIds);

    const allDeptUserIds = [...new Set(deptUsers?.map(d => d.user_id) || [])];

    // Fetch faculty roles to filter to only faculty
    const { data: facultyRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "faculty")
      .in("user_id", allDeptUserIds.length > 0 ? allDeptUserIds : [hodUserId]);

    // Team = faculty in HOD's departments, excluding HOD themselves
    const teamUserIds = (facultyRoles?.map(r => r.user_id) || []).filter(id => id !== hodUserId);

    // Fetch team profiles
    const { data: teamProfiles } = await supabase
      .from("profiles")
      .select("id, full_name, is_active")
      .in("id", teamUserIds.length > 0 ? teamUserIds : [hodUserId]);

    // Fetch pending approvals - get entries from users in the department
    const { data: pendingEntries } = await supabase
      .from("timesheet_entries")
      .select("id, start_time, end_time, user_id")
      .in("user_id", teamUserIds.length > 0 ? teamUserIds : [hodUserId])
      .eq("status", "submitted");

    // Fetch this week's entries for team members
    const { data: weekEntries } = await supabase
      .from("timesheet_entries")
      .select("id, start_time, end_time, user_id, activity_type")
      .in("user_id", teamUserIds.length > 0 ? teamUserIds : [hodUserId])
      .gte("entry_date", weekStart)
      .lte("entry_date", weekEnd);

    // Fetch today's leaves for team members
    const { data: todayLeavesRaw } = await supabase
      .from("leave_days")
      .select("*")
      .in("user_id", teamUserIds.length > 0 ? teamUserIds : [hodUserId])
      .eq("leave_date", today);

    // Get profiles for leave users
    const leaveUserIds = todayLeavesRaw?.map(l => l.user_id) || [];
    const { data: leaveProfiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", leaveUserIds.length > 0 ? leaveUserIds : [hodUserId]);
    
    const leaveProfileMap = new Map(leaveProfiles?.map(p => [p.id, p.full_name]) || []);

    // Calculate weekly hours using start_time/end_time
    const totalWeeklyMinutes = weekEntries?.reduce((sum, e) => sum + getEntryDuration(e), 0) || 0;
    const teamCount = teamUserIds.length;
    const expectedMinutes = teamCount * 5 * 480; // 5 days * 8 hours per team member
    const completionRate = expectedMinutes > 0 ? (totalWeeklyMinutes / expectedMinutes) * 100 : 0;

    // Activity breakdown
    const activityMap = new Map();
    weekEntries?.forEach(entry => {
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
    teamProfiles?.forEach(profile => {
      memberStatsMap.set(profile.id, {
        id: profile.id,
        name: profile.full_name,
        isActive: profile.is_active,
        minutes: 0,
        entryCount: 0,
      });
    });

    weekEntries?.forEach(entry => {
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

    const teamPerformance = Array.from(memberStatsMap.values())
      .map(member => ({
        ...member,
        hours: member.minutes / 60,
        expectedHours: 40, // 5 days * 8 hours
        completionRate: (member.minutes / 2400) * 100, // 40 hours = 2400 minutes
      }))
      .sort((a, b) => b.completionRate - a.completionRate);

    // Recent activity (last 10 entries from team)
    const { data: recentActivity } = await supabase
      .from("timesheet_entries")
      .select("id, start_time, end_time, user_id, activity_type, entry_date, created_at")
      .in("user_id", teamUserIds.length > 0 ? teamUserIds : ["no-id"])
      .order("created_at", { ascending: false })
      .limit(10);

    // Calculate today working (team members not on leave)
    const onLeaveIds = new Set(todayLeavesRaw?.map(l => l.user_id) || []);
    const todayWorking = teamCount - onLeaveIds.size;

    setHodStats({
      teamMembers: teamCount,
      pendingApprovals: pendingEntries?.length || 0,
      weeklyHours: totalWeeklyMinutes / 60,
      expectedWeeklyHours: expectedMinutes / 60,
      completionRate: Math.round(completionRate),
      activityBreakdown,
      teamPerformance,
      recentActivity: recentActivity || [],
      todayLeaves: todayLeavesRaw?.map(l => ({
        ...l,
        userName: leaveProfileMap.get(l.user_id) || "Unknown",
      })) || [],
      todayWorking,
    });
  };

  const loadAdminDashboardData = async () => {
    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    const weekStart = startOfWeek.toISOString().split("T")[0];
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 6);
    const weekEnd = endOfWeek.toISOString().split("T")[0];

    // Fetch total faculty count and their department mappings
    const { data: users } = await supabase
      .from("user_roles")
      .select("user_id, department_id")
      .eq("role", "faculty");

    // Create user to department mapping
    const userDeptMap = new Map<string, string>();
    users?.forEach(u => {
      if (u.department_id) userDeptMap.set(u.user_id, u.department_id);
    });

    // Fetch total departments
    const { data: departments } = await supabase
      .from("departments")
      .select("id, name");
    
    // Create department id to name mapping
    const deptNameMap = new Map<string, string>();
    departments?.forEach(d => deptNameMap.set(d.id, d.name));

    // Fetch pending approvals org-wide
    const { data: pendingEntries } = await supabase
      .from("timesheet_entries")
      .select("id")
      .eq("status", "submitted");

    // Fetch this week's entries
    const { data: weekEntries } = await supabase
      .from("timesheet_entries")
      .select("id, start_time, end_time, user_id, activity_type")
      .gte("entry_date", weekStart)
      .lte("entry_date", weekEnd);

    // Calculate weekly hours and activity breakdown
    const totalWeeklyMinutes = weekEntries?.reduce((sum, e) => sum + getEntryDuration(e), 0) || 0;
    const expectedMinutes = (users?.length || 0) * 5 * 480; // 5 days * 8 hours
    const completionRate = expectedMinutes > 0 ? (totalWeeklyMinutes / expectedMinutes) * 100 : 0;

    // Activity breakdown
    const activityMap = new Map();
    weekEntries?.forEach(entry => {
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

    // Department performance - get department from user_roles mapping
    const deptMap = new Map();
    weekEntries?.forEach(entry => {
      const deptId = userDeptMap.get(entry.user_id);
      if (!deptId) return; // Skip if user has no department
      const deptName = deptNameMap.get(deptId) || "Unknown";
      if (!deptMap.has(deptId)) {
        deptMap.set(deptId, { name: deptName, minutes: 0, facultyCount: new Set() });
      }
      const current = deptMap.get(deptId);
      const entryMinutes = getEntryDuration(entry);
      current.minutes += entryMinutes;
      current.facultyCount.add(entry.user_id);
    });

    const deptPerformance = Array.from(deptMap.entries()).map(([id, data]) => {
      const facultyCount = data.facultyCount.size;
      const expectedDeptMinutes = facultyCount * 5 * 480;
      const completionRate = expectedDeptMinutes > 0 ? (data.minutes / expectedDeptMinutes) * 100 : 0;
      return {
        id,
        name: data.name,
        minutes: data.minutes,
        completionRate,
        facultyCount,
      };
    }).sort((a, b) => b.completionRate - a.completionRate);

    const topDepartments = deptPerformance.filter(d => d.completionRate >= 70).slice(0, 3);
    const strugglingDepartments = deptPerformance.filter(d => d.completionRate < 70);

    // Recent activity (last 10 entries)
    const { data: recentActivity } = await supabase
      .from("timesheet_entries")
      .select("id, start_time, end_time, user_id, activity_type, entry_date, created_at")
      .order("created_at", { ascending: false })
      .limit(10);

    setAdminStats({
      totalUsers: users?.length || 0,
      totalDepartments: departments?.length || 0,
      pendingApprovals: pendingEntries?.length || 0,
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
    return `Welcome back, ${name}${role ? ` (${role.toUpperCase()})` : ""}`;
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
    switch (userWithRole.role) {
      case "member": return "Track your working hours and submit timesheets";
      case "manager": return "Review and approve team timesheets";
      case "org_admin": return "Manage users, departments, and reports";
      case "program_manager": return "Manage programs and departments";
      default: return "";
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <Clock className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {getWelcomeMessage()}
            </h1>
            <p className="text-sm text-muted-foreground">
              {getRoleDescription()}
            </p>
            {(userWithRole.role === "member" || userWithRole.role === "manager") && userDepartments.length > 0 && (
              <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                <Building2 className="h-3.5 w-3.5" />
                <span>Department: {userDepartments.join(", ")}</span>
              </p>
            )}
          </div>
        </div>

        {userWithRole.role === "member" && (
          <>
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Today's Hours</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatMinutes(stats.todayMinutes)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Target: {formatMinutes(stats.targetMinutes)}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
                  <AlertCircle className="h-4 w-4 text-warning" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-warning">
                    {stats.pending}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Total awaiting approval</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Approved</CardTitle>
                  <CheckCircle className="h-4 w-4 text-success" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-success">
                    {stats.approved}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">This week</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Leaves</CardTitle>
                  <CalendarDays className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {stats.leavesThisMonth}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">This month</p>
                </CardContent>
              </Card>
            </div>

            <EnhancedCompletionCard userId={userWithRole.user.id} />

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
                  <p className="text-sm text-muted-foreground">No entries yet. Start by creating your first timesheet entry.</p>
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

        {userWithRole.role === "manager" && (
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
                      <AlertCircle className={`h-4 w-4 ${hodStats.pendingApprovals > 0 ? 'text-warning' : 'text-muted-foreground'}`} />
                    </CardHeader>
                    <CardContent>
                      <div className={`text-2xl font-bold ${hodStats.pendingApprovals > 0 ? 'text-warning' : ''}`}>
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
                      <div className="text-2xl font-bold text-success">
                        {Math.round(hodStats.weeklyHours)}h
                      </div>
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
                        <p className={`text-4xl font-bold ${hodStats.completionRate >= 90 ? 'text-success' : hodStats.completionRate >= 70 ? 'text-warning' : 'text-destructive'}`}>
                          {hodStats.completionRate}%
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Status</p>
                        <p className="text-lg font-semibold">
                          {hodStats.completionRate >= 90 ? '✓ On Track' : hodStats.completionRate >= 70 ? '⚠ Good' : '⚠ Needs Attention'}
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
                                        <span className="text-xs bg-success/10 text-success px-1.5 py-0.5 rounded">★</span>
                                      )}
                                      {member.name}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {member.hours.toFixed(1)}h
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-2">
                                      <Progress 
                                        value={Math.min(member.completionRate, 100)} 
                                        className="h-2 w-16"
                                      />
                                      <span className={`text-xs font-medium ${member.completionRate >= 90 ? 'text-success' : member.completionRate >= 70 ? 'text-warning' : 'text-muted-foreground'}`}>
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
                            <div key={leave.id} className="flex items-center justify-between py-2 border-b last:border-0">
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

                  {/* Recent Activity */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Activity className="h-5 w-5" />
                        Recent Submissions
                      </CardTitle>
                      <CardDescription>Latest entries from your team</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {hodStats.recentActivity.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No recent activity.</p>
                      ) : (
                        <div className="space-y-3">
                          {hodStats.recentActivity.slice(0, 5).map((entry: any) => (
                            <div key={entry.id} className="flex items-center justify-between py-2 border-b last:border-0">
                              <div className="flex-1">
                                <p className="font-medium text-sm">{entry.profiles?.full_name || "Unknown"}</p>
                                <p className="text-xs text-muted-foreground">
                                  {entry.activity_type} • {formatMinutes(entry.duration_minutes)}
                                </p>
                              </div>
                              <div className="flex flex-col items-end gap-1">
                                <StatusBadge status={entry.status} />
                                <p className="text-xs text-muted-foreground">
                                  {new Date(entry.entry_date).toLocaleDateString()}
                                </p>
                              </div>
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
                    <Button variant={hodStats.pendingApprovals > 0 ? "outline" : "default"} onClick={() => navigate("/reports")}>
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

        {userWithRole.role === "org_admin" && (
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
                      <div className="text-2xl font-bold">
                        {adminStats.totalUsers}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">Active users</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Departments</CardTitle>
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {adminStats.totalDepartments}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">Total departments</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Pending Approvals</CardTitle>
                      <AlertCircle className={`h-4 w-4 ${adminStats.pendingApprovals > 0 ? 'text-warning' : 'text-muted-foreground'}`} />
                    </CardHeader>
                    <CardContent>
                      <div className={`text-2xl font-bold ${adminStats.pendingApprovals > 0 ? 'text-warning' : ''}`}>
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
                      <div className="text-2xl font-bold text-success">
                        {Math.round(adminStats.weeklyHours)}h
                      </div>
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
                        <p className={`text-4xl font-bold ${adminStats.completionRate >= 90 ? 'text-success' : adminStats.completionRate >= 70 ? 'text-warning' : 'text-destructive'}`}>
                          {adminStats.completionRate}%
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Status</p>
                        <p className="text-lg font-semibold">
                          {adminStats.completionRate >= 90 ? '✓ Excellent' : adminStats.completionRate >= 70 ? '⚠ Good' : '⚠ Needs Attention'}
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

                {/* Recent Activity */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Activity className="h-5 w-5" />
                      Recent System Activity
                    </CardTitle>
                    <CardDescription>Latest timesheet submissions across organization</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {adminStats.recentActivity.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No recent activity.</p>
                    ) : (
                      <div className="space-y-3">
                        {adminStats.recentActivity.map((entry) => (
                          <div key={entry.id} className="flex items-center justify-between py-2 border-b last:border-0">
                            <div className="flex-1">
                              <p className="font-medium text-sm">{entry.profiles?.full_name || "Unknown"}</p>
                              <p className="text-xs text-muted-foreground">
                                {entry.departments?.name} • {entry.activity_type} • {formatMinutes(entry.duration_minutes)}
                              </p>
                            </div>
                            <div className="flex flex-col items-end gap-1 text-right">
                              <StatusBadge status={entry.status} />
                              <p className="text-xs text-muted-foreground">
                                {new Date(entry.entry_date).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

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
