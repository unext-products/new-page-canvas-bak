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
import { Building2, Pencil } from "lucide-react";
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

export default function Organizations() {
  const { userWithRole } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [formData, setFormData] = useState({ name: "", code: "" });
  const [departmentCount, setDepartmentCount] = useState(0);
  const [programCount, setProgramCount] = useState(0);
  const [userCount, setUserCount] = useState(0);

  useEffect(() => {
    if (!userWithRole) return;
    if (userWithRole.role !== "org_admin") {
      navigate("/dashboard");
      return;
    }
    fetchOrganization();
  }, [userWithRole, navigate]);

  const fetchOrganization = async () => {
    try {
      setLoading(true);
      
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

      // Fetch department count
      const { count: deptCount } = await supabase
        .from("departments")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", roleData.organization_id);

      // Fetch program count (through departments)
      const { data: depts } = await supabase
        .from("departments")
        .select("id")
        .eq("organization_id", roleData.organization_id);
      
      const deptIds = depts?.map(d => d.id) || [];
      const { count: progCount } = await supabase
        .from("programs")
        .select("*", { count: "exact", head: true })
        .in("department_id", deptIds.length > 0 ? deptIds : ['00000000-0000-0000-0000-000000000000']);

      // Fetch user count
      const { count: usrCount } = await supabase
        .from("user_roles")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", roleData.organization_id);

      setOrganization(orgData);
      setDepartmentCount(deptCount || 0);
      setProgramCount(progCount || 0);
      setUserCount(usrCount || 0);
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

  if (!userWithRole || loading) {
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
              <div className="text-center p-4 bg-muted rounded-lg">
                <p className="text-2xl font-bold">{departmentCount}</p>
                <p className="text-sm text-muted-foreground">Departments</p>
              </div>
              <div className="text-center p-4 bg-muted rounded-lg">
                <p className="text-2xl font-bold">{programCount}</p>
                <p className="text-sm text-muted-foreground">Programs</p>
              </div>
              <div className="text-center p-4 bg-muted rounded-lg">
                <p className="text-2xl font-bold">{userCount}</p>
                <p className="text-sm text-muted-foreground">Users</p>
              </div>
            </div>
          </CardContent>
        </Card>

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
      </div>
    </Layout>
  );
}
