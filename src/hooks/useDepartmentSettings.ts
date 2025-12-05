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

export function useDepartmentSettings(departmentId?: string | null) {
  const [settings, setSettings] = useState<EffectiveSettings>(DEFAULT_SETTINGS);
  const [departmentSettings, setDepartmentSettings] = useState<DepartmentSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, [departmentId]);

  const loadSettings = async () => {
    setLoading(true);
    try {
      // Fetch organization-level settings
      const { data: orgSettings, error: orgError } = await supabase
        .from("settings")
        .select("key, value")
        .in("key", ["daily_target_minutes", "submission_window_days", "time_format"]);

      if (orgError) throw orgError;

      // Build org defaults
      const orgDefaults: Partial<EffectiveSettings> = {};
      orgSettings?.forEach((item) => {
        if (item.key === "daily_target_minutes") {
          orgDefaults.daily_target_minutes = item.value as number;
        } else if (item.key === "submission_window_days") {
          orgDefaults.submission_window_days = item.value as number;
        } else if (item.key === "time_format") {
          orgDefaults.time_format = item.value as "12h" | "24h";
        }
      });

      // Fetch department-specific settings if departmentId provided
      let deptSettings: DepartmentSettings | null = null;
      if (departmentId) {
        const { data: deptData, error: deptError } = await supabase
          .from("department_settings")
          .select("*")
          .eq("department_id", departmentId)
          .maybeSingle();

        if (!deptError && deptData) {
          deptSettings = {
            daily_target_minutes: deptData.daily_target_minutes,
            submission_window_days: deptData.submission_window_days,
            time_format: deptData.time_format as "12h" | "24h" | null,
          };
          setDepartmentSettings(deptSettings);
        }
      }

      // Merge: department overrides org defaults
      const effective: EffectiveSettings = {
        daily_target_minutes: deptSettings?.daily_target_minutes ?? orgDefaults.daily_target_minutes ?? DEFAULT_SETTINGS.daily_target_minutes,
        submission_window_days: deptSettings?.submission_window_days ?? orgDefaults.submission_window_days ?? DEFAULT_SETTINGS.submission_window_days,
        time_format: deptSettings?.time_format ?? orgDefaults.time_format ?? DEFAULT_SETTINGS.time_format,
        isOverride: {
          daily_target_minutes: deptSettings?.daily_target_minutes !== null && deptSettings?.daily_target_minutes !== undefined,
          submission_window_days: deptSettings?.submission_window_days !== null && deptSettings?.submission_window_days !== undefined,
          time_format: deptSettings?.time_format !== null && deptSettings?.time_format !== undefined,
        },
      };

      setSettings(effective);
    } catch (error) {
      console.error("Error loading settings:", error);
      setSettings(DEFAULT_SETTINGS);
    } finally {
      setLoading(false);
    }
  };

  const updateDepartmentSetting = async (
    deptId: string,
    key: keyof DepartmentSettings,
    value: number | string | null
  ) => {
    try {
      // Check if department settings exist
      const { data: existing } = await supabase
        .from("department_settings")
        .select("id")
        .eq("department_id", deptId)
        .maybeSingle();

      if (existing) {
        // Update existing
        const { error } = await supabase
          .from("department_settings")
          .update({ [key]: value })
          .eq("department_id", deptId);

        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from("department_settings")
          .insert({ department_id: deptId, [key]: value });

        if (error) throw error;
      }

      // Reload settings
      await loadSettings();
      return { error: null };
    } catch (error) {
      console.error("Error updating department setting:", error);
      return { error };
    }
  };

  const resetDepartmentSetting = async (deptId: string, key: keyof DepartmentSettings) => {
    return updateDepartmentSetting(deptId, key, null);
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
