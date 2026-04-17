import { useEffect, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useLabels } from "@/contexts/LabelContext";

interface Program {
  id: string;
  name: string;
  code: string;
}

interface ProgramSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  departmentId?: string; // Legacy support
  verticalId?: string; // New hierarchy support
  disabled?: boolean;
  includeAll?: boolean;
  placeholder?: string;
}

export function ProgramSelect({ 
  value, 
  onValueChange, 
  departmentId, 
  verticalId,
  disabled = false,
  includeAll = false,
  placeholder 
}: ProgramSelectProps) {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { entityLabel } = useLabels();

  // Use verticalId if provided, otherwise fall back to departmentId
  // Treat "all" as no parent filter
  const rawParentId = verticalId || departmentId;
  const effectiveParentId = rawParentId === "all" ? undefined : rawParentId;
  const parentFieldName = verticalId ? "vertical_id" : "department_id";

  useEffect(() => {
    fetchPrograms();
  }, [effectiveParentId, verticalId, departmentId, includeAll]);

  const fetchPrograms = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from("programs")
        .select("id, name, code")
        .order("name");

      // Only filter by parent if one is provided
      if (effectiveParentId) {
        query = query.eq(parentFieldName, effectiveParentId);
      }

      const { data, error } = await query;
      if (error) throw error;
      setPrograms(data || []);
    } catch (error) {
      console.error("Error fetching programs:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const parentLabel = verticalId ? entityLabel("vertical") : entityLabel("department");
  const isDisabled = isLoading || disabled || (!effectiveParentId && !includeAll);

  return (
    <Select value={value} onValueChange={onValueChange} disabled={isDisabled}>
      <SelectTrigger>
        <SelectValue placeholder={
          isLoading ? "Loading..." : 
          (!effectiveParentId && !includeAll) ? `Select a ${parentLabel.toLowerCase()} first` : 
          placeholder || `Select ${entityLabel("program").toLowerCase()}`
        } />
      </SelectTrigger>
      <SelectContent>
        {includeAll && <SelectItem value="all">All {entityLabel("program", true)}</SelectItem>}
        {programs.map((program) => (
          <SelectItem key={program.id} value={program.id}>
            {program.name} ({program.code})
          </SelectItem>
        ))}
        {programs.length === 0 && effectiveParentId && !isLoading && (
          <div className="px-2 py-1.5 text-sm text-muted-foreground">
            No {entityLabel("program", true).toLowerCase()} found
          </div>
        )}
      </SelectContent>
    </Select>
  );
}
