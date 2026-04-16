import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLabels } from "@/contexts/LabelContext";
import { isRole } from "@/lib/roleMapping";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { FolderKanban, Plus, Pencil, Trash2, Users, User, Download } from "lucide-react";
import { format } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toDisplayRole } from "@/lib/roleMapping";
import { z } from "zod";
import { VerticalSelect } from "@/components/VerticalSelect";
import { PageHeader } from "@/components/PageHeader";
import { PageSkeleton } from "@/components/PageSkeleton";
import { EmptyState } from "@/components/EmptyState";

const programSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  code: z.string().min(2, "Code must be at least 2 characters").regex(/^[A-Z0-9_]+$/, "Code must be uppercase letters, numbers, and underscores only"),
  vertical_id: z.string().uuid("Please select a vertical"),
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
  vertical_id: string | null;
  department_id: string | null;
  created_at: string;
  userCount?: number;
  users?: ProgramUser[];
  verticals?: { 
    name: string;
    organizations?: { name: string };
  };
  departments?: { 
    name: string;
    organizations?: { name: string };
  };
}

interface Vertical {
  id: string;
  name: string;
  code: string;
}

/** @deprecated Use Vertical instead */
type Department = Vertical;

export default function Programs() {
  const { userWithRole } = useAuth();
  const { entityLabel } = useLabels();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [verticals, setVerticals] = useState<Vertical[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [usersDialogOpen, setUsersDialogOpen] = useState(false);
  const [selectedProgram, setSelectedProgram] = useState<Program | null>(null);
  const [formData, setFormData] = useState({ name: "", code: "", vertical_id: "" });
  const [filterVerticalId, setFilterVerticalId] = useState<string>("");

  // Filter programs based on selected vertical
  const filteredPrograms = filterVerticalId
    ? programs.filter(p => p.vertical_id === filterVerticalId)
    : programs;

  useEffect(() => {
    if (!userWithRole) return;
    if (!isRole(userWithRole.role, "admin", "org_admin", "super_admin", "l3", "l2")) {
      navigate("/dashboard");
      return;
    }
    fetchData();
  }, [userWithRole, navigate]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [programsData, vertsData, userProgramsData, userRolesData, profilesData] = await Promise.all([
        supabase
          .from("programs")
          .select("*, verticals(name, organizations(name)), departments(name, organizations(name))")
          .order("name"),
        supabase
          .from("verticals")
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
      if (vertsData.error) throw vertsData.error;
      if (userProgramsData.error) throw userProgramsData.error;
      if (userRolesData.error) throw userRolesData.error;
      if (profilesData.error) throw profilesData.error;

      // Create lookup maps
      const profileMap = new Map(profilesData.data?.map(p => [p.id, p.full_name]) || []);
      const roleMap = new Map(userRolesData.data?.map(r => [r.user_id, r.role]) || []);

      // Group users by program - include all role types
      const usersByProgram = userProgramsData.data?.reduce((acc, up) => {
        if (up.program_id && up.user_id) {
          if (!acc[up.program_id]) acc[up.program_id] = [];
          const role = roleMap.get(up.user_id);
          // Include all users assigned to the program, not just faculty/hod
          if (role && ['l1', 'l2', 'l3', 'hod', 'faculty', 'admin', 'org_admin', 'program_manager'].includes(role)) {
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
      setVerticals(vertsData.data);
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
        .insert([{ name: validated.name, code: validated.code, vertical_id: validated.vertical_id, department_id: null }]);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Program created successfully",
      });
      setDialogOpen(false);
      setFormData({ name: "", code: "", vertical_id: "" });
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
        .update({ name: validated.name, code: validated.code, vertical_id: validated.vertical_id, department_id: null })
        .eq("id", selectedProgram.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Program updated successfully",
      });
      setDialogOpen(false);
      setSelectedProgram(null);
      setFormData({ name: "", code: "", vertical_id: "" });
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
      vertical_id: program.vertical_id || program.department_id || "" 
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
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => {
                const headers = ["Name", "Code", "Vertical", "Users Count"];
                const rows = filteredPrograms.map(p => [p.name, p.code, p.verticals?.name || p.departments?.name || "N/A", p.userCount || 0]);
                const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
                const blob = new Blob([csv], { type: "text/csv" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `programs_${format(new Date(), "yyyy-MM-dd")}.csv`;
                a.click();
                URL.revokeObjectURL(url);
              }}>
                <Download className="mr-2 h-4 w-4" />
                Download
              </Button>
              <Button onClick={() => {
                setSelectedProgram(null);
                setFormData({ name: "", code: "", vertical_id: "" });
                setDialogOpen(true);
              }}>
                <Plus className="mr-2 h-4 w-4" />
                Add {entityLabel("program")}
              </Button>
            </div>
          }
        />

        {/* Filter Section */}
        <Card className="p-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Label className="whitespace-nowrap">{entityLabel("vertical")}:</Label>
              <VerticalSelect
                value={filterVerticalId}
                onValueChange={setFilterVerticalId}
                includeAll
              />
            </div>
          </div>
        </Card>

        {filteredPrograms.length === 0 ? (
          <Card>
            <CardContent className="py-0">
              <EmptyState
                icon={FolderKanban}
                title={`No ${entityLabel("program", true).toLowerCase()} ${filterVerticalId ? "in this " + entityLabel("vertical").toLowerCase() : "yet"}`}
                description={filterVerticalId ? `No ${entityLabel("program", true).toLowerCase()} found for the selected ${entityLabel("vertical").toLowerCase()}` : `Create your first ${entityLabel("program").toLowerCase()} to get started`}
                action={!filterVerticalId ? {
                  label: `Add ${entityLabel("program")}`,
                  onClick: () => setDialogOpen(true)
                } : undefined}
              />
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredPrograms.map((program) => (
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
                    {entityLabel("vertical")}: {program.verticals?.name || program.departments?.name || "N/A"}
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
                <Label htmlFor="vertical">{entityLabel("vertical")}</Label>
                <VerticalSelect
                  value={formData.vertical_id}
                  onValueChange={(value) => setFormData({ ...formData, vertical_id: value })}
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
