import { useState, useEffect } from "react";

export interface UserSettings {
  user_id: string;
  daily_target_minutes: number | null;
}

export function useUserSettings(userId?: string | null) {
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userId) {
      // user_settings table doesn't exist - use default
      setUserSettings(null);
      setLoading(false);
    } else {
      setUserSettings(null);
      setLoading(false);
    }
  }, [userId]);

  const loadUserSettings = async () => {
    // No-op since user_settings table doesn't exist
    setUserSettings(null);
    setLoading(false);
  };

  const updateUserSetting = async (
    _targetUserId: string,
    _key: keyof Omit<UserSettings, "user_id">,
    _value: number | null
  ) => {
    // No-op since user_settings table doesn't exist
    console.warn("updateUserSetting called but user_settings table doesn't exist");
    return { error: new Error("user_settings table doesn't exist") };
  };

  const resetUserSetting = async (_targetUserId: string, _key: keyof Omit<UserSettings, "user_id">) => {
    return updateUserSetting(_targetUserId, _key, null);
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
export function useDepartmentUserSettings(_departmentId?: string | null) {
  const [userSettingsMap, setUserSettingsMap] = useState<Record<string, UserSettings>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // user_settings table doesn't exist - return empty map
    setUserSettingsMap({});
    setLoading(false);
  }, [_departmentId]);

  const loadDepartmentUserSettings = async () => {
    // No-op since user_settings table doesn't exist
    setUserSettingsMap({});
    setLoading(false);
  };

  return {
    userSettingsMap,
    loading,
    refetch: loadDepartmentUserSettings,
  };
}
