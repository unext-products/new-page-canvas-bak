import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useApprovalSettings, ApproverRole } from "@/hooks/useApprovalSettings";
import { useLabels } from "@/contexts/LabelContext";
import { ArrowRight, RotateCcw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface ApproverOption {
  value: ApproverRole;
  label: string;
}

interface RoleSettingRowProps {
  roleLabel: string;
  requiresApproval: boolean;
  approvedBy: ApproverRole[];
  onRequiresApprovalChange: (value: boolean) => void;
  onApprovedByChange: (value: ApproverRole[]) => void;
  approverOptions: ApproverOption[];
}

function RoleSettingRow({
  roleLabel,
  requiresApproval,
  approvedBy,
  onRequiresApprovalChange,
  onApprovedByChange,
  approverOptions,
}: RoleSettingRowProps) {
  const handleCheckboxChange = (optionValue: ApproverRole, checked: boolean) => {
    if (checked) {
      // Add the role to the array
      onApprovedByChange([...approvedBy, optionValue]);
    } else {
      // Remove the role, but ensure at least one remains
      const newValue = approvedBy.filter(v => v !== optionValue);
      if (newValue.length > 0) {
        onApprovedByChange(newValue);
      }
    }
  };

  return (
    <div className="p-4 rounded-lg border bg-card">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-medium">{roleLabel}</h4>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Requires approval</span>
          <Switch
            checked={requiresApproval}
            onCheckedChange={onRequiresApprovalChange}
          />
        </div>
      </div>
      
      {requiresApproval && (
        <div className="space-y-3">
          <span className="text-sm text-muted-foreground">Approved by:</span>
          <div className="flex flex-wrap gap-4">
            {approverOptions.map((option) => (
              <div key={option.value} className="flex items-center gap-2">
                <Checkbox
                  id={`${roleLabel}-${option.value}`}
                  checked={approvedBy.includes(option.value)}
                  onCheckedChange={(checked) => handleCheckboxChange(option.value, !!checked)}
                />
                <Label 
                  htmlFor={`${roleLabel}-${option.value}`}
                  className="text-sm cursor-pointer"
                >
                  {option.label}
                </Label>
              </div>
            ))}
          </div>
          {approvedBy.length === 0 && (
            <p className="text-sm text-destructive">At least one approver must be selected</p>
          )}
        </div>
      )}
    </div>
  );
}

interface ApprovalWorkflowSettingsProps {
  organizationId?: string;
}

export default function ApprovalWorkflowSettings({ organizationId }: ApprovalWorkflowSettingsProps) {
  const { settings, loading, updateSettings, resetToDefaults, getApprovalChain } = useApprovalSettings(organizationId);
  const { roleLabel } = useLabels();

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72 mt-2" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!settings) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Approval Workflow</CardTitle>
          <CardDescription>
            No approval settings found. Please contact support.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // All roles can now be approved by any higher role including Admin
  const l1ApproverOptions: ApproverOption[] = [
    { value: "l2", label: roleLabel("l2") },
    { value: "l3", label: roleLabel("l3") },
    { value: "org_admin", label: roleLabel("org_admin") },
  ];

  const l2ApproverOptions: ApproverOption[] = [
    { value: "l3", label: roleLabel("l3") },
    { value: "org_admin", label: roleLabel("org_admin") },
  ];

  const l3ApproverOptions: ApproverOption[] = [
    { value: "org_admin", label: roleLabel("org_admin") },
  ];

  const approvalChain = getApprovalChain();

  // Helper to format approvers for display
  const formatApprovers = (approvers: ApproverRole[]): string => {
    if (approvers.length === 0) return "Auto-approved";
    return approvers.map(role => roleLabel(role)).join(", ");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Approval Workflow</CardTitle>
        <CardDescription>
          Configure who approves timesheets for each role. Multiple approvers can be selected - any of them can approve.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Role Settings */}
        <div className="space-y-4">
          <RoleSettingRow
            roleLabel={roleLabel("l1")}
            requiresApproval={settings.l1_requires_approval}
            approvedBy={settings.l1_approved_by}
            onRequiresApprovalChange={(value) => 
              updateSettings({ 
                l1_requires_approval: value,
                l1_approved_by: value ? ["l2"] : [] 
              })
            }
            onApprovedByChange={(value) => updateSettings({ l1_approved_by: value })}
            approverOptions={l1ApproverOptions}
          />

          <RoleSettingRow
            roleLabel={roleLabel("l2")}
            requiresApproval={settings.l2_requires_approval}
            approvedBy={settings.l2_approved_by}
            onRequiresApprovalChange={(value) => 
              updateSettings({ 
                l2_requires_approval: value,
                l2_approved_by: value ? ["l3"] : [] 
              })
            }
            onApprovedByChange={(value) => updateSettings({ l2_approved_by: value })}
            approverOptions={l2ApproverOptions}
          />

          <RoleSettingRow
            roleLabel={roleLabel("l3")}
            requiresApproval={settings.l3_requires_approval}
            approvedBy={settings.l3_approved_by}
            onRequiresApprovalChange={(value) => 
              updateSettings({ 
                l3_requires_approval: value,
                l3_approved_by: value ? ["org_admin"] : [] 
              })
            }
            onApprovedByChange={(value) => updateSettings({ l3_approved_by: value })}
            approverOptions={l3ApproverOptions}
          />
        </div>

        <Separator />

        {/* Workflow Preview */}
        <div>
          <h4 className="text-sm font-medium mb-3">Workflow Preview</h4>
          <div className="space-y-2">
            {approvalChain.map((item, index) => (
              <div key={index} className="flex items-center gap-2 text-sm">
                <span className="font-medium">{item.role}</span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <span className={item.approvers.length === 0 ? "text-muted-foreground italic" : "text-primary"}>
                  {formatApprovers(item.approvers)}
                </span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Final</span>
              </div>
            ))}
          </div>
        </div>

        <Separator />

        {/* Actions */}
        <div className="flex justify-end">
          <Button variant="outline" onClick={resetToDefaults}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset to Default
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
