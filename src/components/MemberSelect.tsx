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

interface Member {
  id: string;
  full_name: string;
  email: string;
  department_name?: string;
}

interface MemberSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  includeAll?: boolean;
}

export function MemberSelect({ value, onValueChange, includeAll = false }: MemberSelectProps) {
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchMembers();
  }, []);

  const fetchMembers = async () => {
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

      const memberData = profiles?.map(p => ({
        id: p.id,
        full_name: p.full_name,
        email: p.id,
        department_name: deptMap.get(rolesMap.get(p.id) || "") || "N/A",
      })).filter(m => rolesMap.has(m.id)) || [];

      setMembers(memberData);
    } catch (error) {
      console.error("Error fetching members:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const selectedMember = members.find((m) => m.id === value);

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
            "All Members"
          ) : selectedMember ? (
            <span className="truncate">
              {selectedMember.full_name}
              <span className="text-muted-foreground ml-2 text-xs">
                {selectedMember.department_name}
              </span>
            </span>
          ) : (
            "Select member..."
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0 z-50" align="start">
        <Command>
          <CommandInput placeholder="Search by name..." />
          <CommandList>
            <CommandEmpty>No members found.</CommandEmpty>
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
                  All Members
                </CommandItem>
              )}
              {members.map((member) => (
                <CommandItem
                  key={member.id}
                  value={member.full_name}
                  onSelect={() => {
                    onValueChange(member.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === member.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex flex-col">
                    <span>{member.full_name}</span>
                    <span className="text-xs text-muted-foreground">
                      {member.department_name}
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
