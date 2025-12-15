import { useEffect, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useLabels } from "@/contexts/LabelContext";

interface Department {
  id: string;
  name: string;
  code: string;
}

interface DepartmentSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  includeAll?: boolean;
  disabled?: boolean;
  departmentIds?: string[]; // Filter to only these department IDs
}

export function DepartmentSelect({ value, onValueChange, includeAll = false, disabled = false, departmentIds }: DepartmentSelectProps) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { entityLabel } = useLabels();

  useEffect(() => {
    fetchDepartments();
  }, [departmentIds]);

  const fetchDepartments = async () => {
    try {
      let query = supabase
        .from("departments")
        .select("id, name, code")
        .order("name");

      // Filter by department IDs if provided
      if (departmentIds && departmentIds.length > 0) {
        query = query.in("id", departmentIds);
      }

      const { data, error } = await query;

      if (error) throw error;
      setDepartments(data || []);
    } catch (error) {
      console.error("Error fetching departments:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Select value={value} onValueChange={onValueChange} disabled={isLoading || disabled}>
      <SelectTrigger>
        <SelectValue placeholder={isLoading ? "Loading..." : `Select ${entityLabel("department").toLowerCase()}`} />
      </SelectTrigger>
      <SelectContent>
        {includeAll && <SelectItem value="all">All {entityLabel("department", true)}</SelectItem>}
        {departments.map((dept) => (
          <SelectItem key={dept.id} value={dept.id}>
            {dept.name} ({dept.code})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
