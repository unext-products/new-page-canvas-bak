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
import { cn } from "@/lib/utils";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
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
  const currentPath = location.pathname;

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
      className="bg-white/[0.03] dark:bg-black/[0.1] backdrop-blur-[60px] border border-white/[0.08] dark:border-white/[0.05] rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.12)]"
    >
      <SidebarHeader className="border-b border-white/[0.08] p-4">
        <NavLink to="/dashboard" className="flex items-center gap-2">
          <Clock className="h-6 w-6 text-primary" />
          <span className="text-lg font-semibold italic text-foreground">
            ClockWise
          </span>
        </NavLink>
      </SidebarHeader>

      <SidebarContent className="px-3 py-4">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {items.map((item) => (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.to}
                      end
                      className="flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-[15px]
                        hover:bg-white/[0.05] dark:hover:bg-white/[0.02]"
                      activeClassName="bg-white/[0.08] dark:bg-white/[0.05] text-foreground font-medium border-l-2 border-primary"
                    >
                      <item.icon className="h-5 w-5 flex-shrink-0" />
                      <span>{item.label}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-white/[0.08] p-4">
        <div className="text-sm text-muted-foreground mb-2 px-2 py-1.5 truncate">
          {userWithRole?.profile?.full_name}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSignOut}
          className="w-full justify-start gap-2 hover:bg-destructive/10 hover:text-destructive rounded-lg"
        >
          <LogOut className="h-5 w-5" />
          <span>Sign Out</span>
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
