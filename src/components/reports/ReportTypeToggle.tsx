import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, Building2 } from "lucide-react";

interface ReportTypeToggleProps {
  value: "faculty" | "department";
  onValueChange: (value: "faculty" | "department") => void;
}

export function ReportTypeToggle({ value, onValueChange }: ReportTypeToggleProps) {
  return (
    <Tabs value={value} onValueChange={(v) => onValueChange(v as "faculty" | "department")}>
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="faculty" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3">
          <User className="h-3 w-3 sm:h-4 sm:w-4 hidden sm:block" />
          <span className="sm:hidden">Faculty</span>
          <span className="hidden sm:inline">Faculty View</span>
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
