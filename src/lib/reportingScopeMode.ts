import { isRole } from "./roleMapping";

export function usesExpandedReportingScope(role: string | null | undefined): boolean {
  return isRole(role, "l3");
}