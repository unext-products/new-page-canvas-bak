import { Check, Cloud, CloudOff, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

interface SaveIndicatorProps {
  status: SaveStatus;
  className?: string;
}

export function SaveIndicator({ status, className }: SaveIndicatorProps) {
  if (status === "idle") return null;

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 text-xs transition-opacity duration-300",
        status === "error" ? "text-destructive" : "text-muted-foreground",
        className
      )}
    >
      {status === "saving" && (
        <>
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>Saving...</span>
        </>
      )}
      {status === "saved" && (
        <>
          <Cloud className="h-3 w-3" />
          <Check className="h-3 w-3 -ml-1" />
          <span>Saved</span>
        </>
      )}
      {status === "error" && (
        <>
          <CloudOff className="h-3 w-3" />
          <span>Save failed</span>
        </>
      )}
    </div>
  );
}
