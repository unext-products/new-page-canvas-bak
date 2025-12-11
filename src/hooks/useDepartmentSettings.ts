import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface DepartmentSettings {
  daily_target_minutes: number | null;
  submission_window_days: number | null;
  time_format: "12h" | "24h" | null;
}

export interface EffectiveSettings {
  daily_target_minutes: number;
  submission_window_days: number;
  time_format: "12h" | "24h";
  isOverride: {
    daily_target_minutes: boolean;
    submission_window_days: boolean;
    time_format: boolean;
  };
}

const DEFAULT_SETTINGS: EffectiveSettings = {
  daily_target_minutes: 480,
  submission_window_days: 7,
  time_format: "12h",
  isOverride: {
    daily_target_minutes: false,
    submission_window_days: false,
    time_format: false,
  },
};

export function useDepartmentSettings(_departmentId?: string | null) {
  const [settings, setSettings] = useState<EffectiveSettings>(DEFAULT_SETTINGS);
  const [departmentSettings, setDepartmentSettings] = useState<DepartmentSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, [_departmentId]);

  const loadSettings = async () => {
    setLoading(true);
    try {
      // Fetch organization-level settings from the settings table
      const { data: orgSettings, error: orgError } = await supabase
        .from("settings")
        .select("key, value")
        .in("key", ["daily_target_minutes", "submission_window_days", "time_format"]);

      if (orgError) throw orgError;

      // Build org defaults
      const orgDefaults: Partial<EffectiveSettings> = {};
      orgSettings?.forEach((item) => {
        if (item.key === "daily_target_minutes" && item.value) {
          orgDefaults.daily_target_minutes = parseInt(item.value, 10);
        } else if (item.key === "submission_window_days" && item.value) {
          orgDefaults.submission_window_days = parseInt(item.value, 10);
        } else if (item.key === "time_format" && item.value) {
          orgDefaults.time_format = item.value as "12h" | "24h";
        }
      });

      // Note: department_settings table doesn't exist in the current schema
      // Using only organization-level settings
      const effective: EffectiveSettings = {
        daily_target_minutes: orgDefaults.daily_target_minutes ?? DEFAULT_SETTINGS.daily_target_minutes,
        submission_window_days: orgDefaults.submission_window_days ?? DEFAULT_SETTINGS.submission_window_days,
        time_format: orgDefaults.time_format ?? DEFAULT_SETTINGS.time_format,
        isOverride: {
          daily_target_minutes: false,
          submission_window_days: false,
          time_format: false,
        },
      };

      setSettings(effective);
      setDepartmentSettings(null);
    } catch (error) {
      console.error("Error loading settings:", error);
      setSettings(DEFAULT_SETTINGS);
    } finally {
      setLoading(false);
    }
  };

  const updateDepartmentSetting = async (
    _deptId: string,
    _key: keyof DepartmentSettings,
    _value: number | string | null
  ) => {
    // No-op since department_settings table doesn't exist
    console.warn("updateDepartmentSetting called but department_settings table doesn't exist");
    return { error: new Error("department_settings table doesn't exist") };
  };

  const resetDepartmentSetting = async (_deptId: string, _key: keyof DepartmentSettings) => {
    return updateDepartmentSetting(_deptId, _key, null);
  };

  return {
    settings,
    departmentSettings,
    loading,
    updateDepartmentSetting,
    resetDepartmentSetting,
    refetch: loadSettings,
  };
}
