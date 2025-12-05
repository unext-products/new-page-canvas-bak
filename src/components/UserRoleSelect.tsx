import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLabels } from "@/contexts/LabelContext";

interface UserRoleSelectProps {
  value: string;
  onValueChange: (value: string) => void;
}

export function UserRoleSelect({ value, onValueChange }: UserRoleSelectProps) {
  const { roleLabel } = useLabels();

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger>
        <SelectValue placeholder="Select role" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="org_admin">{roleLabel("org_admin")}</SelectItem>
        <SelectItem value="program_manager">{roleLabel("program_manager")}</SelectItem>
        <SelectItem value="manager">{roleLabel("manager")}</SelectItem>
        <SelectItem value="member">{roleLabel("member")}</SelectItem>
      </SelectContent>
    </Select>
  );
}
