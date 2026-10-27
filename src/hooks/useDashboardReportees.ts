import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/reportQueries";
import { resolveDashboardReportees, type DashboardReportee } from "@/lib/dashboardReportees";

export function useDashboardReportees(userId: string | undefined) {
  const [result, setResult] = useState<{ userId: string; reportees: DashboardReportee[] } | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!userId) return;
    const load = async () => {
      try {
        const mappings = await fetchAllRows<{ manager_id: string; user_id: string }>(
          supabase.from("reporting_hierarchy").select("manager_id, user_id").eq("manager_id", userId),
        );
        const ids = [...new Set(mappings.map(row => row.user_id))];
        const profiles: DashboardReportee[] = [];
        // Bounded, paginated batches: never one network request per reportee.
        for (let offset = 0; offset < ids.length; offset += 800) {
          const chunks = [];
          for (let index = offset; index < Math.min(offset + 800, ids.length); index += 200) {
            chunks.push(ids.slice(index, index + 200));
          }
          const rows = await Promise.all(chunks.map(chunk => fetchAllRows<DashboardReportee>(
            supabase.from("profiles").select("id, full_name, is_active").in("id", chunk),
          )));
          profiles.push(...rows.flat());
        }
        if (!cancelled) setResult({ userId, reportees: resolveDashboardReportees(mappings, profiles, userId) });
      } catch (error) {
        console.error("Unable to load dashboard reportees", error);
        if (!cancelled) setResult(null);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [userId]);

  return result?.userId === userId ? result.reportees : [];
}