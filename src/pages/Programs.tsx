import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLabels } from "@/contexts/LabelContext";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { FolderKanban, Plus, Pencil, Trash2, Users, User } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toDisplayRole } from "@/lib/roleMapping";
import { z } from "zod";
import { DepartmentSelect } from "@/components/DepartmentSelect";
import { PageHeader } from "@/components/PageHeader";
import { PageSkeleton } from "@/components/PageSkeleton";
import { EmptyState } from "@/components/EmptyState";

const programSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  code: z.string().min(2, "Code must be at least 2 characters").regex(/^[A-Z0-9_]+$/, "Code must be uppercase letters, numbers, and underscores only"),
  department_id: z.string().uuid("Please select a department"),
});

interface ProgramUser {
  id: string;
  full_name: string;
  role: string;
}

interface Program {
  id: string;
  name: string;
  code: string;
  department_id: string;
  created_at: string;
  userCount?: number;
  users?: ProgramUser[];
  departments?: { 
    name: string;
    organizations?: { name: string };
  };
}

interface Department {
  id: string;
  name: string;
  code: string;
}

export default function Programs() {
  const { userWithRole } = useAuth();
  const { entityLabel } = useLabels();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [usersDialogOpen, setUsersDialogOpen] = useState(false);
  const [selectedProgram, setSelectedProgram] = useState<Program | null>(null);
  const [formData, setFormData] = useState({ name: "", code: "", department_id: "" });

  useEffect(() => {
    if (!userWithRole) return;
    if (!["org_admin", "program_manager"].includes(userWithRole.role || "")) {
      navigate("/dashboard");
      return;
    }
    fetchData();
  }, [userWithRole, navigate]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [programsData, deptsData, userProgramsData, userRolesData, profilesData] = await Promise.all([
        supabase
          .from("programs")
          .select("*, departments(name, organizations(name))")
          .order("name"),
        supabase
          .from("departments")
          .select("id, name, code")
          .order("name"),
        supabase
          .from("user_programs")
          .select("user_id, program_id"),
        supabase
          .from("user_roles")
          .select("user_id, role"),
        supabase
          .from("profiles")
          .select("id, full_name"),
      ]);

      if (programsData.error) throw programsData.error;
      if (deptsData.error) throw deptsData.error;
      if (userProgramsData.error) throw userProgramsData.error;
      if (userRolesData.error) throw userRolesData.error;
      if (profilesData.error) throw profilesData.error;

      // Create lookup maps
      const profileMap = new Map(profilesData.data?.map(p => [p.id, p.full_name]) || []);
      const roleMap = new Map(userRolesData.data?.map(r => [r.user_id, r.role]) || []);

      // Group users by program
      const usersByProgram = userProgramsData.data?.reduce((acc, up) => {
        if (up.program_id && up.user_id) {
          if (!acc[up.program_id]) acc[up.program_id] = [];
          const role = roleMap.get(up.user_id);
          if (role === 'hod' || role === 'faculty') {
            acc[up.program_id].push({
              id: up.user_id,
              full_name: profileMap.get(up.user_id) || 'Unknown',
              role: toDisplayRole(role) || role
            });
          }
        }
        return acc;
      }, {} as Record<string, ProgramUser[]>);

      // Enrich programs with user count and users
      const programsWithUsers = programsData.data?.map(program => ({
        ...program,
        userCount: usersByProgram?.[program.id]?.length || 0,
        users: usersByProgram?.[program.id] || [],
      })) || [];

      setPrograms(programsWithUsers);
      setDepartments(deptsData.data);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      const validated = programSchema.parse(formData);
      const { error } = await supabase
        .from("programs")
        .insert([{ name: validated.name, code: validated.code, department_id: validated.department_id }]);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Program created successfully",
      });
      setDialogOpen(false);
      setFormData({ name: "", code: "", department_id: "" });
      fetchData();
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
    if (!selectedProgram) return;

    try {
      const validated = programSchema.parse(formData);
      const { error } = await supabase
        .from("programs")
        .update(validated)
        .eq("id", selectedProgram.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Program updated successfully",
      });
      setDialogOpen(false);
      setSelectedProgram(null);
      setFormData({ name: "", code: "", department_id: "" });
      fetchData();
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

  const handleDelete = async () => {
    if (!selectedProgram) return;

    try {
      const { error } = await supabase
        .from("programs")
        .delete()
        .eq("id", selectedProgram.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Program deleted successfully",
      });
      setDeleteDialogOpen(false);
      setSelectedProgram(null);
      fetchData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const openEditDialog = (program: Program) => {
    setSelectedProgram(program);
    setFormData({ 
      name: program.name, 
      code: program.code,
      department_id: program.department_id 
    });
    setDialogOpen(true);
  };

  const openDeleteDialog = (program: Program) => {
    setSelectedProgram(program);
    setDeleteDialogOpen(true);
  };

  const openUsersDialog = (program: Program) => {
    setSelectedProgram(program);
    setUsersDialogOpen(true);
  };

  if (!userWithRole || loading) {
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
          title={entityLabel("program", true)}
          description={`Manage ${entityLabel("program", true).toLowerCase()} within organizations`}
          icon={FolderKanban}
          actions={
            <Button onClick={() => {
              setSelectedProgram(null);
              setFormData({ name: "", code: "", department_id: "" });
              setDialogOpen(true);
            }}>
              <Plus className="mr-2 h-4 w-4" />
              Add {entityLabel("program")}
            </Button>
          }
        />

        {programs.length === 0 ? (
          <Card>
            <CardContent className="py-0">
              <EmptyState
                icon={FolderKanban}
                title={`No ${entityLabel("program", true).toLowerCase()} yet`}
                description={`Create your first ${entityLabel("program").toLowerCase()} to get started`}
                action={{
                  label: `Add ${entityLabel("program")}`,
                  onClick: () => setDialogOpen(true)
                }}
              />
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {programs.map((program) => (
              <Card key={program.id} variant="interactive" className="cursor-pointer" onClick={() => openUsersDialog(program)}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <FolderKanban className="h-8 w-8 text-primary" />
                    <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" onClick={() => openEditDialog(program)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openDeleteDialog(program)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <CardTitle>{program.name}</CardTitle>
                  <CardDescription>
                    Code: {program.code}
                    <br />
                    {entityLabel("department")}: {program.departments?.name || "N/A"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span>{program.userCount} {program.userCount === 1 ? 'user' : 'users'}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Create/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{selectedProgram ? "Edit" : "Create"} {entityLabel("program")}</DialogTitle>
              <DialogDescription>
                {selectedProgram ? `Update the ${entityLabel("program").toLowerCase()} details` : `Add a new ${entityLabel("program").toLowerCase()} to an organization`}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="department">{entityLabel("department")}</Label>
                <DepartmentSelect
                  value={formData.department_id}
                  onValueChange={(value) => setFormData({ ...formData, department_id: value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Program name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="code">Code</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  placeholder="PROG_CODE"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={selectedProgram ? handleEdit : handleCreate}>
                {selectedProgram ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete the {entityLabel("program").toLowerCase()} "{selectedProgram?.name}". This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Users Dialog */}
        <Dialog open={usersDialogOpen} onOpenChange={setUsersDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Users in {selectedProgram?.name}</DialogTitle>
              <DialogDescription>
                {selectedProgram?.userCount || 0} {(selectedProgram?.userCount || 0) === 1 ? 'user' : 'users'} assigned to this {entityLabel("program").toLowerCase()}
              </DialogDescription>
            </DialogHeader>
            {selectedProgram?.users && selectedProgram.users.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedProgram.users.map((user) => (
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
              <p className="text-muted-foreground text-center py-4">No users assigned to this {entityLabel("program").toLowerCase()}</p>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
