import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { roleLabels, type DisplayRole } from "@/lib/roleMapping";

interface UserRoleSelectProps {
  value: string;
  onValueChange: (value: string) => void;
}

export function UserRoleSelect({ value, onValueChange }: UserRoleSelectProps) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger>
        <SelectValue placeholder="Select role" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="org_admin">{roleLabels.org_admin}</SelectItem>
        <SelectItem value="program_manager">{roleLabels.program_manager}</SelectItem>
        <SelectItem value="manager">{roleLabels.manager}</SelectItem>
        <SelectItem value="member">{roleLabels.member}</SelectItem>
      </SelectContent>
    </Select>
  );
}
