import { useEffect, useState, useMemo } from "react";
import { isHalfDayLeave, isTimeBlockedByHalfDayLeave } from "@/lib/leaveUtils";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { useAuth } from "@/contexts/AuthContext";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { isRole } from "@/lib/roleMapping";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, addMonths, subMonths, addDays, subDays } from "date-fns";
import { timesheetEntrySchema } from "@/lib/validation";
import { getUserErrorMessage } from "@/lib/errorHandler";
import { useConfetti } from "@/hooks/useConfetti";
import { useActivityCategories } from "@/hooks/useActivityCategories";
import { formatDisplayDate } from "@/lib/dateUtils";
import { cn } from "@/lib/utils";
import { calculateDurationMinutes } from "@/lib/timesheetUtils";
import { ViewToggle } from "@/components/calendar/ViewToggle";
import { DayHourlyView } from "@/components/calendar/DayHourlyView";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useThresholds } from "@/hooks/useThresholds";

interface TimesheetEntry {
  id: string;
  entry_date: string;
  start_time: string;
  end_time: string;
  activity_type: string;
  activity_subtype: string | null;
  notes: string | null;
  status: string;
  source?: string;
}

interface LeaveEntry {
  id: string;
  leave_date: string;
  leave_type: string;
  comments: string | null;
}

export default function CalendarPage() {
  const { userWithRole } = useAuth();
  const { impersonatedUser, isReadOnly } = useImpersonation();
  const effectiveUserId = impersonatedUser?.userId || userWithRole?.user?.id;
  const { toast } = useToast();
  const navigate = useNavigate();
  const { fireConfetti } = useConfetti();
  const { categories } = useActivityCategories(userWithRole?.verticalId || userWithRole?.departmentId);
  
  // View mode state - default to day view
  const [viewMode, setViewMode] = useState<"month" | "day">("day");
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(new Date());
  
  const [entries, setEntries] = useState<TimesheetEntry[]>([]);
  const [leaveEntries, setLeaveEntries] = useState<LeaveEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteLeaveDialogOpen, setDeleteLeaveDialogOpen] = useState(false);
  const [leaveToDelete, setLeaveToDelete] = useState<LeaveEntry | null>(null);
  
  // Form state
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [activityType, setActivityType] = useState("");
  const [activitySubtype, setActivitySubtype] = useState("");
  const [notes, setNotes] = useState("");
  const [verticalCode, setVerticalCode] = useState("");
  const [selectedVerticalId, setSelectedVerticalId] = useState<string | null>(null);
  const [userVerticals, setUserVerticals] = useState<{ id: string; name: string; code: string }[]>([]);
  
  // Threshold validation (includes holidays and working days)
  const { validateEntry, thresholds, isHoliday, isWorkingDay, holidays } = useThresholds(selectedVerticalId);
  
  // Hierarchy form state
  const [programId, setProgramId] = useState("");
  const [batchId, setBatchId] = useState("");
  const [termId, setTermId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [programs, setPrograms] = useState<{ id: string; name: string; code: string }[]>([]);
  const [batches, setBatches] = useState<{ id: string; name: string }[]>([]);
  const [terms, setTerms] = useState<{ id: string; name: string }[]>([]);
  const [subjects, setSubjects] = useState<{ id: string; name: string; code: string }[]>([]);

  useEffect(() => {
    if (userWithRole && !isRole(userWithRole.role, "l1", "l2", "l3", "member", "manager", "program_manager", "faculty")) {
      navigate("/dashboard");
    } else if (userWithRole) {
      loadMonthData();
      loadUserVerticals();
    }
  }, [userWithRole, navigate, currentMonth]);

  const loadUserVerticals = async () => {
    if (!userWithRole) return;
    
    // Get user's verticals from user_verticals table
    const { data: userVerts } = await supabase
      .from("user_verticals")
      .select("vertical_id")
      .eq("user_id", effectiveUserId!);
    
    let vertIds = userVerts?.map(uv => uv.vertical_id) || [];
    
    // Fallback: check user_departments if no user_verticals entries
    if (vertIds.length === 0) {
      const { data: userDepts } = await supabase
        .from("user_departments")
        .select("department_id")
        .eq("user_id", effectiveUserId!);
      vertIds = userDepts?.map(ud => ud.department_id) || [];
    }
    
    // Also include vertical from user_roles as fallback
    const primaryVertId = userWithRole.verticalId || userWithRole.departmentId;
    if (primaryVertId && !vertIds.includes(primaryVertId)) {
      vertIds.push(primaryVertId);
    }
    
    if (vertIds.length > 0) {
      // First try verticals table
      const { data: verts } = await supabase
        .from("verticals")
        .select("id, name, code")
        .in("id", vertIds);
      
      if (verts && verts.length > 0) {
        setUserVerticals(verts);
        // Auto-select first vertical
        if (verts.length === 1) {
          setVerticalCode(verts[0].code.toUpperCase());
        }
      } else {
        // Fallback to departments table for backward compatibility
        const { data: depts } = await supabase
          .from("departments")
          .select("id, name, code")
          .in("id", vertIds);
        
        if (depts && depts.length > 0) {
          setUserVerticals(depts);
          if (depts.length === 1) {
            setVerticalCode(depts[0].code.toUpperCase());
          }
        }
      }
    }
  };

  useEffect(() => {
    if (categories.length > 0 && !activityType) {
      setActivityType(categories[0].code);
    }
  }, [categories]);

  const loadMonthData = async () => {
    if (!userWithRole) return;
    setLoading(true);

    const monthStart = format(startOfMonth(currentMonth), "yyyy-MM-dd");
    const monthEnd = format(endOfMonth(currentMonth), "yyyy-MM-dd");

    const [entriesRes, leavesRes] = await Promise.all([
      supabase
        .from("timesheet_entries")
        .select("*")
        .eq("user_id", effectiveUserId!)
        .gte("entry_date", monthStart)
        .lte("entry_date", monthEnd)
        .order("entry_date", { ascending: true }),
      supabase
        .from("leave_days" as any)
        .select("*")
        .eq("user_id", effectiveUserId!)
        .gte("leave_date", monthStart)
        .lte("leave_date", monthEnd),
    ]);

    if (entriesRes.data) setEntries(entriesRes.data);
    if (leavesRes.data) setLeaveEntries(leavesRes.data as unknown as LeaveEntry[]);
    setLoading(false);
  };

  const daysInMonth = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const entriesByDate = useMemo(() => {
    const map = new Map<string, TimesheetEntry[]>();
    entries.forEach(entry => {
      const dateKey = entry.entry_date;
      if (!map.has(dateKey)) map.set(dateKey, []);
      map.get(dateKey)!.push(entry);
    });
    return map;
  }, [entries]);

  const leavesByDate = useMemo(() => {
    const map = new Map<string, LeaveEntry>();
    leaveEntries.forEach(leave => {
      map.set(leave.leave_date, leave);
    });
    return map;
  }, [leaveEntries]);

  // Get entries for day view
  const dayEntries = useMemo(() => {
    const dateKey = format(selectedDay, "yyyy-MM-dd");
    return entriesByDate.get(dateKey) || [];
  }, [selectedDay, entriesByDate]);

  const dayLeave = useMemo(() => {
    const dateKey = format(selectedDay, "yyyy-MM-dd");
    return leavesByDate.get(dateKey);
  }, [selectedDay, leavesByDate]);

  const getFirstDayOffset = () => {
    const firstDay = startOfMonth(currentMonth).getDay();
    return firstDay === 0 ? 6 : firstDay - 1; // Monday = 0
  };

  const handleDayClick = (day: Date) => {
    // Don't allow future dates
    if (day > new Date()) return;
    
    const dateKey = format(day, "yyyy-MM-dd");
    
    // Check if it's a holiday
    const holiday = isHoliday(dateKey);
    if (holiday) {
      toast({
        title: "Holiday",
        description: `${holiday.name} - Cannot add timesheet entries on holidays`,
        variant: "destructive",
      });
      return;
    }
    
    // Check if it's a working day
    if (!isWorkingDay(day)) {
      toast({
        title: "Non-Working Day",
        description: "Cannot add timesheet entries on non-working days",
        variant: "destructive",
      });
      return;
    }
    
    // Check if it's a leave day
    if (leavesByDate.has(dateKey)) {
      const leave = leavesByDate.get(dateKey)!;
      if (isHalfDayLeave(leave.leave_type)) {
        // Half-day leave: allow clicking to add entry (validation handled in submit)
        setSelectedDate(day);
        setDialogOpen(true);
        return;
      }
      const todayStr = format(new Date(), "yyyy-MM-dd");
      if (dateKey >= todayStr) {
        // Today or future: offer to delete
        setLeaveToDelete(leave);
        setDeleteLeaveDialogOpen(true);
      } else {
        // Past: just show toast
        toast({
          title: "Leave Day",
          description: "Cannot modify past leave entries",
          variant: "destructive",
        });
      }
      return;
    }
    
    setSelectedDate(day);
    setDialogOpen(true);
  };

  const handleSlotClick = (slotStartTime: string, slotEndTime: string) => {
    if (selectedDay > new Date()) return;
    
    const dateKey = format(selectedDay, "yyyy-MM-dd");
    
    // Check if it's a holiday
    const holiday = isHoliday(dateKey);
    if (holiday) {
      toast({
        title: "Holiday",
        description: `${holiday.name} - Cannot add timesheet entries on holidays`,
        variant: "destructive",
      });
      return;
    }
    
    // Check if it's a working day
    if (!isWorkingDay(selectedDay)) {
      toast({
        title: "Non-Working Day",
        description: "Cannot add timesheet entries on non-working days",
        variant: "destructive",
      });
      return;
    }
    
    if (leavesByDate.has(dateKey)) {
      const leave = leavesByDate.get(dateKey)!;
      if (isHalfDayLeave(leave.leave_type)) {
        if (isTimeBlockedByHalfDayLeave(slotStartTime, slotEndTime, leave.leave_type)) {
          const halfLabel = leave.leave_type === "half_day_second" ? "second half" : "first half";
          toast({
            title: "Blocked by Half-Day Leave",
            description: `This slot falls in the ${halfLabel} leave period.`,
            variant: "destructive",
          });
          return;
        }
        // Slot is in the free half — allow it
      } else {
        toast({
          title: "Leave Day",
          description: "Cannot add timesheet entries on leave days",
          variant: "destructive",
        });
        return;
      }
    }
    
    setSelectedDate(selectedDay);
    setStartTime(slotStartTime);
    setEndTime(slotEndTime);
    setDialogOpen(true);
  };

  const handleSubmit = async (status: "draft" | "submitted") => {
    if (!userWithRole?.user?.id || !selectedDate) return;

    // Validate vertical code is selected
    if (!verticalCode || verticalCode.trim() === "") {
      toast({
        title: "Vertical Required",
        description: "Please select a vertical for this entry",
        variant: "destructive",
      });
      return;
    }
    
    // Validate program is selected
    if (!programId) {
      toast({
        title: "Program Required",
        description: "Please select a program for this entry",
        variant: "destructive",
      });
      return;
    }

    try {
      const entryDate = format(selectedDate, "yyyy-MM-dd");
      
      // Validate against thresholds (max hours, work hour window)
      const existingEntriesForDate = entries
        .filter(e => e.entry_date === entryDate && e.status !== "rejected")
        .map(e => ({ start_time: e.start_time, end_time: e.end_time }));
      
      const thresholdValidation = await validateEntry(
        entryDate,
        startTime,
        endTime,
        existingEntriesForDate
      );
      
      if (!thresholdValidation.valid) {
        toast({
          title: "Threshold Exceeded",
          description: thresholdValidation.error,
          variant: "destructive",
        });
        return;
      }
      
      const validatedData = timesheetEntrySchema.parse({
        entry_date: entryDate,
        start_time: startTime,
        end_time: endTime,
        activity_type: activityType,
        activity_subtype: activitySubtype,
        notes: notes,
      });

      // Find vertical_id from verticalCode
      const trimmedVertCode = verticalCode.trim().toUpperCase();
      const selectedVertical = userVerticals.find(v => v.code.toUpperCase() === trimmedVertCode);
      const verticalId = selectedVertical?.id || null;
      
      // Get selected hierarchy data
      const selectedProgram = programs.find(p => p.id === programId);
      const selectedBatch = batches.find(b => b.id === batchId);
      const selectedTerm = terms.find(t => t.id === termId);
      const selectedSubject = subjects.find(s => s.id === subjectId);

      const { error } = await supabase.from("timesheet_entries").insert({
        user_id: userWithRole.user.id,
        entry_date: validatedData.entry_date,
        start_time: validatedData.start_time,
        end_time: validatedData.end_time,
        activity_type: validatedData.activity_type,
        activity_subtype: validatedData.activity_subtype || null,
        notes: validatedData.notes || null,
        vertical_id: verticalId,
        vertical_code: trimmedVertCode || null,
        department_code: trimmedVertCode || null, // backward compatibility
        program_id: programId || null,
        batch_id: batchId || null,
        batch_name: selectedBatch?.name || null,
        term_id: termId || null,
        term_name: selectedTerm?.name || null,
        subject_id: subjectId || null,
        subject_code: selectedSubject?.code || null,
        status,
      });

      setSubmitting(false);

      if (error) throw error;

      if (status === "submitted") {
        fireConfetti();
      }

      toast({
        title: status === "submitted" ? "🎉 Submitted!" : "Saved",
        description: status === "draft" 
          ? "Entry saved as draft"
          : "Your timesheet has been submitted for approval",
      });
      
      setDialogOpen(false);
      resetForm();
      loadMonthData();
    } catch (error: any) {
      setSubmitting(false);
      if (error.errors) {
        toast({
          title: "Validation Error",
          description: error.errors[0]?.message || "Invalid input",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: getUserErrorMessage(error, "create timesheet entry"),
          variant: "destructive",
        });
      }
    }
  };

  const handleDeleteLeave = async () => {
    if (!leaveToDelete) return;
    const { error } = await supabase
      .from('leave_days' as any)
      .delete()
      .eq('id', leaveToDelete.id);

    if (error) {
      toast({ title: "Error", description: "Failed to delete leave", variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Leave deleted successfully" });
      loadMonthData();
    }
    setDeleteLeaveDialogOpen(false);
    setLeaveToDelete(null);
  };

  const resetForm = () => {
    setStartTime("09:00");
    setEndTime("10:00");
    setActivityType(categories[0]?.code || "");
    setActivitySubtype("");
    setNotes("");
    setSelectedDate(null);
    setProgramId("");
    setBatchId("");
    setTermId("");
    setSubjectId("");
    setPrograms([]);
    setBatches([]);
    setTerms([]);
    setSubjects([]);
    // Reset vertical code to auto-selected if only one vertical
    if (userVerticals.length === 1) {
      setVerticalCode(userVerticals[0].code.toUpperCase());
    } else {
      setVerticalCode("");
    }
  };
  
  // Fetch programs when vertical changes
  const fetchUserPrograms = async (verticalId: string) => {
    if (!userWithRole || !verticalId) {
      setPrograms([]);
      return;
    }
    
    // Get user's programs
    const { data: userProgs } = await supabase
      .from("user_programs")
      .select("program_id")
      .eq("user_id", effectiveUserId!);
    
    const userProgIds = userProgs?.map(p => p.program_id) || [];
    
    if (userProgIds.length === 0) {
      // Fallback: get all programs for this vertical
      const { data } = await supabase
        .from("programs")
        .select("id, name, code")
        .eq("vertical_id", verticalId)
        .order("name");
      setPrograms(data || []);
    } else {
      const { data } = await supabase
        .from("programs")
        .select("id, name, code")
        .eq("vertical_id", verticalId)
        .in("id", userProgIds)
        .order("name");
      setPrograms(data || []);
    }
  };
  
  // Fetch batches when program changes
  const fetchBatches = async (progId: string) => {
    if (!progId) {
      setBatches([]);
      return;
    }
    const { data } = await supabase
      .from("batches")
      .select("id, name")
      .eq("program_id", progId)
      .order("name");
    setBatches(data || []);
  };
  
  // Fetch terms when batch changes
  const fetchTerms = async (batchIdVal: string) => {
    if (!batchIdVal) {
      setTerms([]);
      return;
    }
    const { data } = await supabase
      .from("terms")
      .select("id, name")
      .eq("batch_id", batchIdVal)
      .order("name");
    setTerms(data || []);
  };
  
  // Fetch subjects when term changes
  const fetchSubjects = async (termIdVal: string) => {
    if (!termIdVal) {
      setSubjects([]);
      return;
    }
    const { data } = await supabase
      .from("subjects")
      .select("id, name, code")
      .eq("term_id", termIdVal)
      .order("name");
    setSubjects(data || []);
  };
  
  // Handle vertical change - reset downstream selections
  const handleVerticalChange = (code: string) => {
    setVerticalCode(code);
    setProgramId("");
    setBatchId("");
    setTermId("");
    setSubjectId("");
    setBatches([]);
    setTerms([]);
    setSubjects([]);
    
    const selectedVertical = userVerticals.find(v => v.code.toUpperCase() === code.toUpperCase());
    if (selectedVertical) {
      setSelectedVerticalId(selectedVertical.id);
      fetchUserPrograms(selectedVertical.id);
    } else {
      setSelectedVerticalId(null);
      setPrograms([]);
    }
  };
  
  // Handle program change
  const handleProgramChange = (progId: string) => {
    setProgramId(progId);
    setBatchId("");
    setTermId("");
    setSubjectId("");
    setTerms([]);
    setSubjects([]);
    fetchBatches(progId);
  };
  
  // Handle batch change
  const handleBatchChange = (batchIdVal: string) => {
    setBatchId(batchIdVal);
    setTermId("");
    setSubjectId("");
    setSubjects([]);
    fetchTerms(batchIdVal);
  };
  
  // Handle term change
  const handleTermChange = (termIdVal: string) => {
    setTermId(termIdVal);
    setSubjectId("");
    fetchSubjects(termIdVal);
  };

  const formatLeaveType = (type: string) => {
    const labels: Record<string, string> = {
      casual: "CL",
      sick: "SL",
      earned: "EL",
      half_day: "HD",
      half_day_first: "HD-1",
      half_day_second: "HD-2",
      comp_off: "CO",
      other: "OL",
    };
    return labels[type] || type;
  };

  const getDayContent = (day: Date) => {
    const dateKey = format(day, "yyyy-MM-dd");
    const dayEntries = entriesByDate.get(dateKey) || [];
    const leave = leavesByDate.get(dateKey);
    const holiday = isHoliday(dateKey);
    const isWorkingDayFlag = isWorkingDay(day);
    const totalMinutes = dayEntries.reduce((sum, e) => sum + calculateDurationMinutes(e.start_time, e.end_time), 0);
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;

    return { dayEntries, leave, holiday, isWorkingDayFlag, totalMinutes, hours, mins };
  };

  const handleTodayClick = () => {
    const today = new Date();
    if (viewMode === "month") {
      setCurrentMonth(today);
    } else {
      setSelectedDay(today);
      setCurrentMonth(today);
    }
  };

  const handleViewModeChange = (mode: "month" | "day") => {
    setViewMode(mode);
    if (mode === "day") {
      setSelectedDay(new Date());
    }
  };

  const handleDayNavigation = (direction: "prev" | "next") => {
    if (direction === "prev") {
      const newDay = subDays(selectedDay, 1);
      setSelectedDay(newDay);
      // Update current month if we crossed month boundary
      if (newDay.getMonth() !== currentMonth.getMonth()) {
        setCurrentMonth(newDay);
      }
    } else {
      const newDay = addDays(selectedDay, 1);
      setSelectedDay(newDay);
      if (newDay.getMonth() !== currentMonth.getMonth()) {
        setCurrentMonth(newDay);
      }
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <CalendarDays className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Calendar View</h1>
              <p className="text-sm text-muted-foreground">View and add timesheet entries</p>
            </div>
          </div>
          <ViewToggle viewMode={viewMode} onViewModeChange={handleViewModeChange} />
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div className="flex items-center gap-4">
              {viewMode === "month" ? (
                <>
                  <Button variant="outline" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <CardTitle className="text-xl">
                    {format(currentMonth, "MMMM yyyy")}
                  </CardTitle>
                  <Button variant="outline" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" size="icon" onClick={() => handleDayNavigation("prev")}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-xl">
                      {format(selectedDay, "EEEE, MMMM d, yyyy")}
                    </CardTitle>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm">
                          <CalendarDays className="h-4 w-4 mr-2" />
                          Change Date
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={selectedDay}
                          onSelect={(date) => {
                            if (date) {
                              setSelectedDay(date);
                              if (date.getMonth() !== currentMonth.getMonth()) {
                                setCurrentMonth(date);
                              }
                            }
                          }}
                          initialFocus
                          className="p-3 pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <Button variant="outline" size="icon" onClick={() => handleDayNavigation("next")}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={handleTodayClick}>
              Today
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center h-96">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : viewMode === "month" ? (
              <>
                {/* Weekday headers */}
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(day => (
                    <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
                      {day}
                    </div>
                  ))}
                </div>
                
                {/* Calendar grid */}
                <div className="grid grid-cols-7 gap-1">
                  {/* Empty cells for offset */}
                  {Array.from({ length: getFirstDayOffset() }).map((_, i) => (
                    <div key={`empty-${i}`} className="min-h-24 bg-muted/30 rounded-lg" />
                  ))}
                  
                  {/* Day cells */}
                  {daysInMonth.map(day => {
                    const { dayEntries, leave, holiday, isWorkingDayFlag, hours, mins } = getDayContent(day);
                    const isCurrentMonth = isSameMonth(day, currentMonth);
                    const isTodayDate = isToday(day);
                    const isFuture = day > new Date();
                    const isNonWorking = !isWorkingDayFlag;
                    const hasBulkUpload = dayEntries.some(e => e.source === "bulk_upload");
                    const isHalfDay = leave && (leave.leave_type === 'half_day_first' || leave.leave_type === 'half_day_second' || leave.leave_type === 'half_day');
                    const isBlocked = !!holiday || isNonWorking || (!!leave && !isHalfDay) || isFuture;

                    return (
                      <div
                        key={day.toISOString()}
                        className={cn(
                          "min-h-24 p-2 rounded-lg border cursor-pointer transition-colors",
                          !isCurrentMonth && "opacity-50",
                          isTodayDate && "border-primary bg-primary/5",
                          holiday && "bg-destructive/10 border-destructive/30",
                          leave && !isHalfDay && !holiday && "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800",
                          leave && isHalfDay && !holiday && "bg-gradient-to-b from-blue-50 to-background dark:from-blue-900/20 dark:to-background border-blue-200/50 dark:border-blue-800/50",
                          isNonWorking && !leave && !holiday && "bg-muted/50",
                          isFuture && "opacity-50 cursor-not-allowed",
                          !isBlocked && "hover:bg-muted/50",
                          isBlocked && "cursor-not-allowed"
                        )}
                        onClick={() => !isFuture && handleDayClick(day)}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className={cn(
                            "text-sm font-medium",
                            isTodayDate && "text-primary",
                            holiday && "text-destructive"
                          )}>
                            {format(day, "d")}
                          </span>
                          {hasBulkUpload && (
                            <Badge variant="outline" className="text-[10px] px-1 h-4">
                              Bulk
                            </Badge>
                          )}
                        </div>
                        
                        {holiday ? (
                          <Badge variant="destructive" className="text-[10px]">
                            {holiday.name.length > 10 ? holiday.name.slice(0, 10) + "..." : holiday.name}
                          </Badge>
                        ) : leave && !isHalfDay ? (
                          <Badge variant="secondary" className="text-[10px] bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300">
                            {formatLeaveType(leave.leave_type)}
                          </Badge>
                        ) : leave && isHalfDay ? (
                          <div className="space-y-1">
                            <Badge variant="secondary" className="text-[10px] bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300">
                              {formatLeaveType(leave.leave_type)}
                            </Badge>
                            {dayEntries.length > 0 && (
                              <p className="text-xs text-muted-foreground">
                                {hours}h {mins}m
                              </p>
                            )}
                          </div>
                        ) : dayEntries.length > 0 ? (
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">
                              {hours}h {mins}m
                            </p>
                            <div className="flex flex-wrap gap-0.5">
                              {dayEntries.slice(0, 3).map((entry, i) => (
                                <div
                                  key={entry.id}
                                  className={cn(
                                    "h-1.5 w-1.5 rounded-full",
                                    entry.status === "approved" && "bg-green-500",
                                    entry.status === "submitted" && "bg-yellow-500",
                                    entry.status === "draft" && "bg-gray-400",
                                    entry.status === "rejected" && "bg-red-500"
                                  )}
                                />
                              ))}
                              {dayEntries.length > 3 && (
                                <span className="text-[10px] text-muted-foreground">+{dayEntries.length - 3}</span>
                              )}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
                
                {/* Legend */}
                <div className="flex flex-wrap gap-4 mt-4 text-sm">
                  <div className="flex items-center gap-1.5">
                    <div className="h-3 w-3 rounded-full bg-green-500" />
                    <span className="text-muted-foreground">Approved</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="h-3 w-3 rounded-full bg-yellow-500" />
                    <span className="text-muted-foreground">Pending</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="h-3 w-3 rounded-full bg-gray-400" />
                    <span className="text-muted-foreground">Draft</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="h-3 w-3 rounded-full bg-red-500" />
                    <span className="text-muted-foreground">Rejected</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="h-3 w-3 rounded bg-blue-100 dark:bg-blue-900/50 border border-blue-200 dark:border-blue-800" />
                    <span className="text-muted-foreground">Leave</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="h-3 w-3 rounded bg-destructive/10 border border-destructive/30" />
                    <span className="text-muted-foreground">Holiday</span>
                  </div>
                </div>
              </>
            ) : (
              /* Day View */
              <DayHourlyView
                date={selectedDay}
                entries={dayEntries}
                leaveEntry={dayLeave}
                onSlotClick={handleSlotClick}
                showTotals={true}
              />
            )}
          </CardContent>
        </Card>

        {/* Add Entry Dialog */}
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogContent className="max-w-md max-h-[90vh] flex flex-col">
            <DialogHeader className="flex-shrink-0">
              <DialogTitle>Add Timesheet Entry</DialogTitle>
              <DialogDescription>
                {selectedDate && `Add entry for ${formatDisplayDate(format(selectedDate, "yyyy-MM-dd"))}`}
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto pr-2">
              <div className="space-y-4">
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
                  <Label htmlFor="verticalCode">Vertical <span className="text-destructive">*</span></Label>
                  <Select 
                    value={verticalCode} 
                    onValueChange={handleVerticalChange}
                  >
                    <SelectTrigger id="verticalCode">
                      <SelectValue placeholder="Select vertical" />
                    </SelectTrigger>
                    <SelectContent>
                      {userVerticals.map((vert) => (
                        <SelectItem key={vert.id} value={vert.code.toUpperCase()}>
                          {vert.name} ({vert.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="programId">Program <span className="text-destructive">*</span></Label>
                  <Select 
                    value={programId} 
                    onValueChange={handleProgramChange}
                    disabled={!verticalCode}
                  >
                    <SelectTrigger id="programId">
                      <SelectValue placeholder={verticalCode ? "Select program" : "Select vertical first"} />
                    </SelectTrigger>
                    <SelectContent>
                      {programs.map((prog) => (
                        <SelectItem key={prog.id} value={prog.id}>
                          {prog.name} ({prog.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-2">
                    <Label htmlFor="batchId">Batch</Label>
                    <Select 
                      value={batchId} 
                      onValueChange={handleBatchChange}
                      disabled={!programId}
                    >
                      <SelectTrigger id="batchId">
                        <SelectValue placeholder="Optional" />
                      </SelectTrigger>
                      <SelectContent>
                        {batches.map((batch) => (
                          <SelectItem key={batch.id} value={batch.id}>
                            {batch.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="termId">Term</Label>
                    <Select 
                      value={termId} 
                      onValueChange={handleTermChange}
                      disabled={!batchId}
                    >
                      <SelectTrigger id="termId">
                        <SelectValue placeholder="Optional" />
                      </SelectTrigger>
                      <SelectContent>
                        {terms.map((term) => (
                          <SelectItem key={term.id} value={term.id}>
                            {term.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="subjectId">Subject</Label>
                    <Select 
                      value={subjectId} 
                      onValueChange={setSubjectId}
                      disabled={!termId}
                    >
                      <SelectTrigger id="subjectId">
                        <SelectValue placeholder="Optional" />
                      </SelectTrigger>
                      <SelectContent>
                        {subjects.map((subj) => (
                          <SelectItem key={subj.id} value={subj.id}>
                            {subj.name} ({subj.code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
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
              </div>
            </div>

            <div className="flex gap-2 flex-shrink-0 pt-4 border-t mt-4">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => handleSubmit("draft")}
                disabled={submitting || isReadOnly}
                data-mutating="true"
              >
                Save Draft
              </Button>
              <Button
                className="flex-1"
                onClick={() => handleSubmit("submitted")}
                disabled={submitting || isReadOnly}
                data-mutating="true"
              >
                Submit
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Leave Confirmation Dialog */}
        <AlertDialog open={deleteLeaveDialogOpen} onOpenChange={setDeleteLeaveDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Leave?</AlertDialogTitle>
              <AlertDialogDescription>
                {leaveToDelete && (
                  <>
                    Are you sure you want to delete your <strong>{leaveToDelete.leave_type.replace("_", " ")}</strong> leave on <strong>{formatDisplayDate(leaveToDelete.leave_date)}</strong>? This action cannot be undone.
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
      </div>
    </Layout>
  );
}
