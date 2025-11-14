import { useEffect, useState } from "react";
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
import { StatusBadge } from "@/components/StatusBadge";
import { Plus, Trash2, Calendar } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { timesheetEntrySchema } from "@/lib/validation";
import { getUserErrorMessage } from "@/lib/errorHandler";

type ActivityType = "class" | "quiz" | "invigilation" | "admin" | "other";

export default function Timesheet() {
  const { userWithRole } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [entries, setEntries] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Form state
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split("T")[0]);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [activityType, setActivityType] = useState<ActivityType>("class");
  const [activitySubtype, setActivitySubtype] = useState("");
  const [notes, setNotes] = useState("");

  // Leave marking state
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [leaveDate, setLeaveDate] = useState(new Date().toISOString().split("T")[0]);
  const [leaveType, setLeaveType] = useState<string>("sick_leave");
  const [leaveComments, setLeaveComments] = useState("");
  const [userLeaveDays, setUserLeaveDays] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (userWithRole?.role !== "faculty") {
      navigate("/dashboard");
    } else {
      loadEntries();
      loadLeaveDays();
    }
  }, [userWithRole, navigate]);

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

    const { data } = await supabase
      .from("leave_days")
      .select("leave_date")
      .eq("user_id", userWithRole.user.id);

    if (data) {
      setUserLeaveDays(new Set(data.map(d => d.leave_date)));
    }
  };

  const calculateDuration = (start: string, end: string) => {
    const [startHour, startMin] = start.split(":").map(Number);
    const [endHour, endMin] = end.split(":").map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    return endMinutes - startMinutes;
  };

  const handleSubmit = async (status: "draft" | "submitted") => {
    if (!userWithRole?.departmentId) {
      toast({
        title: "Error",
        description: "You must be assigned to a department first",
        variant: "destructive",
      });
      return;
    }

    // Check if the date is marked as leave
    if (userLeaveDays.has(entryDate)) {
      toast({
        title: "Cannot create entry",
        description: "You have marked yourself on leave on this date",
        variant: "destructive",
      });
      return;
    }

    try {
      // Validate form data
      const validatedData = timesheetEntrySchema.parse({
        entry_date: entryDate,
        start_time: startTime,
        end_time: endTime,
        activity_type: activityType,
        activity_subtype: activitySubtype,
        notes: notes,
      });

      const duration = calculateDuration(startTime, endTime);

      setLoading(true);

      const { error } = await supabase.from("timesheet_entries").insert({
        user_id: userWithRole.user.id,
        department_id: userWithRole.departmentId,
        entry_date: validatedData.entry_date,
        start_time: validatedData.start_time,
        end_time: validatedData.end_time,
        duration_minutes: duration,
        activity_type: validatedData.activity_type,
        activity_subtype: validatedData.activity_subtype || null,
        notes: validatedData.notes || null,
        status,
      });

      setLoading(false);

      if (error) throw error;

      toast({
        title: "Success",
        description: status === "draft" ? "Entry saved as draft" : "Entry submitted for approval",
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
      toast({ title: "Success", description: "Entry deleted" });
      loadEntries();
    }
  };

  const resetForm = () => {
    setEntryDate(new Date().toISOString().split("T")[0]);
    setStartTime("09:00");
    setEndTime("10:00");
    setActivityType("class");
    setActivitySubtype("");
    setNotes("");
  };

  const handleMarkLeave = async () => {
    if (!userWithRole?.departmentId) {
      toast({
        title: "Error",
        description: "You must be assigned to a department first",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    const { error } = await supabase.from("leave_days").insert([{
      user_id: userWithRole.user.id,
      department_id: userWithRole.departmentId,
      leave_date: leaveDate,
      leave_type: leaveType as "sick_leave" | "casual_leave" | "vacation" | "personal" | "compensatory" | "other",
      comments: leaveComments || null,
    }]);

    setLoading(false);

    if (error) {
      toast({
        title: "Error",
        description: getUserErrorMessage(error, "mark leave"),
        variant: "destructive",
      });
    } else {
      toast({ title: "Leave marked successfully" });
      setLeaveDialogOpen(false);
      setLeaveDate(new Date().toISOString().split("T")[0]);
      setLeaveType("sick_leave");
      setLeaveComments("");
      loadLeaveDays();
    }
  };

  const formatMinutes = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">My Timesheet</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Track and submit your working hours
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Dialog open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full sm:w-auto">
                  <Calendar className="mr-2 h-4 w-4" />
                  Mark Leave
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Mark Leave</DialogTitle>
                  <DialogDescription>
                    Mark a day when you'll be on leave
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
                    <Select value={leaveType} onValueChange={setLeaveType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sick_leave">Sick Leave</SelectItem>
                        <SelectItem value="casual_leave">Casual Leave</SelectItem>
                        <SelectItem value="vacation">Vacation</SelectItem>
                        <SelectItem value="personal">Personal</SelectItem>
                        <SelectItem value="compensatory">Compensatory Leave</SelectItem>
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
                      placeholder="Reason for leave..."
                      rows={3}
                    />
                  </div>
                  <Button onClick={handleMarkLeave} disabled={loading} className="w-full">
                    Mark Leave
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="w-full sm:w-auto">
                  <Plus className="mr-2 h-4 w-4" />
                  New Entry
                </Button>
              </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Add Timesheet Entry</DialogTitle>
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
                  <Select value={activityType} onValueChange={(value: ActivityType) => setActivityType(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="class">Class</SelectItem>
                      <SelectItem value="quiz">Quiz</SelectItem>
                      <SelectItem value="invigilation">Invigilation</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
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
                    disabled={loading}
                  >
                    Save Draft
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

        <Card>
          <CardHeader>
            <CardTitle>All Entries</CardTitle>
            <CardDescription>Your timesheet history</CardDescription>
          </CardHeader>
          <CardContent>
            {entries.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">
                No entries yet. Click "New Entry" to get started.
              </p>
            ) : (
              <div className="space-y-4">
                {entries.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between border rounded-lg p-4"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <p className="font-medium">
                          {new Date(entry.entry_date).toLocaleDateString()}
                        </p>
                        <StatusBadge status={entry.status} />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {entry.activity_type.charAt(0).toUpperCase() + entry.activity_type.slice(1)}
                        {entry.activity_subtype && ` • ${entry.activity_subtype}`}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {entry.start_time} - {entry.end_time} ({formatMinutes(entry.duration_minutes)})
                      </p>
                      {entry.notes && (
                        <p className="text-sm text-muted-foreground mt-1">{entry.notes}</p>
                      )}
                      {entry.approver_notes && (
                        <p className="text-sm text-destructive mt-1">
                          Note: {entry.approver_notes}
                        </p>
                      )}
                    </div>
                    {entry.status === "draft" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(entry.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
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
