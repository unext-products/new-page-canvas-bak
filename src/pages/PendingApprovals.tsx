import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLabels } from "@/contexts/LabelContext";
import { isRole } from "@/lib/roleMapping";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/PageHeader";
import { PageSkeleton } from "@/components/PageSkeleton";
import { Badge } from "@/components/ui/badge";
import { ClipboardList, Download, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchAllRows } from "@/lib/reportQueries";
import { DateRangePicker } from "@/components/DateRangePicker";
import { formatLocalDate } from "@/lib/dateUtils";

interface ApproverPendingRow {
  userId: string;
  name: string;
  email: string;
  role: string;
  verticalName: string;
  mappedUsersCount: number;
  pendingCount: number;
}

export default function PendingApprovals() {
  const { userWithRole, loading } = useAuth();
  const { roleLabel } = useLabels();
  const navigate = useNavigate();
  const [data, setData] = useState<ApproverPendingRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [startDate, setStartDate] = useState<Date | undefined>(new Date(2026, 3, 1)); // 1st April 2026
  const [endDate, setEndDate] = useState<Date | undefined>(new Date());

  const hasAccess = isRole(userWithRole?.role, "admin", "org_admin", "super_admin", "l2", "l3", "program_manager", "manager", "hod");

  useEffect(() => {
    if (!loading && !hasAccess) {
      navigate("/dashboard");
    }
  }, [loading, hasAccess, navigate]);

  useEffect(() => {
    if (!hasAccess || loading) return;
    handleSubmit();
  }, [hasAccess, loading]);

  const handleSubmit = () => {
    fetchData(startDate, endDate);
  };

  const fetchData = async (fromDate?: Date, toDate?: Date) => {
    setIsLoading(true);
    try {
      const isSuperAdmin = isRole(userWithRole?.role, "super_admin");
      const isAdmin = isRole(userWithRole?.role, "admin", "org_admin", "super_admin");
      const isL2OrL3 = isRole(userWithRole?.role, "l2", "l3", "program_manager", "manager", "hod");

      // 1. Get user IDs in this organization (to scope everything)
      let orgUserIds: Set<string> | null = null;
      if (!isSuperAdmin && userWithRole?.user?.id) {
        // Get the current user's org
        const { data: orgRow } = await supabase
          .from("user_roles")
          .select("organization_id")
          .eq("user_id", userWithRole.user.id)
          .limit(1)
          .single();
        
        if (orgRow?.organization_id) {
          const allOrgUsers = await fetchAllRows(
            supabase
              .from("user_roles")
              .select("user_id")
              .eq("organization_id", orgRow.organization_id)
          );
          orgUserIds = new Set(allOrgUsers.map(u => u.user_id));
        }
      }

      // For L2/L3 users, scope to only their own reportees
      let scopedSubmitterIds: Set<string> | null = null;
      if (isL2OrL3 && !isAdmin && userWithRole?.user?.id) {
        // Get direct reportees (and transitive for L3)
        const { data: directReportees } = await supabase
          .from("reporting_hierarchy")
          .select("user_id")
          .eq("manager_id", userWithRole.user.id);
        
        const directIds = directReportees?.map(r => r.user_id) || [];
        scopedSubmitterIds = new Set(directIds);

        // For L2, also add program-based L1/faculty users (matching Approvals page logic)
        if (isRole(userWithRole?.role, "l2", "program_manager")) {
          const { data: l2Programs } = await supabase
            .from("user_programs")
            .select("program_id")
            .eq("user_id", userWithRole.user.id);
          const l2ProgramIds = l2Programs?.map(p => p.program_id) || [];

          if (l2ProgramIds.length > 0) {
            const CHUNK_P = 30;
            for (let i = 0; i < l2ProgramIds.length; i += CHUNK_P) {
              const chunk = l2ProgramIds.slice(i, i + CHUNK_P);
              const { data: programUsers } = await supabase
                .from("user_programs")
                .select("user_id")
                .in("program_id", chunk);
              if (programUsers) {
                // Filter to L1/faculty roles
                const pUserIds = programUsers.map(u => u.user_id);
                for (let j = 0; j < pUserIds.length; j += CHUNK_P) {
                  const uChunk = pUserIds.slice(j, j + CHUNK_P);
                  const { data: l1Roles } = await supabase
                    .from("user_roles")
                    .select("user_id")
                    .in("user_id", uChunk)
                    .in("role", ["l1", "faculty"]);
                  if (l1Roles) {
                    l1Roles.forEach(r => scopedSubmitterIds!.add(r.user_id));
                  }
                }
              }
            }
          }
        }

        // For L3, also get transitive reportees (L1s under L2s)
        if (isRole(userWithRole?.role, "l3", "manager", "hod") && directIds.length > 0) {
          const CHUNK = 30;
          for (let i = 0; i < directIds.length; i += CHUNK) {
            const chunk = directIds.slice(i, i + CHUNK);
            const { data: transitiveReportees } = await supabase
              .from("reporting_hierarchy")
              .select("user_id")
              .in("manager_id", chunk);
            if (transitiveReportees) {
              transitiveReportees.forEach(r => scopedSubmitterIds!.add(r.user_id));
            }
          }
        }
      }

      // 2. Get all submitted entries (pending approval), with optional date filter
      let submittedQuery = supabase
        .from("timesheet_entries")
        .select("user_id")
        .eq("status", "submitted");
      if (fromDate) {
        submittedQuery = submittedQuery.gte("entry_date", formatLocalDate(fromDate));
      }
      if (toDate) {
        submittedQuery = submittedQuery.lte("entry_date", formatLocalDate(toDate));
      }
      const submittedEntries = await fetchAllRows(submittedQuery);

      if (!submittedEntries.length) {
        setData([]);
        setIsLoading(false);
        return;
      }

      // 3. Count pending entries per submitter, filtered to org and scope
      const countBySubmitter: Record<string, number> = {};
      for (const entry of submittedEntries) {
        if (orgUserIds && !orgUserIds.has(entry.user_id)) continue;
        if (scopedSubmitterIds && !scopedSubmitterIds.has(entry.user_id)) continue;
        countBySubmitter[entry.user_id] = (countBySubmitter[entry.user_id] || 0) + 1;
      }
      const submitterIds = Object.keys(countBySubmitter);

      // 4. Get reporting hierarchy to find each submitter's manager
      const CHUNK = 30;
      const allHierarchyRows: { user_id: string; manager_id: string }[] = [];
      for (let i = 0; i < submitterIds.length; i += CHUNK) {
        const chunk = submitterIds.slice(i, i + CHUNK);
        const { data: rows } = await supabase
          .from("reporting_hierarchy")
          .select("user_id, manager_id")
          .in("user_id", chunk);
        if (rows) allHierarchyRows.push(...rows);
      }

      // 4b. Build program-based approver mapping for L2 users
      // Find all L2/program_manager users and their program-based L1/faculty submitters
      // This mirrors the additive scoping logic from the Approvals page
      const programApproverRows: { user_id: string; manager_id: string }[] = [];
      {
        // Get all L2/program_manager users in the org
        const l2RoleUsers: string[] = [];
        if (orgUserIds) {
          const orgUserArr = Array.from(orgUserIds);
          for (let i = 0; i < orgUserArr.length; i += CHUNK) {
            const chunk = orgUserArr.slice(i, i + CHUNK);
            const { data: roleRows } = await supabase
              .from("user_roles")
              .select("user_id, role")
              .in("user_id", chunk)
              .in("role", ["l2", "program_manager"]);
            if (roleRows) l2RoleUsers.push(...roleRows.map(r => r.user_id));
          }
        } else {
          // Super admin: get all L2s
          const { data: allL2s } = await supabase
            .from("user_roles")
            .select("user_id")
            .in("role", ["l2", "program_manager"]);
          if (allL2s) l2RoleUsers.push(...allL2s.map(r => r.user_id));
        }

        // For L2/L3 non-admin, only process their own programs
        const l2sToProcess = (isL2OrL3 && !isAdmin) 
          ? l2RoleUsers.filter(id => id === userWithRole?.user?.id)
          : l2RoleUsers;

        // For each L2, get their programs and find L1/faculty submitters
        for (const l2Id of l2sToProcess) {
          const { data: l2Progs } = await supabase
            .from("user_programs")
            .select("program_id")
            .eq("user_id", l2Id);
          const progIds = l2Progs?.map(p => p.program_id) || [];
          if (!progIds.length) continue;

          // Get all users in those programs
          const programUserIds = new Set<string>();
          for (let i = 0; i < progIds.length; i += CHUNK) {
            const chunk = progIds.slice(i, i + CHUNK);
            const { data: pu } = await supabase
              .from("user_programs")
              .select("user_id")
              .in("program_id", chunk);
            if (pu) pu.forEach(u => programUserIds.add(u.user_id));
          }

          // Filter to L1/faculty roles who have pending entries
          const puArr = Array.from(programUserIds).filter(uid => countBySubmitter[uid]);
          if (!puArr.length) continue;

          for (let i = 0; i < puArr.length; i += CHUNK) {
            const chunk = puArr.slice(i, i + CHUNK);
            const { data: l1Roles } = await supabase
              .from("user_roles")
              .select("user_id")
              .in("user_id", chunk)
              .in("role", ["l1", "faculty"]);
            if (l1Roles) {
              l1Roles.forEach(r => {
                programApproverRows.push({ user_id: r.user_id, manager_id: l2Id });
              });
            }
          }
        }
      }

      // 5. Aggregate pending count per approver (manager), scoped to org
      // Use a Set per approver to avoid double-counting submitters mapped via both hierarchy and programs
      const approverSubmitters: Record<string, Set<string>> = {};
      const addToApprover = (managerId: string, submitterId: string) => {
        if (orgUserIds && !orgUserIds.has(managerId)) return;
        if (isL2OrL3 && !isAdmin && managerId !== userWithRole?.user?.id) return;
        if (!countBySubmitter[submitterId]) return;
        if (!approverSubmitters[managerId]) approverSubmitters[managerId] = new Set();
        approverSubmitters[managerId].add(submitterId);
      };

      for (const row of allHierarchyRows) {
        addToApprover(row.manager_id, row.user_id);
      }
      for (const row of programApproverRows) {
        addToApprover(row.manager_id, row.user_id);
      }

      // Now sum up pending counts per approver
      const countByApprover: Record<string, number> = {};
      for (const [approverId, submitters] of Object.entries(approverSubmitters)) {
        let total = 0;
        const submitterArr = Array.from(submitters);
        for (const sid of submitterArr) {
          total += countBySubmitter[sid] || 0;
        }
        if (total > 0) countByApprover[approverId] = total;
      }

      // Also check for L3 entries — they are approved by admin, no hierarchy row needed
      // Get roles for submitters to find L3s without hierarchy mapping
      const submitterRoles: { user_id: string; role: string }[] = [];
      for (let i = 0; i < submitterIds.length; i += CHUNK) {
        const chunk = submitterIds.slice(i, i + CHUNK);
        const { data: roles } = await supabase
          .from("user_roles")
          .select("user_id, role")
          .in("user_id", chunk);
        if (roles) submitterRoles.push(...roles);
      }

      // For submitters who have no manager in hierarchy, check if they're L3 (approved by admin directly)
      const submittersWithManager = new Set(allHierarchyRows.map(r => r.user_id));
      const unmappedSubmitters = submitterIds.filter(id => !submittersWithManager.has(id));
      
      // Count unmapped L3 entries as "admin-approved" — but we attribute to "Admin" role generically
      // Actually, for this report we only show users who are approvers, so unmapped entries without a manager aren't attributable

      const approverIds = Object.keys(countByApprover);
      if (!approverIds.length) {
        setData([]);
        setIsLoading(false);
        return;
      }

      // 5. Get approver profiles
      const profiles: Record<string, { name: string; email: string }> = {};
      for (let i = 0; i < approverIds.length; i += CHUNK) {
        const chunk = approverIds.slice(i, i + CHUNK);
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", chunk);
        if (profs) profs.forEach(p => { profiles[p.id] = { name: p.full_name, email: p.email || "" }; });
      }

      // 6. Get approver roles
      const roles: Record<string, string> = {};
      for (let i = 0; i < approverIds.length; i += CHUNK) {
        const chunk = approverIds.slice(i, i + CHUNK);
        const { data: rls } = await supabase
          .from("user_roles")
          .select("user_id, role")
          .in("user_id", chunk);
        if (rls) rls.forEach(r => { roles[r.user_id] = r.role; });
      }

      // 7. Get approver verticals
      const verticalIds: Record<string, string[]> = {};
      for (let i = 0; i < approverIds.length; i += CHUNK) {
        const chunk = approverIds.slice(i, i + CHUNK);
        const { data: uvs } = await supabase
          .from("user_verticals")
          .select("user_id, vertical_id")
          .in("user_id", chunk);
        if (uvs) {
          uvs.forEach(uv => {
            if (!verticalIds[uv.user_id]) verticalIds[uv.user_id] = [];
            verticalIds[uv.user_id].push(uv.vertical_id);
          });
        }
      }

      // 8. Get vertical names
      const allVertIds = Array.from(new Set(Object.values(verticalIds).flat()));
      const verticalNames: Record<string, string> = {};
      for (let i = 0; i < allVertIds.length; i += CHUNK) {
        const chunk = allVertIds.slice(i, i + CHUNK);
        const { data: verts } = await supabase
          .from("verticals")
          .select("id, name")
          .in("id", chunk);
        if (verts) verts.forEach(v => { verticalNames[v.id] = v.name; });
      }

      // 9. Get total reportee count per approver (matching edit form logic: active + same vertical + correct role)
      const reporteeCount: Record<string, number> = {};
      // Collect all hierarchy rows for approvers
      const approverHierarchyRows: { manager_id: string; user_id: string }[] = [];
      for (let i = 0; i < approverIds.length; i += CHUNK) {
        const chunk = approverIds.slice(i, i + CHUNK);
        const { data: allReportees } = await supabase
          .from("reporting_hierarchy")
          .select("manager_id, user_id")
          .in("manager_id", chunk);
        if (allReportees) approverHierarchyRows.push(...allReportees);
      }

      if (approverHierarchyRows.length > 0) {
        // Get all unique user IDs (managers + reportees) for profile/role/vertical lookups
        const allUserIdsForCount = Array.from(new Set([
          ...approverIds,
          ...approverHierarchyRows.map(r => r.user_id),
        ]));

        // Fetch active status
        const activeIds = new Set<string>();
        for (let i = 0; i < allUserIdsForCount.length; i += CHUNK) {
          const chunk = allUserIdsForCount.slice(i, i + CHUNK);
          const { data: profs } = await supabase
            .from("profiles")
            .select("id")
            .in("id", chunk)
            .eq("is_active", true);
          if (profs) profs.forEach(p => activeIds.add(p.id));
        }

        // Fetch roles for all
        const userRoleMap: Record<string, string> = {};
        for (let i = 0; i < allUserIdsForCount.length; i += CHUNK) {
          const chunk = allUserIdsForCount.slice(i, i + CHUNK);
          const { data: rls } = await supabase
            .from("user_roles")
            .select("user_id, role")
            .in("user_id", chunk);
          if (rls) rls.forEach(r => { userRoleMap[r.user_id] = r.role; });
        }

        // Fetch verticals for all
        const userVertSets: Record<string, Set<string>> = {};
        for (let i = 0; i < allUserIdsForCount.length; i += CHUNK) {
          const chunk = allUserIdsForCount.slice(i, i + CHUNK);
          const { data: uvs } = await supabase
            .from("user_verticals")
            .select("user_id, vertical_id")
            .in("user_id", chunk);
          if (uvs) uvs.forEach(uv => {
            if (!userVertSets[uv.user_id]) userVertSets[uv.user_id] = new Set();
            userVertSets[uv.user_id].add(uv.vertical_id);
          });
        }

        // Group hierarchy by manager and count matching edit form logic
        const managerGroups: Record<string, string[]> = {};
        approverHierarchyRows.forEach(r => {
          if (!managerGroups[r.manager_id]) managerGroups[r.manager_id] = [];
          managerGroups[r.manager_id].push(r.user_id);
        });

        for (const [managerId, repIds] of Object.entries(managerGroups)) {
          const mRole = userRoleMap[managerId];
          const isL3Mgr = mRole === 'l3' || mRole === 'hod';
          const targetRoles = isL3Mgr ? ['l2', 'program_manager'] : ['l1', 'faculty'];
          const managerVerts = userVertSets[managerId];

          let count = 0;
          for (const rid of repIds) {
            if (orgUserIds && !orgUserIds.has(rid)) continue;
            if (!activeIds.has(rid)) continue;
            const rRole = userRoleMap[rid];
            if (!rRole || !targetRoles.includes(rRole)) continue;
            if (managerVerts && managerVerts.size > 0) {
              const repVerts = userVertSets[rid];
              if (!repVerts) continue;
              let shared = false;
              managerVerts.forEach(v => { if (repVerts.has(v)) shared = true; });
              if (!shared) continue;
            }
            count++;
          }
          if (count > 0) reporteeCount[managerId] = count;
        }
      }

      // 10. Build result rows
      const rows: ApproverPendingRow[] = approverIds.map(id => {
        const userVertIds = verticalIds[id] || [];
        const vertNames = userVertIds.map(vid => verticalNames[vid] || "").filter(Boolean);
        const profile = profiles[id] || { name: "Unknown", email: "" };
        return {
          userId: id,
          name: profile.name,
          email: profile.email,
          role: roles[id] || "",
          verticalName: vertNames.join(", ") || "—",
          mappedUsersCount: reporteeCount[id] || 0,
          pendingCount: countByApprover[id],
        };
      });

      // Sort descending by pending count
      rows.sort((a, b) => b.pendingCount - a.pendingCount);
      setData(rows);
    } catch (err) {
      console.error("Error fetching pending approvals data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  if (loading) return <Layout><PageSkeleton /></Layout>;
  if (!hasAccess) return null;

  const getRoleDisplay = (role: string) => {
    if (isRole(role, "l3")) return roleLabel("l3");
    if (isRole(role, "l2")) return roleLabel("l2");
    if (isRole(role, "l1")) return roleLabel("l1");
    if (isRole(role, "admin", "org_admin")) return roleLabel("admin");
    return role;
  };

  const exportCSV = () => {
    if (!data.length) return;
    const headers = ["Name", "Email", "Role", "Vertical", "Mapped Users", "Pending Approvals"];
    const rows = data.map(row => [
      row.name,
      row.email,
      getRoleDisplay(row.role),
      row.verticalName,
      row.mappedUsersCount,
      row.pendingCount,
    ]);
    const csvContent = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "pending_approvals.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <PageHeader
            title="Pending Approvals"
            description="Users with pending approval requests, sorted by highest count"
            icon={ClipboardList}
          />
          {data.length > 0 && (
            <Button variant="outline" size="sm" onClick={exportCSV}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          )}
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap items-end gap-4 mb-6">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Start Date</label>
                <DateRangePicker
                  date={startDate}
                  onDateChange={setStartDate}
                  placeholder="Start date"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">End Date</label>
                <DateRangePicker
                  date={endDate}
                  onDateChange={setEndDate}
                  placeholder="End date"
                />
              </div>
              <Button onClick={handleSubmit} disabled={isLoading}>
                <Search className="h-4 w-4 mr-2" />
                Submit
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : data.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No pending approvals found.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Vertical</TableHead>
                    <TableHead className="text-right">Mapped Users</TableHead>
                    <TableHead className="text-right">Pending Approvals</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((row) => (
                    <TableRow key={row.userId}>
                      <TableCell>
                        <div className="font-medium">{row.name}</div>
                        {row.email && <div className="text-xs text-muted-foreground">{row.email}</div>}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{getRoleDisplay(row.role)}</Badge>
                      </TableCell>
                      <TableCell>{row.verticalName}</TableCell>
                      <TableCell className="text-right">{row.mappedUsersCount}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="destructive">{row.pendingCount}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
