export interface TeamReportingLink { user_id: string; manager_id: string }
export interface HierarchyMember { id: string; fullName: string }

export function buildTeamHierarchy<T extends HierarchyMember>(members: T[], links: TeamReportingLink[], viewerId: string) {
  const unique = [...new Map(members.map(member => [member.id, member])).values()];
  const memberIds = new Set(unique.map(member => member.id));
  const directIds = new Set(links.filter(link => link.manager_id === viewerId).map(link => link.user_id));
  const direct = unique.filter(member => directIds.has(member.id));
  const other = unique.filter(member => !directIds.has(member.id));
  const groups = new Map<string, T[]>();
  for (const member of other) {
    const candidates = links.filter(link => link.user_id === member.id && memberIds.has(link.manager_id) && link.manager_id !== member.id);
    candidates.sort((a, b) => Number(directIds.has(b.manager_id)) - Number(directIds.has(a.manager_id)) || a.manager_id.localeCompare(b.manager_id));
    const key = candidates[0]?.manager_id || "unassigned";
    groups.set(key, [...(groups.get(key) || []), member]);
  }
  return { direct, other, groups, total: unique.length, directIds };
}