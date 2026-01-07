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

interface Member {
  id: string;
  full_name: string;
  email: string;
  department_names: string[];
}

interface MemberSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  includeAll?: boolean;
  departmentIds?: string[]; // Filter members by these department IDs
}

export function MemberSelect({ value, onValueChange, includeAll = false, departmentIds }: MemberSelectProps) {
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchMembers();
  }, [departmentIds]);

  const fetchMembers = async () => {
    try {
      // Get all active profiles
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("is_active", true)
        .order("full_name");

      if (profilesError) throw profilesError;

      const userIds = profiles?.map(p => p.id) || [];

      // Get faculty roles to filter only faculty users
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("user_id", userIds)
        .eq("role", "faculty");

      if (rolesError) throw rolesError;

      const facultyIds = new Set(roles?.map(r => r.user_id) || []);

      // Get department assignments from user_departments junction table
      let deptAssignmentsQuery = supabase
        .from("user_departments")
        .select("user_id, department_id")
        .in("user_id", Array.from(facultyIds));

      const { data: deptAssignments, error: deptAssignmentsError } = await deptAssignmentsQuery;

      if (deptAssignmentsError) throw deptAssignmentsError;

      // Build a map of user_id -> department_ids[]
      const userDeptMap = new Map<string, string[]>();
      deptAssignments?.forEach(da => {
        if (!userDeptMap.has(da.user_id)) {
          userDeptMap.set(da.user_id, []);
        }
        userDeptMap.get(da.user_id)!.push(da.department_id);
      });

      // Filter users by departmentIds if provided
      let filteredFacultyIds = Array.from(facultyIds);
      if (departmentIds && departmentIds.length > 0) {
        filteredFacultyIds = filteredFacultyIds.filter(userId => {
          const userDepts = userDeptMap.get(userId) || [];
          return userDepts.some(deptId => departmentIds.includes(deptId));
        });
      }

      // Get all department names
      const allDeptIds = Array.from(new Set(deptAssignments?.map(da => da.department_id) || []));
      const { data: departments } = await supabase
        .from("departments")
        .select("id, name")
        .in("id", allDeptIds.length > 0 ? allDeptIds : ['__none__']);

      const deptNameMap = new Map(departments?.map(d => [d.id, d.name]) || []);

      // Build member data with all department names
      const memberData = profiles
        ?.filter(p => filteredFacultyIds.includes(p.id))
        .map(p => {
          const deptIds = userDeptMap.get(p.id) || [];
          const deptNames = deptIds.map(id => deptNameMap.get(id) || "Unknown").filter(Boolean);
          
          return {
            id: p.id,
            full_name: p.full_name,
            email: p.id,
            department_names: deptNames.length > 0 ? deptNames : ["N/A"],
          };
        }) || [];

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
                    <span>{member.full_name}</span>
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
