import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLabels } from "@/contexts/LabelContext";
import { useDepartmentSettings } from "@/hooks/useDepartmentSettings";
import { Loader2, Info, RotateCcw } from "lucide-react";
import MemberTargetsSettings from "./MemberTargetsSettings";

interface Department {
  id: string;
  name: string;
}

export default function TimesheetSettings() {
  const { userWithRole } = useAuth();
  const { entityLabel } = useLabels();
  const { toast } = useToast();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedScope, setSelectedScope] = useState<"organization" | string>("organization");
  const [saving, setSaving] = useState(false);

  const isOrgAdmin = userWithRole?.role === "org_admin";
  const isHod = userWithRole?.role === "manager";
  const canEdit = isOrgAdmin || isHod;

  // For HOD, lock to their department
  const effectiveDepartmentId = isHod ? userWithRole?.departmentId : (selectedScope !== "organization" ? selectedScope : null);
  
  const { settings, loading, updateDepartmentSetting, resetDepartmentSetting, refetch } = useDepartmentSettings(effectiveDepartmentId);

  // Local state for form
  const [localSettings, setLocalSettings] = useState({
    daily_target_minutes: 480,
    submission_window_days: 7,
    time_format: "12h" as "12h" | "24h",
  });

  useEffect(() => {
    if (isOrgAdmin) {
      fetchDepartments();
    }
  }, [isOrgAdmin]);

  useEffect(() => {
    setLocalSettings({
      daily_target_minutes: settings.daily_target_minutes,
      submission_window_days: settings.submission_window_days,
      time_format: settings.time_format,
    });
  }, [settings]);

  const fetchDepartments = async () => {
    const { data, error } = await supabase
      .from("departments")
      .select("id, name")
      .order("name");

    if (!error && data) {
      setDepartments(data);
    }
  };

  const updateOrgSetting = async (key: string, value: number | string) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("settings")
        .update({ value })
        .eq("key", key);

      if (error) throw error;

      toast({
        title: "Settings updated",
        description: "Organization-wide settings have been saved.",
      });
    } catch (error) {
      console.error("Error updating setting:", error);
      toast({
        title: "Error",
        description: "Failed to update settings. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDepartmentSetting = async (key: "daily_target_minutes" | "submission_window_days" | "time_format", value: number | string) => {
    if (!effectiveDepartmentId) {
      // Organization-wide setting
      await updateOrgSetting(key, value);
    } else {
      // Department-specific setting
      setSaving(true);
      const { error } = await updateDepartmentSetting(effectiveDepartmentId, key, value);
      setSaving(false);

      if (error) {
        toast({
          title: "Error",
          description: "Failed to update setting.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Settings updated",
          description: `${entityLabel("department")} settings have been saved.`,
        });
      }
    }
  };

  const handleResetToOrgDefault = async (key: "daily_target_minutes" | "submission_window_days" | "time_format") => {
    if (!effectiveDepartmentId) return;

    setSaving(true);
    const { error } = await resetDepartmentSetting(effectiveDepartmentId, key);
    setSaving(false);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to reset setting.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Reset successful",
        description: "Setting will now use organization default.",
      });
    }
  };

  const handleDailyTargetChange = (hours: number, minutes: number) => {
    const totalMinutes = hours * 60 + minutes;
    setLocalSettings({ ...localSettings, daily_target_minutes: totalMinutes });
  };

  const hours = Math.floor(localSettings.daily_target_minutes / 60);
  const minutes = localSettings.daily_target_minutes % 60;

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Info Card */}
      <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-700 dark:text-blue-300">
              <p className="font-medium mb-1">About Timesheet Settings</p>
              <p className="text-blue-600 dark:text-blue-400">
                {isOrgAdmin 
                  ? `Set organization-wide defaults or customize settings for specific ${entityLabel("department", true).toLowerCase()}. Department-specific settings override the organization defaults.`
                  : `Customize timesheet settings for your ${entityLabel("department").toLowerCase()}. These settings will override the organization defaults for members in your ${entityLabel("department").toLowerCase()}.`
                }
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Scope Selector - Only for Org Admin */}
      {isOrgAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>Scope</CardTitle>
            <CardDescription>
              Choose whether to edit organization-wide settings or department-specific ones
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={selectedScope} onValueChange={(v) => setSelectedScope(v)}>
              <SelectTrigger className="w-full max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="organization">Organization-wide (Default)</SelectItem>
                {departments.map((dept) => (
                  <SelectItem key={dept.id} value={dept.id}>
                    {entityLabel("department")}: {dept.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}

      {/* Daily Target */}
      <Card>
        <CardHeader>
          <CardTitle>Daily Target</CardTitle>
          <CardDescription>
            Set the expected working hours per day for timesheet tracking
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="space-y-2">
              <Label htmlFor="hours">Hours</Label>
              <Input
                id="hours"
                type="number"
                min="0"
                max="24"
                value={hours}
                onChange={(e) => handleDailyTargetChange(parseInt(e.target.value) || 0, minutes)}
                disabled={!canEdit}
                className="w-24"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="minutes">Minutes</Label>
              <Input
                id="minutes"
                type="number"
                min="0"
                max="59"
                value={minutes}
                onChange={(e) => handleDailyTargetChange(hours, parseInt(e.target.value) || 0)}
                disabled={!canEdit}
                className="w-24"
              />
            </div>
          </div>
          {effectiveDepartmentId && settings.isOverride.daily_target_minutes && (
            <p className="text-sm text-amber-600 dark:text-amber-400 flex items-center gap-2">
              <Info className="h-4 w-4" />
              Custom value for this {entityLabel("department").toLowerCase()}
            </p>
          )}
          {canEdit && (
            <div className="flex gap-2">
              <Button
                onClick={() => handleSaveDepartmentSetting("daily_target_minutes", localSettings.daily_target_minutes)}
                disabled={saving}
              >
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save
              </Button>
              {effectiveDepartmentId && settings.isOverride.daily_target_minutes && (
                <Button
                  variant="outline"
                  onClick={() => handleResetToOrgDefault("daily_target_minutes")}
                  disabled={saving}
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Reset to Default
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Submission Window */}
      <Card>
        <CardHeader>
          <CardTitle>Submission Window</CardTitle>
          <CardDescription>
            Number of days after which timesheet entries can no longer be edited
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="window">Days</Label>
            <Select
              value={localSettings.submission_window_days.toString()}
              onValueChange={(value) => {
                setLocalSettings({ ...localSettings, submission_window_days: parseInt(value) });
                if (canEdit) {
                  handleSaveDepartmentSetting("submission_window_days", parseInt(value));
                }
              }}
              disabled={!canEdit}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3">3 days</SelectItem>
                <SelectItem value="5">5 days</SelectItem>
                <SelectItem value="7">7 days</SelectItem>
                <SelectItem value="14">14 days</SelectItem>
                <SelectItem value="30">30 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {effectiveDepartmentId && settings.isOverride.submission_window_days && (
            <div className="flex items-center gap-2">
              <p className="text-sm text-amber-600 dark:text-amber-400 flex items-center gap-2">
                <Info className="h-4 w-4" />
                Custom value for this {entityLabel("department").toLowerCase()}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleResetToOrgDefault("submission_window_days")}
                disabled={saving}
              >
                <RotateCcw className="mr-2 h-3 w-3" />
                Reset
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Time Format */}
      <Card>
        <CardHeader>
          <CardTitle>Time Format</CardTitle>
          <CardDescription>
            Choose how times are displayed throughout the application
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="format">Format</Label>
            <Select
              value={localSettings.time_format}
              onValueChange={(value: "12h" | "24h") => {
                setLocalSettings({ ...localSettings, time_format: value });
                if (canEdit) {
                  handleSaveDepartmentSetting("time_format", value);
                }
              }}
              disabled={!canEdit}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="12h">12-hour (AM/PM)</SelectItem>
                <SelectItem value="24h">24-hour</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {effectiveDepartmentId && settings.isOverride.time_format && (
            <div className="flex items-center gap-2">
              <p className="text-sm text-amber-600 dark:text-amber-400 flex items-center gap-2">
                <Info className="h-4 w-4" />
                Custom value for this {entityLabel("department").toLowerCase()}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleResetToOrgDefault("time_format")}
                disabled={saving}
              >
                <RotateCcw className="mr-2 h-3 w-3" />
                Reset
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Member Targets Section */}
      {canEdit && <MemberTargetsSettings />}

      {!canEdit && (
        <p className="text-sm text-muted-foreground">
          Only organization administrators and {entityLabel("department").toLowerCase()} managers can modify these settings.
        </p>
      )}
    </div>
  );
}
