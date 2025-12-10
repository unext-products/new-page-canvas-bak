import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLabels } from "@/contexts/LabelContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Program {
  id: string;
  name: string;
  code: string;
  department_id: string;
}

interface ProgramMultiSelectProps {
  value: string[];
  onValueChange: (value: string[]) => void;
  departmentIds?: string[];
  disabled?: boolean;
}

export function ProgramMultiSelect({ value, onValueChange, departmentIds = [], disabled = false }: ProgramMultiSelectProps) {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const { entityLabel } = useLabels();

  useEffect(() => {
    if (departmentIds.length > 0) {
      fetchPrograms();
    } else {
      setPrograms([]);
      setIsLoading(false);
    }
  }, [departmentIds]);

  const fetchPrograms = async () => {
    if (departmentIds.length === 0) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("programs")
        .select("id, name, code, department_id")
        .in("department_id", departmentIds)
        .order("name");

      if (error) throw error;
      setPrograms(data || []);
      
      // Remove any selected programs that are no longer in the valid list
      const validProgramIds = (data || []).map(p => p.id);
      const filteredValue = value.filter(id => validProgramIds.includes(id));
      if (filteredValue.length !== value.length) {
        onValueChange(filteredValue);
      }
    } catch (error) {
      console.error("Error fetching programs:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelect = (programId: string) => {
    if (value.includes(programId)) {
      onValueChange(value.filter(id => id !== programId));
    } else {
      onValueChange([...value, programId]);
    }
  };

  const handleRemove = (programId: string) => {
    onValueChange(value.filter(id => id !== programId));
  };

  const selectedPrograms = programs.filter(prog => value.includes(prog.id));
  const noDepartmentsSelected = departmentIds.length === 0;

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
            disabled={isLoading || disabled || noDepartmentsSelected}
          >
            {noDepartmentsSelected
              ? `Select ${entityLabel("department", true).toLowerCase()} first`
              : isLoading 
                ? "Loading..." 
                : selectedPrograms.length > 0
                  ? `${selectedPrograms.length} ${entityLabel("program", selectedPrograms.length > 1).toLowerCase()} selected`
                  : `Select ${entityLabel("program", true).toLowerCase()}`
            }
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0 z-50 bg-popover" align="start">
          <Command>
            <CommandInput placeholder={`Search ${entityLabel("program", true).toLowerCase()}...`} />
            <CommandList>
              <CommandEmpty>No {entityLabel("program").toLowerCase()} found.</CommandEmpty>
              <CommandGroup>
                {programs.map((program) => (
                  <CommandItem
                    key={program.id}
                    value={program.name}
                    onSelect={() => handleSelect(program.id)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value.includes(program.id) ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {program.name} ({program.code})
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      
      {selectedPrograms.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedPrograms.map((program) => (
            <Badge key={program.id} variant="secondary" className="flex items-center gap-1">
              {program.name}
              <button
                type="button"
                onClick={() => handleRemove(program.id)}
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
