import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Download, Filter, ChevronDown } from "lucide-react";
import { DateRangePicker } from "@/components/DateRangePicker";
import { DepartmentSelect } from "@/components/DepartmentSelect";
import { FacultySelect } from "@/components/FacultySelect";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/StatusBadge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ReportTypeToggle } from "@/components/reports/ReportTypeToggle";
import { ReportPeriodSelector, PeriodType } from "@/components/reports/ReportPeriodSelector";
import { ActivityBreakdownChart } from "@/components/reports/ActivityBreakdownChart";
import { CompletionMetricsCard } from "@/components/reports/CompletionMetricsCard";
import { ReportSummaryCards } from "@/components/reports/ReportSummaryCards";
import { 
  fetchFacultyReport, 
  fetchDepartmentReport, 
  ReportPeriod,
  FacultyReportData,
  DepartmentReportData,
  groupEntriesByPeriod
} from "@/lib/reportQueries";
import { exportFacultyReportCSV, exportDepartmentReportCSV } from "@/lib/exportUtils";
import { exportFacultyReportPDF, exportDepartmentReportPDF } from "@/lib/pdfExportUtils";
import { formatDuration } from "@/lib/exportUtils";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { getUserErrorMessage } from "@/lib/errorHandler";

type ReportViewType = "faculty" | "department";

export default function Reports() {
  const { userWithRole, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [reportType, setReportType] = useState<ReportViewType>("faculty");
  const [period, setPeriod] = useState<PeriodType>("monthly");
  const [dateFrom, setDateFrom] = useState<Date>(startOfMonth(new Date()));
  const [dateTo, setDateTo] = useState<Date>(endOfMonth(new Date()));
  const [selectedFaculty, setSelectedFaculty] = useState<string>("all");
  const [selectedDepartment, setSelectedDepartment] = useState<string>("all");
  
  const [facultyReport, setFacultyReport] = useState<FacultyReportData | null>(null);
  const [departmentReport, setDepartmentReport] = useState<DepartmentReportData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!loading && (!userWithRole || userWithRole.role !== "admin")) {
      navigate("/dashboard");
    }
  }, [userWithRole, loading, navigate]);

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

      if (reportType === "faculty") {
        if (selectedFaculty === "all") {
          toast({
            title: "Selection Required",
            description: "Please select a faculty member to generate their report",
            variant: "destructive",
          });
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
    if (userWithRole?.role === "admin") {
      generateReport();
    }
  }, [userWithRole, reportType, period, dateFrom, dateTo, selectedFaculty, selectedDepartment]);

  const handleExportCSV = () => {
    const reportPeriod = `${format(dateFrom, "MMM dd, yyyy")} - ${format(dateTo, "MMM dd, yyyy")}`;
    const generatedBy = userWithRole?.profile?.full_name || "Admin";

    if (reportType === "faculty" && facultyReport) {
      exportFacultyReportCSV(facultyReport, reportPeriod, generatedBy, period);
    } else if (reportType === "department" && departmentReport) {
      exportDepartmentReportCSV(departmentReport, reportPeriod, generatedBy, period);
    }
  };

  const handleExportPDF = () => {
    const reportPeriod = `${format(dateFrom, "MMM dd, yyyy")} - ${format(dateTo, "MMM dd, yyyy")}`;
    const generatedBy = userWithRole?.profile?.full_name || "Admin";

    if (reportType === "faculty" && facultyReport) {
      exportFacultyReportPDF(facultyReport, reportPeriod, generatedBy, period);
    } else if (reportType === "department" && departmentReport) {
      exportDepartmentReportPDF(departmentReport, reportPeriod, generatedBy, period);
    }
  };

  const currentReport = reportType === "faculty" ? facultyReport : departmentReport;
  const hasData = currentReport && (
    reportType === "faculty" 
      ? facultyReport?.entries.length > 0 
      : departmentReport?.facultyBreakdown.length > 0
  );

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
      <div className="container mx-auto py-8 px-4 space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Reports & Analytics</h1>
            <p className="text-muted-foreground">Comprehensive faculty and department reporting</p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button disabled={!hasData}>
                <Download className="mr-2 h-4 w-4" />
                Export
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={handleExportCSV}>
                Export to CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportPDF}>
                Export to PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

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
              {reportType === "faculty" ? (
                <div>
                  <Label>Faculty Member</Label>
                  <FacultySelect
                    value={selectedFaculty}
                    onValueChange={setSelectedFaculty}
                    includeAll={false}
                  />
                </div>
              ) : (
                <div>
                  <Label>Department</Label>
                  <DepartmentSelect
                    value={selectedDepartment}
                    onValueChange={setSelectedDepartment}
                    includeAll
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
                reportType === "faculty"
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

            {/* Department Faculty Breakdown */}
            {reportType === "department" && departmentReport && (
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
            )}

            {/* Detailed Entry Table - Faculty View */}
            {reportType === "faculty" && facultyReport && (
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
            )}
          </>
        ) : (
          <Card>
            <CardContent className="py-12">
              <div className="text-center text-muted-foreground">
                {reportType === "faculty" && selectedFaculty === "all" ? (
                  <p>Please select a faculty member to view their report</p>
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
