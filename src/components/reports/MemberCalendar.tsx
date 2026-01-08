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

export function MemberCalendar({ memberId, month }: MemberCalendarProps) {
  const [calendarData, setCalendarData] = useState<DayData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [targetHours, setTargetHours] = useState(8);

  useEffect(() => {
    loadCalendarData();
  }, [memberId, month]);

  const loadCalendarData = async () => {
    setIsLoading(true);

    const monthStart = startOfMonth(month);
    const monthEnd = endOfMonth(month);

    // Fetch org-level daily target setting as default
    const { data: settingsData } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "daily_target_minutes")
      .maybeSingle();
    
    const orgDefaultMinutes = settingsData?.value ? parseInt(settingsData.value) : 480;

    // Check for user-specific target settings (per-department)
    // First get user's departments, then check for any custom target
    const { data: userSettingsData } = await supabase
      .from("user_settings")
      .select("value")
      .eq("user_id", memberId)
      .eq("key", "daily_target_minutes");

    // If user has multiple department targets, use the average or first one found
    // For simplicity, use the first custom setting found (or sum approach later)
    let dailyTargetMinutes = orgDefaultMinutes;
    if (userSettingsData && userSettingsData.length > 0) {
      // Use the first custom target found
      const firstSetting = userSettingsData[0];
      if (firstSetting.value) {
        dailyTargetMinutes = parseInt(firstSetting.value);
      }
    }
    
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
                "min-h-[70px] sm:min-h-[90px] p-1 sm:p-2 rounded-md border transition-all",
                day.isWeekend ? "bg-muted/50 border-border" : "bg-background border-border",
                day.isOnLeave && "bg-blue-500/10 border-blue-500/30",
                "hover:shadow-md"
              )}
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
      </CardContent>
    </Card>
  );
}
