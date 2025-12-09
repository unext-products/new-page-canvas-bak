import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useApprovalSettings, ApproverType } from "@/hooks/useApprovalSettings";
import { useLabels } from "@/contexts/LabelContext";
import { ArrowRight, RotateCcw, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface RoleSettingRowProps {
  roleLabel: string;
  requiresApproval: boolean;
  approvedBy: ApproverType;
  onRequiresApprovalChange: (value: boolean) => void;
  onApprovedByChange: (value: ApproverType) => void;
  approverOptions: { value: ApproverType; label: string }[];
}

function RoleSettingRow({
  roleLabel,
  requiresApproval,
  approvedBy,
  onRequiresApprovalChange,
  onApprovedByChange,
  approverOptions,
}: RoleSettingRowProps) {
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
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Approved by:</span>
          <Select
            value={approvedBy || "auto"}
            onValueChange={(value) => onApprovedByChange(value === "auto" ? null : value as ApproverType)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select approver" />
            </SelectTrigger>
            <SelectContent>
              {approverOptions.map((option) => (
                <SelectItem key={option.value || "auto"} value={option.value || "auto"}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}

export default function ApprovalWorkflowSettings() {
  const { settings, loading, updateSettings, resetToDefaults, getApprovalChain } = useApprovalSettings();
  const { labels } = useLabels();

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

  const memberApproverOptions: { value: ApproverType; label: string }[] = [
    { value: "manager", label: labels.role_manager },
    { value: "org_admin", label: labels.role_org_admin },
  ];

  const programManagerApproverOptions: { value: ApproverType; label: string }[] = [
    { value: "manager", label: labels.role_manager },
    { value: "org_admin", label: labels.role_org_admin },
  ];

  const managerApproverOptions: { value: ApproverType; label: string }[] = [
    { value: "org_admin", label: labels.role_org_admin },
  ];

  const approvalChain = getApprovalChain();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Approval Workflow</CardTitle>
        <CardDescription>
          Configure who approves timesheets for each role. Changes apply to your entire organization.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Role Settings */}
        <div className="space-y-4">
          <RoleSettingRow
            roleLabel={labels.role_member}
            requiresApproval={settings.member_requires_approval}
            approvedBy={settings.member_approved_by}
            onRequiresApprovalChange={(value) => 
              updateSettings({ 
                member_requires_approval: value,
                member_approved_by: value ? "manager" : null 
              })
            }
            onApprovedByChange={(value) => updateSettings({ member_approved_by: value })}
            approverOptions={memberApproverOptions}
          />

          <RoleSettingRow
            roleLabel={labels.role_program_manager}
            requiresApproval={settings.program_manager_requires_approval}
            approvedBy={settings.program_manager_approved_by}
            onRequiresApprovalChange={(value) => 
              updateSettings({ 
                program_manager_requires_approval: value,
                program_manager_approved_by: value ? "manager" : null 
              })
            }
            onApprovedByChange={(value) => updateSettings({ program_manager_approved_by: value })}
            approverOptions={programManagerApproverOptions}
          />

          <RoleSettingRow
            roleLabel={labels.role_manager}
            requiresApproval={settings.manager_requires_approval}
            approvedBy={settings.manager_approved_by}
            onRequiresApprovalChange={(value) => 
              updateSettings({ 
                manager_requires_approval: value,
                manager_approved_by: value ? "org_admin" : null 
              })
            }
            onApprovedByChange={(value) => updateSettings({ manager_approved_by: value })}
            approverOptions={managerApproverOptions}
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
                <span className={item.approver === "Auto-approved" ? "text-muted-foreground italic" : "text-primary"}>
                  {item.approver}
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
