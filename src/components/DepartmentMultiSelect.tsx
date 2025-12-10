import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLabels } from "@/contexts/LabelContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Department {
  id: string;
  name: string;
  code: string;
}

interface DepartmentMultiSelectProps {
  value: string[];
  onValueChange: (value: string[]) => void;
  disabled?: boolean;
}

export function DepartmentMultiSelect({ value, onValueChange, disabled = false }: DepartmentMultiSelectProps) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const { entityLabel } = useLabels();

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

  const handleSelect = (deptId: string) => {
    if (value.includes(deptId)) {
      onValueChange(value.filter(id => id !== deptId));
    } else {
      onValueChange([...value, deptId]);
    }
  };

  const handleRemove = (deptId: string) => {
    onValueChange(value.filter(id => id !== deptId));
  };

  const selectedDepartments = departments.filter(dept => value.includes(dept.id));

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
            disabled={isLoading || disabled}
          >
            {isLoading 
              ? "Loading..." 
              : selectedDepartments.length > 0
                ? `${selectedDepartments.length} ${entityLabel("department", selectedDepartments.length > 1).toLowerCase()} selected`
                : `Select ${entityLabel("department", true).toLowerCase()}`
            }
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0 z-50 bg-popover" align="start">
          <Command>
            <CommandInput placeholder={`Search ${entityLabel("department", true).toLowerCase()}...`} />
            <CommandList>
              <CommandEmpty>No {entityLabel("department").toLowerCase()} found.</CommandEmpty>
              <CommandGroup>
                {departments.map((dept) => (
                  <CommandItem
                    key={dept.id}
                    value={dept.name}
                    onSelect={() => handleSelect(dept.id)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value.includes(dept.id) ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {dept.name} ({dept.code})
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      
      {selectedDepartments.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedDepartments.map((dept) => (
            <Badge key={dept.id} variant="secondary" className="flex items-center gap-1">
              {dept.name}
              <button
                type="button"
                onClick={() => handleRemove(dept.id)}
                className="ml-1 rounded-full outline-none hover:bg-muted"
                disabled={disabled}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
