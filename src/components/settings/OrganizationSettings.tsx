import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, Building2 } from "lucide-react";

interface Organization {
  id: string;
  name: string;
  code: string;
}

export default function OrganizationSettings() {
  const { userWithRole } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [formData, setFormData] = useState({ name: "", code: "" });

  const isOrgAdmin = userWithRole?.role === "org_admin";

  useEffect(() => {
    fetchOrganization();
  }, []);

  const fetchOrganization = async () => {
    try {
      const { data, error } = await supabase
        .from("organizations")
        .select("id, name, code")
        .single();

      if (error && error.code !== "PGRST116") throw error;

      if (data) {
        setOrganization(data);
        setFormData({ name: data.name, code: data.code });
      }
    } catch (error) {
      console.error("Error fetching organization:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!organization) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("organizations")
        .update({ name: formData.name, code: formData.code })
        .eq("id", organization.id);

      if (error) throw error;

      setOrganization({ ...organization, ...formData });
      toast({
        title: "Organization updated",
        description: "Your changes have been saved.",
      });
    } catch (error) {
      console.error("Error updating organization:", error);
      toast({
        title: "Error",
        description: "Failed to update organization. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!organization) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No organization found</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Organization Details</CardTitle>
        <CardDescription>
          View and manage your organization's information
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="org-name">Organization Name</Label>
          <Input
            id="org-name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            disabled={!isOrgAdmin}
            placeholder="Enter organization name"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="org-code">Organization Code</Label>
          <Input
            id="org-code"
            value={formData.code}
            onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
            disabled={!isOrgAdmin}
            placeholder="e.g., ACME"
            maxLength={10}
          />
          <p className="text-xs text-muted-foreground">
            A short identifier for your organization (max 10 characters)
          </p>
        </div>

        {isOrgAdmin && (
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        )}

        {!isOrgAdmin && (
          <p className="text-sm text-muted-foreground">
            Only organization administrators can modify these settings.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
