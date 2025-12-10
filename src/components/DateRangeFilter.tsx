import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarIcon } from "lucide-react";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { cn } from "@/lib/utils";

export type DateFilterType = "today" | "week" | "month" | "custom";

export interface DateRange {
  from: Date;
  to: Date;
}

interface DateRangeFilterProps {
  value: DateFilterType;
  onChange: (type: DateFilterType, range: DateRange) => void;
  customRange?: DateRange;
}

export function DateRangeFilter({ value, onChange, customRange }: DateRangeFilterProps) {
  const [customFrom, setCustomFrom] = useState<Date | undefined>(customRange?.from);
  const [customTo, setCustomTo] = useState<Date | undefined>(customRange?.to);

  const getDateRange = (type: DateFilterType): DateRange => {
    const today = new Date();
    switch (type) {
      case "today":
        return { from: startOfDay(today), to: endOfDay(today) };
      case "week":
        return { from: startOfWeek(today, { weekStartsOn: 1 }), to: endOfWeek(today, { weekStartsOn: 1 }) };
      case "month":
        return { from: startOfMonth(today), to: endOfMonth(today) };
      case "custom":
        return customFrom && customTo 
          ? { from: customFrom, to: customTo }
          : { from: startOfDay(today), to: endOfDay(today) };
    }
  };

  const handleTypeChange = (type: DateFilterType) => {
    onChange(type, getDateRange(type));
  };

  const handleCustomDateChange = (from: Date | undefined, to: Date | undefined) => {
    setCustomFrom(from);
    setCustomTo(to);
    if (from && to) {
      onChange("custom", { from, to });
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={value} onValueChange={(v) => handleTypeChange(v as DateFilterType)}>
        <SelectTrigger className="w-[140px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="today">Today</SelectItem>
          <SelectItem value="week">This Week</SelectItem>
          <SelectItem value="month">This Month</SelectItem>
          <SelectItem value="custom">Custom Range</SelectItem>
        </SelectContent>
      </Select>

      {value === "custom" && (
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-[130px] justify-start text-left font-normal",
                  !customFrom && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {customFrom ? format(customFrom, "dd/MM/yyyy") : "From"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={customFrom}
                onSelect={(date) => handleCustomDateChange(date, customTo)}
                initialFocus
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
          <span className="text-muted-foreground">to</span>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-[130px] justify-start text-left font-normal",
                  !customTo && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {customTo ? format(customTo, "dd/MM/yyyy") : "To"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={customTo}
                onSelect={(date) => handleCustomDateChange(customFrom, date)}
                disabled={(date) => customFrom ? date < customFrom : false}
                initialFocus
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>
      )}
    </div>
  );
}
