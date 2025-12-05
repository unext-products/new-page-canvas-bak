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
import { Plus, Pencil, Trash2, Users, Layers, FolderKanban } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { departmentSchema } from "@/lib/validation";
import { getUserErrorMessage } from "@/lib/errorHandler";
import { OrganizationSelect } from "@/components/OrganizationSelect";
import { PageHeader } from "@/components/PageHeader";
import { PageSkeleton } from "@/components/PageSkeleton";
import { EmptyState } from "@/components/EmptyState";

interface ProgramWithUsers {
  id: string;
  name: string;
  code: string;
  userCount: number;
}

interface Department {
  id: string;
  name: string;
  code: string;
  organization_id: string;
  created_at: string;
  userCount?: number;
  programCount?: number;
  programs?: ProgramWithUsers[];
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
  const [formData, setFormData] = useState({ name: "", code: "", organization_id: "" });
  const [userOrgId, setUserOrgId] = useState<string>("");

  useEffect(() => {
    if (!loading && (!userWithRole || !["org_admin", "program_manager"].includes(userWithRole.role || ""))) {
      navigate("/dashboard");
    }
  }, [userWithRole, loading, navigate]);

  useEffect(() => {
    if (userWithRole && ["org_admin", "program_manager"].includes(userWithRole.role || "")) {
      fetchUserOrganization();
      fetchDepartments();
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
        if (userWithRole?.role === "org_admin") {
          setFormData(prev => ({ ...prev, organization_id: data.organization_id }));
        }
      }
    } catch (error: any) {
      console.error("Error fetching user organization:", error);
    }
  };

  const fetchDepartments = async () => {
    try {
      setIsLoading(true);
      
      // Fetch departments
      const { data: deptData, error: deptError } = await supabase
        .from("departments")
        .select("*")
        .order("name");

      if (deptError) throw deptError;

      // Fetch programs
      const { data: programsData, error: programsError } = await supabase
        .from("programs")
        .select("id, name, code, department_id");

      if (programsError) throw programsError;

      // Fetch user roles to count users per department and per program
      const { data: userRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select("department_id, program_id");

      if (rolesError) throw rolesError;

      // Count users per department
      const deptUserCounts = userRoles?.reduce((acc, ur) => {
        if (ur.department_id) {
          acc[ur.department_id] = (acc[ur.department_id] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>);

      // Count users per program
      const programUserCounts = userRoles?.reduce((acc, ur) => {
        if (ur.program_id) {
          acc[ur.program_id] = (acc[ur.program_id] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>);

      // Group programs by department with user counts
      const programsByDept = programsData?.reduce((acc, prog) => {
        if (prog.department_id) {
          if (!acc[prog.department_id]) acc[prog.department_id] = [];
          acc[prog.department_id].push({
            id: prog.id,
            name: prog.name,
            code: prog.code,
            userCount: programUserCounts?.[prog.id] || 0
          });
        }
        return acc;
      }, {} as Record<string, ProgramWithUsers[]>);

      const departmentsWithCounts = deptData?.map(dept => ({
        ...dept,
        userCount: deptUserCounts?.[dept.id] || 0,
        programCount: programsByDept?.[dept.id]?.length || 0,
        programs: programsByDept?.[dept.id] || [],
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

      if (!formData.organization_id) {
        toast({
          title: "Validation Error",
          description: "Please select an organization",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase
        .from("departments")
        .insert({
          name: validatedData.name,
          code: validatedData.code.toUpperCase(),
          organization_id: formData.organization_id,
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Department created successfully",
      });

      setCreateDialogOpen(false);
      setFormData({ 
        name: "", 
        code: "", 
        organization_id: userWithRole?.role === "org_admin" ? userOrgId : "" 
      });
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
      setFormData({ 
        name: "", 
        code: "", 
        organization_id: userWithRole?.role === "org_admin" ? userOrgId : "" 
      });
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
    setFormData({ 
      name: dept.name, 
      code: dept.code,
      organization_id: dept.organization_id 
    });
    setEditDialogOpen(true);
  };

  const openDeleteDialog = (dept: Department) => {
    setSelectedDepartment(dept);
    setDeleteDialogOpen(true);
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
          title="Department Management"
          description="Manage departments and view statistics"
          icon={Layers}
          actions={
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Department
            </Button>
          }
        />

        {departments.length === 0 ? (
          <Card>
            <CardContent className="py-0">
              <EmptyState
                icon={Layers}
                title="No departments yet"
                description="Create your first department to get started"
                action={{
                  label: "Add Department",
                  onClick: () => setCreateDialogOpen(true)
                }}
              />
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {departments.map((dept) => (
              <Card key={dept.id} variant="interactive">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle>{dept.name}</CardTitle>
                      <CardDescription className="font-mono">{dept.code}</CardDescription>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEditDialog(dept)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openDeleteDialog(dept)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {/* Department users count */}
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Users className="h-4 w-4" />
                      <span>{dept.userCount} {dept.userCount === 1 ? 'user' : 'users'}</span>
                    </div>
                    
                    {/* Programs count */}
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <FolderKanban className="h-4 w-4" />
                      <span>{dept.programCount} {dept.programCount === 1 ? 'program' : 'programs'}</span>
                    </div>
                    
                    {/* Programs breakdown */}
                    {dept.programs && dept.programs.length > 0 && (
                      <div className="pt-3 border-t border-border/50 space-y-2">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Programs</p>
                        {dept.programs.map(prog => (
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
              <DialogTitle>Create Department</DialogTitle>
              <DialogDescription>Add a new department to the system</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Department Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Computer Science"
                />
              </div>
              <div className="space-y-2">
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
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={!formData.name || !formData.code}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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
                {selectedDepartment && (selectedDepartment.userCount || 0) > 0 && (
                  <span className="block mt-2 text-destructive font-semibold">
                    Warning: This department has {selectedDepartment.userCount} user(s) assigned to it.
                  </span>
                )}
                {selectedDepartment && (selectedDepartment.programCount || 0) > 0 && (
                  <span className="block mt-1 text-destructive font-semibold">
                    Warning: This department has {selectedDepartment.programCount} program(s).
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
