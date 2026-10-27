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
  return (
    <time dateTime={approvedAt ?? undefined} className={cn("block text-xs font-normal text-muted-foreground leading-relaxed", className)}>
      Approved: {timestamp}
    </time>
  );
}