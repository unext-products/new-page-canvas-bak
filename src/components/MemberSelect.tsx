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
import { getVisibleUserIds } from "@/lib/reportingHierarchy";

interface Member {
  id: string;
  full_name: string;
  email: string;
  department_names: string[];
  is_active: boolean;
}

interface MemberSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  includeAll?: boolean;
  departmentIds?: string[]; // Filter members by these department IDs
  includeInactive?: boolean; // Include inactive users for historical data access
}

export function MemberSelect({ value, onValueChange, includeAll = false, departmentIds, includeInactive = false }: MemberSelectProps) {
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchMembers();
  }, [departmentIds, includeInactive]);

  const fetchMembers = async () => {
    try {
      // Get profiles (optionally include inactive)
      let profilesQuery = supabase
        .from("profiles")
        .select("id, full_name, is_active")
        .order("full_name");

      if (!includeInactive) {
        profilesQuery = profilesQuery.eq("is_active", true);
      }

      const { data: profiles, error: profilesError } = await profilesQuery;

      if (profilesError) throw profilesError;

      if (profilesError) throw profilesError;

      const userIds = profiles?.map(p => p.id) || [];

      // Get faculty/L1/L2 roles to filter users (include both new and legacy roles)
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("user_id", userIds)
        .in("role", ["l1", "l2", "faculty"]);

      if (rolesError) throw rolesError;

      const facultyIds = new Set(roles?.map(r => r.user_id) || []);

      // Get vertical assignments from user_verticals junction table
      let vertAssignmentsQuery = supabase
        .from("user_verticals")
        .select("user_id, vertical_id")
        .in("user_id", Array.from(facultyIds));

      const { data: vertAssignments, error: vertAssignmentsError } = await vertAssignmentsQuery;

      // Fallback to user_departments if no user_verticals entries
      let userVertMap = new Map<string, string[]>();
      
      if (vertAssignments && vertAssignments.length > 0) {
        vertAssignments.forEach(va => {
          if (!userVertMap.has(va.user_id)) {
            userVertMap.set(va.user_id, []);
          }
          userVertMap.get(va.user_id)!.push(va.vertical_id);
        });
      } else {
        // Fallback to user_departments
        const { data: deptAssignments } = await supabase
          .from("user_departments")
          .select("user_id, department_id")
          .in("user_id", Array.from(facultyIds));
        
        deptAssignments?.forEach(da => {
          if (!userVertMap.has(da.user_id)) {
            userVertMap.set(da.user_id, []);
          }
          userVertMap.get(da.user_id)!.push(da.department_id);
        });
      }

      // Filter users by departmentIds (which now represent verticalIds) if provided
      let filteredFacultyIds = Array.from(facultyIds);
      if (departmentIds && departmentIds.length > 0) {
        filteredFacultyIds = filteredFacultyIds.filter(userId => {
          const userVerts = userVertMap.get(userId) || [];
          return userVerts.some(vertId => departmentIds.includes(vertId));
        });
      }

      // Get all vertical names (try verticals table first, fallback to departments)
      const allVertIds = Array.from(new Set(
        Array.from(userVertMap.values()).flat()
      ));
      
      let vertNameMap = new Map<string, string>();
      if (allVertIds.length > 0) {
        const { data: verticals } = await supabase
          .from("verticals")
          .select("id, name")
          .in("id", allVertIds);
        
        if (verticals && verticals.length > 0) {
          vertNameMap = new Map(verticals.map(v => [v.id, v.name]));
        } else {
          // Fallback to departments
          const { data: departments } = await supabase
            .from("departments")
            .select("id, name")
            .in("id", allVertIds);
          vertNameMap = new Map(departments?.map(d => [d.id, d.name]) || []);
        }
      }

      // Build member data with all vertical names
      const memberData = profiles
        ?.filter(p => filteredFacultyIds.includes(p.id))
        .map(p => {
          const vertIds = userVertMap.get(p.id) || [];
          const vertNames = vertIds.map(id => vertNameMap.get(id) || "Unknown").filter(Boolean);
          
          return {
            id: p.id,
            full_name: p.full_name,
            email: p.id,
            department_names: vertNames.length > 0 ? vertNames : ["N/A"],
            is_active: p.is_active,
          };
        }) || [];

      // Sort: active first, then inactive
      memberData.sort((a, b) => {
        if (a.is_active === b.is_active) return 0;
        return a.is_active ? -1 : 1;
      });

      setMembers(memberData);
    } catch (error) {
      console.error("Error fetching members:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const selectedMember = members.find((m) => m.id === value);

  const formatDepartmentDisplay = (deptNames: string[]) => {
    if (deptNames.length === 0) return "N/A";
    if (deptNames.length === 1) return deptNames[0];
    return `${deptNames[0]} +${deptNames.length - 1}`;
  };

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
                {formatDepartmentDisplay(selectedMember.department_names)}
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
                    <div className="flex items-center gap-2">
                      <span>{member.full_name}</span>
                      {!member.is_active && (
                        <Badge variant="outline" className="text-[10px] px-1 py-0 text-muted-foreground">
                          Inactive
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground">
                        {member.department_names[0]}
                      </span>
                      {member.department_names.length > 1 && (
                        <Badge variant="secondary" className="text-[10px] px-1 py-0">
                          +{member.department_names.length - 1}
                        </Badge>
                      )}
                    </div>
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
