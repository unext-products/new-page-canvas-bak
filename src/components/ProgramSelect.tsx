import { useEffect, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";

interface Program {
  id: string;
  name: string;
  code: string;
}

interface ProgramSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  departmentId?: string;
  disabled?: boolean;
}

export function ProgramSelect({ value, onValueChange, departmentId, disabled = false }: ProgramSelectProps) {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (departmentId) {
      fetchPrograms();
    } else {
      setPrograms([]);
      setIsLoading(false);
    }
  }, [departmentId]);

  const fetchPrograms = async () => {
    if (!departmentId) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("programs")
        .select("id, name, code")
        .eq("department_id", departmentId)
        .order("name");

      if (error) throw error;
      setPrograms(data || []);
    } catch (error) {
      console.error("Error fetching programs:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Select value={value} onValueChange={onValueChange} disabled={isLoading || disabled || !departmentId}>
      <SelectTrigger>
        <SelectValue placeholder={
          !departmentId ? "Select a department first" : 
          isLoading ? "Loading..." : 
          "Select program"
        } />
      </SelectTrigger>
      <SelectContent>
        {programs.map((program) => (
          <SelectItem key={program.id} value={program.id}>
            {program.name} ({program.code})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
