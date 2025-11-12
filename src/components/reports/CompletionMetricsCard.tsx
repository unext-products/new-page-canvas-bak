import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, AlertCircle, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface CompletionMetricsCardProps {
  actualHours: number;
  expectedHours: number;
  completionRate: number;
  period: string;
}

export function CompletionMetricsCard({
  actualHours,
  expectedHours,
  completionRate,
  period,
}: CompletionMetricsCardProps) {
  const getStatusConfig = () => {
    if (completionRate >= 100) {
      return {
        status: "Exceeded Target",
        icon: TrendingUp,
        color: "text-success",
        bgColor: "bg-success/10",
        progressColor: "bg-success",
      };
    } else if (completionRate >= 70) {
      return {
        status: "On Track",
        icon: CheckCircle2,
        color: "text-success",
        bgColor: "bg-success/10",
        progressColor: "bg-success",
      };
    } else if (completionRate >= 50) {
      return {
        status: "Behind Schedule",
        icon: AlertCircle,
        color: "text-warning",
        bgColor: "bg-warning/10",
        progressColor: "bg-warning",
      };
    } else {
      return {
        status: "Critical",
        icon: AlertCircle,
        color: "text-destructive",
        bgColor: "bg-destructive/10",
        progressColor: "bg-destructive",
      };
    }
  };

  const statusConfig = getStatusConfig();
  const StatusIcon = statusConfig.icon;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Completion Rate</CardTitle>
        <CardDescription className="capitalize">{period} Progress</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-3xl font-bold">{completionRate.toFixed(1)}%</p>
            <p className="text-sm text-muted-foreground">
              {actualHours.toFixed(1)} of {expectedHours.toFixed(1)} hours
            </p>
          </div>
          <div className={cn("p-3 rounded-full", statusConfig.bgColor)}>
            <StatusIcon className={cn("h-6 w-6", statusConfig.color)} />
          </div>
        </div>

        <div className="space-y-2">
          <Progress value={Math.min(completionRate, 100)} className="h-2" />
          <div className="flex items-center justify-between text-sm">
            <span className={cn("font-medium", statusConfig.color)}>
              {statusConfig.status}
            </span>
            {completionRate > 100 && (
              <span className="text-muted-foreground">
                +{(actualHours - expectedHours).toFixed(1)} hours extra
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-4 border-t">
          <div>
            <p className="text-xs text-muted-foreground">Actual</p>
            <p className="text-lg font-semibold">{actualHours.toFixed(1)}h</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Expected</p>
            <p className="text-lg font-semibold">{expectedHours.toFixed(1)}h</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
