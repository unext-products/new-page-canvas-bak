import { isRole } from "./roleMapping";

export function canExportReport(role: string | null | undefined, report: unknown, isLoading: boolean): boolean {
  return isRole(role, "admin", "super_admin", "l3", "l2") && report != null && !isLoading;
}