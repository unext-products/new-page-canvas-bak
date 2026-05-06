import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { FacultyBreakdown } from "@/lib/reportQueries";
import { Calculator } from "lucide-react";

interface ExpectedHoursBreakdownTableProps {
  facultyBreakdown: FacultyBreakdown[];
  totalDays: number;
  holidayDays: number;
}

export function ExpectedHoursBreakdownTable({
  facultyBreakdown,
  totalDays,
  holidayDays,
}: ExpectedHoursBreakdownTableProps) {
  const totalExpectedHours = facultyBreakdown.reduce((sum, f) => sum + f.expectedHours, 0);
  const totalLeaveDays = facultyBreakdown.reduce((sum, f) => sum + f.leaveDays, 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Calculator className="h-5 w-5 text-muted-foreground" />
          <div>
            <CardTitle>Expected Hours Breakdown</CardTitle>
            <CardDescription>
              Per-member calculation • {totalDays} weekdays, {holidayDays} holidays in period
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Faculty</TableHead>
              <TableHead className="text-right">Leaves</TableHead>
              <TableHead className="text-right">Working Days</TableHead>
              <TableHead className="text-right">Daily Target</TableHead>
              <TableHead className="text-right">Expected Hours</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {facultyBreakdown
              .sort((a, b) => a.facultyName.localeCompare(b.facultyName))
              .map((faculty) => (
                <TableRow key={faculty.userId}>
                  <TableCell className="font-medium">{faculty.facultyName}</TableCell>
                  <TableCell className="text-right">
                    {faculty.leaveDays % 1 === 0 ? faculty.leaveDays : faculty.leaveDays.toFixed(1)}
                  </TableCell>
                  <TableCell className="text-right">
                    {faculty.workingDays % 1 === 0 ? faculty.workingDays : faculty.workingDays.toFixed(1)}
                  </TableCell>
                  <TableCell className="text-right">{faculty.dailyTargetHours}h</TableCell>
                  <TableCell className="text-right font-semibold">{faculty.expectedHours.toFixed(1)}h</TableCell>
                </TableRow>
              ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell className="font-bold">Total</TableCell>
              <TableCell className="text-right font-bold">
                {totalLeaveDays % 1 === 0 ? totalLeaveDays : totalLeaveDays.toFixed(1)}
              </TableCell>
              <TableCell className="text-right">—</TableCell>
              <TableCell className="text-right">—</TableCell>
              <TableCell className="text-right font-bold">{totalExpectedHours.toFixed(1)}h</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </CardContent>
    </Card>
  );
}
