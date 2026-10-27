export interface DashboardReportee {
  id: string;
  full_name: string;
  is_active: boolean;
  role?: string | null;
}

/** Loading and user transitions must never expose another user's cached reportees. */
export function getDashboardReporteesForUser(
  result: { userId: string; reportees: DashboardReportee[] } | null,
  userId: string | undefined,
): DashboardReportee[] {
  if (!result || !userId || result.userId !== userId) return [];
  return result.reportees;
}

/** Direct assignments only; inactive profiles still belong to their manager. */
export function resolveDashboardReportees(
  mappings: { manager_id: string; user_id: string }[],
  profiles: DashboardReportee[],
  managerId: string,
): DashboardReportee[] {
  const ids = new Set(mappings.filter(row => row.manager_id === managerId).map(row => row.user_id));
  const uniqueProfiles = new Map(profiles.filter(profile => ids.has(profile.id)).map(profile => [profile.id, profile]));
  return [...uniqueProfiles.values()].sort((a, b) => a.full_name.localeCompare(b.full_name));
}