import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

// Module-level cache — the maintenance flag is checked by ProtectedRoute on every
// navigation. Without a cache, each page change blocks rendering on a network call.
const CACHE_TTL_MS = 60_000;
let cachedValue: boolean | null = null;
let cachedAt = 0;
let inFlight: Promise<boolean> | null = null;

async function loadMaintenanceMode(force = false): Promise<boolean> {
  if (!force && cachedValue !== null && Date.now() - cachedAt < CACHE_TTL_MS) {
    return cachedValue;
  }
  if (!force && inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const { data, error } = await supabase
        .from("settings")
        .select("value")
        .eq("key", "maintenance_mode")
        .maybeSingle();

      if (error) {
        console.error("Error fetching maintenance mode:", error);
        return false;
      }
      return data?.value === "true";
    } catch (err) {
      console.error("Error fetching maintenance mode:", err);
      return false;
    } finally {
      inFlight = null;
    }
  })();

  const value = await inFlight;
  cachedValue = value;
  cachedAt = Date.now();
  return value;
}

export function useMaintenanceMode() {
  const isFresh = cachedValue !== null && Date.now() - cachedAt < CACHE_TTL_MS;
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(cachedValue ?? false);
  const [loading, setLoading] = useState(!isFresh);

  const fetchMaintenanceMode = async (force = true) => {
    const value = await loadMaintenanceMode(force);
    setIsMaintenanceMode(value);
    setLoading(false);
  };

  useEffect(() => {
    let cancelled = false;
    if (isFresh) {
      setIsMaintenanceMode(cachedValue as boolean);
      setLoading(false);
      return;
    }
    loadMaintenanceMode().then((value) => {
      if (cancelled) return;
      setIsMaintenanceMode(value);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { isMaintenanceMode, loading, refetch: fetchMaintenanceMode };
}
