import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Download, Filter, ChevronDown } from "lucide-react";
import { DateRangePicker } from "@/components/DateRangePicker";
import { DepartmentSelect } from "@/components/DepartmentSelect";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/StatusBadge";
import { exportToCSVWithMetadata, formatDuration } from "@/lib/exportUtils";
import { exportToPDF } from "@/lib/pdfExportUtils";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks, subMonths } from "date-fns";

interface TimesheetEntry {
  id: string;
  entry_date: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  activity_type: string;
  activity_subtype: string | null;
  status: "draft" | "submitted" | "approved" | "rejected";
  notes: string | null;
  faculty_name: string;
  department_name: string;
  approver_name: string | null;
}

interface FilterState {
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
  department: string;
  status: string;
  activityType: string;
}

export default function Reports() {
  const { userWithRole, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [entries, setEntries] = useState<TimesheetEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    dateFrom: undefined,
    dateTo: undefined,
    department: "all",
    status: "all",
    activityType: "all",
  });

  useEffect(() => {
    if (!loading && (!userWithRole || userWithRole.role !== "admin")) {
      navigate("/dashboard");
    }
  }, [userWithRole, loading, navigate]);

  const fetchReportData = async () => {
    try {
      setIsLoading(true);

      let query = supabase
        .from("timesheet_entries")
        .select("*")
        .order("entry_date", { ascending: false });

      if (filters.dateFrom) {
        query = query.gte("entry_date", format(filters.dateFrom, "yyyy-MM-dd"));
      }
      if (filters.dateTo) {
        query = query.lte("entry_date", format(filters.dateTo, "yyyy-MM-dd"));
      }
      if (filters.department !== "all") {
        query = query.eq("department_id", filters.department);
      }
      if (filters.status !== "all") {
        query = query.eq("status", filters.status as any);
      }
      if (filters.activityType !== "all") {
        query = query.eq("activity_type", filters.activityType as any);
      }

      const { data: entriesData, error: entriesError } = await query;

      if (entriesError) throw entriesError;

      // Fetch related data
      const userIds = Array.from(new Set(entriesData?.map(e => e.user_id) || []));
      const deptIds = Array.from(new Set(entriesData?.map(e => e.department_id) || []));
      const approverIds = Array.from(new Set(entriesData?.map(e => e.approver_id).filter(Boolean) || []));

      const [profilesData, deptsData] = await Promise.all([
        supabase.from("profiles").select("id, full_name").in("id", [...userIds, ...approverIds]),
        supabase.from("departments").select("id, name").in("id", deptIds),
      ]);

      const profilesMap = new Map(profilesData.data?.map(p => [p.id, p.full_name]) || []);
      const deptsMap = new Map(deptsData.data?.map(d => [d.id, d.name]) || []);

      const enrichedEntries = entriesData?.map(entry => ({
        ...entry,
        faculty_name: profilesMap.get(entry.user_id) || "Unknown",
        department_name: deptsMap.get(entry.department_id) || "Unknown",
        approver_name: entry.approver_id ? profilesMap.get(entry.approver_id) || null : null,
      })) || [];

      setEntries(enrichedEntries);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (userWithRole?.role === "admin") {
      fetchReportData();
    }
  }, [userWithRole]);

  const handleExport = () => {
    const reportPeriod = filters.dateFrom && filters.dateTo
      ? `${format(filters.dateFrom, "MMM dd, yyyy")} - ${format(filters.dateTo, "MMM dd, yyyy")}`
      : "All Time";

    const csvData = entries.map(entry => ({
      ...entry,
      profiles: { full_name: entry.faculty_name },
      departments: { name: entry.department_name },
    }));

    exportToCSVWithMetadata(csvData, "timesheet_report", {
      reportPeriod,
      generatedBy: userWithRole?.profile?.full_name || "Admin",
      totalHours: entries.reduce((sum, entry) => sum + entry.duration_minutes, 0),
      totalEntries: entries.length,
    });
  };

  const handleExportPDF = () => {
    const reportPeriod = filters.dateFrom && filters.dateTo
      ? `${format(filters.dateFrom, "MMM dd, yyyy")} - ${format(filters.dateTo, "MMM dd, yyyy")}`
      : "All Time";

    exportToPDF(entries.map(entry => ({
      ...entry,
      profiles: { full_name: entry.faculty_name },
      departments: { name: entry.department_name },
    })), "timesheet_report", {
      reportPeriod,
      generatedBy: userWithRole?.profile?.full_name || "Admin",
      totalHours: entries.reduce((sum, entry) => sum + entry.duration_minutes, 0),
      approvedHours: entries.filter(e => e.status === "approved").reduce((sum, entry) => sum + entry.duration_minutes, 0),
      pendingCount,
    });
  };

  const applyPreset = (preset: string) => {
    const now = new Date();
    let dateFrom: Date;
    let dateTo: Date;

    switch (preset) {
      case "today":
        dateFrom = now;
        dateTo = now;
        break;
      case "thisWeek":
        dateFrom = startOfWeek(now, { weekStartsOn: 1 });
        dateTo = endOfWeek(now, { weekStartsOn: 1 });
        break;
      case "lastWeek":
        dateFrom = subWeeks(startOfWeek(now, { weekStartsOn: 1 }), 1);
        dateTo = endOfWeek(dateFrom, { weekStartsOn: 1 });
        break;
      case "thisMonth":
        dateFrom = startOfMonth(now);
        dateTo = endOfMonth(now);
        break;
      case "lastMonth":
        const lastMonth = subMonths(now, 1);
        dateFrom = startOfMonth(lastMonth);
        dateTo = endOfMonth(lastMonth);
        break;
      default:
        return;
    }

    setFilters({ ...filters, dateFrom, dateTo });
  };

  const totalHours = entries.reduce((sum, entry) => sum + entry.duration_minutes, 0) / 60;
  const approvedHours = entries
    .filter(e => e.status === "approved")
    .reduce((sum, entry) => sum + entry.duration_minutes, 0) / 60;
  const pendingCount = entries.filter(e => e.status === "submitted").length;

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto py-8 px-4">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">Reports & Export</h1>
            <p className="text-muted-foreground">Generate and export timesheet reports</p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button disabled={entries.length === 0}>
                <Download className="mr-2 h-4 w-4" />
                Export
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={handleExport}>
                Export to CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportPDF}>
                Export to PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Report Period Presets */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Quick Report Periods</CardTitle>
            <CardDescription>Select a preset time period for your report</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              <Button variant="outline" onClick={() => applyPreset("today")}>Today</Button>
              <Button variant="outline" onClick={() => applyPreset("thisWeek")}>This Week</Button>
              <Button variant="outline" onClick={() => applyPreset("lastWeek")}>Last Week</Button>
              <Button variant="outline" onClick={() => applyPreset("thisMonth")}>This Month</Button>
              <Button variant="outline" onClick={() => applyPreset("lastMonth")}>Last Month</Button>
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Entries</CardDescription>
              <CardTitle className="text-3xl">{entries.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Hours</CardDescription>
              <CardTitle className="text-3xl">{totalHours.toFixed(1)}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Approved Hours</CardDescription>
              <CardTitle className="text-3xl">{approvedHours.toFixed(1)}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Pending Approvals</CardDescription>
              <CardTitle className="text-3xl">{pendingCount}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div>
                <Label>Date From</Label>
                <DateRangePicker
                  date={filters.dateFrom}
                  onDateChange={(date) => setFilters({ ...filters, dateFrom: date })}
                />
              </div>
              <div>
                <Label>Date To</Label>
                <DateRangePicker
                  date={filters.dateTo}
                  onDateChange={(date) => setFilters({ ...filters, dateTo: date })}
                />
              </div>
              <div>
                <Label>Department</Label>
                <DepartmentSelect
                  value={filters.department}
                  onValueChange={(value) => setFilters({ ...filters, department: value })}
                  includeAll
                />
              </div>
              <div>
                <Label>Status</Label>
                <Select
                  value={filters.status}
                  onValueChange={(value) => setFilters({ ...filters, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="submitted">Submitted</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Activity Type</Label>
                <Select
                  value={filters.activityType}
                  onValueChange={(value) => setFilters({ ...filters, activityType: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="class">Class</SelectItem>
                    <SelectItem value="quiz">Quiz</SelectItem>
                    <SelectItem value="invigilation">Invigilation</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="mt-4">
              <Button onClick={fetchReportData} disabled={isLoading}>
                Apply Filters
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Report Table */}
        <Card>
          <CardHeader>
            <CardTitle>Detailed Report</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : entries.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No entries found matching the filters
              </div>
            ) : (
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Faculty</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Activity</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>{format(new Date(entry.entry_date), "MMM dd, yyyy")}</TableCell>
                        <TableCell className="font-medium">{entry.faculty_name}</TableCell>
                        <TableCell>{entry.department_name}</TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium capitalize">{entry.activity_type}</div>
                            {entry.activity_subtype && (
                              <div className="text-sm text-muted-foreground">{entry.activity_subtype}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {entry.start_time} - {entry.end_time}
                        </TableCell>
                        <TableCell>{formatDuration(entry.duration_minutes)}</TableCell>
                        <TableCell>
                          <StatusBadge status={entry.status} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
