import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/Layout";
import { PageHeader } from "@/components/PageHeader";
import { PageSkeleton } from "@/components/PageSkeleton";
import { EmptyState } from "@/components/EmptyState";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Users, Clock, CheckCircle, Calendar, Eye, TrendingUp } from "lucide-react";
import { format, startOfWeek, endOfWeek } from "date-fns";
import { MemberCalendar } from "@/components/reports/MemberCalendar";

interface TeamMember {
  id: string;
  fullName: string;
  email: string;
  avatarUrl: string | null;
  isActive: boolean;
  weeklyHours: number;
  entriesCount: number;
  completionRate: number;
  isOnLeaveToday: boolean;
}

interface TeamStats {
  totalMembers: number;
  avgCompletionRate: number;
  totalHoursThisWeek: number;
  membersOnTrack: number;
  membersOnLeaveToday: number;
}

const WEEKLY_HOURS_TARGET = 40;

export default function Team() {
  const { userWithRole, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [teamStats, setTeamStats] = useState<TeamStats | null>(null);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [showCalendarDialog, setShowCalendarDialog] = useState(false);

  useEffect(() => {
    if (!authLoading && userWithRole) {
      loadTeamData();
    }
  }, [authLoading, userWithRole]);

  const loadTeamData = async () => {
    if (!userWithRole?.departmentId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
      const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
      const today = format(new Date(), "yyyy-MM-dd");

      // Get all users in the department
      const { data: userRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("department_id", userWithRole.departmentId);

      if (!userRoles || userRoles.length === 0) {
        setTeamMembers([]);
        setTeamStats(null);
        setIsLoading(false);
        return;
      }

      const userIds = userRoles.map((ur) => ur.user_id);

      // Fetch profiles, entries, and leave days in parallel
      const [profilesRes, entriesRes, leavesRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, avatar_url, is_active")
          .in("id", userIds),
        supabase
          .from("timesheet_entries")
          .select("user_id, duration_minutes")
          .eq("department_id", userWithRole.departmentId)
          .gte("entry_date", format(weekStart, "yyyy-MM-dd"))
          .lte("entry_date", format(weekEnd, "yyyy-MM-dd")),
        supabase
          .from("leave_days")
          .select("user_id, leave_date")
          .eq("department_id", userWithRole.departmentId)
          .eq("leave_date", today),
      ]);

      const profiles = profilesRes.data || [];
      const entries = entriesRes.data || [];
      const todayLeaves = leavesRes.data || [];

      // Get auth emails for team members
      const { data: authData } = await supabase.auth.admin?.listUsers?.() || { data: null };

      // Build team member data
      const members: TeamMember[] = profiles
        .filter((p) => p.id !== userWithRole.user.id) // Exclude self
        .map((profile) => {
          const memberEntries = entries.filter((e) => e.user_id === profile.id);
          const totalMinutes = memberEntries.reduce((sum, e) => sum + e.duration_minutes, 0);
          const weeklyHours = Math.round((totalMinutes / 60) * 10) / 10;
          const completionRate = Math.min(Math.round((weeklyHours / WEEKLY_HOURS_TARGET) * 100), 100);
          const isOnLeaveToday = todayLeaves.some((l) => l.user_id === profile.id);

          return {
            id: profile.id,
            fullName: profile.full_name,
            email: "", // We don't have direct access to auth emails
            avatarUrl: profile.avatar_url,
            isActive: profile.is_active,
            weeklyHours,
            entriesCount: memberEntries.length,
            completionRate,
            isOnLeaveToday,
          };
        });

      // Calculate team stats
      const avgCompletion = members.length > 0
        ? Math.round(members.reduce((sum, m) => sum + m.completionRate, 0) / members.length)
        : 0;
      const totalHours = members.reduce((sum, m) => sum + m.weeklyHours, 0);
      const onTrack = members.filter((m) => m.completionRate >= 50).length;
      const onLeave = members.filter((m) => m.isOnLeaveToday).length;

      setTeamMembers(members);
      setTeamStats({
        totalMembers: members.length,
        avgCompletionRate: avgCompletion,
        totalHoursThisWeek: Math.round(totalHours * 10) / 10,
        membersOnTrack: onTrack,
        membersOnLeaveToday: onLeave,
      });
    } catch (error) {
      console.error("Error loading team data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getCompletionColor = (rate: number) => {
    if (rate >= 80) return "text-green-600 dark:text-green-400";
    if (rate >= 50) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  const getProgressColor = (rate: number) => {
    if (rate >= 80) return "bg-green-500";
    if (rate >= 50) return "bg-yellow-500";
    return "bg-red-500";
  };

  const handleViewCalendar = (member: TeamMember) => {
    setSelectedMember(member);
    setShowCalendarDialog(true);
  };

  if (authLoading || isLoading) {
    return (
      <Layout>
        <PageSkeleton />
      </Layout>
    );
  }

  if (!userWithRole || (userWithRole.role !== "manager" && userWithRole.role !== "org_admin")) {
    return (
      <Layout>
        <EmptyState
          icon={Users}
          title="Access Restricted"
          description="You don't have permission to view this page."
        />
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6">
        <PageHeader
          title="My Team"
          description="View and manage your team members"
        />

        {/* Team Summary Cards */}
        {teamStats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{teamStats.totalMembers}</p>
                    <p className="text-sm text-muted-foreground">Team Members</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <TrendingUp className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className={`text-2xl font-bold ${getCompletionColor(teamStats.avgCompletionRate)}`}>
                      {teamStats.avgCompletionRate}%
                    </p>
                    <p className="text-sm text-muted-foreground">Avg Completion</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Clock className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{teamStats.totalHoursThisWeek}h</p>
                    <p className="text-sm text-muted-foreground">Total Hours</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <CheckCircle className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      {teamStats.membersOnTrack}/{teamStats.totalMembers}
                    </p>
                    <p className="text-sm text-muted-foreground">On Track</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Team Members Grid */}
        {teamMembers.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No Team Members"
            description="There are no team members in your department yet."
          />
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {teamMembers.map((member) => (
              <Card key={member.id} variant="interactive" className="overflow-hidden">
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={member.avatarUrl || undefined} />
                      <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                        {member.fullName
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .toUpperCase()
                          .slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold truncate">{member.fullName}</h3>
                        {member.isOnLeaveToday && (
                          <Badge variant="secondary" className="text-xs shrink-0">
                            On Leave
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {member.isActive ? "Active" : "Inactive"}
                      </p>
                    </div>
                  </div>

                  {/* Weekly Stats */}
                  <div className="mt-4 space-y-3">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-muted-foreground">Weekly Hours</span>
                        <span className="font-medium">
                          {member.weeklyHours}h / {WEEKLY_HOURS_TARGET}h
                        </span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all ${getProgressColor(member.completionRate)}`}
                          style={{ width: `${member.completionRate}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Completion</span>
                      <span className={`font-semibold ${getCompletionColor(member.completionRate)}`}>
                        {member.completionRate}%
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Entries This Week</span>
                      <span className="font-medium">{member.entriesCount}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-4 flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => handleViewCalendar(member)}
                    >
                      <Calendar className="h-4 w-4 mr-1" />
                      Calendar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => navigate("/approvals")}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      Review
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Member Calendar Dialog */}
        <Dialog open={showCalendarDialog} onOpenChange={setShowCalendarDialog}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                {selectedMember && (
                  <>
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={selectedMember.avatarUrl || undefined} />
                      <AvatarFallback className="bg-primary/10 text-primary text-sm">
                        {selectedMember.fullName
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .toUpperCase()
                          .slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    {selectedMember.fullName}'s Calendar
                  </>
                )}
              </DialogTitle>
            </DialogHeader>
            {selectedMember && (
              <MemberCalendar
                memberId={selectedMember.id}
                month={new Date()}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
