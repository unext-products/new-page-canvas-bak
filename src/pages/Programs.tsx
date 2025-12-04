import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { FolderKanban, Plus, Pencil, Trash2 } from "lucide-react";
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

interface Program {
  id: string;
  name: string;
  code: string;
  department_id: string;
  created_at: string;
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
  const navigate = useNavigate();
  const { toast } = useToast();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
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
      const [programsData, deptsData] = await Promise.all([
        supabase
          .from("programs")
          .select("*, departments(name, organizations(name))")
          .order("name"),
        supabase
          .from("departments")
          .select("id, name, code")
          .order("name"),
      ]);

      if (programsData.error) throw programsData.error;
      if (deptsData.error) throw deptsData.error;

      setPrograms(programsData.data);
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
          title="Programs"
          description="Manage programs within organizations"
          icon={FolderKanban}
          actions={
            <Button onClick={() => {
              setSelectedProgram(null);
              setFormData({ name: "", code: "", department_id: "" });
              setDialogOpen(true);
            }}>
              <Plus className="mr-2 h-4 w-4" />
              Add Program
            </Button>
          }
        />

        {programs.length === 0 ? (
          <Card>
            <CardContent className="py-0">
              <EmptyState
                icon={FolderKanban}
                title="No programs yet"
                description="Create your first program to get started"
                action={{
                  label: "Add Program",
                  onClick: () => setDialogOpen(true)
                }}
              />
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {programs.map((program) => (
              <Card key={program.id} variant="interactive">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <FolderKanban className="h-8 w-8 text-primary" />
                    <div className="flex gap-1">
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
                    Department: {program.departments?.name || "N/A"}
                  </CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        )}

        {/* Create/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{selectedProgram ? "Edit" : "Create"} Program</DialogTitle>
              <DialogDescription>
                {selectedProgram ? "Update the program details" : "Add a new program to an organization"}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="department">Department</Label>
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
                This will permanently delete the program "{selectedProgram?.name}". This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Layout>
  );
}
