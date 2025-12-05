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
import { Clock, Building2, Palette, User, Tag } from "lucide-react";

export default function Settings() {
  const { user, loading, userWithRole } = useAuth();

  if (loading) {
    return null;
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  const isOrgAdmin = userWithRole?.role === "org_admin";

  return (
    <Layout>
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <PageHeader
          title="Settings"
          description="Manage your preferences and organization settings"
        />

        <Tabs defaultValue="timesheet" className="space-y-6">
          <TabsList className={`grid w-full h-auto p-1 ${isOrgAdmin ? "grid-cols-5" : "grid-cols-4"}`}>
            <TabsTrigger value="timesheet" className="flex items-center gap-2 py-2.5">
              <Clock className="h-4 w-4" />
              <span className="hidden sm:inline">Timesheet</span>
            </TabsTrigger>
            <TabsTrigger value="organization" className="flex items-center gap-2 py-2.5">
              <Building2 className="h-4 w-4" />
              <span className="hidden sm:inline">Organization</span>
            </TabsTrigger>
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

          <TabsContent value="organization">
            <OrganizationSettings />
          </TabsContent>

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
