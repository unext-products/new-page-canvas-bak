import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { isRole } from "@/lib/roleMapping";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Download, Filter, ChevronDown, ChevronLeft, ChevronRight, BarChart3, ArrowUpDown } from "lucide-react";
import { DateRangePicker } from "@/components/DateRangePicker";
import { DepartmentSelect } from "@/components/DepartmentSelect";
import { MemberSelect } from "@/components/MemberSelect";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/StatusBadge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ReportTypeToggle } from "@/components/reports/ReportTypeToggle";
import { ReportPeriodSelector, PeriodType } from "@/components/reports/ReportPeriodSelector";
import { ActivityBreakdownChart } from "@/components/reports/ActivityBreakdownChart";
import { CompletionMetricsCard } from "@/components/reports/CompletionMetricsCard";
import { ExpectedHoursBreakdownTable } from "@/components/reports/ExpectedHoursBreakdownTable";
import { ReportSummaryCards } from "@/components/reports/ReportSummaryCards";
import { MemberCalendar } from "@/components/reports/MemberCalendar";
import { DepartmentCalendar } from "@/components/reports/DepartmentCalendar";
import { PageHeader } from "@/components/PageHeader";
import { PageSkeleton } from "@/components/PageSkeleton";
import { 
  fetchFacultyReport,
  fetchAllMembersReport,
  fetchDepartmentReport, 
  ReportPeriod,
  FacultyReportData,
  DepartmentReportData,
  groupEntriesByPeriod
} from "@/lib/reportQueries";
import { exportMemberReportCSV, exportDepartmentReportCSV } from "@/lib/exportUtils";
import { exportMemberReportPDF, exportDepartmentReportPDF } from "@/lib/pdfExportUtils";
import { formatDuration } from "@/lib/exportUtils";
import { calculateDurationMinutes } from "@/lib/timesheetUtils";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, startOfDay, endOfDay } from "date-fns";
import { getUserErrorMessage } from "@/lib/errorHandler";

type ReportViewType = "member" | "department";

export default function Reports() {
  const { userWithRole, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [reportType, setReportType] = useState<ReportViewType>("member");
  const [period, setPeriod] = useState<PeriodType>("monthly");
  const [dateFrom, setDateFrom] = useState<Date>(startOfMonth(new Date()));
  const [dateTo, setDateTo] = useState<Date>(endOfMonth(new Date()));
  const [selectedFaculty, setSelectedFaculty] = useState<string>("all");
  const [selectedDepartment, setSelectedDepartment] = useState<string>("all");
  
  // Organization filter for Super Admin
  const [selectedOrg, setSelectedOrg] = useState<string>("all");
  const [organizations, setOrganizations] = useState<{ id: string; name: string; code: string }[]>([]);
  
  const [facultyReport, setFacultyReport] = useState<FacultyReportData | null>(null);
  const [departmentReport, setDepartmentReport] = useState<DepartmentReportData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  // Calendar view state
  const [viewMode, setViewMode] = useState<"table" | "calendar">("table");
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());

  // Sort state for department view
  const [facultySortKey, setFacultySortKey] = useState<string>("name");
  const [facultySortAsc, setFacultySortAsc] = useState(true);
  const [nonStarterSortKey, setNonStarterSortKey] = useState<string>("name");
  const [nonStarterSortAsc, setNonStarterSortAsc] = useState(true);

  // HOD department filter
  const [hodDepartmentIds, setHodDepartmentIds] = useState<string[]>([]);

  const isSuperAdmin = isRole(userWithRole?.role, "super_admin");
  const isHod = isRole(userWithRole?.role, "l3", "l2", "manager", "program_manager");
  const hasReportsAccess = isRole(userWithRole?.role, "admin", "org_admin", "super_admin", "l3", "l2", "manager", "program_manager");

  // Fetch organizations for Super Admin
  useEffect(() => {
    const fetchOrganizations = async () => {
      if (!isSuperAdmin) return;
      
      const { data } = await supabase
        .from("organizations")
        .select("id, name, code")
        .order("name");
      
      setOrganizations(data || []);
      
      // Set default org if only one available
      if (data && data.length === 1) {
        setSelectedOrg(data[0].id);
      }
    };
    
    fetchOrganizations();
  }, [isSuperAdmin]);

  // Fetch HOD's vertical IDs (from user_verticals, fallback to user_departments)
  useEffect(() => {
    const fetchHodVerticals = async () => {
      if (!userWithRole?.user?.id || !isHod) return;
      
      try {
        // Get from user_verticals first (new hierarchy)
        const { data: userVerts } = await supabase
          .from("user_verticals")
          .select("vertical_id")
          .eq("user_id", userWithRole.user.id);
        
        const vertIds = new Set<string>();
        userVerts?.forEach(uv => uv.vertical_id && vertIds.add(uv.vertical_id));
        
        // Fallback to user_departments if no user_verticals entries
        if (vertIds.size === 0) {
          const { data: userDepts } = await supabase
            .from("user_departments")
            .select("department_id")
            .eq("user_id", userWithRole.user.id);
          
          userDepts?.forEach(ud => ud.department_id && vertIds.add(ud.department_id));
          
          // Also get from user_roles as fallback
          const { data: roleData } = await supabase
            .from("user_roles")
            .select("department_id")
            .eq("user_id", userWithRole.user.id)
            .maybeSingle();
          
          if (roleData?.department_id) vertIds.add(roleData.department_id);
        }
        
        const vertIdsArray = Array.from(vertIds);
        setHodDepartmentIds(vertIdsArray);
        
        // Set default vertical for HOD if only one
        if (vertIdsArray.length === 1) {
          setSelectedDepartment(vertIdsArray[0]);
        }
      } catch (error) {
        console.error("Error fetching HOD verticals:", error);
      }
    };

    fetchHodVerticals();
  }, [userWithRole?.user?.id, isHod]);

  useEffect(() => {
    if (!loading && (!userWithRole || !hasReportsAccess)) {
      navigate("/dashboard");
    }
  }, [userWithRole, loading, navigate, hasReportsAccess]);

  // Auto-update date range when period changes
  useEffect(() => {
    const now = new Date();
    
    switch (period) {
      case "daily":
        setDateFrom(startOfDay(now));
        setDateTo(endOfDay(now));
        break;
      case "weekly":
        setDateFrom(startOfWeek(now, { weekStartsOn: 1 })); // Monday
        setDateTo(endOfWeek(now, { weekStartsOn: 1 })); // Sunday
        break;
      case "monthly":
        setDateFrom(startOfMonth(now));
        setDateTo(endOfMonth(now));
        break;
    }
  }, [period]);

  // Sync Date To with Date From when in daily mode
  useEffect(() => {
    if (period === "daily") {
      setDateTo(endOfDay(dateFrom));
    }
  }, [dateFrom, period]);

  const handleDateRangeChange = (from: Date, to: Date) => {
    setDateFrom(from);
    setDateTo(to);
  };

  const generateReport = async () => {
    try {
      setIsLoading(true);
      setFacultyReport(null);
      setDepartmentReport(null);

      const reportPeriod: ReportPeriod = {
        type: period,
        dateFrom,
        dateTo,
      };

      if (reportType === "member") {
        if (selectedFaculty === "all") {
          // For non-admin roles, scope "All Members" to users in their verticals
          let scopeUserIds: string[] | undefined;
          const isAdmin = isRole(userWithRole?.role, "admin", "org_admin", "super_admin");
          if (!isAdmin && hodDepartmentIds.length > 0) {
            const { data: vertUsers } = await supabase
              .from("user_verticals")
              .select("user_id")
              .in("vertical_id", hodDepartmentIds);
            scopeUserIds = [...new Set(vertUsers?.map(u => u.user_id) || [])];
          }
          const report = await fetchAllMembersReport(reportPeriod, scopeUserIds);
          setFacultyReport(report);
        } else {
          const report = await fetchFacultyReport(selectedFaculty, reportPeriod);
          setFacultyReport(report);
        }
      } else {
        const report = await fetchDepartmentReport(selectedDepartment, reportPeriod);
        setDepartmentReport(report);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: getUserErrorMessage(error, "generate report"),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = () => {
    setHasSubmitted(true);
    generateReport();
  };

  const handleExportCSV = () => {
    const reportPeriod = `${format(dateFrom, "MMM dd, yyyy")} - ${format(dateTo, "MMM dd, yyyy")}`;
    const generatedBy = userWithRole?.profile?.full_name || "Admin";

    if (reportType === "member" && facultyReport) {
      exportMemberReportCSV(facultyReport, reportPeriod, generatedBy, period);
    } else if (reportType === "department" && departmentReport) {
      exportDepartmentReportCSV(departmentReport, reportPeriod, generatedBy, period);
    }
  };

  const handleExportPDF = () => {
    const reportPeriod = `${format(dateFrom, "MMM dd, yyyy")} - ${format(dateTo, "MMM dd, yyyy")}`;
    const generatedBy = userWithRole?.profile?.full_name || "Admin";

    if (reportType === "member" && facultyReport) {
      exportMemberReportPDF(facultyReport, reportPeriod, generatedBy, period);
    } else if (reportType === "department" && departmentReport) {
      exportDepartmentReportPDF(departmentReport, reportPeriod, generatedBy, period);
    }
  };

  const currentReport = reportType === "member" ? facultyReport : departmentReport;
  const hasData = currentReport && (
    reportType === "member" 
      ? facultyReport?.entries.length > 0 
      : (departmentReport?.facultyBreakdown.length > 0 || (departmentReport?.nonStarters?.length ?? 0) > 0)
  );

  if (loading) {
    return (
      <Layout>
        <PageSkeleton type="dashboard" />
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <PageHeader
          title="Reports & Analytics"
          description="Comprehensive faculty and department reporting"
          icon={BarChart3}
          actions={
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button disabled={!hasData}>
                  <Download className="mr-2 h-4 w-4" />
                  Export
                  <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="z-[100] bg-popover" sideOffset={8}>
                <DropdownMenuItem onClick={handleExportCSV} className="cursor-pointer">Export to CSV</DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportPDF} className="cursor-pointer">Export to PDF</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          }
        />

        {/* Report Type Toggle */}
        <Card>
          <CardHeader>
            <CardTitle>Report Type</CardTitle>
            <CardDescription>Select the type of report you want to generate</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Organization selector for Super Admin */}
            {isSuperAdmin && (
              <div className="mb-4">
                <Label className="mb-2 block">Organization</Label>
                <Select value={selectedOrg} onValueChange={setSelectedOrg}>
                  <SelectTrigger className="w-full max-w-xs">
                    <SelectValue placeholder="Select organization" />
                  </SelectTrigger>
                  <SelectContent>
                    {organizations.map(org => (
                      <SelectItem key={org.id} value={org.id}>
                        {org.name} ({org.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedOrg === "all" && (
                  <p className="text-sm text-muted-foreground mt-1">Please select an organization to view reports</p>
                )}
              </div>
            )}
            <ReportTypeToggle value={reportType} onValueChange={setReportType} />
          </CardContent>
        </Card>

        {/* Period and Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filters & Period
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ReportPeriodSelector
              period={period}
              onPeriodChange={setPeriod}
              onDateRangeChange={handleDateRangeChange}
            />

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div>
                <Label>Date From</Label>
                <DateRangePicker
                  date={dateFrom}
                  onDateChange={(date) => date && setDateFrom(date)}
                />
              </div>
              <div>
                <Label>Date To</Label>
                <DateRangePicker
                  date={dateTo}
                  onDateChange={(date) => date && setDateTo(date)}
                  disabled={period === "daily"}
                />
              </div>
              {reportType === "member" ? (
                <div>
                  <Label>Team Member</Label>
                  <MemberSelect
                    value={selectedFaculty}
                    onValueChange={setSelectedFaculty}
                    includeAll={true}
                    departmentIds={isHod ? hodDepartmentIds : undefined}
                    includeInactive={true}
                  />
                </div>
              ) : (
                <div>
                  <Label>Department</Label>
                  <DepartmentSelect
                    value={selectedDepartment}
                    onValueChange={setSelectedDepartment}
                    includeAll={!isHod || hodDepartmentIds.length > 1}
                    departmentIds={isHod ? hodDepartmentIds : undefined}
                  />
                </div>
              )}
              <div>
                <Button onClick={handleSubmit} disabled={isLoading} className="w-full">
                  {isLoading ? "Loading..." : "Submit"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {!hasSubmitted ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Filter className="h-10 w-10 mb-3 opacity-40" />
              <p className="text-lg font-medium">Select your filters and click Submit</p>
              <p className="text-sm">Choose the date range, period, and member/department to generate a report</p>
            </CardContent>
          </Card>
        ) : isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : currentReport ? (
          <>
            {/* Summary Cards */}
            <ReportSummaryCards
              totalHours={currentReport.totalHours}
              expectedHours={currentReport.expectedHours}
              completionRate={currentReport.completionRate}
              totalEntries={
                reportType === "member"
                  ? facultyReport?.entries.length || 0
                  : departmentReport?.facultyBreakdown.reduce((sum, f) => sum + f.entryCount, 0) || 0
              }
              approvedCount={
                reportType === "member"
                  ? facultyReport?.approvedCount
                  : departmentReport?.facultyBreakdown.reduce((sum, f) => sum + f.approvedCount, 0)
              }
              pendingCount={
                reportType === "member"
                  ? facultyReport?.pendingCount
                  : departmentReport?.facultyBreakdown.reduce((sum, f) => sum + f.pendingCount, 0)
              }
              averageDailyHours={currentReport.averageDailyHours}
              expectedHoursBreakdown={reportType === "member" ? facultyReport?.expectedHoursBreakdown : departmentReport?.expectedHoursBreakdown}
            />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Completion Metrics */}
              <CompletionMetricsCard
                actualHours={currentReport.totalHours}
                expectedHours={currentReport.expectedHours}
                completionRate={currentReport.completionRate}
                period={period}
                expectedHoursBreakdown={reportType === "member" ? facultyReport?.expectedHoursBreakdown : departmentReport?.expectedHoursBreakdown}
                isDepartmentView={reportType === "department"}
                totalFaculty={reportType === "department" ? departmentReport?.totalFaculty : undefined}
              />

              {/* Activity Breakdown */}
              <ActivityBreakdownChart data={currentReport.activityBreakdown} />
            </div>

            {/* Expected Hours Breakdown Table - Department View */}
            {reportType === "department" && departmentReport && (
              <ExpectedHoursBreakdownTable
                facultyBreakdown={departmentReport.facultyBreakdown}
                totalDays={departmentReport.expectedHoursBreakdown?.totalDays ?? 0}
                holidayDays={departmentReport.expectedHoursBreakdown?.holidayDays ?? 0}
              />
            )}

            {/* Detailed Entry Table - Member View */}
            {reportType === "member" && facultyReport && (
              <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "table" | "calendar")}>
                <TabsList className="grid w-full grid-cols-2 mb-4">
                  <TabsTrigger value="table">Table View</TabsTrigger>
                  <TabsTrigger value="calendar">Calendar View</TabsTrigger>
                </TabsList>

                <TabsContent value="table">
                  <Card>
                    <CardHeader>
                      <CardTitle>Detailed Timesheet Entries</CardTitle>
                      <CardDescription>
                        All entries for {facultyReport.facultyName}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {facultyReport.entries.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          No timesheet entries found for the selected period
                        </div>
                      ) : (
                        <div className="border rounded-lg">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                {selectedFaculty === "all" && <TableHead>Member</TableHead>}
                                <TableHead>Date</TableHead>
                                <TableHead>Program</TableHead>
                                <TableHead>Vertical</TableHead>
                                <TableHead>Activity</TableHead>
                                <TableHead>Time</TableHead>
                                <TableHead>Duration</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Approved By</TableHead>
                                <TableHead>Notes</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {facultyReport.entries.map((entry) => (
                                <TableRow key={entry.id}>
                                  {selectedFaculty === "all" && (
                                    <TableCell className="font-medium text-sm">{entry._facultyName || "Unknown"}</TableCell>
                                  )}
                                  <TableCell>{format(new Date(entry.entry_date), "MMM dd, yyyy")}</TableCell>
                                  <TableCell className="text-sm">{entry._programName || "N/A"}</TableCell>
                                  <TableCell className="text-sm">{entry._verticalName || "N/A"}</TableCell>
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
                                  <TableCell>{formatDuration(calculateDurationMinutes(entry.start_time, entry.end_time))}</TableCell>
                                  <TableCell>
                                    <StatusBadge status={entry.status} />
                                  </TableCell>
                                  <TableCell className="text-sm">
                                    {entry._approvedByName || "-"}
                                  </TableCell>
                                  <TableCell className="max-w-xs truncate">
                                    {entry.notes || "-"}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="calendar" className="space-y-4">
                  {selectedFaculty === "all" ? (
                    <Card>
                      <CardContent className="py-12 text-center text-muted-foreground">
                        Please select a specific faculty member to view calendar
                      </CardContent>
                    </Card>
                  ) : (
                    <>
                      <div className="flex items-center justify-between">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1))}
                        >
                          <ChevronLeft className="h-4 w-4 mr-1" />
                          Previous
                        </Button>
                        <h3 className="text-lg font-semibold">
                          {format(calendarMonth, "MMMM yyyy")}
                        </h3>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1))}
                        >
                          Next
                          <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </div>

                      <MemberCalendar
                        memberId={selectedFaculty}
                        month={calendarMonth}
                      />
                    </>
                  )}
                </TabsContent>
              </Tabs>
            )}

            {/* Department Faculty Breakdown with Calendar */}
            {reportType === "department" && departmentReport && (
              <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "table" | "calendar")}>
                <TabsList className="grid w-full grid-cols-2 mb-4">
                  <TabsTrigger value="table">Table View</TabsTrigger>
                  <TabsTrigger value="calendar">Calendar View</TabsTrigger>
                </TabsList>

                <TabsContent value="table" className="space-y-6">
                  {/* Non-Starters Section */}
                  {departmentReport.nonStarters && departmentReport.nonStarters.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-destructive">Non-Starters</CardTitle>
                        <CardDescription>
                          {departmentReport.nonStarters.length} member(s) with no timesheet entries in this period
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="border rounded-lg">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="cursor-pointer select-none" onClick={() => { if (nonStarterSortKey === "name") setNonStarterSortAsc(!nonStarterSortAsc); else { setNonStarterSortKey("name"); setNonStarterSortAsc(true); } }}>
                                  <div className="flex items-center gap-1">Faculty Name <ArrowUpDown className="h-3 w-3" /></div>
                                </TableHead>
                                <TableHead className="cursor-pointer select-none" onClick={() => { if (nonStarterSortKey === "email") setNonStarterSortAsc(!nonStarterSortAsc); else { setNonStarterSortKey("email"); setNonStarterSortAsc(true); } }}>
                                  <div className="flex items-center gap-1">Email <ArrowUpDown className="h-3 w-3" /></div>
                                </TableHead>
                                <TableHead className="cursor-pointer select-none" onClick={() => { if (nonStarterSortKey === "vertical") setNonStarterSortAsc(!nonStarterSortAsc); else { setNonStarterSortKey("vertical"); setNonStarterSortAsc(true); } }}>
                                  <div className="flex items-center gap-1">Vertical <ArrowUpDown className="h-3 w-3" /></div>
                                </TableHead>
                                <TableHead>Hours Logged</TableHead>
                                <TableHead>Completion Rate</TableHead>
                                <TableHead>Total Entries</TableHead>
                                <TableHead>Status</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {[...departmentReport.nonStarters]
                                .sort((a, b) => {
                                  const key = nonStarterSortKey;
                                  const valA = key === "name" ? a.facultyName : key === "email" ? a.email : a.verticalName;
                                  const valB = key === "name" ? b.facultyName : key === "email" ? b.email : b.verticalName;
                                  return nonStarterSortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
                                })
                                .map((ns) => (
                                  <TableRow key={ns.userId}>
                                    <TableCell className="font-medium">{ns.facultyName}</TableCell>
                                    <TableCell className="text-sm text-muted-foreground">{ns.email || "-"}</TableCell>
                                    <TableCell className="text-sm">{ns.verticalName || "-"}</TableCell>
                                    <TableCell>0.0h</TableCell>
                                    <TableCell>0.0%</TableCell>
                                    <TableCell>0</TableCell>
                                    <TableCell>
                                      <span className="text-xs font-medium px-2 py-1 rounded bg-destructive/10 text-destructive">
                                        Not Started
                                      </span>
                                    </TableCell>
                                  </TableRow>
                                ))}
                            </TableBody>
                          </Table>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Faculty Breakdown */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Faculty Breakdown</CardTitle>
                      <CardDescription>
                        Performance summary for {departmentReport.facultyBreakdown.length} active faculty members
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="border rounded-lg">
                         <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="cursor-pointer select-none" onClick={() => { if (facultySortKey === "name") setFacultySortAsc(!facultySortAsc); else { setFacultySortKey("name"); setFacultySortAsc(true); } }}>
                                <div className="flex items-center gap-1">Faculty Name <ArrowUpDown className="h-3 w-3" /></div>
                              </TableHead>
                              <TableHead className="cursor-pointer select-none" onClick={() => { if (facultySortKey === "email") setFacultySortAsc(!facultySortAsc); else { setFacultySortKey("email"); setFacultySortAsc(true); } }}>
                                <div className="flex items-center gap-1">Email <ArrowUpDown className="h-3 w-3" /></div>
                              </TableHead>
                              <TableHead className="cursor-pointer select-none" onClick={() => { if (facultySortKey === "vertical") setFacultySortAsc(!facultySortAsc); else { setFacultySortKey("vertical"); setFacultySortAsc(true); } }}>
                                <div className="flex items-center gap-1">Vertical <ArrowUpDown className="h-3 w-3" /></div>
                              </TableHead>
                              <TableHead className="cursor-pointer select-none" onClick={() => { if (facultySortKey === "hours") setFacultySortAsc(!facultySortAsc); else { setFacultySortKey("hours"); setFacultySortAsc(false); } }}>
                                <div className="flex items-center gap-1">Hours Logged <ArrowUpDown className="h-3 w-3" /></div>
                              </TableHead>
                              <TableHead className="cursor-pointer select-none" onClick={() => { if (facultySortKey === "completion") setFacultySortAsc(!facultySortAsc); else { setFacultySortKey("completion"); setFacultySortAsc(false); } }}>
                                <div className="flex items-center gap-1">Completion Rate <ArrowUpDown className="h-3 w-3" /></div>
                              </TableHead>
                              <TableHead className="cursor-pointer select-none" onClick={() => { if (facultySortKey === "entries") setFacultySortAsc(!facultySortAsc); else { setFacultySortKey("entries"); setFacultySortAsc(false); } }}>
                                <div className="flex items-center gap-1">Total Entries <ArrowUpDown className="h-3 w-3" /></div>
                              </TableHead>
                              <TableHead>Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {[...departmentReport.facultyBreakdown]
                              .sort((a, b) => {
                                const key = facultySortKey;
                                let cmp = 0;
                                if (key === "name") cmp = a.facultyName.localeCompare(b.facultyName);
                                else if (key === "email") cmp = (a.email || "").localeCompare(b.email || "");
                                else if (key === "vertical") cmp = (a.verticalName || "").localeCompare(b.verticalName || "");
                                else if (key === "hours") cmp = a.totalHours - b.totalHours;
                                else if (key === "completion") cmp = a.completionRate - b.completionRate;
                                else if (key === "entries") cmp = a.entryCount - b.entryCount;
                                return facultySortAsc ? cmp : -cmp;
                              })
                              .map((faculty) => (
                              <TableRow key={faculty.userId}>
                                <TableCell className="font-medium">{faculty.facultyName}</TableCell>
                                <TableCell className="text-sm text-muted-foreground">{faculty.email || "-"}</TableCell>
                                <TableCell className="text-sm">{faculty.verticalName || "-"}</TableCell>
                                <TableCell>{faculty.totalHours.toFixed(1)}h</TableCell>
                                <TableCell>{faculty.completionRate.toFixed(1)}%</TableCell>
                                <TableCell>{faculty.entryCount}</TableCell>
                                <TableCell>
                                  <span
                                    className={`text-xs font-medium px-2 py-1 rounded ${
                                      faculty.completionRate >= 100
                                        ? "bg-success/10 text-success"
                                        : faculty.completionRate >= 70
                                        ? "bg-success/10 text-success"
                                        : faculty.completionRate >= 50
                                        ? "bg-warning/10 text-warning"
                                        : "bg-destructive/10 text-destructive"
                                    }`}
                                  >
                                    {faculty.completionRate >= 100
                                      ? "Exceeded"
                                      : faculty.completionRate >= 70
                                      ? "On Track"
                                      : "Behind"}
                                  </span>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="calendar" className="space-y-4">
                  {selectedDepartment === "all" ? (
                    <Card>
                      <CardContent className="py-12 text-center text-muted-foreground">
                        Please select a specific department to view calendar
                      </CardContent>
                    </Card>
                  ) : (
                    <>
                      <div className="flex items-center justify-between">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1))}
                        >
                          <ChevronLeft className="h-4 w-4 mr-1" />
                          Previous
                        </Button>
                        <h3 className="text-lg font-semibold">
                          {format(calendarMonth, "MMMM yyyy")}
                        </h3>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1))}
                        >
                          Next
                          <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </div>

                      <DepartmentCalendar
                        departmentId={selectedDepartment}
                        month={calendarMonth}
                      />
                    </>
                  )}
                </TabsContent>
              </Tabs>
            )}
          </>
        ) : (
          <Card>
            <CardContent className="py-12">
              <div className="text-center text-muted-foreground">
                <p>Select filters and generate a report</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
