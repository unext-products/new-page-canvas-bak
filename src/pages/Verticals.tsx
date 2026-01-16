import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLabels } from "@/contexts/LabelContext";
import { isRole } from "@/lib/roleMapping";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Users, Layers, FolderKanban, User } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toDisplayRole } from "@/lib/roleMapping";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { z } from "zod";
import { getUserErrorMessage } from "@/lib/errorHandler";
import { PageHeader } from "@/components/PageHeader";
import { PageSkeleton } from "@/components/PageSkeleton";
import { EmptyState } from "@/components/EmptyState";

const verticalSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  code: z.string().min(2, "Code must be at least 2 characters").max(10, "Code must be at most 10 characters"),
});

interface ProgramWithUsers {
  id: string;
  name: string;
  code: string;
  userCount: number;
}

interface VerticalUser {
  id: string;
  full_name: string;
  role: string;
}

interface Vertical {
  id: string;
  name: string;
  code: string;
  organization_id: string;
  created_at: string;
  userCount?: number;
  programCount?: number;
  programs?: ProgramWithUsers[];
  users?: VerticalUser[];
}

export default function Verticals() {
  const { userWithRole, loading } = useAuth();
  const { entityLabel } = useLabels();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [verticals, setVerticals] = useState<Vertical[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [usersDialogOpen, setUsersDialogOpen] = useState(false);
  const [selectedVertical, setSelectedVertical] = useState<Vertical | null>(null);
  const [formData, setFormData] = useState({ name: "", code: "" });
  const [userOrgId, setUserOrgId] = useState<string>("");

  useEffect(() => {
    if (!loading && (!userWithRole || !isRole(userWithRole.role, "admin", "org_admin", "super_admin", "l3"))) {
      navigate("/dashboard");
    }
  }, [userWithRole, loading, navigate]);

  useEffect(() => {
    if (userWithRole && isRole(userWithRole.role, "admin", "org_admin", "super_admin", "l3")) {
      fetchUserOrganization();
      fetchVerticals();
    }
  }, [userWithRole]);

  const fetchUserOrganization = async () => {
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("organization_id")
        .eq("user_id", userWithRole?.user.id)
        .single();

      if (error) throw error;
      if (data?.organization_id) {
        setUserOrgId(data.organization_id);
      }
    } catch (error: any) {
      console.error("Error fetching user organization:", error);
    }
  };

  const fetchVerticals = async () => {
    try {
      setIsLoading(true);
      
      // Fetch verticals
      const { data: verticalData, error: verticalError } = await supabase
        .from("verticals")
        .select("*")
        .order("name");

      if (verticalError) throw verticalError;

      // Fetch programs
      const { data: programsData, error: programsError } = await supabase
        .from("programs")
        .select("id, name, code, vertical_id");

      if (programsError) throw programsError;

      // Fetch user_verticals to get users in each vertical
      const { data: userVerticals, error: userVerticalsError } = await supabase
        .from("user_verticals")
        .select("user_id, vertical_id");

      if (userVerticalsError) throw userVerticalsError;

      // Fetch user roles
      const { data: userRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role");

      if (rolesError) throw rolesError;

      // Fetch profiles
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name");

      if (profilesError) throw profilesError;

      // Create lookup maps
      const profileMap = new Map(profiles?.map(p => [p.id, p.full_name]) || []);
      const roleMap = new Map(userRoles?.map(r => [r.user_id, r.role]) || []);

      // Group users by vertical - include all role types
      const usersByVertical = userVerticals?.reduce((acc, uv) => {
        if (uv.vertical_id && uv.user_id) {
          if (!acc[uv.vertical_id]) acc[uv.vertical_id] = [];
          const role = roleMap.get(uv.user_id);
          // Include all users assigned to the vertical, not just faculty/hod
          if (role && ['l1', 'l2', 'l3', 'hod', 'faculty', 'admin', 'org_admin', 'program_manager'].includes(role)) {
            acc[uv.vertical_id].push({
              id: uv.user_id,
              full_name: profileMap.get(uv.user_id) || 'Unknown',
              role: toDisplayRole(role) || role
            });
          }
        }
        return acc;
      }, {} as Record<string, VerticalUser[]>);

      // Count users per program
      const { data: userPrograms } = await supabase
        .from("user_programs")
        .select("user_id, program_id");
      
      const programUserCounts = userPrograms?.reduce((acc, up) => {
        if (up.program_id) {
          acc[up.program_id] = (acc[up.program_id] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>) || {};

      // Group programs by vertical with user counts
      const programsByVertical = programsData?.reduce((acc, prog) => {
        if (prog.vertical_id) {
          if (!acc[prog.vertical_id]) acc[prog.vertical_id] = [];
          acc[prog.vertical_id].push({
            id: prog.id,
            name: prog.name,
            code: prog.code,
            userCount: programUserCounts?.[prog.id] || 0
          });
        }
        return acc;
      }, {} as Record<string, ProgramWithUsers[]>);

      const verticalsWithCounts = verticalData?.map(vertical => ({
        ...vertical,
        userCount: usersByVertical?.[vertical.id]?.length || 0,
        programCount: programsByVertical?.[vertical.id]?.length || 0,
        programs: programsByVertical?.[vertical.id] || [],
        users: usersByVertical?.[vertical.id] || [],
      })) || [];

      setVerticals(verticalsWithCounts);
    } catch (error: any) {
      toast({
        title: "Error",
        description: getUserErrorMessage(error, "fetch verticals"),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      const validatedData = verticalSchema.parse(formData);

      if (!userOrgId) {
        toast({
          title: "Error",
          description: "Organization not found",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase
        .from("verticals")
        .insert({
          name: validatedData.name,
          code: validatedData.code.toUpperCase(),
          organization_id: userOrgId,
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: `${entityLabel("vertical")} created successfully`,
      });

      setCreateDialogOpen(false);
      setFormData({ name: "", code: "" });
      fetchVerticals();
    } catch (error: any) {
      if (error.errors) {
        toast({
          title: "Validation Error",
          description: error.errors[0]?.message || "Invalid input",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: getUserErrorMessage(error, `create ${entityLabel("vertical").toLowerCase()}`),
          variant: "destructive",
        });
      }
    }
  };

  const handleEdit = async () => {
    if (!selectedVertical) return;

    try {
      const validatedData = verticalSchema.parse(formData);

      const { error } = await supabase
        .from("verticals")
        .update({
          name: validatedData.name,
          code: validatedData.code.toUpperCase(),
        })
        .eq("id", selectedVertical.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: `${entityLabel("vertical")} updated successfully`,
      });

      setEditDialogOpen(false);
      setSelectedVertical(null);
      setFormData({ name: "", code: "" });
      fetchVerticals();
    } catch (error: any) {
      toast({
        title: "Error",
        description: getUserErrorMessage(error, `update ${entityLabel("vertical").toLowerCase()}`),
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!selectedVertical) return;

    try {
      const { error } = await supabase
        .from("verticals")
        .delete()
        .eq("id", selectedVertical.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: `${entityLabel("vertical")} deleted successfully`,
      });

      setDeleteDialogOpen(false);
      setSelectedVertical(null);
      fetchVerticals();
    } catch (error: any) {
      toast({
        title: "Error",
        description: getUserErrorMessage(error, `delete ${entityLabel("vertical").toLowerCase()}`),
        variant: "destructive",
      });
    }
  };

  const openEditDialog = (vertical: Vertical) => {
    setSelectedVertical(vertical);
    setFormData({ name: vertical.name, code: vertical.code });
    setEditDialogOpen(true);
  };

  const openDeleteDialog = (vertical: Vertical) => {
    setSelectedVertical(vertical);
    setDeleteDialogOpen(true);
  };

  const openUsersDialog = (vertical: Vertical) => {
    setSelectedVertical(vertical);
    setUsersDialogOpen(true);
  };

  if (loading || isLoading) {
    return (
      <Layout>
        <PageSkeleton type="cards" />
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <PageHeader
          title={`${entityLabel("vertical")} Management`}
          description={`Manage ${entityLabel("vertical", true).toLowerCase()} and view statistics`}
          icon={Layers}
          actions={
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add {entityLabel("vertical")}
            </Button>
          }
        />

        {verticals.length === 0 ? (
          <Card>
            <CardContent className="py-0">
              <EmptyState
                icon={Layers}
                title={`No ${entityLabel("vertical", true).toLowerCase()} yet`}
                description={`Create your first ${entityLabel("vertical").toLowerCase()} to get started`}
                action={{
                  label: `Add ${entityLabel("vertical")}`,
                  onClick: () => setCreateDialogOpen(true)
                }}
              />
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {verticals.map((vertical) => (
              <Card key={vertical.id} variant="interactive" className="cursor-pointer" onClick={() => openUsersDialog(vertical)}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle>{vertical.name}</CardTitle>
                      <CardDescription className="font-mono">{vertical.code}</CardDescription>
                    </div>
                    <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" onClick={() => openEditDialog(vertical)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openDeleteDialog(vertical)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Users className="h-4 w-4" />
                      <span>{vertical.userCount} {vertical.userCount === 1 ? 'user' : 'users'}</span>
                    </div>
                    
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <FolderKanban className="h-4 w-4" />
                      <span>{vertical.programCount} {vertical.programCount === 1 ? entityLabel("program").toLowerCase() : entityLabel("program", true).toLowerCase()}</span>
                    </div>
                    
                    {vertical.programs && vertical.programs.length > 0 && (
                      <div className="pt-3 border-t border-border/50 space-y-2">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{entityLabel("program", true)}</p>
                        {vertical.programs.map(prog => (
                          <div key={prog.id} className="flex justify-between items-center text-sm pl-2">
                            <span className="text-foreground/80">{prog.name}</span>
                            <span className="text-muted-foreground text-xs">{prog.userCount} {prog.userCount === 1 ? 'user' : 'users'}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Create Dialog */}
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create {entityLabel("vertical")}</DialogTitle>
              <DialogDescription>Add a new {entityLabel("vertical").toLowerCase()} to the system</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">{entityLabel("vertical")} Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., School of Business"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="code">{entityLabel("vertical")} Code</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  placeholder="e.g., SOB"
                  maxLength={10}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={!formData.name || !formData.code}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit {entityLabel("vertical")}</DialogTitle>
              <DialogDescription>Update {entityLabel("vertical").toLowerCase()} information</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-name">{entityLabel("vertical")} Name</Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-code">{entityLabel("vertical")} Code</Label>
                <Input
                  id="edit-code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  maxLength={10}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleEdit} disabled={!formData.name || !formData.code}>Save Changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {entityLabel("vertical")}?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete "{selectedVertical?.name}" and all its associated {entityLabel("program", true).toLowerCase()}, {entityLabel("batch", true).toLowerCase()}, {entityLabel("term", true).toLowerCase()}, and {entityLabel("subject", true).toLowerCase()}. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Users Dialog */}
        <Dialog open={usersDialogOpen} onOpenChange={setUsersDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Users in {selectedVertical?.name}</DialogTitle>
              <DialogDescription>
                {selectedVertical?.userCount || 0} {(selectedVertical?.userCount || 0) === 1 ? 'user' : 'users'} assigned to this {entityLabel("vertical").toLowerCase()}
              </DialogDescription>
            </DialogHeader>
            {selectedVertical?.users && selectedVertical.users.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedVertical.users.map((user) => (
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
            ) : (
              <p className="text-muted-foreground text-center py-4">No users assigned to this {entityLabel("vertical").toLowerCase()}</p>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
