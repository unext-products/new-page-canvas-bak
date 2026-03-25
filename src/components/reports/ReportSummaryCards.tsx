import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, CheckCircle, FileText, TrendingUp, CheckCircle2, AlertCircle } from "lucide-react";
import { ExpectedHoursBreakdown } from "@/lib/reportQueries";

interface ReportSummaryCardsProps {
  totalHours: number;
  expectedHours: number;
  completionRate: number;
  totalEntries: number;
  averageDailyHours?: number;
  approvedCount?: number;
  pendingCount?: number;
  expectedHoursBreakdown?: ExpectedHoursBreakdown;
}

export function ReportSummaryCards({
  totalHours,
  expectedHours,
  completionRate,
  totalEntries,
  averageDailyHours,
  approvedCount,
  pendingCount,
  expectedHoursBreakdown,
}: ReportSummaryCardsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Hours</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalHours.toFixed(1)}h</div>
          <p className="text-xs text-muted-foreground">
            Expected: {expectedHours.toFixed(1)}h
          </p>
          {expectedHoursBreakdown && (
            <p className="text-xs text-muted-foreground mt-0.5">
              D: {expectedHoursBreakdown.totalDays} L: {expectedHoursBreakdown.leaveDays % 1 === 0 ? expectedHoursBreakdown.leaveDays : expectedHoursBreakdown.leaveDays.toFixed(1)} H: {expectedHoursBreakdown.holidayDays}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
          <CheckCircle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{completionRate.toFixed(1)}%</div>
          <p className="text-xs text-muted-foreground">
            {completionRate >= 100 ? "Above" : completionRate >= 70 ? "On track" : "Below"} target
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Entries</CardTitle>
          <FileText className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalEntries}</div>
          <p className="text-xs text-muted-foreground">
            Timesheet records
          </p>
        </CardContent>
      </Card>

      {approvedCount !== undefined && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Entries Approved</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{approvedCount}</div>
            <p className="text-xs text-muted-foreground">
              Approved entries
            </p>
          </CardContent>
        </Card>
      )}

      {pendingCount !== undefined && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approvals Pending</CardTitle>
            <AlertCircle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{pendingCount}</div>
            <p className="text-xs text-muted-foreground">
              Awaiting approval
            </p>
          </CardContent>
        </Card>
      )}

      {averageDailyHours !== undefined && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Daily Hours</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{averageDailyHours.toFixed(1)}h</div>
            <p className="text-xs text-muted-foreground">
              Per working day
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
