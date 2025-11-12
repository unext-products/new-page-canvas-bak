import { useState, useEffect } from "react";
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
import { CheckCircle, XCircle, Clock, Calendar, User } from "lucide-react";
import { format } from "date-fns";

interface TimesheetEntry {
  id: string;
  entry_date: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  activity_type: string;
  activity_subtype: string | null;
  notes: string | null;
  profiles: {
    full_name: string;
    avatar_url: string | null;
  };
}

export default function Approvals() {
  const { userWithRole, loading: authLoading } = useAuth();
  const [entries, setEntries] = useState<TimesheetEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<TimesheetEntry | null>(null);
  const [actionType, setActionType] = useState<"approve" | "reject" | null>(null);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && userWithRole?.role !== "hod") {
      navigate("/dashboard");
    }
  }, [authLoading, userWithRole, navigate]);

  useEffect(() => {
    if (userWithRole?.role === "hod" && userWithRole?.departmentId) {
      fetchEntries();
    }
  }, [userWithRole]);

  const fetchEntries = async () => {
    try {
      setLoading(true);
      const { data: entriesData, error: entriesError } = await supabase
        .from("timesheet_entries")
        .select("id, entry_date, start_time, end_time, duration_minutes, activity_type, activity_subtype, notes, user_id")
        .eq("department_id", userWithRole!.departmentId)
        .eq("status", "submitted")
        .order("entry_date", { ascending: false });

      if (entriesError) throw entriesError;

      // Fetch profiles for all users
      const userIds = [...new Set(entriesData?.map(e => e.user_id) || [])];
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", userIds);

      if (profilesError) throw profilesError;

      // Create a map of user profiles
      const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);

      // Merge entries with profiles
      const entriesWithProfiles = entriesData?.map(entry => ({
        ...entry,
        profiles: profilesMap.get(entry.user_id) || { full_name: "Unknown", avatar_url: null }
      })) || [];

      setEntries(entriesWithProfiles as TimesheetEntry[]);
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
  };

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
          approver_id: userWithRole!.user.id,
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

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(":");
    const date = new Date();
    date.setHours(parseInt(hours), parseInt(minutes));
    return format(date, "h:mm a");
  };

  if (authLoading || loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Pending Approvals</h1>
            <p className="text-muted-foreground mt-1">
              Review and approve timesheet entries from your team
            </p>
          </div>
          {entries.length > 0 && (
            <Badge variant="secondary" className="text-lg px-4 py-2">
              {entries.length} pending
            </Badge>
          )}
        </div>

        {entries.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <CheckCircle className="h-12 w-12 text-success mb-4" />
              <h3 className="text-lg font-semibold mb-2">All caught up!</h3>
              <p className="text-muted-foreground text-center">
                No pending approvals at the moment. All timesheets have been reviewed.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {entries.map((entry) => (
              <Card key={entry.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarImage src={entry.profiles.avatar_url || undefined} />
                        <AvatarFallback>
                          {entry.profiles.full_name.split(" ").map(n => n[0]).join("")}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <CardTitle className="text-base">{entry.profiles.full_name}</CardTitle>
                        <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(entry.entry_date), "EEEE, MMM d, yyyy")}
                        </div>
                      </div>
                    </div>
                    <Badge variant="outline" className="bg-warning/10 text-warning-foreground border-warning/20">
                      Pending Review
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">Activity</div>
                      <div className="font-medium capitalize">
                        {entry.activity_type.replace(/_/g, " ")}
                        {entry.activity_subtype && (
                          <span className="text-muted-foreground"> • {entry.activity_subtype}</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">Time</div>
                      <div className="font-medium flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {formatTime(entry.start_time)} - {formatTime(entry.end_time)}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">Duration</div>
                      <div className="font-medium">
                        {Math.floor(entry.duration_minutes / 60)}h {entry.duration_minutes % 60}m
                      </div>
                    </div>
                  </div>

                  {entry.notes && (
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">Notes</div>
                      <p className="text-sm bg-muted/50 rounded-md p-3">{entry.notes}</p>
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    <Button
                      onClick={() => handleAction(entry, "approve")}
                      className="flex-1"
                      variant="default"
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Approve
                    </Button>
                    <Button
                      onClick={() => handleAction(entry, "reject")}
                      className="flex-1"
                      variant="destructive"
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Reject
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === "approve" ? "Approve" : "Reject"} Entry
            </DialogTitle>
            <DialogDescription>
              {selectedEntry && (
                <div className="space-y-2 pt-2">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    <span className="font-medium">{selectedEntry.profiles.full_name}</span>
                  </div>
                  <div className="text-sm">
                    {format(new Date(selectedEntry.entry_date), "MMMM d, yyyy")} • 
                    {formatTime(selectedEntry.start_time)} - {formatTime(selectedEntry.end_time)}
                  </div>
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
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting || (actionType === "reject" && !comment.trim())}
              variant={actionType === "approve" ? "default" : "destructive"}
            >
              {submitting ? "Processing..." : actionType === "approve" ? "Approve" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
