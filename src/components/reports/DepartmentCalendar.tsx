import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend } from "date-fns";
import { cn } from "@/lib/utils";

interface DepartmentCalendarProps {
  departmentId: string;
  month: Date;
}

interface DepartmentDayData {
  date: Date;
  membersOnLeaveCount: number;
  membersWithEntriesCount: number;
  totalHours: number;
  totalMembersCount: number;
  averageCompletionRate: number;
  isWeekend: boolean;
}

export function DepartmentCalendar({ departmentId, month }: DepartmentCalendarProps) {
  const [calendarData, setCalendarData] = useState<DepartmentDayData[]>([]);
  const [totalMembersCount, setTotalMembersCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadCalendarData();
  }, [departmentId, month]);

  const loadCalendarData = async () => {
    setIsLoading(true);

    const monthStart = startOfMonth(month);
    const monthEnd = endOfMonth(month);

    // Get all members in department
    const { data: memberList } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "faculty")
      .eq("department_id", departmentId);

    const memberIds = memberList?.map(f => f.user_id) || [];
    setTotalMembersCount(memberIds.length);

    if (memberIds.length === 0) {
      setIsLoading(false);
      return;
    }

    // Fetch all entries for department members
    const { data: entries } = await supabase
      .from("timesheet_entries")
      .select("user_id, entry_date, duration_minutes, status")
      .in("user_id", memberIds)
      .gte("entry_date", format(monthStart, "yyyy-MM-dd"))
      .lte("entry_date", format(monthEnd, "yyyy-MM-dd"));

    // Fetch leave days - Type assertion to bypass TypeScript errors until types regenerate
    const { data: leaves } = await supabase
      .from('leave_days' as any)
      .select('leave_date, user_id')
      .in('user_id', memberIds)
      .gte('leave_date', format(monthStart, "yyyy-MM-dd"))
      .lte('leave_date', format(monthEnd, "yyyy-MM-dd"));

    // Process data for each day
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

    const data: DepartmentDayData[] = days.map(date => {
      const dateStr = format(date, "yyyy-MM-dd");
      const isWeekendDay = isWeekend(date);

      // Count members on leave
      const membersOnLeave = new Set<string>(
        leaves?.filter((l: any) => l.leave_date === dateStr).map((l: any) => l.user_id) || []
      );

      // Count members with entries and total hours
      const dayEntries = entries?.filter(e => e.entry_date === dateStr) || [];
      const membersWithEntries = new Set(dayEntries.map(e => e.user_id));
      const totalMinutes = dayEntries
        .filter(e => e.status === "approved" || e.status === "submitted")
        .reduce((sum, e) => sum + e.duration_minutes, 0);

      // Calculate average completion (only for members who should be working)
      const workingMembersCount = isWeekendDay ? 0 : memberIds.length - membersOnLeave.size;
      const expectedTotalMinutes = workingMembersCount * 480; // 8 hours per member
      const averageCompletionRate = expectedTotalMinutes > 0
        ? (totalMinutes / expectedTotalMinutes) * 100
        : 0;

      return {
        date,
        membersOnLeaveCount: membersOnLeave.size,
        membersWithEntriesCount: membersWithEntries.size,
        totalHours: totalMinutes / 60,
        totalMembersCount: memberIds.length,
        averageCompletionRate,
        isWeekend: isWeekendDay,
      };
    });

    setCalendarData(data);
    setIsLoading(false);
  };

  const getDayBgClass = (day: DepartmentDayData) => {
    if (day.isWeekend) return "bg-muted border-border";
    if (day.averageCompletionRate >= 80) return "bg-green-500/20 border-green-500";
    if (day.averageCompletionRate >= 50) return "bg-yellow-500/20 border-yellow-500";
    if (day.averageCompletionRate >= 20) return "bg-orange-500/20 border-orange-500";
    return "bg-red-500/20 border-red-500";
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
        <CardTitle>Department Calendar - {format(month, "MMMM yyyy")}</CardTitle>
        <CardDescription>Total Members: {totalMembersCount}</CardDescription>
      </CardHeader>
      <CardContent className="px-3 sm:px-6 py-4">
        {/* Legend */}
        <div className="flex flex-wrap gap-2 mb-4 text-xs justify-center">
          <Badge variant="secondary" className="bg-green-500/20 text-green-700 border-green-500">
            80%+ Completion
          </Badge>
          <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-700 border-yellow-500">
            50-79% Completion
          </Badge>
          <Badge variant="secondary" className="bg-orange-500/20 text-orange-700 border-orange-500">
            20-49% Completion
          </Badge>
          <Badge variant="secondary" className="bg-red-500/20 text-red-700 border-red-500">
            &lt;20% Completion
          </Badge>
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1 sm:gap-2 max-w-4xl mx-auto">
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
            <div key={`empty-${i}`} className="min-h-[70px] sm:min-h-[80px]" />
          ))}

          {/* Day cells */}
          {calendarData.map(day => (
            <div
              key={day.date.toISOString()}
              className={cn(
                "min-h-[70px] sm:min-h-[80px] border rounded-lg p-1.5 sm:p-2 text-xs transition-shadow hover:shadow-md cursor-pointer",
                getDayBgClass(day)
              )}
            >
              <div className="font-semibold mb-1">{format(day.date, "d")}</div>
              {!day.isWeekend && (
                <div className="space-y-0.5 text-[10px] sm:text-xs">
                  {day.membersOnLeaveCount > 0 && (
                    <div className="text-blue-700 font-medium">
                      {day.membersOnLeaveCount} on leave
                    </div>
                  )}
                  <div>
                    {day.membersWithEntriesCount} logged
                  </div>
                  <div className="font-medium">
                    {day.totalHours.toFixed(1)}h total
                  </div>
                  <div className="text-muted-foreground">
                    Avg: {Math.round(day.averageCompletionRate)}%
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
