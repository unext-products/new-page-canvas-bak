import { ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/supabase";
import { useNavigate, Link } from "react-router-dom";
import { LogOut, Clock, Users, FileText, Settings, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { userWithRole } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (error) {
      toast({
        title: "Error",
        description: "Failed to sign out",
        variant: "destructive",
      });
    } else {
      navigate("/auth");
    }
  };

  const getNavItems = () => {
    const role = userWithRole?.role;
    const baseItems = [
      { to: "/dashboard", icon: Clock, label: "Dashboard" },
    ];

    if (role === "faculty") {
      baseItems.push({ to: "/timesheet", icon: FileText, label: "Timesheet" });
    }

    if (role === "hod") {
      baseItems.push(
        { to: "/approvals", icon: FileText, label: "Approvals" },
        { to: "/team", icon: Users, label: "Team" }
      );
    }

    if (role === "admin") {
      baseItems.push(
        { to: "/users", icon: Users, label: "Users" },
        { to: "/departments", icon: Users, label: "Departments" },
        { to: "/reports", icon: FileText, label: "Reports" },
        { to: "/bulk-import", icon: Upload, label: "Bulk Import" },
        { to: "/settings", icon: Settings, label: "Settings" }
      );
    }

    return baseItems;
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-6">
            <Link to="/dashboard" className="flex items-center gap-2">
              <Clock className="h-6 w-6 text-primary" />
              <span className="text-lg font-semibold">TimeTrack</span>
            </Link>
            <nav className="hidden md:flex items-center gap-1">
              {getNavItems().map((item) => (
                <Link key={item.to} to={item.to}>
                  <Button variant="ghost" size="sm" className="gap-2">
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Button>
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:block text-sm text-muted-foreground">
              {userWithRole?.profile?.full_name}
            </div>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>
      <main className="container py-6">{children}</main>
    </div>
  );
}
