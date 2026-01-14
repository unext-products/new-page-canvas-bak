import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { HOUR_SLOTS, calculateSlotCoverage, getStatusBgColor } from "./HourSlots";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format } from "date-fns";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

export interface MatrixTimesheetEntry {
  id: string;
  user_id: string;
  entry_date: string;
  start_time: string;
  end_time: string;
  activity_type: string;
  activity_subtype: string | null;
  notes: string | null;
  status: string;
}

export interface FacultyData {
  userId: string;
  name: string;
  avatarUrl?: string | null;
  entries: MatrixTimesheetEntry[];
  isOnLeave: boolean;
  leaveType?: string;
}

interface DayMatrixViewProps {
  date: Date;
  facultyData: FacultyData[];
  onEntryClick?: (entry: MatrixTimesheetEntry, faculty: FacultyData) => void;
  showAllStatuses?: boolean;
  title?: string;
}

export function DayMatrixView({ 
  date, 
  facultyData, 
  onEntryClick, 
  showAllStatuses = false,
  title = "Day View"
}: DayMatrixViewProps) {
  const formatLeaveType = (type: string) => {
    const labels: Record<string, string> = {
      casual: "CL",
      sick: "SL",
      earned: "EL",
      half_day: "HD",
      comp_off: "CO",
      other: "OL",
    };
    return labels[type] || type;
  };

  // Process faculty data with slot coverage
  const processedData = useMemo(() => {
    return facultyData.map(faculty => {
      const slotData = HOUR_SLOTS.map(slot => {
        const coveringEntries = faculty.entries.filter(entry => {
          const { covered } = calculateSlotCoverage(entry.start_time, entry.end_time, slot.start, slot.end);
          return covered;
        }).map(entry => {
          const { percentage } = calculateSlotCoverage(entry.start_time, entry.end_time, slot.start, slot.end);
          return { ...entry, percentage };
        });
        
        return {
          ...slot,
          entries: coveringEntries,
        };
      });
      
      return {
        ...faculty,
        slots: slotData,
      };
    });
  }, [facultyData]);

  if (facultyData.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          No faculty data available for this date.
        </CardContent>
      </Card>
    );
  }

  return (
    <TooltipProvider>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">{title}</CardTitle>
          <CardDescription>
            {format(date, "EEEE, MMMM d, yyyy")} • {facultyData.length} {facultyData.length === 1 ? 'member' : 'members'}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="w-full">
            <div className="min-w-[900px]">
              {/* Header row with time slots */}
              <div className="flex border-b bg-muted/50 sticky top-0">
                <div className="w-48 min-w-48 p-3 font-medium text-sm border-r">
                  Faculty
                </div>
                {HOUR_SLOTS.map(slot => (
                  <div key={slot.start} className="flex-1 min-w-[80px] p-2 text-center text-xs font-medium border-r last:border-r-0">
                    {slot.label}
                  </div>
                ))}
              </div>

              {/* Faculty rows */}
              {processedData.map(faculty => (
                <div key={faculty.userId} className="flex border-b last:border-b-0 hover:bg-muted/30 transition-colors">
                  {/* Faculty info */}
                  <div className="w-48 min-w-48 p-3 border-r flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={faculty.avatarUrl || undefined} />
                      <AvatarFallback className="text-xs">
                        {faculty.name.split(" ").map(n => n[0]).join("")}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{faculty.name}</p>
                      {faculty.isOnLeave && (
                        <Badge variant="secondary" className="text-[10px] bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300">
                          {formatLeaveType(faculty.leaveType || "other")}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Time slots */}
                  {faculty.isOnLeave ? (
                    <div className="flex-1 flex items-center justify-center bg-blue-50/50 dark:bg-blue-900/20 p-2">
                      <span className="text-sm text-blue-600 dark:text-blue-400">On Leave</span>
                    </div>
                  ) : (
                    faculty.slots.map(slot => (
                      <div 
                        key={slot.start} 
                        className="flex-1 min-w-[80px] p-1 border-r last:border-r-0 flex items-center justify-center"
                      >
                        {slot.entries.length > 0 ? (
                          <div className="flex flex-wrap gap-0.5 justify-center">
                            {slot.entries.map(entry => (
                              <Tooltip key={entry.id}>
                                <TooltipTrigger asChild>
                                  <div
                                    className={cn(
                                      "h-8 w-full rounded text-xs flex items-center justify-center cursor-pointer transition-all hover:opacity-80",
                                      getStatusBgColor(entry.status),
                                      "border-l-3",
                                      entry.status === "approved" && "border-l-green-500",
                                      entry.status === "submitted" && "border-l-yellow-500",
                                      entry.status === "draft" && "border-l-gray-400",
                                      entry.status === "rejected" && "border-l-red-500"
                                    )}
                                    onClick={() => onEntryClick?.(entry, faculty)}
                                  >
                                    <span className="truncate px-1 capitalize text-[10px] font-medium">
                                      {entry.activity_type.slice(0, 4)}
                                    </span>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent side="top">
                                  <div className="text-sm max-w-xs">
                                    <p className="font-medium capitalize">{entry.activity_type.replace(/_/g, " ")}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {entry.start_time} - {entry.end_time}
                                    </p>
                                    <p className="text-xs capitalize mt-1">
                                      Status: {entry.status}
                                    </p>
                                    {entry.notes && (
                                      <p className="text-xs mt-1 text-muted-foreground truncate">
                                        {entry.notes}
                                      </p>
                                    )}
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            ))}
                          </div>
                        ) : (
                          <div className="h-8 w-full rounded bg-muted/30 border border-dashed border-muted-foreground/20" />
                        )}
                      </div>
                    ))
                  )}
                </div>
              ))}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>

          {/* Legend */}
          <div className="flex flex-wrap gap-4 p-4 text-xs justify-center border-t bg-muted/30">
            {showAllStatuses ? (
              <>
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
              </>
            ) : (
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded bg-yellow-500/20 border-l-2 border-yellow-500" />
                <span className="text-muted-foreground">Pending Approval</span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded bg-blue-100 dark:bg-blue-900/50 border border-blue-500" />
              <span className="text-muted-foreground">On Leave</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
