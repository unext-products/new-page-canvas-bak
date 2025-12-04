import { useAuth } from "@/contexts/AuthContext";
import { 
  Clock, 
  Users, 
  FileText, 
  Settings, 
  Upload, 
  LogOut,
  Building2,
  FolderKanban,
  Layers,
  BarChart3,
  ClipboardCheck,
  UsersRound
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/supabase";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarHeader,
} from "@/components/ui/sidebar";

export function AppSidebar() {
  const { userWithRole } = useAuth();
  const location = useLocation();
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
      navigate("/");
    }
  };

  const getNavItems = () => {
    const role = userWithRole?.role;
    const baseItems = [
      { to: "/dashboard", icon: Clock, label: "Dashboard" },
    ];

    if (role === "member") {
      baseItems.push(
        { to: "/timesheet", icon: FileText, label: "Timesheet" },
        { to: "/bulk-import", icon: Upload, label: "Bulk Upload" }
      );
    }

    if (role === "manager") {
      baseItems.push(
        { to: "/approvals", icon: ClipboardCheck, label: "Approvals" },
        { to: "/team", icon: UsersRound, label: "Team" }
      );
    }

    if (role === "org_admin") {
      baseItems.push(
        { to: "/organizations", icon: Building2, label: "Organizations" },
        { to: "/programs", icon: FolderKanban, label: "Programs" },
        { to: "/departments", icon: Layers, label: "Departments" },
        { to: "/users", icon: Users, label: "Users" },
        { to: "/reports", icon: BarChart3, label: "Reports" },
        { to: "/bulk-import", icon: Upload, label: "Bulk Import" },
        { to: "/settings", icon: Settings, label: "Settings" }
      );
    }

    if (role === "program_manager") {
      baseItems.push(
        { to: "/programs", icon: FolderKanban, label: "Programs" },
        { to: "/departments", icon: Layers, label: "Departments" },
        { to: "/reports", icon: BarChart3, label: "Reports" }
      );
    }

    return baseItems;
  };

  const items = getNavItems();

  return (
    <Sidebar 
      variant="floating"
      collapsible="offcanvas"
      className="glass-navbar border-border/40 rounded-2xl m-2"
    >
      <SidebarHeader className="p-3">
        <NavLink to="/dashboard" className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          <span className="text-base font-semibold text-foreground">
            ClockWise
          </span>
        </NavLink>
      </SidebarHeader>

      <SidebarContent className="px-2 py-2">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.to}
                      end
                      className="flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                      activeClassName="bg-muted text-foreground font-medium"
                    >
                      <item.icon className="h-4 w-4 flex-shrink-0" />
                      <span>{item.label}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3">
        <div className="text-xs text-muted-foreground mb-2 px-1 truncate">
          {userWithRole?.profile?.full_name}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSignOut}
          className="w-full justify-start gap-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive rounded-lg h-8 text-sm"
        >
          <LogOut className="h-4 w-4" />
          <span>Sign Out</span>
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
