import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/StatusBadge";
import { Plus, Trash2, Calendar, FileText, HelpCircle, Pencil, Upload } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { timesheetEntrySchema } from "@/lib/validation";
import { getUserErrorMessage } from "@/lib/errorHandler";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { useConfetti } from "@/hooks/useConfetti";
import { OnboardingTour, useOnboardingTour } from "@/components/OnboardingTour";
import { useActivityCategories } from "@/hooks/useActivityCategories";
import { formatDisplayDate } from "@/lib/dateUtils";
import { DateRangeFilter, DateFilterType, DateRange } from "@/components/DateRangeFilter";
import { startOfDay, endOfDay, isWithinInterval } from "date-fns";
import { getEntryDuration } from "@/lib/timesheetUtils";

export default function Timesheet() {
  const { userWithRole } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { fireConfetti } = useConfetti();
  const { resetTour, hasSeen } = useOnboardingTour();
  const { categories, loading: categoriesLoading } = useActivityCategories(userWithRole?.departmentId);
  const [entries, setEntries] = useState<any[]>([]);
  const [leaveEntries, setLeaveEntries] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [runTour, setRunTour] = useState(false);
  const [editingEntry, setEditingEntry] = useState<any>(null);
  
  // Form state
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split("T")[0]);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [activityType, setActivityType] = useState("");
  const [activitySubtype, setActivitySubtype] = useState("");
  const [notes, setNotes] = useState("");
  const [departmentCode, setDepartmentCode] = useState("");
  const [userDepartments, setUserDepartments] = useState<{ id: string; name: string; code: string }[]>([]);

  // Leave management state
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [leaveDate, setLeaveDate] = useState(new Date().toISOString().split("T")[0]);
  const [leaveType, setLeaveType] = useState<"casual" | "sick" | "earned" | "half_day" | "comp_off" | "other">("casual");
  const [leaveComments, setLeaveComments] = useState("");
  const [userLeaveDays, setUserLeaveDays] = useState<Set<string>>(new Set());
  
  // Date filter state
  const [dateFilterType, setDateFilterType] = useState<DateFilterType>("month");
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return { from: start, to: end };
  });

  useEffect(() => {
    const allowedRoles = ["member", "manager", "program_manager"];
    if (userWithRole && !allowedRoles.includes(userWithRole.role || "")) {
      navigate("/dashboard");
    } else if (userWithRole) {
      loadEntries();
      loadLeaveDays();
      loadUserDepartments();
    }
  }, [userWithRole, navigate]);

  const loadUserDepartments = async () => {
    if (!userWithRole) return;
    
    // Get user's departments from user_departments table
    const { data: userDepts } = await supabase
      .from("user_departments")
      .select("department_id")
      .eq("user_id", userWithRole.user.id);
    
    const deptIds = userDepts?.map(ud => ud.department_id) || [];
    
    // Also include department from user_roles as fallback
    if (userWithRole.departmentId && !deptIds.includes(userWithRole.departmentId)) {
      deptIds.push(userWithRole.departmentId);
    }
    
    if (deptIds.length > 0) {
      const { data: depts } = await supabase
        .from("departments")
        .select("id, name, code")
        .in("id", deptIds);
      
      setUserDepartments(depts || []);
    }
  };

  // Set initial activity type when categories load
  useEffect(() => {
    if (categories.length > 0 && !activityType) {
      setActivityType(categories[0].code);
    }
  }, [categories]);

  const loadEntries = async () => {
    if (!userWithRole) return;

    const { data, error } = await supabase
      .from("timesheet_entries")
      .select("*")
      .eq("user_id", userWithRole.user.id)
      .order("entry_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      toast({
        title: "Error",
        description: getUserErrorMessage(error, "load timesheet entries"),
        variant: "destructive",
      });
    } else {
      setEntries(data || []);
    }
  };

  const loadLeaveDays = async () => {
    if (!userWithRole) return;

    // Type assertion to bypass TypeScript errors until types regenerate
    const { data } = await supabase
      .from('leave_days' as any)
      .select('*')
      .eq('user_id', userWithRole.user.id)
      .order('leave_date', { ascending: false });

    if (data) {
      setUserLeaveDays(new Set(data.map((d: any) => d.leave_date)));
      setLeaveEntries(data);
    }
  };

  const calculateDuration = (start: string, end: string) => {
    const [startHour, startMin] = start.split(":").map(Number);
    const [endHour, endMin] = end.split(":").map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    return endMinutes - startMinutes;
  };

  // Check if new entry overlaps with existing entries (excluding rejected ones)
  const checkTimeOverlap = (date: string, start: string, end: string, excludeId?: string): boolean => {
    const newStartMinutes = timeToMinutes(start);
    const newEndMinutes = timeToMinutes(end);

    // Filter entries for the same date, excluding rejected entries and the entry being edited
    const relevantEntries = entries.filter(
      (entry) =>
        entry.entry_date === date &&
        entry.status !== "rejected" &&
        entry.id !== excludeId
    );

    for (const entry of relevantEntries) {
      const existingStartMinutes = timeToMinutes(entry.start_time);
      const existingEndMinutes = timeToMinutes(entry.end_time);

      // Check for overlap: new entry starts before existing ends AND new entry ends after existing starts
      if (newStartMinutes < existingEndMinutes && newEndMinutes > existingStartMinutes) {
        return true; // Overlap detected
      }
    }

    return false;
  };

  const timeToMinutes = (time: string): number => {
    const [hours, minutes] = time.split(":").map(Number);
    return hours * 60 + minutes;
  };

  const handleSubmit = async (status: "draft" | "submitted") => {
    if (!userWithRole?.user?.id) {
      toast({
        title: "Error",
        description: "You must be logged in to create timesheet entries",
        variant: "destructive",
      });
      return;
    }

    // Check if the date is marked as leave
    if (userLeaveDays.has(entryDate)) {
      toast({
        title: "Error",
        description: "Cannot add timesheet entries on leave days",
        variant: "destructive",
      });
      return;
    }

    // Normalize time format for overlap check
    const normalizeTimeFormat = (time: string): string => {
      const parts = time.split(":");
      if (parts.length === 2) {
        const hour = parts[0].padStart(2, "0");
        const min = parts[1].padStart(2, "0");
        return `${hour}:${min}`;
      }
      return time;
    };

    const normalizedStart = normalizeTimeFormat(startTime);
    const normalizedEnd = normalizeTimeFormat(endTime);

    // Check for overlapping time entries
    if (checkTimeOverlap(entryDate, normalizedStart, normalizedEnd, editingEntry?.id)) {
      toast({
        title: "Time Overlap Detected",
        description: "This time slot overlaps with an existing entry. Please choose a different time.",
        variant: "destructive",
      });
      return; // Dialog remains open
    }

    try {
      // Normalize time format to HH:MM (pad single digit hours)
      const normalizeTime = (time: string): string => {
        const parts = time.split(":");
        if (parts.length === 2) {
          const hour = parts[0].padStart(2, "0");
          const min = parts[1].padStart(2, "0");
          return `${hour}:${min}`;
        }
        return time;
      };

      const normalizedStartTime = normalizeTime(startTime);
      const normalizedEndTime = normalizeTime(endTime);

      // Validate form data
      const validatedData = timesheetEntrySchema.parse({
        entry_date: entryDate,
        start_time: normalizedStartTime,
        end_time: normalizedEndTime,
        activity_type: activityType,
        activity_subtype: activitySubtype,
        notes: notes,
      });

      const duration = calculateDuration(normalizedStartTime, normalizedEndTime);

      // Use department code directly (already validated by dropdown selection)
      const trimmedDeptCode = departmentCode.trim().toUpperCase();

      setLoading(true);

      let error;

      if (editingEntry) {
        // Update existing entry - drafts and pending entries can be edited
        const result = await supabase
          .from("timesheet_entries")
          .update({
            entry_date: validatedData.entry_date,
            start_time: validatedData.start_time,
            end_time: validatedData.end_time,
            activity_type: validatedData.activity_type,
            activity_subtype: validatedData.activity_subtype || null,
            notes: validatedData.notes || null,
            department_code: trimmedDeptCode || null,
            status,
          })
          .eq("id", editingEntry.id)
          .eq("user_id", userWithRole.user.id)
          .in("status", ["draft", "submitted"]);
        error = result.error;
      } else {
        // Insert new entry
        const result = await supabase.from("timesheet_entries").insert({
          user_id: userWithRole.user.id,
          entry_date: validatedData.entry_date,
          start_time: validatedData.start_time,
          end_time: validatedData.end_time,
          activity_type: validatedData.activity_type,
          activity_subtype: validatedData.activity_subtype || null,
          notes: validatedData.notes || null,
          department_code: trimmedDeptCode || null,
          status,
        });
        error = result.error;
      }

      setLoading(false);

      if (error) throw error;

      // Fire confetti on successful submission!
      fireConfetti();

      toast({
        title: "🎉 Submitted!",
        description: "Your timesheet has been submitted for approval",
      });
      setDialogOpen(false);
      setEditingEntry(null);
      resetForm();
      loadEntries();
    } catch (error: any) {
      setLoading(false);
      
      if (error.errors) {
        toast({
          title: "Validation Error",
          description: error.errors[0]?.message || "Invalid input",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: getUserErrorMessage(error, editingEntry ? "update timesheet entry" : "create timesheet entry"),
          variant: "destructive",
        });
      }
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from("timesheet_entries")
        .delete()
        .eq("id", id);

      if (error) {
        toast({
          title: "Error",
          description: getUserErrorMessage(error, "delete timesheet entry"),
          variant: "destructive",
        });
      } else {
        // Update local state immediately to remove the entry
        setEntries(prev => prev.filter(e => e.id !== id));
        toast({ title: "Success", description: "Entry deleted" });
      }
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to delete entry",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setEntryDate(new Date().toISOString().split("T")[0]);
    setStartTime("09:00");
    setEndTime("10:00");
    setActivityType(categories[0]?.code || "");
    setActivitySubtype("");
    setNotes("");
    setDepartmentCode("");
    setEditingEntry(null);
  };

  const handleEdit = (entry: any) => {
    setEditingEntry(entry);
    setEntryDate(entry.entry_date);
    setStartTime(entry.start_time);
    setEndTime(entry.end_time);
    setActivityType(entry.activity_type);
    setActivitySubtype(entry.activity_subtype || "");
    setNotes(entry.notes || "");
    setDepartmentCode(entry.department_code || "");
    setDialogOpen(true);
  };

  const handleDialogClose = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setEditingEntry(null);
      resetForm();
    }
  };

  const formatMinutes = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const formatLeaveType = (type: string) => {
    const labels: Record<string, string> = {
      casual: "Casual Leave",
      sick: "Sick Leave",
      earned: "Earned Leave",
      half_day: "Half Day",
      comp_off: "Compensatory Off",
      other: "Other Leave",
    };
    return labels[type] || type;
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
    
    // Filter by date range
    const filtered = [...timesheetItems, ...leaveItems].filter(item => {
      const itemDate = new Date(item.sortDate);
      return isWithinInterval(itemDate, { start: startOfDay(dateRange.from), end: endOfDay(dateRange.to) });
    });
    
    return filtered.sort((a, b) => 
      new Date(b.sortDate).getTime() - new Date(a.sortDate).getTime()
    );
  }, [entries, leaveEntries, dateRange]);

  const handleDateFilterChange = (type: DateFilterType, range: DateRange) => {
    setDateFilterType(type);
    setDateRange(range);
  };

  const handleMarkLeave = async () => {
    if (!userWithRole?.user?.id) {
      toast({
        title: "Error",
        description: "You must be logged in to mark leave",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    
    // Type assertion to bypass TypeScript errors until types regenerate
    const { error } = await supabase
      .from('leave_days' as any)
      .insert({
        user_id: userWithRole.user.id,
        leave_date: leaveDate,
        leave_type: leaveType,
        notes: leaveComments || null,
      });

    setLoading(false);

    if (error) {
      toast({
        title: "Error",
        description: getUserErrorMessage(error, "mark leave"),
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Leave day marked successfully",
      });
      setLeaveDialogOpen(false);
      setLeaveDate(new Date().toISOString().split("T")[0]);
      setLeaveType("casual");
      setLeaveComments("");
      loadLeaveDays();
    }
  };

  return (
    <Layout>
      <OnboardingTour run={runTour} onComplete={() => setRunTour(false)} />
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">My Timesheet</h1>
              <p className="text-sm text-muted-foreground">Track and submit your working hours</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          {hasSeen() && (
            <Button
              variant="ghost"
              size="icon"
              className="hidden sm:flex"
              onClick={() => {
                resetTour();
                setRunTour(true);
              }}
              title="Take tour"
            >
              <HelpCircle className="h-4 w-4" />
            </Button>
          )}
          <Dialog open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="w-full sm:w-auto" data-tour="mark-leave">
                <Calendar className="mr-2 h-4 w-4" />
                Mark Leave
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Mark Leave Day</DialogTitle>
                <DialogDescription>
                  Mark a day when you were on leave
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="leave-date">Date</Label>
                  <Input
                    id="leave-date"
                    type="date"
                    value={leaveDate}
                    onChange={(e) => setLeaveDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="leave-type">Leave Type</Label>
                  <Select value={leaveType} onValueChange={(value: any) => setLeaveType(value)}>
                    <SelectTrigger id="leave-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="casual">Casual Leave</SelectItem>
                      <SelectItem value="sick">Sick Leave</SelectItem>
                      <SelectItem value="earned">Earned Leave</SelectItem>
                      <SelectItem value="half_day">Half Day</SelectItem>
                      <SelectItem value="comp_off">Compensatory Off</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="leave-comments">Comments (Optional)</Label>
                  <Textarea
                    id="leave-comments"
                    value={leaveComments}
                    onChange={(e) => setLeaveComments(e.target.value)}
                    placeholder="Any additional notes..."
                  />
                </div>
                <Button onClick={handleMarkLeave} disabled={loading} className="w-full">
                  {loading ? "Marking..." : "Mark Leave"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={dialogOpen} onOpenChange={handleDialogClose}>
              <DialogTrigger asChild>
                <Button className="w-full sm:w-auto" data-tour="new-entry">
                  <Plus className="mr-2 h-4 w-4" />
                  New Entry
                </Button>
              </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{editingEntry ? "Edit Timesheet Entry" : "Add Timesheet Entry"}</DialogTitle>
                <DialogDescription>
                  Fill in the details of your work activity
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="date">Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={entryDate}
                    onChange={(e) => setEntryDate(e.target.value)}
                    max={new Date().toISOString().split("T")[0]}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="startTime">Start Time</Label>
                    <Input
                      id="startTime"
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endTime">End Time</Label>
                    <Input
                      id="endTime"
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="activityType">Activity Type</Label>
                  <Select value={activityType} onValueChange={setActivityType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select activity type" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.code} value={cat.code}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="subtype">Subject / Details (Optional)</Label>
                  <Input
                    id="subtype"
                    placeholder="e.g., Mathematics, Physics Lab"
                    value={activitySubtype}
                    onChange={(e) => setActivitySubtype(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="departmentCode">Department (Optional)</Label>
                  <Select 
                    value={departmentCode || "none"} 
                    onValueChange={(val) => setDepartmentCode(val === "none" ? "" : val)}
                  >
                    <SelectTrigger id="departmentCode">
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {userDepartments.map((dept) => (
                        <SelectItem key={dept.id} value={dept.code.toUpperCase()}>
                          {dept.name} ({dept.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes (Optional)</Label>
                  <Textarea
                    id="notes"
                    placeholder="Additional details..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setDialogOpen(false);
                      setEditingEntry(null);
                      resetForm();
                    }}
                    disabled={loading}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={() => handleSubmit("submitted")}
                    disabled={loading}
                  >
                    Submit
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          </div>
        </div>

        <Card data-tour="entries-list">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle>All Entries</CardTitle>
                <CardDescription>Your timesheet and leave history</CardDescription>
              </div>
              <DateRangeFilter 
                value={dateFilterType} 
                onChange={handleDateFilterChange}
                customRange={dateRange}
              />
            </div>
          </CardHeader>
          <CardContent>
            {combinedEntries.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">
                No entries found for the selected period.
              </p>
            ) : (
              <div className="space-y-4">
                {combinedEntries.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between border rounded-lg p-4"
                  >
                    {item.type === 'timesheet' ? (
                      <>
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-1 flex-wrap">
                            <p className="font-medium">
                              {formatDisplayDate(item.entry_date)}
                            </p>
                            <StatusBadge status={item.status} />
                            {item.source === "bulk_upload" && (
                              <Badge variant="outline" className="text-xs">
                                <Upload className="h-3 w-3 mr-1" />
                                Bulk
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {item.activity_type.charAt(0).toUpperCase() + item.activity_type.slice(1)}
                            {item.activity_subtype && ` • ${item.activity_subtype}`}
                            {item.department_code && (
                              <Badge variant="outline" className="ml-2 text-xs">
                                {item.department_code}
                              </Badge>
                            )}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {item.start_time} - {item.end_time} ({formatMinutes(getEntryDuration(item))})
                          </p>
                          {item.notes && (
                            <p className="text-sm text-muted-foreground mt-1">{item.notes}</p>
                          )}
                          {item.approver_notes && (
                            <p className="text-sm text-destructive mt-1">
                              Note: {item.approver_notes}
                            </p>
                          )}
                        </div>
                        {(item.status === "draft" || item.status === "submitted") && (
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(item)}
                              title="Edit entry"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            {(item.status === "draft" || item.status === "submitted") && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(item.id)}
                                title="Delete entry"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <p className="font-medium">
                            {formatDisplayDate(item.leave_date)}
                          </p>
                          <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                            Leave
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {formatLeaveType(item.leave_type)}
                        </p>
                        {item.comments && (
                          <p className="text-sm text-muted-foreground mt-1">{item.comments}</p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
