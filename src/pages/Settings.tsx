import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { PageHeader } from "@/components/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import TimesheetSettings from "@/components/settings/TimesheetSettings";
import OrganizationSettings from "@/components/settings/OrganizationSettings";
import AppearanceSettings from "@/components/settings/AppearanceSettings";
import AccountSettings from "@/components/settings/AccountSettings";
import LabelSettings from "@/components/settings/LabelSettings";
import CategorySettings from "@/components/settings/CategorySettings";
import { Clock, Building2, Palette, User, Tag, ListChecks } from "lucide-react";

export default function Settings() {
  const { user, loading, userWithRole } = useAuth();

  if (loading) {
    return null;
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  const isOrgAdmin = userWithRole?.role === "org_admin";
  const isHod = userWithRole?.role === "manager";
  const canAccessSettings = isOrgAdmin || isHod;

  // HODs only see limited tabs
  if (!canAccessSettings) {
    return <Navigate to="/dashboard" replace />;
  }

  // Determine number of tabs based on role
  const getTabCount = () => {
    if (isOrgAdmin) return 6; // Timesheet, Categories, Organization, Labels, Appearance, Account
    if (isHod) return 4; // Timesheet, Categories, Appearance, Account
    return 4;
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <PageHeader
          title="Settings"
          description={isHod 
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
            <TabsTrigger value="appearance" className="flex items-center gap-2 py-2.5">
              <Palette className="h-4 w-4" />
              <span className="hidden sm:inline">Appearance</span>
            </TabsTrigger>
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
            <TabsContent value="organization">
              <OrganizationSettings />
            </TabsContent>
          )}

          {isOrgAdmin && (
            <TabsContent value="labels">
              <LabelSettings />
            </TabsContent>
          )}

          <TabsContent value="appearance">
            <AppearanceSettings />
          </TabsContent>

          <TabsContent value="account">
            <AccountSettings />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
