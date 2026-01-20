import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";

export interface Holiday {
  id: string;
  name: string;
  holiday_date: string;
  vertical_id: string | null;
}

export function useHolidays(verticalId?: string | null) {
  const { userWithRole } = useAuth();
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [organizationId, setOrganizationId] = useState<string | null>(null);

  useEffect(() => {
    if (userWithRole) {
      fetchOrganizationId();
    }
  }, [userWithRole]);

  useEffect(() => {
    if (organizationId) {
      fetchHolidays();
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

  const fetchHolidays = async () => {
    if (!organizationId) {
      setLoading(false);
      return;
    }

    try {
      // Fetch org-wide holidays (vertical_id is null)
      const { data: orgHolidays } = await supabase
        .from("holidays")
        .select("*")
        .eq("organization_id", organizationId)
        .is("vertical_id", null);

      let allHolidays = orgHolidays || [];

      // Fetch vertical-specific holidays if verticalId is provided
      if (verticalId) {
        const { data: verticalHolidays } = await supabase
          .from("holidays")
          .select("*")
          .eq("organization_id", organizationId)
          .eq("vertical_id", verticalId);

        if (verticalHolidays) {
          allHolidays = [...allHolidays, ...verticalHolidays];
        }
      }

      // Deduplicate by date (vertical-specific takes precedence if same date)
      const dateMap = new Map<string, Holiday>();
      for (const holiday of allHolidays) {
        const existing = dateMap.get(holiday.holiday_date);
        // If no existing or new one is vertical-specific, use new one
        if (!existing || (holiday.vertical_id && !existing.vertical_id)) {
          dateMap.set(holiday.holiday_date, holiday);
        }
      }

      setHolidays(Array.from(dateMap.values()));
    } catch (error) {
      console.error("Error fetching holidays:", error);
    } finally {
      setLoading(false);
    }
  };

  const isHoliday = useCallback((date: string | Date): Holiday | null => {
    const dateStr = typeof date === "string" ? date : format(date, "yyyy-MM-dd");
    return holidays.find(h => h.holiday_date === dateStr) || null;
  }, [holidays]);

  const getHolidayName = useCallback((date: string | Date): string | null => {
    const holiday = isHoliday(date);
    return holiday?.name || null;
  }, [isHoliday]);

  return { 
    holidays, 
    loading, 
    isHoliday, 
    getHolidayName,
    refetch: fetchHolidays 
  };
}
