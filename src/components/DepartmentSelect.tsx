import { useEffect, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";

interface Department {
  id: string;
  name: string;
  code: string;
}

interface DepartmentSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  includeAll?: boolean;
}

export function DepartmentSelect({ value, onValueChange, includeAll = false }: DepartmentSelectProps) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchDepartments();
  }, []);

  const fetchDepartments = async () => {
    try {
      const { data, error } = await supabase
        .from("departments")
        .select("id, name, code")
        .order("name");

      if (error) throw error;
      setDepartments(data || []);
    } catch (error) {
      console.error("Error fetching departments:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Select value={value} onValueChange={onValueChange} disabled={isLoading}>
      <SelectTrigger>
        <SelectValue placeholder={isLoading ? "Loading..." : "Select department"} />
      </SelectTrigger>
      <SelectContent>
        {includeAll && <SelectItem value="all">All Departments</SelectItem>}
        {departments.map((dept) => (
          <SelectItem key={dept.id} value={dept.id}>
            {dept.name} ({dept.code})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
