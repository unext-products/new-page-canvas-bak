import { useEffect, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useLabels } from "@/contexts/LabelContext";

interface Vertical {
  id: string;
  name: string;
  code: string;
}

interface VerticalSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  includeAll?: boolean;
  disabled?: boolean;
  verticalIds?: string[]; // Filter to only these vertical IDs
  placeholder?: string;
}

export function VerticalSelect({ 
  value, 
  onValueChange, 
  includeAll = false, 
  disabled = false, 
  verticalIds,
  placeholder 
}: VerticalSelectProps) {
  const [verticals, setVerticals] = useState<Vertical[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { entityLabel } = useLabels();

  useEffect(() => {
    fetchVerticals();
  }, [verticalIds]);

  const fetchVerticals = async () => {
    try {
      let query = supabase
        .from("verticals")
        .select("id, name, code")
        .order("name");

      // Filter by vertical IDs if provided
      if (verticalIds && verticalIds.length > 0) {
        query = query.in("id", verticalIds);
      }

      const { data, error } = await query;

      if (error) throw error;
      setVerticals(data || []);
    } catch (error) {
      console.error("Error fetching verticals:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Select value={value} onValueChange={onValueChange} disabled={isLoading || disabled}>
      <SelectTrigger>
        <SelectValue placeholder={isLoading ? "Loading..." : placeholder || `Select ${entityLabel("vertical").toLowerCase()}`} />
      </SelectTrigger>
      <SelectContent>
        {includeAll && <SelectItem value="all">All {entityLabel("vertical", true)}</SelectItem>}
        {verticals.map((vertical) => (
          <SelectItem key={vertical.id} value={vertical.id}>
            {vertical.name} ({vertical.code})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
