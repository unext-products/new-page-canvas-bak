import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format, getDay } from "date-fns";

interface Thresholds {
  max_hours_enabled: boolean;
  max_hours_minutes: number;
  work_hours_enabled: boolean;
  work_start_time: string;
  work_end_time: string;
}

interface Holiday {
  id: string;
  name: string;
  holiday_date: string;
}

interface WorkingDaysConfig {
  monday: boolean;
  tuesday: boolean;
  wednesday: boolean;
  thursday: boolean;
  friday: boolean;
  saturday: boolean;
  sunday: boolean;
}

const defaultThresholds: Thresholds = {
  max_hours_enabled: false,
  max_hours_minutes: 480,
  work_hours_enabled: false,
  work_start_time: "08:30:00",
  work_end_time: "17:30:00",
};

const defaultWorkingDays: WorkingDaysConfig = {
  monday: true,
  tuesday: true,
  wednesday: true,
  thursday: true,
  friday: true,
  saturday: false,
  sunday: false,
};

export function useThresholds(verticalId?: string | null) {
  const { userWithRole } = useAuth();
  const [thresholds, setThresholds] = useState<Thresholds>(defaultThresholds);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [workingDays, setWorkingDays] = useState<WorkingDaysConfig>(defaultWorkingDays);
  const [loading, setLoading] = useState(true);
  const [organizationId, setOrganizationId] = useState<string | null>(null);

  useEffect(() => {
    if (userWithRole) {
      fetchData();
    }
  }, [userWithRole, verticalId]);

  const fetchData = async () => {
    if (!userWithRole?.user?.id) return;

    try {
      // Get organization ID
      const { data: userRoles } = await supabase
        .from("user_roles")
        .select("organization_id")
        .eq("user_id", userWithRole.user.id)
        .limit(1);
      const userRole = userRoles?.[0] || null;

      if (!userRole?.organization_id) {
        setLoading(false);
        return;
      }

      setOrganizationId(userRole.organization_id);

      // Fetch thresholds, holidays, and working days in parallel
      await Promise.all([
        fetchThresholds(userRole.organization_id),
        fetchHolidays(userRole.organization_id),
        fetchWorkingDays(userRole.organization_id),
      ]);
    } catch (error) {
      console.error("Error fetching threshold data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchThresholds = async (orgId: string) => {
    // First try vertical-specific thresholds
    if (verticalId) {
      const { data: verticalThresholdsList } = await supabase
        .from("timesheet_thresholds")
        .select("*")
        .eq("organization_id", orgId)
        .eq("vertical_id", verticalId)
        .order("updated_at", { ascending: false })
        .limit(1);
      const verticalThresholds = verticalThresholdsList?.[0] || null;

      if (verticalThresholds) {
        setThresholds({
          max_hours_enabled: verticalThresholds.max_hours_enabled,
          max_hours_minutes: verticalThresholds.max_hours_minutes || 480,
          work_hours_enabled: verticalThresholds.work_hours_enabled,
          work_start_time: verticalThresholds.work_start_time || "08:30:00",
          work_end_time: verticalThresholds.work_end_time || "17:30:00",
        });
        return;
      }
    }

    // Fall back to org-wide thresholds
    const { data: orgThresholdsList } = await supabase
      .from("timesheet_thresholds")
      .select("*")
      .eq("organization_id", orgId)
      .is("vertical_id", null)
      .order("updated_at", { ascending: false })
      .limit(1);
    const orgThresholds = orgThresholdsList?.[0] || null;

    if (orgThresholds) {
      setThresholds({
        max_hours_enabled: orgThresholds.max_hours_enabled,
        max_hours_minutes: orgThresholds.max_hours_minutes || 480,
        work_hours_enabled: orgThresholds.work_hours_enabled,
        work_start_time: orgThresholds.work_start_time || "08:30:00",
        work_end_time: orgThresholds.work_end_time || "17:30:00",
      });
    }
  };

  const fetchHolidays = async (orgId: string) => {
    // Fetch org-wide holidays
    const { data: orgHolidays } = await supabase
      .from("holidays")
      .select("*")
      .eq("organization_id", orgId)
      .is("vertical_id", null);

    let allHolidays = orgHolidays || [];

    // Fetch vertical-specific holidays if verticalId is provided
    if (verticalId) {
      const { data: verticalHolidays } = await supabase
        .from("holidays")
        .select("*")
        .eq("organization_id", orgId)
        .eq("vertical_id", verticalId);

      if (verticalHolidays) {
        allHolidays = [...allHolidays, ...verticalHolidays];
      }
    }

    setHolidays(allHolidays);
  };

  const fetchWorkingDays = async (orgId: string) => {
    // First try vertical-specific working days
    if (verticalId) {
      const { data: verticalConfigList } = await supabase
        .from("working_days")
        .select("*")
        .eq("organization_id", orgId)
        .eq("vertical_id", verticalId)
        .order("updated_at", { ascending: false })
        .limit(1);
      const verticalConfig = verticalConfigList?.[0] || null;

      if (verticalConfig) {
        setWorkingDays({
          monday: verticalConfig.monday,
          tuesday: verticalConfig.tuesday,
          wednesday: verticalConfig.wednesday,
          thursday: verticalConfig.thursday,
          friday: verticalConfig.friday,
          saturday: verticalConfig.saturday,
          sunday: verticalConfig.sunday,
        });
        return;
      }
    }

    // Fall back to org-wide working days
    const { data: orgConfigList } = await supabase
      .from("working_days")
      .select("*")
      .eq("organization_id", orgId)
      .is("vertical_id", null)
      .order("updated_at", { ascending: false })
      .limit(1);
    const orgConfig = orgConfigList?.[0] || null;

    if (orgConfig) {
      setWorkingDays({
        monday: orgConfig.monday,
        tuesday: orgConfig.tuesday,
        wednesday: orgConfig.wednesday,
        thursday: orgConfig.thursday,
        friday: orgConfig.friday,
        saturday: orgConfig.saturday,
        sunday: orgConfig.sunday,
      });
    }
  };

  const isHoliday = useCallback((date: string | Date): Holiday | null => {
    const dateStr = typeof date === "string" ? date : format(date, "yyyy-MM-dd");
    return holidays.find(h => h.holiday_date === dateStr) || null;
  }, [holidays]);

  const isWorkingDay = useCallback((date: Date): boolean => {
    const dayIndex = getDay(date); // 0 = Sunday, 1 = Monday, etc.
    const dayMap: Record<number, keyof WorkingDaysConfig> = {
      0: "sunday",
      1: "monday",
      2: "tuesday",
      3: "wednesday",
      4: "thursday",
      5: "friday",
      6: "saturday",
    };
    return workingDays[dayMap[dayIndex]];
  }, [workingDays]);

  const validateEntry = useCallback(async (
    date: string,
    startTime: string,
    endTime: string,
    existingEntries: { start_time: string; end_time: string }[],
    excludeEntryId?: string
  ): Promise<{ valid: boolean; error?: string }> => {
    // Check if date is a holiday
    const holiday = isHoliday(date);
    if (holiday) {
      return {
        valid: false,
        error: `Cannot create entries on holidays (${holiday.name})`,
      };
    }

    // Check if date is a working day
    const entryDate = new Date(date);
    if (!isWorkingDay(entryDate)) {
      return {
        valid: false,
        error: "Cannot create entries on non-working days",
      };
    }

    // Check work hour window
    if (thresholds.work_hours_enabled) {
      const workStart = thresholds.work_start_time.slice(0, 5);
      const workEnd = thresholds.work_end_time.slice(0, 5);
      
      if (startTime < workStart || endTime > workEnd) {
        return {
          valid: false,
          error: `Timesheet entries must be within work hours (${workStart} - ${workEnd})`,
        };
      }
    }

    // Check max hours per day
    if (thresholds.max_hours_enabled) {
      const newDuration = calculateDuration(startTime, endTime);
      
      let existingMinutes = 0;
      for (const entry of existingEntries) {
        existingMinutes += calculateDuration(entry.start_time, entry.end_time);
      }

      const totalMinutes = existingMinutes + newDuration;
      
      if (totalMinutes > thresholds.max_hours_minutes) {
        const maxHours = Math.floor(thresholds.max_hours_minutes / 60);
        const maxMins = thresholds.max_hours_minutes % 60;
        return {
          valid: false,
          error: `Cannot exceed ${maxHours}h ${maxMins}m per day. Current total would be ${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m.`,
        };
      }
    }

    return { valid: true };
  }, [thresholds, isHoliday, isWorkingDay]);

  return { 
    thresholds, 
    holidays,
    workingDays,
    loading, 
    validateEntry,
    isHoliday,
    isWorkingDay,
  };
}

function calculateDuration(startTime: string, endTime: string): number {
  const [startH, startM] = startTime.split(":").map(Number);
  const [endH, endM] = endTime.split(":").map(Number);
  return (endH * 60 + endM) - (startH * 60 + startM);
}
