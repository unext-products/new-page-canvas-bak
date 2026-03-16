import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/Layout";
import { PageHeader } from "@/components/PageHeader";
import { PageSkeleton } from "@/components/PageSkeleton";
import { EmptyState } from "@/components/EmptyState";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Users, Clock, CheckCircle, Calendar, Eye, TrendingUp, Search, Download, FileSpreadsheet, FileText } from "lucide-react";
import { format, startOfWeek, endOfWeek } from "date-fns";
import { MemberCalendar } from "@/components/reports/MemberCalendar";
import { calculateDurationMinutes } from "@/lib/timesheetUtils";
import { calculateUserTotalDailyTargetMinutes } from "@/lib/targets";
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface TeamMember {
  id: string;
  fullName: string;
  email: string;
  avatarUrl: string | null;
  isActive: boolean;
  weeklyHours: number;
  weeklyTargetHours: number;
  entriesCount: number;
  completionRate: number;
  isOnLeaveToday: boolean;
  leavesThisMonth: number;
}

interface TeamStats {
  totalMembers: number;
  avgCompletionRate: number;
  totalHoursThisWeek: number;
  membersOnTrack: number;
  membersOnLeaveToday: number;
}

export default function Team() {
  const { userWithRole, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [teamStats, setTeamStats] = useState<TeamStats | null>(null);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [showCalendarDialog, setShowCalendarDialog] = useState(false);
  
  // Search and download state
  const [searchQuery, setSearchQuery] = useState("");
  const [downloadDialogOpen, setDownloadDialogOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && userWithRole) {
      loadTeamData();
    }
  }, [authLoading, userWithRole]);

  const loadTeamData = async () => {
    if (!userWithRole?.user?.id) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
      const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
      const today = format(new Date(), "yyyy-MM-dd");
      const currentRole = userWithRole.role;
      const isL3 = currentRole === "l3" || currentRole === "manager";
      const isL2 = currentRole === "l2" || currentRole === "program_manager";
      const isAdmin = currentRole === "org_admin" || currentRole === "admin";

      let userIds: string[] = [];

      // L3 sees L2 + L1 in their verticals
      if (isL3) {
        // Get L3's verticals
        const { data: l3Verticals } = await supabase
          .from("user_verticals")
          .select("vertical_id")
          .eq("user_id", userWithRole.user.id);

        const verticalIds = l3Verticals?.map((v) => v.vertical_id) || [];

        if (verticalIds.length > 0) {
          // Get users in those verticals
          const { data: verticalUsers } = await supabase
            .from("user_verticals")
            .select("user_id")
            .in("vertical_id", verticalIds);

          const candidateUserIds = [...new Set(verticalUsers?.map((u) => u.user_id) || [])];

          // Filter to L1 and L2 roles only
          const { data: subordinateRoles } = await supabase
            .from("user_roles")
            .select("user_id")
            .in("user_id", candidateUserIds)
            .in("role", ["l1", "l2", "faculty", "program_manager"]);

          userIds = (subordinateRoles?.map((r) => r.user_id) || []).filter(
            (id) => id !== userWithRole.user.id
          );
        }
      }
      // L2 sees L1 in their programs OR in their verticals if no program assignments
      else if (isL2) {
        // Get L2's programs
        const { data: l2Programs } = await supabase
          .from("user_programs")
          .select("program_id")
          .eq("user_id", userWithRole.user.id);

        const programIds = l2Programs?.map((p) => p.program_id) || [];

        if (programIds.length > 0) {
          // Get users in those programs
          const { data: programUsers } = await supabase
            .from("user_programs")
            .select("user_id")
            .in("program_id", programIds);

          const candidateUserIds = [...new Set(programUsers?.map((u) => u.user_id) || [])];

          if (candidateUserIds.length > 0) {
            // Filter to L1 roles only
            const { data: l1Roles } = await supabase
              .from("user_roles")
              .select("user_id")
              .in("user_id", candidateUserIds)
              .in("role", ["l1", "faculty"]);

            userIds = (l1Roles?.map((r) => r.user_id) || []).filter(
              (id) => id !== userWithRole.user.id
            );
          }
        }
        
        // Fallback: If no L1s found via programs, try via verticals (same as L3 logic)
        if (userIds.length === 0) {
          const { data: l2Verticals } = await supabase
            .from("user_verticals")
            .select("vertical_id")
            .eq("user_id", userWithRole.user.id);

          const verticalIds = l2Verticals?.map((v) => v.vertical_id) || [];

          if (verticalIds.length > 0) {
            const { data: verticalUsers } = await supabase
              .from("user_verticals")
              .select("user_id")
              .in("vertical_id", verticalIds);

            const candidateUserIds = [...new Set(verticalUsers?.map((u) => u.user_id) || [])];

            if (candidateUserIds.length > 0) {
              const { data: l1Roles } = await supabase
                .from("user_roles")
                .select("user_id")
                .in("user_id", candidateUserIds)
                .in("role", ["l1", "faculty"]);

              userIds = (l1Roles?.map((r) => r.user_id) || []).filter(
                (id) => id !== userWithRole.user.id
              );
            }
          }
        }
      }
      // Admin sees all users in org (except super_admin)
      else if (isAdmin) {
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("organization_id")
          .eq("user_id", userWithRole.user.id)
          .single();

        if (roleData?.organization_id) {
          const { data: orgUsers } = await supabase
            .from("user_roles")
            .select("user_id")
            .eq("organization_id", roleData.organization_id)
            .neq("role", "super_admin");

          userIds = (orgUsers?.map((u) => u.user_id) || []).filter(
            (id) => id !== userWithRole.user.id
          );
        }
      }

      if (userIds.length === 0) {
        setTeamMembers([]);
        setTeamStats(null);
        setIsLoading(false);
        return;
      }

      // Calculate month range for leaves
      const monthStart = new Date();
      monthStart.setDate(1);
      const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);

      // Calculate working week range (Mon-Fri)
      const weekFriday = new Date(weekStart);
      weekFriday.setDate(weekFriday.getDate() + 4); // Friday

      // Fetch profiles, entries, today's leaves, month's leaves, and this week's leaves in parallel
      const [profilesRes, entriesRes, leavesRes, monthLeavesRes, weekLeavesRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, avatar_url, is_active")
          .in("id", userIds),
        supabase
          .from("timesheet_entries")
          .select("user_id, start_time, end_time")
          .in("user_id", userIds)
          .gte("entry_date", format(weekStart, "yyyy-MM-dd"))
          .lte("entry_date", format(weekEnd, "yyyy-MM-dd")),
        supabase
          .from("leave_days")
          .select("user_id, leave_date")
          .in("user_id", userIds)
          .eq("leave_date", today),
        supabase
          .from("leave_days")
          .select("user_id, leave_date")
          .in("user_id", userIds)
          .gte("leave_date", format(monthStart, "yyyy-MM-dd"))
          .lte("leave_date", format(monthEnd, "yyyy-MM-dd")),
        supabase
          .from("leave_days")
          .select("user_id, leave_date, leave_type")
          .in("user_id", userIds)
          .gte("leave_date", format(weekStart, "yyyy-MM-dd"))
          .lte("leave_date", format(weekFriday, "yyyy-MM-dd")),
      ]);

      const profiles = profilesRes.data || [];
      const entries = entriesRes.data || [];
      const todayLeaves = leavesRes.data || [];
      const monthLeaves = monthLeavesRes.data || [];
      const weekLeaves = weekLeavesRes.data || [];

      // Build team member data with per-user targets
      const memberPromises = profiles
        .filter((p) => p.id !== userWithRole.user.id) // Exclude self
        .map(async (profile) => {
          const memberEntries = entries.filter((e) => e.user_id === profile.id);
          const totalMinutes = memberEntries.reduce((sum, e) => sum + calculateDurationMinutes(e.start_time, e.end_time), 0);
          const weeklyHours = Math.round((totalMinutes / 60) * 10) / 10;
          
          // Fetch user's actual daily target
          const targetBreakdown = await calculateUserTotalDailyTargetMinutes(profile.id);
          
          // Calculate working days minus leave days (with half-day support)
          const { getLeaveWeight } = await import("@/lib/leaveUtils");
          const memberWeekLeaveDays = weekLeaves.filter((l) => l.user_id === profile.id)
            .reduce((sum, l) => sum + getLeaveWeight((l as any).leave_type || 'other'), 0);
          const workingDaysThisWeek = Math.max(0, 5 - memberWeekLeaveDays);
          const weeklyTargetHours = (targetBreakdown.totalDailyTargetMinutes / 60) * workingDaysThisWeek;
          
          const completionRate = weeklyTargetHours > 0 
            ? Math.min(Math.round((weeklyHours / weeklyTargetHours) * 100), 100)
            : 0;
          const isOnLeaveToday = todayLeaves.some((l) => l.user_id === profile.id);
          const leavesThisMonth = monthLeaves.filter((l) => l.user_id === profile.id).length;

          return {
            id: profile.id,
            fullName: profile.full_name,
            email: "", // Will be populated if needed
            avatarUrl: profile.avatar_url,
            isActive: profile.is_active,
            weeklyHours,
            weeklyTargetHours: Math.round(weeklyTargetHours * 10) / 10,
            entriesCount: memberEntries.length,
            completionRate,
            isOnLeaveToday,
            leavesThisMonth,
          };
        });

      const members = await Promise.all(memberPromises);

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

  // Filter team members by search query
  const filteredTeamMembers = useMemo(() => {
    if (!searchQuery.trim()) return teamMembers;
    const query = searchQuery.toLowerCase();
    return teamMembers.filter(member =>
      member.fullName.toLowerCase().includes(query) ||
      member.email.toLowerCase().includes(query)
    );
  }, [teamMembers, searchQuery]);

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

  // Export to CSV
  const exportTeamToCSV = () => {
    const membersToExport = filteredTeamMembers;
    const headers = ["Name", "Status", "Weekly Hours", "Target Hours", "Completion %", "Entries This Week", "Leaves This Month", "On Leave Today"];
    const rows = membersToExport.map(member => [
      member.fullName,
      member.isActive ? "Active" : "Inactive",
      member.weeklyHours.toString(),
      member.weeklyTargetHours.toString(),
      `${member.completionRate}%`,
      member.entriesCount.toString(),
      member.leavesThisMonth.toString(),
      member.isOnLeaveToday ? "Yes" : "No"
    ]);
    
    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(","))
      .join("\n");
    
    const blob = new Blob([csvContent], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `team_members_${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
    
    setDownloadDialogOpen(false);
    toast({
      title: "Success",
      description: `Exported ${membersToExport.length} team members to CSV`,
    });
  };

  // Export to PDF
  const exportTeamToPDF = () => {
    const membersToExport = filteredTeamMembers;
    const doc = new jsPDF();
    
    doc.setFontSize(20);
    doc.setTextColor(41, 128, 185);
    doc.text("Team Members List", 14, 22);
    
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text(`Generated: ${format(new Date(), "PPP")}`, 14, 32);
    doc.text(`Total Members: ${membersToExport.length}`, 14, 38);
    
    if (teamStats) {
      doc.text(`Avg Completion: ${teamStats.avgCompletionRate}%`, 14, 44);
      doc.text(`Total Hours This Week: ${teamStats.totalHoursThisWeek}h`, 100, 44);
    }
    
    autoTable(doc, {
      startY: 54,
      head: [["Name", "Status", "Weekly Hours", "Target", "Completion", "Entries", "Leaves"]],
      body: membersToExport.map(member => [
        member.fullName,
        member.isActive ? "Active" : "Inactive",
        `${member.weeklyHours}h`,
        `${member.weeklyTargetHours}h`,
        `${member.completionRate}%`,
        member.entriesCount.toString(),
        member.leavesThisMonth.toString()
      ]),
      theme: "striped",
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: {
        fillColor: [41, 128, 185],
        textColor: [255, 255, 255],
        fontStyle: "bold",
      },
    });
    
    // Add footer with page numbers
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(128, 128, 128);
      doc.text(
        `Page ${i} of ${pageCount}`,
        doc.internal.pageSize.width / 2,
        doc.internal.pageSize.height - 10,
        { align: "center" }
      );
    }
    
    doc.save(`team_members_${format(new Date(), "yyyy-MM-dd")}.pdf`);
    
    setDownloadDialogOpen(false);
    toast({
      title: "Success",
      description: `Exported ${membersToExport.length} team members to PDF`,
    });
  };

  if (authLoading || isLoading) {
    return (
      <Layout>
        <PageSkeleton />
      </Layout>
    );
  }

  // Allow L2, L3, and Admin to view team
  const allowedRoles = ["l2", "l3", "org_admin", "admin", "manager", "hod", "program_manager"];
  if (!userWithRole || !allowedRoles.includes(userWithRole.role)) {
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

        {/* Search Bar and Download Button */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button 
            variant="outline" 
            onClick={() => setDownloadDialogOpen(true)}
            disabled={teamMembers.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            Download List
          </Button>
        </div>

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
        {filteredTeamMembers.length === 0 ? (
          <EmptyState
            icon={Users}
            title={searchQuery ? "No matching members" : "No Team Members"}
            description={searchQuery ? "Try adjusting your search query." : "There are no team members in your department yet."}
          />
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTeamMembers.map((member) => (
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
                          {member.weeklyHours}h / {member.weeklyTargetHours}h
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

                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Leaves This Month</span>
                      <span className="font-medium">{member.leavesThisMonth}</span>
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

        {/* Download Dialog */}
        <Dialog open={downloadDialogOpen} onOpenChange={setDownloadDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Download Team List</DialogTitle>
              <DialogDescription>
                {searchQuery ? 
                  `Export ${filteredTeamMembers.length} filtered team members` : 
                  `Export all ${teamMembers.length} team members`
                }
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <p className="text-sm text-muted-foreground">
                Choose your preferred export format:
              </p>
              
              <div className="grid grid-cols-2 gap-4">
                <Button
                  variant="outline"
                  onClick={exportTeamToCSV}
                  className="h-24 flex flex-col items-center justify-center gap-2"
                >
                  <FileSpreadsheet className="h-8 w-8 text-green-600" />
                  <span>Export as CSV</span>
                </Button>
                
                <Button
                  variant="outline"
                  onClick={exportTeamToPDF}
                  className="h-24 flex flex-col items-center justify-center gap-2"
                >
                  <FileText className="h-8 w-8 text-red-600" />
                  <span>Export as PDF</span>
                </Button>
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="ghost" onClick={() => setDownloadDialogOpen(false)}>
                Cancel
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
