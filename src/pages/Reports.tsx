import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Download, Filter, ChevronDown, ChevronLeft, ChevronRight, BarChart3 } from "lucide-react";
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
import { ReportSummaryCards } from "@/components/reports/ReportSummaryCards";
import { MemberCalendar } from "@/components/reports/MemberCalendar";
import { DepartmentCalendar } from "@/components/reports/DepartmentCalendar";
import { PageHeader } from "@/components/PageHeader";
import { PageSkeleton } from "@/components/PageSkeleton";
import { 
  fetchFacultyReport, 
  fetchDepartmentReport, 
  ReportPeriod,
  FacultyReportData,
  DepartmentReportData,
  groupEntriesByPeriod
} from "@/lib/reportQueries";
import { exportMemberReportCSV, exportDepartmentReportCSV } from "@/lib/exportUtils";
import { exportMemberReportPDF, exportDepartmentReportPDF } from "@/lib/pdfExportUtils";
import { formatDuration } from "@/lib/exportUtils";
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
  
  const [facultyReport, setFacultyReport] = useState<FacultyReportData | null>(null);
  const [departmentReport, setDepartmentReport] = useState<DepartmentReportData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Calendar view state
  const [viewMode, setViewMode] = useState<"table" | "calendar">("table");
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());

  // HOD department filter
  const [hodDepartmentIds, setHodDepartmentIds] = useState<string[]>([]);

  const isHod = userWithRole?.role === "manager";
  const hasReportsAccess = ["org_admin", "program_manager", "manager"].includes(userWithRole?.role || "");

  // Fetch HOD's department IDs
  useEffect(() => {
    const fetchHodDepartments = async () => {
      if (!userWithRole?.user?.id || !isHod) return;
      
      try {
        // Get from user_departments for multi-department support
        const { data: userDepts } = await supabase
          .from("user_departments")
          .select("department_id")
          .eq("user_id", userWithRole.user.id);
        
        // Also get from user_roles as fallback
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("department_id")
          .eq("user_id", userWithRole.user.id)
          .maybeSingle();
        
        const deptIds = new Set<string>();
        userDepts?.forEach(ud => ud.department_id && deptIds.add(ud.department_id));
        if (roleData?.department_id) deptIds.add(roleData.department_id);
        
        const deptIdsArray = Array.from(deptIds);
        setHodDepartmentIds(deptIdsArray);
        
        // Set default department for HOD if only one
        if (deptIdsArray.length === 1) {
          setSelectedDepartment(deptIdsArray[0]);
        }
      } catch (error) {
        console.error("Error fetching HOD departments:", error);
      }
    };

    fetchHodDepartments();
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
          return;
        }
        const report = await fetchFacultyReport(selectedFaculty, reportPeriod);
        setFacultyReport(report);
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

  useEffect(() => {
    if (userWithRole && hasReportsAccess) {
      generateReport();
    }
  }, [userWithRole, reportType, period, dateFrom, dateTo, selectedFaculty, selectedDepartment, hasReportsAccess]);

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
      : departmentReport?.facultyBreakdown.length > 0
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
              <DropdownMenuContent>
                <DropdownMenuItem onClick={handleExportCSV}>Export to CSV</DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportPDF}>Export to PDF</DropdownMenuItem>
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
          <CardContent>
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

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                />
              </div>
              {reportType === "member" ? (
                <div>
                  <Label>Team Member</Label>
                  <MemberSelect
                    value={selectedFaculty}
                    onValueChange={setSelectedFaculty}
                    includeAll={false}
                    departmentIds={isHod ? hodDepartmentIds : undefined}
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
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
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
              averageDailyHours={currentReport.averageDailyHours}
            />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Completion Metrics */}
              <CompletionMetricsCard
                actualHours={currentReport.totalHours}
                expectedHours={currentReport.expectedHours}
                completionRate={currentReport.completionRate}
                period={period}
              />

              {/* Activity Breakdown */}
              <ActivityBreakdownChart data={currentReport.activityBreakdown} />
            </div>

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
                                <TableHead>Date</TableHead>
                                <TableHead>Activity</TableHead>
                                <TableHead>Time</TableHead>
                                <TableHead>Duration</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Notes</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {facultyReport.entries.map((entry) => (
                                <TableRow key={entry.id}>
                                  <TableCell>{format(new Date(entry.entry_date), "MMM dd, yyyy")}</TableCell>
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

                <TabsContent value="table">
                  <Card>
                    <CardHeader>
                      <CardTitle>Faculty Breakdown</CardTitle>
                      <CardDescription>
                        Performance summary for {departmentReport.totalFaculty} faculty members
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="border rounded-lg">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Faculty Name</TableHead>
                              <TableHead>Hours Logged</TableHead>
                              <TableHead>Completion Rate</TableHead>
                              <TableHead>Total Entries</TableHead>
                              <TableHead>Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {departmentReport.facultyBreakdown.map((faculty) => (
                              <TableRow key={faculty.userId}>
                                <TableCell className="font-medium">{faculty.facultyName}</TableCell>
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
                {reportType === "member" && selectedFaculty === "all" ? (
                  <p>Please select a team member to view their report</p>
                ) : (
                  <p>Select filters and generate a report</p>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
