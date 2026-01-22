import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { PageHeader } from "@/components/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import TimesheetSettings from "@/components/settings/TimesheetSettings";
import OrganizationSettings from "@/components/settings/OrganizationSettings";
import AccountSettings from "@/components/settings/AccountSettings";
import LabelSettings from "@/components/settings/LabelSettings";
import CategorySettings from "@/components/settings/CategorySettings";
import ApprovalWorkflowSettings from "@/components/settings/ApprovalWorkflowSettings";
import { Clock, Building2, User, Tag, ListChecks, GitMerge, Building } from "lucide-react";
import { isRole } from "@/lib/roleMapping";
import { supabase } from "@/integrations/supabase/client";

export default function Settings() {
  const { user, loading, userWithRole } = useAuth();
  
  // Organization context for Super Admin
  const [selectedOrgContext, setSelectedOrgContext] = useState<string>("");
  const [organizations, setOrganizations] = useState<{ id: string; name: string; code: string }[]>([]);
  
  const isSuperAdmin = isRole(userWithRole?.role, "super_admin");
  const isOrgAdmin = isRole(userWithRole?.role, "admin", "org_admin", "super_admin");
  const isHod = isRole(userWithRole?.role, "l3", "manager");
  const isL2 = isRole(userWithRole?.role, "l2", "program_manager");
  const isL1 = isRole(userWithRole?.role, "l1", "member", "faculty");
  
  // Fetch organizations for Super Admin
  useEffect(() => {
    const fetchOrganizations = async () => {
      if (!isSuperAdmin) return;
      
      const { data } = await supabase
        .from("organizations")
        .select("id, name, code")
        .order("name");
      
      setOrganizations(data || []);
      
      // Set default org if available
      if (data && data.length > 0 && !selectedOrgContext) {
        setSelectedOrgContext(data[0].id);
      }
    };
    
    fetchOrganizations();
  }, [isSuperAdmin]);

  if (loading) {
    return null;
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // L1 users (who are not also L2/L3/Admin) only see Account tab
  if (isL1 && !isHod && !isL2 && !isOrgAdmin && !isSuperAdmin) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto p-6 space-y-6">
          <PageHeader
            title="Settings"
            description="Manage your account settings"
          />

          <Tabs defaultValue="account" className="space-y-6">
            <TabsList className="grid w-full h-auto p-1 grid-cols-1" style={{ gridTemplateColumns: "repeat(1, minmax(0, 1fr))" }}>
              <TabsTrigger value="account" className="flex items-center gap-2 py-2.5">
                <User className="h-4 w-4" />
                <span className="hidden sm:inline">Account</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="account">
              <AccountSettings />
            </TabsContent>
          </Tabs>
        </div>
      </Layout>
    );
  }

  // HODs and L2 only see limited tabs, redirect if not allowed
  const canAccessSettings = isOrgAdmin || isHod || isL2;
  if (!canAccessSettings) {
    return <Navigate to="/dashboard" replace />;
  }

  // Determine number of tabs based on role
  const getTabCount = () => {
    if (isOrgAdmin) return 6; // Timesheet, Categories, Workflow, Organization, Labels, Account
    if (isHod || isL2) return 3; // Timesheet, Categories, Account
    return 3;
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <PageHeader
          title="Settings"
          description={isHod || isL2
            ? "Manage your department's timesheet settings and preferences" 
            : "Manage your preferences and organization settings"
          }
        />

        {/* Organization Context Selector for Super Admin */}
        {isSuperAdmin && (
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-4">
                <Building className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1">
                  <Label className="text-sm font-medium">Organization Context</Label>
                  <p className="text-xs text-muted-foreground">Settings will be applied to the selected organization</p>
                </div>
                <Select value={selectedOrgContext} onValueChange={setSelectedOrgContext}>
                  <SelectTrigger className="w-[280px]">
                    <SelectValue placeholder="Select organization" />
                  </SelectTrigger>
                  <SelectContent>
                    {organizations.map(org => (
                      <SelectItem key={org.id} value={org.id}>
                        {org.name} ({org.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="timesheet" className="space-y-6">
          <TabsList className={`grid w-full h-auto p-1 grid-cols-${getTabCount()}`} style={{ gridTemplateColumns: `repeat(${getTabCount()}, minmax(0, 1fr))` }}>
            <TabsTrigger value="timesheet" className="flex items-center gap-2 py-2.5">
              <Clock className="h-4 w-4" />
              <span className="hidden sm:inline">Timesheet</span>
            </TabsTrigger>
            <TabsTrigger value="categories" className="flex items-center gap-2 py-2.5">
              <ListChecks className="h-4 w-4" />
              <span className="hidden sm:inline">Categories</span>
            </TabsTrigger>
            {isOrgAdmin && (
              <TabsTrigger value="workflow" className="flex items-center gap-2 py-2.5">
                <GitMerge className="h-4 w-4" />
                <span className="hidden sm:inline">Workflow</span>
              </TabsTrigger>
            )}
            {isOrgAdmin && (
              <TabsTrigger value="organization" className="flex items-center gap-2 py-2.5">
                <Building2 className="h-4 w-4" />
                <span className="hidden sm:inline">Organization</span>
              </TabsTrigger>
            )}
            {isOrgAdmin && (
              <TabsTrigger value="labels" className="flex items-center gap-2 py-2.5">
                <Tag className="h-4 w-4" />
                <span className="hidden sm:inline">Labels</span>
              </TabsTrigger>
            )}
            <TabsTrigger value="account" className="flex items-center gap-2 py-2.5">
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">Account</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="timesheet">
            <TimesheetSettings organizationId={isSuperAdmin ? selectedOrgContext : undefined} />
          </TabsContent>

          <TabsContent value="categories">
            <CategorySettings organizationId={isSuperAdmin ? selectedOrgContext : undefined} />
          </TabsContent>

          {isOrgAdmin && (
            <TabsContent value="workflow">
              <ApprovalWorkflowSettings organizationId={isSuperAdmin ? selectedOrgContext : undefined} />
            </TabsContent>
          )}

          {isOrgAdmin && (
            <TabsContent value="organization">
              <OrganizationSettings />
            </TabsContent>
          )}

          {isOrgAdmin && (
            <TabsContent value="labels">
              <LabelSettings organizationId={isSuperAdmin ? selectedOrgContext : undefined} />
            </TabsContent>
          )}

          <TabsContent value="account">
            <AccountSettings />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
