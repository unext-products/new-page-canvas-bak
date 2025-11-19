// Database roles (what's stored in Supabase)
export type DbRole = "org_admin" | "program_manager" | "hod" | "faculty";

// Display roles (what users see)
export type DisplayRole = "org_admin" | "program_manager" | "manager" | "member";

// Bidirectional mapping
export const dbToDisplayRole: Record<DbRole, DisplayRole> = {
  org_admin: "org_admin",
  program_manager: "program_manager",
  hod: "manager",
  faculty: "member",
};

export const displayToDbRole: Record<DisplayRole, DbRole> = {
  org_admin: "org_admin",
  program_manager: "program_manager",
  manager: "hod",
  member: "faculty",
};

// Helper functions
export function toDisplayRole(dbRole: DbRole | null): DisplayRole | null {
  return dbRole ? dbToDisplayRole[dbRole] : null;
}

export function toDbRole(displayRole: DisplayRole): DbRole {
  return displayToDbRole[displayRole];
}

// Display labels for UI
export const roleLabels: Record<DisplayRole, string> = {
  org_admin: "Organization Admin",
  program_manager: "Program Manager",
  manager: "Manager",
  member: "Member",
};
