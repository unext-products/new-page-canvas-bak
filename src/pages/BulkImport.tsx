import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
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
import { 
  bulkInsertTimesheets, 
  fetchUsersAndDepartments
} from "@/lib/csvImportUtils";
import {
  parseExcelFile,
  validateMemberExcelRow,
  validateAdminExcelRow,
  generateMemberExcelTemplate,
  generateAdminExcelTemplate,
  fetchDepartments,
  getFileType,
  type ValidationResult as ExcelValidationResult
} from "@/lib/excelImportUtils";
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

  const isMember = userWithRole?.role === "member";
  const isAdmin = userWithRole?.role === "org_admin";
  const isHod = userWithRole?.role === "manager";

  // Fetch department members for HOD
  useEffect(() => {
    const fetchDepartmentMembers = async () => {
      if (!isHod || !userWithRole?.departmentId) return;
      
      setLoadingMembers(true);
      try {
        // Get all faculty in HOD's department
        const { data: userRoles, error: rolesError } = await supabase
          .from("user_roles")
          .select("user_id")
          .eq("department_id", userWithRole.departmentId)
          .eq("role", "faculty");

        if (rolesError) throw rolesError;

        if (userRoles && userRoles.length > 0) {
          const userIds = userRoles.map(ur => ur.user_id);
          
          // Get profiles for these users
          const { data: profiles, error: profilesError } = await supabase
            .from("profiles")
            .select("id, full_name")
            .in("id", userIds)
            .eq("is_active", true);

          if (profilesError) throw profilesError;

          // Get emails via edge function
          const { data: usersData, error: usersError } = await supabase.functions.invoke("admin-list-users");
          
          if (usersError) throw usersError;

          const emailMap = new Map(usersData?.users?.map((u: any) => [u.id, u.email]) || []);
          
          const members: DepartmentMember[] = (profiles || []).map(p => ({
            id: p.id,
            full_name: p.full_name,
            email: emailMap.get(p.id) as string || ""
          }));

          setDepartmentMembers(members);
        }
      } catch (error) {
        console.error("Error fetching department members:", error);
      } finally {
        setLoadingMembers(false);
      }
    };

    fetchDepartmentMembers();
  }, [isHod, userWithRole?.departmentId]);

  if (authLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  // Redirect if not member, admin, or HOD
  if (!isMember && !isAdmin && !isHod) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    // Validate file type - Excel only
    const fileType = getFileType(selectedFile.name);
    if (fileType !== 'excel') {
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

      if (isMember || isHod) {
        // Member or HOD mode: validate without email, use selected user
        const deptsMap = await fetchDepartments();
        
        // For HOD, use selected member if not "self"
        let targetUserId = userWithRole?.user.id;
        let targetDepartmentId = userWithRole?.departmentId;
        
        if (isHod && selectedMemberId !== "self") {
          targetUserId = selectedMemberId;
          // Department remains same as HOD's department
        }

        if (!targetUserId || !targetDepartmentId) {
          toast({
            title: "Error",
            description: "Could not determine user or department",
            variant: "destructive",
          });
          setIsValidating(false);
          return;
        }

        results = await Promise.all(
          rows.map(async (row, index) => {
            const validation = await validateMemberExcelRow(row, targetUserId!, targetDepartmentId!, deptsMap);
            return {
              rowNumber: index + 2,
              rowData: row,
              ...validation,
            };
          })
        );
      } else {
        // Admin mode: validate with email
        const { usersMap, deptsMap } = await fetchUsersAndDepartments();

        results = await Promise.all(
          rows.map(async (row, index) => {
            const validation = await validateAdminExcelRow(row, usersMap, deptsMap);
            return {
              rowNumber: index + 2,
              rowData: row,
              ...validation,
            };
          })
        );
      }

      setValidationResults(results);
      
      const validCount = results.filter(r => r.isValid).length;
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
    const validEntries = validationResults
      .filter((r) => r.isValid && r.data)
      .map((r) => r.data);

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
        const isForSelf = isMember || (isHod && selectedMemberId === "self");
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

  const handleDownloadTemplate = () => {
    let blob: Blob;
    let filename: string;

    if (isMember || isHod) {
      // Member/HOD template (no email column)
      blob = generateMemberExcelTemplate();
      filename = 'timesheet_template.xlsx';
    } else {
      // Admin template (with email column)
      blob = generateAdminExcelTemplate();
      filename = 'timesheet_import_template.xlsx';
    }

    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const handleReset = () => {
    setFile(null);
    setValidationResults([]);
    setImportComplete(false);
    setImportStats({ success: 0, failed: 0 });
    setImportProgress(0);
    setSelectedMemberId("self");
  };

  const validCount = validationResults.filter(r => r.isValid).length;
  const invalidCount = validationResults.length - validCount;

  const getPageTitle = () => {
    if (isMember) return "Bulk Upload My Timesheets";
    if (isHod) return "Bulk Upload Timesheets";
    return "Bulk Import Timesheets (Admin)";
  };

  const getPageDescription = () => {
    if (isMember) return "Upload your timesheet entries in bulk. Entries will be submitted for manager approval.";
    if (isHod) return "Upload timesheet entries for yourself or your department members.";
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
            <CardDescription>
              Download a template file with example data and required columns
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleDownloadTemplate} variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Download Excel Template
            </Button>
            <p className="text-sm text-muted-foreground mt-4">
              {(isMember || isHod)
                ? "Template includes: date, times, activity type, subtype, notes, and department code"
                : "Template includes: member email, date, times, activity type, subtype, notes, and department code"
              }
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
              <CardDescription>
                Select an Excel file containing timesheet entries (max 1000 rows, 5MB)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* HOD Member Selection */}
              {isHod && (
                <div className="space-y-2">
                  <Label htmlFor="member-select">Choose Member</Label>
                  <Select value={selectedMemberId} onValueChange={setSelectedMemberId}>
                    <SelectTrigger id="member-select">
                      <SelectValue placeholder="Select member" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="self">Self (My Timesheet)</SelectItem>
                      {loadingMembers ? (
                        <SelectItem value="loading" disabled>Loading members...</SelectItem>
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
                      : "Entries will be added to the selected faculty member's timesheet"
                    }
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
              <CardDescription>
                Review the validation results before importing
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Alert>
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertTitle>Valid Entries</AlertTitle>
                  <AlertDescription className="text-2xl font-bold">
                    {validCount}
                  </AlertDescription>
                </Alert>
                <Alert variant={invalidCount > 0 ? "destructive" : "default"}>
                  <XCircle className="h-4 w-4" />
                  <AlertTitle>Invalid Entries</AlertTitle>
                  <AlertDescription className="text-2xl font-bold">
                    {invalidCount}
                  </AlertDescription>
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
                            <span className="text-sm text-destructive">
                              {result.errors.join(", ")}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex gap-2">
                <Button 
                  onClick={handleImport}
                  disabled={isImporting || validCount === 0}
                >
                  {isImporting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {isImporting 
                    ? "Importing..." 
                    : (isMember || (isHod && selectedMemberId === "self"))
                      ? `Submit ${validCount} Entries for Approval` 
                      : `Import ${validCount} Valid Entries`
                  }
                </Button>
                <Button variant="outline" onClick={handleReset}>
                  Cancel
                </Button>
              </div>

              {isImporting && (
                <div className="space-y-2">
                  <Progress value={importProgress} />
                  <p className="text-sm text-muted-foreground text-center">
                    {(isMember || (isHod && selectedMemberId === "self")) ? "Submitting entries..." : "Importing entries..."}
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
              <CardTitle>
                {isMember ? "Submission Complete" : "Import Complete"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Alert>
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertTitle>
                    {isMember ? "Submitted" : "Imported"}
                  </AlertTitle>
                  <AlertDescription className="text-2xl font-bold">
                    {importStats.success}
                  </AlertDescription>
                </Alert>
                {importStats.failed > 0 && (
                  <Alert variant="destructive">
                    <XCircle className="h-4 w-4" />
                    <AlertTitle>Failed</AlertTitle>
                    <AlertDescription className="text-2xl font-bold">
                      {importStats.failed}
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              {isMember && importStats.success > 0 && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Next Steps</AlertTitle>
                  <AlertDescription>
                    Your timesheet entries have been submitted to your manager for approval. 
                    You can track their status on your dashboard.
                  </AlertDescription>
                </Alert>
              )}

              <Button onClick={handleReset}>
                {isMember ? "Upload More Entries" : "Import Another File"}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}