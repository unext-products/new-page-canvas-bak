import { Button } from "@/components/ui/button";
import { CalendarDays, CalendarRange } from "lucide-react";
import { cn } from "@/lib/utils";

interface ViewToggleProps {
  viewMode: "month" | "day";
  onViewModeChange: (mode: "month" | "day") => void;
}

export function ViewToggle({ viewMode, onViewModeChange }: ViewToggleProps) {
  return (
    <div className="flex items-center rounded-lg border bg-muted/50 p-1">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onViewModeChange("month")}
        className={cn(
          "h-8 px-3 rounded-md",
          viewMode === "month" && "bg-background shadow-sm"
        )}
      >
        <CalendarRange className="h-4 w-4 mr-2" />
        Month
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onViewModeChange("day")}
        className={cn(
          "h-8 px-3 rounded-md",
          viewMode === "day" && "bg-background shadow-sm"
        )}
      >
        <CalendarDays className="h-4 w-4 mr-2" />
        Day
      </Button>
    </div>
  );
}
