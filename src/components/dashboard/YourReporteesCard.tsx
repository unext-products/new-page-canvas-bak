import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { DashboardReportee } from "@/lib/dashboardReportees";
import { getReportLevel } from "@/lib/reportLevel";

export function YourReporteesCard({ reportees }: { reportees: DashboardReportee[] }) {
  if (reportees.length === 0) return null;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="h-full min-h-28 w-full flex-col items-stretch justify-start gap-0 whitespace-normal border-border bg-card p-6 text-left text-card-foreground shadow-sm hover:bg-accent/50">
          <span className="flex items-center justify-between gap-2 text-sm font-medium text-muted-foreground">
            Your Reportees <Users className="h-4 w-4" />
          </span>
          <span className="mt-2 text-2xl font-bold">{reportees.length}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="flex w-[calc(100%-2rem)] flex-col overflow-hidden">
        <DialogHeader className="shrink-0 pr-6">
          <DialogTitle>Your Reportees</DialogTitle>
          <DialogDescription>{reportees.length} reportees</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 overflow-y-auto overscroll-contain">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="w-16">Level</TableHead>
                <TableHead className="w-28">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reportees.map(reportee => (
                <TableRow key={reportee.id}>
                  <TableCell className="break-words font-medium">{reportee.full_name}</TableCell>
                  <TableCell className="text-muted-foreground">{getReportLevel(reportee.role)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={reportee.is_active ? "border-success/30 bg-success/10 text-success" : "text-muted-foreground"}>
                      {reportee.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}