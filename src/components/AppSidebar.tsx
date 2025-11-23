import { useAuth } from "@/contexts/AuthContext";
import { Clock, Users, FileText, Settings, Upload, LogOut } from "lucide-react";
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
  useSidebar,
} from "@/components/ui/sidebar";

export function AppSidebar() {
  const { userWithRole } = useAuth();
  const { state } = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const currentPath = location.pathname;
  const collapsed = state === "collapsed";

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
        { to: "/approvals", icon: FileText, label: "Approvals" },
        { to: "/team", icon: Users, label: "Team" }
      );
    }

    if (role === "org_admin") {
      baseItems.push(
        { to: "/organizations", icon: Users, label: "Organizations" },
        { to: "/programs", icon: Users, label: "Programs" },
        { to: "/departments", icon: Users, label: "Departments" },
        { to: "/users", icon: Users, label: "Users" },
        { to: "/reports", icon: FileText, label: "Reports" },
        { to: "/bulk-import", icon: Upload, label: "Bulk Import" },
        { to: "/settings", icon: Settings, label: "Settings" }
      );
    }

    if (role === "program_manager") {
      baseItems.push(
        { to: "/programs", icon: Users, label: "Programs" },
        { to: "/departments", icon: Users, label: "Departments" },
        { to: "/reports", icon: FileText, label: "Reports" }
      );
    }

    return baseItems;
  };

  const items = getNavItems();

  return (
    <Sidebar 
      className={cn(
        "w-72",
        "bg-background/20 backdrop-blur-3xl",
        "border border-white/20 dark:border-white/10",
        "shadow-[0_20px_60px_0_rgba(0,0,0,0.3)]",
        "rounded-2xl m-4",
        "glass-sidebar"
      )} 
      collapsible="offcanvas"
    >
      <SidebarHeader className="border-b border-white/10 p-6 bg-gradient-to-b from-white/5 to-transparent">
        <NavLink to="/dashboard" className="flex items-center gap-3">
          <Clock className="h-7 w-7 text-primary drop-shadow-[0_0_12px_rgba(59,130,246,0.6)]" />
          <span className="text-xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">ClockWise</span>
        </NavLink>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.to}
                      end
                      className="flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-300
                        hover:bg-white/15 hover:backdrop-blur-xl hover:shadow-lg
                        hover:border hover:border-white/30
                        relative overflow-hidden
                        before:absolute before:inset-0 before:bg-gradient-to-r 
                        before:from-transparent before:via-white/10 before:to-transparent
                        before:translate-x-[-100%] hover:before:translate-x-[100%]
                        before:transition-transform before:duration-700"
                      activeClassName="bg-primary/25 backdrop-blur-xl border border-primary/40
                        shadow-[0_0_25px_rgba(59,130,246,0.4)] font-semibold text-primary
                        scale-[1.02]"
                    >
                      <item.icon className="h-5 w-5 flex-shrink-0" />
                      <span className="text-base">{item.label}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-white/10 p-6 bg-gradient-to-t from-white/5 to-transparent">
        <div className="text-sm text-muted-foreground mb-3 px-3 truncate
          bg-white/10 rounded-xl py-2.5 backdrop-blur-sm border border-white/20
          shadow-[0_4px_12px_rgba(0,0,0,0.1)]">
          {userWithRole?.profile?.full_name}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSignOut}
          className="w-full justify-start gap-3 
            hover:bg-red-500/10 hover:text-red-500 hover:border hover:border-red-500/20
            hover:shadow-[0_0_20px_rgba(239,68,68,0.3)]
            transition-all duration-300 rounded-xl py-5"
        >
          <LogOut className="h-5 w-5" />
          <span>Sign Out</span>
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
