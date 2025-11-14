import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend } from "date-fns";
import { cn } from "@/lib/utils";

interface FacultyCalendarProps {
  facultyId: string;
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

export function FacultyCalendar({ facultyId, month }: FacultyCalendarProps) {
  const [calendarData, setCalendarData] = useState<DayData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadCalendarData();
  }, [facultyId, month]);

  const loadCalendarData = async () => {
    setIsLoading(true);

    const monthStart = startOfMonth(month);
    const monthEnd = endOfMonth(month);

    // Fetch timesheet entries for the month
    const { data: entries } = await supabase
      .from("timesheet_entries")
      .select("entry_date, duration_minutes, status")
      .eq("user_id", facultyId)
      .gte("entry_date", format(monthStart, "yyyy-MM-dd"))
      .lte("entry_date", format(monthEnd, "yyyy-MM-dd"));

    // Fetch leave days - Type assertion to bypass TypeScript errors until types regenerate
    const { data: leaves } = await supabase
      .from('leave_days' as any)
      .select('leave_date, leave_type')
      .eq('user_id', facultyId)
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

  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const monthStartDay = startOfMonth(month).getDay();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Calendar - {format(month, "MMMM yyyy")}</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Legend */}
        <div className="flex flex-wrap gap-2 mb-4 text-xs">
          <Badge variant="secondary" className="bg-blue-500/20 text-blue-700 border-blue-500">
            On Leave
          </Badge>
          <Badge variant="secondary" className="bg-green-500/20 text-green-700 border-green-500">
            Complete (8+hrs)
          </Badge>
          <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-700 border-yellow-500">
            Partial (4-8hrs)
          </Badge>
          <Badge variant="secondary" className="bg-orange-500/20 text-orange-700 border-orange-500">
            Low (&lt;4hrs)
          </Badge>
          <Badge variant="secondary" className="bg-muted text-muted-foreground border-border">
            Weekend
          </Badge>
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {/* Day headers */}
          {weekDays.map(day => (
            <div
              key={day}
              className="text-center text-xs sm:text-sm font-semibold p-2 text-muted-foreground"
            >
              {day}
            </div>
          ))}

          {/* Empty cells for offset */}
          {Array.from({ length: monthStartDay }).map((_, i) => (
            <div key={`empty-${i}`} className="aspect-square" />
          ))}

          {/* Day cells */}
          {calendarData.map(day => (
            <div
              key={day.date.toISOString()}
              className={cn(
                "aspect-square border rounded-lg p-1 sm:p-2 flex flex-col justify-between text-xs transition-shadow hover:shadow-md cursor-pointer",
                getDayBgClass(day.status)
              )}
            >
              <div className="font-semibold">{format(day.date, "d")}</div>

              {!day.isWeekend && (
                <div className="space-y-0.5">
                  {day.isOnLeave ? (
                    <Badge className="text-[10px] px-1 py-0 bg-blue-600 text-white">
                      Leave
                    </Badge>
                  ) : (
                    <>
                      {day.totalHours > 0 && (
                        <>
                          <div className="font-medium text-[10px] sm:text-xs">
                            {day.totalHours.toFixed(1)}h
                          </div>
                          <div className="text-[9px] text-muted-foreground">
                            {day.entryCount} {day.entryCount === 1 ? 'entry' : 'entries'}
                          </div>
                          <div className="text-[9px] font-medium">
                            {Math.round(day.completionRate)}%
                          </div>
                        </>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
