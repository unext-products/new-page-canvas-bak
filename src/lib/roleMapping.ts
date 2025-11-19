// Database roles (what's stored in Supabase)
export type DbRole = "admin" | "hod" | "faculty";

// Display roles (what users see)
export type DisplayRole = "admin" | "manager" | "member";

// Bidirectional mapping
export const dbToDisplayRole: Record<DbRole, DisplayRole> = {
  admin: "admin",
  hod: "manager",
  faculty: "member",
};

export const displayToDbRole: Record<DisplayRole, DbRole> = {
  admin: "admin",
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
  admin: "Administrator",
  manager: "Manager",
  member: "Member",
};
