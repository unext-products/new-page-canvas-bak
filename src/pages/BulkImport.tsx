import { useState } from "react";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Upload, Download, CheckCircle, XCircle, AlertCircle, Loader2 } from "lucide-react";
import {
  parseCSVFile,
  validateCSVRow,
  bulkInsertTimesheets,
  fetchUsersAndDepartments,
  generateCSVTemplate,
  type ValidationResult,
} from "@/lib/csvImportUtils";

export default function BulkImport() {
  const { userWithRole, loading } = useAuth();
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [validationResults, setValidationResults] = useState<ValidationResult[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResults, setImportResults] = useState<any>(null);

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (userWithRole?.role !== "admin") {
    return <Navigate to="/dashboard" replace />;
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.endsWith(".csv")) {
        toast({
          title: "Invalid File",
          description: "Please select a CSV file",
          variant: "destructive",
        });
        return;
      }

      if (selectedFile.size > 5 * 1024 * 1024) {
        toast({
          title: "File Too Large",
          description: "Maximum file size is 5MB",
          variant: "destructive",
        });
        return;
      }

      setFile(selectedFile);
      setValidationResults([]);
      setImportResults(null);
    }
  };

  const handleParseAndValidate = async () => {
    if (!file) return;

    setIsValidating(true);
    try {
      const rows = await parseCSVFile(file);

      if (rows.length === 0) {
        toast({
          title: "Empty File",
          description: "The CSV file contains no data",
          variant: "destructive",
        });
        setIsValidating(false);
        return;
      }

      if (rows.length > 1000) {
        toast({
          title: "Too Many Rows",
          description: "Maximum 1000 rows per import",
          variant: "destructive",
        });
        setIsValidating(false);
        return;
      }

      const { usersMap, deptsMap } = await fetchUsersAndDepartments();

      const results = await Promise.all(
        rows.map((row) => validateCSVRow(row, usersMap, deptsMap))
      );

      setValidationResults(results);

      const validCount = results.filter((r) => r.isValid).length;
      const invalidCount = results.length - validCount;

      toast({
        title: "Validation Complete",
        description: `${validCount} valid, ${invalidCount} invalid rows`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to parse CSV file",
        variant: "destructive",
      });
    } finally {
      setIsValidating(false);
    }
  };

  const handleImport = async () => {
    const validEntries = validationResults
      .filter((r) => r.isValid && r.data)
      .map((r) => r.data!);

    if (validEntries.length === 0) {
      toast({
        title: "No Valid Entries",
        description: "There are no valid entries to import",
        variant: "destructive",
      });
      return;
    }

    setIsImporting(true);
    setImportProgress(0);

    try {
      const results = await bulkInsertTimesheets(validEntries);
      setImportResults(results);

      if (results.success > 0) {
        toast({
          title: "Import Complete",
          description: `Successfully imported ${results.success} entries`,
        });
      }

      if (results.failed > 0) {
        toast({
          title: "Import Errors",
          description: `${results.failed} entries failed to import`,
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Import Failed",
        description: error.message || "Failed to import entries",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
      setImportProgress(100);
    }
  };

  const downloadTemplate = () => {
    const csvContent = generateCSVTemplate();
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "timesheet_import_template.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const validCount = validationResults.filter((r) => r.isValid).length;
  const invalidCount = validationResults.length - validCount;

  return (
    <Layout>
      <div className="container mx-auto py-8 px-4 max-w-6xl">
        <h1 className="text-3xl font-bold mb-6">Bulk Import Timesheets</h1>

        {/* Step 1: File Upload */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Step 1: Upload CSV File</CardTitle>
            <CardDescription>
              Upload a CSV file with timesheet entries. Download the template below for the correct
              format.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Button onClick={downloadTemplate} variant="outline">
                <Download className="mr-2 h-4 w-4" />
                Download CSV Template
              </Button>

              <div className="flex items-center gap-4">
                <Input type="file" accept=".csv" onChange={handleFileSelect} className="flex-1" />
                {file && (
                  <Button onClick={handleParseAndValidate} disabled={isValidating}>
                    {isValidating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Validate File
                  </Button>
                )}
              </div>

              {file && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>File Selected</AlertTitle>
                  <AlertDescription>
                    {file.name} ({(file.size / 1024).toFixed(2)} KB)
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Step 2: Validation Results */}
        {validationResults.length > 0 && !importResults && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Step 2: Validation Results</CardTitle>
              <CardDescription>
                Review the validation results. Only valid rows will be imported.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex gap-4">
                  <Alert className="flex-1">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <AlertTitle>Valid Rows</AlertTitle>
                    <AlertDescription className="text-2xl font-bold">
                      {validCount}
                    </AlertDescription>
                  </Alert>
                  <Alert className="flex-1" variant={invalidCount > 0 ? "destructive" : "default"}>
                    <XCircle className="h-4 w-4" />
                    <AlertTitle>Invalid Rows</AlertTitle>
                    <AlertDescription className="text-2xl font-bold">
                      {invalidCount}
                    </AlertDescription>
                  </Alert>
                </div>

                <div className="max-h-96 overflow-auto border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Status</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Time</TableHead>
                        <TableHead>Activity</TableHead>
                        <TableHead>Errors</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {validationResults.map((result, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            {result.isValid ? (
                              <Badge variant="default" className="bg-green-600">
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
                          <TableCell>{result.rowData?.faculty_email}</TableCell>
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
                  <Button onClick={handleImport} disabled={validCount === 0 || isImporting}>
                    {isImporting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Import {validCount} Valid Rows
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setFile(null);
                      setValidationResults([]);
                    }}
                  >
                    Cancel
                  </Button>
                </div>

                {isImporting && (
                  <div className="space-y-2">
                    <Progress value={importProgress} />
                    <p className="text-sm text-muted-foreground text-center">Importing...</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Import Results */}
        {importResults && (
          <Card>
            <CardHeader>
              <CardTitle>Import Complete</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex gap-4">
                  <Alert className="flex-1">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <AlertTitle>Successfully Imported</AlertTitle>
                    <AlertDescription className="text-2xl font-bold">
                      {importResults.success}
                    </AlertDescription>
                  </Alert>
                  {importResults.failed > 0 && (
                    <Alert className="flex-1" variant="destructive">
                      <XCircle className="h-4 w-4" />
                      <AlertTitle>Failed</AlertTitle>
                      <AlertDescription className="text-2xl font-bold">
                        {importResults.failed}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>

                {importResults.errors.length > 0 && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Errors</AlertTitle>
                    <AlertDescription>
                      {importResults.errors.map((err: any, i: number) => (
                        <div key={i}>
                          Batch {err.batch}: {err.error}
                        </div>
                      ))}
                    </AlertDescription>
                  </Alert>
                )}

                <Button
                  onClick={() => {
                    setFile(null);
                    setValidationResults([]);
                    setImportResults(null);
                  }}
                >
                  Import Another File
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
