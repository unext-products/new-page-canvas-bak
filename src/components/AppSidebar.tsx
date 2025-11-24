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
      variant="floating"
      collapsible="offcanvas"
      className={cn(
        "w-72",
        "bg-transparent backdrop-blur-[40px]",
        "border border-white/10 dark:border-white/5",
        "shadow-[0_8px_32px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_48px_rgba(0,0,0,0.4)]",
        "transition-all duration-500 ease-in-out",
        "data-[state=collapsed]:translate-y-[-100%] data-[state=collapsed]:opacity-0"
      )} 
    >
      <SidebarHeader className="border-b border-white/10 dark:border-white/5 p-6 bg-gradient-to-b from-white/3 to-transparent">
        <NavLink to="/dashboard" className="flex items-center gap-3">
          <Clock className="h-7 w-7 text-primary drop-shadow-[0_0_16px_rgba(59,130,246,0.7)] transition-transform hover:scale-110" />
          <span className="text-xl font-bold bg-gradient-to-r from-primary via-primary to-primary/60 bg-clip-text text-transparent">
            ClockWise
          </span>
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
                      className="flex items-center gap-3 px-4 py-3 rounded-xl mx-2 transition-all duration-300
                        hover:bg-white/10 dark:hover:bg-white/5
                        hover:backdrop-blur-xl hover:shadow-lg
                        hover:border hover:border-white/20 dark:hover:border-white/10
                        hover:scale-[1.02]
                        relative overflow-hidden group
                        before:absolute before:inset-0 before:bg-gradient-to-r 
                        before:from-transparent before:via-white/8 before:to-transparent
                        before:translate-x-[-100%] group-hover:before:translate-x-[100%]
                        before:transition-transform before:duration-1000"
                      activeClassName="bg-primary/15 dark:bg-primary/20 backdrop-blur-xl 
                        border border-primary/30 dark:border-primary/40
                        shadow-[0_0_30px_rgba(59,130,246,0.3)] dark:shadow-[0_0_40px_rgba(59,130,246,0.5)]
                        font-semibold text-primary scale-[1.02]"
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

      <SidebarFooter className="border-t border-white/10 dark:border-white/5 p-6 bg-gradient-to-t from-white/3 to-transparent">
        <div className="text-sm text-muted-foreground mb-3 px-3 py-2 truncate
          bg-white/5 dark:bg-white/3 rounded-xl backdrop-blur-sm 
          border border-white/10 dark:border-white/5
          shadow-inner">
          {userWithRole?.profile?.full_name}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSignOut}
          className="w-full justify-start gap-3 px-4 py-3 rounded-xl
            hover:bg-red-500/10 dark:hover:bg-red-500/15
            hover:text-red-500 hover:border hover:border-red-500/30
            hover:shadow-[0_0_24px_rgba(239,68,68,0.25)]
            hover:scale-[1.02]
            transition-all duration-300"
        >
          <LogOut className="h-5 w-5" />
          <span>Sign Out</span>
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
