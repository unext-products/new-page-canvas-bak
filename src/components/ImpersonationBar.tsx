import { useImpersonation } from "@/contexts/ImpersonationContext";
import { Button } from "@/components/ui/button";
import { X, Eye } from "lucide-react";
import { useLabels } from "@/contexts/LabelContext";

export function ImpersonationBar() {
  const { impersonatedUser, isImpersonating, stopImpersonation } = useImpersonation();
  const { roleLabel } = useLabels();

  if (!isImpersonating || !impersonatedUser) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-amber-500 dark:bg-amber-600 text-amber-950 px-4 py-2.5 flex items-center justify-between shadow-lg">
      <div className="flex items-center gap-2">
        <Eye className="h-4 w-4" />
        <span className="text-sm font-medium">
          Viewing as{" "}
          <strong>{impersonatedUser.fullName}</strong>
          {impersonatedUser.role && (
            <> ({roleLabel(impersonatedUser.role)})</>
          )}
          <span className="ml-2 opacity-75">— Read-only mode</span>
        </span>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={stopImpersonation}
        className="text-amber-950 hover:bg-amber-600 dark:hover:bg-amber-700 gap-1"
      >
        <X className="h-4 w-4" />
        End Impersonation
      </Button>
    </div>
  );
}
