import { format, isValid } from "date-fns";

/** Only actual approvals have an approval time; rejected rows also use approved_at. */
export function formatApprovalTimestamp(status: string, approvedAt?: string | null): string {
  if (status !== "approved" || !approvedAt) return "";
  const date = new Date(approvedAt);
  return isValid(date) ? format(date, "MMM d, yyyy HH:mm:ss") : "";
}