import { useEffect, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useLabels } from "@/contexts/LabelContext";

interface Term {
  id: string;
  name: string;
  batch_id: string;
}

interface TermSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  batchId?: string; // Filter by batch
  includeAll?: boolean;
  disabled?: boolean;
  placeholder?: string;
}

export function TermSelect({ 
  value, 
  onValueChange, 
  batchId,
  includeAll = false, 
  disabled = false,
  placeholder 
}: TermSelectProps) {
  const [terms, setTerms] = useState<Term[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { entityLabel } = useLabels();

  useEffect(() => {
    fetchTerms();
  }, [batchId]);

  const fetchTerms = async () => {
    try {
      setIsLoading(true);
      let query = supabase
        .from("terms")
        .select("id, name, batch_id")
        .order("name");

      if (batchId) {
        query = query.eq("batch_id", batchId);
      }

      const { data, error } = await query;

      if (error) throw error;
      setTerms(data || []);
    } catch (error) {
      console.error("Error fetching terms:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const isDisabled = isLoading || disabled || (!batchId && !includeAll);

  return (
    <Select value={value} onValueChange={onValueChange} disabled={isDisabled}>
      <SelectTrigger>
        <SelectValue 
          placeholder={
            isLoading 
              ? "Loading..." 
              : !batchId 
                ? `Select a ${entityLabel("batch").toLowerCase()} first`
                : placeholder || `Select ${entityLabel("term").toLowerCase()}`
          } 
        />
      </SelectTrigger>
      <SelectContent>
        {includeAll && <SelectItem value="all">All {entityLabel("term", true)}</SelectItem>}
        {terms.map((term) => (
          <SelectItem key={term.id} value={term.id}>
            {term.name}
          </SelectItem>
        ))}
        {terms.length === 0 && batchId && (
          <div className="px-2 py-1.5 text-sm text-muted-foreground">
            No {entityLabel("term", true).toLowerCase()} found
          </div>
        )}
      </SelectContent>
    </Select>
  );
}
