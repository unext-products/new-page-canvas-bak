import { useEffect, useState, useMemo, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/StatusBadge";
import { Plus, Trash2, Calendar, FileText, HelpCircle, Upload, Pencil } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { isRole } from "@/lib/roleMapping";
import { timesheetEntrySchema } from "@/lib/validation";
import { getUserErrorMessage } from "@/lib/errorHandler";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { useConfetti } from "@/hooks/useConfetti";
import { OnboardingTour, useOnboardingTour } from "@/components/OnboardingTour";
import { useActivityCategories } from "@/hooks/useActivityCategories";
import { formatDisplayDate, formatLocalDate } from "@/lib/dateUtils";
import { DateRangeFilter, DateFilterType, DateRange } from "@/components/DateRangeFilter";
import { startOfDay, endOfDay, isWithinInterval } from "date-fns";
import { getEntryDuration } from "@/lib/timesheetUtils";
import { useThresholds } from "@/hooks/useThresholds";
import { fetchUserThresholds, validateAgainstThresholds } from "@/lib/thresholdValidation";

export default function Timesheet() {
  const { userWithRole } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { fireConfetti } = useConfetti();
  const { resetTour, hasSeen } = useOnboardingTour();
  const { categories, loading: categoriesLoading, parentCategories, getChildren, hasHierarchy, selectableActivities } = useActivityCategories(userWithRole?.verticalId || userWithRole?.departmentId);
  
  // Stable ref for userWithRole to prevent async handlers from seeing null during token refresh
  const userRef = useRef(userWithRole);
  useEffect(() => { userRef.current = userWithRole; }, [userWithRole]);
  
  const hasLoadedRef = useRef(false);
  
  const [entries, setEntries] = useState<any[]>([]);
  const [leaveEntries, setLeaveEntries] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [runTour, setRunTour] = useState(false);
  
  
  // Form state
  const [entryDate, setEntryDate] = useState(formatLocalDate(new Date()));
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [activityType, setActivityType] = useState("");
  const [activitySubtype, setActivitySubtype] = useState("");
  const [notes, setNotes] = useState("");
  const [verticalCode, setVerticalCode] = useState("");
  const [selectedVerticalId, setSelectedVerticalId] = useState<string | null>(null);
  const [userVerticals, setUserVerticals] = useState<{ id: string; name: string; code: string }[]>([]);
  
  // Threshold validation
  const { validateEntry, thresholds, isHoliday, isWorkingDay } = useThresholds(selectedVerticalId);
  
  // Hierarchy form state
  const [programId, setProgramId] = useState("");
  const [batchId, setBatchId] = useState("");
  const [termId, setTermId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [programs, setPrograms] = useState<{ id: string; name: string; code: string }[]>([]);
  const [batches, setBatches] = useState<{ id: string; name: string }[]>([]);
  const [terms, setTerms] = useState<{ id: string; name: string }[]>([]);
  const [subjects, setSubjects] = useState<{ id: string; name: string; code: string }[]>([]);

  // Leave management state
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [leaveDate, setLeaveDate] = useState(formatLocalDate(new Date()));
  const [leaveType, setLeaveType] = useState<"casual" | "sick" | "earned" | "half_day_first" | "half_day_second" | "comp_off" | "other">("casual");
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
    if (!userWithRole) return;
    if (userWithRole && !isRole(userWithRole.role, "l1", "l2", "l3", "member", "manager", "program_manager", "faculty")) {
      navigate("/dashboard");
      return;
    }
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    loadEntries();
    loadLeaveDays();
    loadUserVerticals();
  }, [userWithRole, navigate]);

  const loadUserVerticals = async () => {
    if (!userWithRole) return;
    
    // Get user's verticals from user_verticals table
    const { data: userVerts } = await supabase
      .from("user_verticals")
      .select("vertical_id")
      .eq("user_id", userWithRole.user.id);
    
    let vertIds = userVerts?.map(uv => uv.vertical_id) || [];
    
    // Fallback: check user_departments if no user_verticals entries
    if (vertIds.length === 0) {
      const { data: userDepts } = await supabase
        .from("user_departments")
        .select("department_id")
        .eq("user_id", userWithRole.user.id);
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
      } else {
        // Fallback to departments table for backward compatibility
        const { data: depts } = await supabase
          .from("departments")
          .select("id, name, code")
          .in("id", vertIds);
        
        setUserVerticals(depts || []);
      }
    }
  };

  // Set initial activity type when categories load
  useEffect(() => {
    if (selectableActivities.length > 0 && !activityType) {
      setActivityType(selectableActivities[0].code);
    }
  }, [selectableActivities]);

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
    const currentUser = userRef.current;
    if (!currentUser?.user?.id) {
      toast({
        title: "Error",
        description: "You must be logged in to create timesheet entries",
        variant: "destructive",
      });
      return;
    }

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

    // Check if the date is marked as leave (half-day leaves allow entries in the free half)
    if (userLeaveDays.has(entryDate)) {
      const leaveForDate = leaveEntries.find((l: any) => l.leave_date === entryDate);
      if (leaveForDate) {
        const { isHalfDayLeave, isTimeBlockedByHalfDayLeave } = await import("@/lib/leaveUtils");
        if (isHalfDayLeave(leaveForDate.leave_type)) {
          // Only block if entry time falls in the blocked half
          if (isTimeBlockedByHalfDayLeave(startTime, endTime, leaveForDate.leave_type)) {
            const halfLabel = leaveForDate.leave_type === "half_day_second" ? "second half" : "first half";
            toast({
              title: "Blocked by Half-Day Leave",
              description: `You have a ${halfLabel} leave on this day. You can only add entries in the other half.`,
              variant: "destructive",
            });
            return;
          }
          // Entry is in the free half — allow it through
        } else {
          // Full-day leave — block entirely
          toast({
            title: "Error",
            description: "Cannot add timesheet entries on leave days",
            variant: "destructive",
          });
          return;
        }
      }
    }

    // Validate future date - cannot create entries for future dates
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    if (entryDate > todayStr) {
      toast({
        title: "Future Date Not Allowed",
        description: "Cannot create timesheet entries for future dates",
        variant: "destructive",
      });
      return;
    }

    // Check if entry date is a holiday
    const holiday = isHoliday(entryDate);
    if (holiday) {
      toast({
        title: "Holiday",
        description: `Cannot create entries on holidays (${holiday.name})`,
        variant: "destructive",
      });
      return;
    }

    // Check if entry date is a working day
    if (!isWorkingDay(new Date(entryDate))) {
      toast({
        title: "Non-Working Day",
        description: "Cannot create entries on non-working days",
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
    if (checkTimeOverlap(entryDate, normalizedStart, normalizedEnd, editingEntryId || undefined)) {
      toast({
        title: "Time Overlap Detected",
        description: "This time slot overlaps with an existing entry. Please choose a different time.",
        variant: "destructive",
      });
      return; // Dialog remains open
    }

    // Validate against thresholds - fetch fresh from DB for strict enforcement
    try {
      const freshThresholds = await fetchUserThresholds(currentUser.user.id, selectedVerticalId);
      if (freshThresholds) {
        // Check work hour window
        const thresholdResult = validateAgainstThresholds(normalizedStart, normalizedEnd, freshThresholds);
        if (!thresholdResult.valid) {
          toast({
            title: "Threshold Exceeded",
            description: thresholdResult.error,
            variant: "destructive",
          });
          return;
        }

        // Check max hours per day with fresh thresholds
        if (freshThresholds.max_hours_enabled) {
          const existingEntriesForDate = entries
            .filter(e => e.entry_date === entryDate && e.status !== "rejected" && e.id !== editingEntryId)
            .map(e => ({ start_time: e.start_time, end_time: e.end_time }));

          const newDuration = calculateDuration(normalizedStart, normalizedEnd);
          let existingMinutes = 0;
          for (const e of existingEntriesForDate) {
            existingMinutes += calculateDuration(e.start_time, e.end_time);
          }
          const totalMinutes = existingMinutes + newDuration;

          if (totalMinutes > freshThresholds.max_hours_minutes) {
            const maxH = Math.floor(freshThresholds.max_hours_minutes / 60);
            const maxM = freshThresholds.max_hours_minutes % 60;
            toast({
              title: "Threshold Exceeded",
              description: `Cannot exceed ${maxH}h ${maxM}m per day. Current total would be ${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m.`,
              variant: "destructive",
            });
            return;
          }
        }
      }
    } catch (err) {
      console.error("Error fetching fresh thresholds:", err);
      // Fall back to hook-based validation
      const existingEntriesForDate = entries
        .filter(e => e.entry_date === entryDate && e.status !== "rejected" && e.id !== editingEntryId)
        .map(e => ({ start_time: e.start_time, end_time: e.end_time }));
      const thresholdValidation = await validateEntry(entryDate, normalizedStart, normalizedEnd, existingEntriesForDate);
      if (!thresholdValidation.valid) {
        toast({ title: "Threshold Exceeded", description: thresholdValidation.error, variant: "destructive" });
        return;
      }
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

      // Use vertical code directly (already validated by dropdown selection)
      const trimmedVertCode = verticalCode.trim().toUpperCase();
      
      // Find vertical_id from verticalCode
      const selectedVertical = userVerticals.find(v => v.code.toUpperCase() === trimmedVertCode);
      const verticalId = selectedVertical?.id || null;
      
      // Get selected hierarchy data
      const selectedProgram = programs.find(p => p.id === programId);
      const selectedBatch = batches.find(b => b.id === batchId);
      const selectedTerm = terms.find(t => t.id === termId);
      const selectedSubject = subjects.find(s => s.id === subjectId);

      setLoading(true);

      const entryData = {
        entry_date: validatedData.entry_date,
        start_time: validatedData.start_time,
        end_time: validatedData.end_time,
        activity_type: validatedData.activity_type,
        activity_subtype: validatedData.activity_subtype || null,
        notes: validatedData.notes || null,
        vertical_id: verticalId,
        vertical_code: trimmedVertCode || null,
        department_code: trimmedVertCode || null,
        program_id: programId || null,
        batch_id: batchId || null,
        batch_name: selectedBatch?.name || null,
        term_id: termId || null,
        term_name: selectedTerm?.name || null,
        subject_id: subjectId || null,
        subject_code: selectedSubject?.code || null,
        status,
      };

      let error;
      if (editingEntryId) {
        // Update existing entry
        const result = await supabase.from("timesheet_entries").update(entryData).eq("id", editingEntryId);
        error = result.error;
      } else {
        // Insert new entry
        const result = await supabase.from("timesheet_entries").insert({
          user_id: currentUser.user.id,
          ...entryData,
        });
        error = result.error;
      }

      setLoading(false);

      if (error) throw error;

      fireConfetti();

      toast({
        title: editingEntryId ? "✅ Updated!" : "🎉 Submitted!",
        description: editingEntryId ? "Your timesheet entry has been updated" : "Your timesheet has been submitted for approval",
      });
      setDialogOpen(false);
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
          description: getUserErrorMessage(error, "create timesheet entry"),
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

  const handleDeleteLeave = async (leaveId: string) => {
    try {
      const { error } = await supabase
        .from('leave_days' as any)
        .delete()
        .eq('id', leaveId);

      if (error) {
        toast({
          title: "Error",
          description: "Failed to delete leave",
          variant: "destructive",
        });
      } else {
        toast({ title: "Success", description: "Leave deleted successfully" });
        loadLeaveDays();
        loadEntries();
      }
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to delete leave",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setEntryDate(formatLocalDate(new Date()));
    setStartTime("09:00");
    setEndTime("10:00");
    setActivityType(selectableActivities[0]?.code || "");
    setActivitySubtype("");
    setNotes("");
    setVerticalCode("");
    setProgramId("");
    setBatchId("");
    setTermId("");
    setSubjectId("");
    setPrograms([]);
    setBatches([]);
    setTerms([]);
    setSubjects([]);
    setEditingEntryId(null);
  };

  const handleEdit = async (entry: any) => {
    setEditingEntryId(entry.id);
    setEntryDate(entry.entry_date);
    setStartTime(entry.start_time?.substring(0, 5) || "09:00");
    setEndTime(entry.end_time?.substring(0, 5) || "10:00");
    setActivityType(entry.activity_type || "");
    setActivitySubtype(entry.activity_subtype || "");
    setNotes(entry.notes || "");

    // Set vertical and load cascading dropdowns
    const vCode = (entry.vertical_code || entry.department_code || "").toUpperCase();
    setVerticalCode(vCode);
    const selectedVert = userVerticals.find(v => v.code.toUpperCase() === vCode);
    if (selectedVert) {
      setSelectedVerticalId(selectedVert.id);
      await fetchUserPrograms(selectedVert.id);
    }

    // Set program and load batches
    if (entry.program_id) {
      setProgramId(entry.program_id);
      await fetchBatches(entry.program_id);
    }

    // Set batch and load terms
    if (entry.batch_id) {
      setBatchId(entry.batch_id);
      await fetchTerms(entry.batch_id);
    }

    // Set term and load subjects
    if (entry.term_id) {
      setTermId(entry.term_id);
      await fetchSubjects(entry.term_id);
    }

    // Set subject
    if (entry.subject_id) {
      setSubjectId(entry.subject_id);
    }

    setDialogOpen(true);
  };
  
  // Fetch programs when vertical changes
  const fetchUserPrograms = async (verticalId: string) => {
    const currentUser = userRef.current;
    if (!currentUser || !verticalId) {
      setPrograms([]);
      return;
    }
    
    // Get user's programs
    const { data: userProgs } = await supabase
      .from("user_programs")
      .select("program_id")
      .eq("user_id", currentUser.user.id);
    
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


  const handleDialogClose = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
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
      half_day: "Half Day (Legacy)",
      half_day_first: "Half Day - First Half",
      half_day_second: "Half Day - Second Half",
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
      setLeaveDate(formatLocalDate(new Date()));
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
              <Button variant="outline" className="w-full sm:w-auto" data-tour="mark-leave" data-mutating="true">
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
                      <SelectItem value="half_day_first">Half Day - First Half</SelectItem>
                      <SelectItem value="half_day_second">Half Day - Second Half</SelectItem>
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
                <Button className="w-full sm:w-auto" data-tour="new-entry" data-mutating="true">
                  <Plus className="mr-2 h-4 w-4" />
                  New Entry
                </Button>
              </DialogTrigger>
            <DialogContent className="max-w-md max-h-[90vh] flex flex-col">
              <DialogHeader className="flex-shrink-0">
                <DialogTitle>{editingEntryId ? "Edit Timesheet Entry" : "Add Timesheet Entry"}</DialogTitle>
                <DialogDescription>
                  {editingEntryId ? "Update the details of your work activity" : "Fill in the details of your work activity"}
                </DialogDescription>
              </DialogHeader>
              <div className="flex-1 overflow-y-auto pr-2">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="date">Date</Label>
                    <Input
                      id="date"
                      type="date"
                      value={entryDate}
                      onChange={(e) => setEntryDate(e.target.value)}
                      max={formatLocalDate(new Date())}
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
                        {hasHierarchy ? (
                          // Hierarchical view with grouped activities
                          parentCategories.map((parent) => {
                            const children = getChildren(parent.id);
                            if (children.length === 0) return null;
                            return (
                              <SelectGroup key={parent.id}>
                                <SelectLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                  {parent.name}
                                </SelectLabel>
                                {children.map((activity) => (
                                  <SelectItem key={activity.code} value={activity.code}>
                                    {activity.name}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            );
                          })
                        ) : (
                          // Flat list for non-hierarchical categories
                          categories.map((cat) => (
                            <SelectItem key={cat.code} value={cat.code}>
                              {cat.name}
                            </SelectItem>
                          ))
                        )}
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
                  onClick={() => {
                    setDialogOpen(false);
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
                  data-mutating="true"
                >
                  Submit
                </Button>
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
                            {(item.vertical_code || item.department_code) && (
                              <Badge variant="outline" className="ml-2 text-xs">
                                {item.vertical_code || item.department_code}
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
                              data-mutating="true"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(item.id)}
                              title="Delete entry"
                              data-mutating="true"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
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
                        {item.leave_date >= formatLocalDate(new Date()) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteLeave(item.id)}
                            title="Delete leave"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </>
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
