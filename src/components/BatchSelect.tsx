import { useEffect, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useLabels } from "@/contexts/LabelContext";

interface Batch {
  id: string;
  name: string;
  program_id: string;
}

interface BatchSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  programId?: string; // Filter by program
  includeAll?: boolean;
  disabled?: boolean;
  placeholder?: string;
}

export function BatchSelect({ 
  value, 
  onValueChange, 
  programId,
  includeAll = false, 
  disabled = false,
  placeholder 
}: BatchSelectProps) {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { entityLabel } = useLabels();

  useEffect(() => {
    fetchBatches();
  }, [programId]);

  const fetchBatches = async () => {
    try {
      setIsLoading(true);
      let query = supabase
        .from("batches")
        .select("id, name, program_id")
        .order("name");

      if (programId) {
        query = query.eq("program_id", programId);
      }

      const { data, error } = await query;

      if (error) throw error;
      setBatches(data || []);
    } catch (error) {
      console.error("Error fetching batches:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const isDisabled = isLoading || disabled || (!programId && !includeAll);

  return (
    <Select value={value} onValueChange={onValueChange} disabled={isDisabled}>
      <SelectTrigger>
        <SelectValue 
          placeholder={
            isLoading 
              ? "Loading..." 
              : (!programId && !includeAll)
                ? `Select a ${entityLabel("program").toLowerCase()} first`
                : placeholder || `Select ${entityLabel("batch").toLowerCase()}`
          }
        />
      </SelectTrigger>
      <SelectContent>
        {includeAll && <SelectItem value="all">All {entityLabel("batch", true)}</SelectItem>}
        {batches.map((batch) => (
          <SelectItem key={batch.id} value={batch.id}>
            {batch.name}
          </SelectItem>
        ))}
        {batches.length === 0 && programId && (
          <div className="px-2 py-1.5 text-sm text-muted-foreground">
            No {entityLabel("batch", true).toLowerCase()} found
          </div>
        )}
      </SelectContent>
    </Select>
  );
}
