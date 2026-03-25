import { useState, useEffect, useMemo, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Layout } from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { CheckCircle, XCircle, Clock, Calendar, User, Filter, X, ClipboardCheck, CalendarDays, List, ZoomIn, Trash2 } from "lucide-react";
import { isRole } from "@/lib/roleMapping";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { formatLocalDate } from "@/lib/dateUtils";
import { format } from "date-fns";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { approvalNotesSchema } from "@/lib/validation";
import { getUserErrorMessage } from "@/lib/errorHandler";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { PageSkeleton } from "@/components/PageSkeleton";
import { useApprovalSettings } from "@/hooks/useApprovalSettings";
import { calculateDurationMinutes } from "@/lib/timesheetUtils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { DayMatrixView, MatrixTimesheetEntry } from "@/components/calendar/DayMatrixView";

interface TimesheetEntry {
  id: string;
  user_id: string;
  entry_date: string;
  start_time: string;
  end_time: string;
  activity_type: string;
  activity_subtype: string | null;
  notes: string | null;
  status: string;
  approved_by?: string | null;
  approved_at?: string | null;
  approver_notes?: string | null;
  department_code?: string | null;
  vertical_id?: string | null;
  vertical_code?: string | null;
  program_id?: string | null;
  program_code?: string | null;
  batch_id?: string | null;
  batch_name?: string | null;
  term_id?: string | null;
  term_name?: string | null;
  subject_id?: string | null;
  subject_code?: string | null;
  profiles: {
    full_name: string;
    avatar_url: string | null;
  };
  approver_profile?: {
    full_name: string;
  } | null;
  type: 'timesheet';
}

interface LeaveEntry {
  id: string;
  user_id: string;
  leave_date: string;
  leave_type: string;
  comments: string | null;
  profiles: {
    full_name: string;
    avatar_url: string | null;
  };
  type: 'leave';
}

type CombinedEntry = TimesheetEntry | LeaveEntry;

export default function Approvals() {
  const { userWithRole, loading: authLoading } = useAuth();
  const { settings, loading: settingsLoading, getApprovableRoles } = useApprovalSettings();
  const [entries, setEntries] = useState<TimesheetEntry[]>([]);
  const [leaveEntries, setLeaveEntries] = useState<LeaveEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<TimesheetEntry | null>(null);
  const [actionType, setActionType] = useState<"approve" | "reject" | null>(null);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  
  // Bulk selection state
  const [selectedEntries, setSelectedEntries] = useState<Set<string>>(new Set());
  const [filterFaculty, setFilterFaculty] = useState<string | null>(null);
  const [filterActivity, setFilterActivity] = useState<string | null>(null);
  const [filterDate, setFilterDate] = useState<Date | null>(new Date());
  const [filterLeavesOnly, setFilterLeavesOnly] = useState(false);
  
  // View mode state - default to day view
  const [viewMode, setViewMode] = useState<"list" | "day">("day");
  
  // New: Show all statuses toggle (default: show all)
  const [showPendingOnly, setShowPendingOnly] = useState(false);
  
  // New: Slot interval for zoom view
  const [slotInterval, setSlotInterval] = useState<"1hour" | "15min">("1hour");
  
  // Bulk action state
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkAction, setBulkAction] = useState<"approve" | "reject" | null>(null);
  const [bulkComment, setBulkComment] = useState("");
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  
  // Leave delete state
  const [deleteLeaveDialogOpen, setDeleteLeaveDialogOpen] = useState(false);
  const [leaveToDelete, setLeaveToDelete] = useState<LeaveEntry | null>(null);
  
  const { toast } = useToast();
  const navigate = useNavigate();

  // Allow L2, L3, and org_admin to access approvals
  const allowedApproverRoles = ["l2", "l3", "org_admin", "admin", "manager", "hod"];
  
  // Check if current user can approve anyone based on settings
  const approvableRoles = useMemo(() => {
    if (!userWithRole?.role) return [];
    return getApprovableRoles(userWithRole.role);
  }, [userWithRole?.role, getApprovableRoles]);
  
  useEffect(() => {
    if (!authLoading && !allowedApproverRoles.includes(userWithRole?.role || "")) {
      navigate("/dashboard");
    }
  }, [authLoading, userWithRole, navigate]);

  const getOrgId = useCallback(async (): Promise<string | null> => {
    const { data } = await supabase
      .from("user_roles")
      .select("organization_id")
      .eq("user_id", userWithRole!.user.id)
      .single();
    return data?.organization_id || null;
  }, [userWithRole]);

  const fetchEntries = useCallback(async () => {
    if (!userWithRole?.role || settingsLoading || !settings) return;
    
    try {
      setLoading(true);
      
      let entriesData: any[] = [];
      
      const currentRole = userWithRole.role;
      const isL2 = currentRole === "l2" || currentRole === "program_manager";
      const isL3 = currentRole === "l3" || currentRole === "manager";
      const isAdmin = currentRole === "org_admin" || currentRole === "admin";
      
      // Admins should see ALL roles in their org, not just what approval settings say
      const rolesToApprove = isAdmin 
        ? ["l1", "l2", "l3"] 
        : approvableRoles;
      
      if (rolesToApprove.length === 0) {
        setEntries([]);
        setLoading(false);
        return;
      }
      
      const orgId = await getOrgId();
      
      // Collect all user IDs that this approver can approve based on settings
      const userIdsToApprove: Set<string> = new Set();
      
      // Check if current user can approve L1 entries
      if (rolesToApprove.includes("l1")) {
        if (isL2) {
          // L2 can only approve L1 in their programs
          const { data: l2Programs } = await supabase
            .from("user_programs")
            .select("program_id")
            .eq("user_id", userWithRole.user.id);
          
          const l2ProgramIds = l2Programs?.map(p => p.program_id) || [];
          
          if (l2ProgramIds.length > 0) {
            const { data: l1UsersInPrograms } = await supabase
              .from("user_programs")
              .select("user_id")
              .in("program_id", l2ProgramIds);
            
            const candidateIds = l1UsersInPrograms?.map(u => u.user_id) || [];
            
            // Filter to L1 role only
            if (candidateIds.length > 0) {
              const { data: l1RoleUsers } = await supabase
                .from("user_roles")
                .select("user_id")
                .in("user_id", candidateIds)
                .in("role", ["l1", "faculty"]);
              
              l1RoleUsers?.forEach(u => userIdsToApprove.add(u.user_id));
            }
          }
        } else if (isL3) {
          // L3 can approve L1 in their verticals
          const { data: l3Verticals } = await supabase
            .from("user_verticals")
            .select("vertical_id")
            .eq("user_id", userWithRole.user.id);
          
          const l3VerticalIds = l3Verticals?.map(v => v.vertical_id) || [];
          
          if (l3VerticalIds.length > 0) {
            const { data: verticalUsers } = await supabase
              .from("user_verticals")
              .select("user_id")
              .in("vertical_id", l3VerticalIds);
            
            const candidateIds = [...new Set(verticalUsers?.map(u => u.user_id) || [])];
            
            if (candidateIds.length > 0) {
              const { data: l1RoleUsers } = await supabase
                .from("user_roles")
                .select("user_id")
                .in("user_id", candidateIds)
                .in("role", ["l1", "faculty"]);
              
              l1RoleUsers?.forEach(u => userIdsToApprove.add(u.user_id));
            }
          }
        } else if (isAdmin && orgId) {
          // Admin can approve all L1 in org
          const { data: l1Users } = await supabase
            .from("user_roles")
            .select("user_id")
            .eq("organization_id", orgId)
            .in("role", ["l1", "faculty"]);
          
          l1Users?.forEach(u => userIdsToApprove.add(u.user_id));
        }
      }
      
      // Check if current user can approve L2 entries
      if (rolesToApprove.includes("l2")) {
        if (isL3) {
          // L3 can approve L2 in their verticals
          const { data: l3Verticals } = await supabase
            .from("user_verticals")
            .select("vertical_id")
            .eq("user_id", userWithRole.user.id);
          
          const l3VerticalIds = l3Verticals?.map(v => v.vertical_id) || [];
          
          if (l3VerticalIds.length > 0) {
            const { data: verticalUsers } = await supabase
              .from("user_verticals")
              .select("user_id")
              .in("vertical_id", l3VerticalIds);
            
            const candidateIds = [...new Set(verticalUsers?.map(u => u.user_id) || [])];
            
            if (candidateIds.length > 0) {
              const { data: l2RoleUsers } = await supabase
                .from("user_roles")
                .select("user_id")
                .in("user_id", candidateIds)
                .in("role", ["l2", "program_manager"]);
              
              l2RoleUsers?.forEach(u => userIdsToApprove.add(u.user_id));
            }
          }
        } else if (isAdmin && orgId) {
          // Admin can approve all L2 in org
          const { data: l2Users } = await supabase
            .from("user_roles")
            .select("user_id")
            .eq("organization_id", orgId)
            .in("role", ["l2", "program_manager"]);
          
          l2Users?.forEach(u => userIdsToApprove.add(u.user_id));
        }
      }
      
      // Check if current user can approve L3 entries
      if (rolesToApprove.includes("l3")) {
        if (isAdmin && orgId) {
          // Admin can approve L3 in their org
          const { data: l3Users } = await supabase
            .from("user_roles")
            .select("user_id")
            .eq("organization_id", orgId)
            .in("role", ["l3", "hod"]);
          
          l3Users?.forEach(u => userIdsToApprove.add(u.user_id));
        }
      }
      
      // Fetch entries for all collected user IDs
      const allUserIds = Array.from(userIdsToApprove);
      
      if (allUserIds.length > 0) {
        // Fetch all statuses to support showing approved/rejected entries
        // Fetch in chunks to avoid the default 1000-row limit
        const CHUNK_SIZE = 500;
        let allEntriesData: any[] = [];
        for (let i = 0; i < allUserIds.length; i += CHUNK_SIZE) {
          const chunk = allUserIds.slice(i, i + CHUNK_SIZE);
          let offset = 0;
          const PAGE_SIZE = 1000;
          while (true) {
            const { data, error } = await supabase
              .from("timesheet_entries")
              .select("id, entry_date, start_time, end_time, activity_type, activity_subtype, notes, user_id, department_code, vertical_id, vertical_code, program_id, batch_id, batch_name, term_id, term_name, subject_id, subject_code, status, approved_by, approved_at, approver_notes")
              .in("user_id", chunk)
              .in("status", ["submitted", "approved", "rejected"])
              .order("entry_date", { ascending: false })
              .range(offset, offset + PAGE_SIZE - 1);
            if (error) throw error;
            allEntriesData = allEntriesData.concat(data || []);
            if (!data || data.length < PAGE_SIZE) break;
            offset += PAGE_SIZE;
          }
        }
        entriesData = allEntriesData;
      }

      // Fetch profiles for all approvable users (not just those with timesheet entries)
      const userIds = [...new Set(entriesData?.map(e => e.user_id) || [])];
      
      // Fetch leave entries for ALL approvable users (not just those with timesheet entries)
      let leaveData: any[] = [];
      if (allUserIds.length > 0) {
        const { data: leaves } = await supabase
          .from('leave_days' as any)
          .select('*')
          .in('user_id', allUserIds)
          .order('leave_date', { ascending: false });
        leaveData = leaves || [];
      }
      
      // Combine user IDs from both sources + approver IDs for profile fetching
      const approverIds = entriesData?.map(e => e.approved_by).filter(Boolean) as string[] || [];
      const profileUserIds = [...new Set([...userIds, ...leaveData.map((l: any) => l.user_id), ...approverIds])];
      
      if (profileUserIds.length > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .from("profiles")
          .select("id, full_name, avatar_url")
          .in("id", profileUserIds);

        if (profilesError) throw profilesError;

        // Create a map of user profiles
        const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);

        // Merge timesheet entries with profiles
        const entriesWithProfiles = entriesData?.map(entry => ({
          ...entry,
          type: 'timesheet' as const,
          profiles: profilesMap.get(entry.user_id) || { full_name: "Unknown", avatar_url: null },
          approver_profile: entry.approved_by ? (profilesMap.get(entry.approved_by) || null) : null,
        })) || [];

        // Merge leave entries with profiles
        const leavesWithProfiles = leaveData.map((leave: any) => ({
          ...leave,
          type: 'leave' as const,
          profiles: profilesMap.get(leave.user_id) || { full_name: "Unknown", avatar_url: null }
        }));

        setEntries(entriesWithProfiles as TimesheetEntry[]);
        setLeaveEntries(leavesWithProfiles as LeaveEntry[]);
      } else {
        setEntries([]);
        setLeaveEntries([]);
      }
    } catch (error) {
      console.error("Error fetching entries:", error);
      toast({
        title: "Error",
        description: "Failed to load pending approvals",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [userWithRole, settingsLoading, approvableRoles, getOrgId, toast]);

  useEffect(() => {
    if (allowedApproverRoles.includes(userWithRole?.role || "") && !settingsLoading) {
      fetchEntries();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userWithRole?.role, userWithRole?.departmentId, settingsLoading]);

  const handleAction = (entry: TimesheetEntry, action: "approve" | "reject") => {
    setSelectedEntry(entry);
    setActionType(action);
    setComment("");
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!selectedEntry || !actionType) return;
    if (actionType === "reject" && !comment.trim()) {
      toast({
        title: "Comment required",
        description: "Please provide a reason for rejection",
        variant: "destructive",
      });
      return;
    }

    try {
      setSubmitting(true);
      const { error } = await supabase
        .from("timesheet_entries")
        .update({
          status: actionType === "approve" ? "approved" : "rejected",
          approved_by: userWithRole!.user.id,
          approved_at: new Date().toISOString(),
          approver_notes: comment.trim() || null,
        })
        .eq("id", selectedEntry.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Entry ${actionType === "approve" ? "approved" : "rejected"} successfully`,
      });

      setDialogOpen(false);
      setSelectedEntry(null);
      setActionType(null);
      setComment("");
      fetchEntries();
    } catch (error) {
      console.error("Error updating entry:", error);
      toast({
        title: "Error",
        description: `Failed to ${actionType} entry`,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Get unique faculty list from entries AND leave entries
  const facultyList = useMemo(() => {
    const uniqueFaculty = new Map<string, { name: string; count: number; avatarUrl: string | null }>();
    entries.forEach(entry => {
      const existing = uniqueFaculty.get(entry.user_id);
      if (existing) {
        existing.count++;
      } else {
        uniqueFaculty.set(entry.user_id, {
          name: entry.profiles.full_name,
          count: 1,
          avatarUrl: entry.profiles.avatar_url
        });
      }
    });
    // Also include users who only have leave entries
    leaveEntries.forEach(leave => {
      const existing = uniqueFaculty.get(leave.user_id);
      if (existing) {
        existing.count++;
      } else {
        uniqueFaculty.set(leave.user_id, {
          name: leave.profiles.full_name,
          count: 1,
          avatarUrl: leave.profiles.avatar_url
        });
      }
    });
    return Array.from(uniqueFaculty.entries()).map(([userId, data]) => ({
      userId,
      ...data
    }));
  }, [entries, leaveEntries]);

  // Get unique activity types from entries
  const activityTypes = useMemo(() => {
    const typeCount = new Map<string, number>();
    entries.forEach(entry => {
      typeCount.set(
        entry.activity_type,
        (typeCount.get(entry.activity_type) || 0) + 1
      );
    });
    return Array.from(typeCount.entries()).map(([type, count]) => ({
      type,
      count
    }));
  }, [entries]);

  // Format leave type for display
  const formatLeaveType = (type: string) => {
    const labels: Record<string, string> = {
      casual_leave: "Casual Leave",
      sick_leave: "Sick Leave",
      vacation: "Vacation",
      personal: "Personal Leave",
      compensatory: "Compensatory Off",
      half_day: "Half Day (Legacy)",
      half_day_first: "Half Day - First Half",
      half_day_second: "Half Day - Second Half",
      other: "Other Leave",
    };
    return labels[type] || type;
  };

  // Check if current user can delete a given leave entry
  const canDeleteLeave = useCallback((leave: LeaveEntry) => {
    if (!userWithRole?.role) return false;
    const todayStr = formatLocalDate(new Date());
    
    // Admin/super_admin can delete any leave (including past)
    if (isRole(userWithRole.role, "admin", "org_admin", "super_admin")) return true;
    
    // L1/L2 can only delete their own future/today leaves (handled in their own Timesheet page, not here)
    return false;
  }, [userWithRole?.role]);

  const handleDeleteLeave = async () => {
    if (!leaveToDelete) return;
    try {
      const { error } = await supabase
        .from('leave_days' as any)
        .delete()
        .eq('id', leaveToDelete.id);

      if (error) {
        toast({ title: "Error", description: "Failed to delete leave entry", variant: "destructive" });
      } else {
        toast({ title: "Success", description: "Leave entry deleted successfully" });
        setLeaveEntries(prev => prev.filter(l => l.id !== leaveToDelete.id));
      }
    } catch {
      toast({ title: "Error", description: "Failed to delete leave entry", variant: "destructive" });
    }
    setDeleteLeaveDialogOpen(false);
    setLeaveToDelete(null);
  };

  // Combine timesheet entries and leave entries for display
  const combinedEntries = useMemo(() => {
    const timesheetItems = entries.map(entry => ({
      ...entry,
      type: 'timesheet' as const,
      sortDate: entry.entry_date,
    }));
    
    const leaveItems = leaveEntries.map(leave => ({
      ...leave,
      type: 'leave' as const,
      sortDate: leave.leave_date,
    }));
    
    return [...timesheetItems, ...leaveItems].sort((a, b) => 
      new Date(b.sortDate).getTime() - new Date(a.sortDate).getTime()
    );
  }, [entries, leaveEntries]);

  // Filter entries based on selections (for day view - respects showPendingOnly toggle)
  const filteredEntries = useMemo(() => {
    return entries.filter(entry => {
      if (filterFaculty && entry.user_id !== filterFaculty) return false;
      if (filterActivity && entry.activity_type !== filterActivity) return false;
      if (filterDate && entry.entry_date !== format(filterDate, "yyyy-MM-dd")) return false;
      // Apply showPendingOnly toggle for day view
      if (showPendingOnly && entry.status !== "submitted") return false;
      return true;
    });
  }, [entries, filterFaculty, filterActivity, filterDate, showPendingOnly]);
  
  // Determine if current user is admin
  const isCurrentUserAdmin = useMemo(() => {
    const r = userWithRole?.role;
    return r === "org_admin" || r === "admin" || r === "super_admin";
  }, [userWithRole?.role]);

  // List view entries - Admin sees ALL statuses, others see only pending
  const listViewEntries = useMemo(() => {
    if (filterLeavesOnly) return []; // When "All Leaves" is active, hide timesheet entries
    return entries.filter(entry => {
      if (filterFaculty && entry.user_id !== filterFaculty) return false;
      if (filterActivity && entry.activity_type !== filterActivity) return false;
      if (filterDate && entry.entry_date !== format(filterDate, "yyyy-MM-dd")) return false;
      // Admin sees all statuses; others see only pending
      if (!isCurrentUserAdmin && entry.status !== "submitted") return false;
      return true;
    });
  }, [entries, filterFaculty, filterActivity, filterDate, isCurrentUserAdmin, filterLeavesOnly]);
  
  // Pending entries for badge count (always only submitted)
  const pendingEntries = useMemo(() => {
    return entries.filter(entry => entry.status === "submitted");
  }, [entries]);

  // Filter leave entries based on faculty selection and date
  const filteredLeaveEntries = useMemo(() => {
    return leaveEntries.filter(entry => {
      if (filterFaculty && entry.user_id !== filterFaculty) return false;
      if (filterDate && entry.leave_date !== format(filterDate, "yyyy-MM-dd")) return false;
      return true;
    });
  }, [leaveEntries, filterFaculty, filterDate]);

  // Combined filtered entries for LIST VIEW display - always pending only
  const listViewCombinedEntries = useMemo(() => {
    const timesheetItems = listViewEntries.map(entry => ({
      ...entry,
      type: 'timesheet' as const,
      sortDate: entry.entry_date,
    }));
    
    const leaveItems = filteredLeaveEntries.map(leave => ({
      ...leave,
      type: 'leave' as const,
      sortDate: leave.leave_date,
    }));
    
    return [...timesheetItems, ...leaveItems].sort((a, b) => {
      const dateDiff = new Date(a.sortDate).getTime() - new Date(b.sortDate).getTime();
      if (dateDiff !== 0) return dateDiff;
      // Within the same date, sort by start_time ascending
      const aTime = a.type === 'timesheet' ? a.start_time || '' : '00:00';
      const bTime = b.type === 'timesheet' ? b.start_time || '' : '00:00';
      return aTime.localeCompare(bTime);
    });
  }, [listViewEntries, filteredLeaveEntries]);

  // Prepare faculty data for day matrix view
  const dayMatrixData = useMemo(() => {
    const dateToUse = filterDate || new Date();
    const dateStr = format(dateToUse, "yyyy-MM-dd");
    
    // Get unique faculty with entries for this date
    const facultyMap = new Map<string, {
      userId: string;
      name: string;
      avatarUrl: string | null;
      entries: MatrixTimesheetEntry[];
      isOnLeave: boolean;
      leaveType?: string;
    }>();
    
    // Filter out old rejected entries if a replacement exists in same time slot
    const entriesForDate = filteredEntries.filter(entry => entry.entry_date === dateStr);
    const filteredMatrixEntries = entriesForDate.filter(entry => {
      if (entry.status === "rejected") {
        // Check if there's a newer entry (submitted or approved) in the same time slot for this user
        const hasReplacement = entriesForDate.some(other => 
          other.id !== entry.id &&
          other.user_id === entry.user_id &&
          other.status !== "rejected" &&
          other.start_time === entry.start_time &&
          other.end_time === entry.end_time
        );
        if (hasReplacement) return false;
      }
      return true;
    });
    
    // Add faculty with entries
    filteredMatrixEntries.forEach(entry => {
      const matrixEntry: MatrixTimesheetEntry = {
        id: entry.id,
        user_id: entry.user_id,
        entry_date: entry.entry_date,
        start_time: entry.start_time,
        end_time: entry.end_time,
        activity_type: entry.activity_type,
        activity_subtype: entry.activity_subtype,
        notes: entry.notes,
        status: entry.status, // Use actual status
        vertical_code: entry.vertical_code || entry.department_code || null,
        batch_name: entry.batch_name || null,
      };
      const existing = facultyMap.get(entry.user_id);
      if (existing) {
        existing.entries.push(matrixEntry);
      } else {
        facultyMap.set(entry.user_id, {
          userId: entry.user_id,
          name: entry.profiles.full_name,
          avatarUrl: entry.profiles.avatar_url,
          entries: [matrixEntry],
          isOnLeave: false,
        });
      }
    });
    
    // Add faculty on leave
    filteredLeaveEntries
      .filter(leave => leave.leave_date === dateStr)
      .forEach(leave => {
        if (!facultyMap.has(leave.user_id)) {
          facultyMap.set(leave.user_id, {
            userId: leave.user_id,
            name: leave.profiles.full_name,
            avatarUrl: leave.profiles.avatar_url,
            entries: [],
            isOnLeave: true,
            leaveType: leave.leave_type,
          });
        } else {
          const existing = facultyMap.get(leave.user_id)!;
          existing.isOnLeave = true;
          existing.leaveType = leave.leave_type;
        }
      });
    
    return Array.from(facultyMap.values());
  }, [filteredEntries, filteredLeaveEntries, filterDate]);

  // Selection handlers
  const toggleEntrySelection = (entryId: string) => {
    const newSelected = new Set(selectedEntries);
    if (newSelected.has(entryId)) {
      newSelected.delete(entryId);
    } else {
      newSelected.add(entryId);
    }
    setSelectedEntries(newSelected);
  };

  const selectAllEntries = () => {
    // For list view, only select pending entries
    const allIds = new Set(listViewEntries.map(e => e.id));
    setSelectedEntries(allIds);
  };

  const clearSelection = () => {
    setSelectedEntries(new Set());
  };

  const isAllSelected = selectedEntries.size === listViewEntries.length && listViewEntries.length > 0;

  // Clear filters
  const clearFilters = () => {
    setFilterFaculty(null);
    setFilterActivity(null);
    setFilterDate(null);
    setFilterLeavesOnly(false);
  };

  // Bulk actions
  const handleBulkAction = (action: "approve" | "reject") => {
    if (selectedEntries.size === 0) {
      toast({
        title: "No entries selected",
        description: "Please select at least one entry",
        variant: "destructive",
      });
      return;
    }
    
    setBulkAction(action);
    setBulkComment("");
    setBulkDialogOpen(true);
  };

  const handleBulkSubmit = async () => {
    if (!bulkAction) return;
    
    if (bulkAction === "reject" && !bulkComment.trim()) {
      toast({
        title: "Reason required",
        description: "Please provide a rejection reason for bulk reject",
        variant: "destructive",
      });
      return;
    }
    
    // Validate comment length
    if (bulkComment.trim()) {
      try {
        approvalNotesSchema.parse({ approver_notes: bulkComment });
      } catch (err) {
        toast({
          title: "Invalid input",
          description: "Comment must be less than 500 characters",
          variant: "destructive",
        });
        return;
      }
    }
    
    try {
      setBulkSubmitting(true);
      
      const entryIds = Array.from(selectedEntries);
      const { error } = await supabase
        .from("timesheet_entries")
        .update({
          status: bulkAction === "approve" ? "approved" : "rejected",
          approved_by: userWithRole!.user.id,
          approved_at: new Date().toISOString(),
          approver_notes: bulkComment.trim() || null,
        })
        .in("id", entryIds);
      
      if (error) throw error;
      
      toast({
        title: "Success",
        description: `${entryIds.length} ${entryIds.length === 1 ? 'entry' : 'entries'} ${bulkAction === "approve" ? "approved" : "rejected"} successfully`,
      });
      
      setBulkDialogOpen(false);
      setBulkAction(null);
      setBulkComment("");
      setSelectedEntries(new Set());
      setFilterFaculty(null);
      setFilterActivity(null);
      setFilterDate(null);
      
      fetchEntries();
    } catch (error) {
      toast({
        title: "Error",
        description: getUserErrorMessage(error, "bulk approval"),
        variant: "destructive",
      });
    } finally {
      setBulkSubmitting(false);
    }
  };

  // Calculate bulk summary
  const bulkSummary = useMemo(() => {
    const selectedEntriesList = entries.filter(e => selectedEntries.has(e.id));
    const facultyCount = new Map<string, number>();
    
    selectedEntriesList.forEach(entry => {
      const name = entry.profiles.full_name;
      facultyCount.set(name, (facultyCount.get(name) || 0) + 1);
    });
    
    return Array.from(facultyCount.entries()).map(([name, count]) => ({
      name,
      count
    }));
  }, [selectedEntries, entries]);

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(":");
    const date = new Date();
    date.setHours(parseInt(hours), parseInt(minutes));
    return format(date, "h:mm a");
  };

  const handleMatrixEntryClick = (entry: MatrixTimesheetEntry) => {
    // Find the original entry to get the profile info
    const originalEntry = entries.find(e => e.id === entry.id);
    if (originalEntry) {
      // Open dialog with both options
      setSelectedEntry(originalEntry);
      setActionType(null); // Will let user choose in dialog
      setComment("");
      setDialogOpen(true);
    }
  };

  const handleMatrixApprove = (entry: MatrixTimesheetEntry) => {
    const originalEntry = entries.find(e => e.id === entry.id);
    if (originalEntry) {
      handleAction(originalEntry, "approve");
    }
  };

  const handleMatrixReject = (entry: MatrixTimesheetEntry) => {
    const originalEntry = entries.find(e => e.id === entry.id);
    if (originalEntry) {
      handleAction(originalEntry, "reject");
    }
  };

  // Get entries for day view selection
  const dayViewEntryIds = useMemo(() => {
    const dateToUse = filterDate || new Date();
    const dateStr = format(dateToUse, "yyyy-MM-dd");
    return filteredEntries
      .filter(entry => entry.entry_date === dateStr)
      .map(entry => entry.id);
  }, [filteredEntries, filterDate]);

  const selectAllDayEntries = () => {
    const allIds = new Set(dayViewEntryIds);
    setSelectedEntries(allIds);
  };

  const isAllDaySelected = dayViewEntryIds.length > 0 && 
    dayViewEntryIds.every(id => selectedEntries.has(id));

  if (authLoading || loading) {
    return (
      <Layout>
        <PageSkeleton type="table" />
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <PageHeader
          title="Pending Approvals"
          description="Review and approve timesheet entries from your team"
          icon={ClipboardCheck}
          actions={
            pendingEntries.length > 0 && (
              <Badge variant="secondary" className="text-base px-4 py-1.5">
                {pendingEntries.length} pending
              </Badge>
            )
          }
        />

        {pendingEntries.length === 0 && !isCurrentUserAdmin ? (
          <Card>
            <CardContent className="py-0">
              <EmptyState
                icon={CheckCircle}
                title="All caught up!"
                description="No pending approvals at the moment. All timesheets have been reviewed."
              />
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Filters and Selection Toolbar */}
            <Card>
              <CardContent className="pt-6 space-y-4">
                {/* View Mode Toggle and Filters Row */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Filter className="h-4 w-4" />
                    <span className="font-medium">Quick Filters:</span>
                  </div>
                  <div className="flex flex-wrap gap-2 flex-1">
                    <Select value={filterFaculty || "all"} onValueChange={(value) => setFilterFaculty(value === "all" ? null : value)}>
                      <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="By Faculty" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Faculty</SelectItem>
                        {facultyList.map(({ userId, name, count }) => (
                          <SelectItem key={userId} value={userId}>
                            {name} ({count})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    <Select value={filterActivity || "all"} onValueChange={(value) => setFilterActivity(value === "all" ? null : value)}>
                      <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="By Activity" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Activities</SelectItem>
                        {activityTypes.map(({ type, count }) => (
                          <SelectItem key={type} value={type}>
                            {type.replace(/_/g, " ").charAt(0).toUpperCase() + type.slice(1).replace(/_/g, " ")} ({count})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    {/* Date Filter */}
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-[200px] justify-start text-left font-normal",
                            !filterDate && "text-muted-foreground"
                          )}
                        >
                          <Calendar className="mr-2 h-4 w-4" />
                          {filterDate ? format(filterDate, "MMM d, yyyy") : "By Date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarComponent
                          mode="single"
                          selected={filterDate || undefined}
                          onSelect={(date) => setFilterDate(date || null)}
                          initialFocus
                          className="p-3 pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                    
                    {/* All Leaves quick filter */}
                    <Button
                      variant={filterLeavesOnly ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        setFilterLeavesOnly(!filterLeavesOnly);
                        if (!filterLeavesOnly) setFilterActivity(null);
                      }}
                      className="h-10"
                    >
                      All Leaves
                    </Button>
                    
                    {(filterFaculty || filterActivity || filterDate || filterLeavesOnly) && (
                      <Button variant="ghost" size="sm" onClick={clearFilters}>
                        <X className="h-4 w-4 mr-1" />
                        Clear Filters
                      </Button>
                    )}
                  </div>
                  
                  {/* View Mode Toggle */}
                  <div className="flex items-center rounded-lg border bg-muted/50 p-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setViewMode("list")}
                      className={cn(
                        "h-8 px-3 rounded-md",
                        viewMode === "list" && "bg-background shadow-sm"
                      )}
                    >
                      <List className="h-4 w-4 mr-2" />
                      List
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setViewMode("day");
                        if (!filterDate) {
                          setFilterDate(new Date());
                        }
                      }}
                      className={cn(
                        "h-8 px-3 rounded-md",
                        viewMode === "day" && "bg-background shadow-sm"
                      )}
                    >
                      <CalendarDays className="h-4 w-4 mr-2" />
                      Day
                    </Button>
                  </div>
                  
                  {/* Day View Options: Zoom and Show Pending Only */}
                  {viewMode === "day" && (
                    <div className="flex items-center gap-3">
                      {/* Zoom View Toggle */}
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">View:</span>
                        <div className="flex items-center rounded-lg border bg-muted/50 p-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSlotInterval("1hour")}
                            className={cn(
                              "h-7 px-2 text-xs",
                              slotInterval === "1hour" && "bg-background shadow-sm"
                            )}
                          >
                            1 Hour
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSlotInterval("15min")}
                            className={cn(
                              "h-7 px-2 text-xs",
                              slotInterval === "15min" && "bg-background shadow-sm"
                            )}
                          >
                            <ZoomIn className="h-3 w-3 mr-1" />
                            15 Min
                          </Button>
                        </div>
                      </div>
                      
                      {/* Show Pending Only Toggle */}
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="showPendingOnly"
                          checked={showPendingOnly}
                          onCheckedChange={(checked) => setShowPendingOnly(checked === true)}
                        />
                        <label htmlFor="showPendingOnly" className="text-sm cursor-pointer">
                          Show pending only
                        </label>
                      </div>
                    </div>
                  )}
                </div>

                {/* Filter Badges */}
                {(filterFaculty || filterActivity || filterDate || filterLeavesOnly) && (
                  <div className="flex flex-wrap gap-2">
                    {filterFaculty && (
                      <Badge variant="secondary" className="gap-1">
                        Faculty: {facultyList.find(f => f.userId === filterFaculty)?.name}
                        <X className="h-3 w-3 cursor-pointer" onClick={() => setFilterFaculty(null)} />
                      </Badge>
                    )}
                    {filterActivity && (
                      <Badge variant="secondary" className="gap-1">
                        Activity: {filterActivity.replace(/_/g, " ")}
                        <X className="h-3 w-3 cursor-pointer" onClick={() => setFilterActivity(null)} />
                      </Badge>
                    )}
                    {filterDate && (
                      <Badge variant="secondary" className="gap-1">
                        Date: {format(filterDate, "MMM d, yyyy")}
                        <X className="h-3 w-3 cursor-pointer" onClick={() => setFilterDate(null)} />
                      </Badge>
                    )}
                    {filterLeavesOnly && (
                      <Badge variant="secondary" className="gap-1">
                        All Leaves
                        <X className="h-3 w-3 cursor-pointer" onClick={() => setFilterLeavesOnly(false)} />
                      </Badge>
                    )}
                  </div>
                )}

                {/* Selection Actions - Works for both views */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2 border-t">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={viewMode === "list" ? isAllSelected : isAllDaySelected}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          viewMode === "list" ? selectAllEntries() : selectAllDayEntries();
                        } else {
                          clearSelection();
                        }
                      }}
                    />
                    <span className="text-sm font-medium">
                      {selectedEntries.size > 0 ? (
                        <>Selected: {selectedEntries.size} {selectedEntries.size === 1 ? 'entry' : 'entries'}</>
                      ) : (
                        <>Select All ({viewMode === "list" ? listViewEntries.length : dayViewEntryIds.length})</>
                      )}
                    </span>
                    {selectedEntries.size > 0 && (
                      <Button variant="ghost" size="sm" onClick={clearSelection}>
                        Clear Selection
                      </Button>
                    )}
                  </div>
                  
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleBulkAction("approve")}
                      disabled={selectedEntries.size === 0}
                      variant="default"
                      size="sm"
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Approve Selected
                    </Button>
                    <Button
                      onClick={() => handleBulkAction("reject")}
                      disabled={selectedEntries.size === 0}
                      variant="destructive"
                      size="sm"
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Reject Selected
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Content based on view mode */}
            {viewMode === "day" ? (
              <DayMatrixView
                date={filterDate || new Date()}
                facultyData={dayMatrixData}
                onEntryClick={handleMatrixEntryClick}
                onApprove={handleMatrixApprove}
                onReject={handleMatrixReject}
                showAllStatuses={!showPendingOnly}
                title={showPendingOnly ? "Pending Approvals - Day View" : "All Entries - Day View"}
                selectedEntries={selectedEntries}
                onSelectionChange={(entryId, selected) => {
                  const newSelected = new Set(selectedEntries);
                  if (selected) {
                    newSelected.add(entryId);
                  } else {
                    newSelected.delete(entryId);
                  }
                  setSelectedEntries(newSelected);
                }}
                showSelection={true}
                onSelectAllForFaculty={(userId, entryIds, selected) => {
                  const newSelected = new Set(selectedEntries);
                  // Only select submitted entries (actionable)
                  const submittedIds = entryIds.filter(id => {
                    const entry = entries.find(e => e.id === id);
                    return entry?.status === "submitted";
                  });
                  if (selected) {
                    submittedIds.forEach(id => newSelected.add(id));
                  } else {
                    submittedIds.forEach(id => newSelected.delete(id));
                  }
                  setSelectedEntries(newSelected);
                }}
                slotInterval={slotInterval}
              />
            ) : (
              /* List View */
              listViewCombinedEntries.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <Filter className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No entries found</h3>
                    <p className="text-muted-foreground text-center mb-4">
                      No entries match the selected filters.
                    </p>
                    <Button variant="outline" onClick={clearFilters}>
                      Clear Filters
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4">
                  {listViewCombinedEntries.map((item) => (
                    item.type === 'timesheet' ? (
                      <Card 
                        key={item.id}
                        className={cn(
                          "relative transition-all duration-200",
                          selectedEntries.has(item.id) && "border-primary bg-primary/5 shadow-md"
                        )}
                      >
                        {item.status === "submitted" && (
                          <div className="absolute top-4 left-4 z-10">
                            <Checkbox
                              checked={selectedEntries.has(item.id)}
                              onCheckedChange={() => toggleEntrySelection(item.id)}
                            />
                          </div>
                        )}
                        <CardHeader className={cn(item.status === "submitted" ? "pl-12" : "")}>
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <Avatar>
                                <AvatarImage src={item.profiles.avatar_url || undefined} />
                                <AvatarFallback>
                                  {item.profiles.full_name.split(" ").map(n => n[0]).join("")}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <CardTitle className="text-base">{item.profiles.full_name}</CardTitle>
                                <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                                  <Calendar className="h-3 w-3" />
                                  {format(new Date(item.entry_date), "EEEE, MMM d, yyyy")}
                                </div>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              {item.status === "submitted" ? (
                                <Badge variant="outline" className="bg-warning/10 text-warning-foreground border-warning/20">
                                  Pending Review
                                </Badge>
                              ) : item.status === "approved" ? (
                                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800">
                                  Approved
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
                                  Rejected
                                </Badge>
                              )}
                              {(item.status === "approved" || item.status === "rejected") && item.approver_profile && (
                                <span className="text-xs text-muted-foreground">
                                  by {item.approver_profile.full_name}
                                  {item.approved_at && (
                                    <> on {format(new Date(item.approved_at), "MMM d, yyyy")}</>
                                  )}
                                </span>
                              )}
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className={cn("space-y-4", item.status === "submitted" && "pl-12")}>
                          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                            <div>
                              <div className="text-sm text-muted-foreground mb-1">Activity</div>
                              <div className="font-medium capitalize">
                                {item.activity_type.replace(/_/g, " ")}
                                {item.activity_subtype && (
                                  <span className="text-muted-foreground text-sm"> • {item.activity_subtype}</span>
                                )}
                              </div>
                            </div>
                            <div>
                              <div className="text-sm text-muted-foreground mb-1">Time</div>
                              <div className="font-medium flex items-center gap-1">
                                <Clock className="h-4 w-4" />
                                {formatTime(item.start_time)} - {formatTime(item.end_time)}
                              </div>
                            </div>
                            <div>
                              <div className="text-sm text-muted-foreground mb-1">Duration</div>
                              <div className="font-medium">
                                {(() => { const mins = calculateDurationMinutes(item.start_time, item.end_time); return `${Math.floor(mins / 60)}h ${mins % 60}m`; })()}
                              </div>
                            </div>
                            <div>
                              <div className="text-sm text-muted-foreground mb-1">Vertical</div>
                              <div className="font-medium">
                                {(item as any).vertical_code || (item as any).department_code || "-"}
                              </div>
                            </div>
                            <div>
                              <div className="text-sm text-muted-foreground mb-1">Program</div>
                              <div className="font-medium">
                                {(item as any).program_id ? (
                                  <Badge variant="outline" className="text-xs">{(item as any).batch_name ? "..." : "View"}</Badge>
                                ) : "-"}
                              </div>
                            </div>
                            <div>
                              <div className="text-sm text-muted-foreground mb-1">Batch / Term / Subject</div>
                              <div className="font-medium text-sm">
                                {(item as any).batch_name || "-"} / {(item as any).term_name || "-"} / {(item as any).subject_code || "-"}
                              </div>
                            </div>
                          </div>

                          {item.notes && (
                            <div>
                              <div className="text-sm text-muted-foreground mb-1">Notes</div>
                              <p className="text-sm bg-muted/50 rounded-md p-3">{item.notes}</p>
                            </div>
                          )}

                          {item.approver_notes && (item.status === "approved" || item.status === "rejected") && (
                            <div>
                              <div className="text-sm text-muted-foreground mb-1">Approver Notes</div>
                              <p className="text-sm bg-muted/50 rounded-md p-3">{item.approver_notes}</p>
                            </div>
                          )}

                          {item.status === "submitted" && (
                            <div className="flex gap-2 pt-2">
                              <Button
                                onClick={() => handleAction(item, "approve")}
                                className="flex-1"
                                variant="default"
                              >
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Approve
                              </Button>
                              <Button
                                onClick={() => handleAction(item, "reject")}
                                className="flex-1"
                                variant="destructive"
                              >
                                <XCircle className="h-4 w-4 mr-2" />
                                Reject
                              </Button>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ) : (
                      <Card key={item.id} className="relative transition-all duration-200">
                        <CardHeader>
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <Avatar>
                                <AvatarImage src={item.profiles.avatar_url || undefined} />
                                <AvatarFallback>
                                  {item.profiles.full_name.split(" ").map(n => n[0]).join("")}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <CardTitle className="text-base">{item.profiles.full_name}</CardTitle>
                                <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                                  <Calendar className="h-3 w-3" />
                                  {format(new Date(item.leave_date), "EEEE, MMM d, yyyy")}
                                </div>
                              </div>
                            </div>
                            <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                              Leave
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div>
                            <div className="text-sm text-muted-foreground mb-1">Leave Type</div>
                            <div className="font-medium">{formatLeaveType(item.leave_type)}</div>
                          </div>

                          {item.comments && (
                            <div>
                              <div className="text-sm text-muted-foreground mb-1">Comments</div>
                              <p className="text-sm bg-muted/50 rounded-md p-3">{item.comments}</p>
                            </div>
                          )}

                          <div className="flex items-center justify-between pt-2">
                            <div className="text-sm text-muted-foreground italic">
                              Leave entries do not require approval
                            </div>
                            {canDeleteLeave(item) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => {
                                  setLeaveToDelete(item);
                                  setDeleteLeaveDialogOpen(true);
                                }}
                              >
                                <Trash2 className="h-4 w-4 mr-1" />
                                Delete
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    )
                  ))}
                </div>
              )
            )}
          </>
        )}
      </div>

      {/* Single Entry Action Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType ? (actionType === "approve" ? "Approve" : "Reject") : "Review"} Entry
            </DialogTitle>
            <DialogDescription>
              {selectedEntry && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    <span className="font-medium">{selectedEntry.profiles.full_name}</span>
                  </div>
                  <div className="text-sm">
                    {format(new Date(selectedEntry.entry_date), "MMMM d, yyyy")} • 
                    {formatTime(selectedEntry.start_time)} - {formatTime(selectedEntry.end_time)}
                  </div>
                  <div className="text-sm capitalize">
                    <span className="text-muted-foreground">Activity:</span> {selectedEntry.activity_type.replace(/_/g, " ")}
                    {selectedEntry.activity_subtype && ` • ${selectedEntry.activity_subtype}`}
                  </div>
                  
                  {/* Hierarchy Details */}
                  <div className="grid grid-cols-2 gap-2 text-sm border-t pt-2 mt-2">
                    <div>
                      <span className="text-muted-foreground">Vertical:</span>{" "}
                      {(selectedEntry as any).vertical_code || (selectedEntry as any).department_code || "-"}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Program:</span>{" "}
                      {(selectedEntry as any).program_id ? "Assigned" : "-"}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Batch:</span>{" "}
                      {(selectedEntry as any).batch_name || "-"}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Term:</span>{" "}
                      {(selectedEntry as any).term_name || "-"}
                    </div>
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Subject:</span>{" "}
                      {(selectedEntry as any).subject_code || "-"}
                    </div>
                  </div>
                  
                  {selectedEntry.notes && (
                    <div className="text-sm border-t pt-2">
                      <span className="text-muted-foreground">Notes:</span> {selectedEntry.notes}
                    </div>
                  )}
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-2 block">
                {actionType === "reject" ? "Rejection Reason *" : "Comment (Optional)"}
              </label>
              <Textarea
                placeholder={
                  actionType === "reject"
                    ? "Please explain why this entry is being rejected..."
                    : "Add any additional comments..."
                }
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            {/* Show both buttons when no action is pre-selected (clicked from day view entry) */}
            {!actionType ? (
              <>
                <Button
                  onClick={() => {
                    setActionType("reject");
                    if (!comment.trim()) {
                      // Don't submit yet, let user add reason
                      return;
                    }
                    handleSubmit();
                  }}
                  disabled={submitting}
                  variant="destructive"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Reject
                </Button>
                <Button
                  onClick={() => {
                    setActionType("approve");
                    handleSubmit();
                  }}
                  disabled={submitting}
                  variant="default"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Approve
                </Button>
              </>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={submitting || (actionType === "reject" && !comment.trim())}
                variant={actionType === "approve" ? "default" : "destructive"}
              >
                {submitting ? "Processing..." : actionType === "approve" ? "Approve" : "Reject"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Action Dialog */}
      <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Bulk {bulkAction === "approve" ? "Approve" : "Reject"} Entries
            </DialogTitle>
            <DialogDescription>
              {bulkAction === "reject" && (
                <div className="flex items-center gap-2 text-warning mt-2">
                  <XCircle className="h-4 w-4" />
                  <span>This action cannot be undone</span>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <p className="text-sm text-muted-foreground mb-3">
                You are about to {bulkAction} {selectedEntries.size} {selectedEntries.size === 1 ? 'entry' : 'entries'}:
              </p>
              <div className="bg-muted/50 rounded-md p-3 space-y-2 max-h-[200px] overflow-y-auto">
                {bulkSummary.map(({ name, count }) => (
                  <div key={name} className="flex items-center justify-between text-sm">
                    <span className="font-medium">{name}</span>
                    <Badge variant="secondary">{count} {count === 1 ? 'entry' : 'entries'}</Badge>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">
                {bulkAction === "reject" ? "Rejection Reason (Required) *" : "Comment (Optional)"}
              </label>
              <Textarea
                placeholder={
                  bulkAction === "reject"
                    ? "Please explain why these entries are being rejected..."
                    : "Add any additional comments..."
                }
                value={bulkComment}
                onChange={(e) => setBulkComment(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDialogOpen(false)} disabled={bulkSubmitting}>
              Cancel
            </Button>
            <Button
              onClick={handleBulkSubmit}
              disabled={bulkSubmitting || (bulkAction === "reject" && !bulkComment.trim())}
              variant={bulkAction === "approve" ? "default" : "destructive"}
            >
              {bulkSubmitting ? "Processing..." : bulkAction === "approve" ? "Approve All" : "Reject All"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Leave Confirmation Dialog */}
      <AlertDialog open={deleteLeaveDialogOpen} onOpenChange={setDeleteLeaveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Leave Entry?</AlertDialogTitle>
            <AlertDialogDescription>
              {leaveToDelete && (
                <>
                  Are you sure you want to delete the <strong>{formatLeaveType(leaveToDelete.leave_type)}</strong> leave for <strong>{leaveToDelete.profiles.full_name}</strong> on <strong>{format(new Date(leaveToDelete.leave_date), "MMM d, yyyy")}</strong>? This action cannot be undone.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setLeaveToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteLeave} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
