import { formatApprovalTimestamp } from "@/lib/approvalTimestamp";
import { cn } from "@/lib/utils";

interface ApprovalTimestampProps {
  status: string;
  approvedAt?: string | null;
  className?: string;
}

export function ApprovalTimestamp({ status, approvedAt, className }: ApprovalTimestampProps) {
  const timestamp = formatApprovalTimestamp(status, approvedAt);
  if (!timestamp) return null;
  const separator = timestamp.lastIndexOf(" ");
  const date = timestamp.slice(0, separator);
  const clock = timestamp.slice(separator + 1);
  return (
    <time dateTime={approvedAt ?? undefined} className={cn("block text-xs font-normal text-muted-foreground leading-relaxed", className)}>
      <span className="block">Approved: {date}</span>
      <span className="block whitespace-nowrap tabular-nums">{clock}</span>
    </time>
  );
}