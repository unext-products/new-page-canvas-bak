import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Logo } from "@/components/Logo";
import { useMaintenanceMode } from "@/hooks/useMaintenanceMode";
import { isRole } from "@/lib/roleMapping";
import Maintenance from "@/pages/Maintenance";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading, userWithRole } = useAuth();
  const { isMaintenanceMode, loading: maintenanceLoading } = useMaintenanceMode();

  if (loading || maintenanceLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <Logo to="/" variant="dark" size="lg" />
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          Loading...
        </div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/" replace />;
  }

  if (isMaintenanceMode && !isRole(userWithRole?.role, "admin", "org_admin", "super_admin")) {
    return <Maintenance />;
  }

  return <>{children}</>;
}
