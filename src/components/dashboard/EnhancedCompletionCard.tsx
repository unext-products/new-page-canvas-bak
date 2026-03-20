import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, AlertCircle, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { DateRangeFilter, DateFilterType, DateRange } from "@/components/DateRangeFilter";
import { startOfWeek, endOfWeek, isWeekend, format, eachDayOfInterval } from "date-fns";
import { calculateDurationMinutes } from "@/lib/timesheetUtils";
import { formatLocalDate } from "@/lib/dateUtils";
import { getLeaveWeight } from "@/lib/leaveUtils";
import { calculateUserTotalDailyTargetMinutes } from "@/lib/targets";

interface EnhancedCompletionCardProps {
  userId: string;
}

export function EnhancedCompletionCard({ userId }: EnhancedCompletionCardProps) {
  const [dateFilterType, setDateFilterType] = useState<DateFilterType>("week");
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const today = new Date();
    return {
      from: startOfWeek(today, { weekStartsOn: 1 }),
      to: endOfWeek(today, { weekStartsOn: 1 }),
    };
  });
  const [stats, setStats] = useState({
    actualMinutes: 0,
    expectedMinutes: 2400,
    completionRate: 0,
    averageHoursPerDay: 0,
    workingDays: 0,
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (userId) {
      fetchCompletionData();
    }
  }, [dateRange, userId]);

  const fetchCompletionData = async () => {
    setLoading(true);
    const fromDate = formatLocalDate(dateRange.from);
    const toDate = formatLocalDate(dateRange.to);

    // Fetch user's org first
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("organization_id")
      .eq("user_id", userId)
      .single();

    const orgId = roleData?.organization_id;

    // Fetch entries, leave days, daily target, and holidays in parallel
    const [entriesRes, leavesRes, targetBreakdown, holidaysRes] = await Promise.all([
      supabase
        .from("timesheet_entries")
        .select("start_time, end_time, entry_date, status")
        .eq("user_id", userId)
        .gte("entry_date", fromDate)
        .lte("entry_date", toDate),
      supabase
        .from("leave_days")
        .select("leave_date, leave_type")
        .eq("user_id", userId)
        .gte("leave_date", fromDate)
        .lte("leave_date", toDate),
      calculateUserTotalDailyTargetMinutes(userId),
      orgId
        ? supabase
            .from("holidays")
            .select("holiday_date")
            .eq("organization_id", orgId)
            .gte("holiday_date", fromDate)
            .lte("holiday_date", toDate)
        : Promise.resolve({ data: [] }),
    ]);

    const entries = entriesRes.data;
    const leaves = leavesRes.data || [];
    const holidayDates = new Set(holidaysRes.data?.map(h => h.holiday_date) || []);

    const actualMinutes = entries
      ?.filter((e) => e.status === "approved" || e.status === "submitted")
      .reduce((sum, e) => sum + calculateDurationMinutes(e.start_time, e.end_time), 0) || 0;

    // Build leave map and compute total leave weight
    const leaveMap = new Map<string, string>();
    leaves.forEach((l) => leaveMap.set(l.leave_date, l.leave_type));

    // Count working days excluding weekends, holidays, AND leave days
    const allDays = eachDayOfInterval({ start: dateRange.from, end: dateRange.to });
    let workingDays = 0;
    for (const day of allDays) {
      if (isWeekend(day)) continue;
      const dateStr = format(day, "yyyy-MM-dd");
      if (holidayDates.has(dateStr)) continue; // skip holidays
      if (leaveMap.has(dateStr)) {
        const leaveType = leaveMap.get(dateStr)!;
        workingDays += 1 - getLeaveWeight(leaveType); // half-day = +0.5, full-day = +0
      } else {
        workingDays += 1;
      }
    }

    const dailyTargetMinutes = targetBreakdown.totalDailyTargetMinutes;
    const expectedMinutes = workingDays * dailyTargetMinutes;
    const completionRate = expectedMinutes > 0 ? (actualMinutes / expectedMinutes) * 100 : 0;
    const averageHoursPerDay = workingDays > 0 ? actualMinutes / 60 / workingDays : 0;

    setStats({
      actualMinutes,
      expectedMinutes,
      completionRate,
      averageHoursPerDay,
      workingDays,
    });
    setLoading(false);
  };

  const handleDateFilterChange = (type: DateFilterType, range: DateRange) => {
    setDateFilterType(type);
    setDateRange(range);
  };

  const getStatusConfig = () => {
    const { completionRate } = stats;
    if (completionRate >= 100) {
      return {
        status: "Exceeded Target",
        icon: TrendingUp,
        color: "text-success",
        bgColor: "bg-success/10",
      };
    } else if (completionRate >= 70) {
      return {
        status: "On Track",
        icon: CheckCircle2,
        color: "text-success",
        bgColor: "bg-success/10",
      };
    } else if (completionRate >= 50) {
      return {
        status: "Behind Schedule",
        icon: AlertCircle,
        color: "text-warning",
        bgColor: "bg-warning/10",
      };
    } else {
      return {
        status: "Critical",
        icon: AlertCircle,
        color: "text-destructive",
        bgColor: "bg-destructive/10",
      };
    }
  };

  const statusConfig = getStatusConfig();
  const StatusIcon = statusConfig.icon;
  const actualHours = stats.actualMinutes / 60;
  const expectedHours = stats.expectedMinutes / 60;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <CardTitle>Completion Rate</CardTitle>
            <CardDescription>Track your progress</CardDescription>
          </div>
          <DateRangeFilter
            value={dateFilterType}
            onChange={handleDateFilterChange}
            customRange={dateRange}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-3xl font-bold">
              {loading ? "..." : `${stats.completionRate.toFixed(1)}%`}
            </p>
            <p className="text-sm text-muted-foreground">
              {actualHours.toFixed(1)} of {expectedHours.toFixed(1)} hours
            </p>
          </div>
          <div className={cn("p-3 rounded-full", statusConfig.bgColor)}>
            <StatusIcon className={cn("h-6 w-6", statusConfig.color)} />
          </div>
        </div>

        <div className="space-y-2">
          <Progress value={Math.min(stats.completionRate, 100)} className="h-2" />
          <div className="flex items-center justify-between text-sm">
            <span className={cn("font-medium", statusConfig.color)}>
              {statusConfig.status}
            </span>
            {stats.completionRate > 100 && (
              <span className="text-muted-foreground">
                +{(actualHours - expectedHours).toFixed(1)} hours extra
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 pt-4 border-t">
          <div>
            <p className="text-xs text-muted-foreground">Actual</p>
            <p className="text-lg font-semibold">{actualHours.toFixed(1)}h</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Expected</p>
            <p className="text-lg font-semibold">{expectedHours.toFixed(1)}h</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Avg/Day</p>
            <p className="text-lg font-semibold">{stats.averageHoursPerDay.toFixed(1)}h</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
