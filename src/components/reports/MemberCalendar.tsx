import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend } from "date-fns";
import { cn } from "@/lib/utils";

interface MemberCalendarProps {
  memberId: string;
  month: Date;
}

interface DayData {
  date: Date;
  totalHours: number;
  entryCount: number;
  completionRate: number;
  isOnLeave: boolean;
  leaveType?: string;
  isWeekend: boolean;
  status: 'leave' | 'complete' | 'partial' | 'low' | 'none' | 'weekend';
}

export function MemberCalendar({ memberId, month }: MemberCalendarProps) {
  const [calendarData, setCalendarData] = useState<DayData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadCalendarData();
  }, [memberId, month]);

  const loadCalendarData = async () => {
    setIsLoading(true);

    const monthStart = startOfMonth(month);
    const monthEnd = endOfMonth(month);

    // Fetch timesheet entries for the month
    const { data: entries } = await supabase
      .from("timesheet_entries")
      .select("entry_date, duration_minutes, status")
      .eq("user_id", memberId)
      .gte("entry_date", format(monthStart, "yyyy-MM-dd"))
      .lte("entry_date", format(monthEnd, "yyyy-MM-dd"));

    // Fetch leave days - Type assertion to bypass TypeScript errors until types regenerate
    const { data: leaves } = await supabase
      .from('leave_days' as any)
      .select('leave_date, leave_type')
      .eq('user_id', memberId)
      .gte('leave_date', format(monthStart, "yyyy-MM-dd"))
      .lte('leave_date', format(monthEnd, "yyyy-MM-dd"));

    // Build calendar data
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
    const leaveMap = new Map<string, string>();
    leaves?.forEach((leave: any) => {
      leaveMap.set(leave.leave_date, leave.leave_type);
    });

    const data: DayData[] = days.map(date => {
      const dateStr = format(date, "yyyy-MM-dd");
      const dayEntries = entries?.filter(e => e.entry_date === dateStr) || [];
      const totalMinutes = dayEntries
        .filter(e => e.status === "approved" || e.status === "submitted")
        .reduce((sum, e) => sum + e.duration_minutes, 0);
      const totalHours = totalMinutes / 60;
      const isOnLeave = leaveMap.has(dateStr);
      const isWeekendDay = isWeekend(date);

      let status: DayData['status'];
      if (isWeekendDay) status = 'weekend';
      else if (isOnLeave) status = 'leave';
      else if (totalHours >= 8) status = 'complete';
      else if (totalHours >= 4) status = 'partial';
      else if (totalHours > 0) status = 'low';
      else status = 'none';

      return {
        date,
        totalHours,
        entryCount: dayEntries.length,
        completionRate: (totalMinutes / 480) * 100,
        isOnLeave,
        leaveType: leaveMap.get(dateStr),
        isWeekend: isWeekendDay,
        status,
      };
    });

    setCalendarData(data);
    setIsLoading(false);
  };

  const getDayBgClass = (status: string) => {
    switch (status) {
      case "complete":
        return "bg-green-500/20 border-green-500";
      case "partial":
        return "bg-yellow-500/20 border-yellow-500";
      case "low":
        return "bg-orange-500/20 border-orange-500";
      case "leave":
        return "bg-blue-500/20 border-blue-500";
      case "weekend":
        return "bg-muted border-border";
      default:
        return "bg-background border-border";
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Loading calendar...
        </CardContent>
      </Card>
    );
  }

  // Get first day of month to calculate offset
  const firstDayOfMonth = startOfMonth(month);
  const startDayOfWeek = firstDayOfMonth.getDay();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Monthly Calendar - {format(month, "MMMM yyyy")}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {/* Day headers */}
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div
              key={day}
              className="text-center font-semibold text-xs sm:text-sm py-2 text-muted-foreground"
            >
              {day}
            </div>
          ))}

          {/* Empty cells for days before month starts */}
          {Array.from({ length: startDayOfWeek }).map((_, i) => (
            <div key={`empty-${i}`} />
          ))}

          {/* Calendar days */}
          {calendarData.map((day) => (
            <div
              key={format(day.date, "yyyy-MM-dd")}
              className={cn(
                "min-h-[60px] sm:min-h-[80px] p-1 sm:p-2 rounded-md border-2 transition-all",
                getDayBgClass(day.status),
                "hover:shadow-md"
              )}
            >
              <div className="text-xs sm:text-sm font-medium mb-1">
                {format(day.date, "d")}
              </div>

              {day.isOnLeave && (
                <Badge variant="outline" className="text-[10px] sm:text-xs mb-1 px-1">
                  Leave
                </Badge>
              )}

              {!day.isWeekend && !day.isOnLeave && (
                <div className="space-y-0.5 text-[10px] sm:text-xs">
                  <div className="font-medium">{day.totalHours.toFixed(1)}h</div>
                  {day.entryCount > 0 && (
                    <div className="text-muted-foreground">
                      {day.entryCount} {day.entryCount === 1 ? "entry" : "entries"}
                    </div>
                  )}
                  {day.totalHours > 0 && (
                    <div className="font-medium">
                      {Math.round(day.completionRate)}%
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="mt-6 flex flex-wrap gap-3 sm:gap-4 text-xs sm:text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-green-500/20 border-2 border-green-500" />
            <span>Complete (8+ hrs)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-yellow-500/20 border-2 border-yellow-500" />
            <span>Partial (4-8 hrs)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-orange-500/20 border-2 border-orange-500" />
            <span>Low (&lt;4 hrs)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-blue-500/20 border-2 border-blue-500" />
            <span>On Leave</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-muted border-2 border-border" />
            <span>Weekend</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
