import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, CheckCircle, FileText, TrendingUp } from "lucide-react";

interface ReportSummaryCardsProps {
  totalHours: number;
  expectedHours: number;
  completionRate: number;
  totalEntries: number;
  averageDailyHours?: number;
}

export function ReportSummaryCards({
  totalHours,
  expectedHours,
  completionRate,
  totalEntries,
  averageDailyHours,
}: ReportSummaryCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
