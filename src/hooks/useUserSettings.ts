import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface UserSettings {
  user_id: string;
  daily_target_minutes: number | null;
}

export function useUserSettings(userId?: string | null, departmentId?: string | null) {
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userId && departmentId) {
      loadUserSettings();
    } else {
      setUserSettings(null);
      setLoading(false);
    }
  }, [userId, departmentId]);

  const loadUserSettings = async () => {
    if (!userId || !departmentId) {
      setUserSettings(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("user_settings")
        .select("user_id, value")
        .eq("user_id", userId)
        .eq("department_id", departmentId)
        .eq("key", "daily_target_minutes")
        .maybeSingle();

      if (!error && data) {
        setUserSettings({
          user_id: data.user_id,
          daily_target_minutes: data.value ? parseInt(data.value) : null,
        });
      } else {
        setUserSettings(null);
      }
    } catch (error) {
      console.error("Error loading user settings:", error);
      setUserSettings(null);
    } finally {
      setLoading(false);
    }
  };

  const updateUserSetting = async (
    targetUserId: string,
    key: keyof Omit<UserSettings, "user_id">,
    value: number | null,
    deptId?: string
  ) => {
    const effectiveDeptId = deptId || departmentId;
    if (!effectiveDeptId) {
      return { error: new Error("Department ID is required") };
    }

    try {
      const { error } = await supabase
        .from("user_settings")
        .upsert(
          {
            user_id: targetUserId,
            department_id: effectiveDeptId,
            key,
            value: value?.toString() || null,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "user_id,department_id,key",
          }
        );

      if (error) throw error;
      return { error: null };
    } catch (error) {
      console.error("Error updating user setting:", error);
      return { error: error as Error };
    }
  };

  const resetUserSetting = async (
    targetUserId: string,
    key: keyof Omit<UserSettings, "user_id">,
    deptId?: string
  ) => {
    const effectiveDeptId = deptId || departmentId;
    if (!effectiveDeptId) {
      return { error: new Error("Department ID is required") };
    }

    try {
      const { error } = await supabase
        .from("user_settings")
        .delete()
        .eq("user_id", targetUserId)
        .eq("department_id", effectiveDeptId)
        .eq("key", key);

      if (error) throw error;
      return { error: null };
    } catch (error) {
      console.error("Error resetting user setting:", error);
      return { error: error as Error };
    }
  };

  return {
    userSettings,
    loading,
    updateUserSetting,
    resetUserSetting,
    refetch: loadUserSettings,
  };
}

// Hook to fetch multiple user settings for a department
export function useDepartmentUserSettings(departmentId?: string | null) {
  const [userSettingsMap, setUserSettingsMap] = useState<Record<string, UserSettings>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (departmentId) {
      loadDepartmentUserSettings();
    } else {
      setUserSettingsMap({});
      setLoading(false);
    }
  }, [departmentId]);

  const loadDepartmentUserSettings = async () => {
    if (!departmentId) {
      setUserSettingsMap({});
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("user_settings")
        .select("user_id, key, value")
        .eq("department_id", departmentId)
        .eq("key", "daily_target_minutes");

      if (!error && data) {
        const map: Record<string, UserSettings> = {};
        data.forEach((item) => {
          map[item.user_id] = {
            user_id: item.user_id,
            daily_target_minutes: item.value ? parseInt(item.value) : null,
          };
        });
        setUserSettingsMap(map);
      } else {
        setUserSettingsMap({});
      }
    } catch (error) {
      console.error("Error loading department user settings:", error);
      setUserSettingsMap({});
    } finally {
      setLoading(false);
    }
  };

  return {
    userSettingsMap,
    loading,
    refetch: loadDepartmentUserSettings,
  };
}
