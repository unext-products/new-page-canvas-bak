import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export type ApproverType = "manager" | "org_admin" | null;

export interface ApprovalSettings {
  id: string;
  organization_id: string;
  member_requires_approval: boolean;
  program_manager_requires_approval: boolean;
  manager_requires_approval: boolean;
  member_approved_by: ApproverType;
  program_manager_approved_by: ApproverType;
  manager_approved_by: ApproverType;
}

const DEFAULT_SETTINGS: Omit<ApprovalSettings, "id" | "organization_id"> = {
  member_requires_approval: true,
  program_manager_requires_approval: true,
  manager_requires_approval: true,
  member_approved_by: "manager",
  program_manager_approved_by: "manager",
  manager_approved_by: "org_admin",
};

export function useApprovalSettings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<ApprovalSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("organization_approval_settings")
        .select("*")
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSettings(data as ApprovalSettings);
      }
    } catch (error) {
      console.error("Error fetching approval settings:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateSettings = async (updates: Partial<Omit<ApprovalSettings, "id" | "organization_id">>) => {
    if (!settings) return;

    try {
      const { error } = await supabase
        .from("organization_approval_settings")
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq("id", settings.id);

      if (error) throw error;

      setSettings((prev) => prev ? { ...prev, ...updates } : null);
      toast.success("Approval workflow updated");
    } catch (error) {
      console.error("Error updating approval settings:", error);
      toast.error("Failed to update approval workflow");
    }
  };

  const resetToDefaults = async () => {
    await updateSettings(DEFAULT_SETTINGS);
  };

  // Helper: Check if a role requires approval
  const requiresApproval = (role: string): boolean => {
    if (!settings) {
      // Default behavior if no settings
      return true;
    }

    switch (role) {
      case "faculty":
      case "member":
        return settings.member_requires_approval;
      case "program_manager":
        return settings.program_manager_requires_approval;
      case "hod":
      case "manager":
        return settings.manager_requires_approval;
      default:
        return false;
    }
  };

  // Helper: Get who approves a specific role
  const getApproverForRole = (role: string): ApproverType => {
    if (!settings) {
      // Default behavior
      if (role === "faculty" || role === "member" || role === "program_manager") {
        return "manager";
      }
      if (role === "hod" || role === "manager") {
        return "org_admin";
      }
      return null;
    }

    switch (role) {
      case "faculty":
      case "member":
        return settings.member_approved_by;
      case "program_manager":
        return settings.program_manager_approved_by;
      case "hod":
      case "manager":
        return settings.manager_approved_by;
      default:
        return null;
    }
  };

  // Helper: Get which roles a given approver role can approve
  const getApprovableRoles = (approverRole: string | null): string[] => {
    if (!approverRole || !settings) {
      // Default behavior
      if (approverRole === "hod" || approverRole === "manager") {
        return ["faculty", "program_manager"];
      }
      if (approverRole === "org_admin") {
        return ["hod"];
      }
      return [];
    }

    const roles: string[] = [];

    if (approverRole === "org_admin") {
      // Org admin can approve anyone configured to be approved by org_admin
      if (settings.member_requires_approval && settings.member_approved_by === "org_admin") {
        roles.push("faculty");
      }
      if (settings.program_manager_requires_approval && settings.program_manager_approved_by === "org_admin") {
        roles.push("program_manager");
      }
      if (settings.manager_requires_approval && settings.manager_approved_by === "org_admin") {
        roles.push("hod");
      }
    }

    if (approverRole === "hod" || approverRole === "manager") {
      // Manager/HOD can approve anyone configured to be approved by manager
      if (settings.member_requires_approval && settings.member_approved_by === "manager") {
        roles.push("faculty");
      }
      if (settings.program_manager_requires_approval && settings.program_manager_approved_by === "manager") {
        roles.push("program_manager");
      }
    }

    return roles;
  };

  // Helper: Get approval chain for display
  const getApprovalChain = () => {
    if (!settings) return [];

    const chain = [];

    if (settings.member_requires_approval && settings.member_approved_by) {
      chain.push({
        role: "Member",
        approver: settings.member_approved_by === "manager" ? "Manager" : "Org Admin",
      });
    } else {
      chain.push({ role: "Member", approver: "Auto-approved" });
    }

    if (settings.program_manager_requires_approval && settings.program_manager_approved_by) {
      chain.push({
        role: "Program Manager",
        approver: settings.program_manager_approved_by === "manager" ? "Manager" : "Org Admin",
      });
    } else {
      chain.push({ role: "Program Manager", approver: "Auto-approved" });
    }

    if (settings.manager_requires_approval && settings.manager_approved_by) {
      chain.push({
        role: "Manager",
        approver: settings.manager_approved_by === "org_admin" ? "Org Admin" : "Auto-approved",
      });
    } else {
      chain.push({ role: "Manager", approver: "Auto-approved" });
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
    getApproverForRole,
    getApprovableRoles,
    getApprovalChain,
  };
}
