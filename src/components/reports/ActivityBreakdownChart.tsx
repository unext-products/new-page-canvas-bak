import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ActivityBreakdown {
  activityType: string;
  hours: number;
  percentage: number;
  count: number;
}

interface ActivityBreakdownChartProps {
  data: ActivityBreakdown[];
}

export function ActivityBreakdownChart({ data }: ActivityBreakdownChartProps) {
  const chartData = data
    .filter((item) => item.activityType)
    .map((item) => ({
      name: item.activityType
        .replace(/_/g, ' ')
        .trim()
        .replace(/\b\w/g, (c: string) => c.toUpperCase()),
      hours: item.hours,
      percentage: item.percentage,
      count: item.count,
    }))
    .sort((a, b) => b.hours - a.hours);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload;
      return (
        <div className="bg-popover border border-border rounded-lg shadow-lg p-3">
          <p className="font-semibold text-foreground">{d.name}</p>
          <p className="text-sm text-muted-foreground">
            {d.hours.toFixed(1)} hours ({d.percentage.toFixed(1)}%)
          </p>
          <p className="text-sm text-muted-foreground">
            {d.count} {d.count === 1 ? "entry" : "entries"}
          </p>
        </div>
      );
    }
    return null;
  };

  if (data.length === 0) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Activity Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[200px] text-muted-foreground">
            No activity data available
          </div>
        </CardContent>
      </Card>
    );
  }

  const barHeight = 32;
  const chartHeight = Math.max(150, chartData.length * barHeight);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Activity Breakdown</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 pb-4">
        <div className="h-full max-h-[280px] overflow-y-auto">
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 0, right: 45, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="name"
                width={200}
                tick={{ fontSize: 10, fill: "hsl(var(--foreground))" }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "hsl(var(--muted))" }} />
              <Bar
                dataKey="hours"
                fill="hsl(var(--primary))"
                radius={[0, 4, 4, 0]}
                barSize={16}
                label={{
                  position: "right",
                  formatter: (val: number) => `${val.toFixed(1)}h`,
                  fontSize: 10,
                  fill: "hsl(var(--muted-foreground))",
                }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
