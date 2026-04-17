import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLabels } from "@/contexts/LabelContext";
import { isRole, toDisplayRole } from "@/lib/roleMapping";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Building2, Pencil, Layers, FolderKanban, Users, User, Plus, Eye, GraduationCap, CalendarDays, BookOpen } from "lucide-react";
import { z } from "zod";
import { PageHeader } from "@/components/PageHeader";
import { PageSkeleton } from "@/components/PageSkeleton";
import { format } from "date-fns";

const organizationSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  code: z.string().min(2, "Code must be at least 2 characters").regex(/^[A-Z0-9_]+$/, "Code must be uppercase letters, numbers, and underscores only"),
});

interface Organization {
  id: string;
  name: string;
  code: string;
  created_at: string;
  verticalCount?: number;
  programCount?: number;
  batchCount?: number;
  termCount?: number;
  subjectCount?: number;
  userCount?: number;
}

interface VerticalInfo {
  id: string;
  name: string;
  code: string;
  userCount: number;
  programCount: number;
}

interface ProgramInfo {
  id: string;
  name: string;
  code: string;
  verticalName: string;
}

interface BatchInfo {
  id: string;
  name: string;
  programName: string;
}

interface TermInfo {
  id: string;
  name: string;
  batchName: string;
  programName: string;
}

interface SubjectInfo {
  id: string;
  name: string;
  code: string;
  termName: string;
}

interface UserInfo {
  id: string;
  full_name: string;
  role: string;
}

export default function Organizations() {
  const { userWithRole, loading } = useAuth();
  const { entityLabel } = useLabels();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Single org view (for Org Admin)
  const [organization, setOrganization] = useState<Organization | null>(null);
  
  // Multi-org view (for Super Admin)
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [formData, setFormData] = useState({ name: "", code: "" });
  const [verticalCount, setVerticalCount] = useState(0);
  const [programCount, setProgramCount] = useState(0);
  const [batchCount, setBatchCount] = useState(0);
  const [termCount, setTermCount] = useState(0);
  const [subjectCount, setSubjectCount] = useState(0);
  const [userCount, setUserCount] = useState(0);
  
  // Interactive dialogs
  const [verticalsDialogOpen, setVerticalsDialogOpen] = useState(false);
  const [programsDialogOpen, setProgramsDialogOpen] = useState(false);
  const [batchesDialogOpen, setBatchesDialogOpen] = useState(false);
  const [termsDialogOpen, setTermsDialogOpen] = useState(false);
  const [subjectsDialogOpen, setSubjectsDialogOpen] = useState(false);
  const [usersDialogOpen, setUsersDialogOpen] = useState(false);
  const [verticalUsersDialogOpen, setVerticalUsersDialogOpen] = useState(false);
  const [verticalProgramsDialogOpen, setVerticalProgramsDialogOpen] = useState(false);
  
  const [verticals, setVerticals] = useState<VerticalInfo[]>([]);
  const [programs, setPrograms] = useState<ProgramInfo[]>([]);
  const [batches, setBatches] = useState<BatchInfo[]>([]);
  const [terms, setTerms] = useState<TermInfo[]>([]);
  const [subjects, setSubjects] = useState<SubjectInfo[]>([]);
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [selectedVertical, setSelectedVertical] = useState<VerticalInfo | null>(null);
  const [verticalUsers, setVerticalUsers] = useState<UserInfo[]>([]);
  const [verticalPrograms, setVerticalPrograms] = useState<ProgramInfo[]>([]);

  const isSuperAdmin = isRole(userWithRole?.role, "super_admin");

  useEffect(() => {
    if (!loading && (!userWithRole || !isRole(userWithRole.role, "admin", "org_admin", "super_admin"))) {
      navigate("/dashboard");
    }
  }, [userWithRole, loading, navigate]);

  useEffect(() => {
    if (userWithRole && isRole(userWithRole.role, "admin", "org_admin", "super_admin")) {
      if (isSuperAdmin) {
        fetchAllOrganizations();
      } else {
        fetchOrganization();
      }
    }
  }, [userWithRole, isSuperAdmin]);

  // Fetch all organizations for Super Admin
  const fetchAllOrganizations = async () => {
    try {
      setIsLoading(true);
      
      const { data: orgsData, error: orgsError } = await supabase
        .from("organizations")
        .select("*")
        .order("name");

      if (orgsError) throw orgsError;

      // Get counts for each org
      const orgsWithCounts = await Promise.all(
        (orgsData || []).map(async (org) => {
          const [vertsRes, usersRes] = await Promise.all([
            supabase.from("verticals").select("id", { count: "exact", head: true }).eq("organization_id", org.id),
            supabase.from("user_roles").select("id", { count: "exact", head: true }).eq("organization_id", org.id),
          ]);

          // Get program count through verticals
          const { data: verts } = await supabase
            .from("verticals")
            .select("id")
            .eq("organization_id", org.id);
          
          const vertIds = verts?.map(v => v.id) || [];
          let progCount = 0;
          if (vertIds.length > 0) {
            const { count } = await supabase
              .from("programs")
              .select("*", { count: "exact", head: true })
              .in("vertical_id", vertIds);
            progCount = count || 0;
          }

          return {
            ...org,
            verticalCount: vertsRes.count || 0,
            programCount: progCount,
            userCount: usersRes.count || 0,
          };
        })
      );

      setOrganizations(orgsWithCounts);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch single organization for Org Admin
  const fetchOrganization = async () => {
    try {
      setIsLoading(true);
      
      const { data: roleData, error: roleError } = await supabase
        .from("user_roles")
        .select("organization_id")
        .eq("user_id", userWithRole?.user.id)
        .single();

      if (roleError) throw roleError;
      if (!roleData?.organization_id) {
        toast({
          title: "Error",
          description: "No organization found for your account",
          variant: "destructive",
        });
        return;
      }

      const { data: orgData, error: orgError } = await supabase
        .from("organizations")
        .select("*")
        .eq("id", roleData.organization_id)
        .single();

      if (orgError) throw orgError;

      const { count: vertCount } = await supabase
        .from("verticals")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", roleData.organization_id);

      const { data: verts } = await supabase
        .from("verticals")
        .select("id")
        .eq("organization_id", roleData.organization_id);
      
      const vertIds = verts?.map(v => v.id) || [];
      const { count: progCount } = await supabase
        .from("programs")
        .select("*", { count: "exact", head: true })
        .in("vertical_id", vertIds.length > 0 ? vertIds : ['00000000-0000-0000-0000-000000000000']);

      const { count: usrCount } = await supabase
        .from("user_roles")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", roleData.organization_id);

      setOrganization(orgData);
      setVerticalCount(vertCount || 0);
      setProgramCount(progCount || 0);
      setUserCount(usrCount || 0);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      const validated = organizationSchema.parse(formData);
      const { error } = await supabase
        .from("organizations")
        .insert([{ name: validated.name, code: validated.code }]);
      if (error) throw error;

      toast({
        title: "Success",
        description: "Organization created successfully",
      });
      setCreateDialogOpen(false);
      setFormData({ name: "", code: "" });
      fetchAllOrganizations();
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Validation Error",
          description: error.errors[0].message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      }
    }
  };

  const handleEdit = async () => {
    const targetOrg = isSuperAdmin ? selectedOrg : organization;
    if (!targetOrg) return;

    try {
      const validated = organizationSchema.parse(formData);
      const { error } = await supabase
        .from("organizations")
        .update(validated)
        .eq("id", targetOrg.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Organization updated successfully",
      });
      setEditDialogOpen(false);
      
      if (isSuperAdmin) {
        fetchAllOrganizations();
      } else {
        fetchOrganization();
      }
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Validation Error",
          description: error.errors[0].message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      }
    }
  };

  const openEditDialog = (org?: Organization) => {
    const targetOrg = org || organization;
    if (!targetOrg) return;
    setSelectedOrg(org || null);
    setFormData({ name: targetOrg.name, code: targetOrg.code });
    setEditDialogOpen(true);
  };

  const openVerticalsDialog = async (orgId?: string) => {
    const targetOrgId = orgId || organization?.id;
    if (!targetOrgId) return;
    
    try {
      const { data: verticalsData } = await supabase
        .from("verticals")
        .select("id, name, code")
        .eq("organization_id", targetOrgId)
        .order("name");

      const { data: programsData } = await supabase
        .from("programs")
        .select("id, vertical_id");

      const { data: userVerticalsData } = await supabase
        .from("user_verticals")
        .select("vertical_id, user_id");

      const programCounts = programsData?.reduce((acc, p) => {
        if (p.vertical_id) {
          acc[p.vertical_id] = (acc[p.vertical_id] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>) || {};

      const userCounts = userVerticalsData?.reduce((acc, uv) => {
        if (uv.vertical_id) {
          acc[uv.vertical_id] = (acc[uv.vertical_id] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>) || {};

      const verticalsWithCounts = verticalsData?.map(v => ({
        ...v,
        userCount: userCounts[v.id] || 0,
        programCount: programCounts[v.id] || 0,
      })) || [];

      setVerticals(verticalsWithCounts);
      setVerticalsDialogOpen(true);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const openProgramsDialog = async (orgId?: string) => {
    const targetOrgId = orgId || organization?.id;
    if (!targetOrgId) return;
    
    try {
      const { data: verts } = await supabase
        .from("verticals")
        .select("id")
        .eq("organization_id", targetOrgId);

      const vertIds = verts?.map(v => v.id) || [];
      
      if (vertIds.length === 0) {
        setPrograms([]);
        setProgramsDialogOpen(true);
        return;
      }

      const { data: programsData } = await supabase
        .from("programs")
        .select("id, name, code, verticals(name)")
        .in("vertical_id", vertIds)
        .order("name");

      const progs = programsData?.map(p => ({
        id: p.id,
        name: p.name,
        code: p.code,
        verticalName: p.verticals?.name || "N/A",
      })) || [];

      setPrograms(progs);
      setProgramsDialogOpen(true);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const openUsersDialog = async (orgId?: string) => {
    const targetOrgId = orgId || organization?.id;
    if (!targetOrgId) return;
    
    try {
      const { data: userRolesData } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .eq("organization_id", targetOrgId);

      const userIds = userRolesData?.map(ur => ur.user_id) || [];
      
      if (userIds.length === 0) {
        setUsers([]);
        setUsersDialogOpen(true);
        return;
      }

      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);

      const profileMap = new Map(profilesData?.map(p => [p.id, p.full_name]) || []);

      const usersWithRoles = userRolesData?.map(ur => ({
        id: ur.user_id,
        full_name: profileMap.get(ur.user_id) || "Unknown",
        role: toDisplayRole(ur.role) || ur.role,
      })) || [];

      setUsers(usersWithRoles);
      setUsersDialogOpen(true);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const openVerticalUsersDialog = async (vertical: VerticalInfo) => {
    setSelectedVertical(vertical);
    
    try {
      const { data: userVerticalsData } = await supabase
        .from("user_verticals")
        .select("user_id")
        .eq("vertical_id", vertical.id);

      const userIds = userVerticalsData?.map(uv => uv.user_id) || [];

      if (userIds.length === 0) {
        setVerticalUsers([]);
        setVerticalUsersDialogOpen(true);
        return;
      }

      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);

      const { data: userRolesData } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", userIds);

      const roleMap = new Map(userRolesData?.map(r => [r.user_id, r.role]) || []);

      const usersWithRoles = profilesData?.map(p => ({
        id: p.id,
        full_name: p.full_name,
        role: toDisplayRole(roleMap.get(p.id)) || roleMap.get(p.id) || "N/A",
      })) || [];

      setVerticalUsers(usersWithRoles);
      setVerticalUsersDialogOpen(true);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const openVerticalProgramsDialog = async (vertical: VerticalInfo) => {
    setSelectedVertical(vertical);
    
    try {
      const { data: programsData } = await supabase
        .from("programs")
        .select("id, name, code")
        .eq("vertical_id", vertical.id)
        .order("name");

      const progs = programsData?.map(p => ({
        id: p.id,
        name: p.name,
        code: p.code,
        verticalName: vertical.name,
      })) || [];

      setVerticalPrograms(progs);
      setVerticalProgramsDialogOpen(true);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (loading || isLoading) {
    return (
      <Layout>
        <PageSkeleton type="form" />
      </Layout>
    );
  }

  // Super Admin View - All Organizations
  if (isSuperAdmin) {
    return (
      <Layout>
        <div className="space-y-6">
          <PageHeader
            title="All Organizations"
            description="Manage all organizations in the system"
            icon={Building2}
            actions={
              <Button onClick={() => {
                setFormData({ name: "", code: "" });
                setCreateDialogOpen(true);
              }}>
                <Plus className="mr-2 h-4 w-4" />
                Create Organization
              </Button>
            }
          />

          <Card>
            <CardHeader>
              <CardTitle>Organizations ({organizations.length})</CardTitle>
              <CardDescription>
                Click on an organization to view details
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead className="text-center">{entityLabel("vertical", true)}</TableHead>
                    <TableHead className="text-center">{entityLabel("program", true)}</TableHead>
                    <TableHead className="text-center">Users</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {organizations.map((org) => (
                    <TableRow key={org.id}>
                      <TableCell className="font-medium">{org.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono">{org.code}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openVerticalsDialog(org.id)}
                        >
                          {org.verticalCount || 0}
                        </Button>
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openProgramsDialog(org.id)}
                        >
                          {org.programCount || 0}
                        </Button>
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openUsersDialog(org.id)}
                        >
                          {org.userCount || 0}
                        </Button>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {format(new Date(org.created_at), "MMM dd, yyyy")}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(org)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {organizations.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No organizations found. Create one to get started.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Create Organization Dialog */}
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Organization</DialogTitle>
                <DialogDescription>Add a new organization to the system</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="create-name">Name</Label>
                  <Input
                    id="create-name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Organization name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-code">Code</Label>
                  <Input
                    id="create-code"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    placeholder="ORG_CODE"
                  />
                  <p className="text-xs text-muted-foreground">
                    Uppercase letters, numbers, and underscores only
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleCreate}>Create</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Edit Dialog */}
          <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Organization</DialogTitle>
                <DialogDescription>Update organization details</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="code">Code</Label>
                  <Input
                    id="code"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleEdit}>Save Changes</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Verticals Dialog */}
          <Dialog open={verticalsDialogOpen} onOpenChange={setVerticalsDialogOpen}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{entityLabel("vertical", true)}</DialogTitle>
                <DialogDescription>
                  All {entityLabel("vertical", true).toLowerCase()} in this organization
                </DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
                {verticals.map((vertical) => (
                  <Card key={vertical.id} variant="interactive">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">{vertical.name}</CardTitle>
                      <CardDescription className="font-mono">{vertical.code}</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="flex gap-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
                          onClick={(e) => {
                            e.stopPropagation();
                            openVerticalUsersDialog(vertical);
                          }}
                        >
                          <Users className="h-4 w-4" />
                          <span>{vertical.userCount} users</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
                          onClick={(e) => {
                            e.stopPropagation();
                            openVerticalProgramsDialog(vertical);
                          }}
                        >
                          <FolderKanban className="h-4 w-4" />
                          <span>{vertical.programCount} {entityLabel("program", true).toLowerCase()}</span>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {verticals.length === 0 && (
                  <p className="text-muted-foreground col-span-2 text-center py-4">
                    No {entityLabel("vertical", true).toLowerCase()} found
                  </p>
                )}
              </div>
            </DialogContent>
          </Dialog>

          {/* Programs Dialog */}
          <Dialog open={programsDialogOpen} onOpenChange={setProgramsDialogOpen}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>All {entityLabel("program", true)}</DialogTitle>
                <DialogDescription>
                  {programs.length} {entityLabel("program", true).toLowerCase()} in this organization
                </DialogDescription>
              </DialogHeader>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>{entityLabel("vertical")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {programs.map((program) => (
                    <TableRow key={program.id}>
                      <TableCell>{program.name}</TableCell>
                      <TableCell className="font-mono">{program.code}</TableCell>
                      <TableCell>{program.verticalName}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </DialogContent>
          </Dialog>

          {/* Users Dialog */}
          <Dialog open={usersDialogOpen} onOpenChange={setUsersDialogOpen}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>All Users</DialogTitle>
                <DialogDescription>
                  {users.length} users in this organization
                </DialogDescription>
              </DialogHeader>
              <div className="max-h-96 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Role</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          {user.full_name}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{user.role}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </DialogContent>
          </Dialog>

          {/* Vertical Users Dialog */}
          <Dialog open={verticalUsersDialogOpen} onOpenChange={setVerticalUsersDialogOpen}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Users in {selectedVertical?.name}</DialogTitle>
                <DialogDescription>
                  {verticalUsers.length} users in this {entityLabel("vertical").toLowerCase()}
                </DialogDescription>
              </DialogHeader>
              {verticalUsers.length > 0 ? (
                <div className="max-h-96 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Role</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {verticalUsers.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            {user.full_name}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{user.role}</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-4">No users assigned to this {entityLabel("vertical").toLowerCase()}</p>
              )}
            </DialogContent>
          </Dialog>

          {/* Vertical Programs Dialog */}
          <Dialog open={verticalProgramsDialogOpen} onOpenChange={setVerticalProgramsDialogOpen}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{entityLabel("program", true)} in {selectedVertical?.name}</DialogTitle>
                <DialogDescription>
                  {verticalPrograms.length} {entityLabel("program", true).toLowerCase()} in this {entityLabel("vertical").toLowerCase()}
                </DialogDescription>
              </DialogHeader>
              {verticalPrograms.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Code</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {verticalPrograms.map((program) => (
                      <TableRow key={program.id}>
                        <TableCell>{program.name}</TableCell>
                        <TableCell className="font-mono">{program.code}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-muted-foreground text-center py-4">No {entityLabel("program", true).toLowerCase()} in this {entityLabel("vertical").toLowerCase()}</p>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </Layout>
    );
  }

  // Org Admin View - Single Organization
  return (
    <Layout>
      <div className="space-y-6">
        <PageHeader
          title={organization?.name || "Your Organization"}
          description={`Code: ${organization?.code || "N/A"}`}
          icon={Building2}
          actions={
            <Button onClick={() => openEditDialog()}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit Details
            </Button>
          }
        />

        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div
                className="text-center p-4 bg-muted rounded-lg cursor-pointer hover:bg-muted/80 transition-colors"
                onClick={() => openVerticalsDialog()}
              >
                <Layers className="h-6 w-6 mx-auto mb-2 text-primary" />
                <p className="text-2xl font-bold">{verticalCount}</p>
                <p className="text-sm text-muted-foreground">{entityLabel("vertical", true)}</p>
              </div>
              <div
                className="text-center p-4 bg-muted rounded-lg cursor-pointer hover:bg-muted/80 transition-colors"
                onClick={() => openProgramsDialog()}
              >
                <FolderKanban className="h-6 w-6 mx-auto mb-2 text-primary" />
                <p className="text-2xl font-bold">{programCount}</p>
                <p className="text-sm text-muted-foreground">{entityLabel("program", true)}</p>
              </div>
              <div
                className="text-center p-4 bg-muted rounded-lg cursor-pointer hover:bg-muted/80 transition-colors"
                onClick={() => openUsersDialog()}
              >
                <Users className="h-6 w-6 mx-auto mb-2 text-primary" />
                <p className="text-2xl font-bold">{userCount}</p>
                <p className="text-sm text-muted-foreground">Users</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Edit Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Organization</DialogTitle>
              <DialogDescription>Update your organization details</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="code">Code</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleEdit}>Save Changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Verticals Dialog */}
        <Dialog open={verticalsDialogOpen} onOpenChange={setVerticalsDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{entityLabel("vertical", true)}</DialogTitle>
              <DialogDescription>
                All {entityLabel("vertical", true).toLowerCase()} in your organization
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
              {verticals.map((vertical) => (
                <Card key={vertical.id} variant="interactive">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{vertical.name}</CardTitle>
                    <CardDescription className="font-mono">{vertical.code}</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex gap-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
                        onClick={(e) => {
                          e.stopPropagation();
                          openVerticalUsersDialog(vertical);
                        }}
                      >
                        <Users className="h-4 w-4" />
                        <span>{vertical.userCount} users</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
                        onClick={(e) => {
                          e.stopPropagation();
                          openVerticalProgramsDialog(vertical);
                        }}
                      >
                        <FolderKanban className="h-4 w-4" />
                        <span>{vertical.programCount} {entityLabel("program", true).toLowerCase()}</span>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </DialogContent>
        </Dialog>

        {/* Programs Dialog */}
        <Dialog open={programsDialogOpen} onOpenChange={setProgramsDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>All {entityLabel("program", true)}</DialogTitle>
              <DialogDescription>
                {programs.length} {entityLabel("program", true).toLowerCase()} in your organization
              </DialogDescription>
            </DialogHeader>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>{entityLabel("vertical")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {programs.map((program) => (
                  <TableRow key={program.id}>
                    <TableCell>{program.name}</TableCell>
                    <TableCell className="font-mono">{program.code}</TableCell>
                    <TableCell>{program.verticalName}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </DialogContent>
        </Dialog>

        {/* Users Dialog */}
        <Dialog open={usersDialogOpen} onOpenChange={setUsersDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>All Users</DialogTitle>
              <DialogDescription>
                {users.length} users in your organization
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        {user.full_name}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{user.role}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </DialogContent>
        </Dialog>

        {/* Vertical Users Dialog */}
        <Dialog open={verticalUsersDialogOpen} onOpenChange={setVerticalUsersDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Users in {selectedVertical?.name}</DialogTitle>
              <DialogDescription>
                {verticalUsers.length} users in this {entityLabel("vertical").toLowerCase()}
              </DialogDescription>
            </DialogHeader>
            {verticalUsers.length > 0 ? (
              <div className="max-h-96 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Role</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {verticalUsers.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          {user.full_name}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{user.role}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-4">No users assigned to this {entityLabel("vertical").toLowerCase()}</p>
            )}
          </DialogContent>
        </Dialog>

        {/* Vertical Programs Dialog */}
        <Dialog open={verticalProgramsDialogOpen} onOpenChange={setVerticalProgramsDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{entityLabel("program", true)} in {selectedVertical?.name}</DialogTitle>
              <DialogDescription>
                {verticalPrograms.length} {entityLabel("program", true).toLowerCase()} in this {entityLabel("vertical").toLowerCase()}
              </DialogDescription>
            </DialogHeader>
            {verticalPrograms.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Code</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {verticalPrograms.map((program) => (
                    <TableRow key={program.id}>
                      <TableCell>{program.name}</TableCell>
                      <TableCell className="font-mono">{program.code}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-muted-foreground text-center py-4">No {entityLabel("program", true).toLowerCase()} in this {entityLabel("vertical").toLowerCase()}</p>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
