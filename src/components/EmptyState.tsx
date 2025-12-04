import { ReactNode } from "react";
import { LucideIcon, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  children?: ReactNode;
}

export function EmptyState({ 
  icon: Icon = Inbox, 
  title, 
  description, 
  action,
  children 
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-8 sm:py-12 px-4 text-center">
      <div className="flex h-12 w-12 sm:h-16 sm:w-16 items-center justify-center rounded-full bg-muted mb-3 sm:mb-4">
        <Icon className="h-6 w-6 sm:h-8 sm:w-8 text-muted-foreground" />
      </div>
      <h3 className="text-base sm:text-lg font-medium">{title}</h3>
      {description && (
        <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-sm">{description}</p>
      )}
      {action && (
        <Button onClick={action.onClick} className="mt-4" size="sm">
          {action.label}
        </Button>
      )}
      {children}
    </div>
  );
}
