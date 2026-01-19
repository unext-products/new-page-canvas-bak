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
import { fetchOrgDefaultDailyTargetMinutes } from "@/lib/targets";
import { isRole } from "@/lib/roleMapping";

interface Vertical {
  id: string;
  name: string;
  code: string;
}

interface Member {
  id: string;
  full_name: string;
  email?: string;
  primaryVerticalId: string | null;
}

export default function MemberTargetsSettings() {
  const { userWithRole } = useAuth();
  const { entityLabel, roleLabel } = useLabels();
  const { toast } = useToast();
  const [verticals, setVerticals] = useState<Vertical[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedVertical, setSelectedVertical] = useState<string | null>(null);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [savingUser, setSavingUser] = useState<string | null>(null);
  const [localTargets, setLocalTargets] = useState<Record<string, { hours: number; minutes: number }>>({});
  const [orgDefaultMinutes, setOrgDefaultMinutes] = useState(480);

  const isOrgAdmin = isRole(userWithRole?.role, "admin", "org_admin", "super_admin");
  const isHod = isRole(userWithRole?.role, "l3", "manager");

  // For HOD, lock to their vertical
  const effectiveVerticalId = isHod ? userWithRole?.verticalId : selectedVertical;

  // Get vertical default settings for comparison
  const { settings: vertSettings } = useDepartmentSettings(effectiveVerticalId);
  const { userSettingsMap, refetch: refetchUserSettings } = useDepartmentUserSettings(effectiveVerticalId);
  const { updateUserSetting, resetUserSetting } = useUserSettings(null, effectiveVerticalId);

  useEffect(() => {
    if (isOrgAdmin) {
      fetchVerticals();
    } else if (isHod && userWithRole?.verticalId) {
      // HOD: auto-select their vertical
      setSelectedVertical(userWithRole.verticalId);
    }
    // Fetch org default
    fetchOrgDefaultDailyTargetMinutes().then(setOrgDefaultMinutes);
  }, [isOrgAdmin, isHod, userWithRole?.verticalId]);

  useEffect(() => {
    if (effectiveVerticalId) {
      fetchMembers();
    } else {
      setMembers([]);
    }
  }, [effectiveVerticalId]);

  // Initialize local targets when members or settings change
  // Use correct defaults: primary vertical = org default, non-primary = 0
  useEffect(() => {
    const newTargets: Record<string, { hours: number; minutes: number }> = {};
    members.forEach(member => {
      const userSetting = userSettingsMap[member.id];
      let targetMinutes: number;
      
      if (userSetting?.daily_target_minutes !== null && userSetting?.daily_target_minutes !== undefined) {
        // Has custom setting for this vertical
        targetMinutes = userSetting.daily_target_minutes;
      } else if (member.primaryVerticalId === effectiveVerticalId) {
        // This is primary vertical - use org default
        targetMinutes = orgDefaultMinutes;
      } else {
        // Non-primary vertical without custom setting - default to 0
        targetMinutes = 0;
      }
      
      newTargets[member.id] = {
        hours: Math.floor(targetMinutes / 60),
        minutes: targetMinutes % 60,
      };
    });
    setLocalTargets(newTargets);
  }, [members, userSettingsMap, effectiveVerticalId, orgDefaultMinutes]);

  const fetchVerticals = async () => {
    const { data, error } = await supabase
      .from("verticals")
      .select("id, name, code")
      .order("name");

    if (!error && data) {
      setVerticals(data);
    }
  };

  const fetchMembers = async () => {
    if (!effectiveVerticalId) return;
    
    setLoadingMembers(true);
    try {
      // Get users in the vertical via user_verticals junction table
      const { data: verticalUsers, error: vertUsersError } = await supabase
        .from("user_verticals")
        .select("user_id")
        .eq("vertical_id", effectiveVerticalId);

      if (vertUsersError) throw vertUsersError;

      if (verticalUsers && verticalUsers.length > 0) {
        const userIds = verticalUsers.map(vu => vu.user_id);
        
        // Filter to only L1 (faculty) users and get their primary vertical
        const { data: l1Roles, error: rolesError } = await supabase
          .from("user_roles")
          .select("user_id, vertical_id")
          .in("user_id", userIds)
          .eq("role", "l1");

        if (rolesError) throw rolesError;

        const l1UserIds = l1Roles?.map(r => r.user_id) || [];
        
        // Build a map of userId -> primaryVerticalId
        const primaryVertMap = new Map<string, string | null>();
        l1Roles?.forEach(r => {
          primaryVertMap.set(r.user_id, r.vertical_id);
        });
        
        if (l1UserIds.length > 0) {
          const { data: profiles, error: profilesError } = await supabase
            .from("profiles")
            .select("id, full_name")
            .in("id", l1UserIds)
            .eq("is_active", true)
            .order("full_name");

          if (profilesError) throw profilesError;

          // Add primaryVerticalId to each member
          const membersWithPrimary: Member[] = (profiles || []).map(p => ({
            id: p.id,
            full_name: p.full_name,
            primaryVerticalId: primaryVertMap.get(p.id) || null,
          }));

          setMembers(membersWithPrimary);
        } else {
          setMembers([]);
        }
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
    if (!target || !effectiveVerticalId) return;

    const totalMinutes = target.hours * 60 + target.minutes;
    
    setSavingUser(userId);
    const { error } = await updateUserSetting(userId, "daily_target_minutes", totalMinutes, effectiveVerticalId);
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
    if (!effectiveVerticalId) return;
    
    setSavingUser(userId);
    const { error } = await resetUserSetting(userId, "daily_target_minutes", effectiveVerticalId);
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
    return `${Math.floor(vertSettings.daily_target_minutes / 60)}h ${vertSettings.daily_target_minutes % 60}m`;
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
          Members without custom targets will use the {effectiveVerticalId ? entityLabel("vertical").toLowerCase() : "organization"} default ({formatDefaultInfo()}).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Vertical Selector - Only for Org Admin */}
        {isOrgAdmin && (
          <div className="space-y-2">
            <Label>Select {entityLabel("vertical")}</Label>
            <Select 
              value={selectedVertical || ""} 
              onValueChange={(v) => setSelectedVertical(v || null)}
            >
              <SelectTrigger className="w-full max-w-xs">
                <SelectValue placeholder={`Choose a ${entityLabel("vertical").toLowerCase()}...`} />
              </SelectTrigger>
              <SelectContent>
                {verticals.map((vert) => (
                  <SelectItem key={vert.id} value={vert.id}>
                    {vert.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Members List */}
        {effectiveVerticalId ? (
          loadingMembers ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : members.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No L1 members found in this {entityLabel("vertical").toLowerCase()}.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {members.map((member) => {
                const target = localTargets[member.id] || { hours: 0, minutes: 0 };
                const isCustom = hasCustomTarget(member.id);
                const isSaving = savingUser === member.id;
                const isPrimaryVert = member.primaryVerticalId === effectiveVerticalId;

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
                        ) : isPrimaryVert ? (
                          <Badge variant="outline" className="text-xs">Primary Vertical</Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs text-muted-foreground">Non-Primary (0h default)</Badge>
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
            <p>Select a {entityLabel("vertical").toLowerCase()} to manage member targets.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
