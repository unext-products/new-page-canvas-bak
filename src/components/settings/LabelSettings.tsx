import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLabels, OrganizationLabels, RoleLabels } from "@/contexts/LabelContext";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tag, RotateCcw, Save, Info, Building, ChevronDown, Check, Minus } from "lucide-react";

const defaultEntityLabels: OrganizationLabels = {
  entity_department: "Department",
  entity_department_plural: "Departments",
  entity_program: "Program",
  entity_program_plural: "Programs",
  entity_vertical: "Vertical",
  entity_vertical_plural: "Verticals",
  entity_batch: "Batch",
  entity_batch_plural: "Batches",
  entity_term: "Term",
  entity_term_plural: "Terms",
  entity_subject: "Subject",
  entity_subject_plural: "Subjects",
};

const defaultRoleLabels: RoleLabels = {
  role_super_admin: "Super Admin",
  role_admin: "Admin",
  role_l3: "L3",
  role_l2: "L2",
  role_l1: "L1",
};

export default function LabelSettings() {
  const { userWithRole } = useAuth();
  const { labels, roleLabels, refetchLabels } = useLabels();
  const { toast } = useToast();
  const [entityFormData, setEntityFormData] = useState<OrganizationLabels>(labels);
  const [roleFormData, setRoleFormData] = useState<RoleLabels>(roleLabels);
  const [isSaving, setIsSaving] = useState(false);
  const [permissionsOpen, setPermissionsOpen] = useState(false);

  useEffect(() => {
    setEntityFormData(labels);
    setRoleFormData(roleLabels);
  }, [labels, roleLabels]);

  const isOrgAdmin = userWithRole?.role === "org_admin" || userWithRole?.role === "admin";

  const handleSave = async () => {
    if (!isOrgAdmin) return;

    try {
      setIsSaving(true);

      // Update entity labels
      const { error: entityError } = await supabase
        .from("organization_labels")
        .update({
          entity_department: entityFormData.entity_department,
          entity_department_plural: entityFormData.entity_department_plural,
          entity_program: entityFormData.entity_program,
          entity_program_plural: entityFormData.entity_program_plural,
          entity_vertical: entityFormData.entity_vertical,
          entity_vertical_plural: entityFormData.entity_vertical_plural,
          entity_batch: entityFormData.entity_batch,
          entity_batch_plural: entityFormData.entity_batch_plural,
          entity_term: entityFormData.entity_term,
          entity_term_plural: entityFormData.entity_term_plural,
          entity_subject: entityFormData.entity_subject,
          entity_subject_plural: entityFormData.entity_subject_plural,
        })
        .not("organization_id", "is", null);

      if (entityError) throw entityError;

      // Update role labels
      const { error: roleError } = await supabase
        .from("organization_role_labels")
        .update({
          role_l3: roleFormData.role_l3,
          role_l2: roleFormData.role_l2,
          role_l1: roleFormData.role_l1,
          // Admin and Super Admin labels are not customizable
        })
        .not("organization_id", "is", null);

      if (roleError) throw roleError;

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
    setEntityFormData(defaultEntityLabels);
    setRoleFormData(defaultRoleLabels);
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
              <strong>Super Admin</strong> — Full system access across all organizations. Can manage orgs and all users.
            </div>
            <div>
              <strong>Admin</strong> — Full access within their organization. Can manage users, verticals, programs, settings, and view all reports.
            </div>
            <div>
              <strong>L3</strong> — Senior manager role. Approves L2 and L1 timesheets within their verticals. Also submits own timesheets.
            </div>
            <div>
              <strong>L2</strong> — Manager role. Approves L1 timesheets within their assigned programs. Also submits own timesheets.
            </div>
            <div>
              <strong>L1</strong> — Team member role. Submits timesheets, views their own data, and can request leave.
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
                      <TableHead className="text-center text-blue-900 dark:text-blue-200">L1</TableHead>
                      <TableHead className="text-center text-blue-900 dark:text-blue-200">L2</TableHead>
                      <TableHead className="text-center text-blue-900 dark:text-blue-200">L3</TableHead>
                      <TableHead className="text-center text-blue-900 dark:text-blue-200">Admin</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="text-blue-800 dark:text-blue-300">
                    <TableRow>
                      <TableCell>Submit timesheets</TableCell>
                      <TableCell className="text-center"><Check className="h-4 w-4 mx-auto text-green-600" /></TableCell>
                      <TableCell className="text-center"><Check className="h-4 w-4 mx-auto text-green-600" /></TableCell>
                      <TableCell className="text-center"><Check className="h-4 w-4 mx-auto text-green-600" /></TableCell>
                      <TableCell className="text-center"><Minus className="h-4 w-4 mx-auto text-muted-foreground" /></TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Approve L1 timesheets</TableCell>
                      <TableCell className="text-center"><Minus className="h-4 w-4 mx-auto text-muted-foreground" /></TableCell>
                      <TableCell className="text-center text-xs">Program</TableCell>
                      <TableCell className="text-center text-xs">Vertical</TableCell>
                      <TableCell className="text-center"><Check className="h-4 w-4 mx-auto text-green-600" /></TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Approve L2 timesheets</TableCell>
                      <TableCell className="text-center"><Minus className="h-4 w-4 mx-auto text-muted-foreground" /></TableCell>
                      <TableCell className="text-center"><Minus className="h-4 w-4 mx-auto text-muted-foreground" /></TableCell>
                      <TableCell className="text-center text-xs">Vertical</TableCell>
                      <TableCell className="text-center"><Check className="h-4 w-4 mx-auto text-green-600" /></TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Approve L3 timesheets</TableCell>
                      <TableCell className="text-center"><Minus className="h-4 w-4 mx-auto text-muted-foreground" /></TableCell>
                      <TableCell className="text-center"><Minus className="h-4 w-4 mx-auto text-muted-foreground" /></TableCell>
                      <TableCell className="text-center"><Minus className="h-4 w-4 mx-auto text-muted-foreground" /></TableCell>
                      <TableCell className="text-center"><Check className="h-4 w-4 mx-auto text-green-600" /></TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>View reports</TableCell>
                      <TableCell className="text-center text-xs">Own</TableCell>
                      <TableCell className="text-center text-xs">Program</TableCell>
                      <TableCell className="text-center text-xs">Vertical</TableCell>
                      <TableCell className="text-center"><Check className="h-4 w-4 mx-auto text-green-600" /></TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Manage users</TableCell>
                      <TableCell className="text-center"><Minus className="h-4 w-4 mx-auto text-muted-foreground" /></TableCell>
                      <TableCell className="text-center"><Minus className="h-4 w-4 mx-auto text-muted-foreground" /></TableCell>
                      <TableCell className="text-center"><Minus className="h-4 w-4 mx-auto text-muted-foreground" /></TableCell>
                      <TableCell className="text-center"><Check className="h-4 w-4 mx-auto text-green-600" /></TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Manage verticals/programs</TableCell>
                      <TableCell className="text-center"><Minus className="h-4 w-4 mx-auto text-muted-foreground" /></TableCell>
                      <TableCell className="text-center"><Minus className="h-4 w-4 mx-auto text-muted-foreground" /></TableCell>
                      <TableCell className="text-center"><Minus className="h-4 w-4 mx-auto text-muted-foreground" /></TableCell>
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

      {/* Role Labels Form - Only L1, L2, L3 are customizable */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" />
            Role Labels
          </CardTitle>
          <CardDescription>
            Customize how L1, L2, and L3 roles are displayed throughout your organization
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="role_l3" className="text-muted-foreground text-sm">
                L3 (default: "L3")
              </Label>
              <Input
                id="role_l3"
                value={roleFormData.role_l3}
                onChange={(e) => setRoleFormData({ ...roleFormData, role_l3: e.target.value })}
                placeholder="e.g., HOD, Senior Manager"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role_l2" className="text-muted-foreground text-sm">
                L2 (default: "L2")
              </Label>
              <Input
                id="role_l2"
                value={roleFormData.role_l2}
                onChange={(e) => setRoleFormData({ ...roleFormData, role_l2: e.target.value })}
                placeholder="e.g., Program Manager, Team Lead"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role_l1" className="text-muted-foreground text-sm">
                L1 (default: "L1")
              </Label>
              <Input
                id="role_l1"
                value={roleFormData.role_l1}
                onChange={(e) => setRoleFormData({ ...roleFormData, role_l1: e.target.value })}
                placeholder="e.g., Faculty, Employee, Staff"
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
              <div className="ml-4">└── Verticals <span className="text-green-600 dark:text-green-400">(e.g., "Engineering", "Marketing")</span></div>
              <div className="ml-8">└── Programs <span className="text-green-600 dark:text-green-400">(e.g., "PGDRB", "PMIS")</span></div>
              <div className="ml-12">└── Batches <span className="text-green-600 dark:text-green-400">(e.g., "Batch 1", "Batch 2")</span></div>
              <div className="ml-16">└── Terms <span className="text-green-600 dark:text-green-400">(e.g., "Term 1", "Term 2")</span></div>
              <div className="ml-20">└── Subjects <span className="text-green-600 dark:text-green-400">(e.g., "Retail Banking (DBS 601)")</span></div>
            </div>
            <p className="text-green-700 dark:text-green-400">
              Rename these to match your organization's terminology.
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
            Customize how organizational units are named
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="entity_vertical" className="text-muted-foreground text-sm">
                Vertical (singular)
              </Label>
              <Input
                id="entity_vertical"
                value={entityFormData.entity_vertical}
                onChange={(e) => setEntityFormData({ ...entityFormData, entity_vertical: e.target.value })}
                placeholder="e.g., School, Division, Department"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="entity_vertical_plural" className="text-muted-foreground text-sm">
                Vertical (plural)
              </Label>
              <Input
                id="entity_vertical_plural"
                value={entityFormData.entity_vertical_plural}
                onChange={(e) => setEntityFormData({ ...entityFormData, entity_vertical_plural: e.target.value })}
                placeholder="e.g., Schools, Divisions, Departments"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="entity_program" className="text-muted-foreground text-sm">
                Program (singular)
              </Label>
              <Input
                id="entity_program"
                value={entityFormData.entity_program}
                onChange={(e) => setEntityFormData({ ...entityFormData, entity_program: e.target.value })}
                placeholder="e.g., Course, Track"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="entity_program_plural" className="text-muted-foreground text-sm">
                Program (plural)
              </Label>
              <Input
                id="entity_program_plural"
                value={entityFormData.entity_program_plural}
                onChange={(e) => setEntityFormData({ ...entityFormData, entity_program_plural: e.target.value })}
                placeholder="e.g., Courses, Tracks"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="entity_batch" className="text-muted-foreground text-sm">
                Batch (singular)
              </Label>
              <Input
                id="entity_batch"
                value={entityFormData.entity_batch}
                onChange={(e) => setEntityFormData({ ...entityFormData, entity_batch: e.target.value })}
                placeholder="e.g., Cohort, Group"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="entity_batch_plural" className="text-muted-foreground text-sm">
                Batch (plural)
              </Label>
              <Input
                id="entity_batch_plural"
                value={entityFormData.entity_batch_plural}
                onChange={(e) => setEntityFormData({ ...entityFormData, entity_batch_plural: e.target.value })}
                placeholder="e.g., Cohorts, Groups"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="entity_term" className="text-muted-foreground text-sm">
                Term (singular)
              </Label>
              <Input
                id="entity_term"
                value={entityFormData.entity_term}
                onChange={(e) => setEntityFormData({ ...entityFormData, entity_term: e.target.value })}
                placeholder="e.g., Semester, Quarter"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="entity_term_plural" className="text-muted-foreground text-sm">
                Term (plural)
              </Label>
              <Input
                id="entity_term_plural"
                value={entityFormData.entity_term_plural}
                onChange={(e) => setEntityFormData({ ...entityFormData, entity_term_plural: e.target.value })}
                placeholder="e.g., Semesters, Quarters"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="entity_subject" className="text-muted-foreground text-sm">
                Subject (singular)
              </Label>
              <Input
                id="entity_subject"
                value={entityFormData.entity_subject}
                onChange={(e) => setEntityFormData({ ...entityFormData, entity_subject: e.target.value })}
                placeholder="e.g., Course, Class, Module"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="entity_subject_plural" className="text-muted-foreground text-sm">
                Subject (plural)
              </Label>
              <Input
                id="entity_subject_plural"
                value={entityFormData.entity_subject_plural}
                onChange={(e) => setEntityFormData({ ...entityFormData, entity_subject_plural: e.target.value })}
                placeholder="e.g., Courses, Classes, Modules"
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
