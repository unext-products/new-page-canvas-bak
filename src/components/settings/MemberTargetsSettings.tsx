import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLabels } from "@/contexts/LabelContext";
import { useDepartmentSettings } from "@/hooks/useDepartmentSettings";
import { useUserSettings, useDepartmentUserSettings } from "@/hooks/useUserSettings";
import { Loader2, Info, RotateCcw, User } from "lucide-react";

interface Department {
  id: string;
  name: string;
}

interface Member {
  id: string;
  full_name: string;
  email?: string;
}

export default function MemberTargetsSettings() {
  const { userWithRole } = useAuth();
  const { entityLabel, roleLabel } = useLabels();
  const { toast } = useToast();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [savingUser, setSavingUser] = useState<string | null>(null);
  const [localTargets, setLocalTargets] = useState<Record<string, { hours: number; minutes: number }>>({});

  const isOrgAdmin = userWithRole?.role === "org_admin";
  const isHod = userWithRole?.role === "manager";

  // For HOD, lock to their department
  const effectiveDepartmentId = isHod ? userWithRole?.departmentId : selectedDepartment;

  // Get department default settings for comparison
  const { settings: deptSettings } = useDepartmentSettings(effectiveDepartmentId);
  const { userSettingsMap, refetch: refetchUserSettings } = useDepartmentUserSettings(effectiveDepartmentId);
  const { updateUserSetting, resetUserSetting } = useUserSettings();

  useEffect(() => {
    if (isOrgAdmin) {
      fetchDepartments();
    }
  }, [isOrgAdmin]);

  useEffect(() => {
    if (effectiveDepartmentId) {
      fetchMembers();
    } else {
      setMembers([]);
    }
  }, [effectiveDepartmentId]);

  // Initialize local targets when members or settings change
  useEffect(() => {
    const newTargets: Record<string, { hours: number; minutes: number }> = {};
    members.forEach(member => {
      const userSetting = userSettingsMap[member.id];
      const targetMinutes = userSetting?.daily_target_minutes ?? deptSettings.daily_target_minutes;
      newTargets[member.id] = {
        hours: Math.floor(targetMinutes / 60),
        minutes: targetMinutes % 60,
      };
    });
    setLocalTargets(newTargets);
  }, [members, userSettingsMap, deptSettings]);

  const fetchDepartments = async () => {
    const { data, error } = await supabase
      .from("departments")
      .select("id, name")
      .order("name");

    if (!error && data) {
      setDepartments(data);
    }
  };

  const fetchMembers = async () => {
    if (!effectiveDepartmentId) return;
    
    setLoadingMembers(true);
    try {
      // Get faculty users in the department
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("department_id", effectiveDepartmentId)
        .eq("role", "faculty");

      if (rolesError) throw rolesError;

      if (roles && roles.length > 0) {
        const userIds = roles.map(r => r.user_id);
        
        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", userIds)
          .eq("is_active", true)
          .order("full_name");

        if (profilesError) throw profilesError;

        setMembers(profiles || []);
      } else {
        setMembers([]);
      }
    } catch (error) {
      console.error("Error fetching members:", error);
      setMembers([]);
    } finally {
      setLoadingMembers(false);
    }
  };

  const handleTargetChange = (userId: string, hours: number, minutes: number) => {
    setLocalTargets(prev => ({
      ...prev,
      [userId]: { hours, minutes },
    }));
  };

  const handleSaveTarget = async (userId: string) => {
    const target = localTargets[userId];
    if (!target) return;

    const totalMinutes = target.hours * 60 + target.minutes;
    
    setSavingUser(userId);
    const { error } = await updateUserSetting(userId, "daily_target_minutes", totalMinutes);
    setSavingUser(null);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to save target hours.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Target saved",
        description: "Member's daily target has been updated.",
      });
      refetchUserSettings();
    }
  };

  const handleResetTarget = async (userId: string) => {
    setSavingUser(userId);
    const { error } = await resetUserSetting(userId, "daily_target_minutes");
    setSavingUser(null);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to reset target hours.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Target reset",
        description: "Member will now use department/organization default.",
      });
      refetchUserSettings();
    }
  };

  const hasCustomTarget = (userId: string) => {
    const userSetting = userSettingsMap[userId];
    return userSetting?.daily_target_minutes !== null && userSetting?.daily_target_minutes !== undefined;
  };

  const formatDefaultInfo = () => {
    return `${Math.floor(deptSettings.daily_target_minutes / 60)}h ${deptSettings.daily_target_minutes % 60}m`;
  };

  if (!isOrgAdmin && !isHod) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          {roleLabel("member")} Daily Targets
        </CardTitle>
        <CardDescription>
          Set custom daily working hours for individual members. 
          Members without custom targets will use the {effectiveDepartmentId ? entityLabel("department").toLowerCase() : "organization"} default ({formatDefaultInfo()}).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Department Selector - Only for Org Admin */}
        {isOrgAdmin && (
          <div className="space-y-2">
            <Label>Select {entityLabel("department")}</Label>
            <Select 
              value={selectedDepartment || ""} 
              onValueChange={(v) => setSelectedDepartment(v || null)}
            >
              <SelectTrigger className="w-full max-w-xs">
                <SelectValue placeholder={`Choose a ${entityLabel("department").toLowerCase()}...`} />
              </SelectTrigger>
              <SelectContent>
                {departments.map((dept) => (
                  <SelectItem key={dept.id} value={dept.id}>
                    {dept.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Members List */}
        {effectiveDepartmentId ? (
          loadingMembers ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : members.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No members found in this {entityLabel("department").toLowerCase()}.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {members.map((member) => {
                const target = localTargets[member.id] || { hours: 8, minutes: 0 };
                const isCustom = hasCustomTarget(member.id);
                const isSaving = savingUser === member.id;

                return (
                  <div 
                    key={member.id} 
                    className="flex items-center justify-between gap-4 p-3 rounded-lg border bg-card"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{member.full_name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {isCustom ? (
                          <Badge variant="secondary" className="text-xs">Custom</Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">Default</Badge>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          min="0"
                          max="24"
                          value={target.hours}
                          onChange={(e) => handleTargetChange(member.id, parseInt(e.target.value) || 0, target.minutes)}
                          className="w-16 h-8 text-center"
                          disabled={isSaving}
                        />
                        <span className="text-sm text-muted-foreground">h</span>
                        <Input
                          type="number"
                          min="0"
                          max="59"
                          value={target.minutes}
                          onChange={(e) => handleTargetChange(member.id, target.hours, parseInt(e.target.value) || 0)}
                          className="w-16 h-8 text-center"
                          disabled={isSaving}
                        />
                        <span className="text-sm text-muted-foreground">m</span>
                      </div>
                      
                      <Button
                        size="sm"
                        onClick={() => handleSaveTarget(member.id)}
                        disabled={isSaving}
                      >
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                      </Button>
                      
                      {isCustom && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleResetTarget(member.id)}
                          disabled={isSaving}
                          title="Reset to default"
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Info className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Select a {entityLabel("department").toLowerCase()} to manage member targets.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
