import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLabels } from "@/contexts/LabelContext";
import { useAuth } from "@/contexts/AuthContext";
import { getCreatableRoles } from "@/lib/roleMapping";

interface UserRoleSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  excludeSuperAdmin?: boolean;
}

export function UserRoleSelect({ value, onValueChange, excludeSuperAdmin = true }: UserRoleSelectProps) {
  const { roleLabel } = useLabels();
  const { userWithRole } = useAuth();

  // Get roles that the current user can create
  const creatableRoles = getCreatableRoles(userWithRole?.role || null);

  // Filter out super_admin if excludeSuperAdmin is true (default behavior for most UIs)
  const availableRoles = excludeSuperAdmin 
    ? creatableRoles.filter(role => role !== "super_admin")
    : creatableRoles;

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger>
        <SelectValue placeholder="Select role" />
      </SelectTrigger>
      <SelectContent>
        {availableRoles.includes("org_admin") && (
          <SelectItem value="org_admin">{roleLabel("org_admin")}</SelectItem>
        )}
        {availableRoles.includes("l3") && (
          <SelectItem value="l3">{roleLabel("l3")}</SelectItem>
        )}
        {availableRoles.includes("l2") && (
          <SelectItem value="l2">{roleLabel("l2")}</SelectItem>
        )}
        {availableRoles.includes("l1") && (
          <SelectItem value="l1">{roleLabel("l1")}</SelectItem>
        )}
      </SelectContent>
    </Select>
  );
}
