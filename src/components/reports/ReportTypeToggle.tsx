import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, Building2 } from "lucide-react";

interface ReportTypeToggleProps {
  value: "member" | "department";
  onValueChange: (value: "member" | "department") => void;
}

export function ReportTypeToggle({ value, onValueChange }: ReportTypeToggleProps) {
  return (
    <Tabs value={value} onValueChange={(v) => onValueChange(v as "member" | "department")}>
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="member" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3">
          <User className="h-3 w-3 sm:h-4 sm:w-4 hidden sm:block" />
          <span className="sm:hidden">Member</span>
          <span className="hidden sm:inline">Member View</span>
        </TabsTrigger>
        <TabsTrigger value="department" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3">
          <Building2 className="h-3 w-3 sm:h-4 sm:w-4 hidden sm:block" />
          <span className="sm:hidden">Department</span>
          <span className="hidden sm:inline">Department View</span>
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
