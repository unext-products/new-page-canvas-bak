import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

interface TimesheetSettingsData {
  daily_target_minutes: number;
  submission_window_days: number;
  time_format: "12h" | "24h";
}

export default function TimesheetSettings() {
  const { userWithRole } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<TimesheetSettingsData>({
    daily_target_minutes: 480,
    submission_window_days: 7,
    time_format: "12h",
  });

  const isOrgAdmin = userWithRole?.role === "org_admin";

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("settings")
        .select("key, value")
        .in("key", ["daily_target_minutes", "submission_window_days", "time_format"]);

      if (error) throw error;

      const newSettings = { ...settings };
      data?.forEach((item) => {
        if (item.key === "daily_target_minutes") {
          newSettings.daily_target_minutes = item.value as number;
        } else if (item.key === "submission_window_days") {
          newSettings.submission_window_days = item.value as number;
        } else if (item.key === "time_format") {
          newSettings.time_format = item.value as "12h" | "24h";
        }
      });
      setSettings(newSettings);
    } catch (error) {
      console.error("Error fetching settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = async (key: string, value: number | string) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("settings")
        .update({ value })
        .eq("key", key);

      if (error) throw error;

      toast({
        title: "Settings updated",
        description: "Your changes have been saved.",
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

  const handleDailyTargetChange = (hours: number, minutes: number) => {
    const totalMinutes = hours * 60 + minutes;
    setSettings({ ...settings, daily_target_minutes: totalMinutes });
  };

  const hours = Math.floor(settings.daily_target_minutes / 60);
  const minutes = settings.daily_target_minutes % 60;

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
                disabled={!isOrgAdmin}
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
                disabled={!isOrgAdmin}
                className="w-24"
              />
            </div>
          </div>
          {isOrgAdmin && (
            <Button
              onClick={() => updateSetting("daily_target_minutes", settings.daily_target_minutes)}
              disabled={saving}
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          )}
        </CardContent>
      </Card>

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
              value={settings.submission_window_days.toString()}
              onValueChange={(value) => {
                setSettings({ ...settings, submission_window_days: parseInt(value) });
                if (isOrgAdmin) {
                  updateSetting("submission_window_days", parseInt(value));
                }
              }}
              disabled={!isOrgAdmin}
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
        </CardContent>
      </Card>

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
              value={settings.time_format}
              onValueChange={(value: "12h" | "24h") => {
                setSettings({ ...settings, time_format: value });
                if (isOrgAdmin) {
                  updateSetting("time_format", value);
                }
              }}
              disabled={!isOrgAdmin}
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
        </CardContent>
      </Card>

      {!isOrgAdmin && (
        <p className="text-sm text-muted-foreground">
          Only organization administrators can modify these settings.
        </p>
      )}
    </div>
  );
}
