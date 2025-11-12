import { useEffect, useState } from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";

interface Faculty {
  id: string;
  full_name: string;
  email: string;
  department_name?: string;
}

interface FacultySelectProps {
  value: string;
  onValueChange: (value: string) => void;
  includeAll?: boolean;
}

export function FacultySelect({ value, onValueChange, includeAll = false }: FacultySelectProps) {
  const [open, setOpen] = useState(false);
  const [faculty, setFaculty] = useState<Faculty[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchFaculty();
  }, []);

  const fetchFaculty = async () => {
    try {
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("is_active", true)
        .order("full_name");

      if (profilesError) throw profilesError;

      const userIds = profiles?.map(p => p.id) || [];
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, department_id")
        .in("user_id", userIds)
        .eq("role", "faculty");

      if (rolesError) throw rolesError;

      const deptIds = roles?.map(r => r.department_id).filter(Boolean) || [];
      const { data: departments } = await supabase
        .from("departments")
        .select("id, name")
        .in("id", deptIds);

      const deptMap = new Map(departments?.map(d => [d.id, d.name]) || []);
      const rolesMap = new Map(roles?.map(r => [r.user_id, r.department_id]) || []);

      const facultyData = profiles?.map(p => ({
        id: p.id,
        full_name: p.full_name,
        email: p.id,
        department_name: deptMap.get(rolesMap.get(p.id) || "") || "N/A",
      })).filter(f => rolesMap.has(f.id)) || [];

      setFaculty(facultyData);
    } catch (error) {
      console.error("Error fetching faculty:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const selectedFaculty = faculty.find((f) => f.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={isLoading}
        >
          {isLoading ? (
            "Loading..."
          ) : value === "all" ? (
            "All Faculty"
          ) : selectedFaculty ? (
            <span className="truncate">
              {selectedFaculty.full_name}
              <span className="text-muted-foreground ml-2 text-xs">
                {selectedFaculty.department_name}
              </span>
            </span>
          ) : (
            "Select faculty..."
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0 z-50" align="start">
        <Command>
          <CommandInput placeholder="Search by name..." />
          <CommandList>
            <CommandEmpty>No faculty found.</CommandEmpty>
            <CommandGroup>
              {includeAll && (
                <CommandItem
                  value="all"
                  onSelect={() => {
                    onValueChange("all");
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === "all" ? "opacity-100" : "opacity-0"
                    )}
                  />
                  All Faculty
                </CommandItem>
              )}
              {faculty.map((f) => (
                <CommandItem
                  key={f.id}
                  value={`${f.full_name} ${f.department_name}`}
                  onSelect={() => {
                    onValueChange(f.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === f.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex flex-col">
                    <span>{f.full_name}</span>
                    <span className="text-xs text-muted-foreground">
                      {f.department_name}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
