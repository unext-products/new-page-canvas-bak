import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { HOUR_SLOTS, calculateSlotCoverage, getStatusColor, getStatusBgColor, timeToMinutes } from "./HourSlots";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format } from "date-fns";
import { Clock, CheckCircle } from "lucide-react";
import { calculateDurationMinutes } from "@/lib/timesheetUtils";

interface TimesheetEntry {
  id: string;
  entry_date: string;
  start_time: string;
  end_time: string;
  activity_type: string;
  activity_subtype: string | null;
  notes: string | null;
  status: string;
}

interface LeaveEntry {
  id: string;
  leave_date: string;
  leave_type: string;
}

interface DayHourlyViewProps {
  date: Date;
  entries: TimesheetEntry[];
  leaveEntry?: LeaveEntry;
  onSlotClick?: (startTime: string, endTime: string) => void;
  readOnly?: boolean;
  showTotals?: boolean;
}

export function DayHourlyView({ date, entries, leaveEntry, onSlotClick, readOnly = false, showTotals = false }: DayHourlyViewProps) {
  const formatLeaveType = (type: string) => {
    const labels: Record<string, string> = {
      casual: "Casual Leave",
      sick: "Sick Leave",
      earned: "Earned Leave",
      half_day: "Half Day",
      comp_off: "Comp Off",
      other: "Other Leave",
    };
    return labels[type] || type;
  };

  // Calculate which entries cover which slots
  const slotData = useMemo(() => {
    return HOUR_SLOTS.map(slot => {
      const coveringEntries = entries.filter(entry => {
        const { covered } = calculateSlotCoverage(entry.start_time, entry.end_time, slot.start, slot.end);
        return covered;
      }).map(entry => {
        const { percentage } = calculateSlotCoverage(entry.start_time, entry.end_time, slot.start, slot.end);
        return { ...entry, percentage };
      });
      
      return {
        ...slot,
        entries: coveringEntries,
        isEmpty: coveringEntries.length === 0,
      };
    });
  }, [entries]);

  const isWeekend = date.getDay() === 0 || date.getDay() === 6;
  const isFuture = date > new Date();

  // Calculate total hours for the day
  const { totalAppliedMinutes, totalApprovedMinutes } = useMemo(() => {
    let applied = 0;
    let approved = 0;
    
    entries.forEach(entry => {
      const duration = calculateDurationMinutes(entry.start_time, entry.end_time);
      applied += duration;
      if (entry.status === "approved") {
        approved += duration;
      }
    });
    
    return { totalAppliedMinutes: applied, totalApprovedMinutes: approved };
  }, [entries]);

  const formatHours = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0 && mins === 0) return "0h";
    if (hours === 0) return `${mins}m`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
  };

  if (leaveEntry) {
    return (
      <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-900/20 dark:border-blue-800">
        <CardContent className="py-6">
          <div className="flex items-center justify-center gap-3">
            <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300 text-base py-1 px-3">
              {formatLeaveType(leaveEntry.leave_type)}
            </Badge>
            <span className="text-muted-foreground">No timesheet entries on leave days</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <TooltipProvider>
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-col gap-3">
            {/* Total Hours Summary */}
            {showTotals && entries.length > 0 && (
              <div className="flex items-center justify-center gap-6 pb-3 border-b">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Total Applied:</span>
                  <Badge variant="secondary">{formatHours(totalAppliedMinutes)}</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm text-muted-foreground">Total Approved:</span>
                  <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300">
                    {formatHours(totalApprovedMinutes)}
                  </Badge>
                </div>
              </div>
            )}
            
            {/* Hour slots header */}
            <div className="flex gap-1 overflow-x-auto pb-2">
              {HOUR_SLOTS.map((slot, index) => (
                <div key={slot.start} className="flex-1 min-w-[80px] text-center">
                  <span className="text-xs text-muted-foreground font-medium">
                    {slot.label}
                  </span>
                </div>
              ))}
            </div>

            {/* Slots grid */}
            <div className="flex gap-1 overflow-x-auto min-h-[60px]">
              {slotData.map((slot, index) => (
                <Tooltip key={slot.start}>
                  <TooltipTrigger asChild>
                    <div
                      className={cn(
                        "flex-1 min-w-[80px] min-h-[60px] rounded-lg border-2 border-dashed transition-all relative overflow-hidden",
                        slot.isEmpty && !isWeekend && !isFuture && !readOnly && "hover:border-primary hover:bg-primary/5 cursor-pointer",
                        slot.isEmpty && "border-muted-foreground/20 bg-muted/30",
                        !slot.isEmpty && "border-transparent",
                        (isWeekend || isFuture || readOnly) && slot.isEmpty && "cursor-not-allowed opacity-60"
                      )}
                      onClick={() => {
                        if (!readOnly && !isWeekend && !isFuture && slot.isEmpty && onSlotClick) {
                          onSlotClick(slot.start, slot.end);
                        }
                      }}
                    >
                      {/* Entry blocks */}
                      {slot.entries.map((entry, entryIndex) => (
                        <div
                          key={entry.id}
                          className={cn(
                            "absolute inset-0 flex items-center justify-center",
                            getStatusBgColor(entry.status),
                            "border-l-4",
                            entry.status === "approved" && "border-l-green-500",
                            entry.status === "submitted" && "border-l-yellow-500",
                            entry.status === "draft" && "border-l-gray-400",
                            entry.status === "rejected" && "border-l-red-500"
                          )}
                        >
                          <span className="text-xs font-medium capitalize truncate px-1">
                            {entry.activity_type.replace(/_/g, " ")}
                          </span>
                        </div>
                      ))}
                      
                      {/* Empty slot indicator */}
                      {slot.isEmpty && !isWeekend && !isFuture && !readOnly && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-xs text-muted-foreground">+</span>
                        </div>
                      )}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="text-sm">
                      <p className="font-medium">{slot.start} - {slot.end}</p>
                      {slot.entries.length > 0 ? (
                        slot.entries.map(entry => (
                          <div key={entry.id} className="mt-1">
                            <p className="capitalize">{entry.activity_type.replace(/_/g, " ")}</p>
                            <p className="text-xs text-muted-foreground">
                              {entry.start_time} - {entry.end_time} ({entry.status})
                            </p>
                          </div>
                        ))
                      ) : (
                        <p className="text-muted-foreground">
                          {isWeekend ? "Weekend" : isFuture ? "Future date" : readOnly ? "No entry" : "Click to add entry"}
                        </p>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-4 mt-2 text-xs justify-center border-t pt-3">
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded bg-green-500/20 border-l-2 border-green-500" />
                <span className="text-muted-foreground">Approved</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded bg-yellow-500/20 border-l-2 border-yellow-500" />
                <span className="text-muted-foreground">Pending</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded bg-gray-400/20 border-l-2 border-gray-400" />
                <span className="text-muted-foreground">Draft</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded bg-red-500/20 border-l-2 border-red-500" />
                <span className="text-muted-foreground">Rejected</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
