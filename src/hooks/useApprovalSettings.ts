import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

// Approver types that can be selected (now an array for multi-select)
export type ApproverRole = "l2" | "l3" | "org_admin";

export interface ApprovalSettings {
  id: string;
  organization_id: string;
  l1_requires_approval: boolean;
  l2_requires_approval: boolean;
  l3_requires_approval: boolean;
  l1_approved_by: ApproverRole[];
  l2_approved_by: ApproverRole[];
  l3_approved_by: ApproverRole[];
}

const DEFAULT_SETTINGS: ApprovalSettings = {
  id: "default",
  organization_id: "",
  l1_requires_approval: true,
  l2_requires_approval: true,
  l3_requires_approval: true,
  l1_approved_by: ["l2"],
  l2_approved_by: ["l3"],
  l3_approved_by: ["org_admin"],
};

export function useApprovalSettings() {
  const { userWithRole } = useAuth();
  const [settings, setSettings] = useState<ApprovalSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    if (!userWithRole?.user?.id) {
      setLoading(false);
      return;
    }

    try {
      // First get the user's organization_id
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("organization_id")
        .eq("user_id", userWithRole.user.id)
        .maybeSingle();

      const orgId = roleData?.organization_id;
      
      if (!orgId) {
        setSettings(DEFAULT_SETTINGS);
        setLoading(false);
        return;
      }

      // Try to fetch existing settings
      const { data, error } = await supabase
        .from("organization_approval_settings")
        .select("*")
        .eq("organization_id", orgId)
        .maybeSingle();

      if (error && error.code !== "PGRST116") {
        console.error("Error fetching approval settings:", error);
        setSettings({ ...DEFAULT_SETTINGS, organization_id: orgId });
        setLoading(false);
        return;
      }

      if (data) {
        setSettings({
          id: data.id,
          organization_id: data.organization_id,
          l1_requires_approval: data.l1_requires_approval,
          l2_requires_approval: data.l2_requires_approval,
          l3_requires_approval: data.l3_requires_approval,
          l1_approved_by: (data.l1_approved_by as ApproverRole[]) || ["l2"],
          l2_approved_by: (data.l2_approved_by as ApproverRole[]) || ["l3"],
          l3_approved_by: (data.l3_approved_by as ApproverRole[]) || ["org_admin"],
        });
      } else {
        // Create default settings for this org
        const { data: newData, error: insertError } = await supabase
          .from("organization_approval_settings")
          .insert({
            organization_id: orgId,
            l1_requires_approval: true,
            l2_requires_approval: true,
            l3_requires_approval: true,
            l1_approved_by: ["l2"],
            l2_approved_by: ["l3"],
            l3_approved_by: ["org_admin"],
          })
          .select()
          .single();

        if (insertError) {
          console.error("Error creating approval settings:", insertError);
          setSettings({ ...DEFAULT_SETTINGS, organization_id: orgId });
        } else if (newData) {
          setSettings({
            id: newData.id,
            organization_id: newData.organization_id,
            l1_requires_approval: newData.l1_requires_approval,
            l2_requires_approval: newData.l2_requires_approval,
            l3_requires_approval: newData.l3_requires_approval,
            l1_approved_by: (newData.l1_approved_by as ApproverRole[]) || ["l2"],
            l2_approved_by: (newData.l2_approved_by as ApproverRole[]) || ["l3"],
            l3_approved_by: (newData.l3_approved_by as ApproverRole[]) || ["org_admin"],
          });
        }
      }
    } catch (error) {
      console.error("Error in fetchSettings:", error);
      setSettings(DEFAULT_SETTINGS);
    } finally {
      setLoading(false);
    }
  }, [userWithRole?.user?.id]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateSettings = async (updates: Partial<Omit<ApprovalSettings, "id" | "organization_id">>) => {
    if (!settings?.organization_id || settings.id === "default") {
      console.warn("Cannot update settings - no organization_id or using defaults");
      return;
    }

    try {
      const { error } = await supabase
        .from("organization_approval_settings")
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq("organization_id", settings.organization_id);

      if (error) {
        console.error("Error updating approval settings:", error);
        return;
      }

      // Update local state
      setSettings({ ...settings, ...updates });
    } catch (error) {
      console.error("Error in updateSettings:", error);
    }
  };

  const resetToDefaults = async () => {
    await updateSettings({
      l1_requires_approval: true,
      l2_requires_approval: true,
      l3_requires_approval: true,
      l1_approved_by: ["l2"],
      l2_approved_by: ["l3"],
      l3_approved_by: ["org_admin"],
    });
  };

  // Helper: Check if a role requires approval
  const requiresApproval = (role: string): boolean => {
    if (!settings) return true;

    const normalizedRole = normalizeRole(role);
    switch (normalizedRole) {
      case "l1":
        return settings.l1_requires_approval;
      case "l2":
        return settings.l2_requires_approval;
      case "l3":
        return settings.l3_requires_approval;
      default:
        return false;
    }
  };

  // Helper: Get who approves a specific role (returns array)
  const getApproversForRole = (role: string): ApproverRole[] => {
    if (!settings) {
      const normalizedRole = normalizeRole(role);
      if (normalizedRole === "l1") return ["l2"];
      if (normalizedRole === "l2") return ["l3"];
      if (normalizedRole === "l3") return ["org_admin"];
      return [];
    }

    const normalizedRole = normalizeRole(role);
    switch (normalizedRole) {
      case "l1":
        return settings.l1_approved_by;
      case "l2":
        return settings.l2_approved_by;
      case "l3":
        return settings.l3_approved_by;
      default:
        return [];
    }
  };

  // Helper: Check if a given approver role can approve a target role
  const canApproveRole = (approverRole: string, targetRole: string): boolean => {
    if (!settings) return false;

    const normalizedApprover = normalizeRole(approverRole);
    const normalizedTarget = normalizeRole(targetRole);

    let approvers: ApproverRole[] = [];
    switch (normalizedTarget) {
      case "l1":
        if (!settings.l1_requires_approval) return false;
        approvers = settings.l1_approved_by;
        break;
      case "l2":
        if (!settings.l2_requires_approval) return false;
        approvers = settings.l2_approved_by;
        break;
      case "l3":
        if (!settings.l3_requires_approval) return false;
        approvers = settings.l3_approved_by;
        break;
      default:
        return false;
    }

    return approvers.includes(normalizedApprover as ApproverRole);
  };

  // Helper: Get which roles a given approver role can approve (based on settings)
  const getApprovableRoles = (approverRole: string | null): string[] => {
    if (!approverRole || !settings) return [];

    const normalizedApprover = normalizeRole(approverRole);
    const roles: string[] = [];

    // Check L1 approvers
    if (settings.l1_requires_approval && settings.l1_approved_by.includes(normalizedApprover as ApproverRole)) {
      roles.push("l1");
    }

    // Check L2 approvers
    if (settings.l2_requires_approval && settings.l2_approved_by.includes(normalizedApprover as ApproverRole)) {
      roles.push("l2");
    }

    // Check L3 approvers
    if (settings.l3_requires_approval && settings.l3_approved_by.includes(normalizedApprover as ApproverRole)) {
      roles.push("l3");
    }

    return roles;
  };

  // Helper: Get approval chain for display
  const getApprovalChain = () => {
    if (!settings) return [];

    const chain = [];

    if (settings.l1_requires_approval && settings.l1_approved_by.length > 0) {
      chain.push({
        role: "L1",
        approvers: settings.l1_approved_by,
      });
    } else {
      chain.push({ role: "L1", approvers: [] as ApproverRole[] });
    }

    if (settings.l2_requires_approval && settings.l2_approved_by.length > 0) {
      chain.push({
        role: "L2",
        approvers: settings.l2_approved_by,
      });
    } else {
      chain.push({ role: "L2", approvers: [] as ApproverRole[] });
    }

    if (settings.l3_requires_approval && settings.l3_approved_by.length > 0) {
      chain.push({
        role: "L3",
        approvers: settings.l3_approved_by,
      });
    } else {
      chain.push({ role: "L3", approvers: [] as ApproverRole[] });
    }

    return chain;
  };

  return {
    settings,
    loading,
    updateSettings,
    resetToDefaults,
    refetch: fetchSettings,
    requiresApproval,
    getApproversForRole,
    getApprovableRoles,
    getApprovalChain,
    canApproveRole,
  };
}

// Normalize role names to standard format
function normalizeRole(role: string): string {
  switch (role) {
    case "faculty":
    case "member":
      return "l1";
    case "program_manager":
      return "l2";
    case "hod":
    case "manager":
      return "l3";
    case "admin":
      return "org_admin";
    default:
      return role;
  }
}
