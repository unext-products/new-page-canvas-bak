import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";

export type ApproverType = "l3" | "l2" | "org_admin" | null;

export interface ApprovalSettings {
  id: string;
  organization_id: string;
  l1_requires_approval: boolean;
  l2_requires_approval: boolean;
  l3_requires_approval: boolean;
  l1_approved_by: ApproverType;
  l2_approved_by: ApproverType;
  l3_approved_by: ApproverType;
}

const DEFAULT_SETTINGS: ApprovalSettings = {
  id: "default",
  organization_id: "",
  l1_requires_approval: true,
  l2_requires_approval: true,
  l3_requires_approval: true,
  // L1 entries approved by L2
  l1_approved_by: "l2",
  // L2 entries approved by L3
  l2_approved_by: "l3",
  // L3 entries approved by Admin
  l3_approved_by: "org_admin",
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
      case "l1":
      case "faculty":
      case "member":
        return settings.l1_requires_approval;
      case "l2":
      case "program_manager":
        return settings.l2_requires_approval;
      case "l3":
      case "hod":
      case "manager":
        return settings.l3_requires_approval;
      default:
        return false;
    }
  };

  // Helper: Get who approves a specific role
  const getApproverForRole = (role: string): ApproverType => {
    if (!settings) {
      if (role === "l1" || role === "faculty" || role === "member") {
        return "l2";
      }
      if (role === "l2" || role === "program_manager") {
        return "l3";
      }
      if (role === "l3" || role === "hod" || role === "manager") {
        return "org_admin";
      }
      return null;
    }

    switch (role) {
      case "l1":
      case "faculty":
      case "member":
        return settings.l1_approved_by;
      case "l2":
      case "program_manager":
        return settings.l2_approved_by;
      case "l3":
      case "hod":
      case "manager":
        return settings.l3_approved_by;
      default:
        return null;
    }
  };

  // Helper: Get which roles a given approver role can approve
  const getApprovableRoles = (approverRole: string | null): string[] => {
    if (!approverRole) return [];

    const roles: string[] = [];

    // Admin approves L3
    if (approverRole === "org_admin" || approverRole === "admin") {
      roles.push("l3");
    }

    // L3 approves L2 and L1 (in their verticals)
    if (approverRole === "l3" || approverRole === "hod" || approverRole === "manager") {
      roles.push("l2", "l1");
    }

    // L2 approves L1 (in their programs)
    if (approverRole === "l2" || approverRole === "program_manager") {
      roles.push("l1");
    }

    return roles;
  };

  // Helper: Get approval chain for display
  const getApprovalChain = () => {
    if (!settings) return [];

    const chain = [];

    if (settings.l1_requires_approval && settings.l1_approved_by) {
      chain.push({
        role: "L1",
        approver: settings.l1_approved_by === "l2" ? "L2" : 
                  settings.l1_approved_by === "l3" ? "L3" : "Admin",
      });
    } else {
      chain.push({ role: "L1", approver: "Auto-approved" });
    }

    if (settings.l2_requires_approval && settings.l2_approved_by) {
      chain.push({
        role: "L2",
        approver: settings.l2_approved_by === "l3" ? "L3" : "Admin",
      });
    } else {
      chain.push({ role: "L2", approver: "Auto-approved" });
    }

    if (settings.l3_requires_approval && settings.l3_approved_by) {
      chain.push({
        role: "L3",
        approver: settings.l3_approved_by === "org_admin" ? "Admin" : "Auto-approved",
      });
    } else {
      chain.push({ role: "L3", approver: "Auto-approved" });
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
