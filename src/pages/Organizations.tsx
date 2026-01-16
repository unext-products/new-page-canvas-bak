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
import { Building2, Pencil, Layers, FolderKanban, Users, User } from "lucide-react";
import { z } from "zod";
import { PageHeader } from "@/components/PageHeader";
import { PageSkeleton } from "@/components/PageSkeleton";

const organizationSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  code: z.string().min(2, "Code must be at least 2 characters").regex(/^[A-Z0-9_]+$/, "Code must be uppercase letters, numbers, and underscores only"),
});

interface Organization {
  id: string;
  name: string;
  code: string;
  created_at: string;
  program_count?: number;
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
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [formData, setFormData] = useState({ name: "", code: "" });
  const [verticalCount, setVerticalCount] = useState(0);
  const [programCount, setProgramCount] = useState(0);
  const [userCount, setUserCount] = useState(0);
  
  // Interactive dialogs
  const [verticalsDialogOpen, setVerticalsDialogOpen] = useState(false);
  const [programsDialogOpen, setProgramsDialogOpen] = useState(false);
  const [usersDialogOpen, setUsersDialogOpen] = useState(false);
  const [verticalUsersDialogOpen, setVerticalUsersDialogOpen] = useState(false);
  const [verticalProgramsDialogOpen, setVerticalProgramsDialogOpen] = useState(false);
  
  const [verticals, setVerticals] = useState<VerticalInfo[]>([]);
  const [programs, setPrograms] = useState<ProgramInfo[]>([]);
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [selectedVertical, setSelectedVertical] = useState<VerticalInfo | null>(null);
  const [verticalUsers, setVerticalUsers] = useState<UserInfo[]>([]);
  const [verticalPrograms, setVerticalPrograms] = useState<ProgramInfo[]>([]);

  useEffect(() => {
    if (!loading && (!userWithRole || !isRole(userWithRole.role, "admin", "org_admin", "super_admin"))) {
      navigate("/dashboard");
    }
  }, [userWithRole, loading, navigate]);

  useEffect(() => {
    if (userWithRole && isRole(userWithRole.role, "admin", "org_admin", "super_admin")) {
      fetchOrganization();
    }
  }, [userWithRole]);

  const fetchOrganization = async () => {
    try {
      setIsLoading(true);
      
      // Get user's organization ID
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

      // Fetch organization details
      const { data: orgData, error: orgError } = await supabase
        .from("organizations")
        .select("*")
        .eq("id", roleData.organization_id)
        .single();

      if (orgError) throw orgError;

      // Fetch vertical count (from verticals table)
      const { count: vertCount } = await supabase
        .from("verticals")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", roleData.organization_id);

      // Fetch program count (through verticals)
      const { data: verts } = await supabase
        .from("verticals")
        .select("id")
        .eq("organization_id", roleData.organization_id);
      
      const vertIds = verts?.map(v => v.id) || [];
      const { count: progCount } = await supabase
        .from("programs")
        .select("*", { count: "exact", head: true })
        .in("vertical_id", vertIds.length > 0 ? vertIds : ['00000000-0000-0000-0000-000000000000']);

      // Fetch user count
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

  const handleEdit = async () => {
    if (!organization) return;

    try {
      const validated = organizationSchema.parse(formData);
      const { error } = await supabase
        .from("organizations")
        .update(validated)
        .eq("id", organization.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Organization updated successfully",
      });
      setEditDialogOpen(false);
      fetchOrganization();
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

  const openEditDialog = () => {
    if (!organization) return;
    setFormData({ name: organization.name, code: organization.code });
    setEditDialogOpen(true);
  };

  const openVerticalsDialog = async () => {
    if (!organization) return;
    
    try {
      // Fetch verticals with counts
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("organization_id")
        .eq("user_id", userWithRole?.user.id)
        .single();

      const { data: verticalsData } = await supabase
        .from("verticals")
        .select("id, name, code")
        .eq("organization_id", roleData?.organization_id)
        .order("name");

      const { data: programsData } = await supabase
        .from("programs")
        .select("id, vertical_id");

      const { data: userVerticalsData } = await supabase
        .from("user_verticals")
        .select("vertical_id, user_id");

      // Count programs per vertical
      const programCounts = programsData?.reduce((acc, p) => {
        if (p.vertical_id) {
          acc[p.vertical_id] = (acc[p.vertical_id] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>) || {};

      // Count users per vertical
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

  const openProgramsDialog = async () => {
    if (!organization) return;
    
    try {
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("organization_id")
        .eq("user_id", userWithRole?.user.id)
        .single();

      const { data: programsData } = await supabase
        .from("programs")
        .select("id, name, code, verticals(name)")
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

  const openUsersDialog = async () => {
    if (!organization) return;
    
    try {
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("organization_id")
        .eq("user_id", userWithRole?.user.id)
        .single();

      const { data: userRolesData } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .eq("organization_id", roleData?.organization_id);

      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, full_name");

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

  return (
    <Layout>
      <div className="space-y-6">
        <PageHeader
          title={organization?.name || "Your Organization"}
          description={`Code: ${organization?.code}`}
          icon={Building2}
          actions={
            <Button onClick={openEditDialog}>
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
                onClick={openVerticalsDialog}
              >
                <Layers className="h-6 w-6 mx-auto mb-2 text-primary" />
                <p className="text-2xl font-bold">{verticalCount}</p>
                <p className="text-sm text-muted-foreground">{entityLabel("vertical", true)}</p>
              </div>
              <div
                className="text-center p-4 bg-muted rounded-lg cursor-pointer hover:bg-muted/80 transition-colors"
                onClick={openProgramsDialog}
              >
                <FolderKanban className="h-6 w-6 mx-auto mb-2 text-primary" />
                <p className="text-2xl font-bold">{programCount}</p>
                <p className="text-sm text-muted-foreground">{entityLabel("program", true)}</p>
              </div>
              <div
                className="text-center p-4 bg-muted rounded-lg cursor-pointer hover:bg-muted/80 transition-colors"
                onClick={openUsersDialog}
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
