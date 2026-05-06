import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, AlertCircle, TrendingUp, CalendarDays, TreePalm, Landmark } from "lucide-react";
import { cn } from "@/lib/utils";
import { ExpectedHoursBreakdown } from "@/lib/reportQueries";

interface CompletionMetricsCardProps {
  actualHours: number;
  expectedHours: number;
  completionRate: number;
  period: string;
  expectedHoursBreakdown?: ExpectedHoursBreakdown;
  dailyTargetHours?: number;
  isDepartmentView?: boolean;
  totalFaculty?: number;
}

export function CompletionMetricsCard({
  actualHours,
  expectedHours,
  completionRate,
  period,
  expectedHoursBreakdown,
  dailyTargetHours = 8,
  isDepartmentView = false,
  totalFaculty,
}: CompletionMetricsCardProps) {
  const getStatusConfig = () => {
    if (completionRate >= 100) {
      return {
        status: "Exceeded Target",
        icon: TrendingUp,
        color: "text-success",
        bgColor: "bg-success/10",
        progressColor: "bg-success",
      };
    } else if (completionRate >= 70) {
      return {
        status: "On Track",
        icon: CheckCircle2,
        color: "text-success",
        bgColor: "bg-success/10",
        progressColor: "bg-success",
      };
    } else if (completionRate >= 50) {
      return {
        status: "Behind Schedule",
        icon: AlertCircle,
        color: "text-warning",
        bgColor: "bg-warning/10",
        progressColor: "bg-warning",
      };
    } else {
      return {
        status: "Critical",
        icon: AlertCircle,
        color: "text-destructive",
        bgColor: "bg-destructive/10",
        progressColor: "bg-destructive",
      };
    }
  };

  const statusConfig = getStatusConfig();
  const StatusIcon = statusConfig.icon;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Completion Rate</CardTitle>
        <CardDescription className="capitalize">{period} Progress</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-3xl font-bold">{completionRate.toFixed(1)}%</p>
            <p className="text-sm text-muted-foreground">
              {actualHours.toFixed(1)} of {expectedHours.toFixed(1)} hours
            </p>
          </div>
          <div className={cn("p-3 rounded-full", statusConfig.bgColor)}>
            <StatusIcon className={cn("h-6 w-6", statusConfig.color)} />
          </div>
        </div>

        <div className="space-y-2">
          <Progress value={Math.min(completionRate, 100)} className="h-2" />
          <div className="flex items-center justify-between text-sm">
            <span className={cn("font-medium", statusConfig.color)}>
              {statusConfig.status}
            </span>
            {completionRate > 100 && (
              <span className="text-muted-foreground">
                +{(actualHours - expectedHours).toFixed(1)} hours extra
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-4 border-t">
          <div>
            <p className="text-xs text-muted-foreground">Actual</p>
            <p className="text-lg font-semibold">{actualHours.toFixed(1)}h</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Expected</p>
            <p className="text-lg font-semibold">{expectedHours.toFixed(1)}h</p>
            {expectedHoursBreakdown && !isDepartmentView && (
              <p className="text-xs text-muted-foreground mt-0.5">
                ({expectedHoursBreakdown.totalDays - (expectedHoursBreakdown.leaveDays + expectedHoursBreakdown.holidayDays)} Working Days × {dailyTargetHours} Hrs)
              </p>
            )}
            {isDepartmentView && totalFaculty !== undefined && (
              <p className="text-xs text-muted-foreground mt-0.5">
                (Sum across {totalFaculty} members)
              </p>
            )}
          </div>
        </div>

        {expectedHoursBreakdown && (
          <div className="grid grid-cols-3 gap-3 pt-3 border-t">
            <div className="flex items-center gap-2 rounded-md border px-3 py-2">
              <CalendarDays className="h-4 w-4 text-green-600 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Days</p>
                <p className="text-sm font-semibold">{expectedHoursBreakdown.totalDays}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-md border px-3 py-2">
              <TreePalm className="h-4 w-4 text-orange-500 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Leaves</p>
                <p className="text-sm font-semibold">
                  {expectedHoursBreakdown.leaveDays % 1 === 0 ? expectedHoursBreakdown.leaveDays : expectedHoursBreakdown.leaveDays.toFixed(1)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-md border px-3 py-2">
              <Landmark className="h-4 w-4 text-red-500 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Holidays</p>
                <p className="text-sm font-semibold">{expectedHoursBreakdown.holidayDays}</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
