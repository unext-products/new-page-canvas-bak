import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLabels, OrganizationLabels } from "@/contexts/LabelContext";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tag, RotateCcw, Save, Info, Building, ChevronDown, Check, Minus } from "lucide-react";

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
  const [permissionsOpen, setPermissionsOpen] = useState(false);

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
      {/* Role Explanations */}
      <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-blue-700 dark:text-blue-400 text-base">
            <Info className="h-5 w-5" />
            Understanding Roles
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-3 text-sm text-blue-900 dark:text-blue-200">
            <div>
              <strong>Organization Admin</strong> — Full access to manage users, departments, programs, settings, and view all reports across the organization.
            </div>
            <div>
              <strong>Program Manager</strong> — Can view and manage programs within their assigned department, and view program-level reports.
            </div>
            <div>
              <strong>Manager</strong> — Approves or rejects timesheets for their department, manages department members, and views department reports.
            </div>
            <div>
              <strong>Member</strong> — Submits timesheets, views their own data, and can request leave.
            </div>
          </div>

          <Collapsible open={permissionsOpen} onOpenChange={setPermissionsOpen} className="mt-4">
            <CollapsibleTrigger className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors">
              <ChevronDown className={`h-4 w-4 transition-transform ${permissionsOpen ? "rotate-180" : ""}`} />
              View detailed permissions
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3">
              <div className="rounded-md border border-blue-200 dark:border-blue-800 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-blue-100/50 dark:bg-blue-900/30">
                      <TableHead className="text-blue-900 dark:text-blue-200">Permission</TableHead>
                      <TableHead className="text-center text-blue-900 dark:text-blue-200">Member</TableHead>
                      <TableHead className="text-center text-blue-900 dark:text-blue-200">Manager</TableHead>
                      <TableHead className="text-center text-blue-900 dark:text-blue-200">Program Mgr</TableHead>
                      <TableHead className="text-center text-blue-900 dark:text-blue-200">Org Admin</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="text-blue-800 dark:text-blue-300">
                    <TableRow>
                      <TableCell>Submit timesheets</TableCell>
                      <TableCell className="text-center"><Check className="h-4 w-4 mx-auto text-green-600" /></TableCell>
                      <TableCell className="text-center"><Check className="h-4 w-4 mx-auto text-green-600" /></TableCell>
                      <TableCell className="text-center"><Check className="h-4 w-4 mx-auto text-green-600" /></TableCell>
                      <TableCell className="text-center"><Check className="h-4 w-4 mx-auto text-green-600" /></TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Approve timesheets</TableCell>
                      <TableCell className="text-center"><Minus className="h-4 w-4 mx-auto text-muted-foreground" /></TableCell>
                      <TableCell className="text-center text-xs">Dept only</TableCell>
                      <TableCell className="text-center"><Minus className="h-4 w-4 mx-auto text-muted-foreground" /></TableCell>
                      <TableCell className="text-center"><Check className="h-4 w-4 mx-auto text-green-600" /></TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>View reports</TableCell>
                      <TableCell className="text-center text-xs">Own</TableCell>
                      <TableCell className="text-center text-xs">Dept</TableCell>
                      <TableCell className="text-center text-xs">Program</TableCell>
                      <TableCell className="text-center"><Check className="h-4 w-4 mx-auto text-green-600" /></TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Manage users</TableCell>
                      <TableCell className="text-center"><Minus className="h-4 w-4 mx-auto text-muted-foreground" /></TableCell>
                      <TableCell className="text-center text-xs">Dept only</TableCell>
                      <TableCell className="text-center"><Minus className="h-4 w-4 mx-auto text-muted-foreground" /></TableCell>
                      <TableCell className="text-center"><Check className="h-4 w-4 mx-auto text-green-600" /></TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Manage departments</TableCell>
                      <TableCell className="text-center"><Minus className="h-4 w-4 mx-auto text-muted-foreground" /></TableCell>
                      <TableCell className="text-center"><Minus className="h-4 w-4 mx-auto text-muted-foreground" /></TableCell>
                      <TableCell className="text-center"><Minus className="h-4 w-4 mx-auto text-muted-foreground" /></TableCell>
                      <TableCell className="text-center"><Check className="h-4 w-4 mx-auto text-green-600" /></TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Manage programs</TableCell>
                      <TableCell className="text-center"><Minus className="h-4 w-4 mx-auto text-muted-foreground" /></TableCell>
                      <TableCell className="text-center"><Minus className="h-4 w-4 mx-auto text-muted-foreground" /></TableCell>
                      <TableCell className="text-center text-xs">Assigned</TableCell>
                      <TableCell className="text-center"><Check className="h-4 w-4 mx-auto text-green-600" /></TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Manage settings</TableCell>
                      <TableCell className="text-center"><Minus className="h-4 w-4 mx-auto text-muted-foreground" /></TableCell>
                      <TableCell className="text-center"><Minus className="h-4 w-4 mx-auto text-muted-foreground" /></TableCell>
                      <TableCell className="text-center"><Minus className="h-4 w-4 mx-auto text-muted-foreground" /></TableCell>
                      <TableCell className="text-center"><Check className="h-4 w-4 mx-auto text-green-600" /></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>

      {/* Role Labels Form */}
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

      {/* Entity Hierarchy Explanation */}
      <Card className="border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/20">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-400 text-base">
            <Building className="h-5 w-5" />
            Organization Structure
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="text-sm space-y-3 text-green-900 dark:text-green-200">
            <p>Your organization follows this hierarchy:</p>
            <div className="font-mono bg-green-100/50 dark:bg-green-900/30 p-3 rounded-md text-xs border border-green-200 dark:border-green-800">
              <div>Organization</div>
              <div className="ml-4">└── Departments <span className="text-green-600 dark:text-green-400">(e.g., "Engineering", "Marketing")</span></div>
              <div className="ml-8">└── Programs <span className="text-green-600 dark:text-green-400">(e.g., "Project Alpha", "Course 101")</span></div>
              <div className="ml-12">└── Members assigned here</div>
            </div>
            <p className="text-green-700 dark:text-green-400">
              Rename these to match your organization's terminology (e.g., Department → School, Program → Course).
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Entity Labels Form */}
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
