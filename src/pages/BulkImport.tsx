import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { isRole } from "@/lib/roleMapping";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileText, Download, AlertCircle, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { getUserErrorMessage } from "@/lib/errorHandler";
import { bulkInsertTimesheets, fetchUsersAndDepartments } from "@/lib/csvImportUtils";
import {
  parseExcelFile,
  validateMemberExcelRow,
  validateAdminExcelRow,
  generateAdminExcelTemplate,
  fetchDepartments,
  getFileType,
  timesOverlap,
  type ValidationResult as ExcelValidationResult,
} from "@/lib/excelImportUtils";
import { fetchExtendedValidationContext, fetchUserLeaveDays } from "@/lib/thresholdValidation";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

type ValidationResult = ExcelValidationResult & { rowNumber?: number; rowData?: any };

interface DepartmentMember {
  id: string;
  full_name: string;
  email: string;
}

export default function BulkImport() {
  const { userWithRole, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [validationResults, setValidationResults] = useState<ValidationResult[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importComplete, setImportComplete] = useState(false);
  const [importStats, setImportStats] = useState({ success: 0, failed: 0 });
  const [selectedMemberId, setSelectedMemberId] = useState<string>("self");
  const [departmentMembers, setDepartmentMembers] = useState<DepartmentMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  // Stable ref for userWithRole to prevent async handlers from seeing null during token refresh
  const userRef = useRef(userWithRole);
  useEffect(() => { userRef.current = userWithRole; }, [userWithRole]);

  const isMember = isRole(userWithRole?.role, "l1", "member");
  const isAdmin = isRole(userWithRole?.role, "admin", "org_admin");
  const isHod = isRole(userWithRole?.role, "l3", "manager");
  const isL2 = isRole(userWithRole?.role, "l2", "program_manager");
  const isManager = isHod || isL2; // L2 and L3 are both managers with similar capabilities

  // Fetch department members for HOD/L2/L3
  useEffect(() => {
    const fetchDepartmentMembers = async () => {
      if (!isManager || !userWithRole?.user?.id) return;

      setLoadingMembers(true);
      try {
        // Get manager's verticals from user_verticals
        const { data: managerVerticals } = await supabase
          .from("user_verticals")
          .select("vertical_id")
          .eq("user_id", userWithRole.user.id);

        const verticalIds = managerVerticals?.map((v) => v.vertical_id) || [];

        if (verticalIds.length === 0) {
          // Fallback to user_departments
          const { data: managerDepts } = await supabase
            .from("user_departments")
            .select("department_id")
            .eq("user_id", userWithRole.user.id);

          verticalIds.push(...(managerDepts?.map((d) => d.department_id) || []));
        }

        if (verticalIds.length === 0) {
          setLoadingMembers(false);
          return;
        }

        // Get all users in those verticals
        const { data: vertUsers } = await supabase
          .from("user_verticals")
          .select("user_id")
          .in("vertical_id", verticalIds);

        const allUserIds = [...new Set(vertUsers?.map((v) => v.user_id) || [])];

        if (allUserIds.length === 0) {
          setLoadingMembers(false);
          return;
        }

        // Get L1/faculty roles only
        const { data: facultyRoles } = await supabase
          .from("user_roles")
          .select("user_id")
          .in("role", ["l1", "faculty"])
          .in("user_id", allUserIds);

        const facultyUserIds = (facultyRoles?.map((r) => r.user_id) || []).filter((id) => id !== userWithRole.user.id);

        if (facultyUserIds.length === 0) {
          setLoadingMembers(false);
          return;
        }

        // Get profiles for these users
        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", facultyUserIds)
          .eq("is_active", true);

        if (profilesError) throw profilesError;

        // Get emails via edge function
        const { data: usersData, error: usersError } = await supabase.functions.invoke("admin-list-users");

        if (usersError) throw usersError;

        const emailMap = new Map(usersData?.users?.map((u: any) => [u.id, u.email]) || []);

        const members: DepartmentMember[] = (profiles || []).map((p) => ({
          id: p.id,
          full_name: p.full_name,
          email: (emailMap.get(p.id) as string) || "",
        }));

        setDepartmentMembers(members);
      } catch (error) {
        console.error("Error fetching department members:", error);
      } finally {
        setLoadingMembers(false);
      }
    };

    fetchDepartmentMembers();
  }, [isManager, userWithRole?.user?.id]);

  if (authLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  // Redirect if not member, admin, HOD, or L2
  if (!isMember && !isAdmin && !isHod && !isL2) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    // Validate file type - Excel only
    const fileType = getFileType(selectedFile.name);
    if (fileType !== "excel") {
      toast({
        title: "Invalid file type",
        description: "Please upload an Excel file (.xlsx, .xls)",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 5MB)
    if (selectedFile.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload a file smaller than 5MB",
        variant: "destructive",
      });
      return;
    }

    setFile(selectedFile);
    setValidationResults([]);
    setImportComplete(false);
  };

  const handleParseAndValidate = async () => {
    if (!file) return;

    setIsValidating(true);
    try {
      const rows = await parseExcelFile(file);

      if (rows.length === 0) {
        toast({
          title: "Empty file",
          description: "The file contains no data",
          variant: "destructive",
        });
        setIsValidating(false);
        return;
      }

      if (rows.length > 1000) {
        toast({
          title: "Too many rows",
          description: "Maximum 1000 rows allowed per upload",
          variant: "destructive",
        });
        setIsValidating(false);
        return;
      }

      let results: ValidationResult[] = [];

      if (isMember || isManager) {
        // Member or Manager mode: validate without email, use selected user
        // Fetch user's organization ID to scope department/vertical lookups
        // Use stable ref to avoid null during token refresh
        const currentUser = userRef.current;
        const { data: userRoleData } = await supabase
          .from("user_roles")
          .select("organization_id")
          .eq("user_id", currentUser?.user.id || "")
          .maybeSingle();
        const orgId = userRoleData?.organization_id || undefined;

        // For Manager, use selected member if not "self"
        let targetUserId = currentUser?.user.id;
        let targetDepartmentId = currentUser?.departmentId;

        if (isManager && selectedMemberId !== "self") {
          targetUserId = selectedMemberId;
        }

        if (!targetUserId) {
          toast({
            title: "Error",
            description: "Could not determine user",
            variant: "destructive",
          });
          setIsValidating(false);
          return;
        }

        // Parallelize independent queries (Batch 1: all independent of each other, only depend on orgId/targetUserId)
        const [
          deptsMap,
          userDepsRes,
          userVertsRes,
          userProgsData,
          validationContext,
          userLeaveDays,
          existingEntriesRes,
        ] = await Promise.all([
          fetchDepartments(orgId),
          supabase.from("user_departments").select("department_id").eq("user_id", targetUserId),
          supabase.from("user_verticals").select("vertical_id").eq("user_id", targetUserId),
          supabase.from("user_programs").select("program_id").eq("user_id", targetUserId),
          fetchExtendedValidationContext(targetUserId),
          fetchUserLeaveDays(targetUserId),
          supabase.from("timesheet_entries").select("entry_date, start_time, end_time").eq("user_id", targetUserId).neq("status", "rejected"),
        ]);

        const existingEntries = existingEntriesRes.data || [];

        const deptIds = userDepsRes.data?.map((ud) => ud.department_id) || [];
        const vertIds = userVertsRes.data?.map((uv) => uv.vertical_id) || [];

        // Also include department from user_roles as fallback
        if (targetDepartmentId && !deptIds.includes(targetDepartmentId)) {
          deptIds.push(targetDepartmentId);
        }

        let userDeptCodes = new Set<string>();

        // Batch 2: queries that depend on Batch 1 results
        const userProgIds = userProgsData.data?.map((up) => up.program_id) || [];
        const [deptCodesRes, vertCodesRes, progsRes] = await Promise.all([
          deptIds.length > 0 ? supabase.from("departments").select("code").in("id", deptIds) : Promise.resolve({ data: [] }),
          vertIds.length > 0 ? supabase.from("verticals").select("code").in("id", vertIds) : Promise.resolve({ data: [] }),
          userProgIds.length > 0 ? supabase.from("programs").select("id, code, name, vertical_id, verticals(code)").in("id", userProgIds) : Promise.resolve({ data: [] }),
        ]);

        (deptCodesRes.data as any[] || []).forEach((d: any) => userDeptCodes.add(d.code.toUpperCase()));
        (vertCodesRes.data as any[] || []).forEach((v: any) => userDeptCodes.add(v.code.toUpperCase()));

        // Build user programs map - use arrays to handle duplicate program names/codes across verticals
        let userProgramsMap: Map<string, { id: string; vertical_id: string; vertical_code?: string; name?: string }[]> | null = null;
        if ((progsRes.data as any[])?.length) {
          const progs = progsRes.data as any[];
          userProgramsMap = new Map();
          
          progs.forEach((p: any) => {
            const vertCode = p.verticals?.code?.toUpperCase() || "";
            const entry = { id: p.id, vertical_id: p.vertical_id || "", vertical_code: vertCode, name: p.name };
            const codeKey = p.code.toUpperCase();
            
            // Add by code
            const existingByCode = userProgramsMap!.get(codeKey) || [];
            existingByCode.push(entry);
            userProgramsMap!.set(codeKey, existingByCode);
            
            // Also add by name for lookup flexibility
            if (p.name) {
              const nameKey = p.name.toUpperCase();
              if (nameKey !== codeKey) {
                const existingByName = userProgramsMap!.get(nameKey) || [];
                existingByName.push(entry);
                userProgramsMap!.set(nameKey, existingByName);
              }
            }
          });
        }

        const validationContextWithLeave = {
          ...validationContext,
          userLeaveDays,
        };

        results = await Promise.all(
          rows.map(async (row, index) => {
            const validation = await validateMemberExcelRow(
              row,
              targetUserId!,
              targetDepartmentId || "",
              deptsMap,
              userDeptCodes,
              validationContextWithLeave,
              userProgramsMap,
              null, // programsInVertical - only needed as fallback
              existingEntries, // pass existing entries for overlap checking
            );
            return {
              rowNumber: index + 2,
              rowData: row,
              ...validation,
            };
          }),
        );

        // Intra-upload overlap detection: check valid rows against each other
        const validRows = results.filter(r => r.isValid && r.data);
        for (let i = 0; i < validRows.length; i++) {
          for (let j = i + 1; j < validRows.length; j++) {
            const a = validRows[i].data;
            const b = validRows[j].data;
            if (a.entry_date === b.entry_date && timesOverlap(a.start_time, a.end_time, b.start_time, b.end_time)) {
              // Mark the later row as invalid
              const idx = results.indexOf(validRows[j]);
              results[idx] = {
                ...results[idx],
                isValid: false,
                errors: [`Overlaps with row ${validRows[i].rowNumber} (${a.start_time}-${a.end_time} on ${a.entry_date})`],
              };
            }
          }
        }

        // Cumulative max hours per day check
        if (validationContext.thresholds?.max_hours_enabled) {
          const maxMinutes = validationContext.thresholds.max_hours_minutes;
          const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };

          // Sum existing DB entries by date
          const existingByDate = new Map<string, number>();
          for (const e of existingEntries) {
            const dur = toMin(e.end_time) - toMin(e.start_time);
            existingByDate.set(e.entry_date, (existingByDate.get(e.entry_date) || 0) + dur);
          }

          // Track cumulative bulk minutes by date
          const bulkByDate = new Map<string, number>();
          for (const r of results) {
            if (!r.isValid || !r.data) continue;
            const date = r.data.entry_date;
            const dur = toMin(r.data.end_time) - toMin(r.data.start_time);
            const existingMins = existingByDate.get(date) || 0;
            const bulkSoFar = bulkByDate.get(date) || 0;
            const total = existingMins + bulkSoFar + dur;

            if (total > maxMinutes) {
              const maxH = Math.floor(maxMinutes / 60);
              const maxM = maxMinutes % 60;
              const idx = results.indexOf(r);
              results[idx] = {
                ...results[idx],
                isValid: false,
                errors: [`Would exceed max ${maxH}h ${maxM}m per day (total: ${Math.floor(total / 60)}h ${total % 60}m)`],
              };
            } else {
              bulkByDate.set(date, bulkSoFar + dur);
            }
          }
        }
      } else {
        // Admin mode: validate with email
        const { usersMap, deptsMap } = await fetchUsersAndDepartments();

        // Fetch extended validation context for admin's organization
        let validationContext = null;
        if (userWithRole?.user?.id) {
          validationContext = await fetchExtendedValidationContext(userWithRole.user.id);
        }

        results = await Promise.all(
          rows.map(async (row, index) => {
            const validation = await validateAdminExcelRow(row, usersMap, deptsMap, validationContext);
            return {
              rowNumber: index + 2,
              rowData: row,
              ...validation,
            };
          }),
        );
      }

      setValidationResults(results);

      const validCount = results.filter((r) => r.isValid).length;
      const invalidCount = results.length - validCount;

      toast({
        title: "Validation complete",
        description: `${validCount} valid, ${invalidCount} invalid entries`,
      });
    } catch (error: any) {
      toast({
        title: "Validation failed",
        description: getUserErrorMessage(error, "validation"),
        variant: "destructive",
      });
    } finally {
      setIsValidating(false);
    }
  };

  const handleImport = async () => {
    const validEntries = validationResults.filter((r) => r.isValid && r.data).map((r) => r.data);

    if (validEntries.length === 0) {
      toast({
        title: "No valid entries",
        description: "There are no valid entries to import",
        variant: "destructive",
      });
      return;
    }

    setIsImporting(true);
    setImportProgress(0);

    try {
      const results = await bulkInsertTimesheets(validEntries);
      setImportStats(results);
      setImportComplete(true);
      setImportProgress(100);

      if (results.success > 0) {
        const isForSelf = isMember || (isManager && selectedMemberId === "self");
        toast({
          title: isForSelf ? "Submitted for approval" : "Import complete",
          description: isForSelf
            ? `${results.success} entries submitted for approval`
            : `Successfully imported ${results.success} entries`,
        });
      }

      if (results.failed > 0) {
        toast({
          title: "Some entries failed",
          description: `${results.failed} entries could not be imported`,
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Import failed",
        description: getUserErrorMessage(error, "import"),
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleDownloadTemplate = async () => {
    // Determine role key for sample lookup
    const roleKey = isMember ? "l1" : isL2 ? "l2" : isHod ? "l3" : null;

    // For non-admin users, try to download role-specific sample from storage first
    if (roleKey && userWithRole?.user?.id) {
      try {
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("organization_id")
          .eq("user_id", userWithRole.user.id)
          .single();

        if (roleData?.organization_id) {
          const { data: files } = await supabase.storage
            .from("sample-timesheets")
            .list(`${roleData.organization_id}/${roleKey}`, { limit: 1 });

          if (files && files.length > 0) {
            const { data: urlData } = supabase.storage
              .from("sample-timesheets")
              .getPublicUrl(`${roleData.organization_id}/${roleKey}/${files[0].name}`);

            if (urlData?.publicUrl) {
              window.open(urlData.publicUrl, "_blank");
              return;
            }
          }
        }
      } catch (err) {
        console.warn("Failed to fetch sample from storage, falling back to default", err);
      }
    }

    // Fallback to existing behavior
    if (isMember || isManager) {
      const SPREADSHEET_ID = "1XcrQT-LZ9HX6czFZKGEdZvoRiuctSSbx";
      const exportUrl = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=xlsx`;
      window.open(exportUrl, "_blank");
    } else {
      const blob = generateAdminExcelTemplate();
      const filename = "timesheet_import_template.xlsx";
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }
  };

  const handleReset = () => {
    setFile(null);
    setValidationResults([]);
    setImportComplete(false);
    setImportStats({ success: 0, failed: 0 });
    setImportProgress(0);
    setSelectedMemberId("self");
  };

  const validCount = validationResults.filter((r) => r.isValid).length;
  const invalidCount = validationResults.length - validCount;

  const getPageTitle = () => {
    if (isMember) return "Bulk Upload My Timesheets";
    if (isManager) return "Bulk Upload Timesheets";
    return "Bulk Import Timesheets (Admin)";
  };

  const getPageDescription = () => {
    if (isMember) return "Upload your timesheet entries in bulk. Entries will be submitted for manager approval.";
    if (isManager) return "Upload timesheet entries for yourself or your department members.";
    return "Upload timesheet entries for any team member using Excel files.";
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">{getPageTitle()}</h1>
          <p className="text-muted-foreground mt-2">{getPageDescription()}</p>
        </div>

        {/* Template Download */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Download Template
            </CardTitle>
            <CardDescription>Download a template file with example data and required columns</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleDownloadTemplate} variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Download Excel Template
            </Button>
            <p className="text-sm text-muted-foreground mt-4">
              {isMember || isManager
                ? "Template includes: date, times, activity type, subtype, notes, and department code"
                : "Template includes: member email, date, times, activity type, subtype, notes, and department code"}
            </p>
          </CardContent>
        </Card>

        {/* File Upload */}
        {!importComplete && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Upload File
              </CardTitle>
              <CardDescription>Select an Excel file containing timesheet entries (max 1000 rows, 5MB)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Manager Member Selection */}
              {isManager && (
                <div className="space-y-2">
                  <Label htmlFor="member-select">Choose Member</Label>
                  <Select value={selectedMemberId} onValueChange={setSelectedMemberId}>
                    <SelectTrigger id="member-select">
                      <SelectValue placeholder="Select member" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="self">Self (My Timesheet)</SelectItem>
                      {loadingMembers ? (
                        <SelectItem value="loading" disabled>
                          Loading members...
                        </SelectItem>
                      ) : (
                        departmentMembers.map((member) => (
                          <SelectItem key={member.id} value={member.id}>
                            {member.full_name} {member.email && `(${member.email})`}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {selectedMemberId === "self"
                      ? "Entries will be added to your own timesheet"
                      : "Entries will be added to the selected faculty member's timesheet"}
                  </p>
                </div>
              )}

              <Input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileSelect}
                disabled={isValidating || isImporting}
              />
              {file && (
                <Alert>
                  <FileText className="h-4 w-4" />
                  <AlertTitle>File selected</AlertTitle>
                  <AlertDescription>
                    {file.name} ({(file.size / 1024).toFixed(1)} KB)
                  </AlertDescription>
                </Alert>
              )}
              {file && !validationResults.length && (
                <Button onClick={handleParseAndValidate} disabled={isValidating}>
                  {isValidating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Validate File
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Validation Results */}
        {validationResults.length > 0 && !importComplete && (
          <Card>
            <CardHeader>
              <CardTitle>Validation Results</CardTitle>
              <CardDescription>Review the validation results before importing</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Alert>
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertTitle>Valid Entries</AlertTitle>
                  <AlertDescription className="text-2xl font-bold">{validCount}</AlertDescription>
                </Alert>
                <Alert variant={invalidCount > 0 ? "destructive" : "default"}>
                  <XCircle className="h-4 w-4" />
                  <AlertTitle>Invalid Entries</AlertTitle>
                  <AlertDescription className="text-2xl font-bold">{invalidCount}</AlertDescription>
                </Alert>
              </div>

              <div className="border rounded-lg max-h-96 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-20">Row</TableHead>
                      <TableHead className="w-24">Status</TableHead>
                      {isAdmin && <TableHead>Email</TableHead>}
                      <TableHead>Date</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Activity</TableHead>
                      <TableHead>Errors</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {validationResults.map((result, index) => (
                      <TableRow key={index}>
                        <TableCell>{result.rowNumber || index + 2}</TableCell>
                        <TableCell>
                          {result.isValid ? (
                            <Badge className="bg-green-600">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Valid
                            </Badge>
                          ) : (
                            <Badge variant="destructive">
                              <XCircle className="h-3 w-3 mr-1" />
                              Invalid
                            </Badge>
                          )}
                        </TableCell>
                        {isAdmin && <TableCell>{result.rowData?.faculty_email}</TableCell>}
                        <TableCell>{result.rowData?.entry_date}</TableCell>
                        <TableCell>
                          {result.rowData?.start_time} - {result.rowData?.end_time}
                        </TableCell>
                        <TableCell>{result.rowData?.activity_type}</TableCell>
                        <TableCell>
                          {result.errors.length > 0 && (
                            <span className="text-sm text-destructive">{result.errors.join(", ")}</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleImport} disabled={isImporting || validCount === 0}>
                  {isImporting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {isImporting
                    ? "Importing..."
                    : isMember || (isHod && selectedMemberId === "self")
                      ? `Submit ${validCount} Entries for Approval`
                      : `Import ${validCount} Valid Entries`}
                </Button>
                <Button variant="outline" onClick={handleReset}>
                  Cancel
                </Button>
              </div>

              {isImporting && (
                <div className="space-y-2">
                  <Progress value={importProgress} />
                  <p className="text-sm text-muted-foreground text-center">
                    {isMember || (isHod && selectedMemberId === "self")
                      ? "Submitting entries..."
                      : "Importing entries..."}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Import Complete */}
        {importComplete && (
          <Card>
            <CardHeader>
              <CardTitle>{isMember ? "Submission Complete" : "Import Complete"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Alert>
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertTitle>{isMember ? "Submitted" : "Imported"}</AlertTitle>
                  <AlertDescription className="text-2xl font-bold">{importStats.success}</AlertDescription>
                </Alert>
                {importStats.failed > 0 && (
                  <Alert variant="destructive">
                    <XCircle className="h-4 w-4" />
                    <AlertTitle>Failed</AlertTitle>
                    <AlertDescription className="text-2xl font-bold">{importStats.failed}</AlertDescription>
                  </Alert>
                )}
              </div>

              {isMember && importStats.success > 0 && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Next Steps</AlertTitle>
                  <AlertDescription>
                    Your timesheet entries have been submitted to your manager for approval. You can track their status
                    on your dashboard.
                  </AlertDescription>
                </Alert>
              )}

              <Button onClick={handleReset}>{isMember ? "Upload More Entries" : "Import Another File"}</Button>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
