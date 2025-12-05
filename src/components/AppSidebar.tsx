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
  UsersRound,
  User
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useNavigate, useLocation } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { signOut } from "@/lib/supabase";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useEffect } from "react";

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
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";

const roleLabels: Record<string, string> = {
  member: "Member",
  manager: "Manager",
  org_admin: "Admin",
  program_manager: "Program Manager",
};

const roleColors: Record<string, string> = {
  member: "bg-muted text-muted-foreground",
  manager: "bg-primary/10 text-primary",
  org_admin: "bg-success/10 text-success",
  program_manager: "bg-warning/10 text-warning",
};

export function AppSidebar() {
  const { userWithRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { isMobile, setOpenMobile } = useSidebar();

  // Close mobile sidebar on route change
  useEffect(() => {
    if (isMobile) {
      setOpenMobile(false);
    }
  }, [location.pathname, isMobile, setOpenMobile]);

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
    const items: { to: string; icon: typeof Clock; label: string; group?: string }[] = [
      { to: "/dashboard", icon: Clock, label: "Dashboard", group: "Overview" },
    ];

    if (role === "member") {
      items.push(
        { to: "/timesheet", icon: FileText, label: "Timesheet", group: "Work" },
        { to: "/bulk-import", icon: Upload, label: "Bulk Upload", group: "Work" }
      );
    }

    if (role === "manager") {
      items.push(
        { to: "/approvals", icon: ClipboardCheck, label: "Approvals", group: "Management" },
        { to: "/team", icon: UsersRound, label: "Team", group: "Management" }
      );
    }

    if (role === "org_admin") {
      items.push(
        { to: "/organizations", icon: Building2, label: "Organization", group: "Administration" },
        { to: "/departments", icon: Layers, label: "Departments", group: "Administration" },
        { to: "/programs", icon: FolderKanban, label: "Programs", group: "Administration" },
        { to: "/users", icon: Users, label: "Users", group: "Administration" },
        { to: "/reports", icon: BarChart3, label: "Reports", group: "Analytics" },
        { to: "/bulk-import", icon: Upload, label: "Bulk Import", group: "Tools" },
        { to: "/settings", icon: Settings, label: "Settings", group: "Tools" }
      );
    }

    if (role === "program_manager") {
      items.push(
        { to: "/programs", icon: FolderKanban, label: "Programs", group: "Management" },
        { to: "/departments", icon: Layers, label: "Departments", group: "Management" },
        { to: "/reports", icon: BarChart3, label: "Reports", group: "Analytics" }
      );
    }

    return items;
  };

  const items = getNavItems();
  const groupedItems = items.reduce((acc, item) => {
    const group = item.group || "General";
    if (!acc[group]) acc[group] = [];
    acc[group].push(item);
    return acc;
  }, {} as Record<string, typeof items>);

  const userName = userWithRole?.profile?.full_name || "User";
  const userInitials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  const userRole = userWithRole?.role || "member";

  return (
    <Sidebar 
      variant="floating"
      collapsible="offcanvas"
      className="glass-navbar border-border/40 rounded-2xl m-2"
    >
      <SidebarHeader className="p-4">
        <NavLink to="/dashboard" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Clock className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="text-lg font-semibold text-foreground">
            ClockWise
          </span>
        </NavLink>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent className="px-2 py-3">
        {Object.entries(groupedItems).map(([group, groupItems]) => (
          <SidebarGroup key={group}>
            <SidebarGroupLabel className="text-xs font-medium text-muted-foreground/70 px-3 mb-1">
              {group}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {groupItems.map((item) => (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.to}
                        end
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                        activeClassName="bg-primary/10 text-primary font-medium"
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
        ))}
      </SidebarContent>

      <SidebarSeparator />

      <SidebarFooter className="p-3">
        <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/30">
          <Avatar className="h-9 w-9">
            <AvatarImage src={userWithRole?.profile?.avatar_url || undefined} />
            <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
              {userInitials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{userName}</p>
            <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 h-4 ${roleColors[userRole]}`}>
              {roleLabels[userRole] || userRole}
            </Badge>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2 w-full px-3 py-2 mt-2 text-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive rounded-lg transition-colors"
        >
          <LogOut className="h-4 w-4" />
          <span>Sign Out</span>
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}
