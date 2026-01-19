import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { HOUR_SLOTS, calculateSlotCoverage, getStatusBgColor } from "./HourSlots";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format } from "date-fns";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle, XCircle } from "lucide-react";

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
  vertical_code?: string | null;
  program_code?: string | null;
  batch_name?: string | null;
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
  onApprove?: (entry: MatrixTimesheetEntry) => void;
  onReject?: (entry: MatrixTimesheetEntry) => void;
  showAllStatuses?: boolean;
  title?: string;
  // Selection props
  selectedEntries?: Set<string>;
  onSelectionChange?: (entryId: string, selected: boolean) => void;
  showSelection?: boolean;
}

export function DayMatrixView({ 
  date, 
  facultyData, 
  onEntryClick,
  onApprove,
  onReject,
  showAllStatuses = false,
  title = "Day View",
  selectedEntries,
  onSelectionChange,
  showSelection = false,
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

  // Get total entry count for selection display
  const totalEntries = useMemo(() => {
    return facultyData.reduce((sum, faculty) => sum + faculty.entries.length, 0);
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
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">{title}</CardTitle>
              <CardDescription>
                {format(date, "EEEE, MMMM d, yyyy")} • {facultyData.length} {facultyData.length === 1 ? 'member' : 'members'} • {totalEntries} {totalEntries === 1 ? 'entry' : 'entries'}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="w-full">
            <div className="min-w-[900px]">
              {/* Header row with time slots */}
              <div className="flex border-b bg-muted/50 sticky top-0 z-10">
                <div className="w-52 min-w-52 p-3 font-medium text-sm border-r flex items-center gap-2">
                  {showSelection && (
                    <div className="w-5" /> /* Placeholder for checkbox alignment */
                  )}
                  <span>Faculty</span>
                </div>
                {HOUR_SLOTS.map(slot => (
                  <div key={slot.start} className="flex-1 min-w-[100px] p-2 text-center text-xs font-medium border-r last:border-r-0">
                    {slot.label}
                  </div>
                ))}
              </div>

              {/* Faculty rows */}
              {processedData.map(faculty => (
                <div key={faculty.userId} className="flex border-b last:border-b-0 hover:bg-muted/30 transition-colors min-h-[60px]">
                  {/* Faculty info */}
                  <div className="w-52 min-w-52 p-2 border-r flex items-center gap-2">
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarImage src={faculty.avatarUrl || undefined} />
                      <AvatarFallback className="text-xs">
                        {faculty.name.split(" ").map(n => n[0]).join("")}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
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
                        className="flex-1 min-w-[100px] p-0.5 border-r last:border-r-0 flex flex-col gap-0.5"
                      >
                        {slot.entries.length > 0 ? (
                          slot.entries.map(entry => {
                            const isSelected = selectedEntries?.has(entry.id) ?? false;
                            return (
                              <div
                                key={entry.id}
                                className={cn(
                                  "relative rounded text-xs flex items-center transition-all group min-h-[52px] overflow-hidden",
                                  getStatusBgColor(entry.status),
                                  "border-l-[3px]",
                                  entry.status === "approved" && "border-l-green-500",
                                  entry.status === "submitted" && "border-l-yellow-500",
                                  entry.status === "draft" && "border-l-gray-400",
                                  entry.status === "rejected" && "border-l-red-500",
                                  isSelected && "ring-2 ring-primary ring-offset-1"
                                )}
                              >
                                {/* Selection checkbox */}
                                {showSelection && (
                                  <div className="absolute top-1 left-1 z-10">
                                    <Checkbox
                                      checked={isSelected}
                                      onCheckedChange={(checked) => {
                                        onSelectionChange?.(entry.id, checked === true);
                                      }}
                                      className="h-4 w-4 bg-background/80"
                                    />
                                  </div>
                                )}
                                
                                {/* Entry content - truncated with vertical/program */}
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div 
                                      className={cn(
                                        "flex-1 min-w-0 flex flex-col justify-center cursor-pointer px-2 py-1",
                                        showSelection && "pl-7"
                                      )}
                                      onClick={() => onEntryClick?.(entry, faculty)}
                                    >
                                      <span className="font-medium capitalize text-xs leading-tight truncate">
                                        {entry.activity_type.replace(/_/g, " ")}
                                      </span>
                                      <span className="text-[10px] text-muted-foreground leading-tight truncate">
                                        {entry.vertical_code || "-"} • {entry.batch_name || "-"}
                                      </span>
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="max-w-xs">
                                    <div className="text-sm">
                                      <p className="font-medium capitalize">{entry.activity_type.replace(/_/g, " ")}</p>
                                      {entry.activity_subtype && (
                                        <p className="text-xs text-muted-foreground">{entry.activity_subtype}</p>
                                      )}
                                      <p className="text-xs text-muted-foreground">
                                        {entry.start_time} - {entry.end_time}
                                      </p>
                                      <p className="text-xs mt-1">
                                        Vertical: {entry.vertical_code || "-"} • Batch: {entry.batch_name || "-"}
                                      </p>
                                      <p className="text-xs capitalize mt-1">
                                        Status: <span className={cn(
                                          entry.status === "approved" && "text-green-600",
                                          entry.status === "submitted" && "text-yellow-600",
                                          entry.status === "rejected" && "text-red-600"
                                        )}>{entry.status}</span>
                                      </p>
                                      {entry.notes && (
                                        <p className="text-xs mt-1 text-muted-foreground line-clamp-2">
                                          {entry.notes}
                                        </p>
                                      )}
                                    </div>
                                  </TooltipContent>
                                </Tooltip>

                                {/* Inline action buttons - fixed to not overflow */}
                                {(onApprove || onReject) && entry.status === "submitted" && (
                                  <div className="flex flex-col gap-0.5 pr-1 shrink-0 flex-none">
                                    {onApprove && (
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            size="icon"
                                            variant="ghost"
                                            className="h-5 w-5 bg-green-500/20 hover:bg-green-500/40 text-green-700 dark:text-green-400"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              onApprove(entry);
                                            }}
                                          >
                                            <CheckCircle className="h-3 w-3" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent side="top">
                                          <p>Approve</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    )}
                                    {onReject && (
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            size="icon"
                                            variant="ghost"
                                            className="h-5 w-5 bg-red-500/20 hover:bg-red-500/40 text-red-700 dark:text-red-400"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              onReject(entry);
                                            }}
                                          >
                                            <XCircle className="h-3 w-3" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent side="top">
                                          <p>Reject</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })
                        ) : (
                          <div className="h-[52px] w-full rounded bg-muted/30 border border-dashed border-muted-foreground/20" />
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
            {showSelection && (
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded ring-2 ring-primary ring-offset-1" />
                <span className="text-muted-foreground">Selected</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
