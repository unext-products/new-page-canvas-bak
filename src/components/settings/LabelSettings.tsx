import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLabels, OrganizationLabels } from "@/contexts/LabelContext";
import { Tag, RotateCcw, Save } from "lucide-react";

const defaultLabels: OrganizationLabels = {
  role_org_admin: "Organization Admin",
  role_program_manager: "Program Manager",
  role_manager: "Manager",
  role_member: "Member",
  entity_department: "Department",
  entity_department_plural: "Departments",
  entity_program: "Program",
  entity_program_plural: "Programs",
};

export default function LabelSettings() {
  const { userWithRole } = useAuth();
  const { labels, refetchLabels } = useLabels();
  const { toast } = useToast();
  const [formData, setFormData] = useState<OrganizationLabels>(labels);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setFormData(labels);
  }, [labels]);

  const isOrgAdmin = userWithRole?.role === "org_admin";

  const handleSave = async () => {
    if (!isOrgAdmin) return;

    try {
      setIsSaving(true);

      const { error } = await supabase
        .from("organization_labels")
        .update({
          role_org_admin: formData.role_org_admin,
          role_program_manager: formData.role_program_manager,
          role_manager: formData.role_manager,
          role_member: formData.role_member,
          entity_department: formData.entity_department,
          entity_department_plural: formData.entity_department_plural,
          entity_program: formData.entity_program,
          entity_program_plural: formData.entity_program_plural,
        })
        .not("organization_id", "is", null);

      if (error) throw error;

      await refetchLabels();

      toast({
        title: "Success",
        description: "Labels updated successfully. Changes will appear across the app.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update labels",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setFormData(defaultLabels);
  };

  if (!isOrgAdmin) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" />
            Custom Labels
          </CardTitle>
          <CardDescription>
            Only organization administrators can customize labels.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" />
            Role Labels
          </CardTitle>
          <CardDescription>
            Customize how roles are displayed throughout your organization
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="role_manager" className="text-muted-foreground text-sm">
                Manager (default: "Manager")
              </Label>
              <Input
                id="role_manager"
                value={formData.role_manager}
                onChange={(e) => setFormData({ ...formData, role_manager: e.target.value })}
                placeholder="e.g., HOD, Team Lead, Supervisor"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role_member" className="text-muted-foreground text-sm">
                Member (default: "Member")
              </Label>
              <Input
                id="role_member"
                value={formData.role_member}
                onChange={(e) => setFormData({ ...formData, role_member: e.target.value })}
                placeholder="e.g., Faculty, Employee, Staff"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role_program_manager" className="text-muted-foreground text-sm">
                Program Manager (default: "Program Manager")
              </Label>
              <Input
                id="role_program_manager"
                value={formData.role_program_manager}
                onChange={(e) => setFormData({ ...formData, role_program_manager: e.target.value })}
                placeholder="e.g., Course Director, Program Coordinator"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role_org_admin" className="text-muted-foreground text-sm">
                Organization Admin (default: "Organization Admin")
              </Label>
              <Input
                id="role_org_admin"
                value={formData.role_org_admin}
                onChange={(e) => setFormData({ ...formData, role_org_admin: e.target.value })}
                placeholder="e.g., Administrator, Principal"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" />
            Entity Labels
          </CardTitle>
          <CardDescription>
            Customize how organizational units are named (e.g., "Department" → "School")
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="entity_department" className="text-muted-foreground text-sm">
                Department (singular)
              </Label>
              <Input
                id="entity_department"
                value={formData.entity_department}
                onChange={(e) => setFormData({ ...formData, entity_department: e.target.value })}
                placeholder="e.g., School, Division, Unit"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="entity_department_plural" className="text-muted-foreground text-sm">
                Department (plural)
              </Label>
              <Input
                id="entity_department_plural"
                value={formData.entity_department_plural}
                onChange={(e) => setFormData({ ...formData, entity_department_plural: e.target.value })}
                placeholder="e.g., Schools, Divisions, Units"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="entity_program" className="text-muted-foreground text-sm">
                Program (singular)
              </Label>
              <Input
                id="entity_program"
                value={formData.entity_program}
                onChange={(e) => setFormData({ ...formData, entity_program: e.target.value })}
                placeholder="e.g., Course, Subject, Module"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="entity_program_plural" className="text-muted-foreground text-sm">
                Program (plural)
              </Label>
              <Input
                id="entity_program_plural"
                value={formData.entity_program_plural}
                onChange={(e) => setFormData({ ...formData, entity_program_plural: e.target.value })}
                placeholder="e.g., Courses, Subjects, Modules"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={handleReset}>
          <RotateCcw className="mr-2 h-4 w-4" />
          Reset to Defaults
        </Button>
        <Button onClick={handleSave} disabled={isSaving}>
          <Save className="mr-2 h-4 w-4" />
          {isSaving ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}
