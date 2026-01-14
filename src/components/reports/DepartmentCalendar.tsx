import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend, addDays, subDays } from "date-fns";
import { cn } from "@/lib/utils";
import { ViewToggle } from "@/components/calendar/ViewToggle";
import { DayMatrixView } from "@/components/calendar/DayMatrixView";
import { ChevronLeft, ChevronRight, CalendarIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";

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

import { FacultyData, MatrixTimesheetEntry } from "@/components/calendar/DayMatrixView";

export function DepartmentCalendar({ departmentId, month }: DepartmentCalendarProps) {
  const [calendarData, setCalendarData] = useState<DepartmentDayData[]>([]);
  const [totalMembersCount, setTotalMembersCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"month" | "day">("month");
  const [selectedDay, setSelectedDay] = useState<Date>(new Date());
  const [facultyEntries, setFacultyEntries] = useState<FacultyData[]>([]);
  const [isDayLoading, setIsDayLoading] = useState(false);

  useEffect(() => {
    loadCalendarData();
  }, [departmentId, month]);

  useEffect(() => {
    if (viewMode === "day") {
      loadDayData();
    }
  }, [departmentId, selectedDay, viewMode]);

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
      .select("user_id, entry_date, start_time, end_time, status")
      .in("user_id", memberIds)
      .gte("entry_date", format(monthStart, "yyyy-MM-dd"))
      .lte("entry_date", format(monthEnd, "yyyy-MM-dd"));

    // Fetch leave days
    const { data: leaves } = await supabase
      .from("leave_days")
      .select("leave_date, user_id")
      .in("user_id", memberIds)
      .gte("leave_date", format(monthStart, "yyyy-MM-dd"))
      .lte("leave_date", format(monthEnd, "yyyy-MM-dd"));

    // Helper function to calculate duration in minutes from start and end time
    const calculateDuration = (startTime: string, endTime: string): number => {
      const [startH, startM] = startTime.split(':').map(Number);
      const [endH, endM] = endTime.split(':').map(Number);
      return (endH * 60 + endM) - (startH * 60 + startM);
    };

    // Process data for each day
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

    const data: DepartmentDayData[] = days.map(date => {
      const dateStr = format(date, "yyyy-MM-dd");
      const isWeekendDay = isWeekend(date);

      // Count members on leave
      const membersOnLeave = new Set<string>(
        leaves?.filter((l) => l.leave_date === dateStr).map((l) => l.user_id) || []
      );

      // Count members with entries and total hours
      const dayEntries = entries?.filter(e => e.entry_date === dateStr) || [];
      const membersWithEntries = new Set(dayEntries.map(e => e.user_id));
      const totalMinutes = dayEntries
        .filter(e => e.status === "approved" || e.status === "submitted")
        .reduce((sum, e) => sum + calculateDuration(e.start_time, e.end_time), 0);

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

  const loadDayData = async () => {
    setIsDayLoading(true);
    const dateStr = format(selectedDay, "yyyy-MM-dd");

    // Get all members in department with their profiles
    const { data: memberList } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "faculty")
      .eq("department_id", departmentId);

    const memberIds = memberList?.map(f => f.user_id) || [];

    if (memberIds.length === 0) {
      setFacultyEntries([]);
      setIsDayLoading(false);
      return;
    }

    // Fetch profiles
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", memberIds);

    // Fetch entries for this day
    const { data: entries } = await supabase
      .from("timesheet_entries")
      .select("id, user_id, start_time, end_time, status, activity_type")
      .in("user_id", memberIds)
      .eq("entry_date", dateStr)
      .order("start_time", { ascending: true });

    // Fetch leave days
    const { data: leaves } = await supabase
      .from("leave_days")
      .select("user_id, leave_type")
      .in("user_id", memberIds)
      .eq("leave_date", dateStr);

    // Build faculty entries list
    const leaveMap = new Map(leaves?.map(l => [l.user_id, l.leave_type]) || []);
    const profileMap = new Map(profiles?.map(p => [p.id, p.full_name]) || []);

    const facultyDataList: FacultyData[] = memberIds.map(userId => ({
      userId,
      name: profileMap.get(userId) || "Unknown",
      entries: (entries?.filter(e => e.user_id === userId) || []).map(e => ({
        id: e.id,
        user_id: e.user_id,
        entry_date: dateStr,
        start_time: e.start_time,
        end_time: e.end_time,
        status: e.status,
        activity_type: e.activity_type,
        activity_subtype: null,
        notes: null,
      })),
      isOnLeave: leaveMap.has(userId),
      leaveType: leaveMap.get(userId),
    }));

    // Sort by name
    facultyDataList.sort((a, b) => a.name.localeCompare(b.name));

    setFacultyEntries(facultyDataList);
    setIsDayLoading(false);
  };

  const getDayBgClass = (day: DepartmentDayData) => {
    if (day.isWeekend) return "bg-muted border-border";
    if (day.averageCompletionRate >= 80) return "bg-green-500/20 border-green-500";
    if (day.averageCompletionRate >= 50) return "bg-yellow-500/20 border-yellow-500";
    if (day.averageCompletionRate >= 20) return "bg-orange-500/20 border-orange-500";
    return "bg-red-500/20 border-red-500";
  };

  const goToToday = () => setSelectedDay(new Date());
  const goToPrevDay = () => setSelectedDay(subDays(selectedDay, 1));
  const goToNextDay = () => setSelectedDay(addDays(selectedDay, 1));

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
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div className="flex items-center gap-4">
          {viewMode === "month" ? (
            <div>
              <CardTitle>Department Calendar - {format(month, "MMMM yyyy")}</CardTitle>
              <CardDescription>Total Members: {totalMembersCount}</CardDescription>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={goToPrevDay}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div>
                <CardTitle>{format(selectedDay, "EEEE, MMMM d, yyyy")}</CardTitle>
                <CardDescription>Total Members: {totalMembersCount}</CardDescription>
              </div>
              <Button variant="ghost" size="icon" onClick={goToNextDay}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {viewMode === "day" && (
            <>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    Select Date
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <CalendarComponent
                    mode="single"
                    selected={selectedDay}
                    onSelect={(date) => date && setSelectedDay(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <Button variant="outline" size="sm" onClick={goToToday}>
                Today
              </Button>
            </>
          )}
          <ViewToggle viewMode={viewMode} onViewModeChange={setViewMode} />
        </div>
      </CardHeader>
      <CardContent className="px-3 sm:px-6 py-4">
        {viewMode === "month" ? (
          <>
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
                  onClick={() => {
                    setSelectedDay(day.date);
                    setViewMode("day");
                  }}
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
          </>
        ) : (
          /* Day View - Faculty Matrix */
          <div className="space-y-4">
            {isDayLoading ? (
              <div className="text-center text-muted-foreground py-8">
                Loading day data...
              </div>
            ) : isWeekend(selectedDay) ? (
              <div className="text-center text-muted-foreground py-8">
                Weekend - No regular work hours
              </div>
            ) : facultyEntries.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                No faculty members in this department
              </div>
            ) : (
              <DayMatrixView
                date={selectedDay}
                facultyData={facultyEntries}
                showAllStatuses={true}
              />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
