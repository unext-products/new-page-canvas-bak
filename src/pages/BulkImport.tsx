import { useState } from "react";
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
  parseCSVFile, 
  validateCSVRow, 
  bulkInsertTimesheets, 
  fetchUsersAndDepartments,
  generateCSVTemplate,
  type ValidationResult as CSVValidationResult
} from "@/lib/csvImportUtils";
import {
  parseExcelFile,
  validateFacultyExcelRow,
  validateAdminExcelRow,
  generateFacultyExcelTemplate,
  generateAdminExcelTemplate,
  fetchDepartments,
  getFileType,
  type ValidationResult as ExcelValidationResult
} from "@/lib/excelImportUtils";

type ValidationResult = (CSVValidationResult | ExcelValidationResult) & { rowNumber?: number; rowData?: any };

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

  const isFaculty = userWithRole?.role === "faculty";
  const isAdmin = userWithRole?.role === "admin";

  if (authLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  // Redirect if not faculty or admin
  if (!isFaculty && !isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    // Validate file type
    const fileType = getFileType(selectedFile.name);
    if (fileType === 'unknown') {
      toast({
        title: "Invalid file type",
        description: "Please upload a CSV or Excel file (.csv, .xlsx, .xls)",
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
      const fileType = getFileType(file.name);
      let rows: any[] = [];

      // Parse file based on type
      if (fileType === 'csv') {
        rows = await parseCSVFile(file);
      } else if (fileType === 'excel') {
        rows = await parseExcelFile(file);
      }

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

      if (isFaculty) {
        // Faculty mode: validate without email, use current user
        const deptsMap = await fetchDepartments();
        const userId = userWithRole?.user.id;
        const departmentId = userWithRole?.departmentId;

        if (!userId || !departmentId) {
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
            const validation = await validateFacultyExcelRow(row, userId, departmentId, deptsMap);
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

        if (fileType === 'csv') {
          results = await Promise.all(
            rows.map(async (row, index) => {
              const validation = await validateCSVRow(row, usersMap, deptsMap);
              return {
                rowNumber: index + 2,
                rowData: row,
                ...validation,
              };
            })
          );
        } else {
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
        toast({
          title: isFaculty ? "Submitted for approval" : "Import complete",
          description: isFaculty 
            ? `${results.success} entries submitted to HOD for approval`
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

  const handleDownloadTemplate = (format: 'csv' | 'excel') => {
    let blob: Blob;
    let filename: string;

    if (isFaculty) {
      // Faculty template (no email column)
      if (format === 'excel') {
        blob = generateFacultyExcelTemplate();
        filename = 'my_timesheet_template.xlsx';
      } else {
        // Generate CSV from faculty template structure
        const csvContent = `entry_date,start_time,end_time,activity_type,activity_subtype,notes,department_code
2025-01-15,09:00,11:00,class,CS101 Lecture,Introduction to Programming,CS`;
        blob = new Blob([csvContent], { type: 'text/csv' });
        filename = 'my_timesheet_template.csv';
      }
    } else {
      // Admin template (with email column)
      if (format === 'excel') {
        blob = generateAdminExcelTemplate();
        filename = 'timesheet_import_template.xlsx';
      } else {
        const template = generateCSVTemplate();
        blob = new Blob([template], { type: 'text/csv' });
        filename = 'timesheet_import_template.csv';
      }
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
  };

  const validCount = validationResults.filter(r => r.isValid).length;
  const invalidCount = validationResults.length - validCount;

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">
            {isFaculty ? "Bulk Upload My Timesheets" : "Bulk Import Timesheets (Admin)"}
          </h1>
          <p className="text-muted-foreground mt-2">
            {isFaculty 
              ? "Upload your timesheet entries in bulk. Entries will be submitted for HOD approval."
              : "Upload timesheet entries for any faculty member using CSV or Excel files."
            }
          </p>
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
            <div className="flex gap-2">
              <Button onClick={() => handleDownloadTemplate('excel')} variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Download Excel Template
              </Button>
              <Button onClick={() => handleDownloadTemplate('csv')} variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Download CSV Template
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mt-4">
              {isFaculty 
                ? "Template includes: date, times, activity type, subtype, notes, and department code"
                : "Template includes: faculty email, date, times, activity type, subtype, notes, and department code"
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
                Select a CSV or Excel file containing timesheet entries (max 1000 rows, 5MB)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                type="file"
                accept=".csv,.xlsx,.xls"
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
                    : isFaculty 
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
                    {isFaculty ? "Submitting entries..." : "Importing entries..."}
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
                {isFaculty ? "Submission Complete" : "Import Complete"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Alert>
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertTitle>
                    {isFaculty ? "Submitted" : "Imported"}
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

              {isFaculty && importStats.success > 0 && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Next Steps</AlertTitle>
                  <AlertDescription>
                    Your timesheet entries have been submitted to your HOD for approval. 
                    You can track their status on your dashboard.
                  </AlertDescription>
                </Alert>
              )}

              <Button onClick={handleReset}>
                {isFaculty ? "Upload More Entries" : "Import Another File"}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}