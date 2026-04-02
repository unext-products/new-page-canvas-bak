import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLabels } from "@/contexts/LabelContext";
import { Upload, FileText, Trash2, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface SampleTimesheetUploadProps {
  organizationId?: string;
}

const ROLES = ["l1", "l2", "l3"] as const;

export default function SampleTimesheetUpload({ organizationId }: SampleTimesheetUploadProps) {
  const { userWithRole } = useAuth();
  const { roleLabel } = useLabels();
  const { toast } = useToast();
  const [uploadedFiles, setUploadedFiles] = useState<Record<string, string | null>>({
    l1: null, l2: null, l3: null,
  });
  const [uploading, setUploading] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({ l1: null, l2: null, l3: null });

  const [resolvedOrgId, setResolvedOrgId] = useState<string | null>(organizationId || null);

  useEffect(() => {
    const fetchOrgId = async () => {
      if (organizationId) { setResolvedOrgId(organizationId); return; }
      if (!userWithRole?.user?.id) return;
      const { data } = await supabase
        .from("user_roles")
        .select("organization_id")
        .eq("user_id", userWithRole.user.id)
        .single();
      if (data?.organization_id) setResolvedOrgId(data.organization_id);
    };
    fetchOrgId();
  }, [organizationId, userWithRole?.user?.id]);

  const getOrgId = () => resolvedOrgId;

  useEffect(() => {
    if (resolvedOrgId) {
      fetchExistingFiles();
    }
  }, [resolvedOrgId]);

  const fetchExistingFiles = async () => {
    const orgId = getOrgId();
    if (!orgId) { setLoading(false); return; }

    setLoading(true);
    const result: Record<string, string | null> = { l1: null, l2: null, l3: null };

    for (const role of ROLES) {
      const { data } = await supabase.storage
        .from("sample-timesheets")
        .list(`${orgId}/${role}`, { limit: 1 });

      if (data && data.length > 0) {
        result[role] = data[0].name;
      }
    }

    setUploadedFiles(result);
    setLoading(false);
  };

  const handleUpload = async (role: string, file: File) => {
    const orgId = getOrgId();
    if (!orgId) return;

    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!ext || !["xlsx", "xls", "csv"].includes(ext)) {
      toast({ title: "Invalid file", description: "Please upload an Excel (.xlsx, .xls) or CSV (.csv) file.", variant: "destructive" });
      return;
    }

    setUploading(role);

    // Remove existing file first
    if (uploadedFiles[role]) {
      await supabase.storage.from("sample-timesheets").remove([`${orgId}/${role}/${uploadedFiles[role]}`]);
    }

    const filePath = `${orgId}/${role}/${file.name}`;
    const { error } = await supabase.storage
      .from("sample-timesheets")
      .upload(filePath, file, { upsert: true });

    if (error) {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    } else {
      setUploadedFiles((prev) => ({ ...prev, [role]: file.name }));
      toast({ title: "Sample uploaded", description: `Sample timesheet for ${roleLabel(role)} has been uploaded.` });
    }

    setUploading(null);
  };

  const handleDelete = async (role: string) => {
    const orgId = getOrgId();
    if (!orgId || !uploadedFiles[role]) return;

    setUploading(role);
    const { error } = await supabase.storage
      .from("sample-timesheets")
      .remove([`${orgId}/${role}/${uploadedFiles[role]}`]);

    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    } else {
      setUploadedFiles((prev) => ({ ...prev, [role]: null }));
      toast({ title: "Sample removed", description: `Sample timesheet for ${roleLabel(role)} has been removed.` });
    }
    setUploading(null);
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload Sample Timesheet</CardTitle>
        <CardDescription>
          Upload sample Excel/CSV files for each role. Users will be able to download these as reference when filling timesheets.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {ROLES.map((role) => (
            <div key={role} className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="font-medium">
                  {roleLabel(role)}
                </Badge>
                {uploadedFiles[role] ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <FileText className="h-4 w-4" />
                    <span className="truncate max-w-[200px]">{uploadedFiles[role]}</span>
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">No sample uploaded</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <input
                  ref={(el) => { fileInputRefs.current[role] = el; }}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUpload(role, f);
                    e.target.value = "";
                  }}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRefs.current[role]?.click()}
                  disabled={uploading === role}
                >
                  {uploading === role ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <Upload className="h-4 w-4 mr-1" />
                  )}
                  {uploadedFiles[role] ? "Replace" : "Upload"}
                </Button>
                {uploadedFiles[role] && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleDelete(role)}
                    disabled={uploading === role}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
