import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Calendar, Clock } from "lucide-react";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks, subMonths, startOfDay, endOfDay } from "date-fns";

export type PeriodType = "daily" | "weekly" | "monthly";

interface ReportPeriodSelectorProps {
  period: PeriodType;
  onPeriodChange: (period: PeriodType) => void;
  onDateRangeChange: (from: Date, to: Date) => void;
}

export function ReportPeriodSelector({
  period,
  onPeriodChange,
  onDateRangeChange,
}: ReportPeriodSelectorProps) {
  const applyPreset = (preset: string) => {
    const now = new Date();
    let dateFrom: Date;
    let dateTo: Date;

    switch (preset) {
      case "today":
        dateFrom = startOfDay(now);
        dateTo = endOfDay(now);
        break;
      case "thisWeek":
        dateFrom = startOfWeek(now, { weekStartsOn: 1 });
        dateTo = endOfWeek(now, { weekStartsOn: 1 });
        break;
      case "lastWeek":
        dateFrom = subWeeks(startOfWeek(now, { weekStartsOn: 1 }), 1);
        dateTo = endOfWeek(dateFrom, { weekStartsOn: 1 });
        break;
      case "thisMonth":
        dateFrom = startOfMonth(now);
        dateTo = endOfMonth(now);
        break;
      case "lastMonth":
        const lastMonth = subMonths(now, 1);
        dateFrom = startOfMonth(lastMonth);
        dateTo = endOfMonth(lastMonth);
        break;
      default:
        return;
    }

    onDateRangeChange(dateFrom, dateTo);
  };

  return (
    <div className="space-y-4">
      <Tabs value={period} onValueChange={(v) => onPeriodChange(v as PeriodType)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="daily">Daily</TabsTrigger>
          <TabsTrigger value="weekly">Weekly</TabsTrigger>
          <TabsTrigger value="monthly">Monthly</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex flex-wrap gap-2">
        {period === "daily" && (
          <>
            <Button variant="outline" size="sm" onClick={() => applyPreset("today")}>
              <Clock className="h-3 w-3 mr-1" />
              Today
            </Button>
          </>
        )}
        {period === "weekly" && (
          <>
            <Button variant="outline" size="sm" onClick={() => applyPreset("thisWeek")}>
              <Calendar className="h-3 w-3 mr-1" />
              This Week
            </Button>
            <Button variant="outline" size="sm" onClick={() => applyPreset("lastWeek")}>
              Last Week
            </Button>
          </>
        )}
        {period === "monthly" && (
          <>
            <Button variant="outline" size="sm" onClick={() => applyPreset("thisMonth")}>
              <Calendar className="h-3 w-3 mr-1" />
              This Month
            </Button>
            <Button variant="outline" size="sm" onClick={() => applyPreset("lastMonth")}>
              Last Month
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
