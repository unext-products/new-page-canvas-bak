import { useState, useEffect, useMemo } from "react";
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
import { CheckCircle, XCircle, Clock, Calendar, User, Filter, X, ClipboardCheck } from "lucide-react";
import { format } from "date-fns";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { approvalNotesSchema } from "@/lib/validation";
import { getUserErrorMessage } from "@/lib/errorHandler";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { PageSkeleton } from "@/components/PageSkeleton";

interface TimesheetEntry {
  id: string;
  user_id: string;
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
  
  // Bulk selection state
  const [selectedEntries, setSelectedEntries] = useState<Set<string>>(new Set());
  const [filterFaculty, setFilterFaculty] = useState<string | null>(null);
  const [filterActivity, setFilterActivity] = useState<string | null>(null);
  
  // Bulk action state
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkAction, setBulkAction] = useState<"approve" | "reject" | null>(null);
  const [bulkComment, setBulkComment] = useState("");
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  
  const { toast } = useToast();
  const navigate = useNavigate();

  // Allow manager and org_admin to access approvals
  const allowedApproverRoles = ["manager", "org_admin"];
  
  useEffect(() => {
    if (!authLoading && !allowedApproverRoles.includes(userWithRole?.role || "")) {
      navigate("/dashboard");
    }
  }, [authLoading, userWithRole, navigate]);

  useEffect(() => {
    if (allowedApproverRoles.includes(userWithRole?.role || "")) {
      fetchEntries();
    }
  }, [userWithRole]);
  const getOrgId = async (): Promise<string | null> => {
    const { data } = await supabase
      .from("user_roles")
      .select("organization_id")
      .eq("user_id", userWithRole!.user.id)
      .single();
    return data?.organization_id || null;
  };

  const fetchEntries = async () => {
    try {
      setLoading(true);
      
      let entriesData: any[] = [];
      
      if (userWithRole?.role === "manager" && userWithRole?.departmentId) {
        // Manager: fetch entries from members and program_managers in their department
        // First get user_ids of members and program_managers in the department
        const { data: deptUsers } = await supabase
          .from("user_roles")
          .select("user_id, role")
          .eq("department_id", userWithRole.departmentId)
          .in("role", ["faculty", "program_manager"]);
        
        const userIds = deptUsers?.map(u => u.user_id) || [];
        
        if (userIds.length > 0) {
          const { data, error } = await supabase
            .from("timesheet_entries")
            .select("id, entry_date, start_time, end_time, duration_minutes, activity_type, activity_subtype, notes, user_id")
            .in("user_id", userIds)
            .eq("status", "submitted")
            .order("entry_date", { ascending: false });
          
          if (error) throw error;
          entriesData = data || [];
        }
      } else if (userWithRole?.role === "org_admin") {
        // Org Admin: fetch entries from managers (HODs) in their organization
        const { data: orgDepts } = await supabase
          .from("departments")
          .select("id")
          .eq("organization_id", await getOrgId());
        
        const deptIds = orgDepts?.map(d => d.id) || [];
        
        if (deptIds.length > 0) {
          // Get HOD user_ids
          const { data: hodUsers } = await supabase
            .from("user_roles")
            .select("user_id")
            .in("department_id", deptIds)
            .eq("role", "hod");
          
          const hodUserIds = hodUsers?.map(u => u.user_id) || [];
          
          if (hodUserIds.length > 0) {
            const { data, error } = await supabase
              .from("timesheet_entries")
              .select("id, entry_date, start_time, end_time, duration_minutes, activity_type, activity_subtype, notes, user_id")
              .in("user_id", hodUserIds)
              .eq("status", "submitted")
              .order("entry_date", { ascending: false });
            
            if (error) throw error;
            entriesData = data || [];
          }
        }
      }

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

  // Get unique faculty list from entries
  const facultyList = useMemo(() => {
    const uniqueFaculty = new Map<string, { name: string; count: number }>();
    entries.forEach(entry => {
      const existing = uniqueFaculty.get(entry.user_id);
      if (existing) {
        existing.count++;
      } else {
        uniqueFaculty.set(entry.user_id, {
          name: entry.profiles.full_name,
          count: 1
        });
      }
    });
    return Array.from(uniqueFaculty.entries()).map(([userId, data]) => ({
      userId,
      ...data
    }));
  }, [entries]);

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

  // Filter entries based on selections
  const filteredEntries = useMemo(() => {
    return entries.filter(entry => {
      if (filterFaculty && entry.user_id !== filterFaculty) return false;
      if (filterActivity && entry.activity_type !== filterActivity) return false;
      return true;
    });
  }, [entries, filterFaculty, filterActivity]);

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
    const allIds = new Set(filteredEntries.map(e => e.id));
    setSelectedEntries(allIds);
  };

  const clearSelection = () => {
    setSelectedEntries(new Set());
  };

  const isAllSelected = selectedEntries.size === filteredEntries.length && filteredEntries.length > 0;

  // Clear filters
  const clearFilters = () => {
    setFilterFaculty(null);
    setFilterActivity(null);
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
          approver_id: userWithRole!.user.id,
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
            entries.length > 0 && (
              <Badge variant="secondary" className="text-base px-4 py-1.5">
                {entries.length} pending
              </Badge>
            )
          }
        />

        {entries.length === 0 ? (
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
                {/* Filters Row */}
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
                    
                    {(filterFaculty || filterActivity) && (
                      <Button variant="ghost" size="sm" onClick={clearFilters}>
                        <X className="h-4 w-4 mr-1" />
                        Clear Filters
                      </Button>
                    )}
                  </div>
                </div>

                {/* Filter Badges */}
                {(filterFaculty || filterActivity) && (
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
                  </div>
                )}

                {/* Selection Actions */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2 border-t">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={isAllSelected}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          selectAllEntries();
                        } else {
                          clearSelection();
                        }
                      }}
                    />
                    <span className="text-sm font-medium">
                      {selectedEntries.size > 0 ? (
                        <>Selected: {selectedEntries.size} {selectedEntries.size === 1 ? 'entry' : 'entries'}</>
                      ) : (
                        <>Select All ({filteredEntries.length})</>
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

            {/* Entries List */}
            {filteredEntries.length === 0 ? (
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
                {filteredEntries.map((entry) => (
                  <Card 
                    key={entry.id}
                    className={cn(
                      "relative transition-all duration-200",
                      selectedEntries.has(entry.id) && "border-primary bg-primary/5 shadow-md"
                    )}
                  >
                    <div className="absolute top-4 left-4 z-10">
                      <Checkbox
                        checked={selectedEntries.has(entry.id)}
                        onCheckedChange={() => toggleEntrySelection(entry.id)}
                      />
                    </div>
                    <CardHeader className="pl-12">
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
                    <CardContent className="space-y-4 pl-12">
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
          </>
        )}
      </div>

      {/* Single Entry Action Dialog */}
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
    </Layout>
  );
}
