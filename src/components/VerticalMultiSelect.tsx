import { useEffect, useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { useLabels } from "@/contexts/LabelContext";

interface Vertical {
  id: string;
  name: string;
  code: string;
}

interface VerticalMultiSelectProps {
  value: string[];
  onValueChange: (value: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function VerticalMultiSelect({ value, onValueChange, disabled = false, placeholder }: VerticalMultiSelectProps) {
  const [verticals, setVerticals] = useState<Vertical[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const { entityLabel } = useLabels();

  useEffect(() => {
    fetchVerticals();
  }, []);

  const fetchVerticals = async () => {
    try {
      const { data, error } = await supabase
        .from("verticals")
        .select("id, name, code")
        .order("name");

      if (error) throw error;
      setVerticals(data || []);
    } catch (error) {
      console.error("Error fetching verticals:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelect = (verticalId: string) => {
    if (value.includes(verticalId)) {
      onValueChange(value.filter((id) => id !== verticalId));
    } else {
      onValueChange([...value, verticalId]);
    }
  };

  const handleRemove = (verticalId: string) => {
    onValueChange(value.filter((id) => id !== verticalId));
  };

  const selectedVerticals = verticals.filter((v) => value.includes(v.id));

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
              : selectedVerticals.length > 0
              ? `${selectedVerticals.length} ${entityLabel("vertical", selectedVerticals.length !== 1).toLowerCase()} selected`
              : placeholder || `Select ${entityLabel("vertical", true).toLowerCase()}`}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <Command>
            <CommandInput placeholder={`Search ${entityLabel("vertical", true).toLowerCase()}...`} />
            <CommandList>
              <CommandEmpty>No {entityLabel("vertical").toLowerCase()} found.</CommandEmpty>
              <CommandGroup>
                {verticals.map((vertical) => (
                  <CommandItem
                    key={vertical.id}
                    value={`${vertical.name} ${vertical.code}`}
                    onSelect={() => handleSelect(vertical.id)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value.includes(vertical.id) ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {vertical.name} ({vertical.code})
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {selectedVerticals.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedVerticals.map((vertical) => (
            <Badge
              key={vertical.id}
              variant="secondary"
              className="flex items-center gap-1"
            >
              {vertical.name}
              <button
                type="button"
                onClick={() => handleRemove(vertical.id)}
                className="ml-1 rounded-full outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2"
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
