import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Status = "draft" | "submitted" | "approved" | "rejected";

interface StatusBadgeProps {
  status: Status;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
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
    <Badge className={cn(variants[status], "font-medium", className)}>
      {labels[status]}
    </Badge>
  );
}
