import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ApprovalTimestamp } from "@/components/ApprovalTimestamp";

type Status = "draft" | "submitted" | "approved" | "rejected";

interface StatusBadgeProps {
  status: Status;
  className?: string;
  approvedAt?: string | null;
}

export function StatusBadge({ status, className, approvedAt }: StatusBadgeProps) {
  const variants = {
    draft: "bg-muted text-muted-foreground",
    submitted: "bg-warning text-warning-foreground",
    approved: "bg-success text-success-foreground",
    rejected: "bg-destructive text-destructive-foreground",
  };

  const labels = {
    draft: "Draft",
    submitted: "Pending",
    approved: "Approved",
    rejected: "Rejected",
  };

  return (
    <span className="inline-flex flex-col items-start gap-0.5">
      <Badge className={cn(variants[status], "font-medium", className)}>
        {labels[status]}
      </Badge>
      <ApprovalTimestamp status={status} approvedAt={approvedAt} />
    </span>
  );
}
