import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { PageHeader } from "@/components/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import TimesheetSettings from "@/components/settings/TimesheetSettings";
import OrganizationSettings from "@/components/settings/OrganizationSettings";
import AccountSettings from "@/components/settings/AccountSettings";
import LabelSettings from "@/components/settings/LabelSettings";
import CategorySettings from "@/components/settings/CategorySettings";
import ApprovalWorkflowSettings from "@/components/settings/ApprovalWorkflowSettings";
import { Clock, Building2, User, Tag, ListChecks, GitMerge } from "lucide-react";
import { isRole } from "@/lib/roleMapping";

export default function Settings() {
  const { user, loading, userWithRole } = useAuth();

  if (loading) {
    return null;
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  const isOrgAdmin = isRole(userWithRole?.role, "admin", "org_admin", "super_admin");
  const isHod = isRole(userWithRole?.role, "l3", "manager");
  const isL2 = isRole(userWithRole?.role, "l2", "program_manager");
  const isL1 = isRole(userWithRole?.role, "l1", "member", "faculty");

  // L1 users only see Account tab
  if (isL1 && !isHod && !isL2 && !isOrgAdmin) {
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
            <TimesheetSettings />
          </TabsContent>

          <TabsContent value="categories">
            <CategorySettings />
          </TabsContent>

          {isOrgAdmin && (
            <TabsContent value="workflow">
              <ApprovalWorkflowSettings />
            </TabsContent>
          )}

          {isOrgAdmin && (
            <TabsContent value="organization">
              <OrganizationSettings />
            </TabsContent>
          )}

          {isOrgAdmin && (
            <TabsContent value="labels">
              <LabelSettings />
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
