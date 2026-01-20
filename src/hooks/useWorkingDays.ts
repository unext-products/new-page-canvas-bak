import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getDay } from "date-fns";

export interface WorkingDaysConfig {
  monday: boolean;
  tuesday: boolean;
  wednesday: boolean;
  thursday: boolean;
  friday: boolean;
  saturday: boolean;
  sunday: boolean;
}

const defaultWorkingDays: WorkingDaysConfig = {
  monday: true,
  tuesday: true,
  wednesday: true,
  thursday: true,
  friday: true,
  saturday: false,
  sunday: false,
};

export function useWorkingDays(verticalId?: string | null) {
  const { userWithRole } = useAuth();
  const [workingDays, setWorkingDays] = useState<WorkingDaysConfig>(defaultWorkingDays);
  const [loading, setLoading] = useState(true);
  const [organizationId, setOrganizationId] = useState<string | null>(null);

  useEffect(() => {
    if (userWithRole) {
      fetchOrganizationId();
    }
  }, [userWithRole]);

  useEffect(() => {
    if (organizationId) {
      fetchWorkingDays();
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

  const fetchWorkingDays = async () => {
    if (!organizationId) {
      setLoading(false);
      return;
    }

    try {
      // First try vertical-specific working days
      if (verticalId) {
        const { data: verticalConfig } = await supabase
          .from("working_days")
          .select("*")
          .eq("organization_id", organizationId)
          .eq("vertical_id", verticalId)
          .single();

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
          setLoading(false);
          return;
        }
      }

      // Fall back to org-wide working days
      const { data: orgConfig } = await supabase
        .from("working_days")
        .select("*")
        .eq("organization_id", organizationId)
        .is("vertical_id", null)
        .single();

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
    } catch (error) {
      console.error("Error fetching working days:", error);
    } finally {
      setLoading(false);
    }
  };

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

  return { 
    workingDays, 
    loading, 
    isWorkingDay,
    refetch: fetchWorkingDays 
  };
}
