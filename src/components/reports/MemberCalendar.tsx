import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend, addDays, subDays } from "date-fns";
import { cn } from "@/lib/utils";
import { calculateUserTotalDailyTargetMinutes } from "@/lib/targets";
import { ViewToggle } from "@/components/calendar/ViewToggle";
import { HOUR_SLOTS, calculateSlotCoverage, getStatusColor, getStatusBgColor, getStatusBorderColor } from "@/components/calendar/HourSlots";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";

interface MemberCalendarProps {
  memberId: string;
  month: Date;
}

type HourSlotStatus = 'empty' | 'pending' | 'approved' | 'rejected';

interface HourSlot {
  status: HourSlotStatus;
}

interface DayData {
  date: Date;
  totalHours: number;
  entryCount: number;
  isOnLeave: boolean;
  leaveType?: string;
  isWeekend: boolean;
  hourSlots: HourSlot[];
  targetHours: number;
}

interface TimesheetEntry {
  id: string;
  entry_date: string;
  start_time: string;
  end_time: string;
  status: string;
  activity_type: string;
  notes?: string;
}

export function MemberCalendar({ memberId, month }: MemberCalendarProps) {
  const [calendarData, setCalendarData] = useState<DayData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [targetHours, setTargetHours] = useState(8);
  const [viewMode, setViewMode] = useState<"month" | "day">("month");
  const [selectedDay, setSelectedDay] = useState<Date>(new Date());
  const [dayEntries, setDayEntries] = useState<TimesheetEntry[]>([]);
  const [dayLeave, setDayLeave] = useState<{ leave_type: string } | null>(null);

  useEffect(() => {
    loadCalendarData();
  }, [memberId, month]);

  useEffect(() => {
    if (viewMode === "day") {
      loadDayData();
    }
  }, [memberId, selectedDay, viewMode]);

  const loadCalendarData = async () => {
    setIsLoading(true);

    const monthStart = startOfMonth(month);
    const monthEnd = endOfMonth(month);

    // Use the centralized target resolver to get user's total daily target
    const targetBreakdown = await calculateUserTotalDailyTargetMinutes(memberId);
    const dailyTargetMinutes = targetBreakdown.totalDailyTargetMinutes;
    const targetHoursValue = Math.ceil(dailyTargetMinutes / 60);
    setTargetHours(targetHoursValue);

    // Fetch timesheet entries for the month
    const { data: entries } = await supabase
      .from("timesheet_entries")
      .select("entry_date, start_time, end_time, status")
      .eq("user_id", memberId)
      .gte("entry_date", format(monthStart, "yyyy-MM-dd"))
      .lte("entry_date", format(monthEnd, "yyyy-MM-dd"))
      .order("start_time", { ascending: true });

    // Fetch leave days
    const { data: leaves } = await supabase
      .from("leave_days")
      .select("leave_date, leave_type")
      .eq("user_id", memberId)
      .gte("leave_date", format(monthStart, "yyyy-MM-dd"))
      .lte("leave_date", format(monthEnd, "yyyy-MM-dd"));

    // Helper function to calculate duration in minutes from start and end time
    const calculateDuration = (startTime: string, endTime: string): number => {
      const [startH, startM] = startTime.split(':').map(Number);
      const [endH, endM] = endTime.split(':').map(Number);
      return (endH * 60 + endM) - (startH * 60 + startM);
    };

    // Build calendar data
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
    const leaveMap = new Map<string, string>();
    leaves?.forEach((leave) => {
      leaveMap.set(leave.leave_date, leave.leave_type);
    });

    const data: DayData[] = days.map(date => {
      const dateStr = format(date, "yyyy-MM-dd");
      const dayEntries = entries?.filter(e => e.entry_date === dateStr) || [];
      const totalMinutes = dayEntries
        .filter(e => e.status === "approved" || e.status === "submitted")
        .reduce((sum, e) => sum + calculateDuration(e.start_time, e.end_time), 0);
      const totalHours = totalMinutes / 60;
      const isOnLeave = leaveMap.has(dateStr);
      const isWeekendDay = isWeekend(date);

      // Create hour slots based on target hours
      const hourSlots: HourSlot[] = Array.from({ length: targetHoursValue }, () => ({
        status: 'empty' as HourSlotStatus
      }));

      // Fill hour slots based on entries (chronologically by start_time)
      if (!isWeekendDay && !isOnLeave) {
        let slotIndex = 0;
        for (const entry of dayEntries) {
          if (slotIndex >= targetHoursValue) break;
          
          const durationMinutes = calculateDuration(entry.start_time, entry.end_time);
          const durationHours = Math.ceil(durationMinutes / 60);
          
          const status: HourSlotStatus = 
            entry.status === 'approved' ? 'approved' :
            entry.status === 'rejected' ? 'rejected' :
            entry.status === 'submitted' ? 'pending' : 'empty';
          
          for (let i = 0; i < durationHours && slotIndex < targetHoursValue; i++) {
            hourSlots[slotIndex] = { status };
            slotIndex++;
          }
        }
      }

      return {
        date,
        totalHours,
        entryCount: dayEntries.length,
        isOnLeave,
        leaveType: leaveMap.get(dateStr),
        isWeekend: isWeekendDay,
        hourSlots,
        targetHours: targetHoursValue,
      };
    });

    setCalendarData(data);
    setIsLoading(false);
  };

  const loadDayData = async () => {
    const dateStr = format(selectedDay, "yyyy-MM-dd");
    
    const [entriesResult, leaveResult] = await Promise.all([
      supabase
        .from("timesheet_entries")
        .select("id, entry_date, start_time, end_time, status, activity_type, notes")
        .eq("user_id", memberId)
        .eq("entry_date", dateStr)
        .order("start_time", { ascending: true }),
      supabase
        .from("leave_days")
        .select("leave_type")
        .eq("user_id", memberId)
        .eq("leave_date", dateStr)
        .maybeSingle()
    ]);

    setDayEntries(entriesResult.data || []);
    setDayLeave(leaveResult.data);
  };

  const getDotColor = (status: HourSlotStatus) => {
    switch (status) {
      case "approved":
        return "bg-green-500";
      case "pending":
        return "bg-yellow-500";
      case "rejected":
        return "bg-red-500";
      default:
        return "bg-gray-300";
    }
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

  // Get first day of month to calculate offset
  const firstDayOfMonth = startOfMonth(month);
  const startDayOfWeek = firstDayOfMonth.getDay();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div className="flex items-center gap-4">
          {viewMode === "month" ? (
            <CardTitle>Monthly Calendar - {format(month, "MMMM yyyy")}</CardTitle>
          ) : (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={goToPrevDay}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <CardTitle>{format(selectedDay, "EEEE, MMMM d, yyyy")}</CardTitle>
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
      <CardContent>
        {viewMode === "month" ? (
          <>
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
                    "min-h-[70px] sm:min-h-[90px] p-1 sm:p-2 rounded-md border transition-all cursor-pointer",
                    day.isWeekend ? "bg-muted/50 border-border" : "bg-background border-border",
                    day.isOnLeave && "bg-blue-500/10 border-blue-500/30",
                    "hover:shadow-md"
                  )}
                  onClick={() => {
                    setSelectedDay(day.date);
                    setViewMode("day");
                  }}
                >
                  <div className="text-xs sm:text-sm font-medium mb-1">
                    {format(day.date, "d")}
                  </div>

                  {day.isOnLeave && (
                    <Badge variant="outline" className="text-[10px] sm:text-xs mb-1 px-1 bg-blue-500/20 border-blue-500">
                      Leave
                    </Badge>
                  )}

                  {!day.isWeekend && !day.isOnLeave && (
                    <div className="space-y-1">
                      {/* Hour dots */}
                      <div className="flex flex-wrap gap-0.5">
                        {day.hourSlots.map((slot, idx) => (
                          <div
                            key={idx}
                            className={cn(
                              "w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full transition-colors",
                              getDotColor(slot.status)
                            )}
                            title={`Hour ${idx + 1}: ${slot.status}`}
                          />
                        ))}
                      </div>
                      {/* Summary text */}
                      {day.entryCount > 0 && (
                        <div className="text-[9px] sm:text-[10px] text-muted-foreground">
                          {day.totalHours.toFixed(1)}h • {day.entryCount} {day.entryCount === 1 ? "entry" : "entries"}
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
                <div className="w-3 h-3 rounded-full bg-gray-300" />
                <span>No entry</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <span>Pending</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span>Approved</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <span>Rejected</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-blue-500/20 border border-blue-500" />
                <span>On Leave</span>
              </div>
              <div className="flex items-center gap-2 ml-auto text-muted-foreground">
                <span>Daily target: {targetHours}h ({targetHours} dots/day)</span>
              </div>
            </div>
          </>
        ) : (
          /* Day View - Hourly Slots */
          <div className="space-y-4">
            {/* Leave indicator */}
            {dayLeave && (
              <div className="p-4 rounded-lg bg-blue-500/20 border border-blue-500 text-center">
                <Badge className="bg-blue-500 text-white">On Leave - {dayLeave.leave_type}</Badge>
              </div>
            )}

            {/* Hourly slots */}
            {!dayLeave && (
              <>
                <div className="flex gap-1 sm:gap-2 overflow-x-auto pb-2">
                  {HOUR_SLOTS.map((slot) => {
                    // Find entries that cover this slot
                    const slotEntries = dayEntries.filter((entry) => {
                      const { covered } = calculateSlotCoverage(
                        entry.start_time,
                        entry.end_time,
                        slot.start,
                        slot.end
                      );
                      return covered;
                    });

                    return (
                      <div
                        key={slot.start}
                        className="flex-1 min-w-[80px] sm:min-w-[100px]"
                      >
                        <div className="text-xs text-center text-muted-foreground mb-1 font-medium">
                          {slot.label}
                        </div>
                        <div
                          className={cn(
                            "h-16 sm:h-20 rounded-lg border-2 p-1 relative overflow-hidden",
                            slotEntries.length === 0
                              ? "bg-muted/30 border-dashed border-border"
                              : "border-solid"
                          )}
                        >
                          {slotEntries.map((entry, idx) => {
                            const { percentage } = calculateSlotCoverage(
                              entry.start_time,
                              entry.end_time,
                              slot.start,
                              slot.end
                            );
                            return (
                              <div
                                key={entry.id}
                                className={cn(
                                  "absolute inset-0 flex items-center justify-center text-[10px] sm:text-xs font-medium rounded-md border-2",
                                  getStatusBgColor(entry.status),
                                  getStatusBorderColor(entry.status)
                                )}
                                style={{ opacity: percentage / 100 * 0.5 + 0.5 }}
                                title={`${entry.start_time} - ${entry.end_time}: ${entry.activity_type}`}
                              >
                                <span className="truncate px-1 capitalize">
                                  {entry.activity_type}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Entries list for the day */}
                {dayEntries.length > 0 && (
                  <div className="border rounded-lg p-4 space-y-2">
                    <h4 className="font-medium text-sm">Entries for this day</h4>
                    <div className="space-y-2">
                      {dayEntries.map((entry) => (
                        <div
                          key={entry.id}
                          className={cn(
                            "flex items-center justify-between p-2 rounded-md text-sm",
                            getStatusBgColor(entry.status)
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-medium capitalize">{entry.activity_type}</span>
                            <span className="text-muted-foreground">
                              {entry.start_time} - {entry.end_time}
                            </span>
                          </div>
                          <Badge
                            variant="outline"
                            className={cn(
                              "capitalize",
                              entry.status === "approved" && "border-green-500 text-green-700",
                              entry.status === "submitted" && "border-yellow-500 text-yellow-700",
                              entry.status === "rejected" && "border-red-500 text-red-700"
                            )}
                          >
                            {entry.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {dayEntries.length === 0 && !isWeekend(selectedDay) && (
                  <div className="text-center text-muted-foreground py-8">
                    No entries logged for this day
                  </div>
                )}

                {isWeekend(selectedDay) && (
                  <div className="text-center text-muted-foreground py-8">
                    Weekend
                  </div>
                )}
              </>
            )}

            {/* Legend */}
            <div className="flex flex-wrap gap-3 sm:gap-4 text-xs sm:text-sm border-t pt-4">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-yellow-500/20 border-2 border-yellow-600" />
                <span>Pending</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-green-500/20 border-2 border-green-600" />
                <span>Approved</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-red-500/20 border-2 border-red-600" />
                <span>Rejected</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-blue-500/20 border-2 border-blue-500" />
                <span>On Leave</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
