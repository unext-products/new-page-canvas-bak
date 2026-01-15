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
  const effectiveParentId = verticalId || departmentId;
  const parentFieldName = verticalId ? "vertical_id" : "department_id";

  useEffect(() => {
    if (effectiveParentId) {
      fetchPrograms();
    } else {
      setPrograms([]);
      setIsLoading(false);
    }
  }, [effectiveParentId, verticalId, departmentId]);

  const fetchPrograms = async () => {
    if (!effectiveParentId) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("programs")
        .select("id, name, code")
        .eq(parentFieldName, effectiveParentId)
        .order("name");

      if (error) throw error;
      setPrograms(data || []);
    } catch (error) {
      console.error("Error fetching programs:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const parentLabel = verticalId ? entityLabel("vertical") : entityLabel("department");

  return (
    <Select value={value} onValueChange={onValueChange} disabled={isLoading || disabled || !effectiveParentId}>
      <SelectTrigger>
        <SelectValue placeholder={
          !effectiveParentId ? `Select a ${parentLabel.toLowerCase()} first` : 
          isLoading ? "Loading..." : 
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
