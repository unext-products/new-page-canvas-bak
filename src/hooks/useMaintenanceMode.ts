import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useMaintenanceMode() {
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchMaintenanceMode = async () => {
    try {
      const { data, error } = await supabase
        .from("settings")
        .select("value")
        .eq("key", "maintenance_mode")
        .maybeSingle();

      if (error) {
        console.error("Error fetching maintenance mode:", error);
        setIsMaintenanceMode(false);
      } else {
        setIsMaintenanceMode(data?.value === "true");
      }
    } catch (err) {
      console.error("Error fetching maintenance mode:", err);
      setIsMaintenanceMode(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMaintenanceMode();
  }, []);

  return { isMaintenanceMode, loading, refetch: fetchMaintenanceMode };
}
