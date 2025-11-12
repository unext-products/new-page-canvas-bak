import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Users } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { departmentSchema } from "@/lib/validation";
import { getUserErrorMessage } from "@/lib/errorHandler";

interface Department {
  id: string;
  name: string;
  code: string;
  created_at: string;
  userCount?: number;
}

export default function Departments() {
  const { userWithRole, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null);
  const [formData, setFormData] = useState({ name: "", code: "" });

  useEffect(() => {
    if (!loading && (!userWithRole || userWithRole.role !== "admin")) {
      navigate("/dashboard");
    }
  }, [userWithRole, loading, navigate]);

  useEffect(() => {
    if (userWithRole?.role === "admin") {
      fetchDepartments();
    }
  }, [userWithRole]);

  const fetchDepartments = async () => {
    try {
      setIsLoading(true);
      const { data: deptData, error: deptError } = await supabase
        .from("departments")
        .select("*")
        .order("name");

      if (deptError) throw deptError;

      // Fetch user counts for each department
      const { data: userCounts, error: countError } = await supabase
        .from("user_roles")
        .select("department_id");

      if (countError) throw countError;

      const countMap = userCounts?.reduce((acc, ur) => {
        if (ur.department_id) {
          acc[ur.department_id] = (acc[ur.department_id] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>);

      const departmentsWithCounts = deptData?.map(dept => ({
        ...dept,
        userCount: countMap?.[dept.id] || 0,
      })) || [];

      setDepartments(departmentsWithCounts);
    } catch (error: any) {
      toast({
        title: "Error",
        description: getUserErrorMessage(error, "fetch departments"),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      // Validate input
      const validatedData = departmentSchema.parse({
        name: formData.name,
        code: formData.code,
      });

      const { error } = await supabase
        .from("departments")
        .insert({
          name: validatedData.name,
          code: validatedData.code.toUpperCase(),
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Department created successfully",
      });

      setCreateDialogOpen(false);
      setFormData({ name: "", code: "" });
      fetchDepartments();
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
          description: getUserErrorMessage(error, "create department"),
          variant: "destructive",
        });
      }
    }
  };

  const handleEdit = async () => {
    if (!selectedDepartment) return;

    try {
      const { error } = await supabase
        .from("departments")
        .update({
          name: formData.name,
          code: formData.code.toUpperCase(),
        })
        .eq("id", selectedDepartment.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Department updated successfully",
      });

      setEditDialogOpen(false);
      setSelectedDepartment(null);
      setFormData({ name: "", code: "" });
      fetchDepartments();
    } catch (error: any) {
      toast({
        title: "Error",
        description: getUserErrorMessage(error, "update department"),
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!selectedDepartment) return;

    try {
      const { error } = await supabase
        .from("departments")
        .delete()
        .eq("id", selectedDepartment.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Department deleted successfully",
      });

      setDeleteDialogOpen(false);
      setSelectedDepartment(null);
      fetchDepartments();
    } catch (error: any) {
      toast({
        title: "Error",
        description: getUserErrorMessage(error, "delete department"),
        variant: "destructive",
      });
    }
  };

  const openEditDialog = (dept: Department) => {
    setSelectedDepartment(dept);
    setFormData({ name: dept.name, code: dept.code });
    setEditDialogOpen(true);
  };

  const openDeleteDialog = (dept: Department) => {
    setSelectedDepartment(dept);
    setDeleteDialogOpen(true);
  };

  if (loading || isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto py-8 px-4">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">Department Management</h1>
            <p className="text-muted-foreground">Manage departments and view statistics</p>
          </div>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Department
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Department</DialogTitle>
                <DialogDescription>Add a new department to the system</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Department Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Computer Science"
                  />
                </div>
                <div>
                  <Label htmlFor="code">Department Code</Label>
                  <Input
                    id="code"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    placeholder="CS"
                    maxLength={6}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreate} disabled={!formData.name || !formData.code}>
                  Create
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {departments.map((dept) => (
            <Card key={dept.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>{dept.name}</CardTitle>
                    <CardDescription className="text-lg font-mono">{dept.code}</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditDialog(dept)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openDeleteDialog(dept)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Users className="h-4 w-4" />
                  <span>{dept.userCount} {dept.userCount === 1 ? 'user' : 'users'}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Edit Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Department</DialogTitle>
              <DialogDescription>Update department information</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-name">Department Name</Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-code">Department Code</Label>
                <Input
                  id="edit-code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  maxLength={6}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleEdit} disabled={!formData.name || !formData.code}>
                Save Changes
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
                This will permanently delete the department "{selectedDepartment?.name}".
                {selectedDepartment && selectedDepartment.userCount > 0 && (
                  <span className="block mt-2 text-destructive font-semibold">
                    Warning: This department has {selectedDepartment.userCount} user(s) assigned to it.
                  </span>
                )}
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
