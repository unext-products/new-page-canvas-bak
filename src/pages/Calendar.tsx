import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/StatusBadge";
import { Plus, ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, addMonths, subMonths, isSameDay } from "date-fns";
import { timesheetEntrySchema } from "@/lib/validation";
import { getUserErrorMessage } from "@/lib/errorHandler";
import { useConfetti } from "@/hooks/useConfetti";
import { useActivityCategories } from "@/hooks/useActivityCategories";
import { formatDisplayDate } from "@/lib/dateUtils";
import { cn } from "@/lib/utils";
import { calculateDurationMinutes } from "@/lib/timesheetUtils";

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
  const { toast } = useToast();
  const navigate = useNavigate();
  const { fireConfetti } = useConfetti();
  const { categories } = useActivityCategories(userWithRole?.departmentId);
  
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [entries, setEntries] = useState<TimesheetEntry[]>([]);
  const [leaveEntries, setLeaveEntries] = useState<LeaveEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [submitting, setSubmitting] = useState(false);
  
  // Form state
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [activityType, setActivityType] = useState("");
  const [activitySubtype, setActivitySubtype] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    const allowedRoles = ["member", "manager", "program_manager"];
    if (userWithRole && !allowedRoles.includes(userWithRole.role || "")) {
      navigate("/dashboard");
    } else if (userWithRole) {
      loadMonthData();
    }
  }, [userWithRole, navigate, currentMonth]);

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
        .eq("user_id", userWithRole.user.id)
        .gte("entry_date", monthStart)
        .lte("entry_date", monthEnd)
        .order("entry_date", { ascending: true }),
      supabase
        .from("leave_days" as any)
        .select("*")
        .eq("user_id", userWithRole.user.id)
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

  const getFirstDayOffset = () => {
    const firstDay = startOfMonth(currentMonth).getDay();
    return firstDay === 0 ? 6 : firstDay - 1; // Monday = 0
  };

  const handleDayClick = (day: Date) => {
    // Don't allow future dates
    if (day > new Date()) return;
    
    const dateKey = format(day, "yyyy-MM-dd");
    // Check if it's a leave day
    if (leavesByDate.has(dateKey)) {
      toast({
        title: "Leave Day",
        description: "Cannot add timesheet entries on leave days",
        variant: "destructive",
      });
      return;
    }
    
    setSelectedDate(day);
    setDialogOpen(true);
  };

  const handleSubmit = async (status: "draft" | "submitted") => {
    if (!userWithRole?.user?.id || !selectedDate) return;

    try {
      const entryDate = format(selectedDate, "yyyy-MM-dd");
      
      const validatedData = timesheetEntrySchema.parse({
        entry_date: entryDate,
        start_time: startTime,
        end_time: endTime,
        activity_type: activityType,
        activity_subtype: activitySubtype,
        notes: notes,
      });

      setSubmitting(true);

      const { error } = await supabase.from("timesheet_entries").insert({
        user_id: userWithRole.user.id,
        entry_date: validatedData.entry_date,
        start_time: validatedData.start_time,
        end_time: validatedData.end_time,
        activity_type: validatedData.activity_type,
        activity_subtype: validatedData.activity_subtype || null,
        notes: validatedData.notes || null,
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

  const resetForm = () => {
    setStartTime("09:00");
    setEndTime("10:00");
    setActivityType(categories[0]?.code || "");
    setActivitySubtype("");
    setNotes("");
    setSelectedDate(null);
  };

  const formatLeaveType = (type: string) => {
    const labels: Record<string, string> = {
      casual: "CL",
      sick: "SL",
      earned: "EL",
      half_day: "HD",
      comp_off: "CO",
      other: "OL",
    };
    return labels[type] || type;
  };

  const getDayContent = (day: Date) => {
    const dateKey = format(day, "yyyy-MM-dd");
    const dayEntries = entriesByDate.get(dateKey) || [];
    const leave = leavesByDate.get(dateKey);
    const totalMinutes = dayEntries.reduce((sum, e) => sum + calculateDurationMinutes(e.start_time, e.end_time), 0);
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;

    return { dayEntries, leave, totalMinutes, hours, mins };
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
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div className="flex items-center gap-4">
              <Button variant="outline" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <CardTitle className="text-xl">
                {format(currentMonth, "MMMM yyyy")}
              </CardTitle>
              <Button variant="outline" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <Button variant="outline" size="sm" onClick={() => setCurrentMonth(new Date())}>
              Today
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center h-96">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
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
                    const { dayEntries, leave, hours, mins } = getDayContent(day);
                    const isCurrentMonth = isSameMonth(day, currentMonth);
                    const isTodayDate = isToday(day);
                    const isFuture = day > new Date();
                    const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                    const hasBulkUpload = dayEntries.some(e => e.source === "bulk_upload");

                    return (
                      <div
                        key={day.toISOString()}
                        className={cn(
                          "min-h-24 p-2 rounded-lg border cursor-pointer transition-colors",
                          !isCurrentMonth && "opacity-50",
                          isTodayDate && "border-primary bg-primary/5",
                          leave && "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800",
                          isWeekend && !leave && "bg-muted/50",
                          isFuture && "opacity-50 cursor-not-allowed",
                          !isFuture && !leave && "hover:bg-muted/50"
                        )}
                        onClick={() => !isFuture && handleDayClick(day)}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className={cn(
                            "text-sm font-medium",
                            isTodayDate && "text-primary"
                          )}>
                            {format(day, "d")}
                          </span>
                          {hasBulkUpload && (
                            <Badge variant="outline" className="text-[10px] px-1 h-4">
                              Bulk
                            </Badge>
                          )}
                        </div>
                        
                        {leave ? (
                          <Badge variant="secondary" className="text-[10px] bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300">
                            {formatLeaveType(leave.leave_type)}
                          </Badge>
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
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Add Entry Dialog */}
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add Timesheet Entry</DialogTitle>
              <DialogDescription>
                {selectedDate && `Add entry for ${formatDisplayDate(format(selectedDate, "yyyy-MM-dd"))}`}
              </DialogDescription>
            </DialogHeader>
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
                <Label htmlFor="subtype">Subject / Details (Optional)</Label>
                <Input
                  id="subtype"
                  placeholder="e.g., Mathematics, Physics Lab"
                  value={activitySubtype}
                  onChange={(e) => setActivitySubtype(e.target.value)}
                />
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
                  onClick={() => handleSubmit("draft")}
                  disabled={submitting}
                >
                  Save Draft
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => handleSubmit("submitted")}
                  disabled={submitting}
                >
                  Submit
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
