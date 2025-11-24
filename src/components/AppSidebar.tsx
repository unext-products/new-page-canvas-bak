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
        "bg-white/[0.02] dark:bg-black/[0.08] backdrop-blur-[80px] backdrop-saturate-[180%]",
        "border border-white/[0.08] dark:border-white/[0.03]",
        "shadow-[0_8px_48px_-12px_rgba(0,0,0,0.15)] dark:shadow-[0_12px_60px_-15px_rgba(0,0,0,0.6)]",
        "rounded-3xl",
        "transition-all duration-500 ease-in-out",
        "data-[state=collapsed]:translate-y-[-100%] data-[state=collapsed]:opacity-0"
      )} 
    >
      <SidebarHeader className="border-b border-white/[0.06] dark:border-white/[0.03] p-6">
        <NavLink to="/dashboard" className="flex items-center gap-3">
          <Clock className="h-7 w-7 text-primary drop-shadow-[0_0_8px_rgba(59,130,246,0.4)] transition-transform hover:scale-110" />
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
                      className="flex items-center gap-3 px-4 py-3 rounded-2xl mx-2 transition-all duration-200
                        hover:bg-white/[0.08] dark:hover:bg-white/[0.04]
                        hover:scale-[1.01]"
                      activeClassName="bg-white/[0.12] dark:bg-white/[0.08]
                        font-medium text-primary"
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

      <SidebarFooter className="border-t border-white/[0.06] dark:border-white/[0.03] p-6">
        <div className="text-sm text-muted-foreground mb-3 px-3 py-2 truncate
          bg-white/[0.04] dark:bg-white/[0.02] rounded-xl
          border border-white/[0.06] dark:border-white/[0.03]">
          {userWithRole?.profile?.full_name}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSignOut}
          className="w-full justify-start gap-3 px-4 py-3 rounded-xl
            hover:bg-red-500/[0.08] dark:hover:bg-red-500/[0.12]
            hover:text-red-500
            transition-all duration-200"
        >
          <LogOut className="h-5 w-5" />
          <span>Sign Out</span>
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
