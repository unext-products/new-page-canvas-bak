import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus, Clock, CheckCircle, XCircle, AlertCircle, Users, Building2, TrendingUp, Activity } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { StatusBadge } from "@/components/StatusBadge";
import { ActivityBreakdownChart } from "@/components/reports/ActivityBreakdownChart";
import { CompletionMetricsCard } from "@/components/reports/CompletionMetricsCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";

export default function Dashboard() {
  const { userWithRole } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    todayMinutes: 0,
    targetMinutes: 480,
    pending: 0,
    approved: 0,
    rejected: 0,
    weeklyActualMinutes: 0,
    expectedWeeklyMinutes: 2400,
    weeklyCompletionRate: 0,
  });
  const [recentEntries, setRecentEntries] = useState<any[]>([]);
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, [userWithRole]);

  const loadDashboardData = async () => {
    if (!userWithRole) return;
    
    setLoading(true);
    const today = new Date().toISOString().split("T")[0];

    // Load admin dashboard data
    if (userWithRole.role === "admin") {
      await loadAdminDashboardData();
      setLoading(false);
      return;
    }

    // Load today's total minutes for faculty
    if (userWithRole.role === "faculty") {
      const { data: entries } = await supabase
        .from("timesheet_entries")
        .select("duration_minutes, status")
        .eq("user_id", userWithRole.user.id)
        .eq("entry_date", today);

      if (entries) {
        const todayTotal = entries
          .filter((e) => e.status === "approved" || e.status === "submitted")
          .reduce((sum, e) => sum + e.duration_minutes, 0);
        
        setStats((prev) => ({
          ...prev,
          todayMinutes: todayTotal,
          pending: entries.filter((e) => e.status === "submitted").length,
          approved: entries.filter((e) => e.status === "approved").length,
          rejected: entries.filter((e) => e.status === "draft" || e.status === "rejected").length,
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
        .select("duration_minutes, status")
        .eq("user_id", userWithRole.user.id)
        .gte("entry_date", weekStart)
        .lte("entry_date", weekEnd);

      if (weekEntries) {
        const weeklyActualMinutes = weekEntries
          .filter((e) => e.status === "approved" || e.status === "submitted")
          .reduce((sum, e) => sum + e.duration_minutes, 0);
        
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

    // Load pending approvals for HOD
    if (userWithRole.role === "hod" && userWithRole.departmentId) {
      const { data: pending } = await supabase
        .from("timesheet_entries")
        .select("*")
        .eq("department_id", userWithRole.departmentId)
        .eq("status", "submitted");

      setStats((prev) => ({ ...prev, pending: pending?.length || 0 }));
    }
    
    setLoading(false);
  };

  const loadAdminDashboardData = async () => {
    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    const weekStart = startOfWeek.toISOString().split("T")[0];
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 6);
    const weekEnd = endOfWeek.toISOString().split("T")[0];

    // Fetch total faculty count
    const { data: users } = await supabase
      .from("user_roles")
      .select("*")
      .eq("role", "faculty");

    // Fetch total departments
    const { data: departments } = await supabase
      .from("departments")
      .select("*");

    // Fetch pending approvals org-wide
    const { data: pendingEntries } = await supabase
      .from("timesheet_entries")
      .select("*")
      .eq("status", "submitted");

    // Fetch this week's entries
    const { data: weekEntries } = await supabase
      .from("timesheet_entries")
      .select("*, departments(name)")
      .gte("entry_date", weekStart)
      .lte("entry_date", weekEnd);

    // Calculate weekly hours and activity breakdown
    const totalWeeklyMinutes = weekEntries?.reduce((sum, e) => sum + e.duration_minutes, 0) || 0;
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
      activityMap.set(type, {
        minutes: current.minutes + entry.duration_minutes,
        count: current.count + 1,
      });
    });

    const activityBreakdown = Array.from(activityMap.entries()).map(([type, data]) => ({
      activityType: type,
      hours: data.minutes / 60,
      percentage: totalWeeklyMinutes > 0 ? (data.minutes / totalWeeklyMinutes) * 100 : 0,
      count: data.count,
    }));

    // Department performance
    const deptMap = new Map();
    weekEntries?.forEach(entry => {
      const deptId = entry.department_id;
      const deptName = entry.departments?.name || "Unknown";
      if (!deptMap.has(deptId)) {
        deptMap.set(deptId, { name: deptName, minutes: 0, facultyCount: new Set() });
      }
      const current = deptMap.get(deptId);
      current.minutes += entry.duration_minutes;
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
      .select("*, profiles(full_name), departments(name)")
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

  return (
    <Layout>
      <div className="space-y-4 sm:space-y-6">
        <div className="animate-fade-in-up">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight bg-gradient-to-r from-foreground via-foreground to-foreground/70 bg-clip-text text-transparent">
            {getWelcomeMessage()}
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-2">
            {userWithRole.role === "faculty" && "Track your working hours and submit timesheets"}
            {userWithRole.role === "hod" && "Review and approve team timesheets"}
            {userWithRole.role === "admin" && "Manage users, departments, and reports"}
          </p>
        </div>

        {userWithRole.role === "faculty" && (
          <>
            <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 animate-fade-in-up">
              <Card className="bg-card/50 backdrop-blur-xl border-border/40 hover:scale-105 transition-transform duration-300 hover:border-primary/50">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xs sm:text-sm font-medium">Today's Hours</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                    {formatMinutes(stats.todayMinutes)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Target: {formatMinutes(stats.targetMinutes)}
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-card/50 backdrop-blur-xl border-border/40 hover:scale-105 transition-transform duration-300 hover:border-warning/50">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xs sm:text-sm font-medium">Pending</CardTitle>
                  <AlertCircle className="h-4 w-4 text-warning" />
                </CardHeader>
                <CardContent>
                  <div className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-warning to-warning/60 bg-clip-text text-transparent">
                    {stats.pending}
                  </div>
                  <p className="text-xs text-muted-foreground">Awaiting approval</p>
                </CardContent>
              </Card>

              <Card className="bg-card/50 backdrop-blur-xl border-border/40 hover:scale-105 transition-transform duration-300 hover:border-success/50">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xs sm:text-sm font-medium">Approved</CardTitle>
                  <CheckCircle className="h-4 w-4 text-success" />
                </CardHeader>
                <CardContent>
                  <div className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-success to-success/60 bg-clip-text text-transparent">
                    {stats.approved}
                  </div>
                  <p className="text-xs text-muted-foreground">This week</p>
                </CardContent>
              </Card>

              <Card className="bg-card/50 backdrop-blur-xl border-border/40 hover:scale-105 transition-transform duration-300 hover:border-border/60">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xs sm:text-sm font-medium">Drafts</CardTitle>
                  <XCircle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/60 bg-clip-text text-transparent">
                    {stats.rejected}
                  </div>
                  <p className="text-xs text-muted-foreground">Incomplete</p>
                </CardContent>
              </Card>
            </div>

            <div className="animate-fade-in-up" style={{ animationDelay: "200ms" }}>
              <CompletionMetricsCard
                actualHours={stats.weeklyActualMinutes / 60}
                expectedHours={stats.expectedWeeklyMinutes / 60}
                completionRate={stats.weeklyCompletionRate}
                period="weekly"
              />
            </div>

            <Card className="bg-card/50 backdrop-blur-xl border-border/40 animate-fade-in-up">
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

            <Card className="bg-card/50 backdrop-blur-xl border-border/40 animate-fade-in-up">
              <CardHeader>
                <CardTitle>Recent Entries</CardTitle>
                <CardDescription>Your latest timesheet submissions</CardDescription>
              </CardHeader>
              <CardContent>
                {recentEntries.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No entries yet. Start by creating your first timesheet entry.</p>
                ) : (
                  <div className="space-y-4">
                    {recentEntries.map((entry) => (
                      <div key={entry.id} className="flex items-center justify-between border-b pb-3 last:border-0">
                        <div>
                          <p className="font-medium">{new Date(entry.entry_date).toLocaleDateString()}</p>
                          <p className="text-sm text-muted-foreground">
                            {entry.activity_type} • {formatMinutes(entry.duration_minutes)}
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

        {userWithRole.role === "hod" && (
          <Card className="bg-card/50 backdrop-blur-xl border-border/40 animate-fade-in-up">
            <CardHeader>
              <CardTitle>Pending Approvals</CardTitle>
              <CardDescription>
                You have {stats.pending} timesheet{stats.pending !== 1 ? "s" : ""} waiting for review
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => navigate("/approvals")}>
                View Approvals
              </Button>
            </CardContent>
          </Card>
        )}

        {userWithRole.role === "admin" && (
          <>
            {loading ? (
              <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 animate-fade-in-up">
                {[1, 2, 3, 4].map((i) => (
                  <Card key={i} className="bg-card/50 backdrop-blur-xl border-border/40">
                    <CardHeader className="space-y-0 pb-2">
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
                <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 animate-fade-in-up">
                  <Card className="bg-card/50 backdrop-blur-xl border-border/40 hover:scale-105 transition-transform duration-300 hover:border-primary/50">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-xs sm:text-sm font-medium">Total Faculty</CardTitle>
                      <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent break-words">
                        {adminStats.totalUsers}
                      </div>
                      <p className="text-xs text-muted-foreground">Active users</p>
                    </CardContent>
                  </Card>

                  <Card className="bg-card/50 backdrop-blur-xl border-border/40 hover:scale-105 transition-transform duration-300 hover:border-accent/50">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-xs sm:text-sm font-medium">Departments</CardTitle>
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-accent to-accent/60 bg-clip-text text-transparent break-words">
                        {adminStats.totalDepartments}
                      </div>
                      <p className="text-xs text-muted-foreground">Total departments</p>
                    </CardContent>
                  </Card>

                  <Card className={`bg-card/50 backdrop-blur-xl border-border/40 hover:scale-105 transition-transform duration-300 ${adminStats.pendingApprovals > 0 ? 'hover:border-warning/50' : 'hover:border-border/60'}`}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-xs sm:text-sm font-medium">Pending Approvals</CardTitle>
                      <AlertCircle className={`h-4 w-4 ${adminStats.pendingApprovals > 0 ? 'text-warning' : 'text-muted-foreground'}`} />
                    </CardHeader>
                    <CardContent>
                      <div className={`text-xl sm:text-2xl font-bold bg-gradient-to-r ${adminStats.pendingApprovals > 0 ? 'from-warning to-warning/60' : 'from-foreground to-foreground/60'} bg-clip-text text-transparent break-words`}>
                        {adminStats.pendingApprovals}
                      </div>
                      <p className="text-xs text-muted-foreground">Awaiting review</p>
                    </CardContent>
                  </Card>

                  <Card className="bg-card/50 backdrop-blur-xl border-border/40 hover:scale-105 transition-transform duration-300 hover:border-success/50">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-xs sm:text-sm font-medium">This Week</CardTitle>
                      <Clock className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-success to-success/60 bg-clip-text text-transparent break-words">
                        {Math.round(adminStats.weeklyHours)}h
                      </div>
                      <p className="text-xs text-muted-foreground">
                        / {Math.round(adminStats.expectedWeeklyHours)}h expected
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Organization Health Card */}
                <Card className="bg-card/50 backdrop-blur-xl border-border/40 animate-fade-in-up">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                      <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5" />
                      Organization Health
                    </CardTitle>
                    <CardDescription className="text-xs sm:text-sm">Weekly performance overview</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div>
                        <p className="text-xs sm:text-sm text-muted-foreground">Completion Rate</p>
                        <p className={`text-3xl sm:text-4xl font-bold ${adminStats.completionRate >= 90 ? 'text-success' : adminStats.completionRate >= 70 ? 'text-warning' : 'text-destructive'}`}>
                          {adminStats.completionRate}%
                        </p>
                      </div>
                      <div className="sm:text-right">
                        <p className="text-xs sm:text-sm text-muted-foreground">Status</p>
                        <p className="text-base sm:text-lg font-semibold">
                          {adminStats.completionRate >= 90 ? '✓ Excellent' : adminStats.completionRate >= 70 ? '⚠ Good' : '⚠ Needs Attention'}
                        </p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs sm:text-sm">
                        <span>Actual: {Math.round(adminStats.weeklyHours)}h</span>
                        <span>Expected: {Math.round(adminStats.expectedWeeklyHours)}h</span>
                      </div>
                      <Progress value={adminStats.completionRate} className="h-2" />
                    </div>
                  </CardContent>
                </Card>

                <div className="grid gap-3 sm:gap-4 md:grid-cols-2 animate-fade-in-up">
                  {/* Department Performance */}
                  <Card className="bg-card/50 backdrop-blur-xl border-border/40">
                    <CardHeader>
                      <CardTitle className="text-base sm:text-lg">Department Performance</CardTitle>
                      <CardDescription className="text-xs sm:text-sm">Top and struggling departments</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3 sm:space-y-4">
                      {adminStats.topDepartments.length > 0 && (
                        <div>
                          <h4 className="text-xs sm:text-sm font-semibold mb-2 text-success flex items-center gap-2">
                            <CheckCircle className="h-4 w-4" />
                            Top Performers
                          </h4>
                          <div className="space-y-2">
                            {adminStats.topDepartments.map((dept) => (
                              <div key={dept.id} className="flex items-center justify-between text-xs sm:text-sm gap-2">
                                <span className="break-words flex-1">{dept.name}</span>
                                <span className="font-semibold text-success whitespace-nowrap">{Math.round(dept.completionRate)}%</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {adminStats.strugglingDepartments.length > 0 && (
                        <div>
                          <h4 className="text-xs sm:text-sm font-semibold mb-2 text-warning flex items-center gap-2">
                            <AlertCircle className="h-4 w-4" />
                            Needs Attention
                          </h4>
                          <div className="space-y-2">
                            {adminStats.strugglingDepartments.slice(0, 3).map((dept) => (
                              <div key={dept.id} className="flex items-center justify-between text-xs sm:text-sm gap-2">
                                <span className="break-words flex-1">{dept.name}</span>
                                <span className="font-semibold text-warning whitespace-nowrap">{Math.round(dept.completionRate)}%</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {adminStats.topDepartments.length === 0 && adminStats.strugglingDepartments.length === 0 && (
                        <p className="text-xs sm:text-sm text-muted-foreground">No department data available yet.</p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Activity Breakdown */}
                  <Card className="bg-card/50 backdrop-blur-xl border-border/40">
                    <CardHeader>
                      <CardTitle className="text-base sm:text-lg">Activity Distribution</CardTitle>
                      <CardDescription className="text-xs sm:text-sm">This week's activity breakdown</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {adminStats.activityBreakdown.length > 0 ? (
                        <ActivityBreakdownChart data={adminStats.activityBreakdown} />
                      ) : (
                        <p className="text-xs sm:text-sm text-muted-foreground">No activity data available yet.</p>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Recent Activity */}
                <Card className="bg-card/50 backdrop-blur-xl border-border/40 animate-fade-in-up">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                      <Activity className="h-4 w-4 sm:h-5 sm:w-5" />
                      Recent System Activity
                    </CardTitle>
                    <CardDescription className="text-xs sm:text-sm">Latest timesheet submissions across organization</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {adminStats.recentActivity.length === 0 ? (
                      <p className="text-xs sm:text-sm text-muted-foreground">No recent activity.</p>
                    ) : (
                      <div className="space-y-3">
                        {adminStats.recentActivity.map((entry) => (
                          <div key={entry.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 border-b pb-3 last:border-0">
                            <div className="space-y-1 min-w-0 flex-1">
                              <p className="font-medium text-xs sm:text-sm break-words">{entry.profiles?.full_name || "Unknown"}</p>
                              <p className="text-xs text-muted-foreground break-words">
                                {entry.departments?.name} • {entry.activity_type} • {formatMinutes(entry.duration_minutes)}
                              </p>
                            </div>
                            <div className="flex sm:flex-col items-center sm:items-end gap-2 sm:gap-1 sm:text-right">
                              <StatusBadge status={entry.status} />
                              <p className="text-xs text-muted-foreground whitespace-nowrap">
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
                <Card className="bg-card/50 backdrop-blur-xl border-border/40 animate-fade-in-up">
                  <CardHeader>
                    <CardTitle className="text-base sm:text-lg">Quick Actions</CardTitle>
                    <CardDescription className="text-xs sm:text-sm">Manage system settings and data</CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-wrap gap-2">
                    <Button className="w-full sm:w-auto" onClick={() => navigate("/users")}>
                      <Users className="mr-2 h-4 w-4" />
                      Manage Users
                    </Button>
                    <Button className="w-full sm:w-auto" variant="outline" onClick={() => navigate("/departments")}>
                      <Building2 className="mr-2 h-4 w-4" />
                      Manage Departments
                    </Button>
                    <Button className="w-full sm:w-auto" variant="outline" onClick={() => navigate("/reports")}>
                      <TrendingUp className="mr-2 h-4 w-4" />
                      View Reports
                    </Button>
                    {adminStats.pendingApprovals > 0 && (
                      <Button className="w-full sm:w-auto" variant="outline" onClick={() => navigate("/approvals")}>
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
