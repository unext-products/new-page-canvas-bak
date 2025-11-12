import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { UserRole } from "@/lib/supabase";

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
        <SelectItem value="admin">Admin</SelectItem>
        <SelectItem value="hod">HOD</SelectItem>
        <SelectItem value="faculty">Faculty</SelectItem>
      </SelectContent>
    </Select>
  );
}
