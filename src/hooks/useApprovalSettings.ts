import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";

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

const DEFAULT_SETTINGS: ApprovalSettings = {
  id: "default",
  organization_id: "",
  member_requires_approval: true,
  program_manager_requires_approval: true,
  manager_requires_approval: true,
  member_approved_by: "manager",
  program_manager_approved_by: "manager",
  manager_approved_by: "org_admin",
};

export function useApprovalSettings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<ApprovalSettings | null>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    // Use default settings since organization_approval_settings table doesn't exist
    setSettings(DEFAULT_SETTINGS);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateSettings = async (_updates: Partial<Omit<ApprovalSettings, "id" | "organization_id">>) => {
    // No-op since table doesn't exist
    console.warn("updateSettings called but organization_approval_settings table doesn't exist");
  };

  const resetToDefaults = async () => {
    setSettings(DEFAULT_SETTINGS);
  };

  // Helper: Check if a role requires approval
  const requiresApproval = (role: string): boolean => {
    if (!settings) {
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
