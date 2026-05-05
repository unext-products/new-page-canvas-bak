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
import { ClipboardList } from "lucide-react";
import { fetchAllRows } from "@/lib/reportQueries";

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

  const hasAccess = isRole(userWithRole?.role, "admin", "org_admin", "super_admin");

  useEffect(() => {
    if (!loading && !hasAccess) {
      navigate("/dashboard");
    }
  }, [loading, hasAccess, navigate]);

  useEffect(() => {
    if (!hasAccess || loading) return;
    fetchData();
  }, [hasAccess, loading]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // 1. Get all submitted entries (pending approval)
      const submittedEntries = await fetchAllRows(
        supabase
          .from("timesheet_entries")
          .select("user_id")
          .eq("status", "submitted")
      );

      if (!submittedEntries.length) {
        setData([]);
        setIsLoading(false);
        return;
      }

      // 2. Count pending entries per submitter
      const countBySubmitter: Record<string, number> = {};
      for (const entry of submittedEntries) {
        countBySubmitter[entry.user_id] = (countBySubmitter[entry.user_id] || 0) + 1;
      }
      const submitterIds = Object.keys(countBySubmitter);

      // 3. Get reporting hierarchy to find each submitter's manager
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

      // 4. Aggregate pending count and mapped user count per approver (manager)
      const countByApprover: Record<string, number> = {};
      const mappedUsersByApprover: Record<string, Set<string>> = {};
      for (const row of allHierarchyRows) {
        if (!mappedUsersByApprover[row.manager_id]) mappedUsersByApprover[row.manager_id] = new Set();
        mappedUsersByApprover[row.manager_id].add(row.user_id);
        const submitterPending = countBySubmitter[row.user_id] || 0;
        if (submitterPending > 0) {
          countByApprover[row.manager_id] = (countByApprover[row.manager_id] || 0) + submitterPending;
        }
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
      const allVertIds = [...new Set(Object.values(verticalIds).flat())];
      const verticalNames: Record<string, string> = {};
      for (let i = 0; i < allVertIds.length; i += CHUNK) {
        const chunk = allVertIds.slice(i, i + CHUNK);
        const { data: verts } = await supabase
          .from("verticals")
          .select("id, name")
          .in("id", chunk);
        if (verts) verts.forEach(v => { verticalNames[v.id] = v.name; });
      }

      // 9. Build result rows
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
          mappedUsersCount: mappedUsersByApprover[id]?.size || 0,
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

  return (
    <Layout>
      <div className="space-y-6">
        <PageHeader
          title="Pending Approvals"
          description="Users with pending approval requests, sorted by highest count"
          icon={ClipboardList}
        />

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
