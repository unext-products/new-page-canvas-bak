import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface Thresholds {
  max_hours_enabled: boolean;
  max_hours_minutes: number;
  work_hours_enabled: boolean;
  work_start_time: string;
  work_end_time: string;
}

const defaultThresholds: Thresholds = {
  max_hours_enabled: false,
  max_hours_minutes: 480,
  work_hours_enabled: false,
  work_start_time: "08:30:00",
  work_end_time: "17:30:00",
};

export function useThresholds(verticalId?: string | null) {
  const { userWithRole } = useAuth();
  const [thresholds, setThresholds] = useState<Thresholds>(defaultThresholds);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userWithRole) {
      fetchThresholds();
    }
  }, [userWithRole, verticalId]);

  const fetchThresholds = async () => {
    if (!userWithRole?.user?.id) return;

    try {
      // Get organization ID
      const { data: userRole } = await supabase
        .from("user_roles")
        .select("organization_id")
        .eq("user_id", userWithRole.user.id)
        .single();

      if (!userRole?.organization_id) {
        setLoading(false);
        return;
      }

      // First try vertical-specific thresholds
      if (verticalId) {
        const { data: verticalThresholds } = await supabase
          .from("timesheet_thresholds")
          .select("*")
          .eq("organization_id", userRole.organization_id)
          .eq("vertical_id", verticalId)
          .single();

        if (verticalThresholds) {
          setThresholds({
            max_hours_enabled: verticalThresholds.max_hours_enabled,
            max_hours_minutes: verticalThresholds.max_hours_minutes || 480,
            work_hours_enabled: verticalThresholds.work_hours_enabled,
            work_start_time: verticalThresholds.work_start_time || "08:30:00",
            work_end_time: verticalThresholds.work_end_time || "17:30:00",
          });
          setLoading(false);
          return;
        }
      }

      // Fall back to org-wide thresholds
      const { data: orgThresholds } = await supabase
        .from("timesheet_thresholds")
        .select("*")
        .eq("organization_id", userRole.organization_id)
        .is("vertical_id", null)
        .single();

      if (orgThresholds) {
        setThresholds({
          max_hours_enabled: orgThresholds.max_hours_enabled,
          max_hours_minutes: orgThresholds.max_hours_minutes || 480,
          work_hours_enabled: orgThresholds.work_hours_enabled,
          work_start_time: orgThresholds.work_start_time || "08:30:00",
          work_end_time: orgThresholds.work_end_time || "17:30:00",
        });
      }
    } catch (error) {
      console.error("Error fetching thresholds:", error);
    } finally {
      setLoading(false);
    }
  };

  const validateEntry = async (
    date: string,
    startTime: string,
    endTime: string,
    existingEntries: { start_time: string; end_time: string }[],
    excludeEntryId?: string
  ): Promise<{ valid: boolean; error?: string }> => {
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
  };

  return { thresholds, loading, validateEntry };
}

function calculateDuration(startTime: string, endTime: string): number {
  const [startH, startM] = startTime.split(":").map(Number);
  const [endH, endM] = endTime.split(":").map(Number);
  return (endH * 60 + endM) - (startH * 60 + startM);
}