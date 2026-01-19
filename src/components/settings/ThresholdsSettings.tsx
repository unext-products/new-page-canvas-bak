import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLabels } from "@/contexts/LabelContext";
import { Loader2, AlertTriangle, Clock } from "lucide-react";
import { isRole } from "@/lib/roleMapping";

interface Thresholds {
  id?: string;
  max_hours_enabled: boolean;
  max_hours_minutes: number;
  work_hours_enabled: boolean;
  work_start_time: string;
  work_end_time: string;
}

interface ThresholdsSettingsProps {
  selectedScope: "organization" | string;
  verticalId: string | null;
}

const defaultThresholds: Thresholds = {
  max_hours_enabled: false,
  max_hours_minutes: 480, // 8 hours
  work_hours_enabled: false,
  work_start_time: "08:30",
  work_end_time: "17:30",
};

export default function ThresholdsSettings({ selectedScope, verticalId }: ThresholdsSettingsProps) {
  const { userWithRole } = useAuth();
  const { entityLabel } = useLabels();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [thresholds, setThresholds] = useState<Thresholds>(defaultThresholds);
  const [organizationId, setOrganizationId] = useState<string | null>(null);

  const isOrgAdmin = isRole(userWithRole?.role, "admin", "org_admin", "super_admin");
  const canEdit = isOrgAdmin;

  const maxHoursHours = Math.floor(thresholds.max_hours_minutes / 60);
  const maxHoursMinutes = thresholds.max_hours_minutes % 60;

  useEffect(() => {
    fetchOrganizationId();
  }, [userWithRole]);

  useEffect(() => {
    if (organizationId) {
      fetchThresholds();
    }
  }, [organizationId, verticalId]);

  const fetchOrganizationId = async () => {
    if (!userWithRole?.user?.id) return;
    
    const { data } = await supabase
      .from("user_roles")
      .select("organization_id")
      .eq("user_id", userWithRole.user.id)
      .single();
    
    if (data?.organization_id) {
      setOrganizationId(data.organization_id);
    }
  };

  const fetchThresholds = async () => {
    if (!organizationId) return;
    
    setLoading(true);
    try {
      let query = supabase
        .from("timesheet_thresholds")
        .select("*")
        .eq("organization_id", organizationId);
      
      if (verticalId) {
        query = query.eq("vertical_id", verticalId);
      } else {
        query = query.is("vertical_id", null);
      }
      
      const { data, error } = await query;

      if (data && data.length > 0) {
        const t = data[0];
        setThresholds({
          id: t.id,
          max_hours_enabled: t.max_hours_enabled,
          max_hours_minutes: t.max_hours_minutes || 480,
          work_hours_enabled: t.work_hours_enabled,
          work_start_time: t.work_start_time?.slice(0, 5) || "08:30",
          work_end_time: t.work_end_time?.slice(0, 5) || "17:30",
        });
      } else {
        setThresholds(defaultThresholds);
      }
    } catch (error) {
      console.error("Error fetching thresholds:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!organizationId) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("timesheet_thresholds")
        .upsert({
          organization_id: organizationId,
          vertical_id: verticalId,
          max_hours_enabled: thresholds.max_hours_enabled,
          max_hours_minutes: thresholds.max_hours_minutes,
          work_hours_enabled: thresholds.work_hours_enabled,
          work_start_time: thresholds.work_start_time + ":00",
          work_end_time: thresholds.work_end_time + ":00",
          updated_at: new Date().toISOString(),
        }, {
          onConflict: "organization_id,vertical_id",
        });

      if (error) throw error;

      toast({
        title: "Thresholds saved",
        description: "Your threshold settings have been updated.",
      });
      fetchThresholds();
    } catch (error) {
      console.error("Error saving thresholds:", error);
      toast({
        title: "Error",
        description: "Failed to save thresholds. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleMaxHoursChange = (hours: number, minutes: number) => {
    const totalMinutes = Math.max(0, hours * 60 + minutes);
    setThresholds(prev => ({ ...prev, max_hours_minutes: totalMinutes }));
  };

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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          Thresholds
        </CardTitle>
        <CardDescription>
          Set limits on timesheet entries for {verticalId ? `this ${entityLabel("vertical").toLowerCase()}` : "the organization"}.
          These settings help ensure accurate time tracking.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Max Hours Per Day */}
        <div className="space-y-4 p-4 rounded-lg border bg-muted/30">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="text-base font-medium flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Maximum Hours Per Day
              </Label>
              <p className="text-sm text-muted-foreground">
                Limit the total hours a user can log in a single day.
              </p>
            </div>
            <Switch
              checked={thresholds.max_hours_enabled}
              onCheckedChange={(checked) => setThresholds(prev => ({ ...prev, max_hours_enabled: checked }))}
              disabled={!canEdit}
            />
          </div>
          
          {thresholds.max_hours_enabled && (
            <div className="flex items-center gap-2 pt-2">
              <Label className="text-sm text-muted-foreground">Limit:</Label>
              <Input
                type="number"
                min="0"
                max="24"
                value={maxHoursHours}
                onChange={(e) => handleMaxHoursChange(parseInt(e.target.value) || 0, maxHoursMinutes)}
                className="w-20"
                disabled={!canEdit}
              />
              <span className="text-sm">hours</span>
              <Input
                type="number"
                min="0"
                max="59"
                value={maxHoursMinutes}
                onChange={(e) => handleMaxHoursChange(maxHoursHours, parseInt(e.target.value) || 0)}
                className="w-20"
                disabled={!canEdit}
              />
              <span className="text-sm">minutes</span>
            </div>
          )}
        </div>

        {/* Work Hour Window */}
        <div className="space-y-4 p-4 rounded-lg border bg-muted/30">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="text-base font-medium flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Work Hour Window
              </Label>
              <p className="text-sm text-muted-foreground">
                Restrict timesheet entries to specific hours of the day.
              </p>
            </div>
            <Switch
              checked={thresholds.work_hours_enabled}
              onCheckedChange={(checked) => setThresholds(prev => ({ ...prev, work_hours_enabled: checked }))}
              disabled={!canEdit}
            />
          </div>
          
          {thresholds.work_hours_enabled && (
            <div className="flex items-center gap-2 pt-2">
              <Label className="text-sm text-muted-foreground">From:</Label>
              <Input
                type="time"
                value={thresholds.work_start_time}
                onChange={(e) => setThresholds(prev => ({ ...prev, work_start_time: e.target.value }))}
                className="w-32"
                disabled={!canEdit}
              />
              <Label className="text-sm text-muted-foreground">To:</Label>
              <Input
                type="time"
                value={thresholds.work_end_time}
                onChange={(e) => setThresholds(prev => ({ ...prev, work_end_time: e.target.value }))}
                className="w-32"
                disabled={!canEdit}
              />
            </div>
          )}
        </div>

        {/* Save Button */}
        {canEdit && (
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Thresholds
          </Button>
        )}

        {!canEdit && (
          <p className="text-sm text-muted-foreground pt-4 border-t">
            Only organization administrators can modify these settings.
          </p>
        )}
      </CardContent>
    </Card>
  );
}