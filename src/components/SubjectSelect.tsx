import { useEffect, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useLabels } from "@/contexts/LabelContext";

interface Subject {
  id: string;
  name: string;
  code: string;
  term_id: string;
}

interface SubjectSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  termId?: string; // Filter by term
  includeAll?: boolean;
  disabled?: boolean;
  placeholder?: string;
}

export function SubjectSelect({ 
  value, 
  onValueChange, 
  termId,
  includeAll = false, 
  disabled = false,
  placeholder 
}: SubjectSelectProps) {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { entityLabel } = useLabels();

  useEffect(() => {
    fetchSubjects();
  }, [termId]);

  const fetchSubjects = async () => {
    try {
      setIsLoading(true);
      let query = supabase
        .from("subjects")
        .select("id, name, code, term_id")
        .order("name");

      if (termId) {
        query = query.eq("term_id", termId);
      }

      const { data, error } = await query;

      if (error) throw error;
      setSubjects(data || []);
    } catch (error) {
      console.error("Error fetching subjects:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const isDisabled = isLoading || disabled || (!termId && !includeAll);

  return (
    <Select value={value} onValueChange={onValueChange} disabled={isDisabled}>
      <SelectTrigger>
        <SelectValue 
          placeholder={
            isLoading 
              ? "Loading..." 
              : !termId 
                ? `Select a ${entityLabel("term").toLowerCase()} first`
                : placeholder || `Select ${entityLabel("subject").toLowerCase()}`
          } 
        />
      </SelectTrigger>
      <SelectContent>
        {includeAll && <SelectItem value="all">All {entityLabel("subject", true)}</SelectItem>}
        {subjects.map((subject) => (
          <SelectItem key={subject.id} value={subject.id}>
            {subject.name} ({subject.code})
          </SelectItem>
        ))}
        {subjects.length === 0 && termId && (
          <div className="px-2 py-1.5 text-sm text-muted-foreground">
            No {entityLabel("subject", true).toLowerCase()} found
          </div>
        )}
      </SelectContent>
    </Select>
  );
}
