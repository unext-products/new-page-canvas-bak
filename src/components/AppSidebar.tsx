import { useAuth } from "@/contexts/AuthContext";
import { useLabels } from "@/contexts/LabelContext";
import { isRole } from "@/lib/roleMapping";
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
  Layers3,
  Calendar,
  BookOpen,
  BarChart3,
  ClipboardCheck,
  UsersRound,
  CalendarDays
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { Logo } from "@/components/Logo";
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

const roleColors: Record<string, string> = {
  l1: "bg-muted text-muted-foreground",
  member: "bg-muted text-muted-foreground",
  l2: "bg-warning/10 text-warning",
  program_manager: "bg-warning/10 text-warning",
  l3: "bg-primary/10 text-primary",
  manager: "bg-primary/10 text-primary",
  admin: "bg-success/10 text-success",
  org_admin: "bg-success/10 text-success",
  super_admin: "bg-destructive/10 text-destructive",
};

export function AppSidebar() {
  const { userWithRole } = useAuth();
  const { roleLabel, entityLabel } = useLabels();
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
    await signOut();
    navigate("/");
  };

  const getNavItems = () => {
    const role = userWithRole?.role;
    const items: { to: string; icon: typeof Clock; label: string; group?: string }[] = [
      { to: "/dashboard", icon: Clock, label: "Dashboard", group: "Overview" },
    ];

    // L1 (Member/Faculty) - Timesheet only
    if (isRole(role, "l1", "member")) {
      items.push(
        { to: "/timesheet", icon: FileText, label: "Timesheet", group: "Work" },
        { to: "/calendar", icon: CalendarDays, label: "Calendar", group: "Work" },
        { to: "/bulk-import", icon: Upload, label: "Bulk Upload", group: "Work" },
        { to: "/settings", icon: Settings, label: "Settings", group: "Tools" }
      );
    }

    // L2 (Program Manager) - Timesheet + Approvals for L1 + Reports + Settings (same as L3)
    if (isRole(role, "l2", "program_manager")) {
      items.push(
        { to: "/timesheet", icon: FileText, label: "Timesheet", group: "Work" },
        { to: "/calendar", icon: CalendarDays, label: "Calendar", group: "Work" },
        { to: "/bulk-import", icon: Upload, label: "Bulk Upload", group: "Work" },
        { to: "/approvals", icon: ClipboardCheck, label: "Approvals", group: "Management" },
        { to: "/team", icon: UsersRound, label: "Team", group: "Management" },
        { to: "/reports", icon: BarChart3, label: "Reports", group: "Analytics" },
        { to: "/settings", icon: Settings, label: "Settings", group: "Tools" }
      );
    }

    // L3 (Manager/HOD) - Timesheet + Approvals for L2 & L1 + Team + Reports
    if (isRole(role, "l3", "manager")) {
      items.push(
        { to: "/timesheet", icon: FileText, label: "Timesheet", group: "Work" },
        { to: "/calendar", icon: CalendarDays, label: "Calendar", group: "Work" },
        { to: "/bulk-import", icon: Upload, label: "Bulk Upload", group: "Work" },
        { to: "/approvals", icon: ClipboardCheck, label: "Approvals", group: "Management" },
        { to: "/team", icon: UsersRound, label: "Team", group: "Management" },
        { to: "/reports", icon: BarChart3, label: "Reports", group: "Analytics" },
        { to: "/settings", icon: Settings, label: "Settings", group: "Tools" }
      );
    }

    // Admin (Org Admin) - Full org access
    if (isRole(role, "admin", "org_admin")) {
      items.push(
        { to: "/organizations", icon: Building2, label: "Organization", group: "Administration" },
        { to: "/verticals", icon: Layers, label: entityLabel("vertical", true), group: "Administration" },
        { to: "/programs", icon: FolderKanban, label: entityLabel("program", true), group: "Administration" },
        { to: "/batches", icon: Layers3, label: entityLabel("batch", true), group: "Administration" },
        { to: "/terms", icon: Calendar, label: entityLabel("term", true), group: "Administration" },
        { to: "/subjects", icon: BookOpen, label: entityLabel("subject", true), group: "Administration" },
        { to: "/users", icon: Users, label: "Users", group: "Administration" },
        { to: "/approvals", icon: ClipboardCheck, label: "Approvals", group: "Management" },
        { to: "/reports", icon: BarChart3, label: "Reports", group: "Analytics" },
        { to: "/bulk-import", icon: Upload, label: "Bulk Import", group: "Tools" },
        { to: "/settings", icon: Settings, label: "Settings", group: "Tools" }
      );
    }

    // Super Admin - Cross-org access (extends Admin)
    if (isRole(role, "super_admin")) {
      items.push(
        { to: "/organizations", icon: Building2, label: "All Organizations", group: "Super Admin" },
        { to: "/verticals", icon: Layers, label: entityLabel("vertical", true), group: "Administration" },
        { to: "/programs", icon: FolderKanban, label: entityLabel("program", true), group: "Administration" },
        { to: "/batches", icon: Layers3, label: entityLabel("batch", true), group: "Administration" },
        { to: "/terms", icon: Calendar, label: entityLabel("term", true), group: "Administration" },
        { to: "/subjects", icon: BookOpen, label: entityLabel("subject", true), group: "Administration" },
        { to: "/users", icon: Users, label: "Users", group: "Administration" },
        { to: "/reports", icon: BarChart3, label: "Reports", group: "Analytics" },
        { to: "/settings", icon: Settings, label: "Settings", group: "Tools" }
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
        <Logo to="/dashboard" variant="dark" />
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
              {roleLabel(userRole)}
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
