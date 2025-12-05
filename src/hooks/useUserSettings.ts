import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface UserSettings {
  user_id: string;
  daily_target_minutes: number | null;
}

export function useUserSettings(userId?: string | null) {
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userId) {
      loadUserSettings();
    } else {
      setUserSettings(null);
      setLoading(false);
    }
  }, [userId]);

  const loadUserSettings = async () => {
    if (!userId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("user_settings")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (!error && data) {
        setUserSettings({
          user_id: data.user_id,
          daily_target_minutes: data.daily_target_minutes,
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
    value: number | null
  ) => {
    try {
      // Check if settings exist for this user
      const { data: existing } = await supabase
        .from("user_settings")
        .select("id")
        .eq("user_id", targetUserId)
        .maybeSingle();

      if (existing) {
        // Update existing
        const { error } = await supabase
          .from("user_settings")
          .update({ [key]: value })
          .eq("user_id", targetUserId);

        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from("user_settings")
          .insert({ user_id: targetUserId, [key]: value });

        if (error) throw error;
      }

      // Reload if this is the current user
      if (targetUserId === userId) {
        await loadUserSettings();
      }
      
      return { error: null };
    } catch (error) {
      console.error("Error updating user setting:", error);
      return { error };
    }
  };

  const resetUserSetting = async (targetUserId: string, key: keyof Omit<UserSettings, "user_id">) => {
    return updateUserSetting(targetUserId, key, null);
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
    if (!departmentId) return;
    
    setLoading(true);
    try {
      // Get all users in the department
      const { data: users, error: usersError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("department_id", departmentId)
        .eq("role", "faculty");

      if (usersError) throw usersError;

      if (users && users.length > 0) {
        const userIds = users.map(u => u.user_id);
        
        // Get settings for all these users
        const { data: settings, error: settingsError } = await supabase
          .from("user_settings")
          .select("*")
          .in("user_id", userIds);

        if (settingsError) throw settingsError;

        const map: Record<string, UserSettings> = {};
        settings?.forEach(s => {
          map[s.user_id] = {
            user_id: s.user_id,
            daily_target_minutes: s.daily_target_minutes,
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
