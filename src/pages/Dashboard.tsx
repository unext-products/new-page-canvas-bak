import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus, Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { StatusBadge } from "@/components/StatusBadge";

export default function Dashboard() {
  const { userWithRole } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    todayMinutes: 0,
    targetMinutes: 480,
    pending: 0,
    approved: 0,
    rejected: 0,
  });
  const [recentEntries, setRecentEntries] = useState<any[]>([]);

  useEffect(() => {
    loadDashboardData();
  }, [userWithRole]);

  const loadDashboardData = async () => {
    if (!userWithRole) return;

    const today = new Date().toISOString().split("T")[0];

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
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{getWelcomeMessage()}</h1>
          <p className="text-muted-foreground">
            {userWithRole.role === "faculty" && "Track your working hours and submit timesheets"}
            {userWithRole.role === "hod" && "Review and approve team timesheets"}
            {userWithRole.role === "admin" && "Manage users, departments, and reports"}
          </p>
        </div>

        {userWithRole.role === "faculty" && (
          <>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Today's Hours</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatMinutes(stats.todayMinutes)}</div>
                  <p className="text-xs text-muted-foreground">
                    Target: {formatMinutes(stats.targetMinutes)}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Pending</CardTitle>
                  <AlertCircle className="h-4 w-4 text-warning" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.pending}</div>
                  <p className="text-xs text-muted-foreground">Awaiting approval</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Approved</CardTitle>
                  <CheckCircle className="h-4 w-4 text-success" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.approved}</div>
                  <p className="text-xs text-muted-foreground">This week</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Drafts</CardTitle>
                  <XCircle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.rejected}</div>
                  <p className="text-xs text-muted-foreground">Incomplete</p>
                </CardContent>
              </Card>
            </div>

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
          <Card>
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
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button className="w-full" onClick={() => navigate("/users")}>
                  Manage Users
                </Button>
                <Button className="w-full" variant="outline" onClick={() => navigate("/departments")}>
                  Manage Departments
                </Button>
                <Button className="w-full" variant="outline" onClick={() => navigate("/reports")}>
                  View Reports
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </Layout>
  );
}
