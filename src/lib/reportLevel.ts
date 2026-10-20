import { normalizeRole } from "./roleMapping";

export function getReportLevel(role?: string | null): string {
  const normalized = normalizeRole(role ?? null);
  return normalized === "l1" || normalized === "l2" || normalized === "l3"
    ? normalized.toUpperCase()
    : "—";
}