import { useEffect, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";

interface ReporteeUser {
  id: string;
  full_name: string;
  role: string;
}

interface ReporteeSelectProps {
  /** The manager user ID whose reportees we're editing */
  managerId?: string;
  /** Role of the manager (l2 or l3) - determines which subordinate roles to show */
  managerRole: string;
  /** Currently selected reportee IDs */
  value: string[];
  /** Callback when selection changes */
  onValueChange: (value: string[]) => void;
  /** Vertical IDs to scope the eligible users */
  verticalIds?: string[];
  /** Program IDs to scope (for L2 selecting L1s) */
  programIds?: string[];
  /** Label for the role being selected */
  roleLabel?: string;
  disabled?: boolean;
}

export function ReporteeSelect({
  managerId,
  managerRole,
  value,
  onValueChange,
  verticalIds,
  programIds,
  roleLabel = "Reportees",
  disabled = false,
}: ReporteeSelectProps) {
  const [open, setOpen] = useState(false);
  const [candidates, setCandidates] = useState<ReporteeUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchCandidates();
  }, [managerRole, verticalIds, programIds]);

  const fetchCandidates = async () => {
    setIsLoading(true);
    try {
      // Determine which roles to show based on manager role
      const isL3 = managerRole === "l3" || managerRole === "manager";
      const targetRoles = isL3
        ? ["l2", "program_manager"] // L3 selects L2 reportees
        : ["l1", "faculty"]; // L2 selects L1 reportees

      // Get users in the manager's verticals
      let candidateUserIds: string[] = [];

      if (verticalIds && verticalIds.length > 0) {
        const { data: vertUsers } = await supabase
          .from("user_verticals")
          .select("user_id")
          .in("vertical_id", verticalIds);

        candidateUserIds = [...new Set(vertUsers?.map((u) => u.user_id) || [])];
      }

      if (candidateUserIds.length === 0) {
        setCandidates([]);
        setIsLoading(false);
        return;
      }

      // Filter to target roles
      const { data: roleUsers } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", candidateUserIds)
        .in("role", targetRoles);

      const targetUserIds = roleUsers?.map((r) => r.user_id) || [];

      if (targetUserIds.length === 0) {
        setCandidates([]);
        setIsLoading(false);
        return;
      }

      // Exclude the manager themselves
      const filteredIds = targetUserIds.filter((id) => id !== managerId);

      // Fetch profiles
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, is_active")
        .in("id", filteredIds)
        .eq("is_active", true)
        .order("full_name");

      const roleMap = new Map(roleUsers?.map((r) => [r.user_id, r.role]) || []);

      setCandidates(
        profiles?.map((p) => ({
          id: p.id,
          full_name: p.full_name,
          role: roleMap.get(p.id) || "",
        })) || []
      );
    } catch (error) {
      console.error("Error fetching reportee candidates:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleUser = (userId: string) => {
    if (value.includes(userId)) {
      onValueChange(value.filter((id) => id !== userId));
    } else {
      onValueChange([...value, userId]);
    }
  };

  const selectedNames = candidates
    .filter((c) => value.includes(c.id))
    .map((c) => c.full_name);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between h-auto min-h-10"
          disabled={disabled || isLoading}
        >
          <div className="flex flex-wrap gap-1">
            {isLoading ? (
              <span className="text-muted-foreground">Loading...</span>
            ) : selectedNames.length === 0 ? (
              <span className="text-muted-foreground">Select {roleLabel}...</span>
            ) : selectedNames.length <= 2 ? (
              selectedNames.map((name) => (
                <Badge key={name} variant="secondary" className="text-xs">
                  {name}
                </Badge>
              ))
            ) : (
              <>
                <Badge variant="secondary" className="text-xs">
                  {selectedNames[0]}
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  +{selectedNames.length - 1} more
                </Badge>
              </>
            )}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[350px] p-0 z-50" align="start">
        <Command>
          <CommandInput placeholder={`Search ${roleLabel.toLowerCase()}...`} />
          <CommandList>
            <CommandEmpty>No users found.</CommandEmpty>
            <CommandGroup>
              {candidates.map((user) => (
                <CommandItem
                  key={user.id}
                  value={user.full_name}
                  onSelect={() => toggleUser(user.id)}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value.includes(user.id) ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span>{user.full_name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
