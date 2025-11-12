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
import { Plus, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

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

  useEffect(() => {
    if (userWithRole?.role !== "faculty") {
      navigate("/dashboard");
    } else {
      loadEntries();
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
        description: "Failed to load entries",
        variant: "destructive",
      });
    } else {
      setEntries(data || []);
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

    const duration = calculateDuration(startTime, endTime);
    
    if (duration <= 0) {
      toast({
        title: "Invalid time",
        description: "End time must be after start time",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    const { error } = await supabase.from("timesheet_entries").insert({
      user_id: userWithRole.user.id,
      department_id: userWithRole.departmentId,
      entry_date: entryDate,
      start_time: startTime,
      end_time: endTime,
      duration_minutes: duration,
      activity_type: activityType,
      activity_subtype: activitySubtype || null,
      notes: notes || null,
      status,
    });

    setLoading(false);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to create entry",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: status === "draft" ? "Entry saved as draft" : "Entry submitted for approval",
      });
      setDialogOpen(false);
      resetForm();
      loadEntries();
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
        description: "Failed to delete entry",
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

  const formatMinutes = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">My Timesheet</h1>
            <p className="text-muted-foreground">Track and submit your working hours</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
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
