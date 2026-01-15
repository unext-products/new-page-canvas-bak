// Database roles (what's stored in Supabase)
// New roles: super_admin, org_admin, l3, l2, l1
// Legacy roles kept for backward compatibility: hod, faculty, program_manager
export type DbRole = "super_admin" | "org_admin" | "l3" | "l2" | "l1" | "hod" | "faculty" | "program_manager";

// Display roles - includes both new system and legacy aliases for smooth transition
export type DisplayRole = "super_admin" | "admin" | "l3" | "l2" | "l1" | "org_admin" | "manager" | "member" | "program_manager";

// Bidirectional mapping between DB and Display roles
export const dbToDisplayRole: Record<DbRole, DisplayRole> = {
  super_admin: "super_admin",
  org_admin: "admin",
  l3: "l3",
  l2: "l2",
  l1: "l1",
  // Legacy mappings (for any old data that wasn't migrated)
  hod: "l3",
  faculty: "l1",
  program_manager: "l2",
};

// Map display roles to DB roles - handles both new and legacy role names
export const displayToDbRole: Record<DisplayRole, DbRole> = {
  super_admin: "super_admin",
  admin: "org_admin",
  org_admin: "org_admin", // Legacy alias
  l3: "l3",
  l2: "l2", 
  l1: "l1",
  manager: "l3", // Legacy alias - manager maps to l3
  member: "l1", // Legacy alias - member maps to l1
  program_manager: "l2", // Legacy alias
};

// Helper functions
export function toDisplayRole(dbRole: DbRole | null): DisplayRole | null {
  return dbRole ? dbToDisplayRole[dbRole] : null;
}

export function toDbRole(displayRole: DisplayRole): DbRole {
  return displayToDbRole[displayRole];
}

// Normalize role to new system for comparisons
// This handles backward compatibility with old role names in UI code
export function normalizeRole(role: string | null): DisplayRole | null {
  if (!role) return null;
  
  // Map legacy display names to new roles
  const legacyMap: Record<string, DisplayRole> = {
    "org_admin": "admin",
    "manager": "l3",
    "member": "l1",
    "program_manager": "l2",
    "hod": "l3",
    "faculty": "l1",
  };
  
  if (legacyMap[role]) {
    return legacyMap[role];
  }
  
  // If it's already a new role name, return it
  if (["super_admin", "admin", "l3", "l2", "l1"].includes(role)) {
    return role as DisplayRole;
  }
  
  return role as DisplayRole;
}

// Check if roles match (handles legacy role comparisons)
export function rolesMatch(role1: string | null, role2: string | null): boolean {
  if (!role1 || !role2) return false;
  
  const normalized1 = normalizeRole(role1);
  const normalized2 = normalizeRole(role2);
  
  // Handle admin/org_admin equivalence
  if ((normalized1 === "admin" || normalized1 === "org_admin") && 
      (normalized2 === "admin" || normalized2 === "org_admin")) {
    return true;
  }
  
  // Handle l3/manager/hod equivalence
  if ((normalized1 === "l3" || normalized1 === "manager") && 
      (normalized2 === "l3" || normalized2 === "manager")) {
    return true;
  }
  
  // Handle l1/member/faculty equivalence
  if ((normalized1 === "l1" || normalized1 === "member") && 
      (normalized2 === "l1" || normalized2 === "member")) {
    return true;
  }
  
  // Handle l2/program_manager equivalence
  if ((normalized1 === "l2" || normalized1 === "program_manager") && 
      (normalized2 === "l2" || normalized2 === "program_manager")) {
    return true;
  }
  
  return normalized1 === normalized2;
}

// Check if a role is one of the given roles (with legacy support)
export function isRole(userRole: string | null | undefined, ...targetRoles: string[]): boolean {
  if (!userRole) return false;
  return targetRoles.some(target => rolesMatch(userRole, target));
}

// Default display labels for UI (can be customized per org)
export const roleLabels: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  org_admin: "Admin", // Legacy
  l3: "L3",
  l2: "L2",
  l1: "L1",
  manager: "L3", // Legacy
  member: "L1", // Legacy
  program_manager: "L2", // Legacy
};

// Role hierarchy levels (higher number = more authority)
export const roleLevels: Record<string, number> = {
  super_admin: 5,
  admin: 4,
  org_admin: 4,
  l3: 3,
  manager: 3,
  l2: 2,
  program_manager: 2,
  l1: 1,
  member: 1,
};

// Get role level for comparison
export function getRoleLevel(role: string | null): number {
  return role ? (roleLevels[role] || 0) : 0;
}

// Check if a role can manage another role
export function canManageRole(managerRole: string | null, targetRole: string): boolean {
  if (!managerRole) return false;
  return getRoleLevel(managerRole) > getRoleLevel(targetRole);
}

// Get roles that a given role can create
export function getCreatableRoles(role: string | null): DisplayRole[] {
  if (!role) return [];
  
  if (isRole(role, "super_admin")) {
    return ["super_admin", "admin", "l3", "l2", "l1"];
  }
  if (isRole(role, "admin", "org_admin")) {
    return ["admin", "l3", "l2", "l1"];
  }
  return [];
}

// Get roles whose entries can be approved by a given role
export function getApprovableRolesByRole(approverRole: string | null): string[] {
  if (!approverRole) return [];
  
  if (isRole(approverRole, "admin", "org_admin")) {
    return ["l3"]; // Admin approves L3 entries
  }
  if (isRole(approverRole, "l3", "manager")) {
    return ["l2", "l1"]; // L3 approves L2 and L1 entries
  }
  if (isRole(approverRole, "l2", "program_manager")) {
    return ["l1"]; // L2 approves L1 entries
  }
  return [];
}

// Check if a role requires timesheet submission
export function requiresTimesheet(role: string | null): boolean {
  if (!role) return false;
  return isRole(role, "l3", "l2", "l1", "manager", "member", "program_manager");
}

// Check if a role can access approvals
export function canAccessApprovals(role: string | null): boolean {
  if (!role) return false;
  return isRole(role, "admin", "org_admin", "l3", "l2", "manager", "program_manager");
}

// Check if a role can access admin features (user management, org settings)
export function canAccessAdminFeatures(role: string | null): boolean {
  if (!role) return false;
  return isRole(role, "super_admin", "admin", "org_admin");
}

// Check if a role can access cross-org features
export function canAccessCrossOrg(role: string | null): boolean {
  if (!role) return false;
  return isRole(role, "super_admin");
}

// Get all assignable roles (excluding super_admin for non-super-admins)
export function getAssignableRoles(currentUserRole: string | null): DisplayRole[] {
  if (!currentUserRole) return [];
  
  if (isRole(currentUserRole, "super_admin")) {
    return ["super_admin", "admin", "l3", "l2", "l1"];
  }
  
  if (isRole(currentUserRole, "admin", "org_admin")) {
    return ["admin", "l3", "l2", "l1"];
  }
  
  return [];
}

// Get DB role values that correspond to approvalable roles
export function getApprovableDbRoles(approverRole: string | null): DbRole[] {
  if (!approverRole) return [];
  
  if (isRole(approverRole, "admin", "org_admin")) {
    return ["l3"]; // Admin approves L3 entries
  }
  if (isRole(approverRole, "l3", "manager")) {
    return ["l2", "l1"]; // L3 approves L2 and L1 entries
  }
  if (isRole(approverRole, "l2", "program_manager")) {
    return ["l1"]; // L2 approves L1 entries
  }
  return [];
}
