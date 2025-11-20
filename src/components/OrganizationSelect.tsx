import { useEffect, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";

interface Organization {
  id: string;
  name: string;
  code: string;
}

interface OrganizationSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
}

export function OrganizationSelect({ value, onValueChange, disabled = false }: OrganizationSelectProps) {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchOrganizations();
  }, []);

  const fetchOrganizations = async () => {
    try {
      const { data, error } = await supabase
        .from("organizations")
        .select("id, name, code")
        .order("name");

      if (error) throw error;
      setOrganizations(data || []);
    } catch (error) {
      console.error("Error fetching organizations:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Select value={value} onValueChange={onValueChange} disabled={isLoading || disabled}>
      <SelectTrigger>
        <SelectValue placeholder={isLoading ? "Loading..." : "Select organization"} />
      </SelectTrigger>
      <SelectContent>
        {organizations.map((org) => (
          <SelectItem key={org.id} value={org.id}>
            {org.name} ({org.code})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
