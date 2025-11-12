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
        <TabsTrigger value="faculty" className="flex items-center gap-2">
          <User className="h-4 w-4" />
          Faculty View
        </TabsTrigger>
        <TabsTrigger value="department" className="flex items-center gap-2">
          <Building2 className="h-4 w-4" />
          Department View
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
